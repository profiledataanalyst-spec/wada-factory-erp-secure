import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const requiredFiles = [
  'index.html', 'css/styles.css', 'js/app.js', 'ERP_Bulk_Upload_Template.xlsx', 'MASTER_SHEET_TEMPLATE.csv',
  'netlify.toml', '_redirects', 'netlify/functions/config.mjs', 'netlify/functions/auth-admin.mjs',
  'netlify/functions/erp-data.mjs', 'netlify/functions/project-line-items.mjs',
  'supabase/001_auth_profiles.sql', 'supabase/002_temporary_password_workflow.sql',
  'supabase/003_shared_operational_data.sql', 'supabase/004_stability_performance.sql',
  'supabase/005_section_assignment_erp_records.sql',
  'scripts/stability-tests.mjs', 'scripts/project-line-items-tests.mjs',
  'scripts/project-items-sync-tests.mjs', 'scripts/section-assignment-tests.mjs',
  'SECTION_ASSIGNMENT_IMPLEMENTATION.md', 'REDEPLOY_V11.3.1.md',
];

for (const path of requiredFiles) await access(new URL(path, root));

const [html, app, api, dataApi, config, sectionSql, csv, pkg] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('js/app.js', root), 'utf8'),
  readFile(new URL('netlify/functions/project-line-items.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/erp-data.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/config.mjs', root), 'utf8'),
  readFile(new URL('supabase/005_section_assignment_erp_records.sql', root), 'utf8'),
  readFile(new URL('MASTER_SHEET_TEMPLATE.csv', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8'),
]);

const fail = message => { throw new Error(message); };
const required = (source, needle, message) => { if (!source.includes(needle)) fail(message); };

required(app, "const APP_VERSION = '11.3.1'", 'Client version is not 11.3.1.');
required(config, "applicationVersion: '11.3.1'", 'Configuration version is not 11.3.1.');
required(pkg, '"version": "11.3.1"', 'Package version is not 11.3.1.');
required(html, 'css/styles.css?v=11.3.1', 'CSS cache version is not 11.3.1.');
required(html, 'js/app.js?v=11.3.1', 'JavaScript cache version is not 11.3.1.');

for (const section of ['Aluminium', 'Store', 'Fabrication', 'Outsource']) {
  required(app, section, `${section} is missing from the client.`);
  required(api, section, `${section} is missing from the protected line-item API.`);
  required(sectionSql, section, `${section} is missing from the database migration.`);
}
required(csv, 'PROJECT NAME,ITEM NAME,SECTION,', 'CSV bulk template does not include SECTION in the required position.');
required(app, "getCol(r,'SECTION')", 'Excel parser does not read SECTION.');
required(app, 'renderSectionSummary', 'Factory Overview Section Summary is missing.');
required(app, 'renderExecutiveDashboard', 'Executive assigned-work dashboard is missing.');
required(app, "String(item.assignedExecutiveId || '') === user.id", 'Executive assigned-only item filtering is missing.');
required(app, 'data-assign-section-project', 'Section assignment action is missing from Projects.');
required(app, 'report-section', 'Section report filter is missing.');
required(app, "headers:['Project','Item','Section'", 'Section is missing from production reports.');

required(api, '/rest/v1/erp_records?', 'Project line items API does not use erp_records.');
required(api, "'/rest/v1/rpc/apply_erp_changes'", 'Project line item saves are not atomic/idempotent.');
required(api, "'/rest/v1/rpc/assign_project_sections'", 'Protected Section assignment RPC is not used.');
required(dataApi, "'section', 'assignedExecutiveId', 'assignedBy', 'assignedAt'", 'Shared-data API does not preserve Section assignment fields.');
required(dataApi, 'Executives can update only production items assigned to their account.', 'Backend assigned-only Executive update enforcement is missing.');
required(config, "section_assignment_status", 'Configuration does not check the corrected Section migration.');
required(config, "sectionAssignmentMode: sections?.mode", 'Configuration does not expose Section assignment mode.');
required(sectionSql, 'public.erp_records', 'Section migration does not use the ERP single source of truth.');
required(sectionSql, 'public.assign_project_sections', 'Section assignment database function is missing.');
required(sectionSql, 'public.section_assignment_status', 'Section migration readiness function is missing.');
required(sectionSql, 'erp_records_items_project_section_idx', 'Section database indexes are incomplete.');
required(sectionSql, 'Managers may assign only Executives they manage.', 'Manager assignment enforcement is missing.');
required(sectionSql, 'Duplicate Section assignment supplied', 'Duplicate Section assignment validation is missing.');

const runtimeSources = `${api}\n${config}\n${sectionSql}`;
if (/(?:alter\s+table|from|join|update|insert\s+into)\s+public\.project_line_items|\/rest\/v1\/project_line_items|save_project_line_items_with_sections/i.test(runtimeSources)) {
  fail('Runtime or migration still depends on the nonexistent project_line_items table.');
}

for (const file of ['js/app.js', 'netlify/functions/config.mjs', 'netlify/functions/erp-data.mjs', 'netlify/functions/project-line-items.mjs']) {
  const result = spawnSync(process.execPath, ['--check', new URL(file, root).pathname], { encoding: 'utf8' });
  if (result.status !== 0) fail(`${file} syntax check failed:\n${result.stderr}`);
}

console.log('Project check passed: Profile Solutions ERP v11.3.1 uses erp_records-only Section bulk upload, protected Section assignment, assigned-only Executive work, Section dashboards, filters, reports and realtime shared data.');
