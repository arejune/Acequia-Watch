// Security tests: every refusal case runs against the real policies in
// schema.sql, inside PGlite (Postgres compiled to WASM). A small stub stands in
// for the parts of Supabase the schema depends on: the anon/authenticated
// roles, auth.uid(), auth.users, and storage. Setup runs as the superuser
// (bypasses RLS); checks run as roles.
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema storage;
grant usage on schema storage to anon, authenticated;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant all on storage.objects to anon, authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
`

async function freshDb() {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)
  await db.exec(readFileSync(join(import.meta.dirname, 'schema.sql'), 'utf8'))
  return db
}

/** Run `sql` as a given user (or anonymously when uid is null), like PostgREST does. */
async function as<T = Record<string, unknown>>(
  db: PGlite,
  uid: string | null,
  sql: string,
  params: unknown[] = [],
) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`)
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? ''])
    return (await tx.query<T>(sql, params)).rows
  })
}

const U = {
  stewardA: '00000000-0000-4000-8000-00000000000a',
  stewardB: '00000000-0000-4000-8000-00000000000b',
  agency: '00000000-0000-4000-8000-0000000000ac',
  admin: '00000000-0000-4000-8000-0000000000ad',
}
const ACQ_A = '10000000-0000-4000-8000-00000000000a'
const ACQ_B = '10000000-0000-4000-8000-00000000000b'
const EVENT = '20000000-0000-4000-8000-000000000001'
const STRUCT_A = '30000000-0000-4000-8000-00000000000a'
const ASSESS_A = '40000000-0000-4000-8000-00000000000a'
const PHOTO_A = '50000000-0000-4000-8000-00000000000a'

const TABLES = ['profiles', 'acequias', 'memberships', 'events', 'structures', 'assessments',
  'photos', 'event_shares', 'packets', 'unit_costs']

let db: PGlite

beforeAll(async () => {
  db = await freshDb()
  await db.exec(`
    insert into auth.users (id, email) values
      ('${U.stewardA}', 'a@demo'), ('${U.stewardB}', 'b@demo'), ('${U.agency}', 'ag@demo'), ('${U.admin}', 'ad@demo');
    update profiles set role = 'agency' where id = '${U.agency}';
    update profiles set role = 'admin' where id = '${U.admin}';
    insert into acequias (id, name, region) values ('${ACQ_A}', 'A', 'North'), ('${ACQ_B}', 'B', 'North');
    insert into memberships values ('${U.stewardA}', '${ACQ_A}'), ('${U.stewardB}', '${ACQ_B}');
    insert into events (id, name, kind, started_on) values ('${EVENT}', 'Test fire', 'fire', '2026-06-01');
    insert into structures (id, acequia_id, type, name, lat, lng) values ('${STRUCT_A}', '${ACQ_A}', 'headgate', 'Head', 35.9, -105.6);
    insert into assessments (id, event_id, acequia_id, structure_id, outcome, severity, cost_low, cost_likely, cost_high, lat, lng, photo_ids, captured_at)
      values ('${ASSESS_A}', '${EVENT}', '${ACQ_A}', '${STRUCT_A}', 'damaged', 3, 100, 200, 300, 35.9, -105.6, '{${PHOTO_A}}', now());
    insert into photos (id, acequia_id, assessment_id, storage_path, width, height, bytes, taken_at)
      values ('${PHOTO_A}', '${ACQ_A}', '${ASSESS_A}', '${ACQ_A}/${EVENT}/${ASSESS_A}/${PHOTO_A}.jpg', 10, 10, 10, now());
    insert into storage.objects (bucket_id, name) values ('photos', '${ACQ_A}/${EVENT}/${ASSESS_A}/${PHOTO_A}.jpg');
  `)
})

const count = async (uid: string | null, table: string) =>
  (await as<{ n: number }>(db, uid, `select count(*)::int as n from ${table}`))[0].n

describe('anonymous visitor', () => {
  it.each(TABLES)('reads nothing from %s', async (t) => {
    expect(await count(null, `public.${t}`)).toBe(0)
  })
  it('cannot read photo files', async () => {
    expect(await count(null, 'storage.objects')).toBe(0)
  })
  it('cannot write', async () => {
    await expect(as(db, null, `insert into acequias (name, region) values ('x', 'y')`)).rejects.toThrow()
  })
})

