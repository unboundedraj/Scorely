## Summary
<!-- What does this change and why? -->

## Testing
<!-- How did you verify it? Engine changes need tests in `tests/`. -->

## Checklist
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Database changes only touch `scorely_*` objects, are idempotent, extend `supabase/teardown.sql`, and pass `npm run db:verify`
- [ ] The app still works without Supabase env vars (on-device mode)
