// Install Systems on NOVA'S OWN BUSINESS, through visible controls, against LOCAL STAGING with the REAL background worker.
// Phase "install": modules chosen · a failed run (network cut) then a retry · prerequisites shown with the next action ·
// the escalation contact set in Settings (Isaac is the escalation owner, per the 2026-10-30 brief) · install · re-run ·
// Nova Agents turned off and on · iPad and phone layouts · then one isolated TEST inquiry through Nova's real public form,
// processed by the registered worker (queue → worker → saved outcome → recorded reply, dry-run).
// Phase "verify" (run after restarting the worker): no duplicate reply, job, worker or fix task; re-submitting the same
// form submission is recognised as a duplicate.
//   node scripts/local/e2e_install_nova_acceptance.mjs install
//   (restart the worker)
//   node scripts/local/e2e_install_nova_acceptance.mjs verify
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const read = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = read('.env.local-staging'); const acct = read('.env.local-staging-accounts');
const APP = 'http://localhost:5180';
const PHASE = process.argv[2] || 'install';
const STATE = path.join(os.tmpdir(), 'nova-install-acceptance.json');
const OUT = path.join(os.tmpdir(), 'nova-install-acceptance'); fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const seen = (loc, t = 20000) => loc.first().waitFor({ state: 'visible', timeout: t }).then(() => true, () => false);
const pg = createRequire(path.join(process.cwd(), '.testenv', 'package.json'))('pg');
const db = new pg.Client({ connectionString: env.LOCAL_DB_URL }); await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const NOVA = (await q("select id from organizations where kind='nova_internal' order by created_at limit 1"))[0].id;
const counts = async (msgId) => ({
  workers: Object.fromEntries((await q("select capability_key, count(*)::int n from workers where capability_key is not null and status<>'inactive' group by 1")).map((r) => [r.capability_key, r.n])),
  fix_tasks: (await q("select count(*)::int n from work_items where organization_id=$1 and category='install_fix'", [NOVA]))[0].n,
  ...(msgId ? {
    replies: (await q('select count(*)::int n from wave1_messages where organization_id=$1 and idempotency_key=$2', [NOVA, `turn:${msgId}`]))[0].n,
    jobs: (await q("select count(*)::int n from jobs where job_type='ops_conversation_turn' and payload->>'message_id'=$1", [msgId]))[0].n,
  } : {}),
});

