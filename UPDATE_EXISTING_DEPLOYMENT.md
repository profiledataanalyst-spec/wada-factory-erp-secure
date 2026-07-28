# Update the Existing wada-factory-erp Deployment

This guide assumes your Supabase project, GitHub repository, Netlify site, and first Super Admin already exist.

## 1. Run the database upgrade

1. Open Supabase.
2. Select `wada-factory-erp`.
3. Open **SQL Editor**.
4. Open this local file:

```text
supabase/002_temporary_password_workflow.sql
```

5. Copy the complete SQL.
6. Paste it into a new Supabase query.
7. Click **Run**.
8. Confirm the query succeeds.

## 2. Replace the project files

Extract this package. Copy its complete contents into your existing local Git folder:

```text
C:\Users\MukeshMIS\Downloads\Factory_ERP_Supabase_Auth_Final
```

Choose **Replace files in the destination** when Windows asks.

## 3. Push the update to GitHub

Open Command Prompt in the Git folder and run:

```cmd
git status
git add .
git commit -m "Replace invitations with temporary passwords"
git push
```

## 4. Wait for Netlify

Open Netlify → `wada-factory-erp` → **Deploys**. Wait until the newest deploy shows **Published**.

No new Netlify environment variables are required. These existing variables remain required:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

`APP_URL` and `INVITE_EXPIRY_HOURS` are no longer used and may be left in place or removed later.

## 5. Test the configuration

Open:

```text
https://wada-factory-erp.netlify.app/api/config
```

Confirm the response contains:

```json
"authenticationMode": "temporary-password"
```

## 6. Create a test Manager

1. Sign in as Super Admin.
2. Open **User Management**.
3. Click **Create User**.
4. Enter name, email, Manager role, and a temporary password.
5. Copy the login details displayed after creation.
6. Sign out.
7. Sign in as the Manager using the temporary password.
8. Confirm the ERP forces a password change before showing the dashboard.

## 7. Test Manager permissions

The Manager should be able to create Executive accounts only. The Manager cannot create or manage Manager or Super Admin accounts.
