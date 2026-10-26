// The owner's audit journey through VISIBLE CONTROLS at iPad size, against LOCAL STAGING (real local Supabase, the running
// app on :5180). Owner-reported defects covered: audit information not saving (#3), clock confusing (#2), PDF / Vault (#5),
// test audits that cannot be removed (#6a). The evidence review reads https://example.com (a reserved public test domain)
// so Nova's real records are untouched; it needs internet access. Test rows are named "LOCAL TEST …" and removed at the end.
//   node scripts/local/e2e_audit_journey_test.mjs            (WebKit if installed, else Chromium)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const read = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = read('.env.local-staging'); const acct = read('.env.local-staging-accounts');
const APP = 'http://localhost:5180';
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const OUT = path.join(os.tmpdir(), 'nova-audit-journey'); fs.mkdirSync(OUT, { recursive: true });
const shot = (p, n) => p.screenshot({ path: path.join(OUT, `${n}.png`), fullPage: true }).catch(() => {});
const seen = (loc, t = 15000) => loc.first().waitFor({ state: 'visible', timeout: t }).then(() => true, () => false);
const pdfText = (buf) => { const s = buf.toString('latin1'); let out = ''; for (const m of s.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) { try { out += zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'); } catch { out += m[1]; } } return out; };
const pg = createRequire(path.join(process.cwd(), '.testenv', 'package.json'))('pg');
const db = new pg.Client({ connectionString: env.LOCAL_DB_URL }); await db.connect();
const NAME = `LOCAL TEST Journey Example ${Date.now().toString(36)}`;
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

let engine = 'webkit'; let browser;
try { browser = await pw.webkit.launch({ headless: true }); } catch { engine = 'chromium'; browser = await pw.chromium.launch({ headless: true }); }
console.log(`browser: ${engine}`);
const IPAD = { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true, isMobile: engine !== 'webkit' ? true : undefined, acceptDownloads: true };
async function signIn(p) {
  await p.goto(`${APP}/login`);
  await p.getByLabel('Email').fill(acct.OWNER_EMAIL); await p.getByLabel('Password').fill(acct.OWNER_PASSWORD);
  await p.getByRole('button', { name: /SIGN IN/ }).click();
  await p.waitForURL(/\/dashboard/, { timeout: 20000 });
}
try {
  let ctx = await browser.newContext(IPAD);
  let p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  let dialogs = 0; p.on('dialog', async (d) => { dialogs++; await d.dismiss(); });
  await signIn(p);

  // 1. start from five details
  await p.goto(`${APP}/dashboard/audit`);
  await p.getByRole('button', { name: 'New audit' }).click();
  await p.getByLabel('Business name (required)').fill(NAME);
  await p.getByLabel('Website').fill('example.com');
  await p.getByLabel('Industry').fill('Reserved test domain');
  await p.getByLabel('City / area').fill('Waterbury, CT');
  await p.getByLabel('Main phone').fill('(203) 555-0100');
  await shot(p, '01-new-audit-ipad');
  await p.getByRole('button', { name: 'Start audit' }).click();
  await p.waitForURL(/\/dashboard\/audit\/[0-9a-f-]{36}/, { timeout: 20000 });
  const caseId = p.url().match(/audit\/([0-9a-f-]{36})/)[1];
  check('five details start an audit and open it', await seen(p.getByRole('heading', { level: 1, name: NAME })));
  check('the overview lists next steps, details, evidence review, findings, report and the clock', await seen(p.getByRole('heading', { name: 'Next steps' })) && await seen(p.getByRole('heading', { name: 'Business details' })) && await seen(p.getByRole('heading', { name: 'Evidence review' })) && await seen(p.getByRole('heading', { name: 'Delivery clock' })));
  check('the clock says why it has not started and offers the next action', await seen(p.getByText(/Not started\. No delivery policy/)) && await seen(p.getByRole('button', { name: 'Review the proposed policy' })));

  // 2. a duplicate start is caught
  await p.goto(`${APP}/dashboard/audit`);
  await p.getByRole('button', { name: 'New audit' }).click();
  await p.getByLabel('Business name (required)').fill(NAME); await p.getByLabel('Website').fill('example.com');
  await p.getByRole('button', { name: 'Start audit' }).click();
  check('starting the same business again offers the open audit instead of duplicating it', await seen(p.getByRole('button', { name: 'Open the existing audit' })));
  await p.getByRole('button', { name: 'Open the existing audit' }).click();
  await p.waitForURL(new RegExp(caseId));

  // 3. unsaved detail survives reload; saved detail survives sign-out
  await p.getByLabel('Main phone').fill('(203) 555-0199');
  check('an edit shows "Not saved yet"', await seen(p.getByText('Not saved yet')));
  await p.reload();
  check('after a reload the unsaved edit is still on screen', await p.getByLabel('Main phone').inputValue().catch(() => '') === '(203) 555-0199');
  await p.getByRole('button', { name: 'Save details' }).click();
  check('Save details confirms the save', await seen(p.getByText(/^Saved \d/)));
  const intake = (await db.query('select intake from audit_cases where id=$1', [caseId])).rows[0].intake;
  check('the saved detail is in the database', intake.public_phone === '(203) 555-0199' && intake.website === 'https://example.com/', JSON.stringify(intake));

  // 4. evidence review
  await p.getByRole('button', { name: /Run website and email review/ }).click();
  check('the review reports what it checked', await seen(p.getByText(/^Checked \d+ things on/), 45000), errors.join('; '));
  const ev = (await db.query("select count(*)::int n from audit_evidence where case_id=$1 and method like 'automated_review:%'", [caseId])).rows[0].n;
  check('evidence records were saved with their sources', ev >= 3, `evidence ${ev}`);
  await shot(p, '02-after-review-ipad');

  // 5. findings: review one
  await p.getByRole('tab', { name: /Findings/ }).click();
  const proposed = (await db.query("select count(*)::int n from audit_findings where case_id=$1 and origin='automated_review' and review_status='draft'", [caseId])).rows[0].n;
  if (proposed) {
    await p.getByRole('button', { name: 'Confirm (mark reviewed)' }).first().click();
    await p.waitForTimeout(1200);
    const rv = (await db.query("select count(*)::int n from audit_findings where case_id=$1 and review_status='reviewed'", [caseId])).rows[0].n;
    check('a proposed finding can be confirmed and the confirmation is saved', rv === 1, `reviewed ${rv}`);
  } else check('the review proposed at least one finding to confirm (example.com shows no contact path)', false, 'none proposed');

  // 6. draft report + PDF in the Vault
  await p.getByRole('tab', { name: 'Overview' }).click();
  await p.getByRole('button', { name: /Draft the report/ }).click();
  check('the report is drafted from the recorded evidence', await seen(p.getByText(/Version 1 drafted from the recorded evidence/)));
  await p.getByRole('button', { name: /Generate PDF/ }).click();
  check('Generate PDF saves it in the Vault', await seen(p.getByText(/^Saved in the Vault: Nova-Audit-/), 30000));
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.getByRole('button', { name: 'Download' }).first().click()]);
  const file = path.join(OUT, 'downloaded-audit.pdf'); await dl.saveAs(file);
  const buf = fs.readFileSync(file);
  check('Download delivers a real PDF', buf.subarray(0, 5).toString() === '%PDF-' && buf.length > 20000, `${buf.length} bytes`);
  const txt = pdfText(buf);
  check('the PDF names the business and is stamped as a draft', txt.includes('LOCAL TEST Journey Example') && txt.includes('DRAFT - NOT APPROVED'));
  const vd = (await db.query('select report_version, report_status, organization_id is not null org from vault_documents where audit_case_id=$1', [caseId])).rows;
  check('one Vault record exists for version 1 (draft), scoped to the organization', vd.length === 1 && vd[0].report_version === 1 && vd[0].report_status === 'draft' && vd[0].org, JSON.stringify(vd));
  check('no browser alert or confirm dialog was used', dialogs === 0, `${dialogs}`);
  check('no horizontal scrolling at iPad portrait', (await overflow(p)) <= 1);
  await shot(p, '03-pdf-saved-ipad');

  // 7. sign out, sign back in: everything is still there; the Vault opens it
  await ctx.close(); ctx = await browser.newContext(IPAD); p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message));
  await signIn(p); await p.goto(`${APP}/dashboard/audit/${caseId}`);
  check('after signing in again: details, evidence count and the stored PDF are shown', await seen(p.getByRole('heading', { level: 1, name: NAME })) && await p.getByLabel('Main phone').inputValue() === '(203) 555-0199' && await seen(p.getByRole('button', { name: 'Download' })));
  await p.goto(`${APP}/dashboard/nova-vault`);
  await p.waitForTimeout(2500); await shot(p, '06-vault-ipad');
  const row = p.getByText(/Nova-Audit-LOCAL-TEST-Journey-Example/).first();
  check('the PDF is listed in the Nova Vault', await seen(row));
  const [vdl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.getByRole('button', { name: /^Download Nova-Audit-LOCAL-TEST-Journey-Example/ }).first().click()]);
  const vfile = path.join(OUT, 'vault-download.pdf'); await vdl.saveAs(vfile);
  check('the Vault download returns the same PDF bytes', fs.readFileSync(vfile).equals(buf), `${fs.statSync(vfile).size} vs ${buf.length}`);

  // 8. archive and restore
  await p.goto(`${APP}/dashboard/audit/${caseId}`);
  await p.getByRole('button', { name: 'Archive' }).click();
  check('the audit can be archived', await seen(p.getByText(/This audit is archived/)));
  await p.goto(`${APP}/dashboard/audit`);
  check('an archived audit leaves the open list', !(await seen(p.getByText(NAME), 3000)));
  await p.getByRole('button', { name: /Archived \(/ }).click();
  check('and is shown under Archived', await seen(p.getByText(NAME)));
  await p.getByText(NAME).click(); await p.getByRole('button', { name: 'Restore' }).click();
  check('and can be restored', await seen(p.getByRole('button', { name: 'Archive' })));

  // 9. landscape iPad and phone fit
  await p.setViewportSize({ width: 1180, height: 820 });
  check('no horizontal scrolling at iPad landscape', (await overflow(p)) <= 1);
  await shot(p, '04-overview-ipad-landscape');
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
  await signIn(phone); await phone.goto(`${APP}/dashboard/audit/${caseId}`);
  await seen(phone.getByRole('heading', { level: 1, name: NAME }));
  check('no horizontal scrolling on a phone', (await overflow(phone)) <= 1, `${await overflow(phone)}px`);
  await shot(phone, '05-overview-phone');
  check('no page errors', errors.length === 0, errors.join('; '));
} finally {
  const ids = (await db.query("select c.id from audit_cases c where c.intake->>'name' like 'LOCAL TEST Journey Example%'")).rows.map((x) => x.id);
  if (ids.length) {
    const paths = (await db.query('select storage_path from vault_documents where audit_case_id = any($1::uuid[])', [ids])).rows.map((x) => x.storage_path);
    for (const sp of paths) await fetch(`${env.SUPABASE_URL}/storage/v1/object/nova-vault/${sp}`, { method: 'DELETE', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
    await db.query('delete from vault_documents where audit_case_id = any($1::uuid[])', [ids]);
    await db.query('delete from audit_finding_evidence where finding_id in (select id from audit_findings where case_id = any($1::uuid[]))', [ids]);
    for (const t of ['audit_findings', 'audit_evidence', 'audit_reports']) await db.query(`delete from ${t} where case_id = any($1::uuid[])`, [ids]);
    await db.query('delete from audit_cases where id = any($1::uuid[])', [ids]);
  }
  await db.query("delete from businesses where name like 'LOCAL TEST Journey Example%'");
  await db.end(); await browser.close();
}
console.log(`\n${pass} passed, ${fail} failed (${engine}) — screenshots and PDF: ${OUT}`);
process.exit(fail ? 1 : 0);
