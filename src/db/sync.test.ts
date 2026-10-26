// Sync engine against the in-browser dev server, in Node with fake IndexedDB.
// This exercises the logic; the real-phone airplane-mode test is separate.
import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})
let online = true
vi.stubGlobal('navigator', { get onLine() { return online } })

const { db } = await import('./local')
const { backend, hooks } = await import('./backend')
const { saveAssessment, addPhoto } = await import('./actions')
const { syncNow, pull } = await import('./sync')
const demo = await import('../demo/seed')
import type { LocalAssessment } from './local'

const N_REPORTS = 50
const PHOTOS_EACH = 4

function report(i: number): LocalAssessment {
  return {
    id: crypto.randomUUID(), event_id: demo.EVENT_ID, acequia_id: demo.acequias[0].id,
    structure_id: null, unlisted_type: 'culvert', unlisted_name: `Test site ${i}`,
    outcome: 'damaged', severity: 2, description: 'test', agency_notes: '',
    cost_low: 100, cost_likely: 200, cost_high: 300, volunteer_hours: 1,
    lat: 36.09 + i * 1e-4, lng: -106.83, accuracy_m: 5, location_source: 'gps',
    photo_ids: [], captured_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    version: 1, base_version: 0, sync_state: 'draft',
  }
}

async function serverCounts() {
  const data = await backend.pullAcequias([demo.acequias[0].id])
  const ids = data.assessments.map((a) => a.id)
  const pids = data.photos.map((p) => p.id)
  return { assessments: ids.length, uniqueAssessments: new Set(ids).size, photos: pids.length, uniquePhotos: new Set(pids).size }
}

async function drain(max = 50) {
  let runs = 0
  while ((await db.outbox.count()) > 0 && runs < max) {
    await syncNow(true)
    runs++
  }
  return runs
}

beforeAll(async () => {
  await backend.signInWithPassword(demo.DEMO_USERS.steward.email, '')
  await pull()
})

describe('offline save, then sync', () => {
  it(`${N_REPORTS} reports with ${N_REPORTS * PHOTOS_EACH} photos sync with zero duplicates`, async () => {
    const before = await serverCounts()
    online = false
    for (let i = 0; i < N_REPORTS; i++) {
      const a = report(i)
      for (let k = 0; k < PHOTOS_EACH; k++) {
        const blob = new Blob([new Uint8Array(30_000)], { type: 'image/jpeg' })
        const p = await addPhoto({ acequia_id: a.acequia_id, event_id: a.event_id, assessment_id: a.id }, { blob, thumb: blob, width: 10, height: 10, bytes: blob.size, original_bytes: blob.size * 10 })
        a.photo_ids.push(p.id)
      }
      await saveAssessment(a)
    }
    expect(await db.outbox.count()).toBe(N_REPORTS * (1 + PHOTOS_EACH))
    const offline = await syncNow(true)
    expect(offline.sent).toBe(0) // nothing leaves the phone without signal
    expect(await db.assessments.where('sync_state').equals('queued').count()).toBe(N_REPORTS)

    online = true
    const t0 = performance.now()
    const runs = await drain()
    const ms = performance.now() - t0
    const after = await serverCounts()
    console.log(`SYNC offline batch: ${N_REPORTS} reports + ${N_REPORTS * PHOTOS_EACH} photos in ${runs} run(s), ${ms.toFixed(0)} ms (in-process dev server)`)
    expect(after.assessments - before.assessments).toBe(N_REPORTS)
    expect(after.photos - before.photos).toBe(N_REPORTS * PHOTOS_EACH)
    expect(after.assessments).toBe(after.uniqueAssessments)
    expect(after.photos).toBe(after.uniquePhotos)
    expect(await db.photos.filter((p) => p.blob !== null && p.sync_state === 'synced').count()).toBe(0)
  })
})

describe('sync under interruption', () => {
  it('a dropped connection mid-sync loses nothing and duplicates nothing', async () => {
    const before = await serverCounts()
    for (let i = 0; i < 10; i++) {
      const a = report(100 + i)
      const blob = new Blob([new Uint8Array(1000)], { type: 'image/jpeg' })
      const p = await addPhoto({ acequia_id: a.acequia_id, event_id: a.event_id, assessment_id: a.id }, { blob, thumb: blob, width: 1, height: 1, bytes: 1000, original_bytes: 1000 })
      a.photo_ids.push(p.id)
      await saveAssessment(a)
    }
    hooks.dropMidSync = true
    const first = await syncNow(true)
    expect(first.failed).toBeGreaterThan(0)
    const retries = await drain()
    const after = await serverCounts()
    console.log(`SYNC interruption: first run sent ${first.sent} then dropped; ${retries} retry run(s) to drain; dup assessments ${after.assessments - after.uniqueAssessments}, dup photos ${after.photos - after.uniquePhotos}`)
    expect(after.assessments - before.assessments).toBe(10)
    expect(after.photos - before.photos).toBe(10)
    expect(after.assessments).toBe(after.uniqueAssessments)
    expect(after.photos).toBe(after.uniquePhotos)
  })
})

describe('conflicts and validation', () => {
  it('an older version is flagged as a conflict, not silently overwritten', async () => {
    const a = { ...report(200), outcome: 'no_damage' as const, severity: null }
    await saveAssessment(a)
    await drain()
    // another device saves version 5 on the server
    const server = (await backend.getAssessment(a.id))!
    await backend.upsert('assessments', { ...server, version: 5, description: 'from another phone' })
    // this phone edits from its stale copy (base_version 1)
    const local = (await db.assessments.get(a.id))!
    await saveAssessment({ ...local, description: 'from this phone' })
    await syncNow(true)
    const after = (await db.assessments.get(a.id))!
    expect(after.sync_state).toBe('conflict')
    expect(after.server_copy?.description).toBe('from another phone')
  })

  it('a validation error stops retrying and keeps the data', async () => {
    const a = { ...report(300), cost_low: 900, cost_likely: 100, cost_high: 50 }
    await db.assessments.put({ ...a, photo_ids: ['x'] })
    await saveAssessment({ ...a, photo_ids: [] , outcome: 'no_damage' as const, severity: null })
    await syncNow(true)
    const row = (await db.assessments.get(a.id))!
    expect(row.sync_state).toBe('error')
    expect((await db.outbox.get(`assessment:${a.id}`))?.state).toBe('error')
  })
})
