// Supabase backend. Only the project URL and the public anon key reach the
// client; every rule is enforced by row-level security in Postgres.
import { createClient, type PostgrestError } from '@supabase/supabase-js'
import { BackendError, type Backend, type WritableTable } from './types'
import type { AccessRequest, Acequia, Assessment, AwEvent, EventShare, Membership, Photo, Profile, Structure } from '../types'

const BUCKET = 'photos'

function classify(e: PostgrestError | { message: string; code?: string; status?: number; statusCode?: string }): BackendError {
  const code = 'code' in e ? (e.code ?? '') : ''
  const msg = e.message ?? 'Unknown error'
  const status = Number((e as { status?: number; statusCode?: string }).status ?? (e as { statusCode?: string }).statusCode ?? 0)
  if (/fetch|network|Load failed|NetworkError/i.test(msg) && !code) return new BackendError('network', 'No connection to the server.')
  if (code === 'PGRST301' || code === 'PGRST303' || /JWT|not authenticated/i.test(msg) || status === 401) {
    return new BackendError('auth', 'Your sign-in expired. Sign in again when you have signal.', code)
  }
  if (code === 'AW409' || code === '23505') return new BackendError('conflict', 'A newer version exists on the server.', code)
  if (status === 413 || /too large|exceeded the maximum/i.test(msg)) return new BackendError('too_large', 'Photo too large.', code)
  if (code === '42501') return new BackendError('validation', 'You do not have permission to save this.', code)
  if (code.startsWith('23') || code.startsWith('22')) return new BackendError('validation', `The server refused this record: ${msg}`, code)
  if (status >= 500 || code.startsWith('PGRST') || !code) return new BackendError('server', `Server problem: ${msg}`, code)
  return new BackendError('validation', msg, code)
}

