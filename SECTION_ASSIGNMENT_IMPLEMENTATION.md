# Section Assignment & Dashboard Integration — v11.3.1

## Scope

This release adds only the approved Section workflow. Existing UI design, authentication, roles, production stages, dashboards, bulk-upload flow, reports, shortages and business workflows remain unchanged.

## Approved Sections

- Aluminium
- Store
- Fabrication
- Outsource

## Single source of truth

All operational records continue to use the existing `public.erp_records` table. Production-item payloads store:

```text
section
assignedExecutiveId
assignedBy
assignedAt
```

No `project_line_items` table is required. Project Details, Add Items, Production Tracker, Operations, Executive Dashboard, Factory Overview, shortages, reports and exports read the same confirmed production-item records.

## Bulk upload

The Excel and CSV templates contain `SECTION` immediately after `ITEM NAME`. Upload validation rejects blank or unsupported values and reports the source Excel row. Valid records are saved through the existing atomic shared-data API.

## Projects Add Items

The existing popup includes a required Section dropdown per row. Its protected API reads and writes the same `erp_records` production records used by Production Tracker. Pending Quantity remains calculated as Required Quantity minus Dispatch Quantity.

## Section assignment

Super Admin and Managers can map each Project + Section to an active Executive without editing uploaded rows. The server and database verify:

- caller is ADMIN or MANAGER;
- Manager owns the project;
- assignee is an active EXECUTIVE;
- Manager may assign only an Executive they manage or one already linked to that project;
- duplicate Section assignments are rejected;
- repeated requests are idempotent.

Assignment updates matching production records atomically and sends an in-app notification only when records actually change.

## Executive dashboard and visibility

Executives see only production items where `assignedExecutiveId` matches their authenticated user ID. Their dashboard displays Assigned Projects, Assigned Items, Section, Current Stage, Pending Tasks, Completed Tasks, Due Date and Priority.

Existing project-level permissions remain intact, while production items and task-oriented views remain assigned-only.

## Factory Overview and reporting

The Section Summary displays Total Items, Total Assigned, In Progress, Completed and Pending for each approved Section. Section is also included in search, filters, project details, Production Tracker, shortages, reports, CSV export and Excel validation results.

All values use the shared database-confirmed state and existing Supabase Realtime synchronization.
