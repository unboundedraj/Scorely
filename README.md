# Scorely

Live scoring for every game — cricket ball-by-ball, football with a running clock, tennis tiebreaks, a chess clock, badminton, basketball and more. Score from your phone; everyone else follows live through a link, a QR code or a big-screen scoreboard.

Built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4** and **Supabase** (Postgres, Auth, Realtime).

## Sports

| Sport | Engine | Highlights |
| --- | --- | --- |
| 🏏 Cricket | `cricket` | Ball-by-ball, wides/no-balls/byes/leg-byes, every dismissal type, strike rotation, overs & maidens, bowler quotas, full scorecards, fall of wickets, chases & results |
| ⚽ Football | `timed` | Running clock with stoppage time (45+2'), scorers & assists, penalties/own goals, cards, stats, extra time, penalty shootouts |
| 🏀 Basketball | `timed` | 1/2/3-pointers, countdown quarters, team & player fouls, repeated overtime |
| 🏑 Hockey · 🤼 Kabaddi · 🏉 Rugby | `timed` | Sport-specific scoring actions (tries, conversions, raids, all-outs…) |
| 🎾 Tennis | `tennis` | 15/30/40/AD, deuce or no-ad, tiebreaks, 10-point match tiebreak, break/set/match point detection |
| 🏸 Badminton · 🏓 Table tennis · 🏐 Volleyball | `rally` | Rally scoring, win-by-2 with caps, deciding-set targets, automatic serve rotation |
| ♟️ Chess | `chess` | Chess clock with increment (face-to-face mode on phones), automatic flag fall, multi-game matches with alternating colours |
| 🎲 Any game | `tally` | 2–12 players, quick +/- buttons, round-by-round entry, highest/lowest wins, target scores |

Also: undo for everything, offline queueing with automatic retry, TV scoreboard mode, share links + QR codes, WhatsApp-friendly preview cards, saved team rosters, dark mode, screen wake-lock while scoring, installable PWA manifest.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. **The app works before Supabase is connected** — matches are stored in the browser ("on this device") so you can try every sport straight away. Accounts, live sharing, the Live feed and saved teams switch on once Supabase is configured.

## Connecting Supabase

> The Supabase project is **shared with other apps**. Everything Scorely creates is prefixed `scorely_` and nothing else is modified — see [Shared-project safety](#shared-project-safety).

1. **Environment variables** — copy `.env.example` to `.env.local` and fill in values from *Project Settings → API*:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or sb_publishable_… key>
   ```

2. **Create the tables** — pick one:
   - Paste [`supabase/migrations/20260921120000_scorely_init.sql`](supabase/migrations/20260921120000_scorely_init.sql) into the Supabase **SQL editor** and run it, **or**
   - add `SUPABASE_DB_URL` (*Project Settings → Database → Connection string → URI*) to `.env.local` and run `npm run db:push`. `npm run db:check` shows what exists.

   The migration is idempotent, so running it twice is harmless.

3. **Auth redirect URLs** — in *Authentication → URL Configuration → Redirect URLs*, **add** (don't replace anything):

   ```
   http://localhost:3000/auth/confirm
   https://<your-production-domain>/auth/confirm
   ```

   Leave the **Site URL** alone — it belongs to whichever app already uses it. Scorely always passes an explicit `emailRedirectTo`, so it doesn't depend on the Site URL.

4. **Restart** `npm run dev` (public env vars are read at startup/build time).

Email/password sign-up, magic links and password reset all work out of the box. If *Confirm email* is enabled on the project, new users get a confirmation link that lands on `/auth/confirm`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | For accounts & live sharing | Project URL (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For accounts & live sharing | Public API key. The publishable key wins if both are set |
| `NEXT_PUBLIC_SITE_URL` | No | Public URL used for share-card metadata. Defaults to `http://localhost:3000` |
| `SUPABASE_DB_URL` | Only for `db:push` / `db:check` | Postgres connection string. Never expose it to the browser |

`NEXT_PUBLIC_*` values are inlined at build time, so restart `npm run dev` (or rebuild) after changing them. With no Supabase variables the app runs in on-device mode.

## Shared-project safety

The migration was written for a Supabase project that other apps also use:

- **Only `scorely_*` objects** — tables `scorely_profiles`, `scorely_teams`, `scorely_matches`, `scorely_match_events`; functions `scorely_append_event`, `scorely_undo_event`, `scorely_import_match`, `scorely_event_json`, `scorely_generate_code`, `scorely_touch_updated_at`; plus triggers, indexes and policies on those tables.
- **No triggers on `auth.users`.** Profiles are created lazily by the app on first sign-in.
- **No extensions, shared functions or other tables are touched.** The one shared object changed is the `supabase_realtime` publication, which gets `scorely_matches` *added* to it.
- `supabase/teardown.sql` removes every Scorely object (and its data) and nothing else.
- `npm run db:verify` replays the migration against an in-memory Postgres with Supabase stand-ins, and checks RLS, privileges, the RPCs, idempotency and the teardown, including that another app's table survives.

Heads-up: because `auth.users` is shared, a person signing up through Scorely is a user of the whole Supabase project. Any `auth.users` triggers that other apps installed will fire for Scorely sign-ups too.

## How it works

**Event sourcing.** A match is an append-only log of events (`ball`, `goal`, `point`, `press`…). Each sport has a pure *engine* (`src/lib/sports/engines/*`) that replays the log into a scoreboard. Undo removes the last event. The replayed summary is cached on `scorely_matches.summary` for list views.

**Writes** go through `scorely_append_event` / `scorely_undo_event` (SECURITY DEFINER, owner-checked, gap-free `seq`). The client applies changes optimistically and sends them through an ordered queue that retries while offline and reconciles sequence conflicts (`src/lib/store/use-match-sync.ts`).

**Spectators** subscribe to Realtime `UPDATE`s on their match row. Each update carries `last_seq` and `last_event`, so new events append instantly without a refetch. Undos and gaps trigger a resync.

**Security.** RLS: public matches (and their events) are readable by anyone, and everything else is owner-only. Event tables are not directly writable by API roles. Owners may only update presentational match columns.

**On-device mode** uses the same UI and sync hook with a `localStorage` backend (`src/lib/store/local.ts`). A signed-in user can upload an on-device match to their account with "Save to my account".

```
src/
  app/(site)/…            pages with the main navigation (home, live, matches, new, teams, auth)
  app/(focus)/match/[id]  scorer / spectator screen, TV board, OG image
  app/(focus)/local/[id]  on-device matches
  app/auth/confirm        email-link handler
  components/sports/      per-sport scorer + board UIs
  components/match/       match screen shell, share sheet, cards
  lib/sports/engines/     scoring engines (pure, unit-tested)
  lib/sports/registry.ts  sports → engine + default rules
  lib/store/              backends (cloud/local) + sync hook
  proxy.ts                session refresh + route protection (Next 16 "proxy", formerly middleware)
supabase/migrations/      database schema
scripts/                  db:push, db:verify
tests/                    engine tests (vitest)
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Engine unit tests (cricket, timed, rally, tennis, chess, tally) |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm run db:push` | Apply migrations using `SUPABASE_DB_URL` |
| `npm run db:check` | List the Scorely objects present in the database |
| `npm run db:verify` | Verify the migration + security model locally (no network) |

## Adding a sport

1. If an existing engine fits, add an entry to `SPORTS` in `src/lib/sports/registry.ts` with its default rules. For example, handball is a `timed` preset.
2. Otherwise, write an engine in `src/lib/sports/engines/` (`init`, `apply`, `summarize`), register it in `engines/index.ts`, add a scorer and board UI in `src/components/sports/` and register them in `components/sports/index.tsx`, then add its setup form to `components/setup/rules.tsx`.
3. Add tests under `tests/`.

No database change is needed. Sport ids are free-form (`^[a-z_]{2,32}$`), and rules live in `scorely_matches.config`.
