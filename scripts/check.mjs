import { access, readFile } from 'node:fs/promises';

const required = [
  'index.html',
  'css/styles.css',
  'js/app.js',
  'assets/favicon.svg',
  'assets/profile-solutions-logo.svg',
  'netlify.toml',
  'netlify/functions/config.mjs',
  'netlify/functions/auth-admin.mjs',
  'netlify/functions/erp-data.mjs',
  'supabase/001_auth_profiles.sql',
  'supabase/002_temporary_password_workflow.sql',
  'supabase/003_shared_operational_data.sql',
  'PROFILE_SOLUTIONS_UI_UPDATE.md',
  'EMAIL_TEMPLATES_PROFILE_SOLUTIONS.html',
];
for (const file of required) await access(new URL(`../${file}`, import.meta.url));

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');
const js = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const fn = await readFile(new URL('../netlify/functions/auth-admin.mjs', import.meta.url), 'utf8');
const dataFn = await readFile(new URL('../netlify/functions/erp-data.mjs', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/003_shared_operational_data.sql', import.meta.url), 'utf8');

if (!html.includes('supabase-js') || !html.includes('initialiseAuthentication')) throw new Error('Secure auth bundle is missing from index.html.');
if (!html.includes('Profile Solutions ERP') || !html.includes('assets/profile-solutions-logo.svg')) throw new Error('Profile Solutions branding is missing from index.html.');
if (!js.includes('Change Temporary Password') || !js.includes('Create New User')) throw new Error('Temporary-password UI is missing.');
if (!js.includes('Profile Solutions') || !js.includes('sidebar-collapsed')) throw new Error('Profile Solutions application shell is missing.');
if (!css.includes('Profile Solutions Enterprise UI') || !css.includes('.dashboard-hero') || !css.includes('.auth-shell')) throw new Error('Version 8 UI stylesheet is incomplete.');
if (!fn.includes("action === 'create'") || !fn.includes("action === 'reset-password'") || !fn.includes("action === 'change-own-password'")) throw new Error('Temporary-password Function actions are missing.');
if (!dataFn.includes("action === 'sync'") || !dataFn.includes("action === 'seed-if-empty'")) throw new Error('Shared operational data Function actions are missing.');
if (!migration.includes('create table if not exists public.erp_records') || !migration.includes('supabase_realtime')) throw new Error('Shared operational data migration is incomplete.');
if (!js.includes("from('erp_records')") || !js.includes('postgres_changes') || !js.includes('queueOperationalSync')) throw new Error('Realtime shared-data client is missing.');
if (js.includes('localStorage.setItem(STORAGE_KEY') || js.includes('safeState = { ...state')) throw new Error('Business data is still being stored in LocalStorage.');
if (/SUPABASE_SECRET_KEY\s*[:=]\s*['\"]sb_secret_/i.test(html + js)) throw new Error('Secret key appears in browser code.');

console.log('Project check passed: Profile Solutions UI v9, Supabase shared operational data, realtime synchronization, temporary passwords, Netlify Functions, and migrations are present.');
