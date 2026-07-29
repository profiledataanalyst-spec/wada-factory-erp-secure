const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

async function hasAnyProfile(url, secretKey) {
  const response = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Unable to read profiles table (${response.status}): ${text.slice(0, 180)}`);
  }
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function hasSharedDataTable(url, secretKey) {
  const response = await fetch(`${url}/rest/v1/erp_records?select=record_id&limit=1`, {
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      Accept: 'application/json',
    },
  });
  return response.ok;
}

export default async () => {
  try {
    const supabaseUrl = env('SUPABASE_URL').replace(/\/$/, '');
    const publishableKey = env('SUPABASE_PUBLISHABLE_KEY', env('SUPABASE_ANON_KEY'));
    const secretKey = env('SUPABASE_SECRET_KEY', env('SUPABASE_SERVICE_ROLE_KEY'));
    if (!supabaseUrl || !publishableKey || !secretKey) {
      return new Response(JSON.stringify({
        error: 'Missing SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY in Netlify environment variables.',
      }), { status: 500, headers: JSON_HEADERS });
    }

    const setupRequired = !(await hasAnyProfile(supabaseUrl, secretKey));
    const sharedDataReady = await hasSharedDataTable(supabaseUrl, secretKey);
    return new Response(JSON.stringify({
      supabaseUrl,
      supabasePublishableKey: publishableKey,
      setupRequired,
      authenticationMode: 'temporary-password',
      dataStorage: 'supabase-postgresql',
      realtimeMode: 'postgres-changes',
      sharedDataReady,
      applicationVersion: '10.1.0',
      productionItemPermissions: 'admin-manager-full-executive-create-and-stage-update',
      bulkUploadMode: 'validated-supabase-import',
    }), { status: 200, headers: JSON_HEADERS });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Configuration failed.' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
};
