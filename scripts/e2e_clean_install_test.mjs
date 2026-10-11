// STRICT clean install (audit F-18). Applies supabase/migration-manifest.json, in order, to an empty
// disposable PostgreSQL. Each file runs whole, as one transaction; ANY SQL error fails the test
// (no "already exists" tolerance, no per-statement skipping). Then checks the finished database:
// every SQL file in supabase/ is accounted for, PostgREST serves the schema, no public table is
// left without row level security, the anonymous role holds no table privilege, and a second pass
// of the whole manifest reports which files are safe to re-run.
//
// Usage: node scripts/e2e_clean_install_test.mjs   (exit 0 only when every required check passes)
import fs from 'node:fs';
import path from 'node:path';
import { startTestEnv } from './testenv/env.mjs';

// Files deliberately outside the fresh-install sequence (they target already-provisioned databases
// and their statements are already contained in the sequence).
const NOT_FOR_FRESH_INSTALL = new Set([
  'supabase/mvp-security-fix-2026-09-29-standalone.sql',
  'supabase/security-repair-2026-09-30-production-patch-standalone.sql',
]);

const results = [];
function check(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${!pass && detail ? ' — ' + detail : ''}`);
  results.push(!!pass);
}

async function applyStrict(env, files) {
  const failures = [];
  for (const f of files) {
    const sql = fs.readFileSync(f, 'utf8');
    const c = await env.pool.connect();
    try {
      await c.query('begin');
      await c.query(sql);
      await c.query('commit');
    } catch (e) {
      await c.query('rollback').catch(() => {});
      failures.push({ file: f, message: e.message, where: e.where ? String(e.where).slice(0, 160) : undefined });
    } finally { c.release(); }
  }
  return failures;
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync('supabase/migration-manifest.json', 'utf8')).order;
  const onDisk = fs.readdirSync('supabase').filter((f) => f.endsWith('.sql')).map((f) => `supabase/${f}`);
  const missing = onDisk.filter((f) => !manifest.includes(f) && !NOT_FOR_FRESH_INSTALL.has(f));
  check('every SQL file in supabase/ is either in the manifest or explicitly excluded', missing.length === 0, missing.join(', '));
  const ghost = manifest.filter((f) => !fs.existsSync(f));
  check('every manifest entry exists', ghost.length === 0, ghost.join(', '));
  check('the public-schema lockdown runs last', manifest[manifest.length - 1] === 'supabase/zz-public-schema-lockdown-standalone.sql');

  const env = await startTestEnv({ migrations: [], bootstrap: 'platform', publicBuckets: [] });
  try {
    const failures = await applyStrict(env, manifest);
    for (const f of failures) console.log(`   SQL ERROR in ${f.file}: ${f.message}${f.where ? ` (${f.where})` : ''}`);
    check(`all ${manifest.length} files apply to an empty database with zero SQL errors`, failures.length === 0, `${failures.length} file(s) failed`);
    // PostgREST loaded an empty schema at start-up; ask it to reload and wait (bounded) until it sees the tables.
    let seen = false;
    for (let i = 0; i < 30 && !seen; i++) {
      await env.reload();
      seen = (await env.rest(env.serviceKey, 'organizations?select=id&limit=1')).status === 200;
    }
    check('PostgREST picks up the installed schema within 30 reload attempts', seen);

    const rlsOff = (await env.sql(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1`)).rows.map((r) => r.relname);
    check('no public table is left without row level security', rlsOff.length === 0, rlsOff.join(', '));
    const anonPriv = (await env.sql(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and (has_table_privilege('anon', c.oid, 'SELECT')
        or has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE'))
      order by 1`)).rows.map((r) => r.relname);
    check('the anonymous role holds no privilege on any public table', anonPriv.length === 0, anonPriv.join(', '));
    const blanket = (await env.sql(`select tablename, policyname from pg_policies where schemaname = 'public'
      and (policyname in ('staff_read_all_organizations','staff_read_all_members') or (tablename = 'jobs' and qual ilike '%organization_id IS NULL%'))`)).rows;
    check('no blanket cross-organization policy exists', blanket.length === 0, JSON.stringify(blanket));
    const salesViews = (await env.sql(`select p.key from role_permissions rp join permissions p on p.id = rp.permission_id
      where rp.role = 'nova_sales' and p.key in ('overview.view','growth.view')`)).rows;
    check('sales reps hold no organization-wide view (F-17)', salesViews.length === 0, JSON.stringify(salesViews));

    for (const t of ['organizations', 'client_invoices', 'contracts', 'sales_reps', 'work_items', 'jobs', 'crm_contacts', 'marketing_campaigns']) {
      const r = await env.rest(env.serviceKey, `${t}?select=*&limit=1`);
      check(`PostgREST serves ${t} to the service role`, r.status === 200, `status=${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
    }

    // Informational: which files can be re-run safely on a complete database.
    const rerun = await applyStrict(env, manifest);
    console.log(`\nINFO re-run of the whole manifest on the finished database: ${manifest.length - rerun.length}/${manifest.length} files re-apply cleanly.`);
    for (const f of rerun) console.log(`   INFO not re-runnable: ${f.file}: ${f.message}`);
  } finally {
    await env.stop();
  }
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed, ${results.length - passed} failed`);
  process.exit(passed === results.length && results.length > 0 ? 0 : 1);
}

main().catch((err) => { console.error('SCRIPT ERROR:', err); process.exit(1); });
