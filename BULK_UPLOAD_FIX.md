# Factory ERP v10 — Bulk Upload Fix

## Fixed

- Restored the missing hidden Excel file input that prevented file selection.
- Requires the official `MASTER SHEET` worksheet and all 15 official headers.
- Accepts XLSX/XLS only and rejects empty, corrupted, oversized, or incorrectly structured files.
- Treats optional Excel zero values in SIZE/date columns as blank instead of invalid dates.
- When QTY is blank or zero, extracts quantities such as `10 NOS` from ITEM NAME and shows a warning.
- Rejects rows when no valid quantity is available.
- Detects duplicate rows inside the workbook and duplicates already present in the shared ERP database.
- Saves valid projects, production items, and imported shortage records through the authenticated Netlify Function.
- Waits for Supabase confirmation before showing success.
- Reloads the shared database after import and verifies every expected production item.
- Returns record-level database failures without blocking unrelated valid records.
- Shows imported, failed, and new-project counts and provides a downloadable failure CSV.

## Deployment

1. Copy the patch contents into the existing project root.
2. Run `node scripts\check.mjs`.
3. Run `git add .`, commit, and push.
4. Wait for Netlify to publish.
5. Open `/api/config` and confirm `applicationVersion` is `10.0.0` and `bulkUploadMode` is `validated-supabase-import`.
6. Refresh the ERP with `Ctrl + F5` and test with `ERP_Bulk_Upload_Template.xlsx`.

No Supabase SQL migration or environment-variable change is required.
