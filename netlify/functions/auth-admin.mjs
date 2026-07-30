const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function response(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validPassword(value) {
  const password = String(value || '');
  return password.length >= 10
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
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

const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

class UpstreamError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function fetchWithPolicy(resource, options = {}, { retries = 0, timeoutMs = 15000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await fetch(resource, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (TRANSIENT_STATUSES.has(result.status) && attempt < retries) {
        await sleep(Math.min(2500, 250 * (2 ** attempt) + Math.floor(Math.random() * 150)));
        continue;
      }
      return result;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt >= retries) break;
      await sleep(Math.min(2500, 250 * (2 ** attempt) + Math.floor(Math.random() * 150)));
    }
  }
  if (lastError?.name === 'AbortError') throw new UpstreamError(504, 'Supabase request timed out.');
  throw new UpstreamError(503, lastError?.message || 'Supabase is temporarily unavailable.');
}

async function sbFetch(url, secretKey, path, options = {}) {
  const { retryable = false, timeoutMs = 15000, ...requestOptions } = options;
  const res = await fetchWithPolicy(`${url}${path}`, {
    ...requestOptions,
    headers: adminHeaders(secretKey, requestOptions.headers || {}),
  }, { retries: retryable ? 2 : 0, timeoutMs });
  const data = await readJson(res);
  if (!res.ok) {
    throw new UpstreamError(res.status, data.msg || data.message || data.error_description || data.error || `Supabase request failed (${res.status}).`, data);
  }
  return data;
}

async function getProfile(url, secretKey, userId) {
  const rows = await sbFetch(
    url,
    secretKey,
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,role,status,created_by,must_change_password&limit=1`,
    { method: 'GET', retryable: true },
  );
  return Array.isArray(rows) ? rows[0] : null;
}

async function getCaller(request, url, publishableKey, secretKey) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) throw new Error('Missing authenticated session.');

  const userRes = await fetchWithPolicy(`${url}/auth/v1/user`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
  }, { retries: 1, timeoutMs: 12000 });
  const user = await readJson(userRes);
  if (!userRes.ok || !user.id) throw new Error('Invalid or expired session.');

  const profile = await getProfile(url, secretKey, user.id);
  if (!profile) throw new Error('User profile not found.');
  if (String(profile.status).toUpperCase() === 'INACTIVE') throw new Error('This account is inactive.');
  return { user, profile, token };
}

async function requireUserManager(request, url, publishableKey, secretKey) {
  const caller = await getCaller(request, url, publishableKey, secretKey);
  const role = String(caller.profile.role).toUpperCase();
  if (!['ADMIN', 'MANAGER'].includes(role)) throw new Error('User Management permission is required.');
  return caller;
}

function assertCanCreate(caller, role) {
  const callerRole = String(caller.profile.role).toUpperCase();
  if (!['MANAGER', 'EXECUTIVE'].includes(role)) throw new Error('Role must be Manager or Executive.');
  if (callerRole === 'MANAGER' && role !== 'EXECUTIVE') {
    throw new Error('Managers can create Executive accounts only.');
  }
}

function assertCanManage(caller, target, desiredRole = '') {
  if (!target) throw new Error('Target user profile not found.');
  const callerRole = String(caller.profile.role).toUpperCase();
  const targetRole = String(target.role).toUpperCase();
  if (targetRole === 'ADMIN') throw new Error('The Super Admin account is protected.');

  if (callerRole === 'ADMIN') {
    if (desiredRole && !['MANAGER', 'EXECUTIVE'].includes(desiredRole)) throw new Error('Invalid role assignment.');
    return;
  }

  const createdByCaller = String(target.created_by || '') === String(caller.user.id);
  if (callerRole !== 'MANAGER' || targetRole !== 'EXECUTIVE' || !createdByCaller) {
    throw new Error('Managers can manage only Executive accounts they created.');
  }
  if (desiredRole && desiredRole !== 'EXECUTIVE') throw new Error('Managers cannot assign Manager or Super Admin roles.');
}

async function profileExists(url, secretKey) {
  const rows = await sbFetch(url, secretKey, '/rest/v1/profiles?select=id&limit=1', { method: 'GET', retryable: true });
  return Array.isArray(rows) && rows.length > 0;
}

async function insertProfile(url, secretKey, profile) {
  const rows = await sbFetch(url, secretKey, '/rest/v1/profiles', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    retryable: true,
    timeoutMs: 18000,
    body: JSON.stringify(profile),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function patchProfile(url, secretKey, userId, changes) {
  await sbFetch(url, secretKey, `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    retryable: true,
    timeoutMs: 18000,
    body: JSON.stringify(changes),
  });
}