describe('steward from a different acequia', () => {
  it('cannot read acequia A rows', async () => {
    for (const t of ['structures', 'assessments', 'photos']) expect(await count(U.stewardB, t)).toBe(0)
    expect(await count(U.stewardB, 'storage.objects')).toBe(0)
  })
  it('cannot write into acequia A', async () => {
    await expect(as(db, U.stewardB, `insert into structures (id, acequia_id, type, name, lat, lng)
      values (gen_random_uuid(), '${ACQ_A}', 'culvert', 'x', 35, -105)`)).rejects.toThrow(/row-level security/)
  })
  it('cannot share acequia A', async () => {
    await expect(as(db, U.stewardB, `insert into event_shares (event_id, acequia_id, shared, changed_by)
      values ('${EVENT}', '${ACQ_A}', true, '${U.stewardB}')`)).rejects.toThrow(/row-level security/)
  })
  it('cannot promote itself', async () => {
    await expect(as(db, U.stewardB, `update profiles set role = 'admin' where id = '${U.stewardB}'`)).rejects.toThrow(/permission denied/)
  })
})

describe('steward of acequia A', () => {
  it('reads its own rows', async () => {
    expect(await count(U.stewardA, 'assessments')).toBe(1)
    expect(await count(U.stewardA, 'storage.objects')).toBe(1)
  })
  it('a retry with the same UUID updates instead of duplicating', async () => {
    const upsert = `insert into assessments (id, event_id, acequia_id, structure_id, outcome, captured_at, version)
      values ('${ASSESS_A}', '${EVENT}', '${ACQ_A}', '${STRUCT_A}', 'no_damage', now(), 2)
      on conflict (id) do update set outcome = excluded.outcome, version = excluded.version`
    await as(db, U.stewardA, upsert)
    await as(db, U.stewardA, upsert)
    expect(await count(U.stewardA, 'assessments')).toBe(1)
  })
  it('a stale version is rejected with AW409', async () => {
    await expect(as(db, U.stewardA, `update assessments set version = 1 where id = '${ASSESS_A}'`)).rejects.toMatchObject({ code: 'AW409' })
  })
  it('a second assessment of the same structure and event is refused', async () => {
    await expect(as(db, U.stewardA, `insert into assessments (id, event_id, acequia_id, structure_id, outcome, captured_at)
      values (gen_random_uuid(), '${EVENT}', '${ACQ_A}', '${STRUCT_A}', 'no_damage', now())`)).rejects.toMatchObject({ code: '23505' })
  })
  it('costs out of order are refused', async () => {
    await expect(as(db, U.stewardA, `insert into assessments (id, event_id, acequia_id, unlisted_type, outcome, severity, cost_low, cost_likely, cost_high, lat, lng, photo_ids, captured_at)
      values (gen_random_uuid(), '${EVENT}', '${ACQ_A}', 'culvert', 'damaged', 2, 500, 100, 900, 35.9, -105.6, '{${PHOTO_A}}', now())`)).rejects.toMatchObject({ code: '23514' })
  })
  it('damaged without a photo is refused', async () => {
    await expect(as(db, U.stewardA, `insert into assessments (id, event_id, acequia_id, unlisted_type, outcome, severity, cost_low, cost_likely, cost_high, lat, lng, captured_at)
      values (gen_random_uuid(), '${EVENT}', '${ACQ_A}', 'culvert', 'damaged', 2, 1, 2, 3, 35.9, -105.6, now())`)).rejects.toMatchObject({ code: '23514' })
  })
  it('a silent 0,0 location is refused', async () => {
    await expect(as(db, U.stewardA, `insert into structures (id, acequia_id, type, name, lat, lng)
      values (gen_random_uuid(), '${ACQ_A}', 'culvert', 'x', 0, 0)`)).rejects.toMatchObject({ code: '23514' })
  })
})

describe('agency', () => {
  const setShare = (shared: boolean) => as(db, U.stewardA, `insert into event_shares (event_id, acequia_id, shared, changed_by)
    values ('${EVENT}', '${ACQ_A}', ${shared}, '${U.stewardA}')
    on conflict (event_id, acequia_id) do update set shared = excluded.shared, changed_at = now()`)

  it('unshared event: refused; shared: allowed; unshared again: refused', async () => {
    await setShare(false)
    expect(await count(U.agency, 'assessments')).toBe(0)
    expect(await count(U.agency, 'photos')).toBe(0)
    expect(await count(U.agency, 'storage.objects')).toBe(0)

    await setShare(true)
    expect(await count(U.agency, 'assessments')).toBe(1)
    expect(await count(U.agency, 'photos')).toBe(1)
    expect(await count(U.agency, 'storage.objects')).toBe(1)

    await setShare(false)
    expect(await count(U.agency, 'assessments')).toBe(0)
    expect(await count(U.agency, 'photos')).toBe(0)
    expect(await count(U.agency, 'storage.objects')).toBe(0)
  })
  it('cannot write', async () => {
    await setShare(true)
    await expect(as(db, U.agency, `update assessments set severity = 1 where id = '${ASSESS_A}' returning id`))
      .resolves.toHaveLength(0)
    await expect(as(db, U.agency, `insert into structures (id, acequia_id, type, name, lat, lng)
      values (gen_random_uuid(), '${ACQ_A}', 'culvert', 'x', 35, -105)`)).rejects.toThrow(/row-level security/)
    await expect(as(db, U.agency, `insert into event_shares (event_id, acequia_id, shared, changed_by)
      values ('${EVENT}', '${ACQ_B}', true, '${U.agency}')`)).rejects.toThrow(/row-level security/)
  })
})

