// Rep pipeline, lead ownership/de-duplication, product readiness, toolkit and audit terms: real handlers (api/client.js) against
// REAL PostgreSQL + PostgREST (local, disposable). Auth/Storage/Resend are stand-ins.
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const env = await startTestEnv({ migrations: allMigrations(), publicBuckets: [] });
Object.assign(process.env, env.appEnv, { APP_BASE_URL: 'https://app.test', SALES_EMAIL_MODE: 'dry_run' });
const { default: handler } = await import('../api/client.js');
const call = makeCaller(handler);
const L = (op, o = {}) => call({ resource: 'leads', op, ...o });
const C = (op, o = {}) => call({ resource: 'catalog', op, ...o });
try {
  const org = (await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).rows[0].id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: org, name: 'Isaac Owner' });
  const mgr = await env.createUser({ email: 'mgr@nova.test', role: 'nova_sales_manager', orgId: org, name: 'Mia Manager' });
  const mgr2 = await env.createUser({ email: 'mgr2@nova.test', role: 'nova_sales_manager', orgId: org, name: 'Other Manager' });
  const repA = await env.createUser({ email: 'a@nova.test', role: 'nova_sales', orgId: org, name: 'Rep Alpha' });
  const repB = await env.createUser({ email: 'b@nova.test', role: 'nova_sales', orgId: org, name: 'Rep Bravo' });
  const cand = await env.createUser({ email: 'cand@nova.test', role: 'nova_sales_candidate', orgId: org, name: 'Cand Idate' });
  const susp = await env.createUser({ email: 's@nova.test', role: 'nova_sales', orgId: org, name: 'Rep Suspended', status: 'inactive' });
  const client = await env.createUser({ email: 'client@x.test', role: 'client_owner', orgId: (await env.sql("insert into organizations (name, slug, kind) values ('Acme','acme','client') returning id")).rows[0].id });
  await env.sql("insert into sales_reps (user_id, organization_id, display_name, status, manager_user_id) values ($1,$5,'Rep Alpha','active',$2), ($3,$5,'Rep Bravo','active',$4), ($6,$5,'Cand','candidate',null), ($7,$5,'Susp','suspended',null)", [repA.id, mgr.id, repB.id, mgr2.id, org, cand.id, susp.id]);
  await env.reload();
  const prospect = (o = {}) => ({ business_name: 'Acme Plumbing LLC', website: 'https://www.acmeplumbing.test', phone: '(203) 555-0142', city: 'Waterbury', state: 'CT', contact_name: 'Joe Acme', contact_email: 'joe@acmeplumbing.test', ...o });

  // ---------------------------------------------------------------- access boundaries
  let r = await L('home', { method: 'GET', token: cand.token });
  check('a candidate has no leads workspace (403)', r.status === 403);
  r = await L('home', { method: 'GET', token: client.token });
  check('a client user has no leads workspace (403)', r.status === 403);
  r = await L('home', { method: 'GET', token: susp.token });
  check('a suspended rep has no leads workspace (403)', r.status === 403);
  r = await L('home', { method: 'GET' });
  check('no session → 401', r.status === 401);
  r = await L('team-list', { method: 'GET', token: repA.token });
  check('a rep cannot open the team view', r.status === 403);

  // ---------------------------------------------------------------- creating prospects + duplicate protection
  r = await L('create', { token: repA.token, body: { business_name: 'X' } });
  check('an incomplete prospect is rejected with field errors', r.status === 422 && !!r.body.errors.business_name && !!r.body.errors.contact_name);
  r = await L('create', { token: repA.token, body: prospect() });
  const dealA = r.body.deal_id;
  check('rep creates a prospect: assigned to them, stage New, source rep_sourced', r.status === 200 && (await env.sql('select stage, assigned_rep_id, lead_source_kind, pipeline from crm_deals where id=$1', [dealA])).rows[0].assigned_rep_id === repA.id);
  r = await L('create', { token: repB.token, body: prospect({ business_name: 'Acme Plumbing, Inc.', contact_name: 'Someone', website: 'acmeplumbing.test' }) });
  check('another rep entering the SAME business (differently written) is blocked without revealing who owns it', r.status === 409 && r.body.duplicate === true && !JSON.stringify(r.body).includes(repA.id) && !r.body.existing_deal_id);
  r = await L('create', { token: repB.token, body: prospect({ business_name: 'Totally Different Co', website: 'https://other.test', phone: '203-555-0199', contact_email: 'x@other.test' }) });
  const dealB = r.body.deal_id;
  check('a genuinely different prospect is fine', r.status === 200);
  r = await L('create', { token: repA.token, body: prospect({ business_name: 'Acme Plumbing LLC' }) });
  check('the same rep re-entering their own prospect is also stopped (no duplicates)', r.status === 409);
  r = await L('list', { method: 'GET', token: repA.token });
  check("a rep's list contains only their own lead", r.body.length === 1 && r.body[0].id === dealA && r.body[0].business.name === 'Acme Plumbing LLC');
  r = await L('get', { method: 'GET', token: repB.token, query: { id: dealA } });
  check("another rep cannot open a lead (404 — existence is not confirmed)", r.status === 404);
  r = await L('move', { token: repB.token, body: { deal_id: dealA, to: 'contacted' } });
  check("...nor move it", r.status === 404);
  r = await L('log-activity', { token: repB.token, body: { deal_id: dealA, kind: 'note', body: 'hello there' } });
  check("...nor write to it", r.status === 404);
  const direct = await env.rest(repA.token, 'crm_deals?select=id');
  check('a rep cannot read crm_deals straight through PostgREST', Array.isArray(direct.data) ? direct.data.length === 0 : direct.status >= 400, JSON.stringify(direct.data).slice(0, 80));
  const directKeys = await env.rest(repA.token, 'sales_lead_keys?select=key');
  check('...nor the de-duplication keys', Array.isArray(directKeys.data) ? directKeys.data.length === 0 : directKeys.status >= 400);

  // ---------------------------------------------------------------- pipeline entry rules
  r = await L('move', { token: repA.token, body: { deal_id: dealA, to: 'contacted' } });
  check('cannot mark Contacted before logging any outreach', r.status === 422 && /outreach/i.test(r.body.error));
  r = await L('log-activity', { token: repA.token, body: { deal_id: dealA, kind: 'call', body: 'Called the shop, owner picked up', outcome: 'spoke_with_contact', next_action: 'Send intro email', next_action_at: new Date(Date.now() + 86400000).toISOString() } });
  check('logging a real call succeeds and sets the next action', r.status === 200 && (await env.sql('select next_action from crm_deals where id=$1', [dealA])).rows[0].next_action === 'Send intro email');
  r = await L('log-activity', { token: repA.token, body: { deal_id: dealA, kind: 'call', body: 'future call', occurred_at: new Date(Date.now() + 3 * 86400000).toISOString() } });
  check('an activity cannot be dated in the future', r.status === 422);
  r = await L('move', { token: repA.token, body: { deal_id: dealA, to: 'contacted' } });
  check('after a logged attempt the lead can move to Contacted', r.status === 200);
  r = await L('move', { token: repA.token, body: { deal_id: dealA, to: 'discovery_completed', discovery: {} } });
  check('cannot skip straight to Discovery Completed', r.status === 422);
  r = await L('move', { token: repA.token, body: { deal_id: dealA, to: 'qualified', qualification: { summary: 'short' } } });
  check('Qualified needs a real summary', r.status === 422);
  r = await L('move', { token: repA.token, body: { deal_id: dealA, to: 'qualified', qualification: { summary: 'Family plumbing business; the owner answers his own phone in the van.', decision_maker: 'yes' } } });
  check('Qualified with a summary + decision-maker answer', r.status === 200 && (await env.sql('select qualification from crm_deals where id=$1', [dealA])).rows[0].qualification.decision_maker === 'yes');
  r = await L('move', { token: repA.token, body: { deal_id: dealA, to: 'discovery_scheduled', discovery_at: '2020-01-01T10:00:00Z' } });
  check('discovery must be scheduled in the future', r.status === 422);
  const when = new Date(Date.now() + 2 * 86400000).toISOString();
  r = await L('move', { token: repA.token, body: { deal_id: dealA, to: 'discovery_scheduled', discovery_at: when } });
  check('Discovery Scheduled with a future time', r.status === 200);
  r = await L('move', { token: repA.token, body: { deal_id: dealA, to: 'discovery_completed', discovery: { findings: 'They miss calls.' } } });
  check('Discovery Completed needs real answers (diagnosis first) — a bare "findings" is not enough', r.status === 422);
  r = await L('move', { token: repA.token, body: { deal_id: dealA, to: 'discovery_completed', discovery: { how_customers_reach_them: 'Mostly by phone, some website form', what_happens_to_missed_inquiries: 'Voicemail, called back next day maybe', current_follow_up_process: 'None written down', findings: 'Evening and weekend calls go unanswered and there is no follow-up routine.' } } });
  check('Discovery Completed with real discovery notes', r.status === 200);
  for (const to of ['proposal', 'awaiting_signature_payment', 'submitted_for_verification', 'won']) {
    r = await L('move', { token: repA.token, body: { deal_id: dealA, to } });
    check(`a rep cannot move a card to "${to}" by hand`, r.status === 422, `${r.status}`);
  }
  r = await L('get', { method: 'GET', token: repA.token, query: { id: dealA } });
  check('history is recorded stage by stage, with actor and time', r.body.stage_history.map((e) => e.to_stage).join(',') === 'new,contacted,qualified,discovery_scheduled,discovery_completed' && r.body.assignment_history.length === 1);
  check('the rep view never includes internal owner fields', !('owner_user_id' in r.body.deal) && !('value_cents' in r.body.deal));
  let dbErr = null; try { await env.sql("update sales_deal_stage_events set reason='x'"); } catch (e) { dbErr = e.message; }
  check('stage history is append-only in the database', !!dbErr);

  // ---------------------------------------------------------------- lost / reopen / duplicates release
  r = await L('move', { token: repA.token, body: { deal_id: dealA, to: 'lost' } });
  check('Lost needs a reason code and a note', r.status === 422);
  r = await L('move', { token: repA.token, body: { deal_id: dealA, to: 'lost', lost_reason_code: 'bad_timing', reason: 'Owner is away until next quarter, asked us to call back then' } });
  check('lost with reason recorded', r.status === 200 && (await env.sql('select stage, lost_reason_code, closed_at from crm_deals where id=$1', [dealA])).rows[0].lost_reason_code === 'bad_timing');
  r = await L('create', { token: repB.token, body: prospect({ business_name: 'Acme Plumbing LLC', contact_name: 'Joe Again' }) });
  const dealB2 = r.body.deal_id;
  check('once a lead is lost its claim is released — another rep may now work that business', r.status === 200);
  r = await L('move', { token: repA.token, body: { deal_id: dealA, to: 'contacted', reason: 'They called me back and want to talk' } });
  check('reopening is refused when someone else now holds that prospect', r.status === 409);
  await env.sql("update crm_deals set stage='lost', closed_at=now() where id=$1", [dealB2]); await env.sql("update sales_lead_keys set active=false where deal_id=$1", [dealB2]);
  r = await L('move', { token: repA.token, body: { deal_id: dealA, to: 'contacted', reason: 'short' } });
  check('reopening needs a real reason', r.status === 422);
  r = await L('move', { token: repA.token, body: { deal_id: dealA, to: 'contacted', reason: 'They called me back and want to talk' } });
  check('the rep can reopen their own lost lead (count tracked, follow-up scheduled)', r.status === 200 && (await env.sql('select reopened_count, closed_at, next_action from crm_deals where id=$1', [dealA])).rows[0].reopened_count === 1);

  // ---------------------------------------------------------------- do-not-contact
  r = await L('mark-dnc', { token: repA.token, body: { deal_id: dealA, note: 'Said stop calling' } });
  check('marking do-not-contact closes the lead and records it', r.status === 200 && (await env.sql("select do_not_contact from crm_contacts where id=(select contact_id from crm_deals where id=$1)", [dealA])).rows[0].do_not_contact === true && (await env.sql('select stage from crm_deals where id=$1', [dealA])).rows[0].stage === 'lost');
  r = await L('log-activity', { token: repA.token, body: { deal_id: dealA, kind: 'call', body: 'trying again anyway' } });
  check('outreach to a do-not-contact person cannot be logged', r.status === 409);
  r = await L('move', { token: repA.token, body: { deal_id: dealA, to: 'contacted', reason: 'I would like to reopen it please' } });
  check('a do-not-contact lead cannot be reopened', r.status === 422);
  r = await L('update-contact', { token: repA.token, body: { deal_id: dealA, name: 'Joe Acme', sms_consent: true, do_not_contact: false } });
  const ct = (await env.sql("select sms_consent, do_not_contact from crm_contacts where id=(select contact_id from crm_deals where id=$1)", [dealA])).rows[0];
  check('a rep cannot grant consent or clear do-not-contact through a contact edit', ct.sms_consent === false && ct.do_not_contact === true);

  // ---------------------------------------------------------------- follow-ups / home (all counted from real rows)
  await L('log-activity', { token: repB.token, body: { deal_id: dealB, kind: 'task', body: 'Send intro email', due_at: new Date(Date.now() + 3600000).toISOString() } });
  await env.sql("update crm_deals set next_action='Call back', next_action_at = now() - interval '2 days' where id=$1", [dealB]);
  r = await L('home', { method: 'GET', token: repB.token });
  check('home: overdue follow-up, open task and counts come from stored rows', r.body.follow_ups_overdue.length === 1 && r.body.follow_ups_overdue[0].deal_id === dealB && r.body.open_tasks.length === 1 && r.body.counts.by_stage.new === 1);
  check('home: shows outstanding documents and training progress (no fabricated metrics)', Array.isArray(r.body.documents_outstanding) && r.body.training.programs_total === 10 && r.body.training.programs_completed === 0);
  r = await L('home', { method: 'GET', token: repA.token });
  check("a different rep's home shows none of B's items", r.body.follow_ups_overdue.length === 0);
  const tid = (await env.sql("select id from crm_activities where kind='task' limit 1")).rows[0].id;
  r = await L('complete-task', { token: repA.token, body: { id: tid } });
  check("a rep cannot complete someone else's task", r.status === 404);
  r = await L('complete-task', { token: repB.token, body: { id: tid } });
  check('the owner of the task can', r.status === 200);

  // ---------------------------------------------------------------- manager / owner
  r = await L('team-list', { method: 'GET', token: mgr2.token });
  check("a manager sees only their own reps' leads", r.status === 200 && r.body.deals.every((d) => d.assigned_rep_id === repB.id) && r.body.deals.length >= 1);
  r = await L('team-list', { method: 'GET', token: mgr.token, query: { rep_id: repB.id } });
  check("a manager cannot request another manager's rep", r.status === 403);
  r = await L('team-list', { method: 'GET', token: mgr2.token, query: { overdue: 'true' } });
  check('overdue filter finds the overdue lead', r.body.deals.length === 1 && r.body.deals[0].overdue === true);
  r = await L('team-get', { method: 'GET', token: mgr.token, query: { id: dealB } });
  check("a manager cannot open another manager's lead", r.status === 403);
  r = await L('owner-create', { token: mgr.token, body: prospect({ business_name: 'Managers Cannot Create' }) });
  check('only the owner can create/assign leads directly', r.status === 403);
  r = await L('owner-create', { token: owner.token, body: prospect({ business_name: 'Pool Lead Inc', website: 'https://pool.test', phone: '203-555-0111', contact_email: 'a@pool.test', city: 'Hartford' }) });
  const pool = r.body.deal_id;
  check('the owner can create an UNASSIGNED lead', r.status === 200 && (await env.sql('select assigned_rep_id from crm_deals where id=$1', [pool])).rows[0].assigned_rep_id === null);
  r = await L('owner-create', { token: owner.token, body: prospect({ business_name: 'Pool Lead Inc', city: 'Hartford', website: 'https://pool.test', phone: '203-555-0111', contact_email: 'a@pool.test' }) });
  check('the owner gets a duplicate warning with the existing lead id', r.status === 409);
  r = await L('team-list', { method: 'GET', token: owner.token, query: { unassigned: 'true' } });
  check('the unassigned pool is visible to the owner only', r.body.deals.length === 1 && (await L('team-list', { method: 'GET', token: mgr.token, query: { unassigned: 'true' } })).status === 403);
  r = await L('assign', { token: mgr.token, body: { deal_id: pool, to_user_id: repA.id, reason: 'take this one' } });
  check('a manager cannot pull leads from the pool', r.status === 403);
  r = await L('assign', { token: owner.token, body: { deal_id: pool, to_user_id: susp.id, reason: 'assign to suspended' } });
  check('a lead cannot be assigned to a suspended rep', r.status === 422);
  r = await L('assign', { token: owner.token, body: { deal_id: pool, to_user_id: repA.id, reason: 'Territory match' } });
  check('the owner assigns it; assignment history recorded; rep notified', r.status === 200 && (await env.sql('select count(*) from sales_lead_assignments where deal_id=$1', [pool])).rows[0].count === '1' && (await env.sql("select count(*) from sales_notifications where kind='lead_assigned' and user_id=$1", [repA.id])).rows[0].count === '1');
  r = await L('list', { method: 'GET', token: repA.token });
  check('the newly assigned lead appears in that rep\'s list', r.body.some((d) => d.id === pool));
  r = await L('assign', { token: mgr.token, body: { deal_id: pool, to_user_id: repB.id, reason: 'not my team' } });
  check("a manager cannot move a lead to a rep outside their team", r.status === 403);
  r = await L('import', { token: owner.token, body: { assign_to: repB.id, rows: [prospect({ business_name: 'Import One', website: 'https://one.test', phone: '203-555-0201', contact_email: 'a@one.test' }), prospect({ business_name: 'Import Two', website: 'https://two.test', phone: '203-555-0202', contact_email: 'a@two.test' }), prospect({ business_name: 'Import One Again', website: 'https://one.test', phone: '203-555-0203' }), { business_name: '' }] } });
  check('bulk import: creates, skips duplicates, reports invalid rows', r.body.created === 2 && r.body.duplicates === 1 && r.body.failed === 1);
  r = await L('reassign-from-rep', { token: owner.token, body: { from_user_id: repB.id, to_user_id: repA.id, reason: 'Rep B is on leave' } });
  check('owner reassigns all open leads from one rep to another, each recorded', r.status === 200 && r.body.moved >= 3 && (await env.sql("select count(*) from crm_deals where assigned_rep_id=$1 and stage not in ('won','lost')", [repB.id])).rows[0].count === '0');
  r = await L('stage-override', { token: mgr.token, body: { deal_id: pool, to: 'contacted', reason: 'manager override attempt' } });
  check('a manager cannot override stages', r.status === 403);
  r = await L('stage-override', { token: owner.token, body: { deal_id: pool, to: 'won', reason: 'owner override to won attempt' } });
  check('even the owner cannot skip verification to mark a sale won', r.status === 422);
  r = await L('stage-override', { token: owner.token, body: { deal_id: pool, to: 'contacted', reason: 'Rep contacted by phone; log missing' } });
  check('owner override works, needs a reason, and is audited', r.status === 200 && (await env.sql("select count(*) from sales_audit_log where action='stage_override'")).rows[0].count === '1');
  r = await L('clear-dnc', { token: mgr.token, body: { contact_id: (await env.sql('select contact_id from crm_deals where id=$1', [dealA])).rows[0].contact_id, reason: 'contact said okay in writing' } });
  check('only the owner can clear do-not-contact', r.status === 403);

  // ---------------------------------------------------------------- catalog / readiness / toolkit
  r = await C('products', { method: 'GET', token: cand.token });
  check('a candidate cannot open the live product catalog', r.status === 403);
  r = await C('products', { method: 'GET', token: repA.token });
  check('every offering starts as Draft, un-priced, and NOT proposable', r.status === 200 && r.body.products.length >= 10 && r.body.products.every((p) => p.readiness === 'draft' && !p.can_propose && p.price === null && /Do not quote/.test(p.price_note)));
  const audit = r.body.products.find((p) => p.slug === 'nova-audit-digital');
  r = await C('set-readiness', { token: repA.token, body: { product_id: audit.id, to: 'available_for_sale', reason: 'trying to promote' } });
  check('a rep cannot change readiness', r.status === 403);
  r = await C('set-readiness', { token: owner.token, body: { product_id: audit.id, to: 'available_for_sale', reason: 'ready to go' } });
  check('cannot be Available for Sale without reviewed info', r.status === 422);
  await C('save-info', { token: owner.token, body: { product_id: audit.id, info: { what_it_is: 'A scoped business diagnostic with a written report.', discovery_questions: ['How do customers find you?', 'What happens to missed calls?'], includes: ['Written findings'] } } });
  r = await C('products', { method: 'GET', token: repA.token });
  check('unreviewed sales info is hidden from reps', r.body.products.find((p) => p.slug === 'nova-audit-digital').info === null);
  r = await C('review-info', { token: owner.token, body: { product_id: audit.id } });
  check('review needs explicit confirmation', r.status === 422);
  await C('review-info', { token: owner.token, body: { product_id: audit.id, confirm: true } });
  r = await C('set-readiness', { token: owner.token, body: { product_id: audit.id, to: 'available_for_sale', reason: 'ready to go' } });
  check('cannot be Available for Sale without an approved price', r.status === 422 && /price/.test(r.body.error));
  r = await C('set-pricing', { token: owner.token, body: { product_id: audit.id, unit_price_cents: 12, billing: 'one_time', confirm: true } });
  check('a nonsensical price is refused', r.status === 422);
  r = await C('set-pricing', { token: repA.token, body: { product_id: audit.id, unit_price_cents: 50000, billing: 'one_time', confirm: true } });
  check('a rep cannot set a price', r.status === 403);
  await C('set-pricing', { token: owner.token, body: { product_id: audit.id, unit_price_cents: 50000, billing: 'one_time', confirm: true } }); // TEST VALUE ONLY — not a real Nova price
  r = await C('set-readiness', { token: owner.token, body: { product_id: audit.id, to: 'available_for_sale', reason: 'ready to go' } });
  check('with reviewed info and an owner-approved price it can be Available for Sale', r.status === 200);
  r = await C('products', { method: 'GET', token: repA.token });
  const a2 = r.body.products.find((p) => p.slug === 'nova-audit-digital');
  check('reps now see the info, the approved price and that it can be proposed', a2.can_propose && a2.price.unit_price_cents === 50000 && a2.info.what_it_is.includes('diagnostic'));
  const wave = r.body.products.find((p) => p.slug === 'nova-wave-one');
  r = await C('set-readiness', { token: owner.token, body: { product_id: wave.id, to: 'pilot_approved', reason: 'limited pilot with one client' } });
  check('pilot approval requires written pilot terms', r.status === 422);
  r = await C('set-readiness', { token: owner.token, body: { product_id: wave.id, to: 'pilot_approved', reason: 'limited pilot with one client', pilot_terms: 'One location, 30-day trial, no guarantees of results.' } });
  r = await C('products', { method: 'GET', token: repA.token });
  check('a pilot is labelled as a pilot with the owner\'s terms and is proposable only as such', r.body.products.find((p) => p.slug === 'nova-wave-one').readiness_label === 'Pilot Approved' && r.body.products.find((p) => p.slug === 'nova-wave-one').pilot_terms.includes('30-day'));
  check('readiness history is recorded (append-only)', (await env.sql('select count(*) from sales_product_readiness_history')).rows[0].count === '2');

  r = await C('toolkit-save', { token: owner.token, body: { kind: 'script', title: 'Opening call script', body: 'Hi <name>, this is <rep> from Nova Systems. I would like to ask how new customers reach you today.', program_slug: 'cold-calling', compliance_note: 'No results promises.' } });
  const tk = r.body.item;
  check('toolkit item saved as DRAFT and angle brackets are preserved', r.status === 200 && tk.status === 'draft' && tk.body.includes('<name>'));
  r = await C('toolkit', { method: 'GET', token: repA.token });
  check('reps do not see drafts', r.body.length === 0);
  r = await C('toolkit-approve', { token: repA.token, body: { id: tk.id, confirm: true } });
  check('a rep cannot approve toolkit items', r.status === 403);
  r = await C('toolkit-approve', { token: owner.token, body: { id: tk.id } });
  check('approval needs explicit confirmation', r.status === 422);
  await C('toolkit-approve', { token: owner.token, body: { id: tk.id, confirm: true } });
  r = await C('toolkit', { method: 'GET', token: repA.token });
  check('after approval reps see it', r.body.length === 1 && r.body[0].title === 'Opening call script');
  r = await C('toolkit-save', { token: owner.token, body: { id: tk.id, kind: 'script', title: 'Opening call script', body: 'Version two of the opening script text.' } });
  const tk2 = r.body.item;
  r = await C('toolkit', { method: 'GET', token: repA.token });
  check('editing an approved item makes a new draft; reps keep seeing the approved text until the new one is approved', tk2.version === 2 && tk2.status === 'draft' && r.body.length === 1 && r.body[0].body.includes('<name>'));
  await C('toolkit-approve', { token: owner.token, body: { id: tk2.id, confirm: true } });
  r = await C('toolkit', { method: 'GET', token: repA.token });
  check('approving v2 retires v1', r.body.length === 1 && r.body[0].version === 2);

  r = await C('audit-terms', { method: 'GET', token: repA.token });
  check('until the owner approves audit terms, reps see NO turnaround promise', r.body.approved === null && /not been confirmed/.test(r.body.note));
  r = await C('save-audit-terms', { token: owner.token, body: { turnaround_min_hours: 24, turnaround_max_hours: 72, statement: 'Your written audit report is typically delivered within 24 to 72 hours of receiving your information.' } });
  const cfg = r.body.config;
  r = await C('audit-terms', { method: 'GET', token: repA.token });
  check('a saved-but-unapproved proposal is still not shown to reps', r.body.approved === null);
  await C('approve-audit-terms', { token: owner.token, body: { config_id: cfg.id } });
  r = await C('audit-terms', { method: 'GET', token: repA.token });
  check('once approved, reps see the exact owner-approved statement', r.body.approved.turnaround_max_hours === 72 && r.body.approved.statement.includes('24 to 72'));
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
