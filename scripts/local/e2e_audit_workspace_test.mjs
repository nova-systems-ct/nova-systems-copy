// Audit workspace API (api/_auditWorkspace.js) against REAL local Supabase (Auth, PostgREST, Storage). The public
// website and DNS are stand-ins injected in-process, so results are deterministic and nothing on the internet is touched.
// Proves: five-detail start without duplicates · review writes sourced evidence + proposed (unreviewed) findings ·
// re-run adds evidence but no duplicate findings · draft report only when content changed · PDF stored in the private
// Vault bucket with a version-linked row, reused for identical content, streamed back intact · another organization's
// staff cannot open it · approval refuses a version drafted before review · archive/restore.
//   node scripts/local/e2e_audit_workspace_test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import zlib from 'node:zlib';
// Text of a (compressed) PDF: inflate every content stream.
const pdfText = (buf) => { const s = buf.toString('latin1'); let out = ''; for (const m of s.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) { try { out += zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'); } catch { out += m[1]; } } return out; };

const read = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = read('.env.local-staging'); const acct = read('.env.local-staging-accounts');
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(env.SUPABASE_URL)) throw new Error('local only');
Object.assign(process.env, env);
const pg = createRequire(path.join(process.cwd(), '.testenv', 'package.json'))('pg');
const db = new pg.Client({ connectionString: env.LOCAL_DB_URL }); await db.connect();
const { default: client } = await import('../../api/client.js');
const { setWorkspaceDepsForTests } = await import('../../api/_auditWorkspace.js');

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const token = async (email, password) => (await (await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).access_token;
const OWNER = await token(acct.OWNER_EMAIL, acct.OWNER_PASSWORD);
const REP = await token(acct.REP_EMAIL, acct.REP_PASSWORD);
async function call(tok, method, op, { query = {}, body } = {}) {
  const chunks = []; let status = 200; const headers = {};
  const res = { setHeader: (k, v) => { headers[k.toLowerCase()] = v; }, status(c) { status = c; return res; }, json(b) { chunks.push(Buffer.from(JSON.stringify(b))); headers['content-type'] ||= 'application/json'; return res; }, send(b) { chunks.push(Buffer.isBuffer(b) ? b : Buffer.from(typeof b === 'string' ? b : JSON.stringify(b))); return res; }, end(b) { if (b) chunks.push(Buffer.from(b)); return res; }, get headersSent() { return false; } };
  const req = { method, query: { resource: 'audit', op, ...query }, body: body || {}, headers: { authorization: `Bearer ${tok}`, 'x-forwarded-for': '127.0.0.1' }, socket: { remoteAddress: '127.0.0.1' } };
  await client(req, res);
  const buf = Buffer.concat(chunks);
  return { status, headers, buf, json: /json/.test(headers['content-type'] || '') ? JSON.parse(buf.toString() || '{}') : null };
}

// Stand-in public internet: one site with a broken quote link, mixed phone numbers, MX but no SPF/DMARC.
const SITE = 'https://stand-in-roofing.example';
const NAME = `LOCAL TEST Workspace Roofing ${Date.now().toString(36)}`;
const PAGES = {
  [`${SITE}/`]: { status: 200, html: '<html><head><title>Stand-in Roofing</title><meta name="viewport" content="width=device-width"></head><body><h1>' + NAME + '</h1><p>Roof repair in Waterbury, Connecticut</p><a href="tel:2035550101">Call</a> <a href="tel:2035550199">Office</a> <a href="/quote">Get a quote</a> <a href="/contact">Contact us</a></body></html>' },
  [`${SITE}/quote`]: { status: 404, html: '<html><body>Not found</body></html>' },
  [`${SITE}/contact`]: { status: 200, html: '<html><body><form><input type="email" name="email"></form></body></html>' },
};
const fetchImpl = async (url) => { const p = PAGES[url] || PAGES[url + '/'] || { status: 404, html: 'x' }; return new Response(p.html, { status: p.status, headers: { 'content-type': 'text/html' } }); };
const lookup = async () => [{ address: '93.184.216.34', family: 4 }];
const resolver = { resolveMx: async () => [{ exchange: 'mx.stand-in-mail.example', priority: 10 }], resolveTxt: async () => { const e = new Error('no data'); e.code = 'ENODATA'; throw e; } };
setWorkspaceDepsForTests({ fetchImpl, lookup, resolver });

const org = (await db.query("select id from organizations where kind='nova_internal' limit 1")).rows[0].id;
try {
  // start
  let r = await call(OWNER, 'POST', 'start', { body: { organization_id: org, name: NAME, website: 'stand-in-roofing.example', industry: 'Roofing', location: 'Waterbury, CT', phone: '(203) 555-0101', goal: 'More booked roofing jobs from the website', mode: 'online' } });
  check('the owner starts an audit from five details', r.status === 200 && r.json.case?.id, JSON.stringify(r.json));
  const caseId = r.json.case.id;
  const saved = (await db.query('select intake, scope, business_id from audit_cases where id=$1', [caseId])).rows[0];
  check('the five details are saved on the case (website normalized to https)', saved.intake.name === NAME && saved.intake.website === `${SITE}/` && saved.intake.industry === 'Roofing' && saved.intake.public_phone === '(203) 555-0101' && saved.scope === 'digital', JSON.stringify(saved.intake));
  r = await call(OWNER, 'POST', 'start', { body: { organization_id: org, name: NAME.toLowerCase(), website: SITE } });
  check('starting the same business again does not create a duplicate; it points to the open audit', r.status === 409 && r.json.existing_case_id === caseId, JSON.stringify(r.json));

  // details persist (reload = a fresh read)
  r = await call(OWNER, 'POST', 'details', { body: { organization_id: org, case_id: caseId, contact_name: 'Pat Owner', location: 'Waterbury, Connecticut' } });
  r = await call(OWNER, 'GET', 'workspace', { query: { organization_id: org, case_id: caseId } });
  check('a detail edit is saved and reads back on reload, without losing the other details', r.json.details.find((d) => d.key === 'location').value === 'Waterbury, Connecticut' && r.json.details.find((d) => d.key === 'website').value === `${SITE}/`, JSON.stringify(r.json.details));
  check('the next-step list starts at evidence', r.json.next_steps.find((s) => s.key === 'details').done && !r.json.next_steps.find((s) => s.key === 'evidence').done);
  check('the clock explains it has not started because no policy exists (no hidden start)', r.json.clock.state === 'no_policy' && /Not started/.test(r.json.clock.message), JSON.stringify(r.json.clock));

  // review
  r = await call(OWNER, 'POST', 'review', { body: { organization_id: org, case_id: caseId } });
  check('the review runs and records evidence', r.status === 200 && r.json.evidence_added >= 6, JSON.stringify(r.json));
  const firstEvidence = r.json.evidence_added;
  const keys1 = (await db.query('select check_key from audit_findings where case_id=$1', [caseId])).rows.map((x) => x.check_key.split(':')[0]).sort();
  check('it proposes findings for the broken quote link, mixed phone numbers, missing SPF and DMARC, missing hours and missing reviews', JSON.stringify(keys1) === JSON.stringify(['dns_dmarc', 'dns_spf', 'hours_published', 'link', 'phones', 'reviews_or_social_proof']) && r.json.findings_proposed === 6, JSON.stringify(keys1));
  check('an unreachable map lookup is reported as unavailable, not as a missing business', r.json.steps.find((x) => x.key === 'identity').status === 'unavailable' && (r.json.limitations || []).some((l) => /map lookup/.test(l)), JSON.stringify(r.json.steps.find((x) => x.key === 'identity')));
  const goalFinding = (await db.query("select priority, customer_impact from audit_findings where case_id=$1 and check_key like 'link:%'", [caseId])).rows[0];
  check('a finding related to the owner goal says so', /your goal/.test(goalFinding?.customer_impact || ''), JSON.stringify(goalFinding));
  const mods = (await db.query('select distinct module_key from audit_findings where case_id=$1', [caseId])).rows.map((x) => x.module_key).sort();
  check('every proposed finding is mapped to the Nova module that would address it', !mods.includes(null) && mods.includes('email_setup') && mods.includes('agents_booking'), JSON.stringify(mods));
  const ev = (await db.query('select source, capture_date, confidence, method from audit_evidence where case_id=$1', [caseId])).rows;
  check('every evidence record has a source with a retrieval time, a capture date, a method and a confidence', ev.every((e) => /\((retrieved|queried|checked) \d{4}-|against the public map and the site's own text \(\d{4}-/.test(e.source) && e.capture_date && /^automated_review:/.test(e.method) && e.confidence), JSON.stringify(ev[0]));
  const fs1 = (await db.query("select f.title, f.priority, f.review_status, f.origin, f.statement_type, (select count(*) from audit_finding_evidence l where l.finding_id=f.id)::int ev from audit_findings f where case_id=$1", [caseId])).rows;
  check('proposed findings are drafts (never auto-reviewed), observed facts, each linked to evidence', fs1.every((f) => f.review_status === 'draft' && f.origin === 'automated_review' && f.statement_type === 'observed_fact' && f.ev >= 1), JSON.stringify(fs1));
  check('the broken quote link is high priority', fs1.some((f) => /quote/i.test(f.title) && f.priority === 'high'), JSON.stringify(fs1.map((f) => [f.title, f.priority])));
  r = await call(OWNER, 'POST', 'review', { body: { organization_id: org, case_id: caseId } });
  const fs2 = (await db.query('select count(*)::int n from audit_findings where case_id=$1', [caseId])).rows[0].n;
  check('a second review adds fresh evidence but no duplicate findings', r.json.evidence_added === firstEvidence && r.json.findings_proposed === 0 && r.json.findings_already_recorded === 6 && fs2 === 6, JSON.stringify(r.json));

  // draft report
  r = await call(OWNER, 'POST', 'draft-report', { body: { organization_id: org, case_id: caseId } });
  check('a draft report is created from the recorded evidence', r.status === 200 && r.json.report.version === 1, JSON.stringify(r.json));
  const rep1 = r.json.report.id;
  const content = (await db.query('select content from audit_reports where id=$1', [rep1])).rows[0].content;
  check('the draft says financial impact is unknown and invents no figures', /Financial impact is unknown/.test(content.executive_summary) && !/\$\d/.test(JSON.stringify(content.findings)), content.executive_summary);
  check('the draft lists what was checked with each result', content.checks_performed.length >= 6 && content.checks_performed.some((c) => c.result === 'issue') && content.checks_performed.some((c) => c.result === 'ok'), JSON.stringify(content.checks_performed));
  r = await call(OWNER, 'POST', 'draft-report', { body: { organization_id: org, case_id: caseId } });
  check('drafting again with nothing changed does not create another version', r.json.unchanged === true && r.json.report.version === 1, JSON.stringify(r.json));

  // PDF → Vault
  r = await call(OWNER, 'POST', 'pdf', { body: { organization_id: org, case_id: caseId, report_id: rep1 } });
  check('a PDF of the draft is generated and stored in the Vault', r.status === 200 && r.json.document?.id && r.json.document.report_status === 'draft' && r.json.document.report_version === 1, JSON.stringify(r.json));
  const docId = r.json.document.id;
  const vd = (await db.query('select storage_path, organization_id, audit_case_id, audit_report_id, content_sha256, file_size from vault_documents where id=$1', [docId])).rows[0];
  check('the Vault row is linked to this organization, audit, report version and content hash', vd.organization_id === org && vd.audit_case_id === caseId && vd.audit_report_id === rep1 && vd.content_sha256?.length === 64 && /^audit-reports\//.test(vd.storage_path), JSON.stringify(vd));
  const obj = (await db.query("select bucket_id from storage.objects where name=$1", [vd.storage_path])).rows[0];
  check('the file is in the private nova-vault bucket', obj?.bucket_id === 'nova-vault');
  r = await call(OWNER, 'POST', 'pdf', { body: { organization_id: org, case_id: caseId, report_id: rep1 } });
  check('generating the same version again reuses the stored PDF (no duplicate)', r.json.reused === true && r.json.document.id === docId);
  r = await call(OWNER, 'GET', 'pdf-file', { query: { organization_id: org, case_id: caseId, document_id: docId } });
  check('the stored PDF downloads through the app as a real PDF of the recorded size', r.status === 200 && r.headers['content-type'] === 'application/pdf' && r.buf.subarray(0, 5).toString() === '%PDF-' && r.buf.length === Number(vd.file_size), `${r.status} ${r.buf.length}`);
  check('the draft PDF is stamped as a draft on its pages', (pdfText(r.buf).match(/DRAFT - NOT APPROVED/g) || []).length >= 2);
  r = await call(REP, 'GET', 'pdf-file', { query: { organization_id: org, case_id: caseId, document_id: docId } });
  check('a representative without audit access cannot download it', r.status === 403 || r.status === 404, String(r.status));
  const other = (await db.query("select id from organizations where id<>$1 limit 1", [org])).rows[0];
  if (other) { r = await call(OWNER, 'GET', 'pdf-file', { query: { organization_id: other.id, case_id: caseId, document_id: docId } }); check('the PDF cannot be fetched through another organization', r.status === 404 || r.status === 403, String(r.status)); }

  // approval must not accept a version drafted before review
  const fids = (await db.query('select id from audit_findings where case_id=$1', [caseId])).rows.map((x) => x.id);
  await db.query("update audit_findings set review_status='reviewed', owner_decision='Approve the fix', nova_can_implement='yes' where case_id=$1", [caseId]);
  r = await call(OWNER, 'POST', 'reports', { body: { organization_id: org, case_id: caseId, action: 'approve', id: rep1 } });
  check('approval refuses version 1 because it was drafted while findings were only proposed', [400, 409, 422].includes(r.status) && JSON.stringify(r.json).includes('drafted before'), `${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  r = await call(OWNER, 'POST', 'draft-report', { body: { organization_id: org, case_id: caseId } });
  check('after review, a new draft version is created', r.json.report.version === 2, JSON.stringify(r.json));
  const rep2 = r.json.report.id;
  r = await call(OWNER, 'POST', 'reports', { body: { organization_id: org, case_id: caseId, action: 'approve', id: rep2 } });
  check('the reviewed version can be approved', r.status === 200, JSON.stringify(r.json).slice(0, 400));
  r = await call(OWNER, 'POST', 'pdf', { body: { organization_id: org, case_id: caseId, report_id: rep2 } });
  check('the approved version gets its own Vault PDF, separate from the draft', r.status === 200 && r.json.document.report_status === 'approved' && r.json.document.id !== docId, JSON.stringify(r.json));
  r = await call(OWNER, 'GET', 'pdf-file', { query: { organization_id: org, case_id: caseId, document_id: r.json.document.id } });
  check('the approved PDF is not stamped as a draft', r.status === 200 && pdfText(r.buf).length > 1000 && !/DRAFT - NOT APPROVED/.test(pdfText(r.buf)));
  void fids;

  // archive / restore
  r = await call(OWNER, 'POST', 'archive', { body: { organization_id: org, case_id: caseId, archived: true, reason: 'test' } });
  check('the audit can be archived (hidden, not deleted)', r.status === 200 && r.json.archived_at, JSON.stringify(r.json));
  r = await call(OWNER, 'POST', 'archive', { body: { organization_id: org, case_id: caseId, archived: false } });
  check('and restored', r.status === 200 && r.json.archived_at === null);
} finally {
  const ids = (await db.query('select c.id from audit_cases c join businesses b on b.id=c.business_id where b.name like $1', ['LOCAL TEST Workspace Roofing%'])).rows.map((x) => x.id);
  if (ids.length) {
    const paths = (await db.query('select storage_path from vault_documents where audit_case_id = any($1::uuid[])', [ids])).rows.map((x) => x.storage_path);
    for (const p of paths) await fetch(`${env.SUPABASE_URL}/storage/v1/object/nova-vault/${p}`, { method: 'DELETE', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
    await db.query('delete from vault_documents where audit_case_id = any($1::uuid[])', [ids]);
    await db.query('delete from audit_finding_evidence where finding_id in (select id from audit_findings where case_id = any($1::uuid[]))', [ids]);
    for (const t of ['audit_findings', 'audit_evidence', 'audit_reports']) await db.query(`delete from ${t} where case_id = any($1::uuid[])`, [ids]);
    await db.query('delete from audit_cases where id = any($1::uuid[])', [ids]);
  }
  await db.query("delete from businesses where name like 'LOCAL TEST Workspace Roofing%'");
  await db.end();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
