# Factory ERP v11.2.0 — Section Assignment Root-Cause Report

## Root cause

The previous bulk Section assignment flow updated item objects in the browser and then invoked the application's general state-diff synchronizer. The UI calculated its synchronized count from the same browser objects after the save call. It did not query the database for the affected records before reporting success.

This created several failure paths:

- The browser's Section values could be stale or absent while the database contained different values.
- The general synchronizer could return an unchanged/accepted response without proving that the intended Section rows were updated.
- The success toast was not tied to a verified database row count.
- Other modules depended on later Realtime events or navigation rather than an immediate authoritative reload.
- A cached older JavaScript bundle could continue rendering the removed Add Item control.

## Permanent correction

- Added a dedicated authenticated API action: `assign-section-work`.
- Added database function: `public.assign_erp_section_work` in migration `006_verified_section_assignment.sql`.
- Matching now occurs against Supabase records, not browser memory.
- Matching database rows are locked with `FOR UPDATE`.
- All target rows are updated in one transaction.
- The database verifies the requested Section, Executive ID, assigned-by ID and timestamp on every target row.
- Any count mismatch raises an exception and rolls back the transaction.
- Zero matches return a non-success result with a meaningful message.
- Audit and notification records are written in the same transaction.
- The frontend reloads Supabase data and confirms every returned record ID before displaying success.
- Connected users receive a Realtime reload broadcast after a verified assignment.
- Manual production-item creation is blocked in both the UI and the general server synchronization endpoint.
- Versioned asset URLs prevent the previous frontend bundle from remaining cached after deployment.

## Unchanged areas

Authentication, user roles, existing dashboards, production stages, reports, workflow logic, project data, shortage handling, bulk-upload structure and existing records were not redesigned or removed.
