// Proves the 2026-09-29 lockdown fix (Gap A-3) actually works at the database layer, against a
// real, disposable local PostgreSQL + PostgREST — not just a static file-content check.
// For each of the 15 tables added to zz-public-schema-lockdown-standalone.sql this session
// (previously reachable via the public anon key because they live in schema-update.sql, which
// check_migration_lockdown.mjs never scanned): confirm the anon role can neither read nor write a
// real row, and confirm the service role (what every real api/*.js handler actually uses) still
// can — so the fix closes the hole without breaking any legitimate server-side code path.
//
// Usage: node scripts/e2e_schema_lockdown_test.mjs
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';

const NEWLY_LOCKED = [
  'blog_posts', 'client_accounts', 'client_messages', 'intake_requests', 'notifications',
  'nova_ai_agents', 'nova_ai_audits', 'nova_ai_calls', 'nova_ai_knowledge_bases',
  'nova_ai_settings', 'nova_ai_sms_logs', 'nova_ai_voices', 'portfolio', 'social_posts',
  'vault_documents',
];

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

async function main() {
  const env = await startTestEnv({ migrations: allMigrations() });
  try {
    const badMigrations = env.migrationErrors.filter((e) => !/already exists|duplicate/i.test(e.message));
    log('Migrations (including the lockdown fix) applied without unexpected errors', badMigrations.length === 0, JSON.stringify(badMigrations.slice(0, 3)));

    for (const table of NEWLY_LOCKED) {
      // Confirm the table actually exists in this environment before testing it — a skip here
      // would silently look like a pass otherwise.
      const exists = await env.sql(`select to_regclass('public.${table}') as t`);
      if (!exists.rows[0].t) { log(`${table}: table exists in this environment`, false, 'to_regclass returned null — schema-update.sql did not create it here'); continue; }

      // Anon SELECT must be denied (RLS enabled, no policy => zero rows or an explicit permission error; never real data).
      const anonRead = await env.rest(null, `${table}?select=*&limit=1`);
      const anonReadOk = anonRead.status >= 400 || (Array.isArray(anonRead.data) && anonRead.data.length === 0);
      log(`${table}: anon SELECT returns no data`, anonReadOk, `status=${anonRead.status} body=${JSON.stringify(anonRead.data).slice(0, 150)}`);

      // Anon INSERT must be denied outright (anon has zero privileges on these tables after REVOKE ALL).
      const anonWrite = await env.rest(null, `${table}`, { method: 'POST', body: { id: '00000000-0000-0000-0000-000000000000' }, headers: { Prefer: 'return=representation' } });
      log(`${table}: anon INSERT is rejected`, anonWrite.status >= 400, `status=${anonWrite.status} body=${JSON.stringify(anonWrite.data).slice(0, 150)}`);

      // Service role (what every real api/*.js handler uses) must still be able to read the table —
      // proves the fix does not break any legitimate server-side code path.
      const serviceRead = await env.rest(env.serviceKey, `${table}?select=*&limit=1`);
      log(`${table}: service role can still SELECT`, serviceRead.status < 300, `status=${serviceRead.status}`);
    }

    // One concrete, real-data check on the highest-severity table: insert a real row via the
    // service role (the only way any legitimate code writes here), then prove the anon key
    // genuinely cannot read that specific row's sensitive column back.
    const ins = await env.sql(`insert into public.client_accounts (email, password_hash) values ('gap-a3-test@example.invalid', 'not-a-real-hash-just-a-marker') returning id`);
    const rowId = ins.rows[0].id;
    const anonReadSpecific = await env.rest(null, `client_accounts?id=eq.${rowId}&select=email,password_hash`);
    log('client_accounts: anon cannot read the real inserted row (including password_hash)', Array.isArray(anonReadSpecific.data) ? anonReadSpecific.data.length === 0 : anonReadSpecific.status >= 400, `status=${anonReadSpecific.status} body=${JSON.stringify(anonReadSpecific.data)}`);
    const serviceReadSpecific = await env.rest(env.serviceKey, `client_accounts?id=eq.${rowId}&select=email,password_hash`);
    log('client_accounts: service role can read the real inserted row', Array.isArray(serviceReadSpecific.data) && serviceReadSpecific.data[0]?.email === 'gap-a3-test@example.invalid', `status=${serviceReadSpecific.status} body=${JSON.stringify(serviceReadSpecific.data)}`);
  } finally {
    await env.stop();
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed, ${results.length - passed} failed`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => { console.error('SCRIPT ERROR:', err); process.exit(1); });
