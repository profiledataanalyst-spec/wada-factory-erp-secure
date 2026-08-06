const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithPolicy(resource, options = {}, { retries = 2, timeoutMs = 10000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(resource, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (TRANSIENT_STATUSES.has(response.status) && attempt < retries) {
        await sleep(Math.min(2000, 200 * (2 ** attempt) + Math.floor(Math.random() * 120)));
        continue;
      }
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt >= retries) break;
      await sleep(Math.min(2000, 200 * (2 ** attempt) + Math.floor(Math.random() * 120)));
    }
  }
  if (lastError?.name === 'AbortError') throw new Error('Supabase configuration check timed out.');
  throw new Error(lastError?.message || 'Supabase configuration check failed.');
}

function adminHeaders(secretKey, extra = {}) {
  const headers = { apikey: secretKey, ...extra };
  // Current sb_secret_* keys are opaque API keys and must not be sent as JWTs.
  // Legacy service_role JWT keys continue to use the Authorization header.
  if (!String(secretKey || '').startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${secretKey}`;
  }
  return headers;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { return null; }
}

async function tableAvailable(url, secretKey, table, selectColumn) {
  const response = await fetchWithPolicy(`${url}/rest/v1/${table}?select=${selectColumn}&limit=1`, {
    headers: adminHeaders(secretKey, { Accept: 'application/json' }),
  });
  const data = await readJson(response);
  if (response.ok) return { available: true, rows: Array.isArray(data) ? data : [] };
  const detail = JSON.stringify(data || {});
  if ([400, 404].includes(response.status) && /does not exist|schema cache|column .* not found/i.test(detail)) {
    return { available: false, rows: [] };
  }
  throw new Error(`Unable to read ${table} (${response.status}).`);
}

async function sectionStatus(url, secretKey) {
  const response = await fetchWithPolicy(`${url}/rest/v1/rpc/section_assignment_status`, {
    method: 'POST',
    headers: adminHeaders(secretKey, {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: '{}',
  });
  const data = await readJson(response);
  if (response.ok && data && typeof data === 'object') return data;
  const detail = JSON.stringify(data || {});
  if ([400, 404].includes(response.status) && /does not exist|schema cache|section_assignment_status/i.test(detail)) {
    return {
      ready: false,
      storage: 'erp_records',
      mode: 'erp-records-section-to-executive-single-source',
      allowedSections: ['Aluminium', 'Store', 'Fabrication', 'Outsource'],
    };
  }
  throw new Error(`Unable to check Section Assignment migration (${response.status}).`);
}

export default async () => {
  try {
    const supabaseUrl = env('SUPABASE_URL').replace(/\/$/, '');
    const publishableKey = env('SUPABASE_PUBLISHABLE_KEY', env('SUPABASE_ANON_KEY'));
    const secretKey = env('SUPABASE_SECRET_KEY', env('SUPABASE_SERVICE_ROLE_KEY'));
    if (!supabaseUrl || !publishableKey || !secretKey) {
      return new Response(JSON.stringify({
        error: 'Missing SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY in hosting environment variables.',
      }), { status: 500, headers: JSON_HEADERS });
    }

    const [profiles, records, mutationLog, sections] = await Promise.all([
      tableAvailable(supabaseUrl, secretKey, 'profiles', 'id'),
      tableAvailable(supabaseUrl, secretKey, 'erp_records', 'record_id'),
      tableAvailable(supabaseUrl, secretKey, 'erp_mutation_log', 'request_id'),
      sectionStatus(supabaseUrl, secretKey),
    ]);

    const sectionReady = Boolean(sections?.ready && records.available && mutationLog.available);
    return new Response(JSON.stringify({
      supabaseUrl,
      supabasePublishableKey: publishableKey,
      setupRequired: profiles.available ? profiles.rows.length === 0 : true,
      authenticationMode: 'temporary-password',
      dataStorage: 'supabase-postgresql',
      realtimeMode: 'incremental-postgres-changes',
      sharedDataReady: records.available,
      stabilityMigrationReady: mutationLog.available,
      lineItemProductionSyncReady: sectionReady,
      sectionAssignmentReady: sectionReady,
      sectionAssignmentMode: sections?.mode || 'erp-records-section-to-executive-single-source',
      sectionStorage: sections?.storage || 'erp_records',
      allowedSections: sections?.allowedSections || ['Aluminium', 'Store', 'Fabrication', 'Outsource'],
      applicationVersion: '11.3.1',
      procurementItemPermissions: 'admin-manager-full-executive-create-and-stage-update',
      procurementStageSync: 'database-confirmed-atomic-idempotent-realtime',
      bulkUploadMode: 'validated-atomic-supabase-import',
      architectureMode: 'single-source-atomic-resilient',
    }), { status: 200, headers: JSON_HEADERS });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Configuration failed.' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
};
