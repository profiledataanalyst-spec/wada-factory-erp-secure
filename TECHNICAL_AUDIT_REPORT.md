# Profile Solutions Factory ERP — Technical Stability Audit

**Release:** 11.0.0  
**Audit scope:** authentication, sessions, database writes, state consistency, Realtime, bulk operations, network behavior, error handling, code lifecycle and deployment performance.  
**Preserved:** UI, business workflows, role permissions, dashboards, reports, Excel format and existing operational schema.

## Executive finding

The intermittent failures were not caused by one isolated bug. The Version 10.2 client combined optimistic browser mutation, delayed generic synchronization, full-table Realtime reloads, overlapping authentication startup work and non-idempotent request retry behavior. These paths could race with each other and leave a browser displaying a value that had not yet been confirmed by PostgreSQL.

Version 11 changes the reliability architecture without changing the ERP’s visible behavior:

- PostgreSQL applies ordinary operational mutations inside one transaction.
- Every mutation has an idempotency request ID.
- Updates and deletes use the last confirmed `updated_at` version.
- A retry of a completed stage update returns the confirmed result instead of writing it twice.
- Authentication startup is serialized.
- Access tokens are checked and refreshed before protected requests.
- Realtime events update the single shared state incrementally.
- Events received during a local write are queued and reconciled after confirmation.
- Full-table reloads are reserved for startup, reconnect, conflict recovery, bulk verification and stale-data fallback.

## Issues found and implemented fixes

### 1. Overlapping authentication initialization — High

**Root cause:** The login form and `onAuthStateChange` could both load profiles and operational data for the same sign-in. Token refresh events could also enter the same asynchronous path.

**Impact:** Intermittent login delay, duplicate profile/data requests and misleading database/authentication errors.

**Fix:** Added a serialized authentication transition chain and a shared `authenticatedStartupPromise`. `TOKEN_REFRESHED` now updates only the in-memory session. Startup work is performed once per session.

### 2. Valid sessions were treated as failed logins when data loading failed — High

**Root cause:** A transient Supabase/PostgREST failure after successful password verification caused the login catch block to sign out locally.

**Impact:** Unexpected logout and “login failed” messages even when credentials were correct.

**Fix:** Authentication errors and operational connectivity errors are classified separately. Only genuine session/authentication failures clear the persisted session. Network/database startup failures remain retryable.

### 3. Requests could use an expiring access token — High

**Root cause:** Protected API requests reused the last `authSession.access_token` without checking remaining lifetime.

**Impact:** Intermittent `401`, “Database sync failed” and failed second operations near token expiry.

**Fix:** `ensureFreshSession()` validates the stored session before every protected request and refreshes it inside a 90-second expiry window. A `401` is retried once with a forced refresh; a second `401` returns the user to login with an explicit session-expired message.

### 4. Generic CRUD was not atomic — Critical

**Root cause:** A logical operation could be split into multiple sequential HTTP upsert/delete calls.

**Impact:** Partial project/item/shortage/audit updates when a later request failed.

**Fix:** Added `public.apply_erp_changes(...)`. Supported upserts and deletes are applied in one PostgreSQL transaction. Generic non-bulk mutations are sent as one bounded transaction instead of client-side batches.

### 5. Network retry could duplicate a completed write — Critical

**Root cause:** The browser could retry after a timeout without the server knowing whether the previous request committed.

**Impact:** Duplicate history/audit entries, inconsistent bulk results or a misleading conflict after a successful save.

**Fix:** Added `erp_mutation_log`, request IDs and an advisory transaction lock. Repeating the same request ID returns the stored result without performing the write again. Entries older than 30 days are pruned.

### 6. Stage-update retry checked concurrency before idempotency — Critical

**Root cause:** A stage update that committed but lost its response was retried with the old version. The server rejected it before reaching the idempotency layer.

**Impact:** “First update works, second/retry fails” behavior.

**Fix:** Workflow updates now pass the client’s expected version into the atomic RPC. The RPC checks request-id replay before concurrency. A replay returns the latest confirmed item; a genuinely stale new request returns `409`.

### 7. Client did not retain confirmed versions after ordinary CRUD — Critical

**Root cause:** Generic sync responses did not consistently update the browser’s per-record `updated_at` version map.

**Impact:** A later update could use an old version and fail even though the previous write succeeded.

**Fix:** Every successful atomic mutation returns versions. The client updates or removes version entries immediately. Stage updates also replace the item using the database-confirmed record/version.

### 8. Realtime triggered full-table loads after normal writes — High

**Root cause:** Events arriving while a local save was in progress set a “reload pending” flag. Once the save finished, the browser reloaded all records.

**Impact:** Delay, repeated network traffic, unnecessary rendering and temporary stale dashboards.

**Fix:** Realtime payloads are queued during local mutation. After confirmation they are applied incrementally, and duplicate/equal-version events are ignored. Full reload occurs only after reconnect, overflow, detected conflict or stale fallback.

