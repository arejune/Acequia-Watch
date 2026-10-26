-- Acequia Watch schema for Supabase. Run this one file in the SQL editor of a
-- new project. Row-level security is on for every table; a table with RLS and
-- no matching policy returns nothing. Tested in supabase/rls.test.ts.

-- ---------------------------------------------------------------- tables

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'steward' check (role in ('steward', 'agency', 'admin')),
  display_name text not null default '' check (char_length(display_name) <= 80),
  email text -- so admins can see who signed up
);

create table public.acequias (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null,
  ose_ref text,
  blurb text not null default ''
);

create table public.memberships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  acequia_id uuid not null references public.acequias (id) on delete cascade,
  primary key (user_id, acequia_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('fire', 'flood', 'drought', 'other')),
  started_on date not null,
  threshold_usd numeric check (threshold_usd is null or threshold_usd >= 0)
);

-- The pre-disaster inventory. Device-made UUIDs; soft delete via retired_at.
create table public.structures (
  id uuid primary key,
  acequia_id uuid not null references public.acequias (id),
  type text not null check (type in ('presa', 'headgate', 'culvert', 'flume', 'sand_trap', 'ditch_segment', 'other')),
  name text not null check (char_length(name) between 1 and 120),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m double precision check (accuracy_m >= 0),
  notes text not null default '' check (char_length(notes) <= 500),
  baseline_photo_id uuid,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version >= 1),
  -- never a silent 0,0
  check (not (lat = 0 and lng = 0))
);

-- One structure, one event, one outcome.
create table public.assessments (
  id uuid primary key,
  event_id uuid not null references public.events (id),
  acequia_id uuid not null references public.acequias (id),
  structure_id uuid references public.structures (id),
  unlisted_type text check (unlisted_type in ('presa', 'headgate', 'culvert', 'flume', 'sand_trap', 'ditch_segment', 'other')),
  unlisted_name text check (char_length(unlisted_name) <= 120),
  outcome text not null check (outcome in ('damaged', 'no_damage', 'not_accessible')),
  severity smallint check (severity between 1 and 4),
  description text not null default '' check (char_length(description) <= 500),
  agency_notes text not null default '' check (char_length(agency_notes) <= 500),
  cost_low numeric check (cost_low >= 0),
  cost_likely numeric check (cost_likely >= 0),
  cost_high numeric check (cost_high >= 0),
  volunteer_hours numeric check (volunteer_hours >= 0),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  accuracy_m double precision check (accuracy_m >= 0),
  location_source text check (location_source in ('gps', 'manual', 'structure')),
  photo_ids uuid[] not null default '{}' check (cardinality(photo_ids) <= 10),
  captured_at timestamptz not null,
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version >= 1),
  created_by uuid references public.profiles (id) default auth.uid(),
  unique (event_id, structure_id),
  check (structure_id is not null or unlisted_type is not null),
  check (not (lat = 0 and lng = 0)),
  check ((lat is null) = (lng is null)),
  -- costs ordered low <= likely <= high
  check (cost_low <= cost_likely and cost_likely <= cost_high),
  -- damaged rows need severity, costs, a place, and at least one declared photo
  check (outcome <> 'damaged' or (
    severity is not null and cost_low is not null and cost_likely is not null
    and cost_high is not null and cardinality(photo_ids) >= 1 and lat is not null
  ))
);

create table public.photos (
  id uuid primary key,
  acequia_id uuid not null references public.acequias (id),
  assessment_id uuid references public.assessments (id),
  structure_id uuid references public.structures (id),
  storage_path text not null unique,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  bytes integer not null check (bytes > 0),
  taken_at timestamptz not null,
  check ((assessment_id is null) <> (structure_id is null))
);

-- Consent: an acequia's reports reach agencies only while shared = true.
create table public.event_shares (
  event_id uuid not null references public.events (id),
  acequia_id uuid not null references public.acequias (id),
  shared boolean not null,
  changed_by uuid not null references public.profiles (id) default auth.uid(),
  changed_at timestamptz not null default now(),
  primary key (event_id, acequia_id)
);

create table public.packets (
  id uuid primary key,
  event_id uuid not null references public.events (id),
  acequia_id uuid not null references public.acequias (id),
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles (id) default auth.uid(),
  totals jsonb not null
);

create table public.unit_costs (
  id uuid primary key default gen_random_uuid(),
  acequia_id uuid references public.acequias (id),
  item text not null,
  unit text not null,
  low numeric not null,
  likely numeric not null,
  high numeric not null,
  check (low <= likely and likely <= high)
);

create index on public.assessments (event_id, acequia_id);
create index on public.structures (acequia_id);
create index on public.photos (assessment_id);

-- ------------------------------------------------------- invariants

