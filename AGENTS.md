<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Scorely project rules

- **The Supabase project is shared with other apps.** Every database object must be prefixed `scorely_` (tables, functions, triggers, indexes, policies). Never alter other tables, `auth.users`, shared functions or extensions. Add schema changes as new idempotent files in `supabase/migrations/` and extend `supabase/teardown.sql`. Run `npm run db:verify` after any SQL change.
- Scoring is event-sourced: engines in `src/lib/sports/engines/` are pure and deterministic (no `Date.now()`; timestamps arrive in event payloads). Cover engine changes with tests in `tests/` (`npm test`).
- Event writes go only through `scorely_append_event` / `scorely_undo_event` via `useMatchSync`; do not write `scorely_match_events` directly.
- The app must keep working without Supabase env vars (on-device mode). Guard server access with `getServerSupabase()` / `isSupabaseConfigured`.
- Before finishing: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
