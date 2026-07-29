# Profile Solutions UI Update — Version 8

This release is a visual redesign only. It does not change the ERP business logic, authentication workflow, Supabase database, roles, permissions, APIs, imports, production stages, reports, shortage workflow or operational data storage.

## Files changed by the redesign

- `index.html`
- `css/styles.css`
- `js/app.js`
- `assets/favicon.svg`
- `assets/profile-solutions-logo.svg`
- `package.json`
- `scripts/check.mjs`
- `README.md`
- `VALIDATION_REPORT.md`
- `EMAIL_TEMPLATES_PROFILE_SOLUTIONS.html`

## Existing deployment update

1. Back up your current local project folder.
2. Extract the Version 8 patch.
3. Copy the contents of the extracted patch folder into your existing repository folder.
4. Select **Replace the files in the destination** when Windows asks.
5. Open Command Prompt in the project folder and run:

```cmd
node scripts\check.mjs
git status
git add .
git commit -m "Redesign ERP UI for Profile Solutions"
git push
```

6. Open Netlify and wait for the newest deployment to show **Published**.
7. Open the ERP and press `Ctrl + F5`.

## No configuration changes required

Do not rerun the Supabase SQL scripts. Do not change the Supabase keys, Netlify environment variables, functions directory, publish directory or production branch.

## Functional verification after deployment

- Existing Super Admin can sign in.
- User Management can create Manager and Executive users.
- Temporary password and forced password change still work.
- Role-based sidebar permissions remain correct.
- Excel import, projects, production stages, shortages, reports, audit log and backup continue to operate.
- `/api/config` still reports `authenticationMode: temporary-password`.
