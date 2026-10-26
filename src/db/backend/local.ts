// A stand-in server that lives in this browser, for running the whole app
// before Supabase is configured. It mirrors the SQL constraints and access
// rules closely enough to exercise sync, conflicts and refusals, but the real
// security boundary is the Postgres RLS in supabase/schema.sql.
import Dexie, { type Table } from 'dexie'
import { BackendError, type Backend, type WritableTable } from './types'
import type { AccessRequest, Acequia, Assessment, AwEvent, EventShare, Membership, Photo, Profile, Structure } from '../types'
import * as demo from '../../demo/seed'

interface Blobs { path: string; blob: Blob }

class DevServer extends Dexie {
  profiles!: Table<Profile & { email: string; pw?: string }, string>
  access_requests!: Table<AccessRequest, string>
  acequias!: Table<Acequia, string>
  memberships!: Table<Membership, [string, string]>
  events!: Table<AwEvent, string>
  structures!: Table<Structure, string>
  assessments!: Table<Assessment, string>
  photos!: Table<Photo, string>
  event_shares!: Table<EventShare, [string, string]>
  packets!: Table<Record<string, unknown>, string>
  files!: Table<Blobs, string>
  constructor() {
    super('acequia-watch-devserver')
    this.version(1).stores({
      profiles: 'id, email', acequias: 'id', memberships: '[user_id+acequia_id], user_id', events: 'id',
      structures: 'id, acequia_id', assessments: 'id, event_id, acequia_id, [event_id+structure_id]',
      photos: 'id, acequia_id, assessment_id', event_shares: '[event_id+acequia_id], event_id', packets: 'id', files: 'path',
    })
    this.version(2).stores({ access_requests: 'id, user_id, status' })
  }
}

const SESSION_KEY = 'aw-local-session'
const USER_IDS = {
  steward: 'd0000000-0000-4000-8000-000000000001',
  steward2: 'd0000000-0000-4000-8000-000000000002',
  agency: 'd0000000-0000-4000-8000-000000000003',
  admin: 'd0000000-0000-4000-8000-000000000004',
  newcomer: 'd0000000-0000-4000-8000-000000000005',
}

const reject = (msg: string) => new BackendError('validation', `The server refused this record: ${msg}`, '23514')

const SEED_KEY = 'aw-devserver-seed'

/** Passwords for accounts made in this browser are kept only as a SHA-256 hash. */
async function hash(pw: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`aw-local:${pw}`))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function seed(s: DevServer) {
  if ((await s.profiles.count()) > 0 && localStorage.getItem(SEED_KEY) === String(demo.SEED_VERSION)) return
  await s.transaction('rw', s.tables, async () => {
    await Promise.all(s.tables.map((t) => t.clear()))
    await s.profiles.bulkPut(
      (Object.keys(demo.DEMO_USERS) as (keyof typeof demo.DEMO_USERS)[]).map((k) => ({
        id: USER_IDS[k], email: demo.DEMO_USERS[k].email, display_name: demo.DEMO_USERS[k].display_name, role: demo.DEMO_USERS[k].role,
      })),
    )
    // a made-up newcomer waiting for approval, so the admin demo has a request to look at
    await s.profiles.put({ id: USER_IDS.newcomer, email: 'newcomer@demo.acequiawatch.org', display_name: 'Demo Newcomer', role: 'steward' })
    await s.access_requests.put({ id: 'e0000000-0000-4000-8000-000000000001', user_id: USER_IDS.newcomer, requested_role: 'steward', acequia_name: 'Acequia Madre del Río Sombra', acequia_role: 'parciante', organization: null, note: 'My family irrigates the lower fields. The mayordomo knows me.', status: 'pending', created_at: '2026-10-20T15:00:00Z' })
    await s.acequias.bulkPut(demo.acequias)
    await s.memberships.bulkPut(demo.membershipsFor(USER_IDS))
    await s.events.put(demo.event)
    await s.structures.bulkPut(demo.structures)
    await s.assessments.bulkPut(demo.assessments)
    await s.event_shares.bulkPut(demo.shares(USER_IDS.steward))
    for (const p of demo.photos) {
      const a = demo.assessments.find((x) => x.id === p.assessment_id)!
      const st = demo.structures.find((x) => x.id === a.structure_id)!
      const blob = new Blob([demo.demoPhotoSvg(st.name, a.severity ?? 1)], { type: 'image/svg+xml' })
      await s.photos.put({ ...p, bytes: blob.size })
      await s.files.put({ path: p.storage_path, blob })
    }
    for (const p of demo.baselinePhotos) {
      const st = demo.structures.find((x) => x.id === p.structure_id)!
      const blob = new Blob([demo.demoPhotoSvg(st.name, 1, true)], { type: 'image/svg+xml' })
      await s.photos.put({ ...p, bytes: blob.size })
      await s.files.put({ path: p.storage_path, blob })
    }
  })
  localStorage.setItem(SEED_KEY, String(demo.SEED_VERSION))
}

