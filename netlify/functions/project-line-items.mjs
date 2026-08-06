const SECTIONS = ['Aluminium', 'Store', 'Fabrication', 'Outsource'];
const PRODUCTION_STAGES = [
  'PLANNING', 'CUTTING', 'FABRICATION', 'GRINDING',
  'PRE-COATING', 'POWDER COATING', 'READY FOR DISPATCH',
];

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

class HttpError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function response(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function adminHeaders(secretKey, extra = {}) {
  const headers = { apikey: secretKey, 'Content-Type': 'application/json', ...extra };
  if (!String(secretKey || '').startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${secretKey}`;
  }
  return headers;
}

async function readJson(result) {
  const text = await result.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { return { message: text }; }
}

async function fetchWithTimeout(resource, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(resource, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new HttpError(504, 'The database request timed out. Please retry.');
    throw new HttpError(503, error?.message || 'The database is temporarily unavailable.');
  } finally {
    clearTimeout(timer);
  }
}

async function sbFetch(url, secretKey, path, options = {}) {
  const result = await fetchWithTimeout(`${url}${path}`, {
    ...options,
    headers: adminHeaders(secretKey, options.headers || {}),
  }, options.timeoutMs || 20000);
  const data = await readJson(result);
  if (!result.ok) {
    const message = data.message || data.error_description || data.error || `Supabase request failed (${result.status}).`;
    throw new HttpError(result.status, message, data);
  }
  return data;
}

async function getCaller(request, url, publishableKey, secretKey) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) throw new HttpError(401, 'Missing authenticated session.');

  const userResult = await fetchWithTimeout(`${url}/auth/v1/user`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
  }, 12000);
  const user = await readJson(userResult);
  if (!userResult.ok || !user.id) throw new HttpError(401, 'Invalid or expired session.');

  const profiles = await sbFetch(
    url,
    secretKey,
    `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,full_name,email,role,status,created_by&limit=1`,
    { method: 'GET', timeoutMs: 12000 },
  );
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profile) throw new HttpError(403, 'User profile not found.');
  if (String(profile.status || '').toUpperCase() !== 'ACTIVE') throw new HttpError(403, 'This account is not active.');
  return { user, profile, role: String(profile.role || '').toUpperCase() };
}

function cleanRecordId(value, label = 'Record ID') {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(id)) throw new HttpError(400, `${label} is invalid.`);
  return id;
}

function cleanRequestId(value) {
  const requestId = String(value || '').trim() || `PLI-${crypto.randomUUID()}`;
  if (!/^[A-Za-z0-9_.:-]{8,160}$/.test(requestId)) throw new HttpError(400, 'Request ID is invalid.');
  return requestId;
}

function canonicalSection(value) {
  const raw = String(value || '').trim().toLowerCase();
  return SECTIONS.find(section => section.toLowerCase() === raw) || '';
}

function cleanQuantity(value, label) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) throw new HttpError(400, `${label} must be a valid number.`);
  return quantity;
}

function normalizeItems(items) {
  if (!Array.isArray(items)) throw new HttpError(400, 'Line items must be an array.');
  if (items.length > 1000) throw new HttpError(400, 'A project cannot save more than 1,000 line items in one request.');
  const ids = new Set();
  return items.map((raw, index) => {
    const suppliedId = String(raw?.id || '').trim();
    const id = suppliedId ? cleanRecordId(suppliedId, `Line item ${index + 1} ID`) : `ITM-${crypto.randomUUID()}`;
    if (ids.has(id)) throw new HttpError(400, `Duplicate line item ID found at row ${index + 1}.`);
    ids.add(id);

    const lineItemName = String(raw?.lineItemName || '').trim();
    if (!lineItemName) throw new HttpError(400, `Line Item Name is required at row ${index + 1}.`);
    if (lineItemName.length > 300) throw new HttpError(400, `Line Item Name is too long at row ${index + 1}.`);

    const section = canonicalSection(raw?.section);
    if (!section) throw new HttpError(400, `Section must be Aluminium, Store, Fabrication or Outsource at row ${index + 1}.`);

    const uom = String(raw?.uom || 'Nos.').trim();
    if (!uom) throw new HttpError(400, `UOM is required at row ${index + 1}.`);
    if (uom.length > 40) throw new HttpError(400, `UOM is too long at row ${index + 1}.`);

    const requiredQuantity = cleanQuantity(raw?.requiredQuantity, `Required Quantity at row ${index + 1}`);
    const dispatchQuantity = cleanQuantity(raw?.dispatchQuantity ?? 0, `Dispatch Quantity at row ${index + 1}`);
    if (requiredQuantity <= 0) throw new HttpError(400, `Required Quantity must be greater than zero at row ${index + 1}.`);
    if (dispatchQuantity < 0) throw new HttpError(400, `Dispatch Quantity cannot be negative at row ${index + 1}.`);
    if (dispatchQuantity > requiredQuantity) throw new HttpError(400, `Dispatch Quantity cannot exceed Required Quantity at row ${index + 1}.`);

    return { id, lineItemName, section, uom, requiredQuantity, dispatchQuantity };
  });
}

function mapRecord(row) {
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
  const requiredQuantity = Number(payload.quantity || 0);
  const dispatchQuantity = Number(payload.dispatchQuantity || 0);
  return {
    id: String(row.record_id || payload.id || ''),
    projectId: String(payload.projectId || ''),
    lineItemName: String(payload.itemName || payload.lineItemName || ''),
    section: canonicalSection(payload.section),
    assignedExecutiveId: String(payload.assignedExecutiveId || ''),
    uom: String(payload.uom || 'Nos.'),
    requiredQuantity,
    dispatchQuantity,
    pendingQuantity: Number.isFinite(Number(payload.pendingQuantity))
      ? Number(payload.pendingQuantity)
      : Math.max(0, requiredQuantity - dispatchQuantity),
    createdAt: payload.createdAt || row.created_at || '',
    updatedAt: payload.updatedAt || row.updated_at || '',
    version: row.updated_at || '',
  };
}

async function getProject(url, secretKey, projectId) {
  const rows = await sbFetch(
    url,
    secretKey,
    `/rest/v1/erp_records?entity_type=eq.projects&record_id=eq.${encodeURIComponent(projectId)}&select=record_id,payload,updated_at&limit=1`,
    { method: 'GET', timeoutMs: 12000 },
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function assertProjectAccess(url, secretKey, caller, projectId, write = false) {
  const project = await getProject(url, secretKey, projectId);
  if (!project) throw new HttpError(404, 'Project was not found.');
  if (!write) return project;
  if (caller.role === 'ADMIN') return project;
  if (caller.role !== 'MANAGER') throw new HttpError(403, 'Only a Super Admin or Manager can manage project line items.');
  if (String(project.payload?.managerId || '') !== String(caller.user.id)) {
    throw new HttpError(403, 'Managers can add items only to projects assigned to them.');
  }
  return project;
}

async function fetchProjectItemRows(url, secretKey, projectId) {
  const rows = await sbFetch(
    url,
    secretKey,
    `/rest/v1/erp_records?entity_type=eq.items&payload->>projectId=eq.${encodeURIComponent(projectId)}&select=record_id,payload,created_at,updated_at&order=created_at.asc,record_id.asc`,
    { method: 'GET', timeoutMs: 20000 },
  );
  return Array.isArray(rows) ? rows : [];
}

async function fetchLinkedRows(url, secretKey, projectId) {
  const rows = await sbFetch(
    url,
    secretKey,
    `/rest/v1/erp_records?entity_type=in.(shortages,issues)&payload->>projectId=eq.${encodeURIComponent(projectId)}&select=entity_type,record_id,payload,updated_at`,
    { method: 'GET', timeoutMs: 20000 },
  );
  return Array.isArray(rows) ? rows : [];
}

async function listItems(url, secretKey, caller, projectId) {
  await assertProjectAccess(url, secretKey, caller, projectId, false);
  const rows = await fetchProjectItemRows(url, secretKey, projectId);
  return rows.map(mapRecord);
}

function lineItemPayload(item, existingPayload, projectPayload, caller, now) {
  const existing = existingPayload && typeof existingPayload === 'object' ? existingPayload : {};
  const sectionChanged = canonicalSection(existing.section) && canonicalSection(existing.section) !== item.section;
  const currentStage = Number.isInteger(Number(existing.currentStage)) ? Number(existing.currentStage) : 0;
  const currentStageName = PRODUCTION_STAGES[currentStage] || PRODUCTION_STAGES[0];
  const createdAt = existing.createdAt || now;
  const history = Array.isArray(existing.history) ? existing.history : [];
  const initialHistory = existing.id ? history : [{
    id: `HIS-${crypto.randomUUID()}`,
    stageIndex: 0,
    stageName: PRODUCTION_STAGES[0],
    action: 'Created',
    status: 'In Progress',
    updatedBy: caller.user.id,
    updatedByName: caller.profile.full_name || caller.profile.email || caller.user.email || 'ERP User',
    date: now,
    remarks: 'Production item created from Projects Add Items.',
    attachments: [],
  }];

  return {
    ...existing,
    id: item.id,
    projectId: String(projectPayload?.id || existing.projectId || ''),
    projectLineItemId: item.id,
    itemName: item.lineItemName,
    rawItemName: item.lineItemName,
    section: item.section,
    assignedExecutiveId: sectionChanged ? '' : String(existing.assignedExecutiveId || ''),
    assignedBy: sectionChanged ? '' : String(existing.assignedBy || ''),
    assignedAt: sectionChanged ? '' : String(existing.assignedAt || ''),
    uom: item.uom,
    quantity: item.requiredQuantity,
    dispatchQuantity: item.dispatchQuantity,
    pendingQuantity: Math.max(0, item.requiredQuantity - item.dispatchQuantity),
    quantitySource: existing.quantitySource || 'Projects Add Items',
    quantityVerified: true,
    site: existing.site || projectPayload?.site || '',
    jobNumber: existing.jobNumber || projectPayload?.jobNumber || '',
    targetDate: existing.targetDate || projectPayload?.targetDate || '',
    priority: existing.priority || projectPayload?.priority || 'Medium',
    currentStage,
    currentStageName,
    status: existing.status || 'In Progress',
    approvalStatus: existing.approvalStatus || '',
    shortages: existing.shortages || '',
    remarks: existing.remarks || '',
    createdAt,
    updatedAt: now,
    history: initialHistory,
  };
}

async function applyChanges(url, secretKey, caller, changes, requestId) {
  try {
    return await sbFetch(url, secretKey, '/rest/v1/rpc/apply_erp_changes', {
      method: 'POST',
      timeoutMs: 35000,
      body: JSON.stringify({
        p_request_id: requestId,
        p_actor: caller.user.id,
        p_changes: changes,
      }),
    });
  } catch (error) {
    const message = error?.message || '';
    if (/apply_erp_changes|function .* does not exist|schema cache/i.test(message)) {
      throw new HttpError(503, 'The ERP stability migration is not installed. Run supabase/004_stability_performance.sql.');
    }
    if (/ERP_CONFLICT\|/i.test(message) || error?.details?.code === '40001') {
      throw new HttpError(409, 'One or more project items changed in another browser. Reload the popup and retry.');
    }
    throw error;
  }
}

async function saveAll(url, secretKey, caller, projectId, items, requestId) {
  const projectRow = await assertProjectAccess(url, secretKey, caller, projectId, true);
  const existingRows = await fetchProjectItemRows(url, secretKey, projectId);
  const existingById = new Map(existingRows.map(row => [String(row.record_id), row]));
  const incomingIds = new Set(items.map(item => item.id));
  const deletedRows = existingRows.filter(row => !incomingIds.has(String(row.record_id)));
  const deletedIds = new Set(deletedRows.map(row => String(row.record_id)));
  const linkedRows = deletedIds.size ? await fetchLinkedRows(url, secretKey, projectId) : [];
  const now = new Date().toISOString();

  const changes = {
    items: {
      upsert: items.map(item => {
        const existingRow = existingById.get(item.id);
        return {
          recordId: item.id,
          payload: lineItemPayload(item, existingRow?.payload, { ...projectRow.payload, id: projectId }, caller, now),
          expectedVersion: existingRow?.updated_at || '',
        };
      }),
      delete: deletedRows.map(row => ({ recordId: String(row.record_id), expectedVersion: row.updated_at || '' })),
    },
  };

  for (const entityType of ['shortages', 'issues']) {
    const removals = linkedRows
      .filter(row => row.entity_type === entityType && deletedIds.has(String(row.payload?.itemId || '')))
      .map(row => ({ recordId: String(row.record_id), expectedVersion: row.updated_at || '' }));
    if (removals.length) changes[entityType] = { upsert: [], delete: removals };
  }

  await applyChanges(url, secretKey, caller, changes, requestId);
  const confirmedRows = await fetchProjectItemRows(url, secretKey, projectId);
  return {
    records: confirmedRows.map(mapRecord),
    productionRecords: confirmedRows.map(row => ({ ...(row.payload || {}), id: String(row.record_id) })),
    updatedItems: items.length,
    deletedItems: deletedRows.length,
  };
}

function normalizeAssignments(assignments) {
  if (!Array.isArray(assignments)) throw new HttpError(400, 'Section assignments must be an array.');
  if (assignments.length > SECTIONS.length) throw new HttpError(400, 'Too many section assignments were supplied.');
  const seen = new Set();
  return assignments.map((raw, index) => {
    const section = canonicalSection(raw?.section);
    if (!section) throw new HttpError(400, `Section assignment ${index + 1} is invalid.`);
    if (seen.has(section)) throw new HttpError(400, `Duplicate assignment supplied for ${section}.`);
    seen.add(section);
    const executiveId = String(raw?.executiveId || '').trim();
    if (executiveId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(executiveId)) {
      throw new HttpError(400, `Executive ID for ${section} is invalid.`);
    }
    return { section, executiveId };
  });
}

async function assignSections(url, secretKey, caller, projectId, assignments, requestId) {
  await assertProjectAccess(url, secretKey, caller, projectId, true);
  try {
    const result = await sbFetch(url, secretKey, '/rest/v1/rpc/assign_project_sections', {
      method: 'POST',
      timeoutMs: 30000,
      body: JSON.stringify({
        p_project_id: projectId,
        p_assignments: assignments,
        p_actor: caller.user.id,
        p_request_id: requestId,
      }),
    });
    return result && typeof result === 'object' ? result : { updatedItems: 0, productionRecords: [] };
  } catch (error) {
    if (/assign_project_sections|function .* does not exist|schema cache/i.test(error?.message || '')) {
      throw new HttpError(503, 'Section Assignment migration is not installed. Run supabase/005_section_assignment_erp_records.sql.');
    }
    throw error;
  }
}

export default async request => {
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });
  let requestId = String(request.headers.get('x-erp-request-id') || '').trim();
  const supabaseUrl = env('SUPABASE_URL').replace(/\/$/, '');
  const publishableKey = env('SUPABASE_PUBLISHABLE_KEY', env('SUPABASE_ANON_KEY'));
  const secretKey = env('SUPABASE_SECRET_KEY', env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return response(500, { error: 'Supabase environment variables are not configured.' });
  }

  try {
    const caller = await getCaller(request, supabaseUrl, publishableKey, secretKey);
    let body;
    try { body = await request.json(); }
    catch { throw new HttpError(400, 'Request body is invalid JSON.'); }
    requestId = cleanRequestId(body?.requestId || requestId);
    const action = String(body?.action || '').trim().toLowerCase();
    const projectId = cleanRecordId(body?.projectId, 'Project ID');

    if (action === 'list') {
      const records = await listItems(supabaseUrl, secretKey, caller, projectId);
      return response(200, { ok: true, records, requestId });
    }

    if (action === 'assign-sections') {
      const assignments = normalizeAssignments(body?.assignments);
      const result = await assignSections(supabaseUrl, secretKey, caller, projectId, assignments, requestId);
      return response(200, { ok: true, ...result, requestId });
    }

    if (action === 'save-all') {
      const items = normalizeItems(body?.items);
      const result = await saveAll(supabaseUrl, secretKey, caller, projectId, items, requestId);
      return response(200, { ok: true, ...result, requestId });
    }

    throw new HttpError(400, 'Unsupported Project Line Items action.');
  } catch (error) {
    let message = error?.message || 'Project line item operation failed.';
    let status = Number(error?.status) || 500;
    if (/invalid input syntax for type uuid/i.test(message)) {
      status = 400;
      message = 'A user reference was invalid. The request was rejected without saving partial data.';
    }
    if (/Section must be|Line Item|Quantity|UOM|Request ID|Project ID|invalid/i.test(message) && status >= 500) status = 400;
    console.error('Project line items function error', { status, message, requestId });
    return response(status, { error: message, requestId, ...(error?.details || {}) });
  }
};
