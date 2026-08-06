import { spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';

function run(label, args) {
  console.log(`\n[${label}]`);
  const result = spawnSync(process.execPath, args, { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${label} failed.`);
}

run('Project structure audit', ['scripts/check.mjs']);
run('Data synchronization simulation', ['scripts/stability-tests.mjs']);
run('Project line-item tests', ['scripts/project-line-items-tests.mjs']);
run('Project/Production sync tests', ['scripts/project-items-sync-tests.mjs']);
run('Section assignment tests', ['scripts/section-assignment-tests.mjs']);

const root = new URL('../', import.meta.url);
const [htmlStat, jsStat, cssStat, js, api, sql] = await Promise.all([
  stat(new URL('index.html', root)),
  stat(new URL('js/app.js', root)),
  stat(new URL('css/styles.css', root)),
  readFile(new URL('js/app.js', root), 'utf8'),
  readFile(new URL('netlify/functions/project-line-items.mjs', root), 'utf8'),
  readFile(new URL('supabase/005_section_assignment_erp_records.sql', root), 'utf8'),
]);
const fullReloadCalls = (js.match(/loadOperationalData\(\{ renderAfter: true \}\)/g) || []).length;
if (/(?:alter\s+table|from|join|update|insert\s+into)\s+public\.project_line_items|\/rest\/v1\/project_line_items/i.test(`${api}\n${sql}`)) {
  throw new Error('Architecture audit failed: missing project_line_items table is still referenced.');
}
console.log(`Asset audit: index ${htmlStat.size} bytes; JavaScript ${jsStat.size} bytes; CSS ${cssStat.size} bytes.`);
console.log(`Network audit: ${fullReloadCalls} explicit authoritative full-reload path(s); normal Realtime changes remain incremental.`);
console.log('Technical audit passed. Live Supabase migration and deployed multi-browser role verification are still required.');
