// Every steward write goes through here: one local transaction writes the row
// and queues its outbox item. Nothing here touches the network.
import { db, type LocalAssessment, type LocalStructure, type OutboxKind } from './local'
import type { Assessment, LocalPhoto, Outcome } from './types'
import type { CompressedPhoto } from '../lib/photo'
import { uuid } from '../lib/format'

async function enqueue(kind: OutboxKind, entity_id: string) {
  const id = `${kind}:${entity_id}`
  const existing = await db.outbox.get(id)
  await db.outbox.put({
    id, kind, entity_id,
    created_at: existing?.created_at ?? Date.now(),
    attempts: 0, next_try_at: 0, last_error: null, state: 'queued',
  })
}

/** Rules the database also enforces; checked here first for friendly messages. */
export function validateAssessment(a: LocalAssessment): Record<string, string> {
  const e: Record<string, string> = {}
  if (!a.structure_id && !a.unlisted_type) e.type = 'Pick what kind of structure this is.'
  if (a.outcome === 'damaged') {
    if (!a.severity) e.severity = 'Pick how bad the damage is.'
    if (a.photo_ids.length < 1) e.photos = 'Add at least one photo of the damage.'
    if (a.cost_low == null || a.cost_likely == null || a.cost_high == null) e.cost = 'Enter low, likely, and high cost estimates.'
    if (a.lat == null) e.location = 'Add a location: GPS, the structure’s spot, or the map.'
  }
  if (a.cost_low != null && a.cost_likely != null && a.cost_high != null && !(a.cost_low <= a.cost_likely && a.cost_likely <= a.cost_high)) {
    e.cost = 'Costs must go low ≤ likely ≤ high.'
  }
  if (a.description.length > 500) e.description = 'Keep the description under 500 characters.'
  return e
}

/** Autosave: keeps every keystroke on the phone without queuing a sync. */
export async function saveDraft(a: LocalAssessment) {
  await db.assessments.put({ ...a, sync_state: 'draft', updated_at: new Date().toISOString() })
}

export async function saveAssessment(a: LocalAssessment) {
  await db.transaction('rw', db.assessments, db.photos, db.outbox, async () => {
    const row: LocalAssessment = {
      ...a,
      version: a.base_version + 1, // each saved edit is one version past what the server last confirmed
      sync_state: 'queued',
      sync_error: undefined,
      updated_at: new Date().toISOString(),
    }
    await db.assessments.put(row)
    await enqueue('assessment', a.id)
    // photos removed in the form and never uploaded can go
    const owned = await db.photos.where('assessment_id').equals(a.id).toArray()
    for (const p of owned) {
      if (!a.photo_ids.includes(p.id) && p.sync_state === 'draft') await db.photos.delete(p.id)
    }
    for (const id of a.photo_ids) {
      const p = await db.photos.get(id)
      if (p && p.sync_state !== 'synced') {
        await db.photos.update(id, { sync_state: 'queued' })
        await enqueue('photo', id)
      }
    }
  })
}

export async function saveStructure(s: LocalStructure) {
  await db.transaction('rw', db.structures, db.photos, db.outbox, async () => {
    await db.structures.put({ ...s, version: s.base_version + 1, sync_state: 'queued', sync_error: undefined, updated_at: new Date().toISOString() })
    await enqueue('structure', s.id)
    if (s.baseline_photo_id) {
      const p = await db.photos.get(s.baseline_photo_id)
      if (p && p.sync_state !== 'synced') {
        await db.photos.update(p.id, { sync_state: 'queued' })
        await enqueue('photo', p.id)
      }
    }
  })
}

/** Stores a compressed photo on the phone. It is queued when its parent is saved. */
export async function addPhoto(
  owner: { acequia_id: string; event_id: string | null; assessment_id?: string; structure_id?: string },
  c: CompressedPhoto,
): Promise<LocalPhoto> {
  const id = uuid()
  const ownerId = owner.assessment_id ?? owner.structure_id!
  const photo: LocalPhoto = {
    id,
    acequia_id: owner.acequia_id,
    assessment_id: owner.assessment_id ?? null,
    structure_id: owner.structure_id ?? null,
    storage_path: `${owner.acequia_id}/${owner.event_id ?? 'baseline'}/${ownerId}/${id}.jpg`,
    width: c.width, height: c.height, bytes: c.bytes, original_bytes: c.original_bytes,
    taken_at: new Date().toISOString(),
    blob: c.blob, thumb: c.thumb, sync_state: 'draft',
  }
  await db.photos.put(photo)
  return photo
}

export async function setShare(event_id: string, acequia_id: string, shared: boolean, user_id: string) {
  await db.transaction('rw', db.shares, db.outbox, async () => {
    await db.shares.put({ event_id, acequia_id, shared, changed_by: user_id, changed_at: new Date().toISOString(), pending: true })
    await enqueue('share', `${event_id}|${acequia_id}`)
  })
}

/** Only never-synced drafts can be deleted. */
export async function deleteDraft(id: string) {
  await db.transaction('rw', db.assessments, db.photos, db.outbox, async () => {
    const a = await db.assessments.get(id)
    if (!a || a.base_version > 0 || a.sync_state !== 'draft') throw new Error('Only unsent drafts can be deleted.')
    await db.photos.where('assessment_id').equals(id).delete()
    await db.outbox.delete(`assessment:${id}`)
    await db.assessments.delete(id)
  })
}

export async function retryItem(id: string) {
  await db.outbox.update(id, { state: 'queued', attempts: 0, next_try_at: 0, last_error: null })
}

/**
 * Conflict: keep the phone's copy (overwrites the server) or take the server's.
 * If another device reported the same structure first, the server row has a
 * different id; the local report is re-keyed onto it.
 */
export async function resolveConflict(kind: 'assessment' | 'structure', id: string, keep: 'mine' | 'theirs') {
  // the two tables share every field this function touches
  const table = (kind === 'assessment' ? db.assessments : db.structures) as unknown as typeof db.assessments
  await db.transaction('rw', [db.assessments, db.structures, db.photos, db.outbox], async () => {
    const row = (await table.get(id)) as LocalAssessment | LocalStructure | undefined
    const server = row?.server_copy
    if (!row || !server) return
    const rekey = server.id !== id
    await db.outbox.delete(`${kind}:${id}`)
    if (rekey) await table.delete(id)
    if (keep === 'theirs') {
      await table.put({ ...(server as Assessment), sync_state: 'synced', base_version: server.version, server_copy: undefined })
      if (rekey) await db.photos.where('assessment_id').equals(id).filter((p) => p.sync_state !== 'synced').delete()
    } else {
      await table.put({ ...(row as LocalAssessment), id: server.id, base_version: server.version, version: server.version + 1, sync_state: 'queued', server_copy: undefined, sync_error: undefined })
      if (rekey) await db.photos.where('assessment_id').equals(id).modify({ assessment_id: server.id })
      await enqueue(kind, server.id)
    }
  })
}

/** A fresh, unsaved report. Outcome starts empty so the steward must pick one. */
export function newAssessment(event_id: string, acequia_id: string, structure_id: string | null): LocalAssessment {
  const now = new Date().toISOString()
  return {
    id: uuid(), event_id, acequia_id, structure_id, unlisted_type: null, unlisted_name: null,
    outcome: undefined as unknown as Outcome, severity: null, description: '', agency_notes: '',
    cost_low: null, cost_likely: null, cost_high: null, volunteer_hours: null,
    lat: null, lng: null, accuracy_m: null, location_source: null, photo_ids: [],
    captured_at: now, updated_at: now, version: 1, base_version: 0, sync_state: 'draft',
  }
}
