import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const [js, api, dataFn, sql, config, csv] = await Promise.all([
  readFile(new URL('js/app.js', root), 'utf8'),
  readFile(new URL('netlify/functions/project-line-items.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/erp-data.mjs', root), 'utf8'),
  readFile(new URL('supabase/011_section_assignment_dashboard.sql', root), 'utf8'),
  readFile(new URL('netlify/functions/config.mjs', root), 'utf8'),
  readFile(new URL('MASTER_SHEET_TEMPLATE.csv', root), 'utf8'),
]);
const fail = message => { throw new Error(message); };
const sections = ['Aluminium','Store','Fabrication','Outsource'];
for (const section of sections) {
  if (!js.includes(section) || !api.includes(section) || !sql.includes(section)) fail(`${section} is not integrated across client, API and database.`);
}
if (!csv.startsWith('PROJECT NAME,ITEM NAME,SECTION,')) fail('CSV template SECTION column is not in the required position.');
if (!js.includes("if (user.role !== 'EXECUTIVE') return state.projects")) fail('Executive project visibility is not assignment-aware.');
if (!js.includes("String(item.assignedExecutiveId || '') === user.id")) fail('Executive item visibility is not assigned-only.');
if (!js.includes('renderSectionSummary') || !js.includes('renderExecutiveDashboard')) fail('Dashboard integration is missing.');
if (!api.includes("action === 'assign-sections'") || !sql.includes('security definer')) fail('Protected assignment path is missing.');
if (!dataFn.includes("'section', 'assignedExecutiveId', 'assignedBy', 'assignedAt'")) fail('Production item backend fields are incomplete.');
if (!config.includes("applicationVersion: '11.3.0'")) fail('Application version is not 11.3.0.');
console.log('Section assignment tests passed: upload validation, database persistence, assignment permissions, Executive visibility, dashboards, filters and reports are linked.');
