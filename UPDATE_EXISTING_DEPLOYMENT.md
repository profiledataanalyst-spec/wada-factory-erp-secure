# Update Existing wada-factory-erp Deployment to Version 8

This update is for an existing Version 7 temporary-password deployment. No Supabase SQL or environment-variable changes are required.

1. Back up the existing local project folder.
2. Copy the Version 8 files into the existing Git repository and replace matching files.
3. Run:

```cmd
node scripts\check.mjs
git status
git add .
git commit -m "Redesign ERP UI for Profile Solutions"
git push
```

4. Wait for Netlify to show **Published**.
5. Open `https://wada-factory-erp.netlify.app` and press `Ctrl + F5`.
6. Confirm `/api/config` still shows `authenticationMode: temporary-password`.

See `PROFILE_SOLUTIONS_UI_UPDATE.md` for the full validation checklist.
