# Factory ERP v11.2.0 — Final Section Assignment Deployment

This release applies only to the Factory ERP.

## Root-cause fix

The earlier assignment flow changed production items in browser memory and then used the general state synchronizer. The success message was not based on a database read-back, so a stale or unmatched Section could produce a misleading success notification with zero synchronized items.

Version 11.2.0 removes that dependency. Section assignment now runs through a dedicated Supabase database function that:

1. Reads and locks matching production-item rows directly in the database.
2. Updates every matching row in one transaction.
3. Stores Section, Executive ID/name, assigned-by details, assignment timestamp, due date and priority.
4. Verifies every target row before committing.
5. Rolls back if updated and verified counts differ.
6. Creates the assignment audit entry and Executive notification in the same transaction.
7. Returns the exact updated record IDs and verified count.
8. Forces the assigning browser to reload database data before success is shown.
9. Broadcasts a reload signal to other connected ERP users.

## Required database step

Run this file once in the Factory ERP Supabase SQL Editor:

`supabase/006_verified_section_assignment.sql`

Migrations `001` through `005` must already be installed. Migration `006` adds a protected database function only; it does not delete or rewrite existing production records.

## Netlify deployment

1. Back up the current deployed project.
2. Run migration `006_verified_section_assignment.sql` in Supabase.
3. Deploy the complete v11.2.0 project folder or ZIP to the existing Factory ERP Netlify site.
4. Use **Clear cache and deploy site** so the previous JavaScript bundle containing the old Add Item control is not reused.
5. Open `/api/config` and confirm `applicationVersion` is `11.2.0`.
6. Hard refresh the ERP using `Ctrl + Shift + R`.

The JavaScript and CSS links include a v11.2.0 cache-busting query parameter.

## Verification after deployment

1. Upload a workbook containing valid Section values.
2. Confirm the Production Tracker shows the imported Section.
3. Open **Assign Section Work**.
4. Choose a Section and Executive. The default scope assigns or reassigns every matching item.
5. Confirm the preview count, then assign.
6. A success notification must show a positive database-verified count.
7. Refresh the browser and confirm the assignment remains.
8. Sign in as the assigned Executive and confirm only assigned tasks appear.
9. Confirm Factory Overview, Operations and Reports show the same assignment data.
10. Select a Section with no matching items and confirm a warning is shown instead of success.

## Important behavior

- No **Add Item** button is available in Production or Projects.
- New production items are accepted only through Bulk Upload.
- The server rejects manual creation through the general synchronization endpoint.
- A zero-row database result never produces a success message.
- If database verification fails, the transaction is rolled back.
