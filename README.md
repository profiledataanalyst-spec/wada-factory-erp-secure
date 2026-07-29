# Profile Solutions Factory ERP

Version 8 applies a complete Profile Solutions UI/UX redesign to the existing Factory ERP while preserving its authentication, permissions, business logic, workflows, data structures, imports, reports, production tracker, shortages module and Netlify/Supabase integrations.

## Visual redesign

- Profile Solutions logo and favicon throughout the application
- Premium dark-navy and brand-green enterprise theme
- Redesigned login, first-admin setup and forced-password-change screens
- Collapsible navigation sidebar with consistent SVG icons
- Modern header with search, notification panel and profile menu
- Executive dashboard hero, KPI cards, tables, forms, modals and charts
- Responsive layouts for desktop, laptop, tablet and mobile
- Keyboard focus styling, accessible labels and reduced-motion support
- Official Profile Solutions website photography used for branded hero imagery

## Authentication workflow retained

- First Super Admin setup through Supabase Auth
- Super Admin creates Manager and Executive accounts
- Manager creates Executive accounts only
- Temporary passwords with forced first-login password change
- Administrator-assisted password reset
- Netlify Functions enforce permissions and protect the Supabase secret key

## Deploying the UI update

No SQL migration, Supabase setting, environment-variable change or Netlify configuration change is required for Version 8.

See `PROFILE_SOLUTIONS_UI_UPDATE.md` for the exact update procedure.
