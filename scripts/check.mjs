import { access, readFile } from 'node:fs/promises';

const required = [
  'index.html',
  'netlify.toml',
  'netlify/functions/config.mjs',
  'netlify/functions/auth-admin.mjs',
  'supabase/001_auth_profiles.sql',
  'supabase/002_temporary_password_workflow.sql',
];
for (const file of required) await access(new URL(`../${file}`, import.meta.url));

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const fn = await readFile(new URL('../netlify/functions/auth-admin.mjs', import.meta.url), 'utf8');
if (!html.includes('supabase-js') || !html.includes('initialiseAuthentication')) throw new Error('Secure auth bundle is missing from index.html.');
if (!html.includes('Change Temporary Password') || !html.includes('Create New User')) throw new Error('Temporary-password UI is missing.');
if (!fn.includes("action === 'create'") || !fn.includes("action === 'reset-password'") || !fn.includes("action === 'change-own-password'")) throw new Error('Temporary-password Function actions are missing.');
if (/SUPABASE_SECRET_KEY\s*[:=]\s*['\"]sb_secret_/i.test(html)) throw new Error('Secret key appears in browser code.');
console.log('Project check passed: temporary passwords, forced password change, Netlify Functions, and Supabase migrations are present.');
