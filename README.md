# Factory ERP – Secure Invitations and Authentication

Version 6 adds secure Supabase authentication to the existing vanilla HTML/CSS/JavaScript ERP without redesigning its operational UI.

## Authentication features

- One-time first Super Admin setup
- Super Admin-only user creation
- Manager and Executive invitation emails
- User-created passwords
- Secure password hashing managed by Supabase Auth
- Single-use invitation links
- Configurable link expiry through Supabase Email OTP expiration
- Forgot Password and recovery email
- Role fetched from the protected `profiles` table
- Inactive-account blocking
- Super Admin user editing and deletion
- Netlify Function enforcement for administration actions
- No passwords stored in Local Storage

## Existing ERP features retained

- Factory dashboard
- Projects
- Production Tracker
- Stage updates for all roles
- Shortages and Issues
- Operations item creation
- Excel template download and validation
- Reports and filters
- Role-based menus and operational controls
- Browser backup and restore

## Architecture

- Frontend: HTML, CSS and vanilla JavaScript
- Authentication: Supabase Auth
- User profiles and roles: Supabase PostgreSQL
- Secure admin API: Netlify Functions
- Hosting: Netlify
- Operational ERP state: existing browser Local Storage workflow

The authentication and user directory are shared across devices. The operational data workflow was intentionally left unchanged, so projects, production records and shortages remain stored in each browser. Migrating all operational ERP data to Supabase would be a separate database migration project.

Read these files in order:

1. `SUPABASE_SETUP.md`
2. `DEPLOYMENT_STEPS.md`
3. `VALIDATION_REPORT.md`
