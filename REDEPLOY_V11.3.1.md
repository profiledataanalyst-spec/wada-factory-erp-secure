# Deploy Section Assignment Release v11.3.1

## 1. Back up the current ERP

Use **Settings & Backup → Download Full Backup** and keep the current deployed version available until testing is complete.

## 2. Run the corrected Supabase migration

In Supabase:

1. Open **SQL Editor → New query**.
2. Open `supabase/005_section_assignment_erp_records.sql`.
3. Copy the complete SQL and click **Run**.
4. Confirm **Success. No rows returned**.

This migration uses `public.erp_records` and does not require `public.project_line_items`.

Verify it with:

```sql
select public.section_assignment_status();
```

The returned JSON should contain `"ready": true`.

## 3. Copy the patch

Copy the patch contents directly into the existing repository root:

```text
C:\Users\MukeshMIS\Downloads\Factory_ERP_Supabase_Auth_Final
```

Choose **Replace the files in the destination**. Do not create a nested patch folder.

## 4. Validate

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
git commit -m "Add erp_records Section assignment integration"
git push
```

Wait for Netlify to show **Published**.

## 6. Verify configuration

Open:

```text
https://wada-factory-erp.netlify.app/api/config
```

Expected fields:

```json
{
  "applicationVersion": "11.3.1",
  "sectionAssignmentReady": true,
  "sectionAssignmentMode": "erp-records-section-to-executive-single-source",
  "sectionStorage": "erp_records"
}
```

## 7. Production verification

1. Download the new template.
2. Upload one row for each approved Section.
3. Confirm Section appears in Projects, Production Tracker and reports.
4. Assign Section work as Super Admin or Manager.
5. Log in as different Executives in separate browsers.
6. Confirm each Executive sees only items assigned to their account.
7. Update a production stage and confirm Factory Overview, Production Tracker and reports remain synchronized.
8. Export a report and confirm the Section column is present.

The package is locally validated. The live Supabase migration and multi-browser role test must be completed in your environment.
