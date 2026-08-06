import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const [js, api, dataFn, sql, config, csv] = await Promise.all([
  readFile(new URL('js/app.js', root), 'utf8'),
  readFile(new URL('netlify/functions/project-line-items.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/erp-data.mjs', root), 'utf8'),
  readFile(new URL('supabase/005_section_assignment_erp_records.sql', root), 'utf8'),
  readFile(new URL('netlify/functions/config.mjs', root), 'utf8'),
  readFile(new URL('MASTER_SHEET_TEMPLATE.csv', root), 'utf8'),
]);
const fail = message => { throw new Error(message); };
const required = (source, needle, message) => { if (!source.includes(needle)) fail(message); };
for (const section of ['Aluminium', 'Store', 'Fabrication', 'Outsource']) {
  if (!js.includes(section) || !api.includes(section) || !sql.includes(section)) fail(`${section} is not integrated across client, API and database.`);
}
if (!csv.startsWith('PROJECT NAME,ITEM NAME,SECTION,')) fail('CSV template SECTION column is not in the required position.');
required(js, "getCol(r,'SECTION')", 'Bulk upload does not read Section.');
required(js, 'SECTION is invalid', 'Bulk upload Section validation is missing.');
required(js, "String(item.assignedExecutiveId || '') === user.id", 'Executive item visibility is not assigned-only.');
required(js, 'renderExecutiveDashboard', 'Executive dashboard is missing.');
required(js, 'renderSectionSummary', 'Factory Overview Section Summary is missing.');
required(js, 'item-section', 'Production Tracker Section filter is missing.');
required(js, 'report-section', 'Reports Section filter is missing.');
required(api, "action === 'assign-sections'", 'Protected assignment API action is missing.');
required(sql, "v_role not in ('ADMIN', 'MANAGER')", 'Database role enforcement is missing.');
required(sql, 'Managers may assign only Executives they manage.', 'Manager/Executive scope enforcement is missing.');
required(sql, 'erp_mutation_log', 'Assignment idempotency is missing.');
required(sql, 'section_assignment_status', 'Migration readiness function is missing.');
required(dataFn, "'section', 'assignedExecutiveId', 'assignedBy', 'assignedAt'", 'Shared data fields are incomplete.');
required(dataFn, 'Executives can update only production items assigned to their account.', 'Backend assigned-only Executive update enforcement is missing.');
required(config, "applicationVersion: '11.3.1'", 'Application version is not 11.3.1.');
required(config, "sectionAssignmentMode: sections?.mode", 'Corrected Section architecture is not reported.');
if (/(?:alter\s+table|from|join|update|insert\s+into)\s+public\.project_line_items|\/rest\/v1\/project_line_items/i.test(`${api}\n${sql}\n${config}`)) fail('Section implementation references the missing project_line_items table.');
console.log('Section assignment tests passed: upload validation, erp_records persistence, protected assignment, assigned-only Executive work, dashboards, filters, reports and readiness checks are linked.');
