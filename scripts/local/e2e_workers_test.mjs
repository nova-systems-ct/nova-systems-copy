// Workers (owner-reported: "Workforce shows no workers and no usable add path") through VISIBLE CONTROLS on LOCAL STAGING,
// with the REAL background worker running (node scripts/local/staging.mjs worker). Proves: the page lists only capabilities
// backed by code · the owner registers a worker · pausing it holds its queued job (not claimed, not failed) while another
// worker's job still runs · resuming lets the held job complete · a representative cannot register or pause.
// Runs beside the owner's real workers: it registers its own workers only for capabilities the owner has NOT registered
// (follow-up and demand outreach, whose jobs do nothing when their target does not exist), never pauses or changes the
// owner's workers (checked before/after), and retires only its own workers at the end (history is append-only).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { CAPABILITIES } from '../../api/_workerCapabilities.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const read = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = read('.env.local-staging'); const acct = read('.env.local-staging-accounts');
const APP = 'http://localhost:5180';
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const OUT = path.join(os.tmpdir(), 'nova-workers'); fs.mkdirSync(OUT, { recursive: true });
const seen = (loc, t = 15000) => loc.first().waitFor({ state: 'visible', timeout: t }).then(() => true, () => false);
const pg = createRequire(path.join(process.cwd(), '.testenv', 'package.json'))('pg');
const db = new pg.Client({ connectionString: env.LOCAL_DB_URL }); await db.connect();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const beat = (await db.query('select max(last_seen_at) t from worker_runtime_heartbeats')).rows[0].t;
if (!beat || Date.now() - new Date(beat).getTime() > 120_000) { console.error('The local background worker is not running. Start it: node scripts/local/staging.mjs worker'); process.exit(2); }
const ownerBefore = (await db.query("select id, capability_key, status, updated_at from workers where capability_key is not null and status <> 'inactive' order by id")).rows;
const ownerEventsBefore = (await db.query("select count(*)::int n from worker_status_events where worker_id = any($1::uuid[])", [ownerBefore.map((w) => w.id)])).rows[0].n;
// isolated fixtures: two capabilities the owner has not registered, whose jobs complete as "not found" for unknown targets
const FIX = [{ key: 'followup_revive', name: 'Follow-up and Revive worker', type: 'ops_followup_send', target: 'followup_id' }, { key: 'demand_outreach', name: 'Demand outreach worker', type: 'ops_campaign_send', target: 'recipient_id' }];
const taken = FIX.filter((f) => ownerBefore.some((w) => w.capability_key === f.key));
if (taken.length) { console.log(`SKIP — the owner has registered ${taken.map((f) => f.name).join(', ')}; this test never changes the owner's workers.`); console.log('\n0 passed, 0 failed (skipped)'); process.exit(0); }
const tag = `e2e-workers-${Date.now()}`;
// fixture jobs belong to an isolated LOCAL TEST organization (never Nova's), and name a target that does not exist
const TEST_ORG = (await db.query("select id from organizations where name like 'LOCAL TEST%' order by created_at limit 1")).rows[0]?.id;
if (!TEST_ORG) { console.error('No LOCAL TEST organization on this stack: run node scripts/local/staging.mjs provision'); process.exit(2); }
const job = async (f) => (await db.query("insert into jobs (job_type, organization_id, payload, scheduled_at, idempotency_key) values ($1, $2, $3, now(), $4) returning id", [f.type, TEST_ORG, { [f.target]: crypto.randomUUID(), test: tag }, `${tag}:${f.type}:${Math.random()}`])).rows[0].id;
const statusOf = async (id) => (await db.query('select status from jobs where id=$1', [id])).rows[0]?.status;
const waitFor = async (id, want, ms) => { const end = Date.now() + ms; while (Date.now() < end) { if (await statusOf(id) === want) return true; await sleep(1000); } return false; };

