# Factory ERP v10 Validation Report

## Bulk upload defect findings

1. The deployed UI referenced `excel-file-input`, but the input did not exist in `index.html`. This caused the Excel Import page to fail while binding the Choose File button.
2. The upload displayed success before the asynchronous shared-database synchronization completed.
3. Excel zero values in optional date columns were incorrectly reported as invalid dates.
4. QTY values of `0` were rejected even when a quantity such as `24 NOS` was available in ITEM NAME.
5. Database insertion failures were not mapped back to individual import records.

## Implemented checks

- Official `MASTER SHEET` worksheet is mandatory.
- All 15 official headers are mandatory and duplicate headers are rejected.
- Only XLSX/XLS files are accepted.
- Empty, corrupted, and files larger than 25 MB are rejected.
- Mandatory project, item, stage, and quantity validation is enforced.
- Optional zero date and SIZE values are treated as blank.
- Blank/zero QTY can use a quantity extracted from ITEM NAME, with a warning.
- Duplicate rows in the workbook and duplicate records in the database are rejected.
- Valid records are saved by the authenticated `bulk-import` Netlify Function.
- Server-side import retries failed batches at record level and reports individual failures.
- Client waits for Supabase, reloads the shared dataset, and verifies imported item IDs before showing success.

## Tests completed

- `node --check js/app.js`
- `node --check netlify/functions/erp-data.mjs`
- `node --check netlify/functions/config.mjs`
- `node scripts/check.mjs`
- Server action test: Manager import accepted; Executive import blocked.
- Validation test using the supplied `MASTER SHEET.xlsx`:
  - 113 data rows read
  - 67 rows validated using quantity extraction from ITEM NAME
  - 46 rows correctly rejected because neither QTY nor ITEM NAME contained a usable quantity
  - Excel zero date cells were not treated as invalid dates

No database migration or environment-variable change is required for v10.
