// Runs the Scorely migration against an in-memory Postgres (PGlite) with the
// bits of Supabase it relies on stubbed out, then checks the security model:
// RLS, column privileges, the event RPCs, idempotency and the teardown script.
//
//   npm run db:verify
//
// Nothing here talks to your real Supabase project.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = new PGlite();
let failures = 0;

function ok(name) {
  console.log(`  ✓ ${name}`);
}
function fail(name, detail) {
  failures += 1;
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}
function check(condition, name, failDetail) {
  if (condition) ok(name);
  else fail(name, failDetail);
}
async function expectOk(name, fn) {
  try {
    const r = await fn();
    ok(name);
    return r;
  } catch (err) {
    fail(name, err.message);
  }
}
async function expectError(name, pattern, fn) {
  try {
    await fn();
    fail(name, "expected an error");
  } catch (err) {
    if (pattern.test(`${err.code ?? ""} ${err.message}`)) ok(name);
    else fail(name, `unexpected error: ${err.code ?? ""} ${err.message}`);
  }
}

/** Run as a Supabase API role, optionally as a signed-in user. */
async function as(role, userId, fn) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";

// --- Supabase stand-ins -------------------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  create publication supabase_realtime;
  -- Another app sharing the project (must survive untouched).
  create table public.other_app_profiles (id uuid primary key, note text);
  insert into public.other_app_profiles values ('33333333-3333-3333-3333-333333333333', 'keep me');
  insert into auth.users (id, email) values ('${U1}', 'one@example.com'), ('${U2}', 'two@example.com');
