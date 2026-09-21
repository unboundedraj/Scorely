// Applies supabase/migrations/*.sql to the database in SUPABASE_DB_URL.
//
//   npm run db:push            apply all migrations (they are idempotent)
//   npm run db:push -- --check only report which Scorely objects exist
//
// Only touches objects named scorely_* (see the migration header). Reads
// SUPABASE_DB_URL from .env.local / .env.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });
dotenv.config({ path: path.join(root, ".env"), quiet: true });

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error(
    "SUPABASE_DB_URL is not set.\n" +
      "Add it to .env.local (Supabase → Project Settings → Database → Connection string → URI),\n" +
      "or paste supabase/migrations/*.sql into the Supabase SQL editor instead.",
  );
  process.exit(1);
}

const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
const checkOnly = process.argv.includes("--check");

async function report() {
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name like 'scorely\\_%'
    order by table_name`;
  const fns = await sql`
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'scorely\\_%'
    order by p.proname`;
  const realtime = await sql`
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scorely_matches'`;
  console.log(`Tables:    ${tables.map((t) => t.table_name).join(", ") || "(none)"}`);
  console.log(`Functions: ${fns.map((f) => f.proname).join(", ") || "(none)"}`);
  console.log(`Realtime:  ${realtime.length ? "scorely_matches is published" : "not enabled"}`);
}

try {
  if (!checkOnly) {
    const dir = path.join(root, "supabase", "migrations");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      process.stdout.write(`Applying ${file} … `);
      await sql.unsafe(await readFile(path.join(dir, file), "utf8"));
      console.log("done");
    }
  }
  await report();
} catch (err) {
  console.error(`\nFailed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
