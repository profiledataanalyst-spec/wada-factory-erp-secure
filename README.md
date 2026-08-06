# Profile Solutions Factory ERP

Version 11.1 adds Section-based production assignment to the existing stable Factory ERP without redesigning or replacing its existing workflows.

## Section release scope

- Bulk upload and manual production items support `Section`.
- Allowed values: `Aluminium`, `Store`, `Fabrication`, `Outsource`.
- Super Admins and Managers can assign individual items or matching Section batches to active Executives.
- Executives see and update only production items assigned to their account.
- Factory Dashboard includes a live Section Overview.
- Section is available in Production Tracker, Operations, project details, shortages, reports, Excel/CSV exports, search, and filters.
- Existing records and old upload files without Section remain supported as `Not Specified`.

## Runtime architecture

- Static HTML/CSS/JavaScript frontend
- Supabase Authentication
- Supabase PostgreSQL shared operational records
- Supabase Realtime incremental synchronization
- Netlify Functions for protected role-checked mutations
- Atomic/idempotent mutation RPC installed by migration 004
- Section validation, assignment indexes, and Executive row visibility installed by migration 005

## Validate

```cmd
npm run check
npm run test:stability
npm run test:section
```

## Deploy

Follow `SECTION_FEATURE_DEPLOYMENT.md`. Run migrations through `supabase/005_section_task_assignment.sql` before using the Version 11.1 frontend.

## Security

Never place `SUPABASE_SECRET_KEY` in browser code or commit it to GitHub. It belongs only in protected hosting environment variables.