`);

const migrationsDir = path.join(root, "supabase", "migrations");
const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

console.log("Migration");
for (const file of files) {
  const sql = await readFile(path.join(migrationsDir, file), "utf8");
  await expectOk(`applies ${file}`, () => db.exec(sql));
  await expectOk(`re-applies ${file} (idempotent)`, () => db.exec(sql));
}

const { rows: pub } = await db.query(
  "select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1",
);
check(pub.map((r) => r.tablename).join(",") === "scorely_matches", "realtime publication contains only scorely_matches", JSON.stringify(pub));

const { rows: foreign } = await db.query(
  "select table_name from information_schema.tables where table_schema='public' and table_name not like 'scorely\\_%'",
);
check(foreign.length === 1 && foreign[0].table_name === "other_app_profiles", "no non-scorely tables were created", JSON.stringify(foreign));

console.log("Matches & RLS");
const matchId = await as("authenticated", U1, async () => {
  const { rows } = await db.query(
    `insert into public.scorely_matches (sport, title, participants, config)
     values ('cricket', 'Test', '[{"id":"a","name":"A"}]', '{"overs":2}') returning id, code, owner_id, last_seq`,
  );
  const m = rows[0];
  check(/^[2-9A-HJ-NP-Z]{7}$/.test(m.code), `share code generated (${m.code})`, m.code);
  check(m.owner_id === U1, "owner_id defaults to auth.uid()", m.owner_id);
  return m.id;
});

await expectError("cannot create a match for someone else", /row-level security|42501/, () =>
  as("authenticated", U1, () => db.query(`insert into public.scorely_matches (sport, owner_id) values ('chess', '${U2}')`)),
);
await expectError("anon cannot create matches", /permission denied|row-level security|42501/, () =>
  as("anon", null, () => db.query(`insert into public.scorely_matches (sport) values ('chess')`)),
);

console.log("Event RPCs");
const append = (user, seq, extra = "") =>
  as("authenticated", user, () =>
    db.query(`select * from public.scorely_append_event('${matchId}', ${seq}, 'ball', '{"runs":4}'::jsonb${extra})`),
  );
await expectOk("owner appends event 1", () => append(U1, 1, `, '{"status":"x"}'::jsonb, 'live'`));
await expectError("duplicate seq is a PT409 conflict", /PT409|Sequence conflict/, () => append(U1, 1));
await expectError("gap in seq is a PT409 conflict", /PT409|Sequence conflict/, () => append(U1, 5));
await expectOk("owner appends event 2", () => append(U1, 2));
await expectError("another user cannot append (PT404)", /PT404|not found/i, () => append(U2, 3));
await expectError("anon cannot call append", /permission denied/, () =>
  as("anon", null, () => db.query(`select public.scorely_append_event('${matchId}', 3, 'ball')`)),
);

const { rows: afterAppend } = await db.query(`select last_seq, last_event->>'seq' as ev_seq, status, summary from public.scorely_matches where id = '${matchId}'`);
check(afterAppend[0].last_seq === 2 && afterAppend[0].ev_seq === "2", "last_seq / last_event track the log", JSON.stringify(afterAppend[0]));

await expectError("direct insert into events is blocked", /permission denied/, () =>
  as("authenticated", U1, () => db.query(`insert into public.scorely_match_events (match_id, seq, type) values ('${matchId}', 3, 'x')`)),
);
await expectError("owner cannot tamper with last_seq directly", /permission denied/, () =>
  as("authenticated", U1, () => db.query(`update public.scorely_matches set last_seq = 99 where id = '${matchId}'`)),
);
await expectOk("owner can edit title / visibility", () =>
  as("authenticated", U1, () => db.query(`update public.scorely_matches set title = 'Renamed', is_public = true where id = '${matchId}'`)),
);

await expectError("undo must target the last event", /PT409|Sequence conflict/, () =>
  as("authenticated", U1, () => db.query(`select public.scorely_undo_event('${matchId}', 1)`)),
);
const undone = await expectOk("owner undoes event 2", () =>
  as("authenticated", U1, () => db.query(`select public.scorely_undo_event('${matchId}', 2, null, 'live') as last`)),
);
check(undone?.rows?.[0]?.last === 1, "undo returns the new last_seq", JSON.stringify(undone?.rows));

console.log("Spectators");
const anonMatches = await as("anon", null, () => db.query(`select id from public.scorely_matches`));
check(anonMatches.rows.length === 1, "anon can read public matches", JSON.stringify(anonMatches.rows));
const anonEvents = await as("anon", null, () => db.query(`select seq from public.scorely_match_events`));
check(anonEvents.rows.length === 1, "anon can read events of public matches", JSON.stringify(anonEvents.rows));
await as("authenticated", U1, () => db.query(`update public.scorely_matches set is_public = false where id = '${matchId}'`));
const hidden = await as("anon", null, () => db.query(`select id from public.scorely_matches`));
const hiddenEvents = await as("authenticated", U2, () => db.query(`select seq from public.scorely_match_events`));
check(hidden.rows.length === 0 && hiddenEvents.rows.length === 0, "private matches and their events are hidden from others", JSON.stringify({ hidden: hidden.rows, hiddenEvents: hiddenEvents.rows }));
const own = await as("authenticated", U1, () => db.query(`select id from public.scorely_matches`));
check(own.rows.length === 1, "owner still sees a private match", undefined);

console.log("Teams & profiles");
await expectOk("user saves a team", () =>
  as("authenticated", U1, () => db.query(`insert into public.scorely_teams (name, players) values ('Strikers', '[{"id":"p1","name":"Rohit"}]')`)),
);
const otherTeams = await as("authenticated", U2, () => db.query(`select id from public.scorely_teams`));
check(otherTeams.rows.length === 0, "teams are private to their owner", undefined);
await expectOk("user creates own profile", () =>
  as("authenticated", U1, () => db.query(`insert into public.scorely_profiles (id, display_name) values ('${U1}', 'One')`)),
);
await expectError("cannot create a profile for someone else", /row-level security|42501/, () =>
  as("authenticated", U1, () => db.query(`insert into public.scorely_profiles (id, display_name) values ('${U2}', 'Two')`)),
);

console.log("Import & delete");
const imported = await expectOk("imports an on-device match with its log", () =>
  as("authenticated", U2, () =>
    db.query(
      `select public.scorely_import_match(
         '{"sport":"tennis","title":"Imported","participants":[],"config":{}}'::jsonb,
         '[{"seq":1,"type":"point","payload":{"team":0}},{"seq":2,"type":"point","payload":{"team":1}}]'::jsonb
       ) as id`,
    ),
  ),
);
const importedId = imported?.rows?.[0]?.id;
if (importedId) {
  const { rows } = await db.query(`select owner_id, last_seq from public.scorely_matches where id = '${importedId}'`);
  check(rows[0]?.owner_id === U2 && rows[0]?.last_seq === 2, "imported match is owned by the caller with last_seq 2", JSON.stringify(rows));
}
await expectOk("owner deletes a match (events cascade)", () =>
  as("authenticated", U1, () => db.query(`delete from public.scorely_matches where id = '${matchId}'`)),
);
const { rows: orphan } = await db.query(`select count(*)::int as n from public.scorely_match_events where match_id = '${matchId}'`);
check(orphan[0].n === 0, "no orphaned events", JSON.stringify(orphan));

console.log("Teardown");
await expectOk("teardown.sql runs", async () => db.exec(await readFile(path.join(root, "supabase", "teardown.sql"), "utf8")));
const { rows: left } = await db.query(
  "select table_name from information_schema.tables where table_schema='public' order by 1",
);
check(left.map((r) => r.table_name).join(",") === "other_app_profiles", "teardown removes only scorely objects", JSON.stringify(left));
const { rows: kept } = await db.query("select note from public.other_app_profiles");
check(kept[0]?.note === "keep me", "other app's data is untouched", undefined);

await db.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
