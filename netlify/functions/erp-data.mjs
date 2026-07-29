const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const ENTITY_TYPES = new Set(['projects', 'items', 'shortages', 'issues', 'audit', 'notifications']);
const UPSERT_PERMISSIONS = {
  ADMIN: new Set(ENTITY_TYPES),
  MANAGER: new Set(['projects', 'items', 'shortages', 'issues', 'audit', 'notifications']),
  EXECUTIVE: new Set(['items', 'shortages', 'issues', 'audit', 'notifications']),
};
const DELETE_PERMISSIONS = {
  ADMIN: new Set(ENTITY_TYPES),
  // Deleting a production item also removes its linked shortages and issues.
  MANAGER: new Set(['items', 'shortages', 'issues']),
  EXECUTIVE: new Set(),
};
const EXECUTIVE_ITEM_FIELDS = new Set([
  'id', 'projectId', 'itemName', 'rawItemName', 'site', 'size', 'quantity', 'quantitySource',
  'quantityVerified', 'bomPath', 'bomNumber', 'jobNumber', 'bomIssueDate', 'drawingIssueDate',
  'indentNumber', 'indentIssueDate', 'targetDate', 'createdAt', 'currentStage', 'currentStageName',
  'status', 'approvalStatus', 'shortages', 'remarks', 'updatedAt', 'history'
]);
const EXECUTIVE_MUTABLE_ITEM_FIELDS = new Set([
  'currentStage', 'currentStageName', 'status', 'approvalStatus', 'shortages', 'remarks', 'updatedAt', 'history'
]);
const WORKFLOW_PATCH_FIELDS = new Set([
  'currentStage', 'currentStageName', 'status', 'approvalStatus', 'shortages', 'remarks'
]);
const PRODUCTION_STAGES = [
  'PLANNING', 'MRN - STORES', 'CUTTING', 'FABRICATION', 'GRINDING',
  'PRE-COATING', 'POWDER COATING', 'ASSEMBLY', 'READY FOR DISPATCH'
];
const ITEM_STATUS_VALUES = new Set(['In Progress', 'Delayed', 'On Hold', 'Completed']);

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

async function readJson(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text }; }
}

