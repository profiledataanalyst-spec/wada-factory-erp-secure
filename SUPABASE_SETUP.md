# Supabase Setup — Authentication and Shared ERP Data

## Existing Supabase project

Run this new migration once in **Supabase → SQL Editor**:

```text
supabase/003_shared_operational_data.sql
```

It creates the shared `public.erp_records` table, applies Row Level Security, enables authenticated reads, blocks direct browser writes, and adds the table to Supabase Realtime.

Do not rerun or delete the existing `profiles` table.

## Fresh Supabase project

Run these files in order:

```text
supabase/001_auth_profiles.sql
supabase/002_temporary_password_workflow.sql
supabase/003_shared_operational_data.sql
```

The first migration creates user profiles and ERP roles. The second enables temporary passwords and forced first-login password changes. The third enables shared operational data and realtime synchronization.

## Authentication provider settings

Open:

```text
Authentication → Sign In / Providers → Email
```

Keep email/password authentication enabled. Public sign-up can remain disabled because users are created through the protected Netlify Function.

## SMTP

Custom SMTP is not required. The application uses administrator-created temporary passwords and does not depend on invitation emails.

## Netlify variables

Netlify requires:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

The secret key must remain only in Netlify Functions and must never appear in `index.html`, `js/app.js`, or GitHub source.