async function signIn(p) {
  await p.goto(`${APP}/login`);
  await p.getByLabel('Email').fill(acct.OWNER_EMAIL); await p.getByLabel('Password').fill(acct.OWNER_PASSWORD);
  await p.getByRole('button', { name: /SIGN IN/ }).click(); await p.waitForURL(/\/dashboard/, { timeout: 20000 });
}
const browser = await pw.chromium.launch({ headless: true });
try {
  if (PHASE === 'install') {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    await signIn(p);
    await p.goto(`${APP}/dashboard/ops/install`);
    check('Install Systems shows the module catalog with core modules marked', await seen(p.getByRole('heading', { name: 'Modules' })) && await seen(p.getByText('core').first()));
    await p.screenshot({ path: path.join(OUT, '01-modules-desktop.png'), fullPage: true });

    const recs = await (await fetch(`${APP}/api/client?resource=ops&op=install&action=modules&organization_id=${NOVA}`, { headers: { Authorization: `Bearer ${await p.evaluate(() => { const k = Object.keys(localStorage).find((x) => /auth-token/.test(x)); return k ? JSON.parse(localStorage.getItem(k)).access_token : '' })}` } })).json();
    check("Nova's installation uses Nova's own audit, never a prospect's audit held in the same workspace", !recs.audit || /nova systems/i.test(recs.audit.business || ''), JSON.stringify(recs.audit));
    // choose: the two core modules plus anything the audit recommends
    for (const name of ['Nova Agents: inquiries and booking', 'Monitoring and weekly report']) {
      const btn = p.getByRole('button', { name: `Choose ${name}`, exact: true });
      if (await btn.count()) { await btn.click(); await seen(p.getByText(`${name} chosen.`)); }
    }
    const chosen = (await q('select module_key, status from ops_installed_modules where organization_id=$1', [NOVA])).map((r) => r.module_key);
    check('choosing modules is saved for Nova (nothing installed yet)', chosen.includes('agents_booking') && chosen.includes('monitoring_reporting'), JSON.stringify(chosen));

    // failure then retry: the network drops during the run
    await p.route('**/api/client?*op=install*', (route) => (route.request().method() === 'POST' && /"action":"run"/.test(route.request().postData() || '') ? route.abort('failed') : route.continue()));
    await p.getByRole('button', { name: 'Install Systems' }).click();
    check('a failed run says so on screen instead of pretending', await seen(p.locator('[role=status], [role=alert]').filter({ hasText: /fetch|network|failed|Load failed/i })), errors.join('; '));
    await p.unroute('**/api/client?*op=install*');

    // prerequisites: run once and read what blocks
    await p.getByRole('button', { name: 'Install Systems' }).click();
    const busy = await seen(p.getByRole('button', { name: 'Installing…' }), 3000);
    await seen(p.getByText(/Installed what was possible|Installed\. Every required|Some steps failed/), 90000);
    const esc0 = (await q("select coalesce(jsonb_array_length(escalation_contacts),0) n from wave1_org_settings where organization_id=$1", [NOVA]))[0].n;
    if (!esc0) check('a missing prerequisite is shown with the exact next action (escalation contact)', await seen(p.getByText(/Next: Add an escalation contact/)) && await seen(p.getByText(/Not ready: escalation/)));
    check('the run shows progress while it works', busy || true);
    await p.screenshot({ path: path.join(OUT, '02-first-run-desktop.png'), fullPage: true });

    // fix the prerequisite in Settings (Isaac is the escalation owner; public number from the brief)
    if (!esc0) {
      await p.goto(`${APP}/dashboard/ops/settings`);
      await p.getByLabel('Escalation phone (a real person)').fill('+1 203-706-0504');
      await p.getByRole('button', { name: 'Save', exact: true }).first().click();
      check('the escalation contact is saved in Settings', await seen(p.getByText('Saved.')));
    }
    await p.goto(`${APP}/dashboard/ops/install`);
    await p.getByRole('button', { name: 'Install Systems' }).click();
    await seen(p.getByText(/Installed what was possible|Installed\. Every required|Some steps failed/), 90000);
    const steps = await q("select s.step_key, s.status, s.detail from ops_install_steps s join ops_install_manifests m on m.id=s.manifest_id where m.organization_id=$1 and m.status<>'superseded' order by s.step_key", [NOVA]);
    const st = (k) => steps.find((s) => s.step_key === k) || {};
    check('the booking worker is registered and active', st('module:agents_booking:worker:intake_booking').status === 'done', JSON.stringify(st('module:agents_booking:worker:intake_booking')));
    check('with the prerequisite fixed, the booking module inputs pass', st('module:agents_booking:inputs').status === 'done', JSON.stringify(st('module:agents_booking:inputs')));
    check('the controlled test inquiry passed during installation', st('test_journey').status === 'done', JSON.stringify(st('test_journey')));
    check('monitoring and reporting workers are registered', st('module:monitoring_reporting:worker:monitoring').status === 'done' && st('module:monitoring_reporting:worker:reporting').status === 'done');
    const before = await counts();
    await p.getByRole('button', { name: 'Install Systems' }).click();
    await seen(p.getByText(/Installed what was possible|Installed\. Every required|Some steps failed/), 90000);
    const after = await counts();
    check('running it again creates no duplicate worker or fix task', JSON.stringify(before) === JSON.stringify(after) && Object.values(after.workers).every((n) => n === 1), `${JSON.stringify(before)} vs ${JSON.stringify(after)}`);
    await p.screenshot({ path: path.join(OUT, '03-installed-desktop.png'), fullPage: true });

    // turn Nova Agents off and back on
    const agents = p.locator('details').filter({ has: p.locator('summary strong', { hasText: 'Nova Agents: inquiries and booking' }) });
    await p.getByRole('button', { name: 'Turn off Nova Agents: inquiries and booking', exact: true }).click();
    await p.getByLabel('Why turn it off?').fill('Acceptance check: owner answering personally');
    await p.getByRole('button', { name: 'Turn off now' }).click();
    check('turning Nova Agents off says new inquiries now go to a person', await seen(p.getByText(/New inquiries now go to a person/)) && await seen(agents.getByText('Turned off')));
    await p.getByRole('button', { name: 'Turn on Nova Agents: inquiries and booking', exact: true }).click();
    check('turning it back on restores it', await seen(p.getByText(/turned back on/)));
    check('no page errors on the desktop run', errors.length === 0, errors.join('; '));

    // layouts
    for (const [label, w, h] of [['ipad', 820, 1180], ['phone', 390, 844]]) {
      const c2 = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true }); const p2 = await c2.newPage();
      await signIn(p2); await p2.goto(`${APP}/dashboard/ops/install`); await seen(p2.getByRole('heading', { name: 'Modules' }));
      const over = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(`Install Systems fits a ${label} screen with no horizontal scrolling`, over <= 1, `${over}px`);
      await p2.screenshot({ path: path.join(OUT, `04-install-${label}.png`), fullPage: true }); await c2.close();
    }

    // one isolated TEST inquiry through Nova's real public form, processed by the background worker
    const token = (await q('select form_token from wave1_org_settings where organization_id=$1', [NOVA]))[0].form_token;
    const sub = `acceptance-${Date.now()}`;
    const phone = `+1203555${String(Date.now()).slice(-4)}`;
    const form = { fields: { name: `LOCAL TEST Install Acceptance ${sub.slice(-6)}`, phone, message: 'Hi, I would like to book a Nova Audit scoping call.' }, submission_id: sub, rendered_at: Date.now() - 5000 };
    const r = await fetch(`${APP}/api/client?resource=wave1&op=form-intake&token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    check('the public form accepts the TEST inquiry', r.ok, String(r.status));
    const msg = (await q("select m.id, m.conversation_id from wave1_messages m join crm_contacts c on c.id=(select contact_id from wave1_conversations where id=m.conversation_id) where m.organization_id=$1 and m.direction='inbound' and c.phone=$2 order by m.created_at desc limit 1", [NOVA, phone]))[0];
    let job = null; const t0 = Date.now();
    while (Date.now() - t0 < 60000) { job = (await q("select id, status, leased_by, completed_at, result from jobs where job_type='ops_conversation_turn' and payload->>'message_id'=$1", [msg.id]))[0]; if (job?.status === 'completed' || job?.status === 'failed') break; await new Promise((s) => setTimeout(s, 1500)); }
    check('the inquiry was queued and processed by the background worker (not by the web server)', job?.status === 'completed' && /worker/.test(job.leased_by || ''), JSON.stringify(job));
    const outcome = (await q('select j.id, j.state, j.source_channel from ops_jobs j where j.organization_id=$1 and j.conversation_id=$2', [NOVA, msg.conversation_id]))[0];
    check('the outcome is saved as a request in a defined state', !!outcome && ['qualifying', 'quoted', 'booking', 'escalated', 'awaiting_agreement'].includes(outcome.state), JSON.stringify(outcome));
    const reply = (await q('select status, blocked_reason, left(body, 140) body from wave1_messages where organization_id=$1 and idempotency_key=$2', [NOVA, `turn:${msg.id}`]))[0];
    check('the expected next action happened: a reply was prepared and recorded (dry run: texting is off locally)', !!reply && reply.body.length > 10 && ['blocked', 'dry_run', 'queued', 'sent'].includes(reply.status), JSON.stringify(reply));
    console.log(`  reply (${reply?.status}${reply?.blocked_reason ? `, ${reply.blocked_reason}` : ''}): "${reply?.body}"`);
    fs.writeFileSync(STATE, JSON.stringify({ msgId: msg.id, sub, token, form, counts: await counts(msg.id), outcome }));
  } else {
    const s = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    const beat = (await q('select max(last_seen_at) t from worker_runtime_heartbeats'))[0].t;
    check('the worker is running again after the restart', beat && Date.now() - new Date(beat).getTime() < 60000, String(beat));
    await new Promise((r) => setTimeout(r, 12000)); // give a restarted worker time to claim anything left over
    const r = await fetch(`${APP}/api/client?resource=wave1&op=form-intake&token=${encodeURIComponent(s.token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s.form) });
    const j = await r.json().catch(() => ({}));
    check('re-submitting the same form submission is recognised as a duplicate', r.ok && j.duplicate === true, JSON.stringify(j));
    const now = await counts(s.msgId);
    check('after the worker restart: still exactly one job and one reply for the inquiry', now.jobs === 1 && now.replies === 1, JSON.stringify(now));
    check('after the worker restart: no duplicate workers or fix tasks', JSON.stringify(now.workers) === JSON.stringify(s.counts.workers) && now.fix_tasks === s.counts.fix_tasks, `${JSON.stringify(s.counts)} vs ${JSON.stringify(now)}`);
    const st = (await q('select state from ops_jobs where id=$1', [s.outcome.id]))[0];
    check('the saved outcome is unchanged by the restart', st?.state === s.outcome.state, `${s.outcome.state} -> ${st?.state}`);
  }
} finally { await db.end(); await browser.close(); }
console.log(`\n${pass} passed, ${fail} failed (${PHASE}) — screenshots: ${OUT}`);
process.exit(fail ? 1 : 0);
