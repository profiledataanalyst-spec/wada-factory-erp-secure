# Production Item Permission Fix — Version 10.1

This update changes only production-item authorization.

## Final permission model

- **Super Admin:** create, edit, delete production items and update production stages.
- **Manager:** create, edit, delete production items and update production stages.
- **Executive:** create production items and update production stages.
- **Executive remains blocked from:** creating projects, user management, bulk Excel upload and system administration.

## Technical changes

1. Removed the outdated server-side error that rejected new production items created by Executives.
2. New Executive-created items are validated for recognised fields, project ID, item name and stage.
3. Existing Executive item edits remain limited to production workflow/stage fields.
4. Managers can delete production items and the linked shortage/issue records removed by that operation.
5. The existing Supabase RLS model remains unchanged: authenticated users read shared data, while writes continue through the protected Netlify Function using server-side role checks.

## Deployment

No Supabase SQL migration or environment-variable change is required.

Copy the patch contents into the existing project root, then run:

```cmd
node scripts\check.mjs
git add .
git commit -m "Fix production item permissions"
git push
```

After Netlify publishes, verify `/api/config` contains:

```json
{
  "applicationVersion": "10.1.0",
  "productionItemPermissions": "admin-manager-full-executive-create-and-stage-update"
}
```
