import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const required = [
  'index.html', 'css/styles.css', 'js/app.js',
  'assets/favicon.svg', 'assets/profile-solutions-logo.svg',
  'netlify.toml', 'netlify/functions/config.mjs',
  'netlify/functions/auth-admin.mjs', 'netlify/functions/erp-data.mjs',
  'supabase/001_auth_profiles.sql', 'supabase/002_temporary_password_workflow.sql',
  'supabase/003_shared_operational_data.sql', 'supabase/004_stability_performance.sql',
  'supabase/005_section_task_assignment.sql',
  'TECHNICAL_AUDIT_REPORT.md', 'STABILITY_DEPLOYMENT.md',
  'scripts/stability-tests.mjs', 'scripts/section-assignment-tests.mjs',
];
for (const file of required) await access(new URL(file, root));

const [html, css, js, configFn, authFn, dataFn, migration, sectionMigration, netlify] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('css/styles.css', root), 'utf8'),
  readFile(new URL('js/app.js', root), 'utf8'),
  readFile(new URL('netlify/functions/config.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/auth-admin.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/erp-data.mjs', root), 'utf8'),
  readFile(new URL('supabase/004_stability_performance.sql', root), 'utf8'),
  readFile(new URL('supabase/005_section_task_assignment.sql', root), 'utf8'),
  readFile(new URL('netlify.toml', root), 'utf8'),
]);

const fail = message => { throw new Error(message); };
if (!html.includes('css/styles.css') || !html.includes('js/app.js')) fail('External application assets are not linked.');
if (/<style[\s>]/i.test(html) || /<script>\s*\(\(\)\s*=>/i.test(html)) fail('Large inline CSS/JavaScript bundles remain in index.html.');
if (!html.includes('@supabase/supabase-js@2.110.8')) fail('The Supabase browser dependency is not pinned.');
if (!html.includes('id="excel-file-input"') || !html.includes('id="backup-file-input"')) fail('Required hidden file inputs are missing.');
if (!css.includes('Profile Solutions Enterprise UI') || !css.includes('.is-busy-control')) fail('Production UI stylesheet is incomplete.');

if (!js.includes("const APP_VERSION = '11.1.1'")) fail('Client version 11.1.1 is missing.');
if (!js.includes('prepareAuthenticatedSession') || !js.includes('ensureFreshSession')) fail('Resilient authentication/session startup is missing.');
if (!js.includes('authenticatedStartupPromise') || (js.match(/onAuthStateChange/g) || []).length !== 1) fail('Authentication startup is duplicated or not serialized.');
if (!js.includes('pendingRealtimePayloads') || !js.includes('drainRealtimePayloads')) fail('Incremental Realtime event queuing is missing.');
if ((js.match(/\.channel\(`/g) || []).length !== 1) fail('Duplicate Realtime channel creation was detected.');
if (!js.includes('database-confirmed') && !js.includes('persistItemWorkflowChange')) fail('Confirmed production workflow persistence is missing.');
if (!js.includes('operationCount > 5000') || !js.includes('payloadBytes > 4500000')) fail('Atomic generic mutation size protection is missing.');
if (js.includes('splitOperationalChanges(')) fail('Non-atomic multi-batch generic synchronization remains enabled.');
if (!js.includes('await syncProfiles(); await saveState();')) fail('User-management audit persistence is not awaited.');
if (/localStorage\.setItem\((?!UI_STORAGE_KEY)/.test(js)) fail('Business or unknown data is still written to LocalStorage.');
if (/SUPABASE_SECRET_KEY\s*[:=]\s*['"]sb_/i.test(html + js)) fail('A Supabase secret appears in browser code.');

if (!dataFn.includes("'/rest/v1/rpc/apply_erp_changes'")) fail('Atomic database RPC is not used by the data Function.');
if (!dataFn.includes('result?.deduplicated') || !dataFn.includes('mutationExpectedVersion')) fail('Idempotent workflow retries are incomplete.');
if (!dataFn.includes("action === 'bulk-import'") || !dataFn.includes('upsertMixedImportChunk')) fail('Reliable bulk import handling is missing.');
if (!dataFn.includes('retryable: true') || !authFn.includes('retryable: true')) fail('Transient upstream retry handling is incomplete.');
if (!dataFn.includes("EXECUTIVE: new Set(['items', 'shortages', 'issues', 'audit', 'notifications'])")) fail('Executive production permissions changed unexpectedly.');

if (!migration.includes('create table if not exists public.erp_mutation_log')) fail('Idempotency table migration is missing.');
if (!migration.includes('create or replace function public.apply_erp_changes')) fail('Atomic mutation RPC migration is missing.');
if (!migration.includes('pg_advisory_xact_lock') || !migration.includes('ERP_CONFLICT')) fail('Concurrency controls are missing from the migration.');
if (!migration.includes('erp_records_notifications_user_read_idx')) fail('Targeted performance indexes are missing.');
if (!configFn.includes("applicationVersion: '11.1.1'") || !configFn.includes('stabilityMigrationReady')) fail('Version 11.1 configuration readiness check is missing.');
if (!sectionMigration.includes('trg_validate_erp_item_section_assignment') || !sectionMigration.includes('Role scoped ERP record access')) fail('Section assignment database migration is incomplete.');
if (!js.includes('Assign Section Work') || !js.includes('renderExecutiveDashboard') || !js.includes('Section Overview')) fail('Section assignment UI is incomplete.');
if (!js.includes('Items with no Section (set Section and assign)') || !js.includes('matchingAssignmentTargets')) fail('Legacy unsectioned item assignment recovery is missing.');
if (js.includes('id=\"add-item\"') || js.includes("document.getElementById('add-item')")) fail('Manual Add Item control is still present in Production Tracker.');
if (!dataFn.includes('SECTION_VALUES') || !dataFn.includes('This production task is not assigned to your account')) fail('Section or assignment API validation is incomplete.');
if (!netlify.includes('functions = "netlify/functions"') || !netlify.includes('Cache-Control')) fail('Netlify Function or cache configuration is incomplete.');

console.log('Project check passed: Profile Solutions ERP v11.1.1 Section assignment hotfix, assigned-work Executive security, Section Overview, reporting integration, stability audit, atomic idempotent database writes, serialized session startup, incremental Realtime synchronization, controlled retries, shared Supabase data, existing permissions and UI are present.');
