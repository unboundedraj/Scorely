# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private reporting instead: **Security → Report a vulnerability** on this repository.

Include what you found, steps to reproduce, and the impact you expect. We'll acknowledge the report and keep you updated as it's fixed.

## Scope

Areas of particular interest:

- Row Level Security on `scorely_*` tables and the `scorely_append_event` / `scorely_undo_event` / `scorely_import_match` functions.
- Auth redirect handling (`/auth/confirm`, `safeNext`).
- Anything that exposes private matches or lets a user write another user's data.

## Secrets

Never commit `.env.local` or database connection strings. `SUPABASE_DB_URL` is server/CLI only and must never reach the browser; only the public URL and anon/publishable key belong in `NEXT_PUBLIC_*` variables.

## Supported versions

Only the latest `master` is supported.
