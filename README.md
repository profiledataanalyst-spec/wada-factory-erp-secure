# Profile Solutions Factory ERP v11.3.1

This release preserves the existing ERP UI, authentication, roles, production stages, dashboards and workflows while adding the approved **Section Assignment & Dashboard Integration**.

## Approved Sections

- Aluminium
- Store
- Fabrication
- Outsource

## Architecture

- Static HTML/CSS/JavaScript frontend
- Supabase Authentication
- Supabase PostgreSQL and Realtime
- Protected Netlify Functions
- `public.erp_records` is the single source of truth for operational data
- Atomic and idempotent mutations through migration 004
- Section assignment through `supabase/005_section_assignment_erp_records.sql`

This release does **not** require a `project_line_items` table.

## Included Section integration

- Required `SECTION` column in Excel/CSV bulk upload
- Strict allowed-value validation
- Section in Projects Add Items and Production Tracker
- Super Admin/Manager assignment by Project + Section
- Assigned-only Executive work dashboard
- Factory Overview Section Summary
- Section search, filters, reports and exports
- Database-confirmed saves and existing Realtime synchronization

## Validation

```cmd
node scripts\check.mjs
node scripts\stability-tests.mjs
node scripts\project-line-items-tests.mjs
node scripts\project-items-sync-tests.mjs
node scripts\section-assignment-tests.mjs
npm run audit
```

## Deployment

Follow `REDEPLOY_V11.3.1.md`.

## Security

Keep `SUPABASE_SECRET_KEY` only in protected hosting-function environment variables. Never place it in browser code or a public repository.