const browser = await pw.chromium.launch({ headless: true });
const created = [];
try {
  const p = await (await browser.newContext({ viewport: { width: 1180, height: 820 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${APP}/login`);
  await p.getByLabel('Email').fill(acct.OWNER_EMAIL); await p.getByLabel('Password').fill(acct.OWNER_PASSWORD);
  await p.getByRole('button', { name: /SIGN IN/ }).click(); await p.waitForURL(/\/dashboard/);
  await p.getByRole('link', { name: 'Workers' }).first().click();
  check('Workers opens from the menu and explains who does the work', await seen(p.getByRole('heading', { level: 1, name: 'Who does the work' })));
  check('it lists every code-backed worker and counts only the registered ones', await seen(p.getByText(`${ownerBefore.length} of ${CAPABILITIES.length} workers registered`)));
  check('the hierarchy shows the owner and says coordination is the owner today', await seen(p.getByRole('tree')) && await seen(p.getByText(/the COO worker checks workflow health|register the COO worker to automate workflow checks/)));
  check('readiness names real blockers in plain words (text messages are a dry run)', await seen(p.getByText(/Dry run: replies are recorded, not sent/)));

  for (const { name } of FIX) {
    await p.locator('section', { has: p.getByRole('heading', { name: new RegExp(`^${name}`) }) }).getByRole('button', { name: 'Register this worker' }).click();
    check(`the owner registers the ${name}`, await seen(p.getByText(`${name} registered and active.`)));
  }
  const rows = (await db.query("select id, capability_key, status, worker_type from workers where capability_key in ('followup_revive','demand_outreach') and status <> 'inactive'")).rows; created.push(...rows.map((r) => r.id));
  check('both are saved as active service workers tied to their capability', rows.length === 2 && rows.every((r) => r.status === 'active' && r.worker_type === 'service_account'), JSON.stringify(rows));

  // pause the test's follow-up worker
  const reporting = p.locator('section', { has: p.getByRole('heading', { name: /^Follow-up and Revive worker/ }) });
  await reporting.getByRole('button', { name: 'Pause' }).click();
  await p.getByLabel('Why pause?').fill('Testing that paused work waits');
  await p.getByRole('button', { name: 'Pause now' }).click();
  check('pausing asks for a reason and confirms', await seen(p.getByText(/Follow-up and Revive worker paused\. Its queued work waits/)));
  check('the pause is recorded with its reason', (await db.query("select count(*)::int n from worker_status_events e join workers w on w.id=e.worker_id where w.capability_key='followup_revive' and w.status <> 'inactive' and e.to_status='suspended' and e.reason='Testing that paused work waits'")).rows[0].n === 1);
  await sleep(17_000); // the worker re-reads the registry every 15 s
  const held = await job(FIX[0]); const control = await job(FIX[1]);
  check('a job for an active worker still runs while another worker is paused', await waitFor(control, 'completed', 30_000), await statusOf(control));
  await sleep(8000);
  check('the paused worker’s job is held: still waiting, not claimed, not failed', await statusOf(held) === 'pending', await statusOf(held));
  await p.reload();
  check('the page shows the paused state and the waiting job', await seen(reporting.getByText(/held while paused/)) && await seen(reporting.getByRole('button', { name: 'Resume' })));
  await p.screenshot({ path: path.join(OUT, 'workers-paused.png'), fullPage: true });

  // resume
  await reporting.getByRole('button', { name: 'Resume' }).click();
  check('resume confirms', await seen(p.getByText('Follow-up and Revive worker resumed.')));
  check('after resuming, the held job runs to completion', await waitFor(held, 'completed', 45_000), await statusOf(held));

  // representative cannot change workers
  const repTok = (await (await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: acct.REP_EMAIL, password: acct.REP_PASSWORD }) })).json()).access_token;
  const r1 = await fetch(`${APP}/api/client?resource=hierarchy&op=register-capability`, { method: 'POST', headers: { Authorization: `Bearer ${repTok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ capability_key: 'audit_review' }) });
  const r2 = await fetch(`${APP}/api/client?resource=hierarchy&op=set-worker-status`, { method: 'POST', headers: { Authorization: `Bearer ${repTok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: created[0], status: 'suspended', reason: 'not allowed' }) });
  check('a representative cannot register or pause workers', r1.status === 403 && r2.status === 403, `${r1.status} ${r2.status}`);
  const r3 = await fetch(`${APP}/api/client?resource=hierarchy&op=register-capability`, { method: 'POST', headers: { Authorization: `Bearer ${(await p.evaluate(() => Object.entries(localStorage).find(([k]) => /auth-token/.test(k))?.[1])) ? JSON.parse(await p.evaluate(() => Object.entries(localStorage).find(([k]) => /auth-token/.test(k))[1])).access_token : ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ capability_key: 'ceo_twin' }) });
  check('an unknown or unimplemented role cannot be registered', r3.status === 422, String(r3.status));
  check('no page errors', errors.length === 0, errors.join('; '));
  const ownerAfter = (await db.query("select id, capability_key, status, updated_at from workers where id = any($1::uuid[]) order by id", [ownerBefore.map((w) => w.id)])).rows;
  const ownerEventsAfter = (await db.query("select count(*)::int n from worker_status_events where worker_id = any($1::uuid[])", [ownerBefore.map((w) => w.id)])).rows[0].n;
  check("the owner's own workers were not touched (same status, no new status events)", JSON.stringify(ownerAfter.map((w) => [w.id, w.status, String(w.updated_at)])) === JSON.stringify(ownerBefore.map((w) => [w.id, w.status, String(w.updated_at)])) && ownerEventsAfter === ownerEventsBefore, `${ownerEventsBefore} -> ${ownerEventsAfter}`);
} finally {
  if (created.length) {
    // The status history is append-only by design, so test workers are retired (recorded), not deleted.
    const owner = (await db.query('select id from auth.users where email=$1', [acct.OWNER_EMAIL])).rows[0].id;
    for (const id of created) {
      const w = (await db.query('select status from workers where id=$1', [id])).rows[0];
      await db.query("insert into worker_status_events (worker_id, from_status, to_status, changed_by, reason) values ($1,$2,'inactive',$3,'Retired by the automated workers test')", [id, w.status, owner]);
      await db.query("update workers set status='inactive', updated_at=now() where id=$1", [id]);
    }
  }
  await db.query("delete from jobs where payload->>'test' = $1", [tag]);
  await db.end(); await browser.close();
}
console.log(`\n${pass} passed, ${fail} failed — screenshot: ${OUT}`);
process.exit(fail ? 1 : 0);