function adminHeaders(secretKey, extra = {}) {
  return {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function sbFetch(url, secretKey, path, options = {}) {
  const res = await fetch(`${url}${path}`, {
    ...options,
    headers: adminHeaders(secretKey, options.headers || {}),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(data.message || data.error_description || data.error || `Supabase request failed (${res.status}).`);
  }
  return { data, headers: res.headers, status: res.status };
}

async function getProfile(url, secretKey, userId) {
  const { data } = await sbFetch(
    url,
    secretKey,
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,full_name,email,role,status&limit=1`,
    { method: 'GET' },
  );
  return Array.isArray(data) ? data[0] : null;
}

async function getCaller(request, url, publishableKey, secretKey) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) throw new Error('Missing authenticated session.');

  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
  });
  const user = await readJson(userRes);
  if (!userRes.ok || !user.id) throw new Error('Invalid or expired session.');

  const profile = await getProfile(url, secretKey, user.id);
  if (!profile) throw new Error('User profile not found.');
  if (String(profile.status).toUpperCase() !== 'ACTIVE') throw new Error('This account is not active.');
  return { user, profile, role: String(profile.role).toUpperCase() };
}

function cleanRecordId(value) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(id)) throw new Error('A record contains an invalid ID.');
  return id;
}

function validatePayload(payload, recordId) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Record payload must be an object.');
  const size = JSON.stringify(payload).length;
  if (size > 4500000) throw new Error(`Record ${recordId} is too large for database synchronization.`);
  return { ...payload, id: recordId };
}

function normalizeChanges(rawChanges = {}) {
  const normalized = {};
  let total = 0;
  for (const [entity, raw] of Object.entries(rawChanges || {})) {
    if (!ENTITY_TYPES.has(entity)) throw new Error(`Unsupported ERP entity: ${entity}`);
    const upsert = Array.isArray(raw?.upsert) ? raw.upsert : [];
    const remove = Array.isArray(raw?.delete) ? raw.delete : [];
    normalized[entity] = {
      upsert: upsert.map(record => {
        const recordId = cleanRecordId(record?.id);
        total += 1;
        return { recordId, payload: validatePayload(record, recordId) };
      }),
      delete: remove.map(id => {
        total += 1;
        return cleanRecordId(id);
      }),
    };
  }
  if (total > 1000) throw new Error('Too many records in one synchronization request.');
  return normalized;
}

function assertRolePermissions(caller, changes) {
  const upsertAllowed = UPSERT_PERMISSIONS[caller.role] || new Set();
  const deleteAllowed = DELETE_PERMISSIONS[caller.role] || new Set();
  for (const [entity, change] of Object.entries(changes)) {
    if (change.upsert.length && !upsertAllowed.has(entity)) throw new Error(`${caller.role} cannot modify ${entity}.`);
    if (change.delete.length && !deleteAllowed.has(entity)) throw new Error(`${caller.role} cannot delete ${entity}.`);
  }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function getExistingRecord(url, secretKey, entity, recordId) {
  const { data } = await sbFetch(
    url,
    secretKey,
    `/rest/v1/erp_records?entity_type=eq.${encodeURIComponent(entity)}&record_id=eq.${encodeURIComponent(recordId)}&select=payload&limit=1`,
    { method: 'GET' },
  );
  return Array.isArray(data) ? data[0]?.payload || null : null;
}

async function getExistingRecordRow(url, secretKey, entity, recordId) {
  const { data } = await sbFetch(
    url,
    secretKey,
    `/rest/v1/erp_records?entity_type=eq.${encodeURIComponent(entity)}&record_id=eq.${encodeURIComponent(recordId)}&select=payload,updated_at&limit=1`,
    { method: 'GET' },
  );
  return Array.isArray(data) ? data[0] || null : null;
}

function cleanText(value, maxLength, field) {
  const text = String(value ?? '').trim();
  if (text.length > maxLength) throw new HttpError(400, `${field} is too long.`);
  return text;
}

function normalizeWorkflowPatch(rawPatch = {}, callerRole) {
  if (!rawPatch || typeof rawPatch !== 'object' || Array.isArray(rawPatch)) throw new HttpError(400, 'Production workflow patch must be an object.');
  const patch = {};
  for (const [key, value] of Object.entries(rawPatch)) {
    if (!WORKFLOW_PATCH_FIELDS.has(key)) throw new HttpError(400, `Unsupported production workflow field: ${key}`);
    if (callerRole === 'EXECUTIVE' && !EXECUTIVE_MUTABLE_ITEM_FIELDS.has(key)) throw new HttpError(403, `Executives cannot change production item field: ${key}`);
    patch[key] = value;
  }
  if (!Object.keys(patch).length) throw new HttpError(400, 'No production workflow changes were supplied.');
  if ('currentStage' in patch) {
    const stage = Number(patch.currentStage);
    if (!Number.isInteger(stage) || stage < 0 || stage >= PRODUCTION_STAGES.length) throw new HttpError(400, 'Production item stage is invalid.');
    patch.currentStage = stage;
    patch.currentStageName = PRODUCTION_STAGES[stage];
  }
  if ('currentStageName' in patch && !PRODUCTION_STAGES.includes(String(patch.currentStageName))) throw new HttpError(400, 'Production stage name is invalid.');
  if ('status' in patch && !ITEM_STATUS_VALUES.has(String(patch.status))) throw new HttpError(400, 'Production status is invalid.');
  if ('approvalStatus' in patch && !['', 'SUBMITTED'].includes(String(patch.approvalStatus))) throw new HttpError(400, 'Production approval status is invalid.');
  if ('remarks' in patch) patch.remarks = cleanText(patch.remarks, 5000, 'Remarks');
  if ('shortages' in patch) patch.shortages = cleanText(patch.shortages, 5000, 'Shortages');
  return patch;
}

function normalizeWorkflowHistory(rawEvents = [], caller, nextPayload, now) {
  if (!Array.isArray(rawEvents)) throw new HttpError(400, 'Production history must be an array.');
  if (rawEvents.length > 10) throw new HttpError(400, 'Too many production history events in one update.');
  return rawEvents.map((event, index) => {
    if (!event || typeof event !== 'object' || Array.isArray(event)) throw new HttpError(400, `Production history event ${index + 1} is invalid.`);
    const stageIndex = Number(event.stageIndex ?? nextPayload.currentStage);
    if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex >= PRODUCTION_STAGES.length) throw new HttpError(400, `Production history event ${index + 1} has an invalid stage.`);
    const attachments = Array.isArray(event.attachments) ? event.attachments.slice(0, 4).map((file, fileIndex) => ({
      id: cleanRecordId(file?.id || `FIL-${Date.now()}-${index}-${fileIndex}`),
      name: cleanText(file?.name, 240, 'Attachment name'),
      type: cleanText(file?.type, 160, 'Attachment type'),
      size: Math.max(0, Number(file?.size || 0)),
      data: file?.data == null ? null : String(file.data),
    })) : [];
    return {
      id: cleanRecordId(event.id),
      stageIndex,
      stageName: PRODUCTION_STAGES[stageIndex],
      action: cleanText(event.action, 120, 'History action'),
      status: cleanText(event.status, 120, 'History status'),
      updatedBy: caller.user.id,
      updatedByName: caller.profile.full_name || caller.profile.email || caller.user.email || 'ERP User',
      date: now,
      remarks: cleanText(event.remarks, 5000, 'History remarks'),
      attachments,
    };
  });
}

function normalizeWorkflowSideEffects(raw = {}, caller, now) {
  const changes = {};
  const audits = Array.isArray(raw?.audit) ? raw.audit : [];
  const notifications = Array.isArray(raw?.notifications) ? raw.notifications : [];
  if (audits.length > 10 || notifications.length > 25) throw new HttpError(400, 'Too many workflow side effects in one update.');
  if (audits.length) {
    changes.audit = { upsert: audits.map(entry => {
      const recordId = cleanRecordId(entry?.id);
      return { recordId, payload: validatePayload({
        id: recordId,
        action: cleanText(entry?.action, 120, 'Audit action'),
        module: 'Production',
        details: cleanText(entry?.details, 2000, 'Audit details'),
        entityId: cleanText(entry?.entityId, 160, 'Audit entity ID'),
        userId: caller.user.id,
        userName: caller.profile.full_name || caller.profile.email || caller.user.email || 'ERP User',
        createdAt: now,
      }, recordId) };
    }), delete: [] };
  }
  if (notifications.length) {
    changes.notifications = { upsert: notifications.map(entry => {
      const recordId = cleanRecordId(entry?.id);
      return { recordId, payload: validatePayload({
        id: recordId,
        userId: cleanText(entry?.userId, 160, 'Notification user ID'),
        title: cleanText(entry?.title, 240, 'Notification title'),
        message: cleanText(entry?.message, 2000, 'Notification message'),
        type: cleanText(entry?.type || 'Info', 80, 'Notification type'),
        entityId: cleanText(entry?.entityId, 160, 'Notification entity ID'),
        read: false,
        createdAt: now,
      }, recordId) };
    }), delete: [] };
  }
  return changes;
}

async function updateItemWorkflow(url, secretKey, caller, body) {
  if (!['ADMIN', 'MANAGER', 'EXECUTIVE'].includes(caller.role)) throw new HttpError(403, 'Your role cannot update production stages.');
  const itemId = cleanRecordId(body.itemId);
  const row = await getExistingRecordRow(url, secretKey, 'items', itemId);
  if (!row?.payload) throw new HttpError(404, 'Production item was not found.');
  const expectedVersion = String(body.expectedVersion || '');
  const databaseVersion = String(row.updated_at || '');
  if (expectedVersion && expectedVersion !== databaseVersion) {
    throw new HttpError(409, 'This production item was updated by another user. The latest database value has been loaded.', { latestRecord: row.payload, latestVersion: databaseVersion });
  }

  const patch = normalizeWorkflowPatch(body.patch, caller.role);
  const now = new Date().toISOString();
  const basePayload = validatePayload(row.payload, itemId);
  const provisional = { ...basePayload, ...patch, id: itemId };
  const events = normalizeWorkflowHistory(body.historyEvents, caller, provisional, now);
  const nextPayload = validatePayload({
    ...provisional,
    history: [...(Array.isArray(basePayload.history) ? basePayload.history : []), ...events],
    updatedAt: now,
  }, itemId);

  const { data } = await sbFetch(
    url,
    secretKey,
    `/rest/v1/erp_records?entity_type=eq.items&record_id=eq.${encodeURIComponent(itemId)}&updated_at=eq.${encodeURIComponent(databaseVersion)}&select=payload,updated_at`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ payload: nextPayload, updated_by: caller.user.id }),
    },
  );
  if (!Array.isArray(data) || data.length !== 1) {
    const latest = await getExistingRecordRow(url, secretKey, 'items', itemId);
    throw new HttpError(409, 'This production item changed while your update was being saved. The latest database value has been loaded.', { latestRecord: latest?.payload || null, latestVersion: latest?.updated_at || '' });
  }

  const warnings = [];
  const sideEffects = normalizeWorkflowSideEffects(body.sideEffects, caller, now);
  if (Object.keys(sideEffects).length) {
    try { await applyChanges(url, secretKey, caller, sideEffects); }
    catch (error) { console.error('Workflow side-effect synchronization failed:', error?.message || error); warnings.push('The production item was saved, but an audit or notification record could not be written.'); }
  }
  return { record: data[0].payload, version: data[0].updated_at, warnings };
}

async function assertExecutiveItemUpdates(url, secretKey, caller, changes) {
  if (caller.role !== 'EXECUTIVE') return;
  for (const record of changes.items?.upsert || []) {
    const existing = await getExistingRecord(url, secretKey, 'items', record.recordId);

    // Executives may create production items, but only with the recognised production-item fields.
    if (!existing) {
      for (const key of Object.keys(record.payload)) {
        if (!EXECUTIVE_ITEM_FIELDS.has(key)) throw new Error(`Executives cannot set production item field: ${key}`);
      }
      if (!String(record.payload.projectId || '').trim()) throw new Error('A production item must belong to a project.');
      if (!String(record.payload.itemName || '').trim()) throw new Error('Production item name is required.');
      const stage = Number(record.payload.currentStage);
      if (!Number.isInteger(stage) || stage < 0 || stage > 8) throw new Error('Production item stage is invalid.');
      continue;
    }

    // After creation, Executives can update the production workflow fields only.
    for (const key of Object.keys(record.payload)) {
      if (!EXECUTIVE_ITEM_FIELDS.has(key)) throw new Error(`Executives cannot change production item field: ${key}`);
      if (!EXECUTIVE_MUTABLE_ITEM_FIELDS.has(key) && canonical(record.payload[key]) !== canonical(existing[key])) {
        throw new Error(`Executives cannot change production item field: ${key}`);
      }
    }
  }
}

async function upsertRows(url, secretKey, caller, entity, records) {
  if (!records.length) return;
  const now = new Date().toISOString();
  const rows = records.map(record => ({
    entity_type: entity,
    record_id: record.recordId,
    payload: record.payload,
    updated_by: caller.user.id,
    updated_at: now,
  }));
  await sbFetch(url, secretKey, '/rest/v1/erp_records?on_conflict=entity_type,record_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
}

function quotedInValue(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function deleteRows(url, secretKey, entity, ids) {
  const chunkSize = 100;
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const expression = chunk.map(quotedInValue).join(',');
    await sbFetch(
      url,
      secretKey,
      `/rest/v1/erp_records?entity_type=eq.${encodeURIComponent(entity)}&record_id=in.(${encodeURIComponent(expression)})`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
    );
  }
}

async function applyChanges(url, secretKey, caller, changes) {
  for (const [entity, change] of Object.entries(changes)) {
    await upsertRows(url, secretKey, caller, entity, change.upsert);
    await deleteRows(url, secretKey, entity, change.delete);
  }
}

function normalizeSeedRecords(records = []) {
  if (!Array.isArray(records)) throw new Error('Seed records must be an array.');
  if (records.length > 25000) throw new Error('The migration contains too many records.');
  const changes = {};
  for (const record of records) {
    const entity = String(record?.entityType || '');
    if (!ENTITY_TYPES.has(entity)) throw new Error(`Unsupported ERP entity: ${entity}`);
    const recordId = cleanRecordId(record?.recordId || record?.payload?.id);
    changes[entity] ||= { upsert: [], delete: [] };
    changes[entity].upsert.push({ recordId, payload: validatePayload(record.payload, recordId) });
  }
  return changes;
}

async function hasAnyOperationalRecord(url, secretKey) {
  const { data } = await sbFetch(url, secretKey, '/rest/v1/erp_records?select=record_id&limit=1', { method: 'GET' });
  return Array.isArray(data) && data.length > 0;
}


function normalizeBulkImportRecords(records = []) {
  if (!Array.isArray(records) || !records.length) throw new Error('Bulk import contains no records.');
  if (records.length > 25000) throw new Error('Bulk import contains more than 25,000 database records. Split the workbook and retry.');
  const seen = new Set();
  return records.map((record, index) => {
    const entityType = String(record?.entityType || '');
    if (!ENTITY_TYPES.has(entityType)) throw new Error(`Unsupported ERP entity in bulk import: ${entityType || `record ${index + 1}`}`);
    const recordId = cleanRecordId(record?.recordId || record?.payload?.id);
    const uniqueKey = `${entityType}:${recordId}`;
    if (seen.has(uniqueKey)) throw new Error(`Duplicate database record in bulk import: ${uniqueKey}`);
    seen.add(uniqueKey);
    const sourceRowValue = Number(record?.sourceRow);
    return {
      entityType,
      recordId,
      payload: validatePayload(record?.payload, recordId),
      sourceRow: Number.isFinite(sourceRowValue) && sourceRowValue > 0 ? Math.trunc(sourceRowValue) : null,
    };
  });
}

async function upsertMixedImportChunk(url, secretKey, caller, records) {
  if (!records.length) return { imported: 0, failures: [] };
  const now = new Date().toISOString();
  const rows = records.map(record => ({
    entity_type: record.entityType,
    record_id: record.recordId,
    payload: record.payload,
    updated_by: caller.user.id,
    updated_at: now,
  }));
  try {
    await sbFetch(url, secretKey, '/rest/v1/erp_records?on_conflict=entity_type,record_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });
    return { imported: records.length, failures: [] };
  } catch (error) {
    if (records.length === 1) {
      const record = records[0];
      return {
        imported: 0,
        failures: [{
          entityType: record.entityType,
          recordId: record.recordId,
          sourceRow: record.sourceRow,
          error: error?.message || 'Database insertion failed.',
        }],
      };
    }
    const middle = Math.ceil(records.length / 2);
    const left = await upsertMixedImportChunk(url, secretKey, caller, records.slice(0, middle));
    const right = await upsertMixedImportChunk(url, secretKey, caller, records.slice(middle));
    return { imported: left.imported + right.imported, failures: [...left.failures, ...right.failures] };
  }
}

async function bulkImportRecords(url, secretKey, caller, records) {
  const chunkSize = 250;
  let imported = 0;
  const failures = [];
  for (let index = 0; index < records.length; index += chunkSize) {
    const result = await upsertMixedImportChunk(url, secretKey, caller, records.slice(index, index + chunkSize));
    imported += result.imported;
    failures.push(...result.failures);
  }
  return { imported, failures };
}

export default async (request) => {
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });

  const supabaseUrl = env('SUPABASE_URL').replace(/\/$/, '');
  const publishableKey = env('SUPABASE_PUBLISHABLE_KEY', env('SUPABASE_ANON_KEY'));
  const secretKey = env('SUPABASE_SECRET_KEY', env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return response(500, { error: 'Supabase environment variables are not configured.' });
  }

  try {
    const caller = await getCaller(request, supabaseUrl, publishableKey, secretKey);
    const body = await request.json();
    const action = String(body.action || '');

    if (action === 'update-item-workflow') {
      const result = await updateItemWorkflow(supabaseUrl, secretKey, caller, body);
      return response(200, { ok: true, record: result.record, version: result.version, warnings: result.warnings });
    }

    if (action === 'sync') {
      const changes = normalizeChanges(body.changes);
      assertRolePermissions(caller, changes);
      await assertExecutiveItemUpdates(supabaseUrl, secretKey, caller, changes);
      await applyChanges(supabaseUrl, secretKey, caller, changes);
      return response(200, { ok: true });
    }

    if (action === 'bulk-import') {
      if (!['ADMIN', 'MANAGER'].includes(caller.role)) throw new Error('Only a Super Admin or Manager can run a bulk import.');
      const records = normalizeBulkImportRecords(body.records);
      const changesForPermissionCheck = {};
      for (const record of records) {
        changesForPermissionCheck[record.entityType] ||= { upsert: [], delete: [] };
        changesForPermissionCheck[record.entityType].upsert.push({ recordId: record.recordId, payload: record.payload });
      }
      assertRolePermissions(caller, changesForPermissionCheck);
      const result = await bulkImportRecords(supabaseUrl, secretKey, caller, records);
      return response(200, {
        ok: result.failures.length === 0,
        requested: records.length,
        imported: result.imported,
        failed: result.failures.length,
        failures: result.failures,
      });
    }

    if (action === 'seed-if-empty') {
      if (!['ADMIN', 'MANAGER'].includes(caller.role)) throw new Error('Only a Super Admin or Manager can migrate existing browser data.');
      if (await hasAnyOperationalRecord(supabaseUrl, secretKey)) {
        return response(409, { error: 'The shared ERP database already contains operational records.' });
      }
      const changes = normalizeSeedRecords(body.records);
      await applyChanges(supabaseUrl, secretKey, caller, changes);
      return response(201, { ok: true, migrated: body.records?.length || 0 });
    }

    return response(400, { error: 'Unsupported shared-data action.' });
  } catch (error) {
    const message = error?.message || 'Shared database operation failed.';
    const status = Number(error?.status) || (/session|active|permission|cannot|only/i.test(message) ? 403 : /not found/i.test(message) ? 404 : /invalid|required|unsupported|too many|too large/i.test(message) ? 400 : 500);
    console.error('ERP data function error:', message);
    return response(status, { error: message, ...(error?.details || {}) });
  }
};
