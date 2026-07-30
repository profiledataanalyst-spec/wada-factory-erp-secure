import assert from 'node:assert/strict';

const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
let item = {
  id: 'ITM-TEST-1',
  projectId: 'PRJ-TEST-1',
  itemName: 'Test production item',
  currentStage: 0,
  currentStageName: 'PLANNING',
  status: 'In Progress',
  approvalStatus: '',
  shortages: '',
  remarks: '',
  history: [],
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
};
let versionCounter = 0;
let version = '2026-07-30T00:00:00.000Z';
const mutations = new Map();

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

globalThis.fetch = async (resource, options = {}) => {
  const url = String(resource);
  if (url.endsWith('/auth/v1/user')) {
    return json(200, { id: '11111111-1111-4111-8111-111111111111', email: 'manager@example.com' });
  }
  if (url.includes('/rest/v1/profiles?')) {
    return json(200, [{
      id: '11111111-1111-4111-8111-111111111111',
      full_name: 'Manager Test',
      email: 'manager@example.com',
      role: 'MANAGER',
      status: 'ACTIVE',
    }]);
  }
  if (url.includes('/rest/v1/erp_records?') && url.includes('entity_type=eq.items')) {
    return json(200, [{ payload: structuredClone(item), updated_at: version }]);
  }
  if (url.endsWith('/rest/v1/rpc/apply_erp_changes')) {
    const body = JSON.parse(String(options.body || '{}'));
    if (mutations.has(body.p_request_id)) return json(200, { ...mutations.get(body.p_request_id), deduplicated: true });
    const change = body.p_changes?.items?.upsert?.[0];
    if (!change) return json(400, { message: 'Missing item change.' });
    if (change.expectedVersion && change.expectedVersion !== version) {
      return json(409, { message: 'ERP_CONFLICT|items|ITM-TEST-1', code: '40001' });
    }
    item = structuredClone(change.payload);
    versionCounter += 1;
    version = `2026-07-30T00:00:0${versionCounter}.000Z`;
    const result = {
      ok: true,
      requestId: body.p_request_id,
      versions: { items: { 'ITM-TEST-1': version } },
      deduplicated: false,
    };
    mutations.set(body.p_request_id, result);
    return json(200, result);
  }
  throw new Error(`Unexpected mocked request: ${url}`);
};

process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable-test-key';
process.env.SUPABASE_SECRET_KEY = 'secret-test-key';

try {
  console.error = () => {};
  const { default: handler } = await import('../netlify/functions/erp-data.mjs');
  const request = (requestId, expectedVersion, stage) => new Request('https://erp.example/api/erp-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer valid-test-token',
      'X-ERP-Request-ID': requestId,
    },
    body: JSON.stringify({
      action: 'update-item-workflow',
      requestId,
      itemId: item.id,
      expectedVersion,
      patch: { currentStage: stage, status: 'In Progress' },
      historyEvents: [{
        id: `HIS-${stage}`,
        stageIndex: stage,
        action: 'Stage Update',
        status: 'Updated',
        remarks: '',
        attachments: [],
      }],
      sideEffects: { audit: [], notifications: [] },
    }),
  });

  const first = await handler(request('WF-TEST-FIRST-0001', version, 1));
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.record.currentStage, 1);
  assert.equal(firstBody.version, version);

  const second = await handler(request('WF-TEST-SECOND-0002', firstBody.version, 2));
  assert.equal(second.status, 200);
  const secondBody = await second.json();
  assert.equal(secondBody.record.currentStage, 2);
  assert.equal(secondBody.version, version);
  assert.equal(item.currentStage, 2);

  const duplicate = await handler(request('WF-TEST-SECOND-0002', firstBody.version, 2));
  assert.equal(duplicate.status, 200, 'Retrying the same request ID must return the confirmed result without another write.');
  const duplicateBody = await duplicate.json();
  assert.equal(duplicateBody.deduplicated, true);
  assert.equal(duplicateBody.record.currentStage, 2);

  const stale = await handler(request('WF-TEST-STALE-0003', '2026-07-29T00:00:00.000Z', 3));
  assert.equal(stale.status, 409);
  const staleBody = await stale.json();
  assert.equal(staleBody.latestRecord.currentStage, 2);

  console.log('Stability test passed: two consecutive confirmed stage updates succeed and stale writes are rejected.');
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
}
