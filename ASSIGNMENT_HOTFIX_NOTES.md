# Factory ERP v11.1.1 — Section Assignment Hotfix

This hotfix applies only to the Factory ERP package.

## Fixed

- Prevented the misleading `0 production item(s) synchronized` result by calculating the matching production items before saving.
- Added a live assignment preview showing how many records will be updated.
- Added a recovery scope for older production items that do not yet contain a Section:
  - Select a Project.
  - Select the required Section.
  - Choose `Items with no Section (set Section and assign)`.
  - Select the Executive and save.
- The recovery scope requires one Project to be selected so unrelated legacy items cannot be classified accidentally.
- The success notification now reports the verified number of production items updated.
- Removed the manual `Add Item` control from Production Tracker. New production items continue to enter the ERP through the existing Excel Import workflow.
- Existing item editing, production stages, permissions, reports, dashboards, and database structure remain unchanged.

## Database

No additional SQL migration is required for this hotfix. Migration `supabase/005_section_task_assignment.sql` from v11.1 must already be installed.

## Validation

```text
npm run check
npm run test:section
npm run test:stability
npm run audit
```

All checks passed locally.
