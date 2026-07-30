# Profile Solutions Factory ERP

Version 11.0 is the stability and architecture audit release of the shared multi-user ERP.

## Runtime architecture

- Static HTML/CSS/JavaScript frontend
- Supabase Authentication
- Supabase PostgreSQL shared operational records
- Supabase Realtime incremental synchronization
- Netlify Functions for protected role-checked mutations
- Atomic/idempotent mutation RPC installed by migration 004

## Validate

```cmd
npm run audit
```

## Deploy

Follow `STABILITY_DEPLOYMENT.md`. Migration `supabase/004_stability_performance.sql` must be run before the Version 11 frontend is used.

## Security

Never place `SUPABASE_SECRET_KEY` in browser code or commit it to GitHub. It belongs only in protected hosting environment variables.
