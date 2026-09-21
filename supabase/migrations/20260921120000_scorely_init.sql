-- =============================================================================
-- Scorely — initial schema
-- =============================================================================
--
-- This Supabase project is SHARED with other apps, so this script is careful to
-- only ever create or modify objects that belong to Scorely:
--
--   * every table, function, trigger, index and policy is prefixed `scorely_`;
--   * nothing is attached to `auth.users` (other apps already hang triggers off
--     it) — Scorely profiles are created lazily by the app instead;
--   * no extensions, shared functions or other apps' tables are touched;
--   * the only shared object modified is the `supabase_realtime` publication,
--     and only to ADD `public.scorely_matches` to it.
--
-- The script is idempotent: running it again is safe.
--
-- Model
-- -----
-- A match is event-sourced. `scorely_match_events` holds an append-only log of
-- scoring events (a ball bowled, a goal, a point won…). The app replays that log
-- through a sport-specific engine to derive the scoreboard, which makes "undo"
-- a matter of deleting the last event. `scorely_matches.summary` is a cached
-- snapshot of the derived scoreboard used by list views, and `last_seq` /
-- `last_event` let spectators follow along through Realtime.
--
-- Events are written ONLY through the `scorely_append_event`,
-- `scorely_undo_event` and `scorely_import_match` functions, which check
-- ownership and keep the sequence gap-free.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.scorely_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Short, unambiguous share codes (no 0/O, 1/I/L). 31^7 ≈ 27 billion values.
create or replace function public.scorely_generate_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code text := '';
begin
  for i in 1..7 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;
  return v_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists public.scorely_profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '' check (char_length(display_name) <= 60),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.scorely_profiles is
  'Scorely: public display name per user. Created lazily by the app (no auth.users trigger).';

