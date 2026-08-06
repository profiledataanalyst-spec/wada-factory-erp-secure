# Section Assignment & Dashboard Integration — v11.3.0

## Scope

This release adds only the requested Section workflow. Existing UI design, authentication, roles, production stages, Project Add Items, bulk import, reports, shortages, database synchronization and business workflows remain in place.

## Approved Sections

- Aluminium
- Store
- Fabrication
- Outsource

## Implemented Integration

### Bulk Upload

The official Excel and CSV templates now include `SECTION` after `ITEM NAME`. Upload validation rejects blank or non-approved values and shows the source row and reason. Every valid production-item payload stores the canonical Section value in Supabase.

### Projects Add Items

The existing popup now includes a required Section dropdown per row. `save_project_line_items_with_sections` wraps the existing atomic line-item save and synchronizes Section to the linked Production Tracker record in the same database transaction.

### Section Assignment

Super Admin and Managers have an `Assign Section Work` action. They select a project and map each Section to an active Executive. The protected server function validates:

- caller is ADMIN or MANAGER;
- Manager owns the selected project;
- assignee is an active EXECUTIVE;
- Manager controls or already has access to the Executive.

The assignment updates all matching project/Section production items and the normalized `project_line_items` records. The project Executive list and an in-app notification are updated as part of the same transaction.

### Executive Visibility

Executive views filter production items by `assignedExecutiveId`. Their dashboard shows:

- Assigned Projects
- Assigned Items
- Section
- Current Stage
- Pending Tasks
- Completed Tasks
- Due Date
- Priority

Executives do not see another Executive's assigned production items in the dashboard, Production Tracker, project item table, shortage-linked item selector or reports.

### Factory Overview

The existing overview includes a Section Summary for each approved Section:

- Total Items
- Total Assigned
- In Progress
- Completed
- Pending

The summary uses the same confirmed Supabase production-item state used by Production Tracker and therefore updates through the existing mutation and Realtime architecture.

### Search, Filters, Reports and Export

Section is included in global search, project search, Production Tracker filters, shortage views, report filters, project reports, delay reports, shortage reports, production reports and CSV export.

## Database Source of Truth

- `erp_records` production payload: `section`, `assignedExecutiveId`, `assignedBy`, `assignedAt`
- `project_line_items`: normalized Section and Executive assignment columns
- Supabase PostgreSQL remains the single source of truth.
- Browser LocalStorage remains limited to UI preferences.
