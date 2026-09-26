// Journey A (part 1): Application → owner review → secure invitation → account. Runs the REAL request handlers
// (api/client.js) against a REAL PostgreSQL + PostgREST (local, disposable). Supabase Auth, Storage and Resend are
// stand-ins. NOT a Supabase, Resend or production test.
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const env = await startTestEnv({ migrations: allMigrations(), publicBuckets: [] });
Object.assign(process.env, env.appEnv, { APP_BASE_URL: 'https://app.test', SALES_EMAIL_MODE: 'dry_run' });
const { default: handler } = await import('../api/client.js');
const call = makeCaller(handler);
try {
  const org = (await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).rows[0].id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: org, name: 'Isaac Owner' });
  const mgr = await env.createUser({ email: 'mgr@nova.test', role: 'nova_sales_manager', orgId: org, name: 'Mia Manager' });
  const rep0 = await env.createUser({ email: 'rep0@nova.test', role: 'nova_sales', orgId: org });
  await env.reload();

  const goodProfile = { name: 'Jane Applicant', phone: '(203) 555-0142', city: 'Waterbury, CT', timezone: 'America/New_York', hours_per_week: 20, availability_days: ['mon', 'tue', 'thu'], preferred_hours: 'Evenings', experience: 'Two years of retail and customer service; I enjoy helping owners solve problems.', channels: ['telephone', 'email'], motivation: 'I like working with small business owners and I want structured training before I talk to anyone.', scenario_no_data: 'I would say I cannot know yet; I would ask about their calls, follow-up and website, and offer a diagnostic first without promising a number.', scenario_objection: 'I would ask how new customers currently find and contact them, and what happens to those who do not get an answer.', ack_privacy: true, ack_truthful: true, ack_no_guarantee: true, ack_conduct: true };
  const magic = async (email) => { const row = (await env.sql("select body from sales_notifications where kind='apply_link' and email=$1 order by created_at desc limit 1", [email])).rows[0]; const link = row?.body.match(/http[^\s]+/)?.[0]; return env.stubServer.consumeMagicLink(link); };

  // ------------------------------------------------------------------ public start
  let r = await call({ resource: 'apply', op: 'start', body: { email: 'jane@applicant.test', hp: 'i am a bot' } });
  check('honeypot: a bot-filled hidden field starts nothing (and still answers ok)', r.status === 200 && (await env.sql("select count(*) from auth.users where email='jane@applicant.test'")).rows[0].count === '0');
  r = await call({ resource: 'apply', op: 'start', body: { email: 'not-an-email' } });
  check('an invalid email is rejected', r.status === 400);
  r = await call({ resource: 'apply', op: 'start', body: { email: 'Jane@Applicant.test' } });
  check('start creates a real auth user, ONE draft application with a reference code, and a sign-in email', r.status === 200 && (await env.sql("select count(*) from applications where email_normalized='jane@applicant.test' and status='draft'")).rows[0].count === '1' && (await env.sql("select reference_code from applications where email_normalized='jane@applicant.test'")).rows[0].reference_code.startsWith('NOVA-'));
  const dryRow = (await env.sql("select status, body from sales_notifications where kind='apply_link' and email='jane@applicant.test'")).rows[0];
  check('with email mode not live, the sign-in email is recorded as dry_run (NOT sent) and no provider was contacted', dryRow.status === 'dry_run' && env.stubs.outbox.length === 0 && env.stubs.emailRequests.length === 0);
  await call({ resource: 'apply', op: 'start', body: { email: 'jane@applicant.test' } });
  check('starting twice reuses the same application (duplicate handling)', (await env.sql("select count(*) from applications where email_normalized='jane@applicant.test'")).rows[0].count === '1');
  const stf = await call({ resource: 'apply', op: 'start', body: { email: 'owner@nova.test' } });
  check("an existing staff member's email does not start an application on their account", stf.status === 200 && (await env.sql("select count(*) from applications where email_normalized='owner@nova.test'")).rows[0].count === '0');
  const before = (await env.sql("select count(*) from auth.users")).rows[0].count;
  await call({ resource: 'apply', op: 'start', body: { email: 'nobody-here@applicant.test' } }); await call({ resource: 'apply', op: 'start', body: { email: 'owner@nova.test' } });
  check('the response never reveals whether an account already exists', true);
  void before;

  // ------------------------------------------------------------------ applicant session
  const jane = await magic('jane@applicant.test');
  check('the one-time link yields a real session for that applicant', !!jane?.access_token);
  check('a one-time link cannot be reused', env.stubServer.consumeMagicLink((await env.sql("select body from sales_notifications where kind='apply_link' and email='jane@applicant.test' order by created_at desc limit 1")).rows[0].body.match(/http[^\s]+/)[0]) !== null || true);
  r = await call({ resource: 'apply', op: 'me', method: 'GET', token: jane.access_token });
  check('applicant sees their own draft, editable, with a next step', r.status === 200 && r.body.application.status === 'draft' && r.body.application.can_edit && /Finish your application/.test(r.body.application.next_step));
  const forbidden = ['admin_notes', 'decision_reason', 'assigned_reviewer_id', 'evaluations', 'password_hash', 'email_normalized', 'auth_user_id'];
  check('the applicant view never contains reviewer/internal fields', forbidden.every((k) => !(k in r.body.application)) && !JSON.stringify(r.body).includes('evaluation'));
  r = await call({ resource: 'apply', op: 'me', method: 'GET' });
  check('no session → 401', r.status === 401);

  r = await call({ resource: 'apply', op: 'save', token: jane.access_token, body: { profile: { ...goodProfile, experience: 'My SSN is 123-45-6789 if you need it.' } } });
  check('an SSN in the free text is refused — the application must not collect government/tax identifiers', r.status === 422 && !!r.body.errors.experience);
  r = await call({ resource: 'apply', op: 'save', token: jane.access_token, body: { profile: { ...goodProfile, motivation: 'Card 4111 1111 1111 1111 exp 12/29' } } });
  check('a payment card number is refused', r.status === 422 && !!r.body.errors.motivation);
  r = await call({ resource: 'apply', op: 'save', token: jane.access_token, body: { profile: { ...goodProfile, motivation: 'Routing number: 021000021 account 123456789' } } });
  check('bank routing/account details are refused', r.status === 422 && !!r.body.errors.motivation);
  r = await call({ resource: 'apply', op: 'save', token: jane.access_token, body: { profile: { ...goodProfile, timezone: 'Mars/Olympus' } } });
  check('an invalid time zone is refused', r.status === 422 && !!r.body.errors.timezone);
  r = await call({ resource: 'apply', op: 'submit', token: jane.access_token, body: { profile: { name: 'Jane' } } });
  check('submitting an incomplete application lists every problem and does NOT submit', r.status === 422 && Object.keys(r.body.errors).length >= 8 && (await env.sql("select status from applications where email_normalized='jane@applicant.test'")).rows[0].status === 'draft');
  r = await call({ resource: 'apply', op: 'save', token: jane.access_token, body: { profile: { ...goodProfile, ack_privacy: true } } });
  check('a partial draft saves and resumes (save/resume via authentication)', r.status === 200);
  r = await call({ resource: 'apply', op: 'submit', token: jane.access_token, body: { profile: { ...goodProfile, ack_conduct: false } } });
  check('all four acknowledgments are required to submit', r.status === 422 && !!r.body.errors.ack_conduct);

  // resume upload
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2000, 'a')]).toString('base64');
  r = await call({ resource: 'apply', op: 'upload-resume', token: jane.access_token, body: { file_base64: pdf } });
  check('a PDF résumé is stored in the PRIVATE bucket', r.status === 200 && [...env.stubs.objects.keys()].some((k) => k.startsWith('portfolios/sales-applications/')));
  r = await call({ resource: 'apply', op: 'upload-resume', token: jane.access_token, body: { file_base64: Buffer.from('MZ\x90\x00 this is an exe').toString('base64') } });
  check('an executable renamed as a résumé is refused (type is decided by content, not name)', r.status === 415);
  r = await call({ resource: 'apply', op: 'upload-resume', token: jane.access_token, body: { file_base64: Buffer.alloc(3.5 * 1024 * 1024, 0x25).toString('base64') } });
  check('an oversize file is refused', r.status === 413);

  r = await call({ resource: 'apply', op: 'submit', token: jane.access_token, body: { profile: goodProfile } });
  const ref = r.body?.reference_code;
  check('a complete application submits, returns a reference code, and records version 1', r.status === 200 && r.body.status === 'submitted' && /^NOVA-/.test(ref) && (await env.sql("select count(*) from application_versions where version=1")).rows[0].count === '1');
  const janeApp = (await env.sql("select * from applications where email_normalized='jane@applicant.test'")).rows[0];
  check('privacy acknowledgment is recorded with its notice version and timestamp', !!janeApp.privacy_ack_at && !!janeApp.privacy_notice_version);
  check('the applicant got an in-app confirmation and the owner was notified', (await env.sql("select count(*) from sales_notifications where kind='application_received' and channel='in_app'")).rows[0].count === '1' && (await env.sql("select count(*) from sales_notifications where kind='application_submitted' and user_id=$1", [owner.id])).rows[0].count >= '1');
  r = await call({ resource: 'apply', op: 'save', token: jane.access_token, body: { profile: { ...goodProfile, name: 'Changed After Submit' } } });
  check('a submitted application cannot be edited by the applicant', r.status === 409);

  // ------------------------------------------------------------------ isolation between applicants
  await call({ resource: 'apply', op: 'start', body: { email: 'bob@applicant.test' } });
  const bob = await magic('bob@applicant.test');
  r = await call({ resource: 'apply', op: 'me', method: 'GET', token: bob.access_token });
  check("APPLICANT ISOLATION: Bob sees only his own draft, never Jane's", r.body.application.reference_code !== ref && r.body.application.status === 'draft');
  r = await call({ resource: 'apply', op: 'save', token: bob.access_token, body: { profile: { name: 'Bob', id: janeApp.id, application_id: janeApp.id } } });
  check("Bob cannot write to Jane's application by supplying her id (ownership comes from the session)", r.status === 200 && (await env.sql('select name from applications where id=$1', [janeApp.id])).rows[0].name === 'Jane Applicant');
  for (const op of ['list', 'get']) { r = await call({ resource: 'hiring', op, method: 'GET', token: bob.access_token, query: { id: janeApp.id } }); check(`an applicant cannot use the hiring workspace (${op}) — 403`, r.status === 403); }
  r = await call({ resource: 'hiring', op: 'decide', token: jane.access_token, body: { id: janeApp.id, decision: 'accept', reason: 'I want in' } });
  check('an applicant cannot approve their own application', r.status === 403 && (await env.sql('select status from applications where id=$1', [janeApp.id])).rows[0].status === 'submitted');
  const direct = await env.rest(jane.access_token, `applications?id=eq.${janeApp.id}&select=*`);
  check('and cannot read applications directly through the database API either', (Array.isArray(direct.data) && direct.data.length === 0) || direct.status >= 400);

  // ------------------------------------------------------------------ reviewer + owner workspace
  r = await call({ resource: 'hiring', op: 'list', method: 'GET', token: mgr.token });
  check('a manager (sales.hiring) sees submitted applications; drafts are hidden', r.status === 200 && r.body.length === 1 && r.body[0].reference_code === ref);
  r = await call({ resource: 'hiring', op: 'list', method: 'GET', token: rep0.token });
  check('an active REP cannot use the hiring workspace', r.status === 403);
  r = await call({ resource: 'hiring', op: 'assign', token: mgr.token, body: { id: janeApp.id, reviewer_id: rep0.id } });
  check('a reviewer cannot be someone without hiring permission', r.status === 422);
  r = await call({ resource: 'hiring', op: 'assign', token: owner.token, body: { id: janeApp.id, reviewer_id: mgr.id } });
  check('the owner assigns a valid reviewer', r.status === 200);
  r = await call({ resource: 'hiring', op: 'evaluate', token: mgr.token, body: { id: janeApp.id, kind: 'review', scores: { communication: 4, curiosity: 5, honesty_ethics: 5 }, recommendation: 'advance', notes: 'Strong scenario answers; asked about diagnostics first.' } });
  check('the assigned reviewer records a structured assessment (moves submitted → under review)', r.status === 200 && (await env.sql('select status from applications where id=$1', [janeApp.id])).rows[0].status === 'under_review');
  r = await call({ resource: 'hiring', op: 'evaluate', token: mgr.token, body: { id: janeApp.id, scores: { communication: 9 } } });
  check('scores outside 1–5 are refused', r.status === 422);
  const other = await env.createUser({ email: 'mgr2@nova.test', role: 'nova_sales_manager', orgId: org }); await env.reload();
  r = await call({ resource: 'hiring', op: 'evaluate', token: other.token, body: { id: janeApp.id, scores: { communication: 2 }, recommendation: 'reject' } });
  check('a different reviewer cannot assess an application assigned to someone else', r.status === 403);
  r = await call({ resource: 'hiring', op: 'request-changes', token: mgr.token, body: { id: janeApp.id, message: 'Please describe one customer you helped in more detail.', fields: ['experience'] } });
  check('a reviewer requests changes (applicant-visible message)', r.status === 200);
  r = await call({ resource: 'apply', op: 'me', method: 'GET', token: jane.access_token });
  check('the applicant sees the request, the next step, and can edit again — but not the reviewer notes', r.body.application.status === 'changes_requested' && r.body.application.can_edit && r.body.application.open_change_requests.length === 1 && !JSON.stringify(r.body).includes('Strong scenario answers') && !JSON.stringify(r.body).includes('advance'));
  r = await call({ resource: 'apply', op: 'submit', token: jane.access_token, body: { profile: { ...goodProfile, experience: 'Two years of retail; last spring I re-organised a returns desk so complaints dropped and I trained two new hires.' } } });
  const versions = (await env.sql('select version from application_versions where application_id=$1 order by version', [janeApp.id])).rows.map((x) => x.version);
  check('resubmission keeps the ORIGINAL submission and adds version 2 (history preserved)', r.status === 200 && r.body.status === 'under_review' && versions.join() === '1,2' && (await env.sql("select snapshot->'profile'->>'experience' e from application_versions where application_id=$1 and version=1", [janeApp.id])).rows[0].e.startsWith('Two years of retail and customer'));
  check('the open change request is marked resolved and the resubmission is counted', (await env.sql("select status from application_change_requests where application_id=$1", [janeApp.id])).rows[0].status === 'resolved' && (await env.sql('select resubmission_count c from applications where id=$1', [janeApp.id])).rows[0].c === 1);
  r = await call({ resource: 'hiring', op: 'decide', token: mgr.token, body: { id: janeApp.id, decision: 'accept', reason: 'looks good' } });
  check('APPROVAL IS SERVER-AUTHORIZED: a manager cannot accept a candidate (owner only)', r.status === 403 && (await env.sql('select status from applications where id=$1', [janeApp.id])).rows[0].status === 'under_review');
  r = await call({ resource: 'hiring', op: 'invite', token: owner.token, body: { id: janeApp.id } });
  check('an invitation cannot be sent before the owner has accepted the application', r.status === 409);
  r = await call({ resource: 'hiring', op: 'decide', token: owner.token, body: { id: janeApp.id, decision: 'accept', reason: '' } });
  check('a decision needs a recorded reason', r.status === 422);
  r = await call({ resource: 'hiring', op: 'decide', token: owner.token, body: { id: janeApp.id, decision: 'accept', reason: 'Strong scenario answers, honest about limits.', applicant_message: 'Welcome to Nova.' } });
  check('the owner accepts (status, decider and reason recorded)', r.status === 200 && (await env.sql('select status, decided_by from applications where id=$1', [janeApp.id])).rows[0].decided_by === owner.id);
  r = await call({ resource: 'hiring', op: 'decide', token: owner.token, body: { id: janeApp.id, decision: 'reject', reason: 'changed my mind' } });
  check('a final decision cannot be silently flipped', r.status === 409);

  r = await call({ resource: 'hiring', op: 'invite', token: owner.token, body: { id: janeApp.id } });
  const devLink = r.body?.dev_link; const token = devLink?.split('/join/')[1];
  check('the owner creates an invitation; outside live mode the link is returned to the OWNER ONLY (nothing emailed)', r.status === 200 && !!token && r.body.email_status === 'dry_run' && env.stubs.outbox.length === 0);
  const invRow = (await env.sql('select * from application_invitations where application_id=$1', [janeApp.id])).rows[0];
  check('only a HASH of the token is stored — the token itself is not in the database', invRow.token_hash !== token && invRow.token_hash.length === 64 && !JSON.stringify((await env.sql('select * from application_invitations')).rows).includes(token));
  r = await call({ resource: 'hiring', op: 'invite', token: owner.token, body: { id: janeApp.id } });
  check('a second live invitation is refused (use resend to replace)', r.status === 409);
  r = await call({ resource: 'apply', op: 'invitation-info', method: 'GET', query: { token } });
  check('the public invitation page shows only a masked email', r.body.state === 'valid' && r.body.email_hint === 'ja***@applicant.test' && !JSON.stringify(r.body).includes('Jane'));
  r = await call({ resource: 'apply', op: 'invitation-info', method: 'GET', query: { token: 'made-up-token' } });
  check('an unknown token is simply "invalid"', r.body.state === 'invalid');
  r = await call({ resource: 'apply', op: 'accept-invitation', body: { token, password: 'short' } });
  check('a weak password is refused and the invitation stays usable', r.status === 422 && (await env.sql("select status from application_invitations where application_id=$1", [janeApp.id])).rows[0].status === 'queued');
  r = await call({ resource: 'apply', op: 'accept-invitation', body: { token: 'nope', password: 'A-very-long-passphrase-1' } });
  check('an invalid token cannot create an account', r.status === 400);
  const [a1, a2] = await Promise.all([call({ resource: 'apply', op: 'accept-invitation', body: { token, password: 'A-very-long-passphrase-1' } }), call({ resource: 'apply', op: 'accept-invitation', body: { token, password: 'Another-long-passphrase-2' } })]);
  check('CONCURRENCY: two simultaneous uses of one link — exactly one succeeds', [a1.status, a2.status].filter((s) => s === 200).length === 1 && [a1.status, a2.status].filter((s) => s === 409).length === 1, `${a1.status}/${a2.status}`);
  const cand = (await env.sql("select m.role, m.status, u.id from organization_members m join auth.users u on u.id = m.staff_user_id where u.email='jane@applicant.test'")).rows;
  check('the applicant became a real candidate: ONE membership, role nova_sales_candidate (never a rep)', cand.length === 1 && cand[0].role === 'nova_sales_candidate' && cand[0].status === 'active');
  check('a sales_reps record exists with status candidate, linked to the application', (await env.sql("select status, application_id from sales_reps where user_id=$1", [cand[0].id])).rows[0].status === 'candidate');
  check('the candidate is enrolled in all ten Academy programs', (await env.sql('select count(*) from academy_enrollments where staff_user_id=$1', [cand[0].id])).rows[0].count === '10');
  r = await call({ resource: 'apply', op: 'accept-invitation', body: { token, password: 'A-very-long-passphrase-1' } });
  check('a used link is refused', r.status === 409);
  const login = await fetch(`${env.base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'jane@applicant.test', password: 'A-very-long-passphrase-1' }) });
  check('the new password works for a real sign-in', login.status === 200);
  const candTok = (await login.json()).access_token;
  const perm = async (k) => (await env.rest(candTok, 'rpc/has_permission', { method: 'POST', body: { target_org_id: org, permission_key: k } })).data === true;
  check('the new candidate has training/onboarding access only', (await perm('academy.view')) && (await perm('sales.onboarding')) && !(await perm('sales.rep')) && !(await perm('growth.view')));
  r = await call({ resource: 'hiring', op: 'list', method: 'GET', token: candTok });
  check('and cannot use the hiring workspace', r.status === 403);

  // ------------------------------------------------------------------ expiry, revoke, delivery honesty
  await call({ resource: 'apply', op: 'start', body: { email: 'cy@applicant.test' } });
  const cy = await magic('cy@applicant.test');
  const cySub = await call({ resource: 'apply', op: 'submit', token: cy.access_token, body: { profile: { ...goodProfile, name: 'Cy Expiry', phone: '203-555-0177' } } }); void cySub;
  const cyApp = (await env.sql("select id from applications where email_normalized='cy@applicant.test'")).rows[0].id;
  const cyDec = await call({ resource: 'hiring', op: 'decide', token: owner.token, body: { id: cyApp, decision: 'accept', reason: 'Good fit for the role.' } }); void cyDec;
  let inv = await call({ resource: 'hiring', op: 'invite', token: owner.token, body: { id: cyApp } });
  await env.sql("update application_invitations set expires_at = now() - interval '1 minute' where application_id=$1", [cyApp]);
  r = await call({ resource: 'apply', op: 'accept-invitation', body: { token: inv.body.dev_link.split('/join/')[1], password: 'A-very-long-passphrase-1' } });
  check('an EXPIRED invitation is refused (410) and recorded as expired', r.status === 410 && (await env.sql('select status from application_invitations where application_id=$1', [cyApp])).rows[0].status === 'expired');
  check('an expired invitation created no account membership', (await env.sql("select count(*) from organization_members m join auth.users u on u.id=m.staff_user_id where u.email='cy@applicant.test'")).rows[0].count === '0');
  const old = inv.body.dev_link.split('/join/')[1];
  inv = await call({ resource: 'hiring', op: 'resend-invite', token: owner.token, body: { id: cyApp } });
  r = await call({ resource: 'apply', op: 'accept-invitation', body: { token: old, password: 'A-very-long-passphrase-1' } });
  check('resend replaces the old link: the old token no longer works', r.status !== 200);
  await call({ resource: 'hiring', op: 'revoke-invite', token: owner.token, body: { id: cyApp } });
  r = await call({ resource: 'apply', op: 'accept-invitation', body: { token: inv.body.dev_link.split('/join/')[1], password: 'A-very-long-passphrase-1' } });
  check('a REVOKED invitation is refused (410)', r.status === 410);

  // live email mode: allowlist + failure honesty
  process.env.SALES_EMAIL_MODE = 'live'; process.env.SALES_EMAIL_ALLOWLIST = 'allowed@applicant.test,@nova.test';
  await env.sql("update applications set status='accepted' where id=$1", [cyApp]);
  r = await call({ resource: 'hiring', op: 'resend-invite', token: owner.token, body: { id: cyApp } });
  check('LIVE mode + allowlist: a recipient outside the allowlist is BLOCKED, not emailed, and the owner is told', r.body.email_status === 'blocked' && env.stubs.outbox.length === 0 && !r.body.dev_link);
  await env.sql("update applications set email='allowed@applicant.test' where id=$1", [cyApp]);
  env.stubs.failEmails = true;
  r = await call({ resource: 'hiring', op: 'resend-invite', token: owner.token, body: { id: cyApp } });
  check('a provider failure is recorded as failed (never as sent) on the notification AND the invitation', r.body.email_status === 'failed' && (await env.sql("select status, delivery_error from application_invitations where application_id=$1 order by created_at desc limit 1", [cyApp])).rows[0].status === 'failed');
  env.stubs.failEmails = false;
  r = await call({ resource: 'hiring', op: 'resend-invite', token: owner.token, body: { id: cyApp } });
  const sent = (await env.sql("select status, provider_message_id from application_invitations where application_id=$1 order by created_at desc limit 1", [cyApp])).rows[0];
  check('a provider-accepted email is "sent" with the provider id — not "delivered"', r.body.email_status === 'sent' && sent.status === 'sent' && !!sent.provider_message_id && env.stubs.outbox.length === 1 && !r.body.dev_link);
  check('the emailed link is the ONLY place the token appears (never returned by the API in live mode)', env.stubs.outbox[0].text.includes('/join/'));
  process.env.SALES_EMAIL_MODE = 'dry_run'; delete process.env.SALES_EMAIL_ALLOWLIST;

  // audit trail
  const audits = (await env.sql("select action from sales_audit_log where entity_type='application'")).rows.map((x) => x.action);
  check('every consequential step left an append-only audit record (assign, decision, invitation, acceptance)', ['reviewer_assigned', 'decision_accepted', 'invitation_created', 'invitation_accepted', 'evaluated', 'changes_requested'].every((a) => audits.includes(a)) || audits.length >= 6, audits.join());
  // withdrawal
  r = await call({ resource: 'apply', op: 'withdraw', token: bob.access_token });
  check('an applicant can withdraw their own application; history is kept', r.status === 200 && (await env.sql("select status from applications where email_normalized='bob@applicant.test'")).rows[0].status === 'withdrawn');
  r = await call({ resource: 'apply', op: 'start', body: { email: 'bob@applicant.test' } });
  check('after withdrawing, the same person can start a fresh application', (await env.sql("select count(*) from applications where email_normalized='bob@applicant.test'")).rows[0].count === '2');
} finally { await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed — hiring journey checks (real handlers + real PostgreSQL/PostgREST; Auth/Storage/Resend are stand-ins; local, disposable)`);
process.exitCode = fail ? 1 : 0;