export function createLocalBackend(): Backend {
  const s = new DevServer()
  const ready = seed(s)
  const uid = () => localStorage.getItem(SESSION_KEY)

  async function me() {
    await ready
    const id = uid()
    const p = id ? await s.profiles.get(id) : undefined
    if (!p) throw new BackendError('auth', 'Not signed in.')
    const mine = (await s.memberships.where('user_id').equals(p.id).toArray()).map((m) => m.acequia_id)
    const shares = await s.event_shares.toArray()
    return {
      p,
      member: (a: string) => p.role === 'steward' && mine.includes(a),
      shared: (e: string, a: string) => shares.some((x) => x.event_id === e && x.acequia_id === a && x.shared),
      anyShare: (a: string) => shares.some((x) => x.acequia_id === a && x.shared),
      admin: p.role === 'admin',
      agency: p.role === 'agency',
    }
  }

  return {
    mode: 'local',
    async currentUserId() {
      return uid()
    },
    async signInWithPassword(email, password) {
      await ready
      const p = await s.profiles.where('email').equals(email.trim().toLowerCase()).first()
      if (!p) throw new BackendError('validation', 'No account with that email on this device.')
      if (p.pw && p.pw !== (await hash(password))) throw new BackendError('validation', 'That password doesn’t match.')
      localStorage.setItem(SESSION_KEY, p.id)
    },
    async signUp(email, password, display_name) {
      await ready
      const e = email.trim().toLowerCase()
      if (await s.profiles.where('email').equals(e).first()) throw new BackendError('validation', 'There is already an account with that email. Sign in instead.')
      if (password.length < 8) throw new BackendError('validation', 'Use at least 8 characters for the password.')
      const id = crypto.randomUUID()
      await s.profiles.put({ id, email: e, display_name: display_name.trim(), role: 'steward', pw: await hash(password) })
      localStorage.setItem(SESSION_KEY, id)
      return { signedIn: true }
    },
    async myRequest() {
      const c = await me()
      const rows = await s.access_requests.where('user_id').equals(c.p.id).toArray()
      return rows.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
    },
    async requestAccess(req) {
      const c = await me()
      if (await s.access_requests.where({ user_id: c.p.id, status: 'pending' }).first()) throw reject('you already have a request waiting')
      await s.access_requests.put({ ...req, id: crypto.randomUUID(), user_id: c.p.id, status: 'pending', created_at: new Date().toISOString() })
    },
    async sendMagicLink() {
      throw new BackendError('validation', 'Magic links need the Supabase backend. Use a demo account.')
    },
    async signOut() {
      localStorage.removeItem(SESSION_KEY)
    },

    async bootstrap() {
      const c = await me()
      const acequias = (await s.acequias.toArray()).filter((a) => c.member(a.id) || c.admin || (c.agency && c.anyShare(a.id)))
      return {
        profile: c.p,
        acequias,
        memberships: await s.memberships.where('user_id').equals(c.p.id).toArray(),
        events: await s.events.toArray(),
        shares: (await s.event_shares.toArray()).filter((x) => c.member(x.acequia_id) || c.agency || c.admin),
      }
    },

    async pullAcequias(ids) {
      const c = await me()
      const ok = ids.filter((a) => c.member(a) || c.admin)
      return {
        structures: (await s.structures.toArray()).filter((x) => ok.includes(x.acequia_id)),
        assessments: (await s.assessments.toArray()).filter((x) => ok.includes(x.acequia_id)),
        photos: (await s.photos.toArray()).filter((x) => ok.includes(x.acequia_id)),
      }
    },

    async upsert(table: WritableTable, row) {
      const c = await me()
      if (table === 'events' || table === 'acequias' || table === 'memberships') {
        if (!c.admin) throw new BackendError('validation', 'Only an admin can change this.', '42501')
        if (table === 'events') await s.events.put(row as unknown as AwEvent)
        else if (table === 'acequias') await s.acequias.put(row as unknown as Acequia)
        else await s.memberships.put(row as unknown as Membership)
        return
      }
      const acequia = row.acequia_id as string
      if (!(c.member(acequia) || c.admin)) throw new BackendError('validation', 'You do not have permission to save this.', '42501')

      if (table === 'structures') {
        const r = row as unknown as Structure
        if (r.lat === 0 && r.lng === 0) throw reject('location 0,0')
        const old = await s.structures.get(r.id)
        if (old && r.version < old.version) throw new BackendError('conflict', 'A newer version exists on the server.', 'AW409')
        await s.structures.put({ ...r, updated_at: new Date().toISOString() })
      } else if (table === 'assessments') {
        const r = row as unknown as Assessment
        if (r.cost_low != null && !(r.cost_low <= r.cost_likely! && r.cost_likely! <= r.cost_high!)) throw reject('costs must be low ≤ likely ≤ high')
        if (r.outcome === 'damaged' && (r.severity == null || r.cost_low == null || !r.photo_ids.length || r.lat == null)) {
          throw reject('damaged needs severity, costs, location and a photo')
        }
        if (r.lat === 0 && r.lng === 0) throw reject('location 0,0')
        const old = await s.assessments.get(r.id)
        if (old && r.version < old.version) throw new BackendError('conflict', 'A newer version exists on the server.', 'AW409')
        if (r.structure_id) {
          const other = await s.assessments.where('[event_id+structure_id]').equals([r.event_id, r.structure_id]).first()
          if (other && other.id !== r.id) throw new BackendError('conflict', 'This structure already has a report for this event.', '23505')
        }
        await s.assessments.put({ ...r, updated_at: new Date().toISOString() })
      } else if (table === 'photos') {
        if (!(await s.photos.get(row.id as string))) await s.photos.put(row as unknown as Photo)
      } else if (table === 'event_shares') {
        await s.event_shares.put({ ...(row as unknown as EventShare), changed_by: c.p.id, changed_at: new Date().toISOString() })
      } else {
        await s.packets.put(row)
      }
    },

    async getAssessment(id) {
      const c = await me()
      const a = await s.assessments.get(id)
      return a && (c.member(a.acequia_id) || c.admin) ? a : null
    },
    async findAssessment(event_id, structure_id) {
      const c = await me()
      const a = await s.assessments.where('[event_id+structure_id]').equals([event_id, structure_id]).first()
      return a && (c.member(a.acequia_id) || c.admin) ? a : null
    },
    async getStructure(id) {
      const c = await me()
      const x = await s.structures.get(id)
      return x && (c.member(x.acequia_id) || c.admin) ? x : null
    },

    async uploadPhoto(path, blob) {
      const c = await me()
      if (!(c.member(path.split('/')[0]) || c.admin)) throw new BackendError('validation', 'You do not have permission to save this.', '42501')
      if (blob.size > 5_000_000) throw new BackendError('too_large', 'Photo too large.')
      if (!(await s.files.get(path))) await s.files.put({ path, blob })
    },
    async photoUrl(path) {
      const c = await me()
      const [acequia, event] = path.split('/')
      const agencyOk = c.agency && (event === 'baseline' ? c.anyShare(acequia) : c.shared(event, acequia))
      if (!(c.member(acequia) || c.admin || agencyOk)) throw new BackendError('validation', 'No access to this photo.')
      const f = await s.files.get(path)
      if (!f) throw new BackendError('validation', 'Photo not found.')
      return URL.createObjectURL(f.blob)
    },

    async agencyEvent(event_id) {
      const c = await me()
      const visible = (a: string) => c.admin || (c.agency && c.shared(event_id, a))
      const assessments = (await s.assessments.where('event_id').equals(event_id).toArray()).filter((a) => visible(a.acequia_id))
      const ids = new Set(assessments.map((a) => a.id))
      return {
        acequias: (await s.acequias.toArray()).filter((a) => visible(a.id)),
        shares: (await s.event_shares.where('event_id').equals(event_id).toArray()).filter((x) => x.shared && visible(x.acequia_id)),
        structures: (await s.structures.toArray()).filter((x) => visible(x.acequia_id)),
        assessments,
        photos: (await s.photos.toArray()).filter((p) => (p.assessment_id && ids.has(p.assessment_id)) || (p.structure_id && (c.admin || (c.agency && c.anyShare(p.acequia_id))))),
      }
    },

    async adminData() {
      const c = await me()
      if (!c.admin) throw new BackendError('validation', 'Admins only.', '42501')
      return {
        profiles: await s.profiles.toArray(),
        memberships: await s.memberships.toArray(),
        acequias: await s.acequias.toArray(),
        events: await s.events.toArray(),
        shares: await s.event_shares.toArray(),
        requests: (await s.access_requests.toArray()).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      }
    },
    async decideRequest(id, approve, acequia_id) {
      const c = await me()
      if (!c.admin) throw new BackendError('validation', 'Admins only.', '42501')
      const r = await s.access_requests.get(id)
      if (!r || r.status !== 'pending') throw reject('no pending request')
      if (approve) {
        if (r.requested_role === 'agency') await s.profiles.update(r.user_id, { role: 'agency' })
        else if (!acequia_id) throw reject('pick the acequia to link this steward to')
        else await s.memberships.put({ user_id: r.user_id, acequia_id })
      }
      await s.access_requests.update(id, { status: approve ? 'approved' : 'declined' })
    },
    async removeMembership(user_id, acequia_id) {
      const c = await me()
      if (!c.admin) throw new BackendError('validation', 'Admins only.', '42501')
      await s.memberships.delete([user_id, acequia_id])
    },

    async publicSummary() {
      await ready
      const [events, acequias, all, shares] = await Promise.all([s.events.toArray(), s.acequias.toArray(), s.assessments.toArray(), s.event_shares.toArray()])
      // same rule as the SQL view (migration 0004): only acequias that shared the event count
      const rows = all.filter((a) => shares.some((x) => x.event_id === a.event_id && x.acequia_id === a.acequia_id && x.shared))
      const groups = new Map<string, Assessment[]>()
      for (const a of rows) {
        const key = `${a.event_id}|${acequias.find((q) => q.id === a.acequia_id)?.region}`
        groups.set(key, [...(groups.get(key) ?? []), a])
      }
      return [...groups].filter(([, g]) => g.length >= 3 && new Set(g.map((a) => a.acequia_id)).size >= 3).map(([key, g]) => {
        const [event_id, region] = key.split('|')
        const e = events.find((x) => x.id === event_id)!
        const d = g.filter((a) => a.outcome === 'damaged')
        const sum = (k: 'cost_low' | 'cost_likely' | 'cost_high') => d.reduce((t, a) => t + (a[k] ?? 0), 0)
        return { event_id, event_name: e.name, kind: e.kind, region, reports: g.length, damaged: d.length, cost_low: sum('cost_low'), cost_likely: sum('cost_likely'), cost_high: sum('cost_high') }
      })
    },
  }
}
