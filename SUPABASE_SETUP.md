# Supabase Setup — Authentication and Shared Factory ERP Data

## Existing Factory ERP Supabase project

For a Version 11 database that already has migrations 001–004, run only:

```text
supabase/005_section_task_assignment.sql
```

Migration 005 adds backward-compatible Section and task-assignment validation, performance indexes, and Executive row-level read restrictions. It does not rewrite or delete existing data. Items without Section remain valid.

Do not rerun or delete the existing `profiles` or `erp_records` tables.

## Fresh Supabase project

Run these files in order:

```text
supabase/001_auth_profiles.sql
supabase/002_temporary_password_workflow.sql
supabase/003_shared_operational_data.sql
supabase/004_stability_performance.sql
supabase/005_section_task_assignment.sql
```

## Authentication provider settings

Open:

```text
Authentication → Sign In / Providers → Email
```

Keep email/password authentication enabled. Public sign-up can remain disabled because users are created through the protected Netlify Function.

## Netlify variables

Netlify requires:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

The secret key must remain only in Netlify Functions and must never appear in `index.html`, `js/app.js`, or GitHub source.
