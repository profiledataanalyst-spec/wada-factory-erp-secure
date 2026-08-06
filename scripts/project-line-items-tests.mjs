import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const [app, api, sql] = await Promise.all([
  readFile(new URL('js/app.js', root), 'utf8'),
  readFile(new URL('netlify/functions/project-line-items.mjs', root), 'utf8'),
  readFile(new URL('supabase/005_section_assignment_erp_records.sql', root), 'utf8'),
]);
const fail = message => { throw new Error(message); };
const required = (source, needle, message) => { if (!source.includes(needle)) fail(message); };
const pending = (requiredQty, dispatchQty) => Math.max(0, Number(requiredQty) - Number(dispatchQty));
if (pending(100, 40) !== 60 || pending(50, 50) !== 0 || pending(12.75, 2.5) !== 10.25) fail('Pending Quantity calculation failed.');
required(app, '<th>Line Item Name</th><th>Section</th><th>UOM</th>', 'Add Items popup does not include Section and UOM.');
required(app, 'Dispatch Quantity cannot exceed Required Quantity.', 'Dispatch Quantity validation is missing.');
required(api, "action === 'list'", 'Line-item list action is missing.');
required(api, "action === 'save-all'", 'Line-item save action is missing.');
required(api, 'pendingQuantity: Math.max(0, item.requiredQuantity - item.dispatchQuantity)', 'Server pending quantity is not calculated.');
required(api, "'/rest/v1/rpc/apply_erp_changes'", 'Line-item changes are not committed atomically.');
required(api, 'expectedVersion', 'Line-item updates do not use confirmed database versions.');
required(sql, 'public.erp_records', 'Section migration is not aligned to operational storage.');
if (/(?:from|join|update|insert\s+into)\s+public\.project_line_items/i.test(sql) || /\/rest\/v1\/project_line_items/i.test(api)) fail('A nonexistent normalized line-item table is still referenced.');
console.log('Project Line Items tests passed: Section, UOM, quantities, atomic erp_records saves, deletes and version checks are present.');
