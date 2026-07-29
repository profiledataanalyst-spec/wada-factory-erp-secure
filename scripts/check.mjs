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
if (!dataFn.includes("action === 'sync'") || !dataFn.includes("action === 'seed-if-empty'") || !dataFn.includes("action === 'bulk-import'") || !dataFn.includes("action === 'update-item-workflow'")) throw new Error('Shared operational data Function actions are missing.');
if (!migration.includes('create table if not exists public.erp_records') || !migration.includes('supabase_realtime')) throw new Error('Shared operational data migration is incomplete.');
if (!js.includes("from('erp_records')") || !js.includes('postgres_changes') || !js.includes('queueOperationalSync')) throw new Error('Realtime shared-data client is missing.');
if (!html.includes('id="excel-file-input"') || !js.includes('ensureImportInput')) throw new Error('Excel file input is missing.');
if (!js.includes("callDataApi('bulk-import'") || !js.includes('async function confirmImport')) throw new Error('Database-backed bulk import workflow is missing.');
if (!js.includes('blankOptionalExcelValue') || !js.includes('parseQuantityCell')) throw new Error('Excel zero/date/quantity validation fix is missing.');
if (!dataFn.includes('upsertMixedImportChunk') || !dataFn.includes('normalizeBulkImportRecords')) throw new Error('Bulk import server validation is missing.');
if (dataFn.includes('Executives cannot create production items.')) throw new Error('Outdated Executive production-item creation blocker is still present.');

if (!js.includes('persistItemWorkflowChange') || !js.includes('operationalRecordVersions') || !js.includes('scheduleRealtimeReconnect')) throw new Error('Reliable production-stage synchronization client is missing.');
if (!dataFn.includes('updateItemWorkflow') || !dataFn.includes('updated_at=eq.') || !dataFn.includes('HttpError(409')) throw new Error('Atomic database-confirmed production-stage update is missing.');
if (!js.includes('Update already in progress') || !css.includes('.is-busy-control')) throw new Error('Duplicate-request prevention and loading state are missing.');
if (!js.includes("window.addEventListener('focus'") || !js.includes("window.addEventListener('online'")) throw new Error('Realtime reconnect/focus refresh safeguards are missing.');
if (!/MANAGER:\s*new Set\(\['items',\s*'shortages',\s*'issues'\]\)/.test(dataFn)) throw new Error('Manager production-item deletion permission is missing.');
if (!dataFn.includes('Executives may create production items')) throw new Error('Executive production-item creation validation is missing.');
if (!js.includes("requireRole('ADMIN','MANAGER','EXECUTIVE')") || !js.includes("requireRole('ADMIN','MANAGER')")) throw new Error('Production-item frontend role checks are incomplete.');
if (!html.includes("can('ADMIN','MANAGER')?'<button class=\"btn btn-danger\" id=\"delete-item\">")) throw new Error('Manager production-item delete action is missing from the deployed inline application.');
if (js.includes('localStorage.setItem(STORAGE_KEY') || js.includes('safeState = { ...state')) throw new Error('Business data is still being stored in LocalStorage.');
if (/SUPABASE_SECRET_KEY\s*[:=]\s*['\"]sb_secret_/i.test(html + js)) throw new Error('Secret key appears in browser code.');

console.log('Project check passed: Profile Solutions ERP v10.2, reliable database-confirmed production-stage synchronization, realtime reconnect, duplicate-request prevention, corrected permissions, bulk upload, shared Supabase data, temporary passwords and Netlify Functions are present.');
