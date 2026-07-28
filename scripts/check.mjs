import { access, readFile } from 'node:fs/promises';
const required = ['index.html','netlify.toml','netlify/functions/config.mjs','netlify/functions/auth-admin.mjs','supabase/001_auth_profiles.sql'];
for (const file of required) await access(new URL(`../${file}`, import.meta.url));
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
if (!html.includes('supabase-js') || !html.includes('initialiseAuthentication')) throw new Error('Secure auth bundle is missing from index.html.');
console.log('Project check passed: secure frontend, Netlify Functions, and Supabase migration are present.');
