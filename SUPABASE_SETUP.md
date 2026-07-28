# Supabase Authentication Setup

This version uses Supabase Authentication for passwords, invitation emails, password-reset emails and sessions. Supabase PostgreSQL stores the ERP user profile and role.

## 1. Create a Supabase project

Create a new Supabase project and wait until it is ready.

## 2. Create the profiles table

Open **SQL Editor**, create a new query, paste the complete contents of:

```text
supabase/001_auth_profiles.sql
```

Run the query once. It creates:

- `public.profiles`
- Role and status checks
- Row Level Security
- An authenticated read policy
- An automatic `updated_at` trigger

## 3. Copy the API values

Open **Project Settings → API Keys** or the project **Connect** dialog.

Copy:

- Project URL
- Publishable key (`sb_publishable_...`), or the legacy anon key
- Secret key (`sb_secret_...`), or the legacy service-role key

The secret key must only be added to Netlify environment variables. Never put it in `index.html`, GitHub, screenshots, email or chat.

## 4. Configure Auth URLs

Open **Authentication → URL Configuration**.

Set **Site URL** to your Netlify production URL, for example:

```text
https://your-factory-erp.netlify.app
```

Add these Redirect URLs:

```text
https://your-factory-erp.netlify.app/?auth=invite
https://your-factory-erp.netlify.app/?auth=recovery
```

Add your custom domain versions as well when you connect a custom domain.

## 5. Configure email/password authentication

Open **Authentication → Sign In / Providers → Email**.

- Keep email/password authentication enabled.
- Disable public user sign-up. ERP users must be created by the Super Admin invitation workflow.
- Set **Email OTP expiration** to `86400` seconds for 24 hours, or choose a shorter period. This setting also controls invite and recovery link expiry.

## 6. Configure SMTP

For real users, configure your own SMTP provider under:

```text
Authentication → Emails → SMTP Settings
```

Supabase's default email service is intended only for testing. It normally sends only to authorised project-team addresses and has a very low rate limit.

Suitable SMTP providers include Resend, AWS SES, Postmark, SendGrid, Brevo and ZeptoMail.

## 7. Configure email templates

Open **Authentication → Email Templates**.

### Invite user template

Subject:

```text
Welcome to the Factory ERP – Set Your Password
```

Body:

```html
<h2>Welcome to the ERP System</h2>
<p>Your account has been created successfully.</p>
<p>Registered email: <strong>{{ .Email }}</strong></p>
<p>Please click the button below to create your password and activate your account.</p>
<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700;">
    Set Password
  </a>
</p>
<p>This secure link can be used only once and expires according to the Email OTP expiration configured in Supabase.</p>
```

### Reset password template

Subject:

```text
Factory ERP Password Reset
```

Body:

```html
<h2>Reset your Factory ERP password</h2>
<p>A password reset was requested for <strong>{{ .Email }}</strong>.</p>
<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700;">
    Reset Password
  </a>
</p>
<p>If you did not request this change, you can ignore this email.</p>
```

## 8. Netlify environment variables

Add these under **Netlify → Project configuration → Environment variables**:

| Key | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | The publishable key |
| `SUPABASE_SECRET_KEY` | The secret key; mark it as secret |
| `APP_URL` | Your production Netlify URL |
| `INVITE_EXPIRY_HOURS` | `24` |

Legacy alternatives are supported:

- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not configure both new and legacy names unless necessary.

## 9. First Super Admin

After deployment, open the ERP URL. The application checks the `profiles` table.

When it is empty, the one-time **Create First Super Admin** page appears. Enter the first administrator's name, email and a strong password.

After the first profile is created, that setup page is automatically disabled.