describe('public summary view', () => {
  it('hides a region with fewer than 3 reports', async () => {
    expect(await count(null, 'public_event_summary')).toBe(0)
  })
  it('never counts an acequia that has not shared the event', async () => {
    await db.exec(`
      insert into assessments (id, event_id, acequia_id, unlisted_type, outcome, captured_at, description)
      select gen_random_uuid(), '${EVENT}', '${ACQ_B}', 'culvert', 'no_damage', now(), 'private note'
      from generate_series(1, 4);
    `)
    // acequia B has 4+ reports but has not shared: the public sees nothing
    expect(await count(null, 'public_event_summary')).toBe(0)
  })
  it('shows a region only with 3 or more sharing acequias, with no coordinates or text', async () => {
    const C = '10000000-0000-4000-8000-00000000000c'
    const D = '10000000-0000-4000-8000-00000000000d'
    await db.exec(`
      insert into acequias (id, name, region) values ('${C}', 'C', 'North'), ('${D}', 'D', 'North');
      insert into event_shares (event_id, acequia_id, shared, changed_by) values
        ('${EVENT}', '${ACQ_A}', true, '${U.admin}'), ('${EVENT}', '${C}', true, '${U.admin}')
        on conflict (event_id, acequia_id) do update set shared = true;
      insert into assessments (id, event_id, acequia_id, unlisted_type, outcome, captured_at)
        values (gen_random_uuid(), '${EVENT}', '${C}', 'culvert', 'no_damage', now());
    `)
    // two sharing acequias (A and C) are not enough to show the region
    expect(await count(null, 'public_event_summary')).toBe(0)
    await db.exec(`
      insert into event_shares (event_id, acequia_id, shared, changed_by) values ('${EVENT}', '${D}', true, '${U.admin}');
      insert into assessments (id, event_id, acequia_id, unlisted_type, outcome, captured_at)
        values (gen_random_uuid(), '${EVENT}', '${D}', 'culvert', 'no_damage', now());
    `)
    const rows = await as<Record<string, unknown>>(db, null, 'select * from public_event_summary')
    expect(rows).toHaveLength(1)
    expect(rows[0].reports).toBe(3) // A, C and D; B's unshared reports are left out
    expect(Object.keys(rows[0]).sort()).toEqual(
      ['cost_high', 'cost_likely', 'cost_low', 'damaged', 'event_id', 'event_name', 'kind', 'region', 'reports'])
    // tidy up so later tests see the original two acequias only
    await db.exec(`
      delete from assessments where acequia_id in ('${C}', '${D}');
      delete from event_shares where acequia_id in ('${C}', '${D}');
      delete from acequias where id in ('${C}', '${D}');
    `)
  })
})

