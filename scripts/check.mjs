import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const required = [
  'index.html', 'css/styles.css', 'js/app.js',
  'assets/favicon.svg', 'assets/profile-solutions-logo.svg',
  'ERP_Bulk_Upload_Template.xlsx', 'netlify.toml',
  'netlify/functions/config.mjs', 'netlify/functions/auth-admin.mjs',
  'netlify/functions/erp-data.mjs', 'netlify/functions/project-line-items.mjs',
  'supabase/001_auth_profiles.sql', 'supabase/002_temporary_password_workflow.sql',
  'supabase/003_shared_operational_data.sql', 'supabase/004_stability_performance.sql',
  'supabase/005_procurement_stage_alignment.sql', 'supabase/009_project_line_items_popup.sql',
  'supabase/010_project_items_production_sync.sql', 'supabase/011_section_assignment_dashboard.sql',
  'PROCUREMENT_CONVERSION_REPORT.md', 'REDEPLOY_PROCUREMENT_ERP.md',
  'scripts/stability-tests.mjs', 'scripts/project-line-items-tests.mjs', 'scripts/project-items-sync-tests.mjs', 'scripts/section-assignment-tests.mjs',
];
for (const file of required) await access(new URL(file, root));

const [html, css, js, configFn, authFn, dataFn, lineItemsFn, migration4, migration5, migration9, migration10, migration11, netlify, emailTemplate, packageJson] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('css/styles.css', root), 'utf8'),
  readFile(new URL('js/app.js', root), 'utf8'),
  readFile(new URL('netlify/functions/config.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/auth-admin.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/erp-data.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/project-line-items.mjs', root), 'utf8'),
  readFile(new URL('supabase/004_stability_performance.sql', root), 'utf8'),
  readFile(new URL('supabase/005_procurement_stage_alignment.sql', root), 'utf8'),
  readFile(new URL('supabase/009_project_line_items_popup.sql', root), 'utf8'),
  readFile(new URL('supabase/010_project_items_production_sync.sql', root), 'utf8'),
  readFile(new URL('supabase/011_section_assignment_dashboard.sql', root), 'utf8'),
  readFile(new URL('netlify.toml', root), 'utf8'),
  readFile(new URL('EMAIL_TEMPLATES_PROFILE_SOLUTIONS.html', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8'),
]);

const fail = message => { throw new Error(message); };
const expectedStages = [
  'PLANNING', 'CUTTING', 'FABRICATION', 'GRINDING',
  'PRE-COATING', 'POWDER COATING', 'READY FOR DISPATCH',
];
function extractStageArray(source, variableName) {
  const match = source.match(new RegExp(`const ${variableName} = \\[([\\s\\S]*?)\\n\\s*\\];`));
  if (!match) fail(`${variableName} declaration is missing.`);
  return [...match[1].matchAll(/'([^']+)'/g)].map(entry => entry[1]);
}

