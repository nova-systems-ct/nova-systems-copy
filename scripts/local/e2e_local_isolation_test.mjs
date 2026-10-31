// Cross-business isolation on LOCAL STAGING (the hosted version is scripts/e2e_org_isolation_test.mjs, which needs a
// hosted staging project and is listed separately). A throwaway business owner — a real Supabase Auth user, signed in
// with a real password, owner of a throwaway LOCAL TEST organization only — tries to reach Nova's own records through
// the app API (by organization and by object id) and directly through the database API with their own token.
// Everything created here is removed at the end.   node scripts/local/e2e_local_isolation_test.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';

const read = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = read('.env.local-staging');
const APP = 'http://localhost:5180'; const SB = env.SUPABASE_URL; const ANON = env.VITE_SUPABASE_ANON_KEY; const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const pg = createRequire(path.join(process.cwd(), '.testenv', 'package.json'))('pg');
const db = new pg.Client({ connectionString: env.LOCAL_DB_URL }); await db.connect();
const q = async (sql, a = []) => (await db.query(sql, a)).rows;
const admin = (p, init = {}) => fetch(`${SB}${p}`, { ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });

const NOVA = (await q("select id from organizations where kind='nova_internal' limit 1"))[0].id;
const novaCase = (await q("select c.id from audit_cases c where c.organization_id=$1 and exists (select 1 from audit_findings f where f.case_id=c.id) order by c.created_at limit 1", [NOVA]))[0]?.id;
const novaDoc = (await q('select id from vault_documents where organization_id=$1 and audit_case_id is not null order by created_at desc limit 1', [NOVA]))[0]?.id;
const novaCounts = { cases: (await q('select count(*)::int n from audit_cases where organization_id=$1', [NOVA]))[0].n };
const tag = crypto.randomBytes(3).toString('hex');
let userId = null; let orgId = null;
try {
  orgId = (await q("insert into organizations (name, slug, kind) values ($1, $2, 'client') returning id", [`LOCAL TEST Isolation ${tag}`, `local-test-isolation-${tag}`]))[0].id;
  const password = `Iso-${crypto.randomBytes(9).toString('base64url')}!7`;
  const email = `local-test-isolation-${tag}@example.invalid`;
  const u = await (await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  userId = u.id; if (!userId) throw new Error(`could not create the test user: ${JSON.stringify(u).slice(0, 200)}`);
  await q("insert into organization_members (organization_id, member_type, staff_user_id, role, status) values ($1, 'staff', $2, 'client_owner', 'active')", [orgId, userId]);
  const tok = (await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).access_token;
  check('the other business owner signs in with a real password', !!tok);
  const api = (qs, init = {}) => fetch(`${APP}/api/client?${new URLSearchParams(qs)}`, { ...init, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });

  // their own workspace works (so the denials below are isolation, not a broken account)
  const own = await api({ resource: 'ops', op: 'install', action: 'view', organization_id: orgId });
  check('they can open their own business\'s installation', own.status === 200, String(own.status));

  // app API by organization
  const byOrg = await api({ resource: 'audit', op: 'workspace', organization_id: NOVA, case_id: novaCase });
  check('naming Nova\'s organization does not open Nova\'s audit', [401, 403, 404].includes(byOrg.status), String(byOrg.status));
  const inst = await api({ resource: 'ops', op: 'install', action: 'view', organization_id: NOVA });
  check('naming Nova\'s organization does not open Nova\'s installation', [401, 403, 404].includes(inst.status), String(inst.status));
  // app API by object id under their own organization (object-level authorization)
  const byObj = await api({ resource: 'audit', op: 'workspace', organization_id: orgId, case_id: novaCase });
  check('Nova\'s audit id under their own organization is not found', [403, 404].includes(byObj.status), String(byObj.status));
  if (novaDoc) {
    const pdf = await api({ resource: 'audit', op: 'pdf-file', organization_id: orgId, case_id: novaCase, document_id: novaDoc });
    check('Nova\'s Vault PDF cannot be downloaded from another business', [400, 403, 404].includes(pdf.status) && !(pdf.headers.get('content-type') || '').includes('pdf'), `${pdf.status} ${pdf.headers.get('content-type')}`);
  }
  const rc = await api({ resource: 'audit', op: 'recheck' }, { method: 'POST', body: JSON.stringify({ organization_id: orgId, case_id: novaCase }) });
  check('they cannot re-check (write to) Nova\'s findings', [403, 404].includes(rc.status), String(rc.status));
  const ms = await api({ resource: 'ops', op: 'install' }, { method: 'POST', body: JSON.stringify({ organization_id: NOVA, action: 'disable-module', module_key: 'agents_booking', reason: 'isolation test' }) });
  check('they cannot turn off a module in Nova\'s installation', [401, 403, 404].includes(ms.status), String(ms.status));

  // database API with their own token: row-level security (positive control first: their own row IS readable)
  const mine = await (await fetch(`${SB}/rest/v1/organization_members?select=organization_id`, { headers: { apikey: ANON, Authorization: `Bearer ${tok}` } })).json();
  check('with their token they can read their own membership (so empty results below are isolation, not failure)', Array.isArray(mine) && mine.some((m) => m.organization_id === orgId), JSON.stringify(mine).slice(0, 120));
  for (const table of ['audit_cases', 'audit_findings', 'audit_evidence', 'businesses', 'vault_documents', 'ops_jobs', 'ops_installed_modules', 'work_items', 'organization_members']) {
    const r = await fetch(`${SB}/rest/v1/${table}?select=*&limit=1000`, { headers: { apikey: ANON, Authorization: `Bearer ${tok}` } });
    const rows = r.ok ? await r.json() : [];
    const leaked = rows.filter((x) => x.organization_id === NOVA || (table === 'audit_findings' || table === 'audit_evidence' ? x.case_id === novaCase : false));
    check(`${table}: none of Nova's rows are readable with their token`, leaked.length === 0, `${r.status} leaked=${leaked.length}`);
  }
  const w = await fetch(`${SB}/rest/v1/audit_cases?id=eq.${novaCase}`, { method: 'PATCH', headers: { apikey: ANON, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ status: 'archived' }) });
  const after = (await q('select status from audit_cases where id=$1', [novaCase]))[0].status;
  check('a direct write to Nova\'s audit with their token changes nothing', after !== 'archived' && (!w.ok || (await w.json()).length === 0), `${w.status} ${after}`);
  check('Nova\'s records are unchanged', (await q('select count(*)::int n from audit_cases where organization_id=$1', [NOVA]))[0].n === novaCounts.cases);
} finally {
  if (orgId) { await q('delete from organization_members where organization_id=$1', [orgId]); await q('delete from organizations where id=$1', [orgId]).catch(() => {}); }
  if (userId) await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
  await db.end();
}
console.log(`\n${pass} passed, ${fail} failed — LOCAL STAGING only (hosted isolation: scripts/e2e_org_isolation_test.mjs, needs a hosted staging project)`);
process.exit(fail ? 1 : 0);
