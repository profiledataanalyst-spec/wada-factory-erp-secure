import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
let callerRole = 'EXECUTIVE';
let callerId = '11111111-1111-4111-8111-111111111111';
let storedItem = {
  id: 'ITM-SECTION-1',
  projectId: 'PRJ-SECTION-1',
  itemName: 'Fabrication frame',
  section: 'Fabrication',
  assignedExecutiveId: '22222222-2222-4222-8222-222222222222',
  assignedExecutiveName: 'Other Executive',
  assignedById: '33333333-3333-4333-8333-333333333333',
  assignedByName: 'Manager',
  assignedAt: '2026-08-06T10:00:00.000Z',
  dueDate: '2026-08-20',
  priority: 'High',
  currentStage: 0,
  currentStageName: 'PLANNING',
  status: 'In Progress',
  approvalStatus: '',
  shortages: '',
  remarks: '',
  history: [],
};
let storedVersion = '2026-08-06T10:00:00.000Z';
let lastRpcBody = null;

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

globalThis.fetch = async (resource, options = {}) => {
  const url = String(resource);
  if (url.endsWith('/auth/v1/user')) return json(200, { id: callerId, email: 'user@example.com' });
  if (url.includes('/rest/v1/profiles?')) {
    return json(200, [{ id: callerId, full_name: callerRole === 'MANAGER' ? 'Manager Test' : 'Executive Test', email: 'user@example.com', role: callerRole, status: 'ACTIVE' }]);
  }
  if (url.includes('/rest/v1/erp_records?') && url.includes('entity_type=eq.items')) {
    return json(200, [{ payload: structuredClone(storedItem), updated_at: storedVersion }]);
  }
  if (url.endsWith('/rest/v1/rpc/apply_erp_changes')) {
    lastRpcBody = JSON.parse(String(options.body || '{}'));
    const itemChange = lastRpcBody.p_changes?.items?.upsert?.[0];
    if (itemChange) {
      storedItem = structuredClone(itemChange.payload);
      storedVersion = '2026-08-06T10:01:00.000Z';
    }
    return json(200, { ok: true, requestId: lastRpcBody.p_request_id, versions: { items: { [storedItem.id]: storedVersion } }, deduplicated: false });
  }
  throw new Error(`Unexpected mocked request: ${url}`);
};

process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable-test-key';
process.env.SUPABASE_SECRET_KEY = 'secret-test-key';

try {
  console.error = () => {};
  const { default: handler } = await import('../netlify/functions/erp-data.mjs');

  const workflowRequest = () => new Request('https://erp.example/api/erp-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token', 'X-ERP-Request-ID': 'WF-SECTION-ACCESS-0001' },
    body: JSON.stringify({
      action: 'update-item-workflow', requestId: 'WF-SECTION-ACCESS-0001', itemId: storedItem.id,
      expectedVersion: storedVersion, patch: { currentStage: 1, status: 'In Progress' },
      historyEvents: [{ id: 'HIS-SECTION-1', stageIndex: 1, action: 'Stage Update', status: 'Updated', remarks: '', attachments: [] }],
      sideEffects: { audit: [], notifications: [] },
    }),
  });

  const denied = await handler(workflowRequest());
  assert.equal(denied.status, 403, 'An Executive must not update another Executive\'s task.');

  callerRole = 'MANAGER';
  callerId = '33333333-3333-4333-8333-333333333333';
  const invalidImport = await handler(new Request('https://erp.example/api/erp-data', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify({ action: 'bulk-import', requestId: 'IMP-SECTION-BAD-0001', records: [{ entityType: 'items', recordId: 'ITM-BAD-1', sourceRow: 2, payload: { id: 'ITM-BAD-1', projectId: 'PRJ-1', itemName: 'Bad section', section: 'Painting' } }] }),
  }));
  assert.equal(invalidImport.status, 400, 'Invalid Section values must be rejected.');
  const invalidBody = await invalidImport.json();
  assert.match(invalidBody.error, /Allowed values: Aluminium, Store, Fabrication, Outsource/);

  const validImport = await handler(new Request('https://erp.example/api/erp-data', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify({ action: 'bulk-import', requestId: 'IMP-SECTION-GOOD-0001', records: [{ entityType: 'items', recordId: 'ITM-GOOD-1', sourceRow: 2, payload: { id: 'ITM-GOOD-1', projectId: 'PRJ-1', itemName: 'Aluminium rail', section: 'aluminium', priority: 'Medium', dueDate: '2026-08-25' } }] }),
  }));
  assert.equal(validImport.status, 200);
  assert.equal(lastRpcBody.p_changes.items.upsert[0].payload.section, 'Aluminium', 'Section should be stored using the canonical database value.');


  const clientSource = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(clientSource, /Items with no Section \(set Section and assign\)/, 'Legacy items without Section must have an explicit recovery assignment scope.');
  assert.match(clientSource, /matchingAssignmentTargets/, 'Section assignment must calculate matching items before saving.');
  assert.doesNotMatch(clientSource, /id=\"add-item\"/, 'The manual Add Item button must not be rendered.');
  assert.doesNotMatch(clientSource, /document\.getElementById\('add-item'\)/, 'The removed Add Item control must not be bound.');

  console.log('Section assignment tests passed: invalid values rejected, canonical Section stored, legacy unsectioned tasks can be recovered, Add Item is removed, and Executives are blocked from other users\' tasks.');
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
}
