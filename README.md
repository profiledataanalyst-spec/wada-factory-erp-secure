# Profile Solutions Factory ERP

Version 11.1.1 is the Section-assignment hotfix release of the shared multi-user Factory ERP.

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

Follow `SECTION_FEATURE_DEPLOYMENT.md`. Migrations 001–005 must be installed before the v11.1.1 frontend is used. Existing v11.1 deployments do not require another SQL migration for this hotfix.

## Security

Never place `SUPABASE_SECRET_KEY` in browser code or commit it to GitHub. It belongs only in protected hosting environment variables.
