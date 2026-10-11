// Shared fixture for Nova Operations tests: a Nova-owned TEST business configured through the REAL API, plus local
// stand-ins for Twilio (messages API) and Stripe (checkout sessions). Every record is flagged test; nothing leaves
// this machine. Provider results from these stand-ins are "simulated provider" results, never real deliveries.
import http from 'node:http';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { twilioSignature } from '../../api/_wave1.js';

export const TW_TOKEN = 'twilio_test_token_local_only';
export const WH_SECRET = 'whsec_ops_local_test_only';
export const PUBLIC_BASE = 'https://nova.test.example';
export const BIZ_NUMBER = '+12035550100';

export async function startProviderStandIns() {
  const twilio = { messages: [], mode: 'ok' };
  const twilioSrv = http.createServer((req, res) => {
    let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (twilio.mode === 'down') { res.statusCode = 503; return res.end('{}'); }
      const p = new URLSearchParams(d); const sid = `SM_SIMULATED_${twilio.messages.length + 1}`;
      twilio.messages.push({ to: p.get('To'), from: p.get('From'), body: p.get('Body'), sid, at: Date.now() });
      res.statusCode = 201; res.end(JSON.stringify({ sid, status: 'queued' }));
    });
  });
  const stripe = { requests: [] };
  const stripeSrv = http.createServer((req, res) => {
    let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => {
      stripe.requests.push({ url: req.url, idem: req.headers['idempotency-key'], body: new URLSearchParams(d) });
      res.setHeader('Content-Type', 'application/json');
      if (req.url.endsWith('/checkout/sessions')) { const id = `cs_test_sim_${stripe.requests.length}`; return res.end(JSON.stringify({ id, url: `https://checkout.stripe.test/pay/${id}` })); }
      res.statusCode = 404; res.end('{}');
    });
  });
  await Promise.all([new Promise((r) => twilioSrv.listen(0, '127.0.0.1', r)), new Promise((r) => stripeSrv.listen(0, '127.0.0.1', r))]);
  return {
    twilio, stripe,
    env: { TWILIO_API_BASE: `http://127.0.0.1:${twilioSrv.address().port}`, STRIPE_API_BASE: `http://127.0.0.1:${stripeSrv.address().port}` },
    async stop() { await new Promise((r) => twilioSrv.close(r)); await new Promise((r) => stripeSrv.close(r)); },
  };
}

export function clearProviderEnv() {
  for (const k of Object.keys(process.env)) if (/^(STRIPE_|TWILIO_|RESEND_|SUPABASE_|VITE_SUPABASE_|WAVE1_|OPS_|ANTHROPIC_|CALCOM_)/.test(k)) delete process.env[k];
}

export function signedTwilio(client, op, params, { resource = 'wave1', token = TW_TOKEN } = {}) {
  const url = `${PUBLIC_BASE}/api/client?resource=${resource}&op=${op}`;
  return client({ resource, op, body: params, headers: { 'x-twilio-signature': twilioSignature(url, params, token) } });
}
let sid = 0;
export const inboundSms = (client, from, body, to = BIZ_NUMBER) => signedTwilio(client, 'sms-inbound', { From: from, To: to, Body: body, MessageSid: `SM_IN_${Date.now()}_${++sid}`, AccountSid: 'AC_TEST' });

export async function stripeWebhook(handler, event, secret = WH_SECRET) {
  const payload = JSON.stringify(event); const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex');
  const req = Readable.from([Buffer.from(payload)]);
  Object.assign(req, { method: 'POST', query: {}, socket: { remoteAddress: '127.0.0.1' }, headers: { 'stripe-signature': `t=${ts},v1=${sig}`, origin: 'https://nova-systems.app', 'x-forwarded-for': '10.31.0.1' } });
  const res = { code: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; }, end() { return this; } };
  await handler(req, res); return { status: res.code, body: res.body };
}

// Configures a TEST business entirely through the API as the Nova owner. Returns ids.
export async function setupTestBusiness({ env, client, ownerToken, name = 'TEST Shine Detailing', hours = null }) {
  const op = (o, body) => client({ resource: 'ops', op: o, method: 'POST', body, token: ownerToken });
  const biz = (await op('businesses', { name, industry: 'Mobile auto detailing (TEST)', is_test: true })).body.business.id;
  await op('settings', { organization_id: biz, timezone: 'America/New_York', business_hours: hours || Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((d) => [d, [{ start: '08:00', end: '18:00' }]])), escalation_phone: '+12035550111', review_url: 'https://g.page/r/TEST-shine-review', hold_minutes: 20, lead_time_hours: 2 });
  await env.sql("update wave1_org_settings set sms_number_ref=$2, provider_registration='approved', quiet_hours='{\"start\":0,\"end\":0}' where organization_id=$1", [biz, BIZ_NUMBER]); // TEST: no quiet hours so wall-clock time cannot change results
  const prices = [
    { service_key: 'full_detail', name: 'Full detail', duration_minutes: 180, buffer_minutes: 30, price_cents: 18000, deposit_cents: 5000 },
    { service_key: 'interior_only', name: 'Interior cleaning', duration_minutes: 90, price_cents: 9000, deposit_cents: 2500 },
  ];
  for (const p of prices) { const r = await op('prices', { organization_id: biz, action: 'create', ...p }); await op('prices', { organization_id: biz, action: 'approve', id: r.body.row.id }); }
  const t = await op('templates', { organization_id: biz, action: 'create', template_key: 'service_agreement', title: 'TEST Service Agreement', body: 'Service agreement between {{business_name}} and {{customer_name}}.\n\nService: {{service_name}}. Price: {{price}}. Deposit: {{deposit}}.\n\nAppointment: {{appointment}}.\n\nDRAFT TERMS FOR TESTING — not reviewed by an attorney.' });
  await op('templates', { organization_id: biz, action: 'approve', id: t.body.row.id, acknowledge_not_legal_advice: true });
  await op('payment-account', { organization_id: biz, mode: 'nova_test_platform' });
  return { biz };
}
