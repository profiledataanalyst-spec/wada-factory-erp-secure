const SECTIONS = ['Aluminium', 'Store', 'Fabrication', 'Outsource'];

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
    `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,full_name,email,role,status&limit=1`,
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
    const id = String(raw?.id || '').trim();
    const normalizedId = id ? cleanRecordId(id, `Line item ${index + 1} ID`) : '';
    if (normalizedId && ids.has(normalizedId)) throw new HttpError(400, `Duplicate line item ID found at row ${index + 1}.`);
    if (normalizedId) ids.add(normalizedId);
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
    return { id: normalizedId, lineItemName, section, uom, requiredQuantity, dispatchQuantity };
  });
}

function mapRecord(row) {
  return {
    id: String(row.id || ''),
    projectId: String(row.project_id || ''),
    lineItemName: String(row.line_item_name || ''),
    section: canonicalSection(row.section),
    assignedExecutiveId: String(row.assigned_executive_id || ''),
    uom: String(row.uom || 'Nos.'),
    requiredQuantity: Number(row.required_quantity || 0),
    dispatchQuantity: Number(row.dispatch_quantity || 0),
    pendingQuantity: Number(row.pending_quantity || 0),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

async function assertProjectAccess(url, secretKey, caller, projectId, write = false) {
  const rows = await sbFetch(
    url,
    secretKey,
    `/rest/v1/erp_records?entity_type=eq.projects&record_id=eq.${encodeURIComponent(projectId)}&select=record_id,payload&limit=1`,
    { method: 'GET', timeoutMs: 12000 },
  );
  const project = Array.isArray(rows) ? rows[0] : null;
  if (!project) throw new HttpError(404, 'Project was not found.');
  if (!write) return project;
  if (caller.role === 'ADMIN') return project;
  if (caller.role !== 'MANAGER') throw new HttpError(403, 'Only a Super Admin or Manager can manage project line items.');
  if (String(project.payload?.managerId || '') !== String(caller.user.id)) {
    throw new HttpError(403, 'Managers can add items only to projects assigned to them.');
  }
  return project;
}

async function listItems(url, secretKey, caller, projectId) {
  await assertProjectAccess(url, secretKey, caller, projectId, false);
  const rows = await sbFetch(
    url,
    secretKey,
    `/rest/v1/project_line_items?project_id=eq.${encodeURIComponent(projectId)}&select=id,project_id,line_item_name,section,assigned_executive_id,uom,required_quantity,dispatch_quantity,pending_quantity,created_at,updated_at&order=created_at.asc`,
    { method: 'GET', timeoutMs: 18000 },
  );
  return Array.isArray(rows) ? rows.map(mapRecord) : [];
}

async function saveAll(url, secretKey, caller, projectId, items, requestId) {
  await assertProjectAccess(url, secretKey, caller, projectId, true);
  const result = await sbFetch(url, secretKey, '/rest/v1/rpc/save_project_line_items_with_sections', {
    method: 'POST',
    timeoutMs: 30000,
    body: JSON.stringify({
      p_project_id: projectId,
      p_items: items,
      p_actor: caller.user.id,
      p_request_id: requestId,
    }),
  });
  const records = Array.isArray(result?.records) ? result.records.map(record => ({
    id: String(record.id || ''),
    projectId: String(record.projectId || projectId),
    lineItemName: String(record.lineItemName || ''),
    section: canonicalSection(record.section),
    assignedExecutiveId: String(record.assignedExecutiveId || ''),
    uom: String(record.uom || 'Nos.'),
    requiredQuantity: Number(record.requiredQuantity || 0),
    dispatchQuantity: Number(record.dispatchQuantity || 0),
    pendingQuantity: Number(record.pendingQuantity || 0),
    createdAt: record.createdAt || '',
    updatedAt: record.updatedAt || '',
  })) : [];
  const productionRecords = Array.isArray(result?.productionRecords) ? result.productionRecords.map(record => ({ ...record })) : [];
  return { ...result, records, productionRecords };
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
    if (executiveId && !/^[0-9a-f-]{36}$/i.test(executiveId)) throw new HttpError(400, `Executive ID for ${section} is invalid.`);
    return { section, executiveId };
  });
}

async function assignSections(url, secretKey, caller, projectId, assignments, requestId) {
  await assertProjectAccess(url, secretKey, caller, projectId, true);
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
    if (/save_project_line_items_batch|project_line_items|schema cache|does not exist/i.test(message)) {
      if (/does not exist|schema cache|function/i.test(message)) {
        status = 503;
        message = 'Project Line Items migration is not installed. Run supabase/010_project_items_production_sync.sql.';
      }
    }
    if (/invalid input syntax for type uuid/i.test(message)) {
      status = 400;
      message = 'A user reference was invalid. The request was rejected without saving any partial data.';
    }
    console.error('Project line items function error', { status, message, requestId });
    return response(status, { error: message, requestId, ...(error?.details || {}) });
  }
};
