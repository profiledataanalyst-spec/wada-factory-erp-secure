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
  return password.length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
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

async function getCaller(request, url, publishableKey, secretKey) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) throw new Error('Missing authenticated session.');

  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
  });
  const user = await readJson(userRes);
  if (!userRes.ok || !user.id) throw new Error('Invalid or expired session.');

  const profiles = await sbFetch(url, secretKey, `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,role,status&limit=1`, {
    method: 'GET',
  });
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profile) throw new Error('User profile not found.');
  if (String(profile.status).toUpperCase() === 'INACTIVE') throw new Error('This account is inactive.');
  return { user, profile, token };
}

async function requireAdmin(request, url, publishableKey, secretKey) {
  const caller = await getCaller(request, url, publishableKey, secretKey);
  if (String(caller.profile.role).toUpperCase() !== 'ADMIN') throw new Error('Super Admin permission is required.');
  return caller;
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

async function deleteAuthUser(url, secretKey, userId) {
  await sbFetch(url, secretKey, `/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

export default async (request) => {
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });

  const supabaseUrl = env('SUPABASE_URL').replace(/\/$/, '');
  const publishableKey = env('SUPABASE_PUBLISHABLE_KEY', env('SUPABASE_ANON_KEY'));
  const secretKey = env('SUPABASE_SECRET_KEY', env('SUPABASE_SERVICE_ROLE_KEY'));
  const appUrl = env('APP_URL', env('URL', new URL(request.url).origin)).replace(/\/$/, '');
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
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
      });
      const user = created.user || created;
      try {
        await insertProfile(supabaseUrl, secretKey, {
          id: user.id,
          full_name: fullName,
          email,
          role: 'ADMIN',
          status: 'ACTIVE',
          activated_at: new Date().toISOString(),
        });
      } catch (error) {
        if (user.id) await deleteAuthUser(supabaseUrl, secretKey, user.id).catch(() => {});
        throw error;
      }
      return response(201, { ok: true });
    }

    if (action === 'activate') {
      const caller = await getCaller(request, supabaseUrl, publishableKey, secretKey);
      await sbFetch(supabaseUrl, secretKey, `/rest/v1/profiles?id=eq.${encodeURIComponent(caller.user.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'ACTIVE', activated_at: new Date().toISOString() }),
      });
      return response(200, { ok: true });
    }

    const caller = await requireAdmin(request, supabaseUrl, publishableKey, secretKey);

    if (action === 'invite') {
      const fullName = String(body.fullName || '').trim();
      const email = cleanEmail(body.email);
      const role = String(body.role || '').toUpperCase();
      if (!fullName || !email) return response(400, { error: 'Full name and email are required.' });
      if (!['MANAGER', 'EXECUTIVE'].includes(role)) return response(400, { error: 'Role must be Manager or Executive.' });
      const redirectTo = `${appUrl}/?auth=invite`;
      const invited = await sbFetch(supabaseUrl, secretKey, `/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: 'POST',
        body: JSON.stringify({ email, data: { full_name: fullName, role } }),
      });
      const user = invited.user || invited;
      try {
        await insertProfile(supabaseUrl, secretKey, {
          id: user.id,
          full_name: fullName,
          email,
          role,
          status: 'INVITED',
          invited_by: caller.user.id,
          invited_at: new Date().toISOString(),
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
      if (!['MANAGER', 'EXECUTIVE'].includes(role)) return response(400, { error: 'Only Manager and Executive roles can be assigned here.' });
      if (!['INVITED', 'ACTIVE', 'INACTIVE'].includes(status)) return response(400, { error: 'Invalid user status.' });
      await sbFetch(supabaseUrl, secretKey, `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ full_name: fullName, role, status }),
      });
      return response(200, { ok: true });
    }

    if (action === 'delete') {
      const userId = String(body.userId || '');
      if (!userId) return response(400, { error: 'User ID is required.' });
      if (userId === caller.user.id) return response(400, { error: 'You cannot delete your own signed-in account.' });
      await deleteAuthUser(supabaseUrl, secretKey, userId);
      return response(200, { ok: true });
    }

    return response(400, { error: 'Unsupported authentication action.' });
  } catch (error) {
    const message = error.message || 'Authentication action failed.';
    const status = /permission|required|session|inactive/i.test(message) ? 403 : 400;
    return response(status, { error: message });
  }
};
