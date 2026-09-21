-- =============================================================================
-- Scorely — teardown
-- =============================================================================
-- Removes every Scorely object from the shared Supabase project and nothing
-- else. ALL SCORELY DATA IS DELETED. Other apps' tables are untouched.
-- =============================================================================

begin;

do $$
begin
  if exists (
       select 1 from pg_catalog.pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'scorely_matches'
     )
  then
    alter publication supabase_realtime drop table public.scorely_matches;
  end if;
end;
$$;

-- Functions that reference the event row type must go before the table.
drop function if exists public.scorely_import_match(jsonb, jsonb);
drop function if exists public.scorely_undo_event(uuid, integer, jsonb, text);
drop function if exists public.scorely_append_event(uuid, integer, text, jsonb, jsonb, text);
drop function if exists public.scorely_event_json(public.scorely_match_events);

drop table if exists public.scorely_match_events;
drop table if exists public.scorely_matches;
drop table if exists public.scorely_teams;
drop table if exists public.scorely_profiles;

-- Used by column defaults / triggers, so dropped after the tables.
drop function if exists public.scorely_generate_code();
drop function if exists public.scorely_touch_updated_at();

commit;
