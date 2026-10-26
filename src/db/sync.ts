// The sync engine. Triggers: app open, the browser "online" event, the Sync
// now button, and a timer while the app is open. It does not use the
// Background Sync API (Safari lacks it).
import { db, serverRow, setMeta, type LocalAssessment, type LocalStructure, type OutboxItem } from './local'
import { backend, assertOnline, hooks, midSyncDropper, BackendError } from './backend'
import { compressPhoto } from '../lib/photo'

const ORDER = { structure: 0, assessment: 1, photo: 2, share: 3 } as const
const BASE_DELAY_S = 5
const MAX_DELAY_S = 600

export interface SyncResult { sent: number; failed: number; skipped: number; message: string }

let running: Promise<SyncResult> | null = null
const listeners = new Set<(running: boolean) => void>()
export const onSyncRunning = (fn: (running: boolean) => void) => (listeners.add(fn), () => void listeners.delete(fn))
const emit = (r: boolean) => listeners.forEach((fn) => fn(r))

function backoff(attempts: number) {
  const s = Math.min(MAX_DELAY_S, BASE_DELAY_S * 2 ** (attempts - 1))
  return s * 1000 * (0.8 + Math.random() * 0.4) // jitter so retries don't line up
}

/** Push everything pending, then pull fresh server data. One run at a time. */
export function syncNow(manual = false): Promise<SyncResult> {
  if (running) return running
  emit(true)
  running = (async () => {
    try {
      const pushed = await push(manual)
      if (pushed.failed === 0 || pushed.sent > 0) await pull().catch(() => {})
      if (pushed.failed === 0) await setMeta('lastSync', new Date().toISOString())
      return pushed
    } finally {
      running = null
      emit(false)
    }
  })()
  return running
}

async function push(manual: boolean): Promise<SyncResult> {
  const now = Date.now()
  const items = (await db.outbox.where('state').anyOf(manual ? ['queued', 'paused'] : ['queued']).toArray())
    .filter((i) => manual || i.next_try_at <= now)
    .sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.created_at - b.created_at)

  const guard = midSyncDropper()
  const result: SyncResult = { sent: 0, failed: 0, skipped: 0, message: '' }

  for (const item of items) {
    try {
      assertOnline()
      const outcome = await send(item, guard)
      if (outcome === 'skip') result.skipped++
      else result.sent++
    } catch (e) {
      result.failed++
      const err = e instanceof BackendError ? e : new BackendError('server', (e as Error).message)
      result.message = err.message
      const stop = await handleFailure(item, err)
      if (stop) break
    }
  }
  if (!result.message) result.message = result.sent ? `Sent ${result.sent} item${result.sent === 1 ? '' : 's'}.` : 'Nothing waiting.'
  return result
}

type Guard = ReturnType<typeof midSyncDropper>

async function send(item: OutboxItem, guard: Guard): Promise<'sent' | 'skip'> {
  if (item.kind === 'share') {
    const [event_id, acequia_id] = item.entity_id.split('|')
    const share = await db.shares.get([event_id, acequia_id])
    if (!share) return finish(item)
    await guard(() => backend.upsert('event_shares', serverRow(share)))
    await db.shares.update([event_id, acequia_id], { pending: false })
    return finish(item)
  }

  if (item.kind === 'photo') {
    const photo = await db.photos.get(item.entity_id)
    if (!photo) return finish(item)
    // parent row first; the photo waits until its parent is on the server
    const parent = photo.assessment_id ? await db.assessments.get(photo.assessment_id) : await db.structures.get(photo.structure_id!)
    if (!parent || parent.sync_state !== 'synced') return 'skip'
    if (!photo.blob) throw new BackendError('validation', 'The photo file is missing on this phone.')
    await db.photos.update(photo.id, { sync_state: 'uploading' })
    await guard(() => backend.uploadPhoto(photo.storage_path, photo.blob!))
    await guard(() => backend.upsert('photos', serverRow({ ...photo, bytes: photo.blob!.size })))
    // confirmed: free the full-size image, keep the thumbnail
    await db.transaction('rw', db.photos, db.outbox, async () => {
      await db.photos.update(photo.id, { sync_state: 'synced', blob: null, sync_error: undefined })
      await db.outbox.delete(item.id)
    })
    return 'sent'
  }

  const table = item.kind === 'assessment' ? db.assessments : db.structures
  const row = (await table.get(item.entity_id)) as LocalAssessment | LocalStructure | undefined
  if (!row) return finish(item)
  if (row.sync_state === 'draft') return 'skip' // being edited; wait for Save
  const sentVersion = row.version
  await table.update(row.id, { sync_state: 'uploading' })
  await guard(() => backend.upsert(item.kind === 'assessment' ? 'assessments' : 'structures', serverRow(row)))
  await db.transaction('rw', [db.assessments, db.structures, db.outbox], async () => {
    const now = (await table.get(row.id)) as LocalAssessment | LocalStructure | undefined
    // if the steward edited it while it was uploading, leave it queued
    if (now && now.version === sentVersion && now.sync_state === 'uploading') {
      await table.update(row.id, { sync_state: 'synced', base_version: sentVersion, sync_error: undefined })
      await db.outbox.delete(item.id)
    }
  })
  return 'sent'
}

async function finish(item: OutboxItem): Promise<'sent'> {
  await db.outbox.delete(item.id)
  return 'sent'
}

