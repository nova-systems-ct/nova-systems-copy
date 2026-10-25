// In-person audit capture on an iPad-sized touch browser against LOCAL STAGING (real local Supabase + Storage).
// Uses a LOCAL TEST audit — never Nova's own audit. Checks: a note is saved as evidence; an owner statement is labelled
// as one; progress survives a reload; a photo is stored privately and opens only through a signed link; a typed draft
// survives a reload; with the connection dropped the screen says "Not saved" and keeps the text; saving works again
// once the connection returns. Credentials come from the git-ignored accounts file and are never printed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), '.testenv', 'package.json'));
const pw = require('playwright'); const pg = require('pg');
const rd = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = rd('.env.local-staging'); const acct = rd('.env.local-staging-accounts');
const APP = process.env.BASE || env.APP_BASE_URL;
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const SHOTS = path.join(os.tmpdir(), 'nova-capture-shots'); fs.mkdirSync(SHOTS, { recursive: true });
const db = new pg.Client({ connectionString: env.LOCAL_DB_URL }); await db.connect();
const seen = (loc, t = 15000) => loc.first().waitFor({ state: 'visible', timeout: t }).then(() => true, () => false);

const tok = (await (await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: acct.OWNER_EMAIL, password: acct.OWNER_PASSWORD }) })).json()).access_token;
const nova = (await db.query("select id from organizations where kind='nova_internal' limit 1")).rows[0].id;
const biz = (await db.query("insert into businesses (organization_id, name, city, state) values ($1,$2,'Waterbury','CT') returning id", [nova, `LOCAL TEST Capture Co ${Date.now().toString(36)}`])).rows[0].id;
const created = await (await fetch(`${env.APP_BASE_URL}/api/client?resource=audit&op=cases`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ organization_id: nova, action: 'create', business_id: biz, scope: '360' }) })).json();
const caseId = created.case.id;
// a real JPEG (1x1 px) for the camera input
const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const jpegFile = path.join(SHOTS, 'tiny.jpg'); fs.writeFileSync(jpegFile, jpeg);

const browser = await pw.chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 1366 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${APP}/login`); await p.getByLabel('Email').fill(acct.OWNER_EMAIL); await p.getByLabel('Password').fill(acct.OWNER_PASSWORD);
  await p.getByRole('button', { name: /SIGN IN/ }).click(); await p.waitForURL(/\/dashboard/, { timeout: 20000 });
  await p.goto(`${APP}/dashboard/audit/${caseId}`);
  await p.getByRole('link', { name: 'In-person capture' }).click();
  check('the audit page opens the in-person capture screen', await seen(p.getByRole('heading', { name: /Nova Audit/ })) && await seen(p.getByText('0 of 18 items')));

  await p.getByLabel('Source').selectOption('owner_said');
  await p.getByLabel(/What the owner said/).fill('About 20 calls a week go to voicemail after 5 pm.');
  await p.getByRole('button', { name: 'Save' }).click();
  check('a note is saved and progress counts it', await seen(p.getByText('Saved', { exact: false })) && await seen(p.getByText('1 of 18 items')));
  const row = (await db.query("select observation, source, method, confidence from audit_evidence where case_id=$1 order by created_at desc limit 1", [caseId])).rows[0];
  check('the owner’s words are saved as the owner’s statement, with the area and item', /^Owner said: About 20 calls/.test(row?.observation || '') && /Owner said/.test(row.source) && row.method === 'in_person:intake:profile', JSON.stringify(row));

  await p.reload(); check('progress survives a reload (it is saved on the server)', await seen(p.getByText('1 of 18 items')));

  await p.getByRole('button', { name: /Booking/ }).click();
  await p.getByRole('button', { name: /After hours/ }).click();
  await p.getByLabel('What you observed').fill('Front desk sign: phone only, no online booking.');
  await p.locator('input[type=file]').setInputFiles(jpegFile);
  await seen(p.getByRole('img', { name: 'Photo to be saved' }));
  await p.getByRole('button', { name: 'Save' }).click();
  await seen(p.getByText('2 of 18 items'));
  const ph = (await db.query("select id, snapshot_path from audit_evidence where case_id=$1 and snapshot_path is not null", [caseId])).rows[0];
  check('a photo is stored privately with its evidence record', !!ph && /^audit\//.test(ph.snapshot_path));
  const pub = await fetch(`${env.SUPABASE_URL}/storage/v1/object/public/ops-private/${ph?.snapshot_path}`);
  const signed = await (await fetch(`${env.APP_BASE_URL}/api/client?resource=audit&op=evidence-photo&organization_id=${nova}&case_id=${caseId}&evidence_id=${ph?.id}`, { headers: { Authorization: `Bearer ${tok}` } })).json();
  const img = signed.url ? await fetch(signed.url) : null;
  check('the photo is not public; it opens only through a short-lived signed link', pub.status >= 400 && img?.status === 200 && signed.expires_in_seconds === 300, `${pub.status} ${img?.status}`);
  const anon = await fetch(`${env.APP_BASE_URL}/api/client?resource=audit&op=evidence-photo&organization_id=${nova}&case_id=${caseId}&evidence_id=${ph?.id}`);
  check('without sign-in the photo link is refused', anon.status === 401 || anon.status === 403, String(anon.status));

  await p.getByRole('button', { name: /Payments/ }).click();
  await p.getByLabel('What you observed').fill('Draft: deposits taken by cash only');
  await p.reload();
  await p.getByRole('button', { name: /Payments/ }).click();
  check('a typed draft survives a reload on this device', (await p.getByLabel('What you observed').inputValue()) === 'Draft: deposits taken by cash only');

  await ctx.setOffline(true);
  await p.getByRole('button', { name: 'Save' }).click();
  const offlineMsg = await seen(p.getByText(/Not saved/), 10000);
  check('with the connection dropped it says "Not saved" and keeps the text', offlineMsg && (await p.getByLabel('What you observed').inputValue()) === 'Draft: deposits taken by cash only');
  await ctx.setOffline(false);
  await p.getByRole('button', { name: 'Save' }).click();
  check('once the connection returns, saving works and the draft is cleared', await seen(p.getByText('3 of 18 items')) && (await p.getByLabel('What you observed').inputValue()) === '');
  await p.screenshot({ path: path.join(SHOTS, 'capture-ipad.png'), fullPage: true });
  const fits = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check('the capture screen fits an iPad in portrait without sideways scrolling', fits);
  check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 200));
} catch (e) { fail++; console.log('FAIL — run crashed:', e.stack || e); }
finally { await browser.close(); await db.end(); }
console.log(`\n${pass} passed, ${fail} failed — in-person audit capture on LOCAL STAGING (iPad size). Screenshots: ${SHOTS}`);
process.exitCode = fail ? 1 : 0;
