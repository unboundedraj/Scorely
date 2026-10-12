# Contributing to Scorely

Thanks for helping out! This guide covers setup and the conventions that keep the codebase (and the shared Supabase project) healthy.

## Getting started

```bash
npm install
npm run dev
```

The app works without any environment variables — matches are stored on-device. To try accounts and live sharing, copy `.env.example` to `.env.local` and follow [Connecting Supabase](README.md#connecting-supabase).

## Before you open a pull request

Run all four checks; CI runs the same ones:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Project rules

- **Scoring engines are pure.** Engines in `src/lib/sports/engines/` must be deterministic: no `Date.now()`, no randomness. Timestamps arrive inside event payloads. Cover engine changes with tests in `tests/`.
- **Event writes go through the RPCs.** Use `scorely_append_event` / `scorely_undo_event` via `useMatchSync`; never write `scorely_match_events` directly.
- **Work without Supabase.** The app must keep working in on-device mode. Guard server access with `getServerSupabase()` / `isSupabaseConfigured`.
- **The Supabase project is shared with other apps.** Every database object must be prefixed `scorely_`. Never alter other tables, `auth.users`, shared functions or extensions. Add schema changes as new idempotent files in `supabase/migrations/`, extend `supabase/teardown.sql`, and run `npm run db:verify`.

## Pull requests

- Keep PRs small and focused; one concern per PR.
- Use clear, imperative commit messages (`fix: ...`, `feat: ...`, `docs: ...`, `test: ...`).
- Describe what changed and why, and mention how you tested it.
- Adding a sport? See [Adding a sport](README.md#adding-a-sport).

## Reporting bugs and ideas

Open an issue with steps to reproduce (sport, rules, and the sequence of events), what you expected, and what happened.
