// Actual signed receiver and PostgreSQL queue. All data is disposable; providers stay local and sending locked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { startTestEnv } from './testenv/env.mjs';
import { makeCaller } from './testenv/call.mjs';
import { clearProviderEnv, startProviderStandIns, setupTestBusiness, TW_TOKEN, PUBLIC_BASE } from './testenv/opsFixture.mjs';
clearProviderEnv();
const providers = await startProviderStandIns();
const env = await startTestEnv({ migrations: JSON.parse(fs.readFileSync('supabase/migration-manifest.json', 'utf8')).order, bootstrap: 'platform', publicBuckets: [] });
try {
  Object.assign(process.env, env.appEnv, providers.env, { NOVA_ROLE_MODEL: 'off', WAVE1_SEND_ENABLED: 'true', TWILIO_ACCOUNT_SID: 'AC_LOCAL_ONLY', TWILIO_AUTH_TOKEN: TW_TOKEN, WAVE1_PUBLIC_BASE: PUBLIC_BASE });
  const { handleCoreQueueTick } = await import('../api/_coreQueueTick.js');
  const { schedulerSignature } = await import('../api/_auditQueueTick.js');
  const one = async (sql, params) => (await env.sql(sql, params)).rows[0];
  const nova = (await one("insert into organizations(name,slug,kind) values('TEST Nova','hosted-campaign-nova','nova_internal') returning id")).id;
  const owner = await env.createUser({ email: 'hosted-campaign@nova.test', role: 'nova_super_admin', orgId: nova });
  const client = makeCaller((await import('../api/client.js')).default);
  const { biz } = await setupTestBusiness({ env, client, ownerToken: owner.token });
  const contact = (await one("insert into crm_contacts(organization_id,name,phone_e164,sms_consent,sms_consent_source,sms_consent_at) values($1,'TEST Pat','+12035550144',true,'TEST recorded permission',now()-interval '2 days') returning id", [biz])).id;
  process.env.OPS_SEND_ALLOWLIST = '+12035550144';
  const worker = (await one("insert into workers(worker_type,display_name,status,capability_key) values('service_account','TEST Revive','active','followup_revive') returning id")).id;
  const { createPostgresJobStore } = await import('../worker/postgresJobStore.mjs');
  const store = createPostgresJobStore({ url: env.base, serviceKey: env.serviceKey });
  // Auth target assertion uses a synthetic project identifier; the actual DB client/store stay on loopback.
  const receiverEnv = { ...process.env, SUPABASE_URL: 'https://localtest.supabase.co', NOVA_WORKER_TARGET_REF: 'localtest', NOVA_CORE_HTTP_WORKER_ENABLED: 'true', CRON_SECRET: 'LOCAL-TEST-HMAC-ONLY' };
  const tick = async () => {
    const ts = String(Math.floor(Date.now() / 1000)), nonce = crypto.randomUUID();
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handleCoreQueueTick({ method: 'POST', headers: { 'x-nova-audit-timestamp': ts, 'x-nova-audit-nonce': nonce, authorization: `Bearer ${schedulerSignature(ts, nonce, receiverEnv.CRON_SECRET, 'nova-core-tick')}` } }, res, { e: receiverEnv, store });
    assert.equal(res.code, 200); assert(!res.body.retry_recorded, JSON.stringify(res.body)); return res.body;
  };
  const fixture = async (status = 'running') => {
    const campaign = (await one("insert into ops_campaigns(organization_id,name,purpose,message_template,status,approved_by,approval_snapshot,updated_at) values($1,'TEST hosted recovery','past_customer_reactivation','Hi {{first_name}}, {{business_name}} here. Reply STOP to opt out.',$2,$3,$4,now()-interval '1 day') returning id", [biz, status, owner.id, { copy_sha256: crypto.createHash('sha256').update('Hi {{first_name}}, {{business_name}} here. Reply STOP to opt out.').digest('hex'), eligible_count: 1 }])).id;
    const rec = (await one("insert into ops_campaign_recipients(organization_id,campaign_id,contact_id,phone_e164,display_name,eligibility,send_status,scheduled_at) values($1,$2,$3,'+12035550144','TEST Pat','eligible','scheduled',now()) returning id", [biz, campaign, contact])).id;
    const job = (await store.enqueue({ job_type: 'ops_campaign_send', organization_id: biz, payload: { recipient_id: rec }, idempotency_key: `TEST-campaign:${rec}` })).job;
    return { campaign, rec, job };
  };
  const hour = new Date().getUTCHours();
  await env.sql('update wave1_org_settings set timezone=$2,quiet_hours=$3 where organization_id=$1', [biz, 'UTC', { start: hour, end: (hour + 1) % 24 }]);
  const quiet = await fixture();
  assert.equal((await tick()).processed, true);
  const quietJobs = (await env.sql("select status,scheduled_at,result from jobs where job_type='ops_campaign_send' and payload->>'recipient_id'=$1", [quiet.rec])).rows;
  assert.equal(quietJobs.length, 2, 'Quiet hours must create exactly one successor');
  assert.equal(quietJobs.filter(j => j.status === 'completed').length, 1, 'The original job completes once its future successor exists');
  assert.equal(quietJobs.filter(j => j.status === 'pending' && Date.parse(j.scheduled_at) > Date.now()).length, 1);
  assert.equal((await tick()).processed, false, 'No five-second retry loop while waiting for the send window');
  const paused = await fixture('paused');
  assert.equal((await tick()).deferred, true);
  const pausedJobs = (await env.sql("select status,attempts,scheduled_at from jobs where job_type='ops_campaign_send' and payload->>'recipient_id'=$1", [paused.rec])).rows;
  assert.equal(pausedJobs.length, 1, 'Pausing keeps the original job without creating another');
  assert.equal(pausedJobs[0].status, 'pending'); assert.equal(pausedJobs[0].attempts, 0);
  const locked = await fixture();
  await env.sql('update wave1_org_settings set quiet_hours=$2 where organization_id=$1', [biz, { start: 0, end: 0 }]);
  await env.sql("update workers set status='suspended' where id=$1", [worker]);
  assert.equal((await tick()).processed, false, 'Paused workers cannot claim recovery jobs');
  assert.equal((await one('select send_status from ops_campaign_recipients where id=$1', [locked.rec])).send_status, 'scheduled');
  await env.sql("update workers set status='active' where id=$1", [worker]);
  process.env.NOVA_SPENDING_LOCK = 'locked';
  assert.equal((await tick()).processed, true);
  const blocked = await one('select send_status,stop_reason from ops_campaign_recipients where id=$1', [locked.rec]);
  assert.equal(blocked.send_status, 'dry_run', 'Spending lock permits a recorded rehearsal, never provider acceptance');
  const receipt = await one('select status,provider,blocked_reason from wave1_messages where idempotency_key=$1', [`campaign:${locked.rec}`]);
  assert.equal(receipt.status, 'blocked'); assert.equal(receipt.provider, null); assert.equal(receipt.blocked_reason, 'send_disabled_dry_run');
  assert.equal(providers.twilio.messages.length, 0); assert.equal(env.stubs.outbox.length, 0);
  console.log('PASS — hosted campaigns respect quiet hours with one successor, retain paused work without retry costs, honor worker suspension and spending lock; zero outbound provider calls. Actual receiver + disposable PostgreSQL.');
} catch (error) { console.error(error); process.exitCode = 1; }
finally { await env.stop(); await providers.stop(); }
process.exit(process.exitCode ?? 0);
