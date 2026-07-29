# Netlify Deployment — Profile Solutions ERP Version 9

## Existing wada-factory-erp site

Follow `SHARED_DATA_DEPLOYMENT.md`. Version 9 requires the new Supabase migration before the updated site is used.

## New deployment

1. Create a Supabase project.
2. Run the three SQL files in `supabase/` in numerical order.
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
```

9. Open the ERP and create the first Super Admin.
10. Test one project across two different browser sessions.

Custom SMTP, `APP_URL`, invitation email templates and invite-expiry variables are not required.
