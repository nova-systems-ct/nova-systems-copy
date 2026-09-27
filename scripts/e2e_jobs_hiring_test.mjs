// Non-sales Careers hiring: application (api/intake.js, public) -> owner review (api/intake.js
// applications/update-application) -> real account invitation (api/team.js's generalized
// `invite`, now able to link back to the applicant's record). Sales positions are proven
// EXCLUDED from this path (they hire only through api/_sales/hiring.js). Real handlers against a
// REAL local PostgreSQL + PostgREST (local, disposable) — Supabase Auth/Storage/Resend are
// stand-ins. NOT Supabase, NOT production.
import crypto from 'node:crypto';
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const env = await startTestEnv({ migrations: allMigrations(), publicBuckets: [] });
Object.assign(process.env, env.appEnv);
delete process.env.RESEND_API_KEY; // handleSubmitApplication calls the REAL api.resend.com directly (not RESEND_API_URL) — unset so it takes the "skip emails" branch instead of reaching the real network
const { default: intakeHandler } = await import('../api/intake.js');
const { default: teamHandler } = await import('../api/team.js');
const intake = makeCaller(intakeHandler);
const team = makeCaller(teamHandler);
try {
  const org = (await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).rows[0].id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: org, name: 'Isaac Owner' });
  const rep = await env.createUser({ email: 'rep@nova.test', role: 'nova_sales', orgId: org, name: 'Rep Alpha' }); // no members.manage
  await env.reload();

  // ---------------------------------------------------------------- public application (Content Creator — non-sales)
  let r = await intake({ action: 'submit-application', body: { id: crypto.randomUUID(), name: 'Casey Creator', email: 'casey@applicant.test', position: 'Social Media Content Creator', city: 'Waterbury', equipment_owned: 'Sony A7III', bio: 'I make videos.' } });
  check('a non-sales application submits publicly with no auth', r.status === 200);
  check('it is a real row in applications with status new and no account yet', (await env.sql("select status, auth_user_id from applications where email='casey@applicant.test'")).rows[0].status === 'new' && (await env.sql("select auth_user_id from applications where email='casey@applicant.test'")).rows[0].auth_user_id === null);
  const appId = (await env.sql("select id from applications where email='casey@applicant.test'")).rows[0].id;

  r = await intake({ action: 'submit-application', method: 'POST', body: { name: 'Sam Sales', email: 'sam@applicant.test', position: 'High-Ticket B2B Sales Representative' } });
  check('a sales-position submission on the legacy form is refused (410) — sales uses /apply/sales', r.status === 410);

  // ---------------------------------------------------------------- owner review (existing, unchanged path)
  r = await intake({ action: 'applications', method: 'GET', token: owner.token });
  check('owner sees the application in the legacy Jobs list', r.status === 200 && r.body.some((a) => a.id === appId));
  r = await intake({ action: 'update-application', token: owner.token, body: { id: appId, status: 'reviewing' } });
  check('owner can move status (existing behavior)', r.status === 200 && (await env.sql('select status from applications where id=$1', [appId])).rows[0].status === 'reviewing');

  // ---------------------------------------------------------------- the fix under test: linked invitation
  r = await team({ op: 'invite', token: rep.token, body: { email: 'casey@applicant.test', role: 'nova_marketing', application_id: appId } });
  check('a rep with no members.manage cannot invite', r.status === 403);

  r = await team({ op: 'invite', token: owner.token, body: { email: 'wrong@applicant.test', role: 'nova_marketing', application_id: appId } });
  check('inviting at an email that does not match the application is refused', r.status === 409);

  const salesAppId = (await env.sql("insert into applications (name, email, position, status) values ('Sam Sales','sam2@applicant.test','Sales Representative','new') returning id")).rows[0].id;
  r = await team({ op: 'invite', token: owner.token, body: { email: 'sam2@applicant.test', role: 'nova_marketing', application_id: salesAppId } });
  check('a sales-position application cannot be invited from here — only the Sales Team workspace', r.status === 409 && /Sales Team hiring workspace/.test(r.body.error));
  check('...and no account was created for it', (await env.sql("select auth_user_id from applications where id=$1", [salesAppId])).rows[0].auth_user_id === null);

  r = await team({ op: 'invite', token: owner.token, body: { email: 'casey@applicant.test', role: 'nova_marketing', application_id: appId } });
  check('the owner invites the real applicant: 200, a real staff_user_id returned', r.status === 200 && !!r.body.staff_user_id);
  const uid = r.body.staff_user_id;
  const row = (await env.sql('select auth_user_id, invited_at from applications where id=$1', [appId])).rows[0];
  check('the application record is linked back (auth_user_id + invited_at set)', row.auth_user_id === uid && row.invited_at !== null);
  const mem = (await env.sql('select role, status from organization_members where staff_user_id=$1', [uid])).rows[0];
  check('a real, ACTIVE organization_members row exists with the chosen role — no separate activation step', mem.role === 'nova_marketing' && mem.status === 'active');
  check('a real invitation record exists in the auth stand-in (a genuine email was triggered)', env.stubs.invites.some((i) => i.email === 'casey@applicant.test'));

  r = await team({ op: 'invite', token: owner.token, body: { email: 'casey@applicant.test', role: 'nova_marketing', application_id: appId } });
  check('inviting the same application again is refused (already has an account)', r.status === 409);

  r = await intake({ action: 'applications', method: 'GET', token: owner.token });
  const listed = r.body.find((a) => a.id === appId);
  check('the dashboard list reflects the real link (auth_user_id present)', !!listed.auth_user_id);

  // new hire signs in with the real password they set via the invite/reset flow (simulated here directly against the stub)
  await env.sql('update auth.users set encrypted_password = $2, email_confirmed_at = now() where id = $1', [uid, env.stubServer.hashPw('A-real-password-1')]);
  const login = await fetch(`${env.base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'casey@applicant.test', password: 'A-real-password-1' }) });
  check('the new hire can really sign in afterward', login.status === 200);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed — non-sales Careers hiring (real handlers + real local PostgreSQL/PostgREST; Auth/Storage/Resend are stand-ins)`);
process.exitCode = fail ? 1 : 0;