if (!html.includes('<title>Profile Solutions Procurement ERP</title>')) fail('Browser title is not the Procurement ERP name.');
if (!html.includes('Profile Solutions Procurement ERP for projects')) fail('Procurement ERP metadata is missing.');
if (!html.includes('css/styles.css') || !html.includes('js/app.js')) fail('External application assets are not linked.');
if (/<style[\s>]/i.test(html) || /<script>\s*\(\(\)\s*=>/i.test(html)) fail('Large inline CSS/JavaScript bundles remain in index.html.');
if (!html.includes('@supabase/supabase-js@2.110.8')) fail('The Supabase browser dependency is not pinned.');
if (!html.includes('id="excel-file-input"') || !html.includes('id="backup-file-input"')) fail('Required hidden file inputs are missing.');
if (!css.includes('Profile Solutions Enterprise UI') || !css.includes('.is-busy-control')) fail('Existing UI stylesheet is incomplete.');

if (!js.includes("const APP_VERSION = '11.3.0'")) fail('Client version 11.3.0 is missing.');
if (!js.includes("erpName: 'Profile Solutions Procurement ERP'")) fail('Procurement ERP brand is missing from the client.');
if (!js.includes("label: 'Procurement Overview'")) fail('Procurement dashboard label is missing.');
if (JSON.stringify(extractStageArray(js, 'STAGES')) !== JSON.stringify(expectedStages)) fail('Client stage sequence is not the approved seven-stage sequence.');
if (JSON.stringify(extractStageArray(dataFn, 'PRODUCTION_STAGES')) !== JSON.stringify(expectedStages)) fail('Backend stage sequence does not match the client.');
if (/currentStage\s*(?:===|==|>=|<=|<|>)\s*8/.test(js) || /stage\s*>\s*8/.test(dataFn)) fail('A hard-coded legacy final-stage index remains.');
if (!js.includes('normalizeProductionItemRecord') || !dataFn.includes('normalizeProductionItemPayload')) fail('Legacy stage compatibility is missing.');
if (!migration5.includes('Data-only migration') || !migration5.includes("'READY FOR DISPATCH' then 6")) fail('Stage-alignment data migration is incomplete.');

if (!js.includes('prepareAuthenticatedSession') || !js.includes('ensureFreshSession')) fail('Resilient authentication/session startup is missing.');
if (!js.includes('authenticatedStartupPromise') || (js.match(/onAuthStateChange/g) || []).length !== 1) fail('Authentication startup is duplicated or not serialized.');
if (!js.includes('pendingRealtimePayloads') || !js.includes('drainRealtimePayloads')) fail('Incremental Realtime event queuing is missing.');
if ((js.match(/\.channel\(`/g) || []).length !== 1) fail('Duplicate Realtime channel creation was detected.');
if (!js.includes('persistItemWorkflowChange')) fail('Confirmed workflow persistence is missing.');
if (!js.includes('operationCount > 5000') || !js.includes('payloadBytes > 4500000')) fail('Atomic mutation size protection is missing.');
if (js.includes('splitOperationalChanges(')) fail('Non-atomic multi-batch synchronization remains enabled.');
if (!js.includes('await syncProfiles(); await saveState();')) fail('User-management audit persistence is not awaited.');
if (/localStorage\.setItem\((?!UI_STORAGE_KEY)/.test(js)) fail('Business or unknown data is still written to LocalStorage.');
if (/SUPABASE_SECRET_KEY\s*[:=]\s*['"]sb_/i.test(html + js)) fail('A Supabase secret appears in browser code.');

if (!dataFn.includes("'/rest/v1/rpc/apply_erp_changes'")) fail('Atomic database RPC is not used by the data Function.');
if (!dataFn.includes('result?.deduplicated') || !dataFn.includes('mutationExpectedVersion')) fail('Idempotent workflow retries are incomplete.');
if (!dataFn.includes("action === 'bulk-import'") || !dataFn.includes('upsertMixedImportChunk')) fail('Reliable bulk import handling is missing.');
if (!dataFn.includes('retryable: true') || !authFn.includes('retryable: true')) fail('Transient upstream retry handling is incomplete.');
if (!dataFn.includes("EXECUTIVE: new Set(['items', 'shortages', 'issues', 'audit', 'notifications'])")) fail('Existing Executive permissions changed unexpectedly.');

if (!migration4.includes('create table if not exists public.erp_mutation_log')) fail('Idempotency table migration is missing.');
if (!migration4.includes('create or replace function public.apply_erp_changes')) fail('Atomic mutation RPC migration is missing.');
if (!migration4.includes('pg_advisory_xact_lock') || !migration4.includes('ERP_CONFLICT')) fail('Concurrency controls are missing from the migration.');
if (!migration4.includes('erp_records_notifications_user_read_idx')) fail('Targeted performance indexes are missing.');
if (!configFn.includes("applicationVersion: '11.3.0'") || !configFn.includes('stabilityMigrationReady')) fail('Version 11.3.0 configuration readiness is missing.');
if (![configFn, authFn, dataFn].every(source => source.includes("startsWith('sb_secret_')"))) fail('Current Supabase secret-key header compatibility is missing.');
if (!netlify.includes('functions = "netlify/functions"') || !netlify.includes('Cache-Control')) fail('Netlify Function or cache configuration is incomplete.');
if (!emailTemplate.includes('Profile Solutions Procurement ERP')) fail('Email template branding is not updated.');
if (!packageJson.includes('profile-solutions-procurement-erp') || !packageJson.includes('"version": "11.3.0"')) fail('Package metadata is not updated to 11.3.0.');


if (!js.includes('data-add-project-items') || !js.includes('openProjectItemsModal') || !js.includes("callProjectLineItemsApi('save-all'")) fail('Projects Add Items popup is incomplete.');
if (!lineItemsFn.includes("action === 'list'") || !lineItemsFn.includes("action === 'save-all'")) fail('Project Line Items API actions are incomplete.');
if (!lineItemsFn.includes("String(raw?.id || '').trim()") || !migration9.includes("v_id := trim(coalesce(v_item ->> 'id', ''))")) fail('Blank line-item IDs are not normalized safely.');
if (!migration9.includes('save_project_line_items_batch') || !migration9.includes('required_quantity - dispatch_quantity')) fail('Minimal line-item database support is incomplete.');
if (!migration10.includes('project_line_items_project_name_uom_uidx') || !migration10.includes('sync_project_line_item_from_erp_item')) fail('Project / Production line-item synchronization migration is incomplete.');
if (!lineItemsFn.includes("const uom = String(raw?.uom || 'Nos.')") || !lineItemsFn.includes('productionRecords')) fail('UOM or synchronized Production record handling is missing from the line-item API.');
if (!configFn.includes('lineItemProductionSyncReady')) fail('Configuration does not verify the synchronization migration.');
if (/Total Line Items|Completed Line Items|Pending Dispatch Report|Project-wise Line Items/.test(js)) fail('Dashboard/report line-item expansion was introduced outside the requested scope.');
if (!js.includes("const SECTIONS = ['Aluminium', 'Store', 'Fabrication', 'Outsource']")) fail('Approved Section values are missing from the client.');
if (!js.includes("'PROJECT NAME', 'ITEM NAME', 'SECTION'")) fail('SECTION is missing from the official bulk-upload headers.');
if (!js.includes('openSectionAssignmentModal') || !js.includes("callProjectLineItemsApi('assign-sections'")) fail('Section-based task assignment is incomplete.');
if (!js.includes('renderExecutiveDashboard') || !js.includes('My Assigned Work')) fail('Assigned-only Executive dashboard is incomplete.');
if (!js.includes('Section Summary') || !js.includes('report-section') || !js.includes('item-section')) fail('Section dashboard, filters or reports are incomplete.');
if (!lineItemsFn.includes("action === 'assign-sections'") || !lineItemsFn.includes('assign_project_sections')) fail('Protected Section assignment API is incomplete.');
if (!migration11.includes('save_project_line_items_with_sections') || !migration11.includes('assign_project_sections')) fail('Section database migration is incomplete.');
if (!migration11.includes("'Aluminium','Store','Fabrication','Outsource'")) fail('Section database constraint is incomplete.');
if (!configFn.includes('sectionAssignmentReady') || !configFn.includes("applicationVersion: '11.3.0'")) fail('Version 11.3.0 configuration readiness is missing.');
console.log('Project check passed: Profile Solutions Procurement ERP v11.3.0 preserves the existing UI and workflows while adding validated Section upload, protected section assignment, assigned-only Executive views, section dashboards, filters and reports.');
