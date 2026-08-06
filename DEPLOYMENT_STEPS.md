# Netlify Deployment — Profile Solutions Factory ERP v11.1

## Existing Factory ERP site

Follow `SECTION_FEATURE_DEPLOYMENT.md`. The Section release requires `supabase/005_section_task_assignment.sql` before the updated frontend is used.

## New deployment

1. Create a Supabase project.
2. Run all SQL files in `supabase/` in numerical order, including migration 005.
3. Create a private GitHub repository and upload this package.
4. Import the repository into Netlify.
5. Use:

```text
Production branch: main
Base directory: blank
Build command: blank
Publish directory: .
Functions directory: netlify/functions
```

6. Add Netlify environment variables:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

Mark `SUPABASE_SECRET_KEY` as secret and ensure its scope includes Functions.

7. Deploy.
8. Open `/api/config` and confirm:

```text
authenticationMode: temporary-password
dataStorage: supabase-postgresql
realtimeMode: postgres-changes
sharedDataReady: true
applicationVersion: 11.1.0
```

9. Open the ERP and create the first Super Admin.
10. Complete the post-deployment checks in `SECTION_FEATURE_DEPLOYMENT.md`.

Custom SMTP, `APP_URL`, invitation email templates, and invite-expiry variables are not required.
