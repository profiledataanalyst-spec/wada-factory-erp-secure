# Factory ERP v9 Validation Report

## Passed static validation

- Profile Solutions UI remains present.
- Supabase temporary-password authentication remains present.
- Netlify Functions configuration remains present.
- `erp-data.mjs` validates authenticated sessions and ERP roles.
- `public.erp_records` migration enables RLS and Realtime.
- Browser writes use the protected server-side Function.
- Browser reads use authenticated Supabase access.
- Projects, items, shortages, issues, audit logs and notifications are loaded from Supabase.
- Realtime Postgres changes trigger automatic data reloads.
- LocalStorage persists UI preferences only.
- Legacy business data is migrated once only when the central table is empty.
- Existing UI, reports, filters, imports, production tracker and role screens remain intact.
- Supabase secret keys are not present in browser code.

## Required deployment validation

After running `003_shared_operational_data.sql` and deploying:

1. `/api/config` returns `sharedDataReady: true`.
2. `/.netlify/functions/erp-data` does not return a Netlify 404.
3. A record created in one browser appears in another browser.
4. A stage update appears automatically for another signed-in user.
5. A Super Admin deletion disappears for all signed-in users.