### 9. Realtime subscription lifecycle could miss changes — High

**Root cause:** Reconnection recreated a channel but did not immediately fetch changes that may have occurred while disconnected.

**Impact:** Modules could remain stale until the next poll or focus event.

**Fix:** Only one channel generation is active. Errors/timeouts/closure use exponential reconnect. A successful reconnect performs one authoritative refresh. Browser online/focus/visibility handling refreshes only when disconnected or older than 30 seconds.

### 10. Duplicate requests were possible from controls — Medium

**Root cause:** Some actions remained clickable while a request was in flight.

**Impact:** Parallel update/delete requests and race conditions.

**Fix:** Per-entity mutation locks, item workflow locks, disabled controls and `aria-busy` indicators remain active until confirmation or failure.

### 11. UI could report success before shared persistence — High

**Root cause:** Several user-management audit, settings, restore and reset paths called `saveState()` without `await`.

**Impact:** Success appeared before PostgreSQL confirmation; failures became unhandled promises.

**Fix:** All business-data persistence paths await completion. Failed optimistic state is restored, the latest database state is scheduled after conflicts, and errors include request IDs for logs.

### 12. Supabase read/write calls lacked consistent timeout/retry policy — High

**Root cause:** Some profile, record and Auth Admin requests used raw fetch with no transient retry.

**Impact:** Temporary network or upstream errors surfaced directly to users.

**Fix:** Added bounded timeouts and exponential backoff for safe/idempotent reads, PUT/PATCH/DELETE operations and idempotent RPC calls. Non-idempotent account creation POSTs are not blindly retried.

### 13. Large inline application bundle — Medium

**Root cause:** CSS and the full JavaScript application were duplicated inside `index.html` while also existing as separate files.

**Impact:** Large HTML response, poor browser caching and risk that inline and external code diverged.

**Fix:** `index.html` now loads `css/styles.css` and `js/app.js`. The visual output is unchanged. The Supabase browser SDK is pinned to an exact version rather than an open major tag.

### 14. Missing targeted database indexes — Medium

**Root cause:** Generic JSONB records had broad indexes but no targeted expressions for common stage/status/notification/shortage access patterns.

**Impact:** Increasing scan cost as record count grows.

**Fix:** Migration 004 adds partial expression indexes for item stage, item status, notification user/read state and shortage status. Existing project and JSONB indexes remain.

### 15. Weak diagnostic correlation — Medium

**Root cause:** Browser errors and server logs were not consistently tied to the same operation.

**Impact:** Intermittent failures were difficult to trace.

**Fix:** Every protected mutation includes `X-ERP-Request-ID`; Functions log and return the request ID on errors. Client console entries include the mutation ID.

### 16. Unbounded idempotency history — Low

**Root cause:** A permanent request log would continue growing.

**Fix:** Successful mutations remove idempotency rows older than 30 days using the indexed creation timestamp.

## State and synchronization model after the audit

1. Supabase/PostgreSQL remains the source of truth.
2. Browser state is a working projection of `erp_records`, not persistent business storage.
3. LocalStorage stores only UI preferences and one-time legacy migration discovery.
4. Local CRUD changes are temporary until the atomic RPC confirms them.
5. Confirmed versions are kept per entity/record.
6. Realtime applies newer row events incrementally to the same state.
7. Conflicts reject the stale write and load authoritative data.
8. Reconnect and stale fallback perform a controlled full refresh.

## Database changes

Migration `supabase/004_stability_performance.sql` adds:

- `erp_mutation_log`
- `apply_erp_changes(text, uuid, jsonb)`
- optimistic version checks
- idempotent request replay
- advisory request locking
- targeted JSONB expression indexes
- bounded mutation-log retention

It does not alter the existing user-role model or business record payloads.

## Automated validation performed

The package includes and passes:

- JavaScript syntax checks for the client and all three Functions
- project structure and security assertions
- checks that business data is not written to LocalStorage
- checks for a single Auth listener and single Realtime channel constructor
- checks for atomic RPC and idempotency controls
- a mocked two-consecutive-stage-update test
- a same-request retry test
- a stale-version conflict test
- external asset/caching checks

Run:

```cmd
npm run audit
```

## Residual limitations and production gate

This audit was performed against the supplied Version 10.2 package in a local environment. It cannot prove your live Supabase latency, quota, network quality, browser extensions or Netlify runtime behavior. Production approval therefore requires:

1. Running migration 004 successfully.
2. Deploying Version 11 Functions and assets.
3. Verifying `/api/config` readiness.
4. Completing the two-browser test matrix in `STABILITY_DEPLOYMENT.md`.
5. Monitoring Netlify Function and Supabase logs during the first production day.

The existing generic JSONB `erp_records` model is retained as requested. It is suitable for the current moderate shared-factory workload, but a future very-large deployment with millions of operational rows would benefit from normalized domain tables and server-side report queries. That architectural migration is intentionally outside this stability release.
