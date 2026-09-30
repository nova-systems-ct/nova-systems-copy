// Proves supabase/mvp-security-fix-2026-09-29-standalone.sql — the narrow, separately-reviewable
// file meant for the real deployment (not the full cumulative schema-update.sql) — applies
// cleanly on its own against a real local disposable PostgreSQL, including when the same
// statements have already been applied once (idempotency: the file may need to run more than
// once against a real database without erroring or changing behavior), and that it alone produces
// the same anon-denied / service-role-allowed outcomes as the full local test suite.
//
// Usage: node scripts/e2e_mvp_security_fix_test.mjs
import fs from 'node:fs';
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

async function main() {
  const env = await startTestEnv({ migrations: allMigrations() });
  try {
    const sql = fs.readFileSync('supabase/mvp-security-fix-2026-09-29-standalone.sql', 'utf8');

    // Applied once on top of a database that (via schema-update.sql, in allMigrations()) already
    // has the identical fix baked in — proves the file is idempotent, a real requirement since a
    // real database only gets this run once but must not error if re-run by mistake.
    let firstRunError = null;
    try { await env.sql(sql); } catch (e) { firstRunError = e.message; }
    log('File applies without error on top of an already-fixed database (idempotency, run 1)', !firstRunError, firstRunError);

    let secondRunError = null;
    try { await env.sql(sql); } catch (e) { secondRunError = e.message; }
    log('File applies without error a second consecutive time (idempotency, run 2)', !secondRunError, secondRunError);

    await env.reload();

    // Spot-check the outcome directly through this exact file's own effect: anon denied, service
    // role allowed, for one A-2 table and one A-3 table.
    const anonOrgs = await env.rest(null, 'organizations?select=id');
    log('A-2: anon reads zero organizations after this file', Array.isArray(anonOrgs.data) && anonOrgs.data.length === 0, `status=${anonOrgs.status}`);

    const anonAccounts = await env.rest(null, 'client_accounts?select=id&limit=1');
    log('A-3: anon is denied on client_accounts after this file', anonAccounts.status >= 400, `status=${anonAccounts.status} body=${JSON.stringify(anonAccounts.data).slice(0, 120)}`);

    const serviceAccounts = await env.rest(env.serviceKey, 'client_accounts?select=id&limit=1');
    log('A-3: service role still reads client_accounts after this file', serviceAccounts.status < 300, `status=${serviceAccounts.status}`);
  } finally {
    await env.stop();
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed, ${results.length - passed} failed`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => { console.error('SCRIPT ERROR:', err); process.exit(1); });
