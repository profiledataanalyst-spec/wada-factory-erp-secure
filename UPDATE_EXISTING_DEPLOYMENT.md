# Update Existing wada-factory-erp Deployment to Version 9

Version 9 preserves the Profile Solutions UI, authentication, temporary passwords, roles and ERP workflows while moving operational data to shared Supabase PostgreSQL storage.

1. Download a backup from the browser containing the latest operational data.
2. Run `supabase/003_shared_operational_data.sql` in Supabase SQL Editor.
3. Copy the Version 9 patch contents into the existing Git repository root.
4. Run:

```cmd
node scripts\check.mjs
git status
git add .
git commit -m "Move ERP operational data to shared Supabase database"
git push
```

5. Wait for Netlify to show **Published**.
6. Confirm `/api/config` shows `sharedDataReady: true`.
7. On the browser containing the latest existing ERP data, sign in first as Super Admin or Manager. The app will migrate that legacy browser dataset only when the central table is empty.
8. Test create, update and delete actions from two browser sessions.

See `SHARED_DATA_DEPLOYMENT.md` for the full checklist.
