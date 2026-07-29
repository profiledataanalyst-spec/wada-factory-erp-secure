# Profile Solutions Factory ERP v9

A Profile Solutions-branded manufacturing ERP built with HTML, CSS and JavaScript, deployed on Netlify and secured by Supabase.

## Core architecture

- **Authentication:** Supabase Auth
- **User directory and roles:** `public.profiles`
- **Operational source of truth:** `public.erp_records`
- **Secure writes:** Netlify Function `erp-data.mjs`
- **Live synchronization:** Supabase Realtime Postgres Changes
- **Deployment:** GitHub-connected Netlify site

## Shared operational modules

Projects, Excel imports, production items, production-stage history, shortages, issues, notifications and audit logs are stored centrally in Supabase PostgreSQL and are available across authorized browsers and devices.

LocalStorage is used only for UI preferences and one-time detection of legacy browser data during migration.

## Required Supabase migrations

Run these in order:

1. `supabase/001_auth_profiles.sql`
2. `supabase/002_temporary_password_workflow.sql`
3. `supabase/003_shared_operational_data.sql`

## Required Netlify environment variables

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

See `SHARED_DATA_DEPLOYMENT.md` for the existing-site upgrade procedure.
