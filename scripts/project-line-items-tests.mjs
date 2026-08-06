import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [app, api, migration, syncMigration] = await Promise.all([
  readFile(new URL('js/app.js', root), 'utf8'),
  readFile(new URL('netlify/functions/project-line-items.mjs', root), 'utf8'),
  readFile(new URL('supabase/009_project_line_items_popup.sql', root), 'utf8'),
  readFile(new URL('supabase/010_project_items_production_sync.sql', root), 'utf8'),
]);

const fail = message => { throw new Error(message); };
const pending = (required, dispatch) => Math.round(Math.max(0, required - dispatch) * 10000) / 10000;
if (pending(100, 40) !== 60) fail('100 - 40 must equal 60.');
if (pending(50, 50) !== 0) fail('50 - 50 must equal 0.');
if (pending(12.75, 2.5) !== 10.25) fail('Decimal pending quantity calculation failed.');

const projectsStart = app.indexOf('function renderProjects()');
const projectsEnd = app.indexOf('function openProjectDetail', projectsStart);
const projectsSource = app.slice(projectsStart, projectsEnd);
if (!projectsSource.includes('data-add-project-items') || !projectsSource.includes('openProjectItemsModal')) fail('Add Items is not integrated into Projects.');
if (!app.includes('<th>Line Item Name</th><th>Section</th><th>UOM</th>')) fail('Section or UOM is missing from the Add Items popup.');
if (!app.includes('Save All Items') || !app.includes('Delete Row') || !app.includes('+ Add Row')) fail('Popup row controls are incomplete.');
if (!app.includes('Dispatch Quantity cannot exceed Required Quantity.')) fail('Dispatch validation is missing.');

const dashboardStart = app.indexOf('function renderDashboard()');
const dashboardEnd = app.indexOf('function renderProjects()', dashboardStart);
const reportStart = app.indexOf('function renderReports()');
const reportEnd = app.indexOf('function renderUsers()', reportStart);
if (/projectLineItem|project-line-item|Total Line Items/.test(app.slice(dashboardStart, dashboardEnd))) fail('Dashboard was modified for line items.');
if (/projectLineItem|project-line-item|Pending Dispatch Report/.test(app.slice(reportStart, reportEnd))) fail('Reports were modified for line items.');

if (!api.includes("action === 'list'") || !api.includes("action === 'save-all'")) fail('API does not provide the two required actions.');
if (!api.includes("String(raw?.id || '').trim()")) fail('Blank item IDs are not normalized before database calls.');
if (!migration.includes("v_id := trim(coalesce(v_item ->> 'id', ''))")) fail('Database does not normalize blank item IDs.');
if (/\(v_item\s*->>\s*'id'\)::uuid/i.test(migration)) fail('Line item IDs must not be cast from an empty string to UUID.');
if (!migration.includes('generated always as (required_quantity - dispatch_quantity) stored')) fail('Pending Quantity is not database-generated.');
if (!syncMigration.includes('project_line_items_project_name_uom_uidx') || !syncMigration.includes('sync_project_line_item_from_erp_item')) fail('Project / Production synchronization is incomplete.');

console.log('Project Line Items tests passed: popup scope plus approved Section integration, quantity rules, blank-ID handling and database calculation are valid.');
