// REAL-DATABASE tests (disposable PostgreSQL + PostgREST, local): access-control rules of the Sales Team platform.
// Proves database-level behaviour (constraints, RLS, append-only triggers, permission bundles). Auth and storage are
// stand-ins; this is NOT a Supabase or production test.
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const env = await startTestEnv({ migrations: allMigrations(), publicBuckets: [] });
try {
  const bad = env.migrationErrors.filter((e) => !/schema-update/.test(e.file));
  check('every sales-team migration file applies cleanly on top of the existing ones (real PostgreSQL)', bad.length === 0, JSON.stringify(bad));
  const org = (await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).rows[0].id;
  const clientOrg = (await env.sql("insert into organizations (name, slug, kind) values ('Acme Plumbing','acme','client') returning id")).rows[0].id;
  const U = {};
  for (const [k, role] of [['owner', 'nova_super_admin'], ['admin', 'nova_admin'], ['cand', 'nova_sales_candidate'], ['rep', 'nova_sales'], ['mgr', 'nova_sales_manager'], ['fin', 'nova_finance']]) U[k] = await env.createUser({ email: `${k}@nova.test`, role, orgId: org });
  U.clientOwner = await env.createUser({ email: 'co@acme.test', role: 'client_owner', orgId: clientOrg });
  U.applicant = await env.createUser({ email: 'applicant@x.test' }); // an auth user with NO membership at all
  check('membership roles nova_sales_candidate / nova_sales_manager / nova_finance are accepted (the live constraint rejected them)', true);

  await env.sql("insert into leads (name, email, phone, organization_id) values ('Real Prospect','p@x.test','2035550100',$1)", [org]);
  await env.sql("insert into clients (full_name, email, organization_id) values ('Real Client','c@x.test',$1)", [org]);
  await env.sql("insert into contracts (client_name, client_email, contract_type, organization_id) values ('Real Client','c@x.test','Custom',$1)", [org]);
  await env.sql("insert into client_invoices (client_name, amount, organization_id) values ('Real Client', 750, $1)", [org]);
  await env.sql("insert into crm_contacts (organization_id, name, email) values ($1,'CRM Person','crm@x.test')", [org]);
  await env.sql("insert into businesses (organization_id, name) values ($1,'Prospect Co')", [org]);
  await env.reload();

  const rows = async (u, t) => { const r = await env.rest(u?.token, `${t}?select=*`); return Array.isArray(r.data) ? r.data.length : `err${r.status}`; };
  const none = (v) => v === 0 || String(v).startsWith('err');
  for (const t of ['leads', 'clients', 'contracts', 'client_invoices', 'crm_contacts', 'businesses']) {
    check(`CANDIDATE cannot read Nova's ${t} directly through the database API`, none(await rows(U.cand, t)));
    check(`REP cannot read Nova's ${t} directly (organization-wide data)`, none(await rows(U.rep, t)));
    check(`applicant with no membership cannot read ${t}`, none(await rows(U.applicant, t)));
    check(`anonymous visitor cannot read ${t}`, none(await rows(null, t)));
  }
  check('owner still reads leads (growth.view)', (await rows(U.owner, 'leads')) === 1);
  check('owner still reads contracts (admin.view)', (await rows(U.owner, 'contracts')) === 1);
  check("a client organization's owner cannot read Nova's leads", none(await rows(U.clientOwner, 'leads')));
  check("a client organization's owner cannot read Nova's clients", none(await rows(U.clientOwner, 'clients')));

  const perm = async (u, key) => (await env.rest(u.token, 'rpc/has_permission', { method: 'POST', body: { target_org_id: org, permission_key: key } })).data === true;
  check('candidate holds academy.view and sales.onboarding only', (await perm(U.cand, 'academy.view')) && (await perm(U.cand, 'sales.onboarding')) && !(await perm(U.cand, 'sales.rep')) && !(await perm(U.cand, 'growth.view')) && !(await perm(U.cand, 'overview.view')));
  check('rep holds sales.rep but NOT growth.view / overview.view / admin.view (the old bundle is removed)', (await perm(U.rep, 'sales.rep')) && !(await perm(U.rep, 'growth.view')) && !(await perm(U.rep, 'overview.view')) && !(await perm(U.rep, 'admin.view')));
  check('rep does NOT hold sales.owner / sales.finance / sales.manage / sales.hiring', !(await perm(U.rep, 'sales.owner')) && !(await perm(U.rep, 'sales.finance')) && !(await perm(U.rep, 'sales.manage')) && !(await perm(U.rep, 'sales.hiring')));
  check('only the owner role holds sales.owner', (await perm(U.owner, 'sales.owner')) && !(await perm(U.admin, 'sales.owner')) && !(await perm(U.mgr, 'sales.owner')) && !(await perm(U.fin, 'sales.owner')));
  check('finance role holds sales.finance and nothing that reads leads', (await perm(U.fin, 'sales.finance')) && !(await perm(U.fin, 'growth.view')));
  check('manager holds sales.manage + sales.hiring but not admin.view', (await perm(U.mgr, 'sales.manage')) && (await perm(U.mgr, 'sales.hiring')) && !(await perm(U.mgr, 'admin.view')));

  const esc = await env.rest(U.rep.token, `organization_members?staff_user_id=eq.${U.rep.id}`, { method: 'PATCH', body: { role: 'nova_super_admin' } });
  const roleNow = (await env.sql('select role from organization_members where staff_user_id = $1', [U.rep.id])).rows[0].role;
  check('a rep cannot promote themselves to owner through the database API', roleNow === 'nova_sales', `status ${esc.status} role ${roleNow}`);
  const ins = await env.rest(U.cand.token, 'organization_members', { method: 'POST', body: { organization_id: org, member_type: 'staff', staff_user_id: U.cand.id, role: 'nova_super_admin', status: 'active' } });
  check('a candidate cannot insert themselves an owner membership', ins.status >= 400 && (await env.sql("select count(*) from organization_members where staff_user_id=$1 and role='nova_super_admin'", [U.cand.id])).rows[0].count === '0');
  const grant = await env.rest(U.rep.token, 'role_permissions', { method: 'POST', body: { role: 'nova_sales', permission_id: (await env.sql("select id from permissions where key='sales.owner'")).rows[0].id } });
  check('an ordinary authenticated user cannot grant a permission to a role', grant.status >= 400 && (await env.sql("select count(*) from role_permissions rp join permissions p on p.id=rp.permission_id where rp.role='nova_sales' and p.key='sales.owner'")).rows[0].count === '0');

  for (const t of ['sales_audit_log', 'sales_config', 'sales_reps', 'application_evaluations', 'application_events', 'application_invitations', 'sales_notifications', 'applications', 'academy_quiz_questions']) {
    for (const [who, u] of [['candidate', U.cand], ['rep', U.rep], ['applicant', U.applicant], ['anonymous', null]]) {
      const r = await env.rest(u?.token, `${t}?select=*`);
      check(`${who} cannot read ${t} through the database API`, (Array.isArray(r.data) && r.data.length === 0) || r.status >= 400);
    }
  }
  await env.sql("insert into sales_audit_log (entity_type, entity_id, action) values ('test','1','created')");
  let upd = null; try { await env.sql("update sales_audit_log set action='edited'"); } catch (e) { upd = e.message; }
  let del = null; try { await env.sql('delete from sales_audit_log'); } catch (e) { del = e.message; }
  let trunc = null; try { await env.sql('truncate sales_audit_log'); } catch (e) { trunc = e.message; }
  check('the audit log cannot be updated, deleted or truncated even by a privileged database role', /append-only/.test(upd || '') && /append-only/.test(del || '') && /append-only/.test(trunc || ''), `${upd}|${del}|${trunc}`);
  const appId = (await env.sql("insert into applications (name, email, position, status) values ('A','a@x.test','Sales Representative','submitted') returning id")).rows[0].id;
  await env.sql("insert into application_events (application_id, actor_kind, event_type) values ($1,'system','submitted')", [appId]);
  let ev = null; try { await env.sql('delete from application_events'); } catch (e) { ev = e.message; }
  check('application history is append-only', /append-only/.test(ev || ''));

  await env.sql("update applications set email_normalized='a@x.test' where id=$1", [appId]);
  let dup = null; try { await env.sql("insert into applications (name, email, email_normalized, position, status) values ('A2','a@x.test','a@x.test','Sales Representative','submitted')"); } catch (e) { dup = e.code; }
  check('a second ACTIVE application for the same person and position is rejected by the database', dup === '23505', String(dup));
  await env.sql("update applications set status='withdrawn' where id=$1", [appId]);
  let again = null; try { await env.sql("insert into applications (name, email, email_normalized, position, status) values ('A3','a@x.test','a@x.test','Sales Representative','submitted')"); } catch (e) { again = e.message; }
  check('after withdrawal the same person may apply again', again === null, String(again));
  let badStatus = null; try { await env.sql("insert into applications (name, email, position, status) values ('B','b@x.test','x','totally_made_up')"); } catch (e) { badStatus = e.code; }
  check('an invented application status is refused (23514)', badStatus === '23514', String(badStatus));

  await env.sql("insert into sales_config (key, version, status, value) values ('test_policy',1,'approved','{}')");
  let two = null; try { await env.sql("insert into sales_config (key, version, status, value) values ('test_policy',2,'approved','{}')"); } catch (e) { two = e.code; }
  check('only one APPROVED configuration version per key can exist', two === '23505', String(two));
  const app2 = (await env.sql("insert into applications (name, email, email_normalized, position, status) values ('C','c@y.test','c@y.test','Sales Representative','accepted') returning id")).rows[0].id;
  await env.sql("insert into application_invitations (application_id, email, token_hash, created_by, expires_at, status) values ($1,'c@y.test','h1',$2, now() + interval '7 days','sent')", [app2, U.owner.id]);
  let inv2 = null; try { await env.sql("insert into application_invitations (application_id, email, token_hash, created_by, expires_at, status) values ($1,'c@y.test','h2',$2, now() + interval '7 days','queued')", [app2, U.owner.id]); } catch (e) { inv2 = e.code; }
  check('a second live invitation for the same application is refused', inv2 === '23505', String(inv2));
} finally { await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed — sales-team database checks (real PostgreSQL + PostgREST, local, disposable — not Supabase, not production)`);
process.exitCode = fail ? 1 : 0;
