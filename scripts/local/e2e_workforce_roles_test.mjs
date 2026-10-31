// Executable workforce roles on LOCAL STAGING with the REAL background worker (owner brief 2026-10-30 §11).
// Each role — executive assistant, COO, CFO, CMO — receives a task through the job queue, does only its permitted work,
// saves its result (work item, evidence, output, handoff events) and escalates to the owner when necessary. The brief's
// chain is exercised: CMO proposes an expense -> CFO checks funds (unknown without a balance), commitments and policy ->
// the owner's authority decides -> the expense is recorded. Runs in an isolated LOCAL TEST business; the four role
// workers are registered on the Workers page (they are Nova's workforce and stay registered).
//   node scripts/local/e2e_workforce_roles_test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const read = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = read('.env.local-staging'); const acct = read('.env.local-staging-accounts');
const APP = 'http://localhost:5180';
const OUT = path.join(os.tmpdir(), 'nova-workforce'); fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const seen = (loc, t = 15000) => loc.first().waitFor({ state: 'visible', timeout: t }).then(() => true, () => false);
const pg = createRequire(path.join(process.cwd(), '.testenv', 'package.json'))('pg');
const db = new pg.Client({ connectionString: env.LOCAL_DB_URL }); await db.connect();
const q = async (sql, a = []) => (await db.query(sql, a)).rows;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const beat = (await q('select max(last_seen_at) t from worker_runtime_heartbeats'))[0].t;
if (!beat || Date.now() - new Date(beat).getTime() > 120_000) { console.error('The local background worker is not running: node scripts/local/staging.mjs worker'); process.exit(2); }
const tag = crypto.randomBytes(3).toString('hex');
const tok = (await (await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: acct.OWNER_EMAIL, password: acct.OWNER_PASSWORD }) })).json()).access_token;
const api = async (op, body) => { const r = await fetch(`${APP}/api/client?resource=roles&op=${op}`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
let ORG = null; const browser = await pw.chromium.launch({ headless: true });
// run one role through the real queue and wait for its job to finish
async function runRole(role) {
  const r = await api('run-now', { organization_id: ORG, role });
  const id = r.json.job_id; const end = Date.now() + 60_000;
  while (Date.now() < end) { const j = (await q('select status, result, last_error from jobs where id=$1', [id]))[0]; if (['completed', 'failed', 'dead_letter'].includes(j?.status)) return { job: id, ...j }; await sleep(1000); }
  return { job: id, status: 'timeout' };
}
const taskOf = async (jobId) => (await q('select * from work_items where job_id=$1', [jobId]))[0];
const trail = async (id) => (await q('select from_status, to_status, reason from work_item_events where work_item_id=$1 order by created_at', [id]));
try {
  const owner = (await q('select id from auth.users where email=$1', [acct.OWNER_EMAIL]))[0].id;
  ORG = (await q("insert into organizations (name, slug, kind) values ($1, $2, 'client') returning id", [`LOCAL TEST Workforce ${tag}`, `local-test-workforce-${tag}`]))[0].id;
  await q("insert into organization_members (organization_id, member_type, staff_user_id, role, status) values ($1, 'staff', $2, 'nova_super_admin', 'active')", [ORG, owner]);
  // fixtures: a customer escalation waiting 30 h, a stalled quote (10 days), failed jobs, an unassigned task, a task whose prerequisite is unfinished
  const contact = (await q("insert into crm_contacts (organization_id, name, phone, is_test) values ($1, $2, $3, true) returning id", [ORG, `LOCAL TEST Customer ${tag}`, `+1203555${String(Date.now()).slice(-4)}`]))[0].id;
  await q("insert into ops_jobs (organization_id, contact_id, source_channel, state, escalation_reason, is_test, updated_at) values ($1,$2,'form','escalated','Asked for a manager about a refund',true, now() - interval '30 hours')", [ORG, contact]);
  await q("insert into ops_jobs (organization_id, contact_id, source_channel, state, is_test, updated_at) values ($1,$2,'form','quoted',true, now() - interval '10 days')", [ORG, contact]);
  const failedSafe = (await q("insert into jobs (job_type, organization_id, payload, status, attempts, max_attempts, last_error, scheduled_at, idempotency_key) values ('ops_scoreboard_tick', $1, '{}', 'failed', 2, 5, 'timeout', now() + interval '1 day', $2) returning id", [ORG, `wf-${tag}-a`]))[0].id;
  const failedSend = (await q("insert into jobs (job_type, organization_id, payload, status, attempts, max_attempts, last_error, scheduled_at, idempotency_key) values ('ops_followup_send', $1, '{}', 'failed', 5, 5, 'provider rejected', now() + interval '1 day', $2) returning id", [ORG, `wf-${tag}-b`]))[0].id;
  const unassigned = (await q("insert into work_items (organization_id, role_key, title, category, status, created_by, cost_cents) values ($1,'cfo','Reconcile October card charges','finance','draft',$2,0) returning id", [ORG, owner]))[0].id;
  const prereq = (await q("insert into work_items (organization_id, title, category, status, created_by, cost_cents) values ($1,'Collect October receipts','finance','assigned',$2,0) returning id", [ORG, owner]))[0].id;
  const dependent = (await q("insert into work_items (organization_id, title, category, status, created_by, cost_cents, depends_on, started_at) values ($1,'File the October expense report','finance','in_progress',$2,0,ARRAY[$3]::uuid[], now()) returning id", [ORG, owner, prereq]))[0].id;
  await api('set-preference', { organization_id: ORG, key: 'cmo_test_budget_cents', value: 6000 });
  await api('set-preference', { organization_id: ORG, key: 'escalate_after_hours', value: 24 });
  await api('set-preference', { organization_id: ORG, key: 'priorities', value: ['Book audits for Waterbury businesses', 'Keep spending near zero'] });

  // the owner registers the four role workers on the Workers page (Nova's workforce)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${APP}/login`); await p.getByLabel('Email').fill(acct.OWNER_EMAIL); await p.getByLabel('Password').fill(acct.OWNER_PASSWORD);
  await p.getByRole('button', { name: /SIGN IN/ }).click(); await p.waitForURL(/\/dashboard/);
  await p.goto(`${APP}/dashboard/command/workforce`).catch(() => {});
  if (!(await seen(p.getByRole('heading', { level: 1, name: 'Who does the work' }), 8000))) { await p.getByRole('link', { name: 'Workers' }).first().click(); }
  await seen(p.getByText(/workers registered/), 20000); await seen(p.locator('section', { has: p.getByRole('heading', { name: /^CMO worker/ }) }), 20000);
  for (const name of ["Owner's executive assistant", 'COO worker', 'CFO worker', 'CMO worker']) {
    const sec = p.locator('section', { has: p.getByRole('heading', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\']/g, '.')}`) }) });
    const btn = sec.getByRole('button', { name: 'Register this worker' });
    if (await btn.count()) { await btn.click(); await seen(p.getByText(`${name} registered and active.`)); }
  }
  const roleWorkers = await q("select capability_key, status from workers where capability_key in ('executive_assistant','coo','cfo','cmo') and status='active'");
  check('the four role workers are registered and active (each title is tied to a handler)', roleWorkers.length === 4, JSON.stringify(roleWorkers));
  await sleep(16_000); // the worker re-reads the registry every 15 s

  // CMO: receives the task, proposes (never sends), saves the result
  const cmo = await runRole('cmo'); const cmoTask = await taskOf(cmo.job);
  check('CMO: the task arrives through the queue and completes', cmo.status === 'completed', JSON.stringify(cmo).slice(0, 200));
  const revive = (await q("select id, status, title from work_items where organization_id=$1 and category='proposal:revive'", [ORG]))[0];
  check('CMO: the stalled quote becomes a Revive proposal waiting for the owner (not executed)', revive?.status === 'draft' && /1 stalled/.test(revive.title), JSON.stringify(revive));
  const exp1 = (await q("select * from expense_requests where organization_id=$1 and requested_by_role='cmo'", [ORG]))[0];
  check('CMO: proposes exactly the owner\'s test budget ($60.00) to the CFO', exp1?.amount_cents === '6000' && exp1.status === 'proposed', JSON.stringify(exp1));
  check('CMO: result saved for review with evidence and output', cmoTask?.status === 'in_review' && (await q('select count(*)::int n from work_item_evidence where work_item_id=$1', [cmoTask.id]))[0].n === 1 && (await q('select count(*)::int n from work_item_outputs where work_item_id=$1', [cmoTask.id]))[0].n === 1);
  check('CMO: no message was sent (no follow-up or campaign job was queued)', (await q("select count(*)::int n from jobs where organization_id=$1 and job_type in ('ops_followup_send','ops_campaign_send') and id <> $2", [ORG, failedSend]))[0].n === 0);

  // CFO without a balance: funds unknown -> owner decides
  const cfo1 = await runRole('cfo'); const cfo1Task = await taskOf(cfo1.job);
  const e1 = (await q('select status, cfo_check from expense_requests where id=$1', [exp1.id]))[0];
  check('CFO: with no balance on record, funds are "unknown" and the expense goes to the owner', e1.status === 'needs_owner' && e1.cfo_check.recommendation === 'unknown' && e1.cfo_check.available_cents === null, JSON.stringify(e1));
  check('CFO: its saved result says funds are unknown (no invented figure)', /No balance on record: available funds unknown/.test(cfo1Task?.result?.summary || ''), cfo1Task?.result?.summary);
  check('CFO: the spending decision is escalated to the owner in the app', (await q("select count(*)::int n from sales_notifications where user_id=$1 and kind='role_cfo_escalation' and subject like 'Spending decision: $60.00%'", [owner]))[0].n >= 1);

  // owner enters a balance; a new request is checked against funds, commitments and policy
  await api('add-balance', { organization_id: ORG, balance_dollars: 500, account_label: 'LOCAL TEST checking' });
  await api('propose-expense', { organization_id: ORG, amount_dollars: 40, purpose: 'LOCAL TEST directory listing' });
  await api('set-preference', { organization_id: ORG, key: 'auto_approve_cents', value: 5000 });
  await api('set-preference', { organization_id: ORG, key: 'monthly_budget_cents', value: 50000 });
  await api('propose-expense', { organization_id: ORG, amount_dollars: 75, purpose: 'LOCAL TEST print flyers' });
  await runRole('cfo');
  const e2 = (await q("select status, cfo_check, authority from expense_requests where organization_id=$1 and purpose='LOCAL TEST directory listing'", [ORG]))[0];
  const e3 = (await q("select status, cfo_check from expense_requests where organization_id=$1 and purpose='LOCAL TEST print flyers'", [ORG]))[0];
  check('CFO: within the owner\'s limit and budget with a fresh balance, approved by policy (recorded as such)', e2.status === 'approved' && e2.authority.by === 'owner policy', JSON.stringify(e2));
  check('CFO: above the automatic limit, recommended but sent to the owner, with available funds after commitments', e3.status === 'needs_owner' && e3.cfo_check.recommendation === 'approve' && e3.cfo_check.available_cents === 50000 - 4000, JSON.stringify(e3));

  // executive assistant: orders what waits for the owner, escalates what waited too long
  const ea = await runRole('executive_assistant'); const eaTask = await taskOf(ea.job);
  const out = (await q('select content from work_item_outputs where work_item_id=$1', [eaTask.id]))[0].content;
  check('Assistant: the brief puts the customer escalation first, then spending decisions, then results to review', out.decisions[0].kind === 'escalation' && out.decisions[1].kind === 'expense' && out.decisions.some((x) => x.kind === 'review'), JSON.stringify(out.decisions.map((x) => x.kind)));
  check('Assistant: each decision is prepared (the CFO\'s view is attached to spending)', /CFO: recommends approving|CFO: cannot tell/.test(out.decisions.find((x) => x.kind === 'expense').prep), out.decisions.find((x) => x.kind === 'expense').prep);
  check('Assistant: the owner\'s priorities are carried in the brief', out.priorities.includes('Book audits for Waterbury businesses'));
  check('Assistant: the 30-hour-old escalation is escalated to the owner', (await q("select count(*)::int n from sales_notifications where user_id=$1 and kind='role_executive_assistant_escalation' and subject like 'Waiting 30 h:%'", [owner]))[0].n >= 1);

  // COO: bounded recovery, assignment, prerequisites, escalation of what it may not retry
  const coo = await runRole('coo'); const cooTask = await taskOf(coo.job);
  const fs1 = (await q('select status, payload from jobs where id=$1', [failedSafe]))[0];
  check('COO: a failed maintenance job is put back in the queue once (marked)', ['pending', 'leased', 'completed'].includes(fs1.status) && !!fs1.payload.coo_retried_at, JSON.stringify(fs1));
  check('COO: a failed job that sends messages is not retried; it is escalated', (await q('select status from jobs where id=$1', [failedSend]))[0].status === 'failed' && (await q("select count(*)::int n from sales_notifications where user_id=$1 and kind='role_coo_escalation' and subject like 'A ops_followup_send job failed%'", [owner]))[0].n >= 1);
  const ua = (await q('select status, worker_id from work_items where id=$1', [unassigned]))[0]; const cfoW = (await q("select id from workers where capability_key='cfo' and status='active'"))[0].id;
  check('COO: the unassigned finance task is assigned to the CFO worker (event recorded)', ua.status === 'assigned' && ua.worker_id === cfoW && (await trail(unassigned)).some((e) => /Assigned by the COO/.test(e.reason)), JSON.stringify(ua));
  check('COO: work started before its prerequisite finished is blocked, with the reason', (await q('select status, last_error from work_items where id=$1', [dependent]))[0].status === 'blocked' && (await trail(dependent)).some((e) => /waits on "Collect October receipts"/.test(e.reason)));
  check('COO: its result is saved for review with capacity per worker', cooTask?.status === 'in_review' && Array.isArray((await q('select content from work_item_outputs where work_item_id=$1', [cooTask.id]))[0].content.capacity));

  // durable tasks: full handoff history, and a redelivered job resumes the same task instead of duplicating it
  const h = await trail(cmoTask.id);
  check('every role task has its handoff history: received -> started -> result saved for review', h.map((e) => e.to_status).join('>') === 'assigned>in_progress>in_review' || h.map((e) => e.to_status).join('>') === 'assigned>in_progress>in_progress>in_review', h.map((e) => e.to_status).join('>'));
  process.env.SUPABASE_URL = env.SUPABASE_URL; process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const { runRoleTask } = await import('../../api/_hierarchy/roles.js');
  const again = await runRoleTask('cmo', { orgId: ORG, jobId: cmo.job });
  check('a redelivered job resumes its existing task (no duplicate work, no duplicate proposal)', again.resumed === true && again.work_item_id === cmoTask.id && (await q("select count(*)::int n from work_items where organization_id=$1 and category='proposal:revive'", [ORG]))[0].n === 1 && (await q("select count(*)::int n from expense_requests where organization_id=$1 and requested_by_role='cmo'", [ORG]))[0].n === 1);
  const cmo2 = await runRole('cmo');
  check('running the CMO again the same week adds no second proposal or second test-budget request', cmo2.status === 'completed' && (await q("select count(*)::int n from work_items where organization_id=$1 and category='proposal:revive'", [ORG]))[0].n === 1 && (await q("select count(*)::int n from expense_requests where organization_id=$1 and requested_by_role='cmo'", [ORG]))[0].n === 1);

  // the owner's authority, in the app: approve, then record as paid
  await p.evaluate((org) => { try { localStorage.setItem('nova.currentOrgId', org) } catch { /* ignore */ } }, ORG);
  const flyers = (await q("select id from expense_requests where organization_id=$1 and purpose='LOCAL TEST print flyers'", [ORG]))[0].id;
  const ap = await api('decide-expense', { organization_id: ORG, id: flyers, decision: 'approve' });
  const rec = await api('record-expense', { organization_id: ORG, id: flyers });
  check('the owner approves the CFO-checked expense and records it as paid', ap.status === 200 && rec.status === 200 && (await q('select status, authority from expense_requests where id=$1', [flyers]))[0].status === 'recorded');
  const cfo3 = await runRole('cfo');
  check('a newer CFO result supersedes the unreviewed earlier one (kept, with the reason)', (await q('select status from work_items where id=$1', [cfo1Task.id]))[0].status === 'cancelled' && (await trail(cfo1Task.id)).some((e) => /Superseded by the newer result/.test(e.reason)));
  const mr = await api('mark-reviewed', { organization_id: ORG, id: (await taskOf(cfo3.job)).id });
  check('the owner marks the newest CFO result reviewed: review recorded, task completed', mr.status === 200 && mr.json.work_item.status === 'completed' && (await q('select count(*)::int n from work_item_reviews where work_item_id=$1', [mr.json.work_item.id]))[0].n === 1, JSON.stringify(mr.json));
  check('the CFO\'s next report counts it as spent this month', /spent this month \$75\.00/.test((await taskOf(cfo3.job))?.result?.summary || ''), (await taskOf(cfo3.job))?.result?.summary);

  // the owner's view (Nova's own business): the executive desk lists the roles; iPad width
  await p.goto(`${APP}/dashboard`); await p.getByRole('link', { name: 'Workers' }).first().click();
  check('the Workers page shows the executive desk with the four roles', await seen(p.getByRole('heading', { name: 'Executive desk' })) && await seen(p.getByLabel("Owner's executive assistant role")) && await seen(p.getByLabel('CFO role')));
  await p.setViewportSize({ width: 820, height: 1180 }); await p.waitForTimeout(500);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('no horizontal scrolling on an iPad-sized screen', over <= 1, `${over}px`);
  await p.screenshot({ path: path.join(OUT, 'workers-executive-desk-ipad.png'), fullPage: true });
  check('no page errors', errors.length === 0, errors.join('; '));
  console.log(`  records: CMO task ${cmoTask.id}; CFO task ${cfo1Task.id}; assistant task ${eaTask.id}; COO task ${cooTask.id}`);
} finally {
  if (ORG) {
    // Task history (work_item_events) is append-only by design, so this LOCAL TEST business keeps its tasks and their
    // trail; everything else the test created is removed and the business is marked inactive.
    await q("update work_items set status='cancelled', updated_at=now() where organization_id=$1 and status in ('draft','assigned','blocked')", [ORG]).catch(() => {});
    await q('delete from expense_requests where organization_id=$1', [ORG]);
    for (const t of ['owner_preferences', 'finance_balance_snapshots', 'ops_jobs', 'crm_contacts', 'organization_members']) await q(`delete from ${t} where organization_id=$1`, [ORG]).catch((e) => console.error(t, e.message));
    await q('delete from jobs where organization_id=$1 and id not in (select job_id from work_items where job_id is not null)', [ORG]); // a task keeps the job that ran it
    await q("delete from sales_notifications where kind like 'role_%' and (subject like 'Waiting 30 h:%' or subject like 'A ops_followup_send job failed%' or subject like 'Spending decision: $60.00%' or subject like 'Spending decision: $75.00%' or subject like 'Completed without evidence%')");
    await q("update organizations set status='inactive', updated_at=now() where id=$1", [ORG]).catch((e) => console.error('org', e.message));
  }
  await db.end(); await browser.close();
}
console.log(`\n${pass} passed, ${fail} failed — screenshot: ${OUT}`);
process.exit(fail ? 1 : 0);
