# Profile Solutions Procurement ERP v11.3.0

This release preserves the current ERP and adds the approved **Section Assignment & Dashboard Integration** for Aluminium, Store, Fabrication and Outsource. See `SECTION_ASSIGNMENT_IMPLEMENTATION.md` and `REDEPLOY_V11.3.0.md`.

# Profile Solutions Procurement ERP

Version **11.1.0** is a minimal in-place conversion of the existing ERP source application.

## What changed

- User-facing application name changed to **Profile Solutions Procurement ERP**.
- Existing UI, navigation, roles, authentication, database, APIs and features are retained.
- The tracker now uses seven stages:
  1. Planning
  2. Cutting
  3. Fabrication
  4. Grinding
  5. Pre-Coating
  6. Powder Coating
  7. Ready for Dispatch
- Existing records using removed historical stages are safely aligned through `supabase/005_procurement_stage_alignment.sql`.

## Runtime architecture

- Static HTML/CSS/JavaScript frontend
- Supabase Authentication and PostgreSQL
- Supabase Realtime
- Protected Netlify Functions
- Atomic/idempotent mutation RPC from migration 004

## Validate

```cmd
npm run audit
```

## Deploy

Follow `REDEPLOY_PROCUREMENT_ERP.md`.

## Security

Keep `SUPABASE_SECRET_KEY` only in protected Netlify Function environment variables. Never place it in browser code or a public repository.