create table if not exists public.scorely_teams (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  short_name  text not null default '' check (char_length(short_name) <= 5),
  color       text not null default '#10b981' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sport       text check (sport is null or sport ~ '^[a-z_]{2,32}$'),
  players     jsonb not null default '[]'::jsonb check (jsonb_typeof(players) = 'array'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.scorely_teams is
  'Scorely: reusable team rosters. players = [{ id, name }].';

create table if not exists public.scorely_matches (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code          text not null default public.scorely_generate_code(),
  sport         text not null check (sport ~ '^[a-z_]{2,32}$'),
  title         text not null default '' check (char_length(title) <= 120),
  venue         text not null default '' check (char_length(venue) <= 120),
  status        text not null default 'live'
                check (status in ('scheduled', 'live', 'completed', 'abandoned')),
  is_public     boolean not null default true,
  participants  jsonb not null default '[]'::jsonb check (jsonb_typeof(participants) = 'array'),
  config        jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  summary       jsonb,
  last_seq      integer not null default 0 check (last_seq >= 0),
  last_event    jsonb,
  scheduled_at  timestamptz,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint scorely_matches_code_key unique (code)
);

comment on table public.scorely_matches is
  'Scorely: one row per match. Scoreboard state is derived from scorely_match_events.';

create table if not exists public.scorely_match_events (
  id          bigint generated always as identity primary key,
  match_id    uuid not null references public.scorely_matches (id) on delete cascade,
  seq         integer not null check (seq > 0),
  type        text not null check (type ~ '^[a-z_]{1,40}$'),
  payload     jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint scorely_match_events_match_seq_key unique (match_id, seq)
);

comment on table public.scorely_match_events is
  'Scorely: append-only scoring log per match. Written only via scorely_* functions.';

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index if not exists scorely_teams_owner_idx
  on public.scorely_teams (owner_id, updated_at desc);

create index if not exists scorely_matches_owner_idx
  on public.scorely_matches (owner_id, updated_at desc);

create index if not exists scorely_matches_public_feed_idx
  on public.scorely_matches (status, updated_at desc)
  where is_public;

-- (match_id, seq) is already indexed by scorely_match_events_match_seq_key.

-- -----------------------------------------------------------------------------
-- updated_at triggers (on Scorely tables only)
-- -----------------------------------------------------------------------------

drop trigger if exists scorely_profiles_touch on public.scorely_profiles;
create trigger scorely_profiles_touch
  before update on public.scorely_profiles
  for each row execute function public.scorely_touch_updated_at();

drop trigger if exists scorely_teams_touch on public.scorely_teams;
create trigger scorely_teams_touch
  before update on public.scorely_teams
  for each row execute function public.scorely_touch_updated_at();

drop trigger if exists scorely_matches_touch on public.scorely_matches;
create trigger scorely_matches_touch
  before update on public.scorely_matches
  for each row execute function public.scorely_touch_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.scorely_profiles     enable row level security;
alter table public.scorely_teams        enable row level security;
alter table public.scorely_matches      enable row level security;
alter table public.scorely_match_events enable row level security;

-- Profiles: display names are public (shown as "Scored by …"); only the owner writes.
drop policy if exists scorely_profiles_select on public.scorely_profiles;
create policy scorely_profiles_select on public.scorely_profiles
  for select to anon, authenticated
  using (true);

drop policy if exists scorely_profiles_insert on public.scorely_profiles;
create policy scorely_profiles_insert on public.scorely_profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists scorely_profiles_update on public.scorely_profiles;
create policy scorely_profiles_update on public.scorely_profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists scorely_profiles_delete on public.scorely_profiles;
create policy scorely_profiles_delete on public.scorely_profiles
  for delete to authenticated
  using (id = (select auth.uid()));

-- Teams: private to their owner.
drop policy if exists scorely_teams_select on public.scorely_teams;
create policy scorely_teams_select on public.scorely_teams
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists scorely_teams_insert on public.scorely_teams;
create policy scorely_teams_insert on public.scorely_teams
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists scorely_teams_update on public.scorely_teams;
create policy scorely_teams_update on public.scorely_teams
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists scorely_teams_delete on public.scorely_teams;
create policy scorely_teams_delete on public.scorely_teams
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Matches: public matches are readable by anyone (spectators); owner does the rest.
drop policy if exists scorely_matches_select on public.scorely_matches;
create policy scorely_matches_select on public.scorely_matches
  for select to anon, authenticated
  using (is_public or owner_id = (select auth.uid()));

drop policy if exists scorely_matches_insert on public.scorely_matches;
create policy scorely_matches_insert on public.scorely_matches
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and last_seq = 0 and last_event is null);

drop policy if exists scorely_matches_update on public.scorely_matches;
create policy scorely_matches_update on public.scorely_matches
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists scorely_matches_delete on public.scorely_matches;
create policy scorely_matches_delete on public.scorely_matches
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Events: readable wherever the parent match is readable. No write policies —
-- writes go through the SECURITY DEFINER functions below.
drop policy if exists scorely_match_events_select on public.scorely_match_events;
create policy scorely_match_events_select on public.scorely_match_events
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.scorely_matches m
      where m.id = scorely_match_events.match_id
        and (m.is_public or m.owner_id = (select auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- Table privileges (defence in depth on top of RLS)
-- -----------------------------------------------------------------------------

revoke truncate, references, trigger on
  public.scorely_profiles, public.scorely_teams,
  public.scorely_matches, public.scorely_match_events
  from anon, authenticated;

revoke insert, update, delete on
  public.scorely_profiles, public.scorely_teams,
  public.scorely_matches, public.scorely_match_events
  from anon;

-- The event log is only writable through functions.
revoke insert, update, delete on public.scorely_match_events from authenticated;

-- Owners may edit match details, but the sync bookkeeping columns
-- (owner_id, code, last_seq, last_event, …) are managed by the functions.
revoke update on public.scorely_matches from authenticated;
grant update (title, venue, status, is_public, participants, config, summary,
              scheduled_at, completed_at)
  on public.scorely_matches to authenticated;

-- -----------------------------------------------------------------------------
-- Event functions
-- -----------------------------------------------------------------------------
-- Errors use PostgREST's `PTxxx` convention so the HTTP status is meaningful:
--   PT401 not signed in · PT404 match not found / not yours · PT409 sequence conflict
--   PT400 invalid input

create or replace function public.scorely_event_json(e public.scorely_match_events)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id,
    'seq', e.seq,
    'type', e.type,
    'payload', e.payload,
    'created_at', e.created_at
  );
$$;

create or replace function public.scorely_append_event(
  p_match_id uuid,
  p_seq      integer,
  p_type     text,
  p_payload  jsonb default '{}'::jsonb,
  p_summary  jsonb default null,
  p_status   text  default null
)
returns public.scorely_match_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_match  public.scorely_matches%rowtype;
  v_event  public.scorely_match_events%rowtype;
  v_status text;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = 'PT401';
  end if;

  if p_status is not null and p_status not in ('scheduled', 'live', 'completed', 'abandoned') then
    raise exception 'Invalid status %', p_status using errcode = 'PT400';
  end if;

  select * into v_match
  from public.scorely_matches
  where id = p_match_id
  for update;

  if not found or v_match.owner_id <> v_uid then
    raise exception 'Match not found' using errcode = 'PT404';
  end if;

  if p_seq is distinct from v_match.last_seq + 1 then
    raise exception 'Sequence conflict: expected %, got %', v_match.last_seq + 1, p_seq
      using errcode = 'PT409';
  end if;

  insert into public.scorely_match_events (match_id, seq, type, payload, created_by)
  values (p_match_id, p_seq, p_type, coalesce(p_payload, '{}'::jsonb), v_uid)
  returning * into v_event;

  v_status := coalesce(p_status, v_match.status);

  update public.scorely_matches
  set last_seq     = v_event.seq,
      last_event   = public.scorely_event_json(v_event),
      summary      = coalesce(p_summary, summary),
      status       = v_status,
      started_at   = coalesce(started_at, now()),
      completed_at = case
                       when v_status in ('completed', 'abandoned') then coalesce(completed_at, now())
                       else null
                     end
  where id = p_match_id;

  return v_event;
end;
$$;

create or replace function public.scorely_undo_event(
  p_match_id uuid,
  p_seq      integer,
  p_summary  jsonb default null,
  p_status   text  default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_match  public.scorely_matches%rowtype;
  v_prev   public.scorely_match_events%rowtype;
  v_status text;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = 'PT401';
  end if;

  if p_status is not null and p_status not in ('scheduled', 'live', 'completed', 'abandoned') then
    raise exception 'Invalid status %', p_status using errcode = 'PT400';
  end if;

  select * into v_match
  from public.scorely_matches
  where id = p_match_id
  for update;

  if not found or v_match.owner_id <> v_uid then
    raise exception 'Match not found' using errcode = 'PT404';
  end if;

  if p_seq < 1 or p_seq is distinct from v_match.last_seq then
    raise exception 'Sequence conflict: can only undo event %', v_match.last_seq
      using errcode = 'PT409';
  end if;

  delete from public.scorely_match_events
  where match_id = p_match_id and seq = p_seq;

  select * into v_prev
  from public.scorely_match_events
  where match_id = p_match_id
  order by seq desc
  limit 1;

  v_status := coalesce(p_status, v_match.status);

  update public.scorely_matches
  set last_seq     = coalesce(v_prev.seq, 0),
      last_event   = case when v_prev.id is null then null else public.scorely_event_json(v_prev) end,
      summary      = coalesce(p_summary, summary),
      status       = v_status,
      completed_at = case
                       when v_status in ('completed', 'abandoned') then completed_at
                       else null
                     end
  where id = p_match_id;

  return coalesce(v_prev.seq, 0);
end;
$$;

-- Uploads a match that was scored offline / on-device into the caller's account.
create or replace function public.scorely_import_match(
  p_match  jsonb,
  p_events jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_id     uuid;
  v_count  integer;
  v_last   public.scorely_match_events%rowtype;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = 'PT401';
  end if;

  if jsonb_typeof(coalesce(p_events, '[]'::jsonb)) <> 'array' then
    raise exception 'Events must be an array' using errcode = 'PT400';
  end if;

  v_count := jsonb_array_length(coalesce(p_events, '[]'::jsonb));
  if v_count > 10000 then
    raise exception 'Too many events (% > 10000)', v_count using errcode = 'PT400';
  end if;

  insert into public.scorely_matches (
    owner_id, sport, title, venue, status, is_public,
    participants, config, summary, scheduled_at, started_at, completed_at
  )
  values (
    v_uid,
    p_match ->> 'sport',
    coalesce(p_match ->> 'title', ''),
    coalesce(p_match ->> 'venue', ''),
    coalesce(p_match ->> 'status', 'live'),
    coalesce((p_match ->> 'is_public')::boolean, true),
    coalesce(p_match -> 'participants', '[]'::jsonb),
    coalesce(p_match -> 'config', '{}'::jsonb),
    p_match -> 'summary',
    (p_match ->> 'scheduled_at')::timestamptz,
    (p_match ->> 'started_at')::timestamptz,
    (p_match ->> 'completed_at')::timestamptz
  )
  returning id into v_id;

  -- Re-number from 1 so the imported log is gap-free regardless of input.
  insert into public.scorely_match_events (match_id, seq, type, payload, created_by, created_at)
  select
    v_id,
    row_number() over (order by (e ->> 'seq')::integer, ord)::integer,
    e ->> 'type',
    coalesce(e -> 'payload', '{}'::jsonb),
    v_uid,
    coalesce((e ->> 'created_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) with ordinality as t(e, ord);

  select * into v_last
  from public.scorely_match_events
  where match_id = v_id
  order by seq desc
  limit 1;

  update public.scorely_matches
  set last_seq   = coalesce(v_last.seq, 0),
      last_event = case when v_last.id is null then null else public.scorely_event_json(v_last) end
  where id = v_id;

  return v_id;
end;
$$;

revoke all on function public.scorely_append_event(uuid, integer, text, jsonb, jsonb, text) from public, anon;
revoke all on function public.scorely_undo_event(uuid, integer, jsonb, text) from public, anon;
revoke all on function public.scorely_import_match(jsonb, jsonb) from public, anon;

grant execute on function public.scorely_append_event(uuid, integer, text, jsonb, jsonb, text) to authenticated;
grant execute on function public.scorely_undo_event(uuid, integer, jsonb, text) to authenticated;
grant execute on function public.scorely_import_match(jsonb, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: spectators subscribe to UPDATEs on their match row.
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (
       select 1 from pg_catalog.pg_publication
       where pubname = 'supabase_realtime' and not puballtables
     )
     and not exists (
       select 1 from pg_catalog.pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'scorely_matches'
     )
  then
    alter publication supabase_realtime add table public.scorely_matches;
  end if;
end;
$$;

commit;