/** Returns true when the whole run should stop. */
async function handleFailure(item: OutboxItem, err: BackendError): Promise<boolean> {
  const entityTable = item.kind === 'assessment' ? db.assessments : item.kind === 'structure' ? db.structures : item.kind === 'photo' ? db.photos : null
  const markEntity = async (state: 'queued' | 'error' | 'conflict', msg?: string) => {
    const cur = await entityTable?.get(item.entity_id)
    // never overwrite an edit the steward started while this was uploading
    if (cur && cur.sync_state !== 'draft') await entityTable!.update(item.entity_id, { sync_state: state, sync_error: msg })
  }

  switch (err.kind) {
    case 'network':
    case 'server': {
      // no signal is not a failed attempt: retry as soon as the phone is back online
      if (err.kind === 'network' && (!navigator.onLine || hooks.simulateOffline)) {
        await markEntity('queued')
        return true
      }
      const attempts = item.attempts + 1
      await db.outbox.update(item.id, { attempts, next_try_at: Date.now() + backoff(attempts), last_error: err.message })
      await markEntity('queued')
      return err.kind === 'network' // no point trying the rest without a connection
    }
    case 'auth':
      await db.outbox.where('state').equals('queued').modify({ state: 'paused', last_error: err.message })
      await markEntity('queued')
      await setMeta('authExpired', true)
      return true
    case 'too_large': {
      const photo = await db.photos.get(item.entity_id)
      if (photo?.blob && item.attempts < 3) {
        const smaller = await compressPhoto(photo.blob, 1200 - item.attempts * 300, 0.6)
        await db.photos.update(photo.id, { blob: smaller.blob, bytes: smaller.bytes, width: smaller.width, height: smaller.height })
        await db.outbox.update(item.id, { attempts: item.attempts + 1, next_try_at: 0, last_error: 'Photo too large, shrinking and retrying.' })
        return false
      }
      await db.outbox.update(item.id, { state: 'error', last_error: 'Photo is still too large after shrinking.' })
      await markEntity('error', 'Photo is still too large after shrinking.')
      return false
    }
    case 'conflict': {
      if (item.kind === 'assessment' || item.kind === 'structure') {
        const local = await (item.kind === 'assessment' ? db.assessments : db.structures).get(item.entity_id)
        let server = null
        try {
          server = item.kind === 'structure' ? await backend.getStructure(item.entity_id)
            : (await backend.getAssessment(item.entity_id)) ??
              ((local as LocalAssessment)?.structure_id ? await backend.findAssessment((local as LocalAssessment).event_id, (local as LocalAssessment).structure_id!) : null)
        } catch { /* show the conflict anyway; the copy can be fetched on retry */ }
        await entityTable!.update(item.entity_id, { sync_state: 'conflict', sync_error: err.message, server_copy: server ?? undefined } as never)
      }
      await db.outbox.update(item.id, { state: 'conflict', last_error: err.message })
      return false
    }
    case 'validation':
      await db.outbox.update(item.id, { state: 'error', last_error: err.message })
      await markEntity('error', err.message)
      return false
  }
}

/** Refresh reference data and the steward's acequias without clobbering pending edits. */
export async function pull() {
  assertOnline()
  const boot = await backend.bootstrap()
  await setMeta('profile', boot.profile)
  await setMeta('authExpired', false)
  const pendingShares = await db.shares.filter((s) => s.pending).toArray()
  await db.transaction('rw', [db.acequias, db.events, db.memberships, db.shares], async () => {
    await db.acequias.clear()
    await db.acequias.bulkPut(boot.acequias)
    await db.events.clear()
    await db.events.bulkPut(boot.events)
    await db.memberships.clear()
    await db.memberships.bulkPut(boot.memberships)
    await db.shares.clear()
    await db.shares.bulkPut(boot.shares.map((s) => ({ ...s, pending: false })))
    await db.shares.bulkPut(pendingShares)
  })
  if (boot.profile.role !== 'steward') return

  const data = await backend.pullAcequias(boot.memberships.map((m) => m.acequia_id))
  await db.transaction('rw', [db.structures, db.assessments, db.photos], async () => {
    for (const s of data.structures) {
      const local = await db.structures.get(s.id)
      if (!local || local.sync_state === 'synced') await db.structures.put({ ...s, sync_state: 'synced', base_version: s.version })
    }
    for (const a of data.assessments) {
      const local = await db.assessments.get(a.id)
      if (!local || local.sync_state === 'synced') await db.assessments.put({ ...a, sync_state: 'synced', base_version: a.version })
    }
    for (const p of data.photos) {
      if (!(await db.photos.get(p.id))) await db.photos.put({ ...p, sync_state: 'synced', blob: null, thumb: null, original_bytes: p.bytes })
    }
  })
  void keepReportPhotos(data.photos)
}

/**
 * Keep a copy of each report photo on the phone (in the background, while there
 * is signal), so the damage packet still has its pictures out in the field.
 * Capped so a big event can't fill the phone.
 */
async function keepReportPhotos(photos: { id: string; storage_path: string; assessment_id: string | null }[]) {
  let kept = 0
  for (const p of photos) {
    if (!p.assessment_id || kept >= 150) continue
    const local = await db.photos.get(p.id)
    if (!local || local.blob || local.thumb) continue
    try {
      const url = await backend.photoUrl(p.storage_path)
      const blob = await (await fetch(url)).blob()
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      await db.photos.update(p.id, { thumb: blob })
      kept++
    } catch {
      return // no signal or no access: try again on the next sync
    }
  }
}

// ---- triggers ----

let timer: ReturnType<typeof setInterval> | undefined
export function startAutoSync() {
  const run = () => void syncNow().catch(() => {})
  // back online: send everything now, ignoring any backoff from before
  const online = () => void syncNow(true).catch(() => {})
  window.addEventListener('online', online)
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') run()
  }, 60_000)
  run()
  return () => {
    window.removeEventListener('online', online)
    clearInterval(timer)
  }
}
