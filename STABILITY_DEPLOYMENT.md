# Version 11 Stability Deployment Guide

## 1. Preserve the current working release

Before changing production:

1. Download a full ERP backup from **Settings & Backup**.
2. Keep the current Git commit number:

```cmd
git rev-parse --short HEAD
```

3. Do not delete the existing Netlify deployment.

## 2. Run the stability migration

Open:

```text
Supabase → SQL Editor → New query
```

Open and copy the full contents of:

```text
supabase/004_stability_performance.sql
```

Paste it into the SQL Editor and click **Run**.

The migration is additive and does not delete existing ERP records.

## 3. Copy the Version 11 patch

Copy the contents of the patch directly into:

```text
C:\Users\MukeshMIS\Downloads\Factory_ERP_Supabase_Auth_Final
```

Choose **Replace the files in the destination**. Do not create a nested patch folder.

## 4. Validate before pushing

From the project folder run:

```cmd
node scripts\check.mjs
npm run test:stability
npm run audit
```

All commands must pass.

## 5. Review the changed files

```cmd
git status
```

Important changes should include:

```text
index.html
js/app.js
netlify.toml
netlify/functions/config.mjs
netlify/functions/auth-admin.mjs
netlify/functions/erp-data.mjs
package.json
scripts/check.mjs
scripts/audit.mjs
scripts/stability-tests.mjs
supabase/004_stability_performance.sql
TECHNICAL_AUDIT_REPORT.md
STABILITY_DEPLOYMENT.md
```

## 6. Push the release

```cmd
git add .
git commit -m "Stabilize ERP authentication database and realtime architecture"
git push
```

Wait for Netlify to show the latest deployment as **Published**.

## 7. Confirm deployment readiness

Open:

```text
https://wada-factory-erp.netlify.app/api/config
```

Expected fields:

```json
{
  "sharedDataReady": true,
  "stabilityMigrationReady": true,
  "applicationVersion": "11.0.0",
  "realtimeMode": "incremental-postgres-changes",
  "productionStageSync": "database-confirmed-atomic-idempotent-realtime",
  "bulkUploadMode": "validated-atomic-supabase-import",
  "architectureMode": "single-source-atomic-resilient"
}
```

A missing `stabilityMigrationReady` field means the new `config.mjs` was not deployed. A value of `false` means migration 004 is not available to PostgREST yet; wait briefly, then refresh, or run `notify pgrst, 'reload schema';` in the SQL Editor.

## 8. Clear only the application cache

Open the ERP and press:

```text
Ctrl + F5
```

Do not clear Supabase users or the database.

## 9. Production verification matrix

Use two browsers or one normal and one Incognito window.

### Authentication

- Restore an existing session after page reload.
- Log in as Super Admin, Manager and Executive.
- Leave a session open long enough to verify token refresh without logout.
- Confirm inactive users remain blocked.

### Consecutive stage updates

- Browser A: Planning → Cutting.
- Browser A: Cutting → Fabrication on the same item.
- Confirm both saves finish and the button is disabled while saving.
- Browser B: confirm the latest stage arrives without manual refresh.
- Confirm Factory Dashboard and Production Tracker show the same stage.

### Concurrent update conflict

- Open the same item in both browsers.
- Save a stage change in Browser A.
- Save an older pending change in Browser B.
- Browser B must show a conflict and load the newest record; it must not overwrite Browser A.

### CRUD

- Create, edit and delete a test project with an authorised role.
- Create and delete a production item.
- Create and resolve a shortage.
- Verify changes in the second browser.

### Bulk upload

- Upload a small valid official template.
- Verify imported and failed counts.
- Confirm imported rows in the second browser.
- Retry only after the first operation finishes.

### Realtime recovery

- Disconnect Browser B from the network.
- Make a change in Browser A.
- Reconnect Browser B.
- Confirm one authoritative refresh brings it current.

## 10. Monitoring during rollout

For the first production day, review:

```text
Netlify → Functions → erp-data / auth-admin logs
Supabase → Logs → Postgres / Auth / Realtime
```

Search using the request ID returned in an ERP error response.

## 11. Rollback

When a critical issue appears:

1. In Netlify, publish the previous successful deployment, or revert the Git commit.
2. Keep migration 004 installed; it is additive and Version 10.2 does not call it.
3. Record the request ID, time, user role and operation before investigating.