-- The server accepts a write only if its version is at least the stored one.
-- Raises SQLSTATE 'AW409' so the client can show "A newer version exists".
create function public.reject_stale_version() returns trigger
language plpgsql as $$
begin
  if new.version < old.version then
    raise exception 'stale version % < %', new.version, old.version using errcode = 'AW409';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger assessments_version before update on public.assessments
  for each row execute function public.reject_stale_version();
create trigger structures_version before update on public.structures
  for each row execute function public.reject_stale_version();

-- An assessment can never move to another acequia or event after creation.
create function public.freeze_assessment_keys() returns trigger
language plpgsql as $$
begin
  if new.acequia_id <> old.acequia_id or new.event_id <> old.event_id
     or new.structure_id is distinct from old.structure_id then
    raise exception 'assessment keys are immutable' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger assessments_keys before update on public.assessments
  for each row execute function public.freeze_assessment_keys();

-- The structure must belong to the same acequia as the assessment.
create function public.check_assessment_structure() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.structure_id is not null and not exists (
    select 1 from structures s where s.id = new.structure_id and s.acequia_id = new.acequia_id
  ) then
    raise exception 'structure belongs to another acequia' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger assessments_structure before insert on public.assessments
  for each row execute function public.check_assessment_structure();

-- New sign-ups become stewards with no acequias; an admin grants memberships.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), new.email);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------- access helpers
-- security definer so policies can consult these tables without recursion.

create function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false)
$$;

create function public.is_member(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m join profiles p on p.id = m.user_id
    where m.user_id = auth.uid() and m.acequia_id = a and p.role = 'steward'
  )
$$;

create function public.is_agency() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'agency' from profiles where id = auth.uid()), false)
$$;

create function public.is_shared(e uuid, a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from event_shares s where s.event_id = e and s.acequia_id = a and s.shared)
$$;

create function public.acequia_has_share(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from event_shares s where s.acequia_id = a and s.shared)
$$;

-- ------------------------------------------------------------ RLS

alter table public.profiles enable row level security;
alter table public.acequias enable row level security;
alter table public.memberships enable row level security;
alter table public.events enable row level security;
alter table public.structures enable row level security;
alter table public.assessments enable row level security;
alter table public.photos enable row level security;
alter table public.event_shares enable row level security;
alter table public.packets enable row level security;
alter table public.unit_costs enable row level security;

-- profiles: read your own; admins read all. Users may edit only display_name.
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- acequias: members, agencies (only acequias that shared something), admins.
create policy acequias_read on public.acequias for select to authenticated
  using (public.is_member(id) or (public.is_agency() and public.acequia_has_share(id)) or public.is_admin());
create policy acequias_admin on public.acequias for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy memberships_read on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy memberships_admin on public.memberships for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- events: any signed-in role can see the list of events (names only).
create policy events_read on public.events for select to authenticated using (true);
create policy events_admin on public.events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- structures: stewards read/write their acequias; agencies read the baseline
-- of acequias that shared an event (needed for coverage and gaps).
create policy structures_read on public.structures for select to authenticated
  using (public.is_member(acequia_id) or (public.is_agency() and public.acequia_has_share(acequia_id)) or public.is_admin());
create policy structures_insert on public.structures for insert to authenticated
  with check (public.is_member(acequia_id) or public.is_admin());
create policy structures_update on public.structures for update to authenticated
  using (public.is_member(acequia_id) or public.is_admin())
  with check (public.is_member(acequia_id) or public.is_admin());

-- assessments: agencies only for shared acequia-event pairs. No deletes.
create policy assessments_read on public.assessments for select to authenticated
  using (public.is_member(acequia_id) or (public.is_agency() and public.is_shared(event_id, acequia_id)) or public.is_admin());
create policy assessments_insert on public.assessments for insert to authenticated
  with check (public.is_member(acequia_id) or public.is_admin());
create policy assessments_update on public.assessments for update to authenticated
  using (public.is_member(acequia_id) or public.is_admin())
  with check (public.is_member(acequia_id) or public.is_admin());

-- Agencies may also see a structure's pre-disaster photo once its acequia has
-- shared an event, to compare before and after.
create policy photos_read on public.photos for select to authenticated
  using (
    public.is_member(acequia_id) or public.is_admin() or (
      public.is_agency() and (
        exists (
          select 1 from public.assessments a
          where a.id = photos.assessment_id and public.is_shared(a.event_id, a.acequia_id)
        )
        or (photos.structure_id is not null and public.acequia_has_share(photos.acequia_id))
      )
    )
  );
create policy photos_insert on public.photos for insert to authenticated
  with check (public.is_member(acequia_id) or public.is_admin());

-- sharing: stewards flip the switch for their own acequias; agencies can see
-- which pairs are shared so the dashboard can list them.
create policy shares_read on public.event_shares for select to authenticated
  using (public.is_member(acequia_id) or public.is_agency() or public.is_admin());
create policy shares_insert on public.event_shares for insert to authenticated
  with check ((public.is_member(acequia_id) or public.is_admin()) and changed_by = auth.uid());
