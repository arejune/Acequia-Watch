// Seeds the DEMO Supabase project with the same fictional data the local
// backend uses, plus the four demo logins. Uses the service key, which must
// stay on your machine (never in the app or the repo).
//
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-supabase.mjs
//
import { createClient } from '@supabase/supabase-js'
import * as demo from '../src/demo/seed.ts'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY (demo project only).')
const sb = createClient(url, key, { auth: { persistSession: false } })

const must = async (p, what) => {
  const { data, error } = await p
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}

// 1. demo users (email confirmed, password sign-in)
const ids = {}
const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 })
for (const [k, u] of Object.entries(demo.DEMO_USERS)) {
  const existing = list.users.find((x) => x.email === u.email)
  const user = existing ?? (await must(sb.auth.admin.createUser({ email: u.email, password: demo.DEMO_PASSWORD, email_confirm: true, user_metadata: { display_name: u.display_name } }), `create ${u.email}`)).user
  ids[k] = user.id
  await must(sb.from('profiles').upsert({ id: user.id, role: u.role, display_name: u.display_name }), `profile ${u.email}`)
}
console.log('users', ids)

// 2. reference data and the inventory
await must(sb.from('acequias').upsert(demo.acequias), 'acequias')
await must(sb.from('memberships').upsert(demo.membershipsFor(ids)), 'memberships')
await must(sb.from('events').upsert(demo.event), 'event')
await must(sb.from('structures').upsert(demo.structures), 'structures')
await must(sb.from('assessments').upsert(demo.assessments.map((a) => ({ ...a, created_by: ids.steward }))), 'assessments')

// 3. illustrated demo photos into the private bucket, then their rows
for (const p of demo.photos) {
  const a = demo.assessments.find((x) => x.id === p.assessment_id)
  const s = demo.structures.find((x) => x.id === a.structure_id)
  const body = new Blob([demo.demoPhotoSvg(s.name, a.severity ?? 1)], { type: 'image/svg+xml' })
  const { error } = await sb.storage.from('photos').upload(p.storage_path, body, { contentType: 'image/svg+xml', upsert: true })
  if (error) throw new Error(`upload ${p.storage_path}: ${error.message}`)
  await must(sb.from('photos').upsert({ ...p, bytes: body.size }), 'photo row')
}

// pre-disaster photos (structures reference them by id)
for (const p of demo.baselinePhotos) {
  const s = demo.structures.find((x) => x.id === p.structure_id)
  const body = new Blob([demo.demoPhotoSvg(s.name, 1, true)], { type: 'image/svg+xml' })
  const { error } = await sb.storage.from('photos').upload(p.storage_path, body, { contentType: 'image/svg+xml', upsert: true })
  if (error) throw new Error(`upload ${p.storage_path}: ${error.message}`)
  await must(sb.from('photos').upsert({ ...p, bytes: body.size }), 'baseline photo row')
}

// 4. consent: two acequias share the event, the third does not
await must(sb.from('event_shares').upsert(demo.shares(ids.steward)), 'shares')

console.log(`seeded ${demo.acequias.length} acequias, ${demo.structures.length} structures, ${demo.assessments.length} assessments, ${demo.photos.length} photos`)
