// Owner-reported defect: "Failed to send contract: local api error" on the real contract composer (/dashboard/contracts).
// Root cause (2026-10-26): handleCreate returned `contentHash`/`signatureHash`, variables that exist only in handleSign,
// so every send threw AFTER the contract row was inserted: the owner saw an error and each retry left another pending
// contract. This drives the real composer through visible controls on LOCAL STAGING (real local Supabase):
// save draft → reload → sign out/in → continue draft → send (double click) → one contract, honest delivery status,
// local-inbox copy only, draft hidden from /sign. Test rows use @nova-local.test and are removed at the end.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const read = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = read('.env.local-staging'); const acct = read('.env.local-staging-accounts');
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(env.APP_BASE_URL || 'http://localhost:5180')) throw new Error('local only');
const APP = 'http://localhost:5180';
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const SHOTS = path.join(os.tmpdir(), 'nova-contract-shots'); fs.mkdirSync(SHOTS, { recursive: true });
const shot = (p, n) => p.screenshot({ path: path.join(SHOTS, `${n}.png`), fullPage: true }).catch(() => {});
const seen = (loc, t = 15000) => loc.first().waitFor({ state: 'visible', timeout: t }).then(() => true, () => false);
const pg = createRequire(path.join(process.cwd(), '.testenv', 'package.json'))('pg');
const db = new pg.Client({ connectionString: env.LOCAL_DB_URL }); await db.connect();
const email = `contract-composer+${Date.now()}@nova-local.test`;
const rows = async () => (await db.query('select id, status, delivery_status, delivery_note, client_name, custom_notes from contracts where client_email=$1 order by created_at', [email])).rows;

async function signIn(p) {
  await p.goto(`${APP}/login`);
  await p.getByLabel('Email').fill(acct.OWNER_EMAIL); await p.getByLabel('Password').fill(acct.OWNER_PASSWORD);
  await p.getByRole('button', { name: /SIGN IN/ }).click();
  await p.waitForURL(/\/dashboard/, { timeout: 20000 });
}

const browser = await pw.chromium.launch({ headless: true });
try {
  for (const vp of [{ name: 'laptop', width: 1366, height: 900 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    let dialog = false; p.on('dialog', async (d) => { dialog = true; await d.dismiss(); });
    await signIn(p);
    await p.goto(`${APP}/dashboard/contracts`);
    check('the Contracts page opens for the owner', await seen(p.getByRole('heading', { level: 1, name: 'Contracts' })));
    await p.getByRole('button', { name: 'New contract' }).click();
    await p.getByLabel('Client name').fill('LOCAL TEST Composer Client');
    await p.getByLabel('Client email').fill(email);
    await p.getByLabel('Contract type').selectOption('Growth Package');
    await p.getByLabel(/Scope and terms/).fill('LOCAL TEST scope: three pages and a booking form.');
    await p.getByRole('button', { name: 'Save draft' }).click();
    check('Save draft shows a saved confirmation', await seen(p.getByText(/^Draft saved/)));
    let r = await rows();
    check('the draft is saved in the database as a draft', r.length === 1 && r[0].status === 'draft' && r[0].custom_notes.includes('three pages'), JSON.stringify(r));
    await shot(p, `contract-01-draft-saved-${vp.name}`);

    // reload, then sign out and back in: the draft is still there and reopens with its text
    await p.reload(); await p.evaluate(() => { try { localStorage.removeItem('nova.contracts.unsaved') } catch {} });
    await ctx.clearCookies(); await p.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch {} });
    await signIn(p); await p.goto(`${APP}/dashboard/contracts`);
    check('after sign-out and sign-in the draft is listed', await seen(p.getByText('LOCAL TEST Composer Client')));
    await p.getByRole('button', { name: 'Drafts' }).click();
    await p.getByRole('listitem').filter({ hasText: 'LOCAL TEST Composer Client' }).getByRole('button', { name: 'Continue' }).click();
    check('Continue reopens the draft with its saved text', await p.getByLabel(/Scope and terms/).inputValue() === 'LOCAL TEST scope: three pages and a booking form.' && await p.getByLabel('Client email').inputValue() === email);

    // send with a double click: exactly one contract, no browser alert, honest delivery result
    const send = p.getByRole('button', { name: 'Send for signature' });
    await send.dblclick();
    check('sending shows a result instead of "local api error"', await seen(p.getByText(/Contract sent for signature|Already sent earlier/)), errors.join('; '));
    check('the result says email is in dry-run mode and nothing reached the client', await seen(p.getByText(/dry-run mode, so nothing went to/)));
    check('the result offers the signing link to copy', await seen(p.getByRole('button', { name: /Copy link/ })));
    check('no browser alert was used', !dialog);
    r = await rows();
    check('one contract exists (the draft became it; a double click made no duplicate)', r.length === 1 && r[0].status === 'pending', JSON.stringify(r.map((x) => x.status)));
    check('its delivery is recorded as dry_run, not as sent', r[0]?.delivery_status === 'dry_run', r[0]?.delivery_status);
    await shot(p, `contract-02-sent-${vp.name}`);

    const inbox = await fetch(`${env.LOCAL_MAIL_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`).then((x) => x.json()).catch(() => ({ messages: [] }));
    check('the signing-link email is only a copy in the local test inbox (marked LOCAL TEST — not sent)', (inbox.messages || []).length === 1 && /LOCAL TEST — not sent/.test(inbox.messages[0].Subject), JSON.stringify((inbox.messages || []).map((m) => m.Subject)));

    // sign page: a pending contract opens; a draft does not
    const pub = await fetch(`${APP}/api/contracts?action=get&id=${r[0].id}`);
    check('the client signing page can load the sent contract', pub.status === 200);
    const d2 = (await db.query("insert into contracts (client_name, client_email, contract_type, status, sent_at) values ('LOCAL TEST draft', $1, 'Custom', 'draft', null) returning id", [email])).rows[0];
    const pubDraft = await fetch(`${APP}/api/contracts?action=get&id=${d2.id}`);
    check('a draft is not visible on the public signing page', pubDraft.status === 404, String(pubDraft.status));

    // a server-side failure keeps the text and explains it (simulated by an invalid email the server rejects)
    await p.getByRole('button', { name: 'New contract' }).click();
    await p.getByLabel('Client name').fill('LOCAL TEST Bad Email'); await p.getByLabel('Client email').fill('not-an-email');
    await p.getByLabel('Contract type').selectOption('Custom');
    await p.getByRole('button', { name: 'Send for signature' }).click();
    check('a rejected send shows a specific message and keeps the typed text', await seen(p.getByText(/Not sent: Client name and a valid client email are required/)) && await p.getByLabel('Client name').inputValue() === 'LOCAL TEST Bad Email');
    check('no page errors', errors.length === 0, errors.join('; '));
    await ctx.close();
  }

  // phone width: composer and list fit without horizontal scrolling
  const m = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  await signIn(m); await m.goto(`${APP}/dashboard/contracts`);
  await seen(m.getByRole('heading', { level: 1, name: 'Contracts' }));
  await m.getByRole('button', { name: 'New contract' }).click();
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('on a phone the contracts page has no horizontal scrolling', overflow <= 1, `overflow ${overflow}px`);
  await shot(m, 'contract-03-phone');
} finally {
  await db.query("delete from contracts where client_email like 'contract-composer+%@nova-local.test' or client_email='repro-contract@nova-local.test'");
  await db.end(); await browser.close();
}
console.log(`\n${pass} passed, ${fail} failed — screenshots: ${SHOTS}`);
process.exit(fail ? 1 : 0);
