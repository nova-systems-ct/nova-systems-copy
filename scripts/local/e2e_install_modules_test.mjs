// Install Systems with catalog modules (owner brief 2026-10-30 §6) against REAL local Supabase, in an isolated
// LOCAL TEST workspace (never Nova's own records). Proves: catalog + audit-based recommendations · owner selection ·
// one press runs each module's recipe and records every step · re-running duplicates nothing (workers, fix tasks) ·
// a blocked input is reported with the exact next action · turning Nova Agents off makes a new inquiry go to a person,
// turning it on restores normal handling · a representative cannot choose or turn off modules.
//   node scripts/local/e2e_install_modules_test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const read = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = read('.env.local-staging'); const acct = read('.env.local-staging-accounts');
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(env.SUPABASE_URL)) throw new Error('local only');
Object.assign(process.env, env);
const pg = createRequire(path.join(process.cwd(), '.testenv', 'package.json'))('pg');
const db = new pg.Client({ connectionString: env.LOCAL_DB_URL }); await db.connect();
const { default: client } = await import('../../api/client.js');
const S = await import('../../api/_ops/service.js');

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const token = async (email, password) => (await (await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).access_token;
const OWNER = await token(acct.OWNER_EMAIL, acct.OWNER_PASSWORD); const REP = await token(acct.REP_EMAIL, acct.REP_PASSWORD);
async function ops(tok, method, op, { query = {}, body } = {}) {
  let status = 200; let out = null;
  const res = { setHeader() {}, status(c) { status = c; return res; }, json(b) { out = b; return res; }, send(b) { out = b; return res; }, end() { return res; }, get headersSent() { return false; } };
  await client({ method, query: { resource: 'ops', op, ...query }, body: body || {}, headers: { authorization: `Bearer ${tok}`, 'x-forwarded-for': '127.0.0.1' }, socket: { remoteAddress: '127.0.0.1' } }, res);
  return { status, json: out };
}
const ORG = (await db.query("select id from organizations where name like 'LOCAL TEST Detailing%' order by created_at desc limit 1")).rows[0].id;
const owner = (await db.query('select id from auth.users where email=$1', [acct.OWNER_EMAIL])).rows[0].id;
const preWorkers = new Set((await db.query("select id from workers where capability_key is not null and status<>'inactive'")).rows.map((r) => r.id));
const tag = `install-mod-${Date.now().toString(36)}`; const startedAt = new Date().toISOString();
let caseId;
try {
  // fixture: an audit of this test business with two website findings (evidence-linked) and one email finding
  const biz = (await db.query("insert into businesses (organization_id, name, website) values ($1, $2, 'https://example.com') returning id", [ORG, `LOCAL TEST Install Audit ${tag}`])).rows[0].id;
  caseId = (await db.query("insert into audit_cases (organization_id, business_id, scope, status, intake) values ($1,$2,'digital','intake',$3) returning id", [ORG, biz, { name: `LOCAL TEST Install Audit ${tag}`, website: 'https://example.com/' }])).rows[0].id;
  const ev = (await db.query("insert into audit_evidence (case_id, source, observation, confidence, author) values ($1,'fixture','fixture observation','high','test fixture') returning id", [caseId])).rows[0].id;
  for (const [t, mk] of [['Hours are not published', 'website_fixes'], ['No tap-to-call link', 'website_fixes'], ['No DMARC record', 'email_setup']]) {
    const f = (await db.query("insert into audit_findings (case_id, title, statement_type, detail, priority, confidence, recommended_action, review_status, origin, module_key, check_key) values ($1,$2,'observed_fact','fixture detail','medium','high','Fix it','draft','automated_review',$3,$4) returning id", [caseId, t, mk, `${tag}:${t}`])).rows[0].id;
    await db.query('insert into audit_finding_evidence (finding_id, evidence_id) values ($1,$2)', [f, ev]);
  }

  let r = await ops(OWNER, 'GET', 'install', { query: { organization_id: ORG, action: 'modules' } });
  const mods = r.json?.modules || [];
  check('the catalog lists six modules with purpose, inputs, permissions and named provider costs', mods.length === 6 && mods.every((m) => m.purpose && m.inputs.length && m.permissions.length && m.costs.length), JSON.stringify(r.json).slice(0, 200));
  check('recommendations come from the audit: website and email fixes are recommended with the findings as reasons', mods.find((m) => m.key === 'website_fixes').recommended && mods.find((m) => m.key === 'website_fixes').reasons.includes('Hours are not published') && mods.find((m) => m.key === 'email_setup').recommended);
  check('modules with no matching finding are not recommended (e.g. reviews and referrals)', !mods.find((m) => m.key === 'reviews_referrals').recommended);

  r = await ops(REP, 'POST', 'install', { body: { organization_id: ORG, action: 'select-module', module_key: 'agents_booking' } });
  check('a representative cannot choose modules', r.status === 403, String(r.status));
  for (const k of ['agents_booking', 'monitoring_reporting', 'website_fixes', 'email_setup']) await ops(OWNER, 'POST', 'install', { body: { organization_id: ORG, action: 'select-module', module_key: k } });
  r = await ops(OWNER, 'POST', 'install', { body: { organization_id: ORG, action: 'prepare' } });
  check('the prepared plan includes the selected modules', JSON.stringify(r.json?.manifest?.modules) === JSON.stringify(['agents_booking', 'email_setup', 'monitoring_reporting', 'website_fixes']), JSON.stringify(r.json?.manifest?.modules));
  const manifestId = r.json.id;

  r = await ops(OWNER, 'POST', 'install', { body: { organization_id: ORG, action: 'run', manifest_id: manifestId } });
  const steps = r.json?.steps || [];
  const mstep = (k) => steps.filter((s) => s.step_key.startsWith(`module:${k}`));
  check('one press runs every selected module and records each step', ['agents_booking', 'monitoring_reporting', 'website_fixes', 'email_setup'].every((k) => mstep(k).length > 0), steps.map((s) => s.step_key).join(','));
  check('the booking worker is registered and active (a real capability, not a label)', mstep('agents_booking').some((s) => s.step_key === 'module:agents_booking:worker:intake_booking' && s.status === 'done'), JSON.stringify(mstep('agents_booking')));
  check('missing business inputs block the booking module with the exact next action', mstep('agents_booking').some((s) => s.step_key === 'module:agents_booking:inputs' && s.status === 'blocked' && /escalation/.test(s.detail) && s.owner_action), JSON.stringify(mstep('agents_booking').find((s) => s.step_key.endsWith(':inputs'))));
  const tasks1 = (await db.query("select count(*)::int n from work_items where organization_id=$1 and category='install_fix' and source_ref like 'finding:%'", [ORG])).rows[0].n;
  check('website findings become tracked fix tasks, one per finding', tasks1 === 2 && mstep('website_fixes').some((s) => s.status === 'done'), `tasks=${tasks1}`);
  check('email setup checks real public DNS and reports what it found', mstep('email_setup').some((s) => ['done', 'skipped', 'blocked'].includes(s.status) && /DNS|MX|records/.test(s.detail)), JSON.stringify(mstep('email_setup')));
  const outcomeOf = (k) => (mstep(k).find((x) => x.evidence?.outcome) || {}).evidence?.outcome || '';
  check('fix tasks are reported as "tasks created", never as fixed', /^tasks created/.test(outcomeOf('website_fixes')) && !/resolved|fixed/.test(outcomeOf('website_fixes')), outcomeOf('website_fixes'));
  check('the DNS step is reported as "checked …" (or why it was not), never as resolved', /^(checked|not checked)/.test(mstep('email_setup')[0]?.evidence?.outcome || ''), JSON.stringify(mstep('email_setup')[0]?.evidence));
  const modState = Object.fromEntries((await db.query('select module_key, status from ops_installed_modules where organization_id=$1', [ORG])).rows.map((x) => [x.module_key, x.status]));
  check('each module records its own outcome (installed or blocked), and the plan is not called installed while one is blocked', modState.agents_booking === 'blocked' && modState.website_fixes === 'installed' && r.json.status !== 'installed', JSON.stringify(modState) + ' ' + r.json.status);

  // re-run: nothing duplicated
  r = await ops(OWNER, 'POST', 'install', { body: { organization_id: ORG, action: 'run', manifest_id: manifestId } });
  const liveIntake = (await db.query("select count(*)::int n from workers where capability_key='intake_booking' and status<>'inactive'")).rows[0].n;
  const tasks2 = (await db.query("select count(*)::int n from work_items where organization_id=$1 and category='install_fix' and source_ref like 'finding:%'", [ORG])).rows[0].n;
  check('running again creates no duplicate worker and no duplicate fix task', liveIntake === 1 && tasks2 === 2, `workers=${liveIntake} tasks=${tasks2}`);

  // a module whose earlier attempt failed: once it runs through, the old error no longer holds the plan at "failed"
  await db.query("insert into ops_install_steps (manifest_id, organization_id, stage, step_key, label, status, detail, evidence, attempts) values ($1,$2,5,'module:website_fixes:error','Website and listing fixes','failed','simulated earlier failure','{}',1) on conflict (manifest_id, step_key) do update set status='failed', detail='simulated earlier failure'", [manifestId, ORG]);
  r = await ops(OWNER, 'POST', 'install', { body: { organization_id: ORG, action: 'run', manifest_id: manifestId } });
  const errRow = (await db.query("select status, detail from ops_install_steps where manifest_id=$1 and step_key='module:website_fixes:error'", [manifestId])).rows[0];
  const planStatus = (await db.query('select status from ops_install_manifests where id=$1', [manifestId])).rows[0].status;
  check('a retry that gets through clears the earlier module error (plan no longer "failed")', errRow.status === 'skipped' && /Earlier error cleared/.test(errRow.detail) && planStatus !== 'failed', `${JSON.stringify(errRow)} plan=${planStatus}`);

  // turning Nova Agents off: a new inquiry goes to a person; on again: normal handling
  r = await ops(OWNER, 'POST', 'install', { body: { organization_id: ORG, action: 'disable-module', module_key: 'agents_booking', reason: 'Owner answering personally this week' } });
  check('the owner can turn Nova Agents off for this business, with a reason', r.status === 200 && r.json.module.status === 'disabled', JSON.stringify(r.json));
  r = await ops(REP, 'POST', 'install', { body: { organization_id: ORG, action: 'enable-module', module_key: 'agents_booking' } });
  check('a representative cannot turn modules on or off', r.status === 403, String(r.status));
  const inquiry = async (text) => {
    const contact = (await db.query("insert into crm_contacts (organization_id, name, phone, is_test) values ($1, $2, $3, true) returning *", [ORG, `LOCAL TEST Inquirer ${tag}`, `+1203555${String(Date.now()).slice(-4)}`])).rows[0];
    const conv = (await db.query("insert into wave1_conversations (organization_id, contact_id, channel, is_test, customer_initiated_at) values ($1,$2,'sms',true,now()) returning id", [ORG, contact.id])).rows[0];
    const msg = (await db.query("insert into wave1_messages (organization_id, conversation_id, direction, body) values ($1,$2,'inbound',$3) returning id", [ORG, conv.id, text])).rows[0];
    return S.handleInboundTurn({ orgId: ORG, conversationId: conv.id, messageId: msg.id });
  };
  let out = await inquiry('Hi, can I book a detail this week?');
  const st = out.job_id ? (await db.query('select state, escalation_reason from ops_jobs where id=$1', [out.job_id])).rows[0] : null;
  check('while turned off, a new inquiry is escalated to a person with the reason recorded', out.escalated === 'agents_module_disabled' && st?.state === 'escalated' && /turned off/.test(st.escalation_reason || ''), JSON.stringify(out) + JSON.stringify(st));
  r = await ops(OWNER, 'POST', 'install', { body: { organization_id: ORG, action: 'enable-module', module_key: 'agents_booking' } });
  out = await inquiry('Hi, can I book a detail this week?');
  check('turned back on, the next inquiry is handled by the agent again (not the off-switch)', r.status === 200 && out.escalated !== 'agents_module_disabled' && !out.skipped, JSON.stringify(out).slice(0, 200));
  const tr = (await db.query("select count(*)::int n from ops_transitions where organization_id=$1 and entity='settings' and reason like 'module agents_booking%' and at >= $2", [ORG, startedAt])).rows[0].n;
  check('both switches are recorded in the business history', tr === 2, String(tr));
} finally {
  await db.query("delete from work_items where source_ref like 'finding:%' and organization_id=$1", [ORG]);
  if (caseId) { await db.query('delete from audit_finding_evidence where finding_id in (select id from audit_findings where case_id=$1)', [caseId]); for (const t of ['audit_findings', 'audit_evidence']) await db.query(`delete from ${t} where case_id=$1`, [caseId]); await db.query('delete from audit_cases where id=$1', [caseId]); }
  await db.query("delete from businesses where name like 'LOCAL TEST Install Audit %'");
  await db.query('delete from ops_install_steps where organization_id=$1', [ORG]);
  await db.query("update ops_install_manifests set status='superseded' where organization_id=$1", [ORG]);
  await db.query('delete from ops_installed_modules where organization_id=$1', [ORG]);
  // workers registered by this test are retired (their history is append-only by design)
  for (const w of (await db.query("select id, status from workers where capability_key is not null and status<>'inactive'")).rows) {
    if (preWorkers.has(w.id)) continue;
    await db.query("insert into worker_status_events (worker_id, from_status, to_status, changed_by, reason) values ($1,$2,'inactive',$3,'Retired by the automated install-modules test')", [w.id, w.status, owner]);
    await db.query("update workers set status='inactive', updated_at=now() where id=$1", [w.id]);
  }
  await db.end();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
