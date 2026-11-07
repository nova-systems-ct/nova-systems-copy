// Real disposable PostgreSQL + PostgREST + actual API. Provider endpoints are loopback stand-ins.
// The heartbeat is a fixture whose disappearance models a stopped host; this is not a live-provider test.
import fs from 'node:fs';
import { startTestEnv } from './testenv/env.mjs';
import { makeCaller } from './testenv/call.mjs';
import { clearProviderEnv, startProviderStandIns, setupTestBusiness, WH_SECRET } from './testenv/opsFixture.mjs';

let passed = 0, failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}${ok ? '' : ` ${detail}`}`); ok ? passed++ : failed++; };
clearProviderEnv();
const providers = await startProviderStandIns();
const env = await startTestEnv({ migrations: JSON.parse(fs.readFileSync('supabase/migration-manifest.json', 'utf8')).order, bootstrap: 'platform', publicBuckets: [] });
Object.assign(process.env, env.appEnv, providers.env, { APP_BASE_URL: 'http://localhost.test', STRIPE_SECRET_KEY: 'sk_test_install_local_only', STRIPE_WEBHOOK_SECRET: WH_SECRET, SALES_EMAIL_MODE: 'dry_run', WAVE1_SEND_ENABLED: 'false' });
const client = makeCaller((await import('../api/client.js')).default);
const one = async (sql, params) => (await env.sql(sql, params)).rows[0];
try {
  const nova = (await one("insert into organizations(name,slug,kind) values('Nova Systems','nova','nova_internal') returning id")).id;
  const owner = await env.createUser({ email: 'install-owner@nova.test', role: 'nova_super_admin', orgId: nova });
  const { biz } = await setupTestBusiness({ env, client, ownerToken: owner.token });
  await env.sql('update ops_price_rules set deposit_cents=0 where organization_id=$1', [biz]);
  await env.sql("insert into worker_runtime_heartbeats(worker_id,host) values('install-fixture','loopback-test')");
  const install = (body, token = owner.token) => client({ resource: 'ops', op: 'install', method: 'POST', body: { organization_id: biz, ...body }, token });
  const preview = () => client({ resource: 'ops', op: 'install', method: 'GET', query: { organization_id: biz }, token: owner.token });
  let plan = await install({ action: 'prepare' });
  const id = plan.body.id;
  check('Owner can prepare the configured business installation', plan.status === 200 && !!id, JSON.stringify(plan.body));
  let run = await install({ action: 'run', manifest_id: id });
  check('Real inquiry-to-quote acceptance passes with approved inputs', run.status === 200 && run.body.status === 'installed' && run.body.steps?.find(s => s.step_key === 'test_journey')?.status === 'done', JSON.stringify(run.body).slice(0, 700));
  const repeat = await install({ action: 'prepare' });
  check('Issuing a form and enabling reports does not duplicate the plan', repeat.body.id === id && repeat.body.unchanged === true);
  await env.sql("update ops_price_rules set price_cents=price_cents+100 where organization_id=$1 and service_key='full_detail'", [biz]);
  check('Price changes with unchanged service count invalidate the old plan', (await preview()).body.changed_since === true);
  const staleActivate = await install({ action: 'activate', manifest_id: id });
  check('A stale price snapshot cannot activate', staleActivate.status === 409, JSON.stringify(staleActivate.body));
  check('Rejected activation leaves go-live approval unset', !(await one('select go_live_approved_at from ops_business_settings where organization_id=$1', [biz])).go_live_approved_at);
  // Reset the deliberately bad old behavior so the remaining regressions run independently on the red pass.
  await env.sql("update ops_install_manifests set status='installed', activated_at=null, activated_by=null where id=$1", [id]);
  await env.sql('update ops_business_settings set go_live_approved_at=null where organization_id=$1', [biz]);
  const staleRun = await install({ action: 'run', manifest_id: id });
  check('Running a stale manifest asks for a new plan', staleRun.status === 409, JSON.stringify(staleRun.body).slice(0, 200));
  await env.sql("update ops_price_rules set price_cents=price_cents-100 where organization_id=$1 and service_key='full_detail'", [biz]);
  await env.sql("update ops_install_manifests set status='installed' where id=$1", [id]);
  await env.sql("update worker_runtime_heartbeats set stopped_at=now() where worker_id='install-fixture'");
  run = await install({ action: 'run', manifest_id: id });
  check('A rerun rechecks completed steps and detects a stopped worker', run.status === 200 && run.body.status === 'partial' && run.body.steps?.find(s => s.step_key === 'monitoring')?.status === 'blocked');
  await env.sql("update ops_install_manifests set status='installed' where id=$1", [id]);
  const lostWorkerActivation = await install({ action: 'activate', manifest_id: id });
  check('Activation independently rechecks runtime prerequisites', lostWorkerActivation.status === 409, JSON.stringify(lostWorkerActivation.body));
  await env.sql("update ops_install_manifests set status='partial', activated_at=null, activated_by=null where id=$1", [id]);
  await env.sql('update ops_business_settings set go_live_approved_at=null where organization_id=$1', [biz]);
  await env.sql("update worker_runtime_heartbeats set stopped_at=null,last_seen_at=now() where worker_id='install-fixture'");
  run = await install({ action: 'run', manifest_id: id });
  check('Restoring the runtime permits a successful retry', run.body.status === 'installed');
  const demand = (body) => client({ resource: 'ops', op: 'demand', method: 'POST', body: { organization_id: biz, ...body }, token: owner.token });
  const campaign = await demand({ action: 'create', name: 'TEST approved acquisition', objective: 'Track qualified inquiries', service_key: 'full_detail', offer_text: 'Approved service at its listed price', channels: ['in_person'], volume_limit: 2 });
  const approved = await demand({ action: 'approve', id: campaign.body.campaign?.id });
  check('The owner approves a real scoped Demand campaign', approved.status === 200);
  run = await install({ action: 'run', manifest_id: id });
  check('The installer recognizes an approved acquisition campaign', run.body.steps?.find(s => s.step_key === 'demand')?.status === 'done');
  const activated = await install({ action: 'activate', manifest_id: id });
  check('Current, verified inputs can activate without enabling sends', activated.status === 200 && activated.body.status === 'activated');
  await env.sql("update ops_business_settings set is_test=false,go_live_approved_at=null where organization_id=$1", [biz]);
  await env.sql("update ops_price_rules set deposit_cents=500 where organization_id=$1 and service_key='full_detail'", [biz]);
  await env.sql("update ops_payment_accounts set mode='client_connected_account',stripe_account_ref='acct_TestInstallOnly',live_enabled=false where organization_id=$1", [biz]);
  plan = await install({ action: 'prepare' });
  run = await install({ action: 'run', manifest_id: plan.body.id });
  check('A test-only Stripe connection cannot mark a customer deposit system ready for live activation', run.body.status === 'partial' && run.body.steps?.find(s => s.step_key === 'payments')?.status === 'blocked');
  const other = (await one("insert into organizations(name,slug,kind) values('TEST Other','other','client') returning id")).id;
  const outsider = await env.createUser({ email: 'outside@install.test', role: 'client_owner', orgId: other });
  check('Another business owner cannot run this installation', (await install({ action: 'run', manifest_id: plan.body.id }, outsider.token)).status === 403);
  check('No provider send, checkout or email was attempted', providers.twilio.messages.length === 0 && providers.stripe.requests.length === 0 && env.stubs.outbox.length === 0);
} catch (error) { failed++; console.log('FAIL — test crashed', error.stack || error); }
finally { await env.stop(); await providers.stop(); }
console.log(`\n${passed} passed, ${failed} failed — installation safety (actual API + disposable PostgreSQL)`);
process.exitCode = failed ? 1 : 0;
setTimeout(() => process.exit(process.exitCode ?? 0), 10_000).unref();
