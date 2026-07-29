# Factory ERP v9 — Shared Supabase Data Deployment

This update moves all ERP operational data from browser LocalStorage to the central Supabase PostgreSQL database.

## What is shared

- Projects
- Production items and stage history
- Shortages and issues
- Operational notifications
- Audit logs
- Excel/CSV imports
- Creates, edits and deletes

LocalStorage is now limited to UI preferences such as theme and collapsed-sidebar state.

## Before installing

1. On the browser that contains the latest ERP data, sign in and download a JSON backup from **Settings & Backup**.
2. Keep the backup until cross-device synchronization has been verified.
3. Do not delete the existing Supabase `profiles` table or authentication users.

## Step 1 — Run the database migration

In Supabase:

1. Open **SQL Editor**.
2. Create a new query.
3. Open `supabase/003_shared_operational_data.sql` from this package.
4. Copy the complete SQL into Supabase.
5. Click **Run**.
6. Confirm the query finishes successfully.

The migration creates `public.erp_records`, enables RLS, grants authenticated read access, blocks direct browser writes, and adds the table to Supabase Realtime.

## Step 2 — Copy the project update

Copy the contents of the update patch into the existing project root:

```text
C:\Users\MukeshMIS\Downloads\Factory_ERP_Supabase_Auth_Final
```

Select **Replace the files in the destination**.

The final structure must include:

```text
index.html
netlify.toml
_redirects
js/app.js
netlify/functions/config.mjs
netlify/functions/auth-admin.mjs
netlify/functions/erp-data.mjs
supabase/003_shared_operational_data.sql
```

## Step 3 — Validate locally

Run:

```cmd
node scripts\check.mjs
```

Expected result:

```text
Project check passed: Profile Solutions UI v9, Supabase shared operational data, realtime synchronization, temporary passwords, Netlify Functions, and migrations are present.
```

## Step 4 — Push to GitHub

```cmd
git status
git add .
git commit -m "Move ERP operational data to shared Supabase database"
git push
```

## Step 5 — Confirm Netlify Functions

The existing Netlify environment variables remain required:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

The secret key must remain restricted to Netlify Functions and must never be placed in browser code.

Wait until the latest Netlify deployment is **Published**.

## Step 6 — Test configuration

Open:

```text
https://wada-factory-erp.netlify.app/api/config
```

Expected fields:

```json
{
  "authenticationMode": "temporary-password",
  "dataStorage": "supabase-postgresql",
  "realtimeMode": "postgres-changes",
  "sharedDataReady": true
}
```

Also verify:

```text
https://wada-factory-erp.netlify.app/.netlify/functions/erp-data
```

Opening the data Function directly in a browser should return **Method not allowed**, not a Netlify 404. That confirms the Function was deployed.

## Step 7 — Migrate existing browser data

When `erp_records` is empty, sign in first using the browser that contains the latest operational data.

- A Super Admin or Manager can perform the automatic one-time migration.
- The app detects the old LocalStorage dataset.
- It writes those records into Supabase.
- It reloads the shared database.
- It removes the old business records from LocalStorage.

If there is no old browser data, the shared database starts empty and new data will be written directly to Supabase.

## Step 8 — Cross-device test

1. Sign in as Manager in Browser A.
2. Create a small test project or import one test row.
3. Sign in as Super Admin in Browser B or an Incognito window.
4. Confirm the project appears automatically.
5. Update its production stage in Browser B.
6. Confirm Browser A receives the update without manual refresh.
7. Delete the test record as Super Admin and confirm it disappears in both browsers.

## Permissions preserved

- Super Admin: full operational CRUD.
- Manager: create and update projects, production items, shortages and issues; existing UI deletion restrictions remain.
- Executive: permitted production-stage, shortage and issue updates only.
- User creation and password management remain in `auth-admin.mjs`.

All operational writes are verified by `erp-data.mjs` using the signed-in user's Supabase session and profile role. The browser publishable key is used only for authentication, shared reads and Realtime subscriptions.
