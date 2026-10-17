// Nova Audit delivery clock (master prompt §5) on a real disposable database through the real handlers:
// the suggested default is offered as a proposal only; every policy change is a new timestamped version and approval
// stamps the exact version; the clock cannot start while a required input is missing (and says who owes it); after
// start, blockers are recorded WITHOUT moving the deadline; an extension changes the due time only after the client was
// told why and agreed — by exactly the agreed hours; a declined extension changes nothing; other organizations are refused.
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const env = await startTestEnv({ migrations: allMigrations(), publicBuckets: [] });
Object.assign(process.env, env.appEnv, { APP_BASE_URL: 'http://localhost.test' });
const call = makeCaller((await import('../api/client.js')).default);
const audit = (op, o = {}) => call({ resource: 'audit', op, ...o });
const one = async (q, p) => (await env.sql(q, p)).rows[0];
const H = 3600_000;

try {
  for (let i = 0; i < 30 && (await env.rest(env.serviceKey, 'audit_case_extensions?select=id&limit=0')).status !== 200; i++) await env.reload();
  const nova = (await one("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).id;
  const other = (await one("insert into organizations (name, slug, kind) values ('TEST Other','other','client') returning id")).id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: nova });
  const auditor = await env.createUser({ email: 'auditor@nova.test', role: 'nova_auditor', orgId: nova });
  const outsider = await env.createUser({ email: 'x@other.test', role: 'client_owner', orgId: other });
  const biz = (await one("insert into businesses (organization_id, name, website, city, state) values ($1,'TEST Clock Detailing','https://clock.example.test','Waterbury','CT') returning id", [nova])).id;
  const O = (body, who = owner) => ({ token: who.token, body: { organization_id: nova, ...body } });
  const caseId = (await audit('cases', O({ action: 'create', business_id: biz, scope: 'inquiry handling and booking' }))).body.case.id;
  const G = () => audit('intake', { token: owner.token, query: { organization_id: nova, case_id: caseId }, method: 'GET' });
  const K = (body, who = owner) => audit('clock', O({ case_id: caseId, ...body }, who));
  // serialized as an HTTP client would receive it (the in-process caller hands back Date objects)
  const due = async () => JSON.parse(JSON.stringify((await audit('cases', { token: owner.token, method: 'GET', query: { organization_id: nova, id: caseId } })).body.clock));

  // ---------------------------------------------------------------- proposal, versions, approval
  let r = await G();
  const proposed = r.body.proposed_clock_policy;
  check('the suggested default is offered as a proposal, not as an approved policy', r.status === 200 && proposed?.aim_hours === 48 && proposed.target_hours === 72 && proposed.hours_basis === 'elapsed_hours' && !r.body.clock_policy && !r.body.clock_policy_approved_at, JSON.stringify(r.body).slice(0, 300));
  r = await audit('intake', O({ case_id: caseId, clock_policy: { ...proposed, required_inputs: [{ key: 'x', label: 'Bad', responsible: 'nobody' }] } }));
  check('a required input without a valid responsible party is refused', r.status === 400 && /who provides it/.test(r.body.error));
  r = await audit('intake', O({ case_id: caseId, clock_policy: proposed }, auditor));
  check('saving the proposal creates version 1, unapproved, with a checklist of who owes each input', r.status === 200 && r.body.case.clock_policy_version === 1 && !r.body.case.clock_policy_approved_at && r.body.case.input_checklist.length === 5 && r.body.case.input_checklist.every((i) => !i.received_at), JSON.stringify(r.body.case?.input_checklist));
  r = await audit('intake', O({ case_id: caseId, approve_clock_policy: true }));
  check('the owner approves version 1 and the approval is stamped on that version', r.status === 200 && !!(await one('select approved_at from audit_clock_policy_versions where case_id=$1 and version=1', [caseId])).approved_at);
  r = await K({ action: 'receive-input', key: 'audit_contact', note: 'Owner named TEST Pat' });
  check('an input is marked received with who recorded it', r.status === 200 && r.body.input_checklist.find((i) => i.key === 'audit_contact').received_at && r.body.missing.length === 4);
  r = await audit('intake', O({ case_id: caseId, clock_policy: { ...proposed, target_hours: 60 } }));
  const v1 = await one('select policy, approved_at from audit_clock_policy_versions where case_id=$1 and version=1', [caseId]);
  check('a change is version 2 and needs approval again; version 1 stays exactly as approved', r.status === 200 && r.body.case.clock_policy_version === 2 && !r.body.case.clock_policy_approved_at && v1.policy.target_hours === 72 && !!v1.approved_at);
  check('received inputs survive a policy change', r.body.case.input_checklist.find((i) => i.key === 'audit_contact').received_at);
  r = await audit('intake', O({ case_id: caseId, clock_policy: { ...proposed, target_hours: 72 }, approve_clock_policy: true }));
  check('the owner approves version 3', r.status === 200 && r.body.case.clock_policy_version === 3 && !!r.body.case.clock_policy_approved_at);

  // ---------------------------------------------------------------- missing inputs block the start
  r = await audit('cases', O({ action: 'mark-ready', id: caseId }));
  check('the clock cannot start while inputs are missing, and the refusal says who owes each one', r.status === 409 && r.body.missing_inputs?.length === 4 && /Audit scope agreed in writing \(from the client\)/.test(r.body.error) && /Start confirmed with the client \(from Nova\)/.test(r.body.error), JSON.stringify(r.body));
  for (const k of ['scope_agreed', 'public_channels', 'record_access', 'start_confirmed']) await K({ action: 'receive-input', key: k });
  r = await audit('cases', O({ action: 'mark-ready', id: caseId }));
  check('with every input received, the clock starts', r.status === 200 && !!r.body.case.start_condition_met_at);
  r = await audit('intake', O({ case_id: caseId, clock_policy: { ...proposed, target_hours: 48 } }));
  check('after the start the policy can no longer change', r.status === 409);

  // ---------------------------------------------------------------- blockers do not move the deadline
  const d0 = await due();
  check('the deadline is the start plus the approved 72 calendar hours', d0.dueAt && Math.abs(new Date(d0.dueAt) - new Date(r.body?.case?.start_condition_met_at || (await one('select start_condition_met_at s from audit_cases where id=$1', [caseId])).s) - 72 * H) < 1000 && d0.originalDueAt === d0.dueAt, JSON.stringify(d0));
  r = await K({ action: 'raise-blocker', description: 'Client has not shared booking-system export', responsible: 'client' });
  const d1 = await due();
  check('a blocker is recorded and the deadline does not move', r.status === 200 && r.body.blocker.responsible === 'client' && d1.dueAt === d0.dueAt, JSON.stringify([d0.dueAt, d1.dueAt]));

  // ---------------------------------------------------------------- extensions need the client's agreement
  r = await K({ action: 'propose-extension', extra_hours: 24, reason: 'The booking export arrived late; analysis needs one more day', blocker_id: r.body.blocker.id });
  const ext = r.body.extension;
  check('a proposed extension does not move the deadline', r.status === 200 && ext.status === 'proposed' && (await due()).dueAt === d0.dueAt && new Date(ext.proposed_due_at) - new Date(d0.dueAt) === 24 * H);
  r = await K({ action: 'propose-extension', extra_hours: 12, reason: 'A second extension at the same time' });
  check('only one undecided extension at a time', r.status === 409);
  r = await K({ action: 'record-response', extension_id: ext.id, agreed: true, responder_name: 'TEST Pat' });
  check('the client\'s answer cannot be recorded before the client was told', r.status === 409 && /told/.test(r.body.error));
  r = await K({ action: 'record-notice', extension_id: ext.id, channel: 'email', notice_text: 'Emailed TEST Pat: the export arrived late, we need until Friday 5pm. Is that OK?' });
  check('the notice records how and what the client was told', r.status === 200 && r.body.extension.status === 'client_notified' && r.body.extension.notice_channel === 'email');
  r = await K({ action: 'record-response', extension_id: ext.id, agreed: true, responder_name: 'TEST Pat', evidence: 'Reply email: "Friday is fine"' });
  const d2 = await due();
  check('after the client agrees the deadline moves by exactly the agreed 24 hours; the original stays visible', r.status === 200 && new Date(d2.dueAt) - new Date(d0.dueAt) === 24 * H && d2.originalDueAt === d0.originalDueAt, JSON.stringify([d0, d2]));

  r = await K({ action: 'propose-extension', extra_hours: 8, reason: 'Second reviewer is out sick today' });
  const ext2 = r.body.extension;
  await K({ action: 'record-notice', extension_id: ext2.id, channel: 'phone', notice_text: 'Called TEST Pat to ask for 8 more hours because the reviewer is out' });
  r = await K({ action: 'record-response', extension_id: ext2.id, agreed: false, responder_name: 'TEST Pat', evidence: 'Declined on the call' });
  check('a declined extension leaves the deadline as it was', r.status === 200 && r.body.extension.status === 'declined' && (await due()).dueAt === d2.dueAt);

  // ---------------------------------------------------------------- at-risk, isolation
  await env.sql("update audit_cases set start_condition_met_at = now() - interval '90 hours' where id=$1", [caseId]); // TEST: move the clock (72h + 24h agreed)
  check('near the deadline the case reads as at risk, so the client can be told in time', (await due()).bucket === 'at_risk');
  r = await audit('clock', { token: outsider.token, body: { organization_id: nova, case_id: caseId, action: 'raise-blocker', description: 'not mine', responsible: 'client' } });
  check('another organization cannot touch this case\'s clock', r.status === 403 || r.status === 404, String(r.status));
  r = await G();
  check('the case shows its version history, checklist, blockers and extensions', r.body.policy_versions.length === 3 && r.body.blockers.length === 1 && r.body.extensions.length === 2 && r.body.input_checklist.every((i) => i.received_at));
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed — Nova Audit delivery clock (real handlers + local PostgreSQL)`);
process.exitCode = fail ? 1 : 0;
setTimeout(() => process.exit(process.exitCode ?? 0), 10_000).unref();
