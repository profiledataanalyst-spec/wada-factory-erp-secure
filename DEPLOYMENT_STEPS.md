# Factory ERP Secure Deployment on Netlify

This secure authentication version must be deployed from GitHub or with Netlify CLI because it includes Netlify Functions. Do not use the simple static drag-and-drop method.

## A. Prepare Supabase

Complete every step in `SUPABASE_SETUP.md` first:

1. Create Supabase project.
2. Run `supabase/001_auth_profiles.sql`.
3. Configure Site URL and redirect URLs.
4. Configure SMTP.
5. Configure invite and recovery email templates.

## B. Upload the project to a private GitHub repository

Open Command Prompt inside the extracted project folder and run:

```cmd
git init -b main
git add .
git commit -m "Factory ERP secure Supabase authentication"
git remote add origin https://github.com/YOUR-USERNAME/YOUR-PRIVATE-REPOSITORY.git
git push -u origin main
```

Keep the repository **Private**.

## C. Import the repository into Netlify

1. Open Netlify.
2. Select **Add new project**.
3. Select **Import an existing project**.
4. Choose **GitHub**.
5. Select the private ERP repository.
6. Keep the base directory blank.
7. No build command is required.
8. Publish directory: `.`
9. Functions directory: `netlify/functions`

The included `netlify.toml` supplies these values automatically.

## D. Add Netlify environment variables

Open:

```text
Project configuration → Environment variables
```

Add:

```text
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
APP_URL=https://YOUR-SITE.netlify.app
INVITE_EXPIRY_HOURS=24
```

Mark `SUPABASE_SECRET_KEY` as a secret value. Use all scopes and all deploy contexts.

## E. Deploy

Open **Deploys** and trigger a new production deployment.

A successful log should include function bundling for:

```text
config
auth-admin
```

## F. Create the first Super Admin

Open the deployed website. Complete **Create First Super Admin**.

The first Super Admin can then open **User Management → Invite User** and enter:

- Full Name
- Email Address
- Manager or Executive role

No password is entered by the Super Admin. Supabase sends the email.

## G. Test the complete workflow

1. Invite a test Manager.
2. Open the invitation email.
3. Click **Set Password**.
4. Create a strong password.
5. Sign in as the Manager.
6. Sign out.
7. Select **Forgot Password**.
8. Open the recovery email.
9. Set a new password.
10. Sign in with the new password.

## Updating the ERP later

After changing files:

```cmd
git add .
git commit -m "Update Factory ERP"
git push
```

Netlify deploys the latest commit automatically.