/** Wraps fetch failures (which supabase-js may throw) into BackendError. */
async function run<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  let res
  try {
    res = await p
  } catch (e) {
    throw new BackendError('network', (e as Error).message || 'No connection to the server.')
  }
  if (res.error) throw classify(res.error as PostgrestError)
  return (res.data ?? null) as T
}

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const sb = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })

  return {
    mode: 'supabase',

    async currentUserId() {
      // reads the stored session; no network round-trip
      const { data } = await sb.auth.getSession()
      return data.session?.user.id ?? null
    },
    async signInWithPassword(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new BackendError(error.status === 400 ? 'validation' : 'network', error.message)
    },
    async sendMagicLink(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + '/', shouldCreateUser: true } })
      if (error) throw new BackendError('validation', error.message)
    },
    async signOut() {
      await sb.auth.signOut()
    },
    async signUp(email, password, display_name) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name }, emailRedirectTo: location.origin + '/' } })
      if (error) throw new BackendError(error.status && error.status >= 500 ? 'network' : 'validation', error.message)
      return { signedIn: !!data.session }
    },
    async myRequest() {
      const rows = await run(sb.from('access_requests').select('*').order('created_at', { ascending: false }).limit(1).returns<AccessRequest[]>())
      return rows?.[0] ?? null
    },
    async requestAccess(req) {
      await run(sb.from('access_requests').insert(req))
    },

    async bootstrap() {
      const { data } = await sb.auth.getSession()
      if (!data.session) throw new BackendError('auth', 'Not signed in.')
      const uid = data.session.user.id
      const [profile, acequias, memberships, events, shares] = await Promise.all([
        run(sb.from('profiles').select('*').eq('id', uid).single<Profile>()),
        run(sb.from('acequias').select('*').returns<Acequia[]>()),
        run(sb.from('memberships').select('*').eq('user_id', uid).returns<Membership[]>()),
        run(sb.from('events').select('*').order('started_on', { ascending: false }).returns<AwEvent[]>()),
        run(sb.from('event_shares').select('*').returns<EventShare[]>()),
      ])
      return { profile: { ...profile, email: data.session.user.email }, acequias, memberships, events, shares }
    },

    async pullAcequias(ids) {
      if (!ids.length) return { structures: [], assessments: [], photos: [] }
      const [structures, assessments, photos] = await Promise.all([
        run(sb.from('structures').select('*').in('acequia_id', ids).returns<Structure[]>()),
        run(sb.from('assessments').select('*').in('acequia_id', ids).returns<Assessment[]>()),
        run(sb.from('photos').select('*').in('acequia_id', ids).returns<Photo[]>()),
      ])
      return { structures, assessments, photos }
    },

    async upsert(table: WritableTable, row) {
      const onConflict = table === 'event_shares' ? 'event_id,acequia_id' : table === 'memberships' ? 'user_id,acequia_id' : 'id'
      // photos are write-once: a retry after a lost acknowledgment is a no-op
      await run(sb.from(table).upsert(row, { onConflict, ignoreDuplicates: table === 'photos' }))
    },
    async getAssessment(id): Promise<Assessment | null> {
      return run(sb.from('assessments').select('*').eq('id', id).maybeSingle<Assessment>())
    },
    async findAssessment(event_id, structure_id): Promise<Assessment | null> {
      return run(sb.from('assessments').select('*').eq('event_id', event_id).eq('structure_id', structure_id).maybeSingle<Assessment>())
    },
    async getStructure(id): Promise<Structure | null> {
      return run(sb.from('structures').select('*').eq('id', id).maybeSingle<Structure>())
    },

    async uploadPhoto(path, blob) {
      let res
      try {
        res = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
      } catch (e) {
        throw new BackendError('network', (e as Error).message)
      }
      if (!res.error) return
      const err = res.error as { message: string; statusCode?: string }
      // already uploaded on an earlier attempt: that is success
      if (err.statusCode === '409' || /already exists|Duplicate/i.test(err.message)) return
      throw classify({ message: err.message, statusCode: err.statusCode })
    },
    async photoUrl(path) {
      const data = await run(sb.storage.from(BUCKET).createSignedUrl(path, 60 * 30))
      return data.signedUrl
    },

    async agencyEvent(event_id) {
      // RLS returns only acequia-event pairs that were shared
      const [acequias, shares, assessments] = await Promise.all([
        run(sb.from('acequias').select('*').returns<Acequia[]>()),
        run(sb.from('event_shares').select('*').eq('event_id', event_id).eq('shared', true).returns<EventShare[]>()),
        run(sb.from('assessments').select('*').eq('event_id', event_id).returns<Assessment[]>()),
      ])
      const sharedIds = shares.map((s) => s.acequia_id)
      const [structures, photos, baseline] = sharedIds.length
        ? await Promise.all([
            run(sb.from('structures').select('*').in('acequia_id', sharedIds).returns<Structure[]>()),
            run(sb.from('photos').select('*').in('assessment_id', assessments.map((a) => a.id)).returns<Photo[]>()),
            // pre-disaster photos, for the before/after view
            run(sb.from('photos').select('*').in('acequia_id', sharedIds).not('structure_id', 'is', null).returns<Photo[]>()),
          ])
        : [[], [], []]
      return { acequias: acequias.filter((a) => sharedIds.includes(a.id)), shares, structures, assessments, photos: [...photos, ...baseline] }
    },

    async adminData() {
      const [profiles, memberships, acequias, events, shares, requests] = await Promise.all([
        run(sb.from('profiles').select('*').order('display_name').returns<Profile[]>()),
        run(sb.from('memberships').select('*').returns<Membership[]>()),
        run(sb.from('acequias').select('*').order('name').returns<Acequia[]>()),
        run(sb.from('events').select('*').order('started_on', { ascending: false }).returns<AwEvent[]>()),
        run(sb.from('event_shares').select('*').returns<EventShare[]>()),
        run(sb.from('access_requests').select('*').order('created_at', { ascending: false }).returns<AccessRequest[]>()),
      ])
      return { profiles, memberships, acequias, events, shares, requests }
    },
    async removeMembership(user_id, acequia_id) {
      await run(sb.from('memberships').delete().match({ user_id, acequia_id }))
    },
    async decideRequest(id, approve, acequia_id) {
      await run(sb.rpc('decide_access_request', { req: id, approve, acequia: acequia_id ?? null }))
    },

    async publicSummary() {
      return (await run(sb.from('public_event_summary').select('*'))) ?? []
    },
  }
}
