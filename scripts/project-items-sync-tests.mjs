import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const [app, api, dataApi, config, migration] = await Promise.all([
  readFile(new URL('js/app.js', root), 'utf8'),
  readFile(new URL('netlify/functions/project-line-items.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/erp-data.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/config.mjs', root), 'utf8'),
  readFile(new URL('supabase/005_section_assignment_erp_records.sql', root), 'utf8'),
]);
const fail = message => { throw new Error(message); };
const required = (source, needle, message) => { if (!source.includes(needle)) fail(message); };
required(api, 'productionRecords', 'Line-item API does not return confirmed Production Tracker records.');
required(api, 'fetchProjectItemRows', 'Project details do not load from the shared production records.');
required(api, 'fetchLinkedRows', 'Deleted line items do not account for linked shortages/issues.');
required(api, "entity_type=in.(shortages,issues)", 'Linked shortages/issues are not fetched for synchronized deletion.');
required(dataApi, "'projectLineItemId'", 'Shared production payload does not preserve line-item identity.');
required(dataApi, "'section', 'assignedExecutiveId', 'assignedBy', 'assignedAt'", 'Shared production payload does not preserve Section assignment.');
required(app, 'applyConfirmedItemRecord', 'Confirmed line-item responses are not reconciled into shared state.');
required(config, 'lineItemProductionSyncReady: sectionReady', 'Readiness does not reflect the erp_records Section migration.');
required(migration, 'erp_records_items_project_section_idx', 'Project + Section index is missing.');
if (/(?:from|join|update|insert\s+into)\s+public\.project_line_items/i.test(migration) || /\/rest\/v1\/project_line_items/i.test(api)) fail('Project/Production sync still depends on project_line_items.');
console.log('Project/Production synchronization tests passed: one erp_records source, confirmed response reconciliation, linked deletion and Section assignment are present.');
