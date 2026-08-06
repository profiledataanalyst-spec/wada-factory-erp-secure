# Factory ERP v11.1.1 — Section Assignment Deployment

This package applies only to the attached Factory ERP. No Procurement ERP files are included or modified.

## Before deployment

Back up the current Supabase project. The migration is backward-compatible: it does not rewrite or delete existing operational records. Existing items without a Section remain available and display as `Not Specified`.

## Existing Factory ERP deployment

1. Open the existing Factory ERP Supabase project.
2. Go to **SQL Editor**.
3. Run `supabase/005_section_task_assignment.sql` once, after confirming migrations 001–004 are already installed.
4. Deploy this complete package to the existing Factory ERP Netlify site.
5. Keep the existing environment variables unchanged:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

6. After deployment, open `/api/config` and confirm `applicationVersion` is `11.1.1`.
7. Sign in as Super Admin or Manager and download the latest bulk-upload workbook from the ERP.

## New Factory ERP deployment

Run these SQL files in order:

```text
supabase/001_auth_profiles.sql
supabase/002_temporary_password_workflow.sql
supabase/003_shared_operational_data.sql
supabase/004_stability_performance.sql
supabase/005_section_task_assignment.sql
```

Then deploy the project to Netlify with:

```text
Base directory: blank
Build command: blank
Publish directory: .
Functions directory: netlify/functions
```

## Required post-deployment verification

1. Upload the included `ERP_Bulk_Upload_Template.xlsx` with valid Section values.
2. Confirm an invalid value such as `Painting` is rejected.
3. Confirm a blank Section from an older workbook is accepted and shown as `Not Specified`. To classify legacy records, use **Assign Section Work** → select one Project → choose **Items with no Section (set Section and assign)**.
4. Assign one Section to an active Executive as Super Admin or Manager.
5. Sign in as that Executive and confirm only assigned production work is visible.
6. Confirm another Executive cannot see or update that task.
7. Check Section Overview counts after assignment, stage updates, and completion.
8. Run Production, Project, Stage, Delay, and Shortage reports and verify Section appears in CSV and Excel exports.

## Local validation commands

```cmd
npm run check
npm run test:stability
npm run test:section
```

## v11.1.1 hotfix note

No new migration is required when upgrading from v11.1. Deploy the complete v11.1.1 package after migration 005 is already installed. The manual Add Item control has been removed; use Excel Import for new production items.
