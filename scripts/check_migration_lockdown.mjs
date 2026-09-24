// Static check: every table created by a standalone migration must either enable RLS in its own file or
// be listed in supabase/zz-public-schema-lockdown-standalone.sql. Supabase grants new public-schema tables
// to the anon/authenticated roles by default, and the anon key ships in the browser bundle — a table
// with RLS off is readable/writable by anyone who opens devtools. This check guards against that.
//   node scripts/check_migration_lockdown.mjs            → verify (exit 1 on gaps)
//   node scripts/check_migration_lockdown.mjs --print    → print the table list for the lockdown file
import fs from 'node:fs';
import path from 'node:path';

const dir = 'supabase';
const LOCKDOWN = 'zz-public-schema-lockdown-standalone.sql';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('-standalone.sql') && f !== LOCKDOWN);
const created = new Map(); const rlsOn = new Set();
for (const f of files) {
  const sql = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_0-9]+)/gi)) created.set(m[1].toLowerCase(), f);
  for (const m of sql.matchAll(/ALTER TABLE\s+([a-z_0-9]+)\s+ENABLE ROW LEVEL SECURITY/gi)) rlsOn.add(m[1].toLowerCase());
}
const all = [...created.keys()].sort();
if (process.argv.includes('--print')) { console.log(all.map((t) => `    '${t}'`).join(',\n')); process.exit(0); }

const lock = fs.existsSync(path.join(dir, LOCKDOWN)) ? fs.readFileSync(path.join(dir, LOCKDOWN), 'utf8') : '';
const listed = new Set([...lock.matchAll(/^\s*'([a-z_0-9]+)'/gim)].map((m) => m[1]));
const noRls = all.filter((t) => !rlsOn.has(t));
const uncovered = all.filter((t) => !listed.has(t));
console.log(`${all.length} tables created across ${files.length} migrations; ${noRls.length} enable RLS nowhere in their own file; ${listed.size} covered by the lockdown file.`);
let bad = 0;
for (const t of uncovered) { console.log(`FAIL — ${t} (${created.get(t)}) is not in ${LOCKDOWN}`); bad++; }
if (!lock.includes('FORCE') && !/ENABLE ROW LEVEL SECURITY/.test(lock)) { console.log('FAIL — lockdown file does not enable RLS'); bad++; }
if (!/REVOKE ALL ON/.test(lock)) { console.log('FAIL — lockdown file does not revoke anon privileges'); bad++; }
if (!bad) console.log('PASS — every migration-created table is RLS-enabled or covered by the lockdown file');
process.exit(bad ? 1 : 0);
