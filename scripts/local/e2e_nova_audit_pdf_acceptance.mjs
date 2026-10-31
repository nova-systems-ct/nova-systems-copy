// Nova's own saved audit, through visible controls on LOCAL STAGING: reopen it · complete public details (facts from the
// owner brief) · run public research on nova-systems.app (real internet, public sources only) · draft a report version ·
// generate its PDF · open it from the Nova Vault page · reload and sign in again: everything is still there.
// Writes the downloaded PDF for visual inspection.  node scripts/local/e2e_nova_audit_pdf_acceptance.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const read = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = read('.env.local-staging'); const acct = read('.env.local-staging-accounts');
const APP = 'http://localhost:5180';
const OUT = path.join(os.tmpdir(), 'nova-audit-pdf-acceptance'); fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const seen = (loc, t = 20000) => loc.first().waitFor({ state: 'visible', timeout: t }).then(() => true, () => false);
const pg = createRequire(path.join(process.cwd(), '.testenv', 'package.json'))('pg');
const db = new pg.Client({ connectionString: env.LOCAL_DB_URL }); await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const CASE = (await q("select c.id from audit_cases c join businesses b on b.id=c.business_id where b.name='Nova Systems (own business)' and (select count(*) from audit_findings f where f.case_id=c.id) > 0 order by c.created_at limit 1"))[0].id;
async function signIn(p) {
  await p.goto(`${APP}/login`);
  await p.getByLabel('Email').fill(acct.OWNER_EMAIL); await p.getByLabel('Password').fill(acct.OWNER_PASSWORD);
  await p.getByRole('button', { name: /SIGN IN/ }).click(); await p.waitForURL(/\/dashboard/, { timeout: 20000 });
}
const browser = await pw.chromium.launch({ headless: true });
try {
  let ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  let p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await signIn(p);
  await p.goto(`${APP}/dashboard/audit/${CASE}`);
  check("Nova's saved audit reopens", await seen(p.getByRole('heading', { level: 1, name: /Nova Systems/ })));
  const loc = p.getByLabel('City / area'); const ind = p.getByLabel('Industry or main service');
  let changed = false;
  if (!(await loc.inputValue())) { await loc.fill('Waterbury, CT'); changed = true; }
  if (!(await ind.inputValue())) { await ind.fill('Business systems and operations consulting'); changed = true; }
  if (changed) { await p.getByRole('button', { name: 'Save details' }).click(); check('the added public details are saved', await seen(p.getByText(/^Saved \d/))); }
  const runsBefore = (await q('select count(*)::int n from audit_research_runs where case_id=$1', [CASE]))[0].n;
  const t0 = (await q('select now() t'))[0].t;
  await p.getByRole('button', { name: /Run (the )?(public )?research( again)?/ }).first().click();
  check('public research runs with visible step progress', await seen(p.getByRole('list', { name: 'Research progress' })));
  // the previous run's result text can already be on screen: wait for THIS run's row to reach an end state first
  let run = null;
  for (let t = Date.now(); Date.now() - t < 240000; await new Promise((r) => setTimeout(r, 2000))) {
    run = (await q("select status, steps, summary from audit_research_runs where case_id=$1 and created_at >= $2 order by created_at desc limit 1", [CASE, t0]))[0];
    if (run && !['queued', 'running'].includes(run.status)) break;
  }
  check('public research finishes and reports what it read', run && !['queued', 'running'].includes(run.status) && await seen(p.getByText(/page\(s\) read, \d+ competitor website\(s\) compared/)), errors.join('; '));
  check('the research run is saved with an end state for every step', (await q('select count(*)::int n from audit_research_runs where case_id=$1', [CASE]))[0].n === runsBefore + 1 && run.steps.every((x) => !['pending', 'running'].includes(x.status)), `runs ${runsBefore} -> ${(await q('select count(*)::int n from audit_research_runs where case_id=$1', [CASE]))[0].n}`);
  console.log(`  research: ${run.status}; ${run.steps.map((x) => `${x.key}=${x.status}${x.note ? ` (${x.note})` : ''}`).join('; ')}`);

  // research conclusions (owner brief step 6): correct business and domain; what could not be seen is "not checked",
  // never "missing"; a proposal that repeats a reviewed finding is not added again; listing coverage is stated
  const own = (await q("select title, review_status, origin, check_key, limitations from audit_findings where case_id=$1", [CASE]));
  check('the research read the business\'s own domain', run.summary.pages_read > 0 && (await q("select count(*)::int n from audit_evidence where case_id=$1 and source like 'Public web page https://nova-systems.app%' and method like $2", [CASE, `%${(await q('select id from audit_research_runs where case_id=$1 order by created_at desc limit 1', [CASE]))[0].id.slice(0, 8)}%`]))[0].n > 0);
  check('nova-systems.app is recognized as built by JavaScript and read in a headless browser', run.summary.rendered_by_script === true && run.summary.read_with === 'browser', JSON.stringify({ r: run.summary.read_with, n: run.summary.limitations }).slice(0, 300));
  check('identity is verified before the site is evaluated (the site names Nova Systems)', ['confirmed', 'likely'].includes(run.summary.identity_verdict) && run.steps.find((x) => x.key === 'verify')?.status === 'done', String(run.summary.identity_verdict));
  check('what the browser measured is used: the tap-to-call link on the site is seen', run.summary.client_features?.click_to_call === true, JSON.stringify(run.summary.client_features));
  const staleTel = own.filter((f) => f.origin === 'automated_review' && f.review_status !== 'rejected' && /^click_to_call:/.test(f.check_key || ''));
  check('no live proposal says tap-to-call is missing while the browser sees it', staleTel.length === 0, JSON.stringify(staleTel.map((f) => f.title)));
  const dupDns = own.filter((f) => f.origin === 'automated_review' && f.review_status !== 'rejected' && /^dns_(spf|dmarc):/.test(f.check_key || ''));
  check('SPF/DMARC are not proposed again beside the reviewed email-setup finding', dupDns.length === 0, JSON.stringify(dupDns.map((f) => f.title)));
  check('withdrawn proposals are kept and say why (never deleted)', own.filter((f) => f.review_status === 'rejected' && /Withdrawn by Nova's research/.test(f.limitations || '')).length >= 1);
  check('the limitations state that only OpenStreetMap was searched for listings', (run.summary.limitations || []).some((l) => /OpenStreetMap only/.test(l)), JSON.stringify(run.summary.limitations));
  check('unavailable competitor discovery is reported as unavailable, not as "no competitors"', run.steps.find((x) => x.key === 'competitors').status === 'unavailable' ? (run.summary.limitations || []).some((l) => /Competitor discovery is not available|competitors were not searched|could not/i.test(l)) : true);

  await p.getByRole('tab', { name: 'Findings' }).click();
  await p.getByRole('button', { name: 'Re-check against the current state' }).click();
  check('re-checking the findings against the current state reports what it measured', await seen(p.getByText(/Re-checked \d+ finding\(s\): \d+ still observed, \d+ no longer observed, \d+ could not be re-checked here/), 180000));
  const rc = await q("select title, review_status, recheck_status, recheck_note from audit_findings where case_id=$1 and origin <> 'automated_review' and review_status <> 'rejected'", [CASE]);
  console.log(`  re-check: ${rc.map((f) => `[${f.recheck_status}] ${f.title.slice(0, 50)} — ${(f.recheck_note || '').slice(0, 90)}`).join('\n            ')}`);
  check('every recorded finding has a re-check result', rc.length > 0 && rc.every((f) => f.recheck_status), JSON.stringify(rc.filter((f) => !f.recheck_status).map((f) => f.title)));
  check('the escalation/workers finding is measured against the workspace and no longer observed', rc.some((f) => /escalations/.test(f.title) && f.recheck_status === 'no_longer_observed' && /escalation contacts named: [1-9]/.test(f.recheck_note)), JSON.stringify(rc.find((f) => /escalations/.test(f.title))));
  check('findings that need the hosting account are "not re-checked" with the reason (never assumed fixed)', rc.filter((f) => /production|Hosting carries/.test(f.title)).every((f) => f.recheck_status === 'not_rechecked' && /Vercel/.test(f.recheck_note)));
  check('reviewed findings keep their reviewed status and text (history preserved)', rc.every((f) => f.review_status === 'reviewed'));

  await p.getByRole('tab', { name: 'Report & PDF' }).click();
  await p.getByRole('button', { name: 'Draft from recorded evidence' }).click();
  check('a report version is drafted from the recorded evidence', await seen(p.getByText(/Version \d+ drafted|Nothing changed since version/)));
  const content = (await q('select content from audit_reports where case_id=$1 order by version desc limit 1', [CASE]))[0].content;
  check('the new version lists no-longer-observed findings separately, out of the priority list', Array.isArray(content.no_longer_observed) && content.no_longer_observed.length >= 1 && !content.findings.some((f) => content.no_longer_observed.some((g) => g.title === f.title)), JSON.stringify(content.no_longer_observed).slice(0, 200));
  const latest = (await q('select id, version from audit_reports where case_id=$1 order by version desc limit 1', [CASE]))[0];
  // the version list refreshes after drafting: use the row of exactly that version, not whichever row is on top yet
  const row = p.locator('div', { has: p.getByText(`Version ${latest.version}`, { exact: true }) }).filter({ has: p.getByRole('button', { name: 'Generate PDF' }) }).last();
  await row.waitFor({ state: 'visible', timeout: 20000 });
  await row.getByRole('button', { name: 'Generate PDF' }).click();
  check('its PDF is generated and saved in the Vault', await seen(p.getByText(/(Saved|Already saved) in the Vault: Nova-Audit-/), 60000));
  const doc = (await q('select id, file_name, report_version, report_status, file_size from vault_documents where audit_report_id=$1 order by created_at desc limit 1', [latest.id]))[0];
  check('the Vault record matches that exact version', doc?.report_version === latest.version, JSON.stringify(doc));

  await p.goto(`${APP}/dashboard/nova-vault`);
  await p.getByPlaceholder(/Search by client or file name/).fill(doc.file_name.slice(0, 30));
  check('the PDF is listed in the Nova Vault', await seen(p.getByText(doc.file_name)));
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.getByRole('button', { name: `Download ${doc.file_name}` }).click()]);
  const file = path.join(OUT, doc.file_name); await dl.saveAs(file);
  const buf = fs.readFileSync(file);
  check('opening it from the Vault downloads the real PDF of the recorded size', buf.subarray(0, 5).toString() === '%PDF-' && buf.length === Number(doc.file_size), `${buf.length} vs ${doc.file_size}`);

  await p.reload();
  await p.getByPlaceholder(/Search by client or file name/).fill(doc.file_name.slice(0, 30));
  check('after a reload the Vault still lists it', await seen(p.getByText(doc.file_name)));
  await ctx.close(); ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, acceptDownloads: true }); p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message));
  await signIn(p); await p.goto(`${APP}/dashboard/audit/${CASE}?section=report`);
  check('after signing in again on an iPad-sized screen, the version and its PDF are there', await seen(p.getByText(`Version ${latest.version}`)) && await seen(p.getByText(new RegExp(doc.file_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))));
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('no horizontal scrolling on the iPad-sized report section', over <= 1, `${over}px`);
  await p.screenshot({ path: path.join(OUT, 'report-section-ipad.png'), fullPage: true });
  check('no page errors', errors.length === 0, errors.join('; '));
  console.log(`  PDF: ${file}`);
} finally { await db.end(); await browser.close(); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
