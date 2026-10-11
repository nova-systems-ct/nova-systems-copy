// Nova Audit acceptance (prompt §7, §16A) on a real disposable database through the real handlers:
// intake → owner-approved clock policy → authorized test plan → evidence → findings with impact/limitations/decision →
// labeled financial scenarios (no double counting; "verified" only from records) → benchmarks → software review →
// composed report → approval bound to content hash → PDF of the exact approved version → secure client link that
// shows only that approved report → tamper/revoke/cross-org denial. Audit target is a Nova-owned TEST business.
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

try {
  const nova = (await one("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).id;
  const other = (await one("insert into organizations (name, slug, kind) values ('TEST Other','other','client') returning id")).id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: nova });
  const auditor = await env.createUser({ email: 'auditor@nova.test', role: 'nova_auditor', orgId: nova });
  const outsider = await env.createUser({ email: 'x@other.test', role: 'client_owner', orgId: other });
  const biz = (await one("insert into businesses (organization_id, name, website, phone, city, state, industry) values ($1,'TEST Shine Detailing','https://shine.example.test','+12035550100','Waterbury','CT','Mobile detailing') returning id", [nova])).id;
  const O = (body) => ({ token: owner.token, body: { organization_id: nova, ...body } });
  let r = await audit('cases', O({ action: 'create', business_id: biz, scope: 'inquiry handling and booking' }));
  const caseId = r.body.case.id;

  // ---------------------------------------------------------------- intake and clock policy
  r = await audit('intake', O({ case_id: caseId, intake: { website: 'https://shine.example.test', public_phone: '+12035550100', hours: 'Mon–Sat 8–18', contact_name: 'TEST Owner', requested_scope: 'calls, texts, web form, booking' }, reviewer_user_id: auditor.id }));
  check('intake records identity, channels, hours, contact, scope and the assigned reviewer', r.status === 200 && r.body.case.intake.public_phone === '+12035550100' && r.body.case.reviewer_user_id === auditor.id);
  r = await audit('intake', O({ case_id: caseId, clock_policy: { start_event: 'inputs', hours_basis: 'elapsed_hours', target_hours: 24, missing_input_rule: 'x', extension_notice: 'y' } }));
  check('a clock policy outside 48–72h or with missing terms is refused', r.status === 400, JSON.stringify(r.body));
  r = await audit('intake', { token: auditor.token, body: { organization_id: nova, case_id: caseId, clock_policy: { start_event: 'All inputs received and permission recorded', hours_basis: 'business_hours', target_hours: 72, missing_input_rule: 'Clock pauses until the input arrives', extension_notice: 'Owner is told before the deadline with a new date' }, approve_clock_policy: true } });
  check('only the owner can approve the clock policy', r.status === 403);
  await audit('intake', O({ case_id: caseId, clock_policy: { start_event: 'All inputs received and permission recorded', hours_basis: 'business_hours', target_hours: 72, missing_input_rule: 'Clock pauses until the input arrives', extension_notice: 'Owner is told before the deadline with a new date' }, deadline_terms: 'Report within 72 business hours of complete inputs', approve_clock_policy: true }));
  r = await audit('cases', O({ action: 'mark-ready', id: caseId }));
  check('with the policy approved, the clock starts', r.status === 200 && !!r.body.case.start_condition_met_at);

  // ---------------------------------------------------------------- test plan
  const tp = (body, who = owner) => audit('test-plan', { token: who.token, body: { organization_id: nova, case_id: caseId, ...body } });
  r = await tp({ action: 'create', channel: 'phone', target: '+12035550100', planned_at: '2026-10-14T15:00:00Z', test_identity: 'Nova audit test caller' });
  check('an active phone test without the business\'s written permission is refused', r.status === 409 && /permission/.test(r.body.error));
  await audit('intake', O({ case_id: caseId, active_test_authorization: { authorized_by_name: 'TEST Owner', role: 'Owner', channels: ['phone', 'form'], max_per_day: 1, ends_on: '2026-10-31', evidence: 'Signed audit request form' } }));
  r = await tp({ action: 'create', channel: 'phone', target: '+12035550100', planned_at: '2026-10-14T15:00:00Z', test_identity: 'Urgent: my basement is flooding' });
  check('a test posing as a customer with a fabricated urgent problem is refused', r.status === 409 && /urgent/.test(r.body.error));
  r = await tp({ action: 'create', channel: 'phone', target: '+12035550100', planned_at: '2026-10-14T15:00:00Z', test_identity: 'Nova audit test caller', conditions: 'Tuesday 11:00 ET, within published hours' });
  const t1 = r.body.test;
  check('an authorized, clearly identified test is planned', r.status === 200 && !!t1);
  r = await tp({ action: 'create', channel: 'phone', target: '+12035550100', planned_at: '2026-10-14T19:00:00Z', test_identity: 'Nova audit test caller' });
  check('a second call to the same number the same day is refused (no repeated calling)', r.status === 409 && /limit/.test(r.body.error));
  r = await tp({ action: 'create', channel: 'sms', target: '+12035550100', planned_at: '2026-10-15T15:00:00Z', test_identity: 'Nova audit test' });
  check('channels outside the permission are refused', r.status === 409);
  r = await tp({ action: 'create', channel: 'phone', target: '+12035550177', is_competitor: true, planned_at: '2026-10-15T15:00:00Z', test_identity: 'Nova audit test caller' });
  check('competitors are never actively called or texted', r.status === 409 && /public information only/.test(r.body.error));
  r = await tp({ action: 'record', id: t1.id, outcome: 'no_response', within_published_hours: false, notes: 'Called at 21:30 by mistake' });
  check('a call outside published hours is recorded but NOT scored as a failure', r.body.test.interpretation === 'outside_published_hours_not_scored');

  // ---------------------------------------------------------------- benchmarks and software
  const comp = (body) => audit('competitors', O({ case_id: caseId, action: 'create', ...body }));
  r = await comp({ name: 'TEST Rival A', rationale: 'Same service area and price tier', observations: [{ kind: 'observed', text: 'Online booking available' }] });
  check('an "observed" competitor statement needs a source', r.status === 400);
  for (const n of ['A', 'B', 'C']) await comp({ name: `TEST Rival ${n}`, url: `https://rival${n.toLowerCase()}.example.test`, rationale: 'Same service area and price tier', observations: [{ kind: 'advertised', text: 'Advertises same-day replies', source: `https://rival${n.toLowerCase()}.example.test/contact` }, { kind: 'untested', text: 'Response time not tested' }] });
  r = await comp({ name: 'TEST Rival D', rationale: 'Same service area and price tier' });
  check('at most three competitors, each with a rationale and evidence kind', r.status === 409);
  const sw = (body) => audit('software', O({ case_id: caseId, action: 'create', ...body }));
  r = await sw({ name: 'Scheduler X', monthly_cost_cents: 4900 });
  check('software spend is never recorded without its source', r.status === 400 && /never estimates/.test(r.body.error));
  r = await sw({ name: 'Scheduler X', monthly_cost_cents: 4900, cost_source: 'owner_supplied', usage: 'rarely_used', classification: 'possible_overlap' });
  check('owner-supplied software is classified without any automatic cancellation advice', r.status === 200 && r.body.item.classification === 'possible_overlap');

  // ---------------------------------------------------------------- evidence, findings, scenarios
  r = await audit('evidence', O({ case_id: caseId, source: 'TEST public web page https://shine.example.test (local fixture)', observation: 'Contact page lists a phone number and a form; no booking link', confidence: 'medium' }));
  const evId = r.body.evidence.id;
  r = await audit('findings', O({ case_id: caseId, title: 'No online booking path', detail: 'The contact page offers a phone number and a form but no way to book', statement_type: 'observed_fact', confidence: 'medium', recommended_action: 'Offer booking from the contact page', evidence_ids: [evId] }));
  const fId = r.body.finding.id;
  const sc = (body) => audit('scenarios', O({ case_id: caseId, action: 'create', ...body }));
  r = await sc({ label: 'x', inputs: { eligible_volume: { value: 100 }, failure_share: { value: 0.27, source: 'industry_reference' }, conversion: { value: 0.3, source: 'assumed' }, average_sale_cents: { value: 18000, source: 'owner_provided' } } });
  check('a scenario input without a source is refused', r.status === 400 && /source/.test(r.body.error));
  r = await sc({ label: 'After-hours inquiries without a booking path', finding_id: fId, overlap_group: 'after_hours', inputs: { eligible_volume: { value: 40, unit: 'inquiries/month', source: 'owner_provided' }, failure_share: { value: 0.27, source: 'industry_reference', note: 'not a fact about this business' }, conversion: { value: 0.3, source: 'assumed' }, average_sale_cents: { value: 18000, source: 'owner_provided' }, margin_share: { value: 0.4, source: 'owner_provided' } } });
  check('a scenario with assumed/industry inputs is labeled "scenario", gross separate from contribution', r.body.scenario.status === 'scenario' && r.body.scenario.result.monthly_gross_opportunity_cents === Math.round(40 * 0.27 * 0.3 * 18000) && r.body.scenario.result.monthly_contribution_cents === Math.round(Math.round(40 * 0.27 * 0.3 * 18000) * 0.4), JSON.stringify(r.body.scenario?.result));
  await sc({ label: 'Same customers, missed-call view', overlap_group: 'after_hours', inputs: { eligible_volume: { value: 30, source: 'owner_provided' }, failure_share: { value: 0.27, source: 'industry_reference' }, conversion: { value: 0.3, source: 'assumed' }, average_sale_cents: { value: 18000, source: 'owner_provided' } } });
  r = await audit('scenarios', { token: owner.token, method: 'GET', query: { organization_id: nova, case_id: caseId } });
  check('overlapping scenarios are counted once in the total', r.body.total.monthly_gross_opportunity_cents === Math.round(40 * 0.27 * 0.3 * 18000) && r.body.total.counted_once_groups === 1 && r.body.total.any_unverified === true, JSON.stringify(r.body.total));
  r = await audit('finding-details', O({ case_id: caseId, finding_id: fId, financial_impact_status: 'verified' }));
  check('"verified" financial impact is refused without a scenario built only from records', r.status === 409);
  await audit('finding-details', O({ case_id: caseId, finding_id: fId, period_start: '2026-10-01', period_end: '2026-10-10', customer_impact: 'Customers who find the site after hours cannot book', financial_impact_status: 'scenario', limitations: 'Based on public pages and owner estimates; no booking records reviewed', nova_can_implement: 'yes', owner_decision: 'Approve a booking path on the contact page' }));
  await audit('findings', O({ case_id: caseId, action: 'review', id: fId, review_status: 'reviewed' }));
  await audit('recommendations', O({ case_id: caseId, finding_id: fId, mechanism: 'Add a booking link that checks real availability', effort_range: '1–2 days', cost_range: 'per approved scope', dependencies: 'Owner-approved prices', uncertainty: 'Volume estimate is owner-provided', verification_plan: 'Count booked appointments from the link for 30 days', priority_rank: 1 })).catch(() => null);

  // ---------------------------------------------------------------- compose → approve → PDF → secure link
  r = await audit('compose', O({ case_id: caseId, executive_summary: 'TEST: the business answers calls in hours but offers no way to book online; customers who arrive after hours have no path. One scenario estimates the opportunity; it depends on owner-provided volume and an assumed conversion.' }));
  const rep = r.body.report;
  check('the report is composed from recorded evidence, findings, scenarios, benchmarks and tests (professional title, not a CPA audit)', r.status === 200 && rep.content.title === 'Operational Findings & Revenue Opportunity Report' && rep.content.evidence_reviewed.length === 1 && rep.content.competitor_benchmarks.length === 3 && /not a CPA financial audit/.test(rep.content.limitations), JSON.stringify(Object.keys(rep.content)));
  r = await audit('report-pdf', { token: owner.token, method: 'GET', query: { organization_id: nova, report_id: rep.id } });
  check('a draft cannot be exported as the report PDF', r.status === 409);
  r = await audit('reports', O({ case_id: caseId, action: 'approve', id: rep.id }));
  check('the composed report is approved and bound to its content hash', r.status === 200 && !!r.body.report.approved_content_sha256, JSON.stringify(r.body).slice(0, 300));
  r = await audit('report-pdf', { token: owner.token, method: 'GET', query: { organization_id: nova, report_id: rep.id } });
  const pdf = Buffer.from(r.body.pdf_base64 || '', 'base64').toString('latin1');
  check('the PDF is generated from the exact approved version and carries its hash', r.status === 200 && pdf.startsWith('%PDF') && pdf.includes('Operational Findings') && pdf.includes(r.body.content_sha256.slice(0, 16)));
  r = await audit('publish', { token: outsider.token, body: { organization_id: nova, report_id: rep.id } });
  check('another organization cannot publish this report', r.status === 403);
  r = await audit('publish', O({ report_id: rep.id }));
  const token = r.body.link?.split('/report/')[1];
  check('publishing creates a secure, expiring client link (nothing emailed) — "available to client" ≠ "sent"', r.status === 200 && !!token && /Nothing was emailed/.test(r.body.note));
  const view = (t = token) => call({ resource: 'audit', op: 'report-view', method: 'GET', query: { token: t } });
  r = await view();
  check('the client link shows exactly the approved report', r.status === 200 && r.body.version === rep.version && r.body.content.title === 'Operational Findings & Revenue Opportunity Report');
  check('opening is recorded (first view, count)', (await one('select view_count, first_viewed_at from audit_deliveries where report_id=$1', [rep.id])).view_count === 1);
  check('a guessed link shows nothing', (await view('x'.repeat(32))).status === 404);
  await env.sql("update audit_reports set content = jsonb_set(content, '{executive_summary}', '\"TAMPERED\"') where id=$1", [rep.id]);
  r = await view();
  check('content changed after approval invalidates the client link (no tampered report is ever shown)', r.status === 410);
  const del = await one('select id from audit_deliveries where report_id=$1', [rep.id]);
  r = await audit('revoke', O({ delivery_id: del.id }));
  check('Nova can revoke a client link', r.status === 200 && (await view()).status === 404);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed — Nova Audit evidence, scenarios and secure delivery (real handlers + local PostgreSQL)`);
process.exitCode = fail ? 1 : 0;