describe('v2: admin console and before/after photos', () => {
  const BASE_PHOTO = '50000000-0000-4000-8000-0000000000b1'
  beforeAll(async () => {
    await db.exec(`
      insert into photos (id, acequia_id, structure_id, storage_path, width, height, bytes, taken_at)
        values ('${BASE_PHOTO}', '${ACQ_A}', '${STRUCT_A}', '${ACQ_A}/baseline/${STRUCT_A}/${BASE_PHOTO}.jpg', 10, 10, 10, now());
      insert into storage.objects (bucket_id, name) values ('photos', '${ACQ_A}/baseline/${STRUCT_A}/${BASE_PHOTO}.jpg');
    `)
  })
  const basePhotos = (uid: string) => as<{ n: number }>(db, uid, `select count(*)::int as n from photos where structure_id is not null`).then((r) => r[0].n)
  const baseFiles = (uid: string) => as<{ n: number }>(db, uid, `select count(*)::int as n from storage.objects where name like '%/baseline/%'`).then((r) => r[0].n)

  it('agency sees a pre-disaster photo only while its acequia shares an event', async () => {
    await as(db, U.stewardA, `update event_shares set shared = false, changed_by = '${U.stewardA}' where acequia_id = '${ACQ_A}'`)
    expect(await basePhotos(U.agency)).toBe(0)
    expect(await baseFiles(U.agency)).toBe(0)
    await as(db, U.stewardA, `update event_shares set shared = true, changed_by = '${U.stewardA}' where acequia_id = '${ACQ_A}'`)
    expect(await basePhotos(U.agency)).toBe(1)
    expect(await baseFiles(U.agency)).toBe(1)
  })
  it('steward B never sees acequia A pre-disaster photos', async () => {
    expect(await basePhotos(U.stewardB)).toBe(0)
    expect(await baseFiles(U.stewardB)).toBe(0)
  })
  it('only an admin can create events and link stewards', async () => {
    await expect(as(db, U.stewardA, `insert into events (name, kind, started_on) values ('x', 'flood', '2027-01-01')`)).rejects.toThrow(/row-level security/)
    await expect(as(db, U.agency, `insert into memberships values ('${U.stewardB}', '${ACQ_A}')`)).rejects.toThrow(/row-level security/)
    await as(db, U.admin, `insert into events (name, kind, started_on) values ('Admin event', 'flood', '2027-01-01')`)
    await as(db, U.admin, `insert into memberships values ('${U.stewardB}', '${ACQ_A}')`)
    expect(await count(U.stewardB, 'structures')).toBe(1) // now a member of A
    await as(db, U.admin, `delete from memberships where user_id = '${U.stewardB}' and acequia_id = '${ACQ_A}'`)
    expect(await count(U.stewardB, 'structures')).toBe(0)
  })
  it('stewards cannot read other people’s profiles or emails', async () => {
    expect(await count(U.stewardA, 'profiles')).toBe(1)
    expect(await count(U.admin, 'profiles')).toBe(4)
  })
})

describe('v4: creating an account', () => {
  const NEW = '00000000-0000-4000-8000-0000000000ee'
  const OTHER = '00000000-0000-4000-8000-0000000000ef'
  beforeAll(async () => {
    await db.exec(`insert into auth.users (id, email) values ('${NEW}', 'new@demo'), ('${OTHER}', 'other@demo');`)
  })
  const reqs = (uid: string) => as<{ n: number }>(db, uid, `select count(*)::int as n from access_requests`).then((r) => r[0].n)

  it('a new account sees no acequia data until approved', async () => {
    for (const t of ['acequias', 'structures', 'assessments', 'photos']) expect(await count(NEW, t)).toBe(0)
  })
  it('you can file a request only for yourself, and only you and admins can read it', async () => {
    await as(db, NEW, `insert into access_requests (requested_role, acequia_name, acequia_role) values ('steward', 'Acequia A', 'mayordomo')`)
    await expect(as(db, NEW, `insert into access_requests (user_id, requested_role) values ('${OTHER}', 'steward')`)).rejects.toThrow(/row-level security/)
    await expect(as(db, NEW, `insert into access_requests (requested_role, status) values ('agency', 'approved')`)).rejects.toThrow()
    expect(await reqs(NEW)).toBe(1)
    expect(await reqs(OTHER)).toBe(0)
    expect(await reqs(U.stewardA)).toBe(0)
    expect(await reqs(U.admin)).toBe(1)
  })
  it('only an admin can approve, and approval links the steward to the chosen acequia', async () => {
    const [{ id }] = await as<{ id: string }>(db, NEW, `select id from access_requests`)
    await expect(as(db, NEW, `select decide_access_request('${id}', true, '${ACQ_A}')`)).rejects.toThrow(/admins only/)
    await expect(as(db, U.stewardA, `select decide_access_request('${id}', true, '${ACQ_A}')`)).rejects.toThrow(/admins only/)
    await expect(as(db, NEW, `update profiles set role = 'admin' where id = '${NEW}'`)).rejects.toThrow()
    await as(db, U.admin, `select decide_access_request('${id}', true, '${ACQ_A}')`)
    expect(await count(NEW, 'structures')).toBe(1)
    expect(await count(NEW, 'acequias')).toBe(1)
  })
  it('approving an agency request gives the agency role and nothing more', async () => {
    await as(db, OTHER, `insert into access_requests (requested_role, organization) values ('agency', 'County OEM')`)
    const [{ id }] = await as<{ id: string }>(db, OTHER, `select id from access_requests`)
    await as(db, U.admin, `select decide_access_request('${id}', true)`)
    const [{ role }] = await as<{ role: string }>(db, OTHER, `select role from profiles where id = '${OTHER}'`)
    expect(role).toBe('agency')
    expect(await count(OTHER, 'memberships')).toBe(0)
  })
})
