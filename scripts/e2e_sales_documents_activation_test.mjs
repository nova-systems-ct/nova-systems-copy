// Agreements/e-signature + activation checklist: real handlers (api/client.js) against REAL PostgreSQL + PostgREST (local, disposable).
// Fixture note: completed Academy enrollments and an accepted application are inserted directly (the Academy flow itself is proven in
// e2e_sales_academy_test.mjs and the hiring flow in e2e_sales_hiring_test.mjs) so this test can focus on documents and activation.
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const env = await startTestEnv({ migrations: allMigrations(), publicBuckets: [] });
Object.assign(process.env, env.appEnv, { APP_BASE_URL: 'https://app.test', SALES_EMAIL_MODE: 'dry_run' });
const { default: handler } = await import('../api/client.js');
const call = makeCaller(handler);
const D = (op, o = {}) => call({ resource: 'documents', op, ...o });
const T = (op, o = {}) => call({ resource: 'salesteam', op, ...o });
const AGREEMENT = (label) => `${label}. This is TEST agreement text written for an automated test, not legal advice. `.repeat(6);
try {
  const org = (await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).rows[0].id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: org, name: 'Isaac Owner' });
  const mgr = await env.createUser({ email: 'mgr@nova.test', role: 'nova_sales_manager', orgId: org, name: 'Mia Manager' });
  const mgr2 = await env.createUser({ email: 'mgr2@nova.test', role: 'nova_sales_manager', orgId: org, name: 'Other Manager' });
  const c1 = await env.createUser({ email: 'c1@nova.test', role: 'nova_sales_candidate', orgId: org, name: 'Jane Doe' });
  const c2 = await env.createUser({ email: 'c2@nova.test', role: 'nova_sales_candidate', orgId: org, name: 'Sam Second' });
  const app1 = (await env.sql("insert into applications (name,email,position,status) values ('Jane Doe','c1@nova.test','Sales Representative','accepted') returning id")).rows[0].id;
  await env.sql("insert into sales_reps (user_id, organization_id, display_name, status, manager_user_id, application_id) values ($1,$3,'Jane Doe','candidate',$2,$4), ($5,$3,'Sam Second','candidate',null,null)", [c1.id, mgr.id, org, app1, c2.id]);
  await env.reload();
  const rep1 = (await env.sql('select id from sales_reps where user_id=$1', [c1.id])).rows[0].id;

  // ---------------------------------------------------------------- templates & approval gate
  let r = await D('templates', { method: 'GET', token: owner.token });
  check('four seeded templates exist, each with NO versions (no invented legal text)', r.status === 200 && r.body.templates.length === 4 && r.body.templates.every((t) => t.versions.length === 0));
  r = await D('templates', { method: 'GET', token: mgr.token });
  check('a manager cannot open the template editor', r.status === 403);
  r = await D('send', { token: owner.token, body: { template_key: 'confidentiality', user_ids: [c1.id] } });
  check('an unreviewed/unapproved template cannot be sent', r.status === 409);
  r = await D('save-version', { token: mgr.token, body: { template_key: 'confidentiality', body: AGREEMENT('conf') } });
  check('a manager cannot write agreement text', r.status === 403);
  r = await D('save-version', { token: owner.token, body: { template_key: 'confidentiality', body: `${AGREEMENT('conf')} [OWNER TO COMPLETE]` } });
  const vDraft = r.body.version;
  r = await D('approve-version', { token: owner.token, body: { version_id: vDraft.id, confirm_reviewed: true } });
  check('approval blocked while a placeholder remains', r.status === 422 && /placeholder/i.test(r.body.error));
  await D('save-version', { token: owner.token, body: { template_key: 'confidentiality', version_id: vDraft.id, body: AGREEMENT('conf v1') } });
  r = await D('approve-version', { token: owner.token, body: { version_id: vDraft.id } });
  check('approval blocked without the owner\'s review confirmation', r.status === 422);
  r = await D('approve-version', { token: owner.token, body: { version_id: vDraft.id, confirm_reviewed: true } });
  check('owner approves (hash frozen, review recorded)', r.status === 200 && r.body.version.status === 'approved' && r.body.version.content_hash?.length === 64 && r.body.version.review_status === 'owner_confirmed_reviewed');
  r = await D('save-version', { token: owner.token, body: { template_key: 'confidentiality', version_id: vDraft.id, body: 'tampered' } });
  check('an approved version cannot be edited via the API', r.status === 409);
  let dbErr = null; try { await env.sql("update sales_document_versions set body='tampered' where id=$1", [vDraft.id]); } catch (e) { dbErr = e.message; }
  check('...nor directly in the database (immutable trigger)', /immutable/.test(dbErr || ''), dbErr);

  // ---------------------------------------------------------------- sending
  r = await D('send', { token: c1.token, body: { template_key: 'confidentiality', user_ids: [c1.id] } });
  check('a candidate cannot send documents', r.status === 403);
  r = await D('send', { token: owner.token, body: { template_key: 'confidentiality', user_ids: [c1.id, '00000000-0000-0000-0000-0000000000aa'] } });
  check('send: real candidate ok; unknown user reported as failed', r.status === 200 && r.body.results[0].ok && !r.body.results[1].ok);
  const req1 = r.body.results[0].request_id;
  const note = (await env.sql("select status, email from sales_notifications where kind='document_sent' and channel='email'")).rows[0];
  check('the notification email is recorded as dry_run (not sent) in non-live mode', note.status === 'dry_run' && env.stubs.emailRequests.length === 0);
  r = await D('send', { token: owner.token, body: { template_key: 'confidentiality', user_ids: [c1.id] } });
  const req1b = r.body.results[0].request_id;
  check('re-sending supersedes the old open request (only one open)', (await env.sql("select status from sales_document_requests where id=$1", [req1])).rows[0].status === 'superseded' && (await env.sql("select count(*) from sales_document_requests where status in ('sent','viewed')")).rows[0].count === '1');

  // ---------------------------------------------------------------- signer boundary + signing
  r = await D('my-documents', { method: 'GET', token: c1.token });
  check('signer sees their open request and per-document states', r.body.requests.some((x) => x.id === req1b) && r.body.states.confidentiality.state === 'sent');
  r = await D('view', { method: 'GET', token: c2.token, query: { id: req1b } });
  check("another candidate cannot open someone else's document", r.status === 404);
  r = await D('sign', { token: c2.token, body: { request_id: req1b, typed_name: 'Sam Second', consent: true } });
  check("another candidate cannot sign it", r.status === 404);
  r = await D('sign', { token: c1.token, body: { request_id: req1b, typed_name: 'Jane Doe', consent: true, content_hash: 'x' } });
  check('cannot sign without opening/reading the document first', r.status === 409);
  r = await D('view', { method: 'GET', token: c1.token, query: { id: req1b } });
  const view = r.body;
  check('viewing returns the exact text + hash and records a viewed event', r.status === 200 && view.body.includes('conf v1') && view.content_hash.length === 64 && (await env.sql("select count(*) from sales_document_events where request_id=$1 and event='viewed'", [req1b])).rows[0].count === '1');
  r = await D('sign', { token: c1.token, body: { request_id: req1b, typed_name: 'Jane Doe', consent: false, content_hash: view.content_hash } });
  check('electronic-signature consent is required', r.status === 422);
  r = await D('sign', { token: c1.token, body: { request_id: req1b, typed_name: 'JD', consent: true, content_hash: view.content_hash } });
  check('a full typed name is required', r.status === 422);
  r = await D('sign', { token: c1.token, body: { request_id: req1b, typed_name: 'Jane Doe', consent: true, content_hash: 'not-the-hash' } });
  check('signing a hash that differs from what was issued is refused', r.status === 409);
  r = await D('sign', { token: c1.token, body: { request_id: req1b, typed_name: 'Jane Doe', consent: true, content_hash: view.content_hash, signature_image: 'data:text/html;base64,AAAA' } });
  check('a non-PNG signature image is refused', r.status === 422);
  r = await D('sign', { token: c1.token, body: { request_id: req1b, typed_name: 'Jane Doe', consent: true, content_hash: view.content_hash, signed_at: '1999-01-01', signature_image: 'data:image/png;base64,iVBORw0KGgo=' } });
  check('signing works; the SERVER stamps the time (client-supplied signed_at ignored)', r.status === 200 && new Date(r.body.signed_at).getFullYear() >= 2026);
  const row = (await env.sql('select * from sales_document_requests where id=$1', [req1b])).rows[0];
  check('signature record stored: typed name, consent version, ip, hash', row.status === 'signed' && row.signer_typed_name === 'Jane Doe' && row.esign_consent && !!row.esign_consent_text_version && !!row.signer_ip && row.signature_hash.length === 64);
  r = await D('sign', { token: c1.token, body: { request_id: req1b, typed_name: 'Jane Doe', consent: true, content_hash: view.content_hash } });
  check('cannot sign twice', r.status === 409);
  dbErr = null; try { await env.sql("update sales_document_requests set signer_typed_name='Someone Else' where id=$1", [req1b]); } catch (e) { dbErr = e.message; }
  check('a signed record cannot be edited in the database', /immutable/.test(dbErr || ''), dbErr);
  dbErr = null; try { await env.sql('delete from sales_document_requests where id=$1', [req1b]); } catch (e) { dbErr = e.message; }
  check('...or deleted', /never deleted/.test(dbErr || ''), dbErr);
  r = await D('verify', { method: 'GET', token: owner.token, query: { id: req1b } });
  check('integrity check passes: event chain, document text hash and signature record all match', r.body.intact === true && r.body.chain.events === 3 && r.body.document_text_matches && r.body.signature_record_matches);
  await env.sql("alter table sales_document_events disable trigger sales_document_events_immutable");
  await env.sql("update sales_document_events set detail = '{\"tampered\":true}' where request_id=$1 and event='sent'", [req1b]);
  await env.sql("alter table sales_document_events enable trigger sales_document_events_immutable");
  r = await D('verify', { method: 'GET', token: owner.token, query: { id: req1b } });
  check('...and if someone bypasses the trigger and edits history, verification DETECTS it', r.body.intact === false && r.body.chain.ok === false);

  // ---------------------------------------------------------------- download
  r = await D('download', { method: 'GET', token: c1.token, query: { id: req1b } });
  const pdfTxt = Buffer.from(r.body).toString('latin1');
  check('signer downloads a real PDF containing the text, signer, hash and (here) the tamper warning', r.status === 200 && pdfTxt.startsWith('%PDF-') && pdfTxt.includes('conf v1') && pdfTxt.includes('Jane Doe') && pdfTxt.includes(row.signature_hash) && /NOT VERIFIED/.test(pdfTxt));
  r = await D('download', { method: 'GET', token: c2.token, query: { id: req1b } });
  check("another candidate cannot download it", r.status === 403);

  // ---------------------------------------------------------------- versions: material vs non-material
  r = await D('save-version', { token: owner.token, body: { template_key: 'confidentiality', body: AGREEMENT('conf v2 minor wording'), material_change: false } });
  await D('approve-version', { token: owner.token, body: { version_id: r.body.version.id, confirm_reviewed: true } });
  r = await D('my-documents', { method: 'GET', token: c1.token });
  check('a NON-material new version keeps the earlier signature valid', r.body.states.confidentiality.satisfied === true);
  await D('send', { token: owner.token, body: { template_key: 'confidentiality', user_ids: [c2.id] } });
  r = await D('save-version', { token: owner.token, body: { template_key: 'confidentiality', body: AGREEMENT('conf v3 material'), material_change: true } });
  r = await D('approve-version', { token: owner.token, body: { version_id: r.body.version.id, confirm_reviewed: true } });
  check('approving a MATERIAL version supersedes still-open requests on the old text', r.body.superseded_open_requests === 1);
  r = await D('my-documents', { method: 'GET', token: c1.token });
  check('and the earlier signer must sign again (needs_resign)', r.body.states.confidentiality.state === 'needs_resign' && !r.body.states.confidentiality.satisfied);

  // ---------------------------------------------------------------- expiry / decline / suspended signer
  const w = await D('save-version', { token: owner.token, body: { template_key: 'acceptable_use', body: AGREEMENT('acceptable use') } });
  await D('approve-version', { token: owner.token, body: { version_id: w.body.version.id, confirm_reviewed: true } });
  r = await D('send', { token: owner.token, body: { template_key: 'acceptable_use', user_ids: [c1.id], expires_days: 7 } });
  const reqExp = r.body.results[0].request_id;
  await env.sql("update sales_document_requests set expires_at = now() - interval '1 hour' where id=$1", [reqExp]);
  r = await D('view', { method: 'GET', token: c1.token, query: { id: reqExp } });
  check('an expired link cannot be opened (410) and is marked expired with an event', r.status === 410 && (await env.sql('select status from sales_document_requests where id=$1', [reqExp])).rows[0].status === 'expired' && (await env.sql("select count(*) from sales_document_events where request_id=$1 and event='expired'", [reqExp])).rows[0].count === '1');
  r = await D('send', { token: owner.token, body: { template_key: 'acceptable_use', user_ids: [c1.id] } });
  const reqDec = r.body.results[0].request_id;
  r = await D('decline', { token: c1.token, body: { request_id: reqDec, reason: 'I want to talk to someone first' } });
  check('declining is recorded, and the owner is told', r.status === 200 && (await env.sql("select count(*) from sales_notifications where kind='document_declined'")).rows[0].count !== '0');
  r = await D('send', { token: owner.token, body: { template_key: 'acceptable_use', user_ids: [c1.id] } });
  const reqSus = r.body.results[0].request_id;
  await D('view', { method: 'GET', token: c1.token, query: { id: reqSus } });
  await env.sql("update organization_members set status='inactive' where staff_user_id=$1", [c1.id]);
  r = await D('sign', { token: c1.token, body: { request_id: reqSus, typed_name: 'Jane Doe', consent: true, content_hash: (await env.sql('select content_hash from sales_document_requests where id=$1', [reqSus])).rows[0].content_hash } });
  check('a suspended/inactive account cannot sign', r.status === 403);
  await env.sql("update organization_members set status='active' where staff_user_id=$1", [c1.id]);

  // ---------------------------------------------------------------- countersign (compensation & working agreement)
  const publish = async (key) => { const v = await D('save-version', { token: owner.token, body: { template_key: key, body: AGREEMENT(key) } }); await D('approve-version', { token: owner.token, body: { version_id: v.body.version.id, confirm_reviewed: true } }); };
  await publish('working_agreement'); await publish('compensation_schedule');
  const signAs = async (u, key) => { const s = await D('send', { token: owner.token, body: { template_key: key, user_ids: [u.id] } }); const id = s.body.results[0].request_id; const v = await D('view', { method: 'GET', token: u.token, query: { id } }); const g = await D('sign', { token: u.token, body: { request_id: id, typed_name: u === c1 ? 'Jane Doe' : 'Sam Second', consent: true, content_hash: v.body.content_hash } }); return { id, ok: g.status === 200 }; };
  const wa = await signAs(c1, 'working_agreement');
  r = await D('countersign', { token: c1.token, body: { request_id: wa.id, typed_name: 'Jane Doe' } });
  check('a candidate cannot countersign', r.status === 403);
  r = await D('countersign', { token: mgr.token, body: { request_id: wa.id, typed_name: 'Mia Manager' } });
  check('a manager cannot countersign (owner only)', r.status === 403);
  r = await D('my-documents', { method: 'GET', token: c1.token });
  check('before countersignature the agreement is NOT satisfied', r.body.states.working_agreement.state === 'awaiting_countersign' && !r.body.states.working_agreement.satisfied);
  r = await D('countersign', { token: owner.token, body: { request_id: wa.id, typed_name: 'Isaac Nova' } });
  check('owner countersigns', r.status === 200);
  r = await D('countersign', { token: owner.token, body: { request_id: wa.id, typed_name: 'Isaac Nova' } });
  check('cannot countersign twice', r.status === 409);
  r = await D('download', { method: 'GET', token: owner.token, query: { id: wa.id } });
  check('the countersigned copy names the countersigner', Buffer.from(r.body).toString('latin1').includes('Countersigned by Nova Systems'));

  // ---------------------------------------------------------------- activation checklist
  r = await T('my-checklist', { method: 'GET', token: c1.token });
  check('candidate sees their own checklist and that training never activates', r.status === 200 && r.body.status === 'candidate' && r.body.items.length === 7 && /never activates/.test(r.body.note) && !r.body.ready);
  r = await T('activate', { token: c1.token, body: { rep_id: rep1, confirm: true } });
  check('a candidate cannot activate themselves', r.status === 403);
  r = await T('activate', { token: mgr.token, body: { rep_id: rep1, confirm: true } });
  check('a manager cannot activate (owner only)', r.status === 403);
  r = await T('activate', { token: owner.token, body: { rep_id: rep1, confirm: true } });
  check('activation is refused while the checklist is incomplete, and says what is missing', r.status === 409 && r.body.outstanding.length >= 3);
  // fixture: all programs completed with practical approvals
  await env.sql("insert into academy_enrollments (staff_user_id, organization_id, program_id, status, practical_approved_at) select $1, $2, id, 'completed', case when requires_practical then now() else null end from academy_programs", [c1.id, org]);
  r = await T('rep', { method: 'GET', token: owner.token, query: { id: rep1 } });
  check('after ALL training is complete the rep is still a candidate (no auto-activation)', r.body.rep.status === 'candidate' && r.body.checklist.items.find((i) => i.key === 'training_complete').done && r.body.checklist.items.find((i) => i.key === 'practicals_approved').done && !r.body.checklist.ready);
  check('the policy used is labelled provisional (owner has not approved an activation policy)', r.body.checklist.policy_provisional === true);
  await signAs(c1, 'confidentiality'); await signAs(c1, 'acceptable_use'); const cs = await signAs(c1, 'compensation_schedule');
  r = await T('activate', { token: owner.token, body: { rep_id: rep1, confirm: true } });
  check('compensation still needs its countersignature', r.status === 409 && r.body.outstanding.some((o) => o.key === 'compensation_acknowledged'));
  await D('countersign', { token: owner.token, body: { request_id: cs.id, typed_name: 'Isaac Nova' } });
  r = await T('mark-setup', { token: owner.token, body: { rep_id: rep1, item_key: 'crm_access_verified', evidence: 'x' } });
  check('a setup item needs real evidence', r.status === 422);
  r = await T('mark-setup', { token: owner.token, body: { rep_id: rep1, item_key: 'made_up', evidence: 'looks fine to me' } });
  check('unknown setup items are rejected', r.status === 422);
  for (const k of ['crm_access_verified', 'toolkit_walkthrough', 'communication_channel']) await T('mark-setup', { token: owner.token, body: { rep_id: rep1, item_key: k, evidence: 'Verified live with the rep on a call' } });
  r = await T('activate', { token: owner.token, body: { rep_id: rep1 } });
  check('activation needs explicit confirmation', r.status === 422);
  r = await T('activate', { token: owner.token, body: { rep_id: rep1, confirm: true } });
  check('owner activates once every item is real and complete', r.status === 200);
  const after = (await env.sql("select r.status, m.role, m.status as mstatus from sales_reps r join organization_members m on m.staff_user_id=r.user_id where r.id=$1", [rep1])).rows[0];
  check('rep is active; membership role is now nova_sales; approval snapshot stored (append-only)', after.status === 'active' && after.role === 'nova_sales' && (await env.sql('select checklist_snapshot from sales_activation_approvals where rep_id=$1', [rep1])).rows[0].checklist_snapshot.items.length === 7);
  const perm = await env.rest(c1.token, 'rpc/has_permission', { method: 'POST', body: { target_org_id: org, permission_key: 'sales.rep' } });
  check('the newly active rep now holds sales.rep (and still cannot read Nova-wide data)', perm.data === true && (await env.rest(c1.token, 'leads?select=id')).data?.length === 0);
  r = await T('activate', { token: owner.token, body: { rep_id: rep1, confirm: true } });
  check('activating twice is refused', r.status === 409);

  // ---------------------------------------------------------------- manager scope, notes, suspension
  r = await T('reps', { method: 'GET', token: mgr.token });
  check("manager sees only their own rep", r.body.length === 1 && r.body[0].id === rep1);
  r = await T('reps', { method: 'GET', token: mgr2.token });
  check("another manager sees none of them", r.body.length === 0);
  r = await T('rep', { method: 'GET', token: mgr2.token, query: { id: rep1 } });
  check("another manager cannot open that rep's record", r.status === 403);
  r = await T('rep', { method: 'GET', token: c1.token, query: { id: rep1 } });
  check('the rep cannot open the management view of themselves (notes are private)', r.status === 403);
  r = await T('add-note', { token: mgr.token, body: { rep_id: rep1, note: 'Strong first week, watch follow-up timing.' } });
  check('manager adds a private note', r.status === 200);
  dbErr = null; try { await env.sql("update sales_rep_notes set note='x'"); } catch (e) { dbErr = e.message; }
  check('notes are append-only', !!dbErr);
  r = await T('suspend', { token: mgr.token, body: { rep_id: rep1, reason: 'testing suspend' } });
  check('a manager cannot suspend (owner only)', r.status === 403);
  r = await T('suspend', { token: owner.token, body: { rep_id: rep1, reason: 'Investigating a complaint from a lead' } });
  check('owner suspends with a reason', r.status === 200);
  r = await call({ resource: 'salesteam', op: 'my-checklist', method: 'GET', token: c1.token });
  check('a suspended rep is immediately locked out of authenticated APIs', r.status === 403);
  check('suspension keeps history (row, enrollments, signed documents, status history)', (await env.sql('select count(*) from sales_rep_status_history where rep_id=$1', [rep1])).rows[0].count === '2' && (await env.sql('select count(*) from sales_document_requests where signer_user_id=$1 and status=$2', [c1.id, 'signed'])).rows[0].count !== '0' && (await env.sql("select count(*) from academy_enrollments where staff_user_id=$1", [c1.id])).rows[0].count === '10');
  r = await T('reactivate', { token: owner.token, body: { rep_id: rep1, reason: 'Complaint resolved in the rep\'s favour' } });
  check('owner reactivates (checklist re-verified)', r.status === 200 && (await env.sql("select status from organization_members where staff_user_id=$1", [c1.id])).rows[0].status === 'active');
  check('audit log recorded activation, suspension and reactivation', (await env.sql("select count(*) from sales_audit_log where action in ('activated','suspended','reactivated')")).rows[0].count === '3');
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