create policy shares_update on public.event_shares for update to authenticated
  using (public.is_member(acequia_id) or public.is_admin())
  with check ((public.is_member(acequia_id) or public.is_admin()) and changed_by = auth.uid());

create policy packets_read on public.packets for select to authenticated
  using (public.is_member(acequia_id) or public.is_admin());
create policy packets_insert on public.packets for insert to authenticated
  with check (public.is_member(acequia_id) or public.is_admin());

create policy unit_costs_read on public.unit_costs for select to authenticated
  using (acequia_id is null or public.is_member(acequia_id) or public.is_admin());
create policy unit_costs_write on public.unit_costs for all to authenticated
  using (public.is_member(acequia_id) or public.is_admin())
  with check (public.is_member(acequia_id) or public.is_admin());

-- -------------------------------------------------- public summary
-- The only thing anonymous visitors can read. Counts and cost ranges per event
-- and region, counting only acequias that shared the event, and only for a
-- region with 3+ sharing acequias and 3+ reports, so no single acequia can be
-- picked out. No coordinates, names, or free text. Runs as owner, so it reads
-- past RLS by design.

create view public.public_event_summary with (security_invoker = false) as
select e.id as event_id, e.name as event_name, e.kind, q.region,
       count(*)::int as reports,
       count(*) filter (where a.outcome = 'damaged')::int as damaged,
       coalesce(sum(a.cost_low) filter (where a.outcome = 'damaged'), 0) as cost_low,
       coalesce(sum(a.cost_likely) filter (where a.outcome = 'damaged'), 0) as cost_likely,
       coalesce(sum(a.cost_high) filter (where a.outcome = 'damaged'), 0) as cost_high
from public.assessments a
join public.events e on e.id = a.event_id
join public.acequias q on q.id = a.acequia_id
join public.event_shares s on s.event_id = a.event_id and s.acequia_id = a.acequia_id and s.shared
group by e.id, e.name, e.kind, q.region
having count(*) >= 3 and count(distinct a.acequia_id) >= 3;

revoke all on public.public_event_summary from public;
grant select on public.public_event_summary to anon, authenticated;

-- --------------------------------------------------------- storage
-- Private bucket. Paths are acequia_id/event_id/owner_id/photo_id.jpg
-- (baseline photos use 'baseline' for event_id).

insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
  on conflict (id) do nothing;

create policy photos_bucket_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (public.is_member(((storage.foldername(name))[1])::uuid) or public.is_admin())
  );

create policy photos_bucket_read on storage.objects for select to authenticated
  using (
    bucket_id = 'photos' and (
      public.is_member(((storage.foldername(name))[1])::uuid) or public.is_admin() or (
        public.is_agency() and (
          ((storage.foldername(name))[2] = 'baseline' and public.acequia_has_share(((storage.foldername(name))[1])::uuid))
          or ((storage.foldername(name))[2] <> 'baseline'
              and public.is_shared(((storage.foldername(name))[2])::uuid, ((storage.foldername(name))[1])::uuid))
        )
      )
    )
  );

-- ------------------------------------------------ account requests
-- Creating an account. Anyone can sign up, but a new account sees nothing
-- until an admin approves its request: a steward is linked to an acequia, an
-- agency reviewer gets the agency role. Approval runs through one function so
-- nobody (not even an admin's browser) needs update rights on profiles.role.

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  requested_role text not null check (requested_role in ('steward', 'agency')),
  acequia_name text check (char_length(acequia_name) <= 200),
  acequia_role text check (acequia_role in ('commissioner', 'mayordomo', 'parciante', 'other') or acequia_role is null),
  organization text check (char_length(organization) <= 200),
  note text check (char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id)
);
create unique index access_requests_one_pending on public.access_requests (user_id) where status = 'pending';

alter table public.access_requests enable row level security;

-- you can file a request for yourself, and see your own; admins see all
create policy access_requests_insert on public.access_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and decided_by is null);
create policy access_requests_read on public.access_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
grant select, insert on public.access_requests to authenticated;

create function public.decide_access_request(req uuid, approve boolean, acequia uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare r access_requests;
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  select * into r from access_requests where id = req and status = 'pending' for update;
  if not found then
    raise exception 'no pending request %', req using errcode = 'P0002';
  end if;
  if approve then
    if r.requested_role = 'agency' then
      update profiles set role = 'agency' where id = r.user_id and role = 'steward';
    else
      if acequia is null then
        raise exception 'pick the acequia to link this steward to' using errcode = '22023';
      end if;
      insert into memberships (user_id, acequia_id) values (r.user_id, acequia) on conflict do nothing;
    end if;
  end if;
  update access_requests set status = case when approve then 'approved' else 'declined' end,
    decided_at = now(), decided_by = auth.uid() where id = req;
end $$;

revoke all on function public.decide_access_request(uuid, boolean, uuid) from public;
grant execute on function public.decide_access_request(uuid, boolean, uuid) to authenticated;