async function updateAuthUser(url, secretKey, userId, changes) {
  return sbFetch(url, secretKey, `/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    retryable: true,
    timeoutMs: 18000,
    body: JSON.stringify(changes),
  });
}

async function deleteAuthUser(url, secretKey, userId) {
  await sbFetch(url, secretKey, `/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE', retryable: true, timeoutMs: 18000 });
}

export default async (request) => {
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });
  const headerRequestId = String(request.headers.get('x-erp-request-id') || '').trim();
  let bodyRequestId = headerRequestId;

  const supabaseUrl = env('SUPABASE_URL').replace(/\/$/, '');
  const publishableKey = env('SUPABASE_PUBLISHABLE_KEY', env('SUPABASE_ANON_KEY'));
  const secretKey = env('SUPABASE_SECRET_KEY', env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return response(500, { error: 'Supabase environment variables are not configured.' });
  }

  try {
    let body;
    try { body = await request.json(); }
    catch { throw new UpstreamError(400, 'Request body is invalid JSON.'); }
    bodyRequestId = String(body?.requestId || headerRequestId || '').trim();
    const action = String(body.action || '');

    if (action === 'bootstrap') {
      if (await profileExists(supabaseUrl, secretKey)) return response(409, { error: 'The first Super Admin has already been created.' });
      const fullName = String(body.fullName || '').trim();
      const email = cleanEmail(body.email);
      const password = String(body.password || '');
      if (!fullName || !email) return response(400, { error: 'Full name and email are required.' });
      if (!validPassword(password)) return response(400, { error: 'Password must have 10+ characters with uppercase, lowercase, number and special character.' });

      const created = await sbFetch(supabaseUrl, secretKey, '/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        }),
      });
      const user = created.user || created;
      try {
        await insertProfile(supabaseUrl, secretKey, {
          id: user.id,
          full_name: fullName,
          email,
          role: 'ADMIN',
          status: 'ACTIVE',
          must_change_password: false,
          activated_at: new Date().toISOString(),
        });
      } catch (error) {
        if (user.id) await deleteAuthUser(supabaseUrl, secretKey, user.id).catch(() => {});
        throw error;
      }
      return response(201, { ok: true });
    }

    if (action === 'change-own-password') {
      const caller = await getCaller(request, supabaseUrl, publishableKey, secretKey);
      const newPassword = String(body.newPassword || '');
      if (!validPassword(newPassword)) {
        return response(400, { error: 'Password must have 10+ characters with uppercase, lowercase, number and special character.' });
      }
      await updateAuthUser(supabaseUrl, secretKey, caller.user.id, { password: newPassword });
      await patchProfile(supabaseUrl, secretKey, caller.user.id, {
        status: 'ACTIVE',
        must_change_password: false,
        activated_at: new Date().toISOString(),
      });
      return response(200, { ok: true });
    }

    const caller = await requireUserManager(request, supabaseUrl, publishableKey, secretKey);

    if (action === 'create') {
      const fullName = String(body.fullName || '').trim();
      const email = cleanEmail(body.email);
      const role = String(body.role || '').toUpperCase();
      const temporaryPassword = String(body.temporaryPassword || '');
      if (!fullName || !email) return response(400, { error: 'Full name and email are required.' });
      assertCanCreate(caller, role);
      if (!validPassword(temporaryPassword)) {
        return response(400, { error: 'Temporary password must have 10+ characters with uppercase, lowercase, number and special character.' });
      }

      const created = await sbFetch(supabaseUrl, secretKey, '/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        }),
      });
      const user = created.user || created;
      try {
        await insertProfile(supabaseUrl, secretKey, {
          id: user.id,
          full_name: fullName,
          email,
          role,
          status: 'ACTIVE',
          must_change_password: true,
          created_by: caller.user.id,
          activated_at: new Date().toISOString(),
        });
      } catch (error) {
        if (user.id) await deleteAuthUser(supabaseUrl, secretKey, user.id).catch(() => {});
        throw error;
      }
      return response(201, { ok: true, userId: user.id });
    }

    if (action === 'update') {
      const userId = String(body.userId || '');
      const fullName = String(body.fullName || '').trim();
      const role = String(body.role || '').toUpperCase();
      const status = String(body.status || '').toUpperCase();
      if (!userId || !fullName) return response(400, { error: 'User and full name are required.' });
      if (!['ACTIVE', 'INACTIVE', 'INVITED'].includes(status)) return response(400, { error: 'Invalid user status.' });
      const target = await getProfile(supabaseUrl, secretKey, userId);
      assertCanManage(caller, target, role);

      await updateAuthUser(supabaseUrl, secretKey, userId, {
        user_metadata: { full_name: fullName },
      });
      await patchProfile(supabaseUrl, secretKey, userId, { full_name: fullName, role, status });
      return response(200, { ok: true });
    }

    if (action === 'reset-password') {
      const userId = String(body.userId || '');
      const temporaryPassword = String(body.temporaryPassword || '');
      if (!userId) return response(400, { error: 'User ID is required.' });
      if (!validPassword(temporaryPassword)) {
        return response(400, { error: 'Temporary password must have 10+ characters with uppercase, lowercase, number and special character.' });
      }
      const target = await getProfile(supabaseUrl, secretKey, userId);
      assertCanManage(caller, target);
      await updateAuthUser(supabaseUrl, secretKey, userId, { password: temporaryPassword });
      await patchProfile(supabaseUrl, secretKey, userId, {
        status: 'ACTIVE',
        must_change_password: true,
      });
      return response(200, { ok: true });
    }

    if (action === 'delete') {
      const userId = String(body.userId || '');
      if (!userId) return response(400, { error: 'User ID is required.' });
      if (userId === caller.user.id) return response(400, { error: 'You cannot delete your own signed-in account.' });
      const target = await getProfile(supabaseUrl, secretKey, userId);
      assertCanManage(caller, target);
      await deleteAuthUser(supabaseUrl, secretKey, userId);
      return response(200, { ok: true });
    }

    return response(400, { error: 'Unsupported authentication action.' });
  } catch (error) {
    const message = error?.message || 'Authentication action failed.';
    const upstreamStatus = Number(error?.status) || 0;
    const status = upstreamStatus === 401
      ? 401
      : upstreamStatus === 429
        ? 429
        : upstreamStatus >= 500
          ? upstreamStatus
          : /missing authenticated|invalid or expired session/i.test(message)
            ? 401
            : /permission|inactive|protected|Managers can/i.test(message)
              ? 403
              : 400;
    const requestId = bodyRequestId || headerRequestId || '';
    console.error('Authentication function error:', { status, message, requestId });
    return response(status, { error: message, requestId });
  }
};
