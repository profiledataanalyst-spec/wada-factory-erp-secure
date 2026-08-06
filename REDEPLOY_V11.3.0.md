# Deploy Section Assignment Release v11.3.0

## 1. Back up

From the current ERP, use **Settings & Backup → Download Full Backup**. Keep the current Netlify deployment live until the release is tested.

## 2. Run the required SQL migration

In Supabase:

1. Open **SQL Editor → New query**.
2. Open `supabase/011_section_assignment_dashboard.sql` from this package.
3. Copy the complete SQL and click **Run**.
4. Confirm there are no SQL errors.

The migration is additive. It does not delete projects, production items, users, shortages or history.

## 3. Copy the patch into the existing project

Copy the patch contents directly into the existing repository root. Do not create a nested patch folder.

Expected new or updated paths include:

```text
ERP_Bulk_Upload_Template.xlsx
MASTER_SHEET_TEMPLATE.csv
js/app.js
netlify/functions/config.mjs
netlify/functions/erp-data.mjs
netlify/functions/project-line-items.mjs
supabase/011_section_assignment_dashboard.sql
scripts/section-assignment-tests.mjs
```

## 4. Validate

Run:

```cmd
node scripts\check.mjs
node scripts\stability-tests.mjs
node scripts\project-line-items-tests.mjs
node scripts\project-items-sync-tests.mjs
node scripts\section-assignment-tests.mjs
npm run audit
```

All commands must pass.

## 5. Commit and deploy

```cmd
git status
git add .
git commit -m "Add section assignment and dashboard integration"
git push
```

Wait for the latest Netlify deployment to show **Published**.

## 6. Verify configuration

Open:

```text
https://wada-factory-erp.netlify.app/api/config
```

Expected fields:

```json
{
  "applicationVersion": "11.3.0",
  "sectionAssignmentReady": true,
  "sectionAssignmentMode": "bulk-section-to-executive-single-source"
}
```

When `sectionAssignmentReady` is false, rerun migration 011 and redeploy/refresh the configuration endpoint.

## 7. Production test

1. Download the new template.
2. Upload four test rows, one per Section.
3. Confirm Section appears in Production Tracker and project details.
4. Use **Assign Section Work** as Super Admin/Manager.
5. Log in as each Executive in separate browsers.
6. Confirm each Executive sees only assigned items.
7. Update a stage and confirm Section Summary, Production Tracker and reports remain synchronized.
8. Export a report and confirm the Section column is present.

The package was statically and locally validated. The live Supabase migration and multi-browser test must be completed in your environment.
