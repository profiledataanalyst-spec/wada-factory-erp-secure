import { spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';

function run(label, args) {
  const result = spawnSync(process.execPath, args, { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status !== 0) throw new Error(`${label} failed.`);
}

run('Project structure audit', ['scripts/check.mjs']);
run('Data synchronization simulation', ['scripts/stability-tests.mjs']);
run('Client syntax check', ['--check', 'js/app.js']);
run('ERP Function syntax check', ['--check', 'netlify/functions/erp-data.mjs']);
run('Authentication Function syntax check', ['--check', 'netlify/functions/auth-admin.mjs']);
run('Configuration Function syntax check', ['--check', 'netlify/functions/config.mjs']);

const [htmlStat, jsStat, cssStat, js] = await Promise.all([
  stat(new URL('../index.html', import.meta.url)),
  stat(new URL('../js/app.js', import.meta.url)),
  stat(new URL('../css/styles.css', import.meta.url)),
  readFile(new URL('../js/app.js', import.meta.url), 'utf8'),
]);
const fullReloadCalls = (js.match(/loadOperationalData\(\{ renderAfter: true \}\)/g) || []).length;
console.log(`Asset audit: index ${htmlStat.size} bytes; JavaScript ${jsStat.size} bytes; CSS ${cssStat.size} bytes.`);
console.log(`Network audit: ${fullReloadCalls} explicit authoritative full-reload path(s); normal Realtime changes are incremental.`);
console.log('Technical audit passed. Live Supabase migration and deployed multi-browser verification are still required.');
