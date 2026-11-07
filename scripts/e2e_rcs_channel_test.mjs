// Native RCS through the real webhook/admin/API/worker/database. Google is an in-process stand-in; no real sends.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { startTestEnv } from './testenv/env.mjs';
import { makeCaller } from './testenv/call.mjs';
import { clearProviderEnv, setupTestBusiness } from './testenv/opsFixture.mjs';
clearProviderEnv();
const env = await startTestEnv({ migrations: JSON.parse(fs.readFileSync('supabase/migration-manifest.json')).order, bootstrap: 'platform', publicBuckets: [] });
const originalFetch = globalThis.fetch, outgoing = [];
try {
  assert.deepEqual(env.migrationErrors, []);
  Object.assign(process.env, env.appEnv, { APP_BASE_URL: 'https://nova.test', NOVA_SPENDING_LOCK: 'locked', NOVA_CHANNEL_SEND_ENABLED: 'false', NOVA_ROLE_MODEL: 'off', NOVA_CHANNEL_WEBHOOK_RCS_TEST: 'LOCAL-WEBHOOK-TOKEN' });
  const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.NOVA_CHANNEL_TOKEN_RCS_TEST = JSON.stringify({ client_email: 'test@project.iam.gserviceaccount.com', private_key: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    if (u.origin === 'https://oauth2.googleapis.com') return Response.json({ access_token: 'LOCAL-ONLY-GOOGLE-TOKEN', expires_in: 3600 });
    if (u.origin === 'https://businesscommunications.googleapis.com') return Response.json({ name: 'brands/brand-test/agents/agent-test' });
    if (u.origin === 'https://rcsbusinessmessaging.googleapis.com') {
      outgoing.push(JSON.parse(init.body));
      return Response.json({ name: `phones/+12035550110/agentMessages/${u.searchParams.get('messageId')}` });
    }
    assert(['127.0.0.1', 'localhost'].includes(u.hostname), `No real external service in this test: ${u.origin}`);
    return originalFetch(url, init);
  };
  const q = async (sql, args) => (await env.sql(sql, args)).rows;
  const nova = (await q("insert into organizations(name,slug,kind) values('TEST Nova RCS','rcs-nova','nova_internal') returning id"))[0].id;
  const admin = await env.createUser({ email: 'rcs-admin@nova.test', role: 'nova_super_admin', orgId: nova });
  const client = makeCaller((await import('../api/client.js')).default);
  const { biz } = await setupTestBusiness({ env, client, ownerToken: admin.token });
  const owner = await env.createUser({ email: 'rcs-owner@business.test', role: 'client_owner', orgId: biz });
  const integrations = (await import('../api/integrations.js')).default;
  const channel = makeCaller(integrations);
  const act = (body, token = owner.token) => channel({ op: 'channels', body: { organization_id: biz, ...body }, token });
  let result = await act({ action: 'prepare', provider: 'android_rcs', provider_account_id: 'agent-test', label: 'TEST Android RCS', token_ref: 'NOVA_CHANNEL_TOKEN_RCS_TEST', webhook_secret_ref: 'NOVA_CHANNEL_WEBHOOK_RCS_TEST', transport_config: { brand_id: 'brand-test' } });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  const connection = result.body.connection;
  assert.equal(connection.status, 'draft'); assert.equal(connection.outbound_enabled, false);
  assert.equal((await act({action:'assign-credentials',connection_id:connection.id})).status,403,'A business owner cannot claim another business’s server secret');
  assert.equal((await act({action:'verify-account',connection_id:connection.id})).status,409);
  assert.equal((await act({action:'assign-credentials',connection_id:connection.id},admin.token)).status,200);
  assert.equal((await act({ action: 'verify-account', connection_id: connection.id })).status, 200);
  result = await act({ action: 'configure', connection_id: connection.id, status: 'enabled', automation_enabled: true, outbound_enabled: false, authorization_reference: 'LOCAL TEST owned-account acceptance' });
  assert.equal(result.status, 200);
  let sequence = 0;
  const incoming = async (text, { messageId, agentId = 'agent-test', signature = true, eventType } = {}) => {
    const event = { agentId, senderPhoneNumber: '+12035550110', messageId: messageId || `TEST-message-${++sequence}`, text, sendTime: new Date().toISOString() };
    if(eventType){event.eventType=eventType;event.eventId=event.messageId;delete event.messageId;}
    const bytes = Buffer.from(JSON.stringify(event)); const body = Buffer.from(JSON.stringify({ message: { data: bytes.toString('base64') } }));
    const req = Readable.from([body]);
    Object.assign(req, { method: 'POST', query: { op: 'rcs-webhook', connection_id: connection.id }, headers: { 'x-goog-webhook-type': 'message_callback', 'x-goog-signature': signature ? crypto.createHmac('sha512', process.env.NOVA_CHANNEL_WEBHOOK_RCS_TEST).update(bytes).digest('base64') : 'invalid' } });
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } };
    await integrations(req, res); return res;
  };
  assert.equal((await incoming('Hello', { signature: false })).code, 403);
  assert.equal((await incoming('Hello', { agentId: 'different-agent' })).code, 403);
  assert.equal((await q('select count(*)::int as n from channel_events'))[0].n, 0);
  const { createPostgresJobStore } = await import('../worker/postgresJobStore.mjs');
  const W = await import('../worker/index.mjs');
  const store = createPostgresJobStore({ url: env.base, serviceKey: env.serviceKey });
  const run = () => W.processOneJob(store, { mode: 'postgres', url: env.base, serviceKey: env.serviceKey, store });
  assert.equal((await incoming('Hello', { messageId: 'TEST-first' })).code, 200);
  assert.equal((await incoming('Hello', { messageId: 'TEST-first' })).code, 200);
  assert.equal((await q("select count(*)::int as n from jobs where job_type='channel_rcs_turn'"))[0].n, 1);
  await run();
  assert.equal(outgoing.length, 0, 'Spending lock must block OAuth/message delivery');
  assert.equal((await q("select blocked_reason from wave1_messages where direction='outbound' order by created_at desc limit 1"))[0].blocked_reason, 'spending_locked');
  const contact = (await q('select * from crm_contacts where organization_id=$1', [biz]))[0];
  assert.equal(contact.phone_e164, null); assert.equal(contact.sms_consent, false, 'RCS contact does not grant SMS permission');
  process.env.NOVA_SPENDING_LOCK = 'disabled'; process.env.NOVA_CHANNEL_SEND_ENABLED = 'true';
  await env.sql('update channel_connections set outbound_enabled=true where id=$1', [connection.id]);
  await incoming('1'); await run();
  await incoming('1'); await run();
  assert.equal((await q('select state,source_channel from ops_jobs where organization_id=$1', [biz]))[0].state, 'awaiting_agreement');
  assert.equal((await q('select source_channel from ops_jobs where organization_id=$1', [biz]))[0].source_channel, 'android_rcs');
  assert(outgoing.some(x => x.contentMessage.text.includes('/service/')), 'The booking agreement stays on RCS, never incorrectly routes to SMS');
  const sentBeforeNativeOptOut=outgoing.length;
  await incoming('',{eventType:'UNSUBSCRIBE'});
  assert.equal((await q('select suppressed from channel_identities where organization_id=$1',[biz]))[0].suppressed,true);
  await incoming('',{eventType:'SUBSCRIBE'});
  const [nativeIdentity]=await q('select suppressed,marketing_consent from channel_identities where organization_id=$1',[biz]);
  assert.equal(nativeIdentity.suppressed,false);assert.equal(nativeIdentity.marketing_consent,false);assert.equal(outgoing.length,sentBeforeNativeOptOut);
  const before = outgoing.length; await incoming('STOP'); await run();
  assert.equal((await q('select suppressed from channel_identities where organization_id=$1', [biz]))[0].suppressed, true);
  assert.equal(outgoing.length, before);
  const outsider = await env.createUser({ email: 'rcs-outsider@nova.test', role: 'client_owner', orgId: nova });
  assert.equal((await act({ action: 'configure', connection_id: connection.id, status: 'paused' }, outsider.token)).status, 403);
  console.log('PASS — scoped owner configures RCS, signatures/agent binding/deduplication hold, spending lock blocks delivery, real worker offers slots and agreement in RCS, STOP holds, cross-business access refused. Google is a local stand-in only.');
} catch (error) { console.error(error); process.exitCode = 1; }
finally { globalThis.fetch = originalFetch; await env.stop(); }
process.exit(process.exitCode ?? 0);
