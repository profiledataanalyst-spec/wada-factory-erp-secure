# Profile Solutions Factory ERP

Version 11.2.0 is the final database-verified Section-assignment release of the shared multi-user Factory ERP.

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

Follow `SECTION_FEATURE_DEPLOYMENT.md`. Migrations 001–006 must be installed before the v11.2.0 frontend is used. Migration 006 adds the atomic, verified Section assignment database function and does not alter existing records.

## Security

Never place `SUPABASE_SECRET_KEY` in browser code or commit it to GitHub. It belongs only in protected hosting environment variables.
