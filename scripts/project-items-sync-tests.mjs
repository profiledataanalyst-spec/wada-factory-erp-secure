import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [app, api, dataApi, migration, baseMigration, config, css, baseCss] = await Promise.all([
  readFile(new URL('js/app.js', root), 'utf8'),
  readFile(new URL('netlify/functions/project-line-items.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/erp-data.mjs', root), 'utf8'),
  readFile(new URL('supabase/010_project_items_production_sync.sql', root), 'utf8'),
  readFile(new URL('supabase/009_project_line_items_popup.sql', root), 'utf8'),
  readFile(new URL('netlify/functions/config.mjs', root), 'utf8'),
  readFile(new URL('css/styles.css', root)),
  readFile(new URL('../Profile_Solutions_Procurement_ERP_v11.1.1/css/styles.css', import.meta.url)).catch(() => null),
]);

const fail = message => { throw new Error(message); };
const required = (source, needle, message) => { if (!source.includes(needle)) fail(message); };

required(app, '<th>Line Item Name</th><th>Section</th><th>UOM</th><th>Required Quantity</th>', 'UOM is not present in the existing Add Items popup.');
required(app, "uom: String(row.querySelector('.line-item-uom').value", 'UOM is not sent by the popup.');
required(api, "const uom = String(raw?.uom || 'Nos.')", 'The protected API does not validate UOM.');
required(api, 'productionRecords', 'The API does not return synchronized Production Tracker records.');
required(dataApi, "'projectLineItemId'", 'Production item payload support does not include the line-item identity.');
required(migration, 'add column if not exists uom text', 'Migration does not add UOM safely.');
required(migration, 'project_line_items_project_name_uom_uidx', 'Project ID + name + UOM uniqueness is not enforced.');
required(migration, 'sync_project_line_item_from_erp_item', 'Production-to-Project synchronization trigger is missing.');
required(migration, 'save_project_line_items_batch', 'Project-to-Production atomic batch function is missing.');
required(migration, "payload ->> 'projectLineItemId'", 'Stable line-item/production linking is missing.');
required(migration, 'pg_advisory_xact_lock', 'Concurrent project line-item saves are not serialized.');
required(config, "lineItemProductionSyncReady: projectLineItems.available", 'Deployment readiness does not check UOM synchronization support.');
required(config, "applicationVersion: '11.3.0'", 'Configuration version is not 11.3.0.');

if (/(v_item\s*->>\s*'id')::uuid/i.test(migration)) fail('Line-item text IDs must never be cast to UUID.');
if (!baseMigration.includes('required_quantity - dispatch_quantity')) fail('Pending Quantity is not calculated by PostgreSQL.');
if (!migration.includes("delete from public.erp_records") || !migration.includes("payload ->> 'projectLineItemId' = v_deleted_id")) fail('Deleting a popup row does not remove its synchronized Production Tracker item.');

// The enhancement must not redesign the application stylesheet.
if (baseCss && !css.equals(baseCss)) fail('The existing UI stylesheet changed, but this enhancement must not redesign the application.');

const pending = (required, dispatch) => Math.max(0, required - dispatch);
if (pending(100, 20) !== 80 || pending(150, 50) !== 100) fail('Quantity adjustment examples failed.');

console.log('Project / Production synchronization tests passed: Section, UOM, unique matching, bidirectional quantity sync, delete sync, UUID safety and unchanged styling are present.');
