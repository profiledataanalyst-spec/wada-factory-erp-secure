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

async function sbFetch(url, secretKey, path, options = {}) {
  const res = await fetch(`${url}${path}`, {
    ...options,
    headers: adminHeaders(secretKey, options.headers || {}),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(data.msg || data.message || data.error_description || data.error || `Supabase request failed (${res.status}).`);
  }
  return data;
}

async function getProfile(url, secretKey, userId) {
  const rows = await sbFetch(
    url,
    secretKey,
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,role,status,created_by,must_change_password&limit=1`,
    { method: 'GET' },
  );
  return Array.isArray(rows) ? rows[0] : null;
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
  const rows = await sbFetch(url, secretKey, '/rest/v1/profiles?select=id&limit=1', { method: 'GET' });
  return Array.isArray(rows) && rows.length > 0;
}

async function insertProfile(url, secretKey, profile) {
  const rows = await sbFetch(url, secretKey, '/rest/v1/profiles', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(profile),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function patchProfile(url, secretKey, userId, changes) {
  await sbFetch(url, secretKey, `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(changes),
  });
}

async function updateAuthUser(url, secretKey, userId, changes) {
  return sbFetch(url, secretKey, `/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify(changes),
  });
}

async function deleteAuthUser(url, secretKey, userId) {
  await sbFetch(url, secretKey, `/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
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
    const body = await request.json();
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
    const message = error.message || 'Authentication action failed.';
    const status = /permission|required|session|inactive|protected|Managers can/i.test(message) ? 403 : 400;
    return response(status, { error: message });
  }
};
