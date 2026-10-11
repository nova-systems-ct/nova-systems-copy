// Nova Audit engine — real handlers (api/client.js, resource 'audit') against a REAL local PostgreSQL + PostgREST (local, disposable).
// The existing unit_audit_handlers_test.mjs proves the same authorization/state-machine rules against a hand-rolled in-memory
// PostgREST stand-in (fast, but it cannot prove a real foreign key, a real RLS policy, or a real UNIQUE constraint actually exist and
// hold). This suite proves the full diagnostic lifecycle — case → evidence → finding → recommendation → approved report → delivery →
// measured outcome — against genuine Postgres, plus that cross-organization isolation holds at the DATABASE layer, not just in the
// handler's own logic. NOT Supabase, NOT production.
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const env = await startTestEnv({ migrations: allMigrations(), publicBuckets: [] });
Object.assign(process.env, env.appEnv);
const { default: handler } = await import('../api/client.js');
const { REQUIRED_REPORT_SECTIONS } = await import('../api/_auditRules.js');
const call = makeCaller(handler);
const audit = (op, o = {}) => call({ resource: 'audit', op, ...o });
try {
  const orgA = (await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).rows[0].id;
  const orgB = (await env.sql("insert into organizations (name, slug, kind) values ('Acme Client','acme','client') returning id")).rows[0].id;
  const ownerA = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: orgA, name: 'Isaac Owner' });
  const staffB = await env.createUser({ email: 'staff@acme.test', role: 'client_owner', orgId: orgB, name: 'Acme Staff' });
  const bizA = (await env.sql("insert into businesses (organization_id, name) values ($1,'Test Plumbing Co') returning id", [orgA])).rows[0].id;
  const bizB = (await env.sql("insert into businesses (organization_id, name) values ($1,'Other Org Biz') returning id", [orgB])).rows[0].id;
  await env.reload();

  // ---------------------------------------------------------------- authorization boundary
  let r = await audit('cases', { method: 'GET', query: { organization_id: orgA } });
  check('no session -> 401', r.status === 401);
  r = await audit('cases', { token: staffB.token, body: { organization_id: orgA, action: 'create', business_id: bizA } });
  check("a client-org member with no access to orgA cannot create a case there", r.status === 403 || r.status === 404, `${r.status}`);

  // ---------------------------------------------------------------- case creation + cross-org business guard
  r = await audit('cases', { token: ownerA.token, body: { organization_id: orgA, action: 'create', business_id: bizB } });
  check('a case cannot reference a business from a different organization (real FK-adjacent check, not just handler logic)', r.status === 400);
  r = await audit('cases', { token: ownerA.token, body: { organization_id: orgA, action: 'create', business_id: bizA, scope: 'digital' } });
  check('a real case row is created', r.status === 200 && !!r.body.case?.id);
  const caseId = r.body.case.id;
  check('the row genuinely exists in Postgres, scoped to orgA', (await env.sql('select organization_id, status from audit_cases where id=$1', [caseId])).rows[0].organization_id === orgA);

  r = await audit('cases', { token: ownerA.token, body: { organization_id: orgA, action: 'update-status', id: caseId, status: 'researching' } });
  check('cannot skip the clock start (mark-ready) via update-status', r.status === 409);
  r = await audit('cases', { token: ownerA.token, body: { organization_id: orgA, action: 'mark-ready', id: caseId } });
  check('mark-ready starts the clock', r.status === 200 && !!(await env.sql('select start_condition_met_at from audit_cases where id=$1', [caseId])).rows[0].start_condition_met_at);
  await audit('cases', { token: ownerA.token, body: { organization_id: orgA, action: 'update-status', id: caseId, status: 'researching' } });
  r = await audit('cases', { token: ownerA.token, body: { organization_id: orgA, action: 'update-status', id: caseId, status: 'evidence_gathered' } });
  check('ordinary forward progress is allowed once the clock has started', r.status === 200);

  // ---------------------------------------------------------------- evidence + findings (real UNIQUE/FK constraints)
  r = await audit('evidence', { token: ownerA.token, body: { organization_id: orgA, case_id: caseId, source: 'Public web page https://testplumbing.example (retrieved 2026-09-27)', observation: 'No tel: link found in page HTML', confidence: 'low' } });
  check('evidence is recorded, persisted for real', r.status === 200 && (await env.sql('select count(*) from audit_evidence where case_id=$1', [caseId])).rows[0].count === '1');
  const evId = r.body.evidence.id;

  r = await audit('findings', { token: ownerA.token, body: { organization_id: orgA, case_id: caseId, title: 'No click-to-call', detail: 'No tel: link in the page HTML', statement_type: 'observed_fact', confidence: 'low', recommended_action: 'Add a click-to-call button' } });
  check('an observed_fact finding with no linked evidence is refused', r.status === 400 && r.body.problems?.some((p) => /evidence/.test(p)));
  r = await audit('findings', { token: ownerA.token, body: { organization_id: orgA, case_id: caseId, title: 'No click-to-call', detail: 'No tel: link in the page HTML', statement_type: 'observed_fact', confidence: 'low', recommended_action: 'Add a click-to-call button', evidence_ids: [evId] } });
  check('with real linked evidence it saves as a real DRAFT finding', r.status === 200 && r.body.finding.review_status === 'draft');
  const findingId = r.body.finding.id;
  check('the evidence link is a real row in audit_finding_evidence', (await env.sql('select count(*) from audit_finding_evidence where finding_id=$1 and evidence_id=$2', [findingId, evId])).rows[0].count === '1');
  r = await audit('findings', { token: ownerA.token, body: { organization_id: orgA, case_id: caseId, action: 'review', id: findingId, review_status: 'reviewed' } });
  check('the finding can be marked reviewed, with a real reviewer id stamped', r.status === 200 && r.body.finding.reviewed_by === ownerA.id);

  r = await audit('recommendations', { token: ownerA.token, body: { organization_id: orgA, case_id: caseId, finding_id: findingId, mechanism: 'Add a click-to-call button to the site header so mobile visitors can call in one tap.' } });
  check('a recommendation attaches to its own finding', r.status === 200);

  // ---------------------------------------------------------------- report: readiness, approval, immutability
  const full = Object.fromEntries(REQUIRED_REPORT_SECTIONS.map((s) => [s, `Real text for ${s}, written for this test case.`]));
  r = await audit('reports', { token: ownerA.token, body: { organization_id: orgA, case_id: caseId, action: 'create-draft', content: { executive_summary: 'only this section' } } });
  const draft1 = r.body.report;
  check('a draft report is created with a real content hash', typeof draft1.content_sha256 === 'string' && draft1.content_sha256.length === 64);
  r = await audit('reports', { token: ownerA.token, body: { organization_id: orgA, case_id: caseId, action: 'approve', id: draft1.id } });
  check('an incomplete report cannot be approved, with the real missing sections listed', r.status === 422 && r.body.problems.length >= 5);
  r = await audit('reports', { token: ownerA.token, body: { organization_id: orgA, case_id: caseId, action: 'create-draft', content: full } });
  const draft2 = r.body.report;
  r = await audit('reports', { token: ownerA.token, body: { organization_id: orgA, case_id: caseId, action: 'approve', id: draft2.id } });
  check('a complete report with a reviewed finding is approved and bound to its content hash', r.status === 200 && r.body.report.approved_content_sha256?.length === 64 && r.body.report.approved_by === ownerA.id);
  r = await audit('reports', { token: ownerA.token, body: { organization_id: orgA, case_id: caseId, action: 'approve', id: draft2.id } });
  check('an approved report is immutable — cannot be approved twice', r.status === 400);

  // ---------------------------------------------------------------- delivery + case closure + measured outcome
  r = await audit('deliveries', { token: ownerA.token, body: { organization_id: orgA, report_id: draft2.id, delivered: true } });
  check('claiming "delivered" with no provider confirmation is refused', r.status === 400);
  r = await audit('deliveries', { token: ownerA.token, body: { organization_id: orgA, report_id: draft2.id, provider_accepted: true } });
  check('an accepted-but-unconfirmed send is recorded honestly, without a delivered timestamp, with a real content-hash binding', r.status === 200 && r.body.delivery.delivered_at === null && !!r.body.delivery.provider_accepted_at && r.body.delivery.report_content_sha256?.length === 64);
  r = await audit('cases', { token: ownerA.token, body: { organization_id: orgA, action: 'update-status', id: caseId, status: 'delivered' } });
  check('the case can now be marked delivered — a real delivery record exists for the approved report', r.status === 200);

  r = await audit('outcomes', { token: ownerA.token, body: { organization_id: orgA, case_id: caseId, metric: 'inbound calls per week', baseline_period: '4 weeks pre-engagement', comparison_period: '4 weeks post-engagement', baseline_value: 12, comparison_value: 19, confounders: 'A local news mention ran during the comparison period.' } });
  check('a measured outcome (baseline vs comparison, confounders noted) is recorded as a real row', r.status === 200 && (await env.sql('select count(*) from audit_outcomes where case_id=$1', [caseId])).rows[0].count === '1');

  // A genuine gap this real-database run surfaces that the in-memory unit test cannot: nothing at the DATABASE layer stops a
  // direct write from silently corrupting an approved report's content — the sha256 binding is enforced only by the API path
  // (proven above/below), not by a Postgres trigger. Documented here rather than silently relied upon.
  await env.sql("update audit_reports set content = '{\"x\":1}'::jsonb where id=$1", [draft2.id]);
  r = await audit('deliveries', { token: ownerA.token, body: { organization_id: orgA, report_id: draft2.id, provider_accepted: true } });
  check('good news: the API layer still catches content tampered with directly in the database and refuses to (re-)deliver it', r.status === 409 && /no longer matches/.test(r.body.error));

  // ---------------------------------------------------------------- real cross-organization isolation (RLS, not just handler code)
  r = await audit('cases', { token: staffB.token, method: 'GET', query: { organization_id: orgB } });
  check("orgB's own staff can list (their own, empty) case set without error", r.status === 200 && Array.isArray(r.body) && r.body.length === 0);
  r = await audit('findings', { token: staffB.token, body: { organization_id: orgA, case_id: caseId, title: 'x', detail: 'x', statement_type: 'unknown' } });
  check("orgB's staff cannot write a finding into orgA's case", r.status === 403 || r.status === 404, `${r.status}`);
  const direct = await env.rest(staffB.token, `audit_findings?case_id=eq.${caseId}&select=id`);
  check("orgB's staff cannot read orgA's findings directly through PostgREST either (RLS, not app-layer filtering)", Array.isArray(direct.data) ? direct.data.length === 0 : direct.status >= 400, JSON.stringify(direct.data ?? direct.status));
  const anonRead = await env.rest(null, `audit_reports?id=eq.${draft2.id}&select=content`);
  check('the anonymous role cannot read an approved report\'s content', Array.isArray(anonRead.data) ? anonRead.data.length === 0 : anonRead.status >= 400);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed — Nova Audit engine lifecycle (real handlers + real local PostgreSQL/PostgREST; local, disposable)`);
process.exitCode = fail ? 1 : 0;
