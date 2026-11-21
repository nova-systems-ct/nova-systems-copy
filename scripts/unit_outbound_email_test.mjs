// Email from client businesses (systems 20 and 23): Revive come-back emails, the unsubscribe link,
// and the weekly scorecard. In-memory store and a stand-in for the email provider: no database,
// email provider or customer is contacted. Customers and prices are TEST FIXTURES.
import crypto from 'node:crypto';
import { runRevive, reopenBlocked, sendReady, unsubscribe, emailFooter } from '../api/_revive.js';
import { sendScorecard } from '../api/_proof.js';
import { emailSwitch, sendEmail, emailCaps } from '../api/_email.js';
import { handleJourney } from '../api/_journey.js';
import { handleAgentAdmin } from '../api/_businessAgent.js';

const CC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', OTHER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const NOW = new Date('2026-11-23T15:00:00Z');
const DAY = 86400000;
const UNIQUE = { revive_outreach: ['idempotency_key'], scorecard_sends: ['organization_id', 'period_start'], business_agents: ['organization_id'], journey_events: ['idempotency_key'] };
function memoryDb() {
  const t = {}; const rows = (n) => (t[n] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : r[k] === v));
  return { t,
    select: async (n, f = {}, { order = 'created_at.asc', limit = 500 } = {}) => { const [c, d] = order.split('.'); return rows(n).filter((r) => hit(r, f)).sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : a._n - b._n) * (d === 'desc' ? -1 : 1)).slice(0, limit).map((r) => ({ ...r })); },
    insert: async (n, row) => { const u = UNIQUE[n]; if (u && rows(n).some((r) => u.every((k) => r[k] === row[k]))) throw Object.assign(new Error('conflict'), { status: 409 }); const full = { id: crypto.randomUUID(), created_at: new Date(NOW.getTime() + rows(n).length).toISOString(), _n: rows(n).length, ...row }; rows(n).push(full); return { ...full }; },
    update: async (n, f, p) => rows(n).filter((r) => hit(r, f)).map((r) => ({ ...Object.assign(r, p) })),
  };
}
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
const expectFail = async (p, code) => { try { await p; return false; } catch (e) { return e.code === code; } };

const AGENT = { organization_id: CC, business_name: 'Crystal Clear', email_enabled: true, reply_email: 'owner@crystal.example.invalid', mailing_address: '1 Main St, Westport, CT 06880', status: 'draft' };
async function seed({ agent = AGENT } = {}) {
  const db = memoryDb();
  if (agent) await db.insert('business_agents', agent);
  const svc = await db.insert('business_services', { organization_id: CC, name: 'Car detail', price_cents: 19900, price_approved: true, return_days: 90, active: true });
  const person = async (name, extra) => {
    const c = await db.insert('crm_contacts', { organization_id: CC, name, email: `${name}@example.invalid`, phone: null, sms_consent: false, email_consent: false, do_not_contact: false, ...extra });
    await db.insert('journeys', { organization_id: CC, contact_id: c.id, service_id: svc.id, stage: 'closed', closed_at: new Date(NOW.getTime() - 120 * DAY).toISOString(), paid_cents: 19900, total_cents: 19900 });
    return c;
  };
  return { db, svc, person };
}
const mailer = (fail = () => false) => { const sent = []; return { sent, send: async (m) => { sent.push(m); return fail(m) ? { ok: false, error: 'provider 500: down' } : { ok: true, id: `re_${sent.length}` }; } }; };
const caps = { perBusiness: 25, total: 80 };
const none = async () => 0;

// ============ 1. The switch and the provider call ==========================================
{
  check('email is off with no provider key', emailSwitch({}).on === false);
  check('email is off until NOVA_EMAIL_SENDING=on, even with a key', emailSwitch({ RESEND_API_KEY: 're_x' }).on === false && emailSwitch({ RESEND_API_KEY: 're_x', NOVA_EMAIL_SENDING: 'on' }).on === true);
  check('default daily caps leave room under the free plan\'s 100 a day', emailCaps({}).perBusiness === 25 && emailCaps({}).total === 80);
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return { ok: true, status: 200, json: async () => ({ id: 'email_123' }) }; };
  const env = { RESEND_API_KEY: 're_x', NOVA_EMAIL_SENDING: 'on' };
  let r = await sendEmail({ to: 'not-an-email', subject: 's', text: 't', fromName: 'X' }, env);
  check('a bad address is refused without calling the provider', !r.ok && calls.length === 0);
  r = await sendEmail({ to: 'dana@example.invalid', subject: 'Hello', text: 'Body', fromName: 'Crystal "Clear" <x>\r\nBcc: evil@example.invalid', replyTo: 'owner@crystal.example.invalid', headers: { 'List-Unsubscribe': '<https://u>' }, idempotencyKey: 'k1' }, env);
  const body = JSON.parse(calls[0].init.body);
  check('the provider\'s acceptance comes back with its id', r.ok && r.id === 'email_123');
  check('the sender name cannot inject headers or a second address', body.from === 'Crystal Clear xBcc evilexample.invalid <noreply@nova-systems.app>' && !/[<>":,@]/.test(body.from.split(' <')[0]) && !body.from.includes('\n'));
  check('replies go to the business; the unsubscribe header and idempotency key are passed on', body.reply_to === 'owner@crystal.example.invalid' && body.headers['List-Unsubscribe'] === '<https://u>' && calls[0].init.headers['Idempotency-Key'] === 'k1');
  r = await sendEmail({ to: 'dana@example.invalid', subject: 's', text: 't' }, {});
  check('with email switched off nothing is sent', !r.ok && r.error === 'email_off' && calls.length === 1);
}

// ============ 2. Preparing: a channel that can send is preferred ===========================
{
  const { db, person } = await seed();
  const both = await person('dana', { phone: '+12035550101', sms_consent: true, email_consent: true });
  const textOnly = await person('eli', { phone: '+12035550102', sms_consent: true });
  const out = await runRevive(db, CC, { now: NOW, canSend: { email: true }, business: 'Crystal Clear', baseUrl: 'https://preview.example.invalid' });
  const of = (c) => db.t.revive_outreach.find((o) => o.contact_id === c.id);
  check('a customer who agreed to texts and email gets the email, since texting cannot send yet', of(both).status === 'ready' && of(both).channel === 'email');
  check('the email wording has no "Reply STOP" (the footer carries the unsubscribe link)', !/Reply STOP/.test(of(both).message) && of(both).message.includes('https://preview.example.invalid/start?org='));
  check('a text-only customer is saved as not sent, with the text wording kept', of(textOnly).status === 'blocked' && of(textOnly).blocked_reason === 'channel_not_connected' && /Reply STOP/.test(of(textOnly).message));
  check('the run reports it honestly', out.prepared === 2 && out.ready === 1 && out.blocked === 1);
}

// ============ 3. Messages prepared while email was off become ready once it is on =========
{
  const { db, person } = await seed();
  const c = await person('fay', { email_consent: true });
  await runRevive(db, CC, { now: NOW, canSend: {}, business: 'Crystal Clear' });
  const o = () => db.t.revive_outreach.find((x) => x.contact_id === c.id);
  check('prepared while email was off: saved as not sent', o().status === 'blocked' && o().blocked_reason === 'channel_not_connected');
  const n = await reopenBlocked(db, CC, { email: true });
  check('turning email on makes it ready, as an email, without the text wording', n === 1 && o().status === 'ready' && o().channel === 'email' && o().blocked_reason === null && !/Reply STOP/.test(o().message));
  const again = await runRevive(db, CC, { now: NOW, canSend: { email: true }, business: 'Crystal Clear' });
  check('and running Revive again does not prepare a second message for the same step', again.prepared === 0 && db.t.revive_outreach.length === 1);
}

// ============ 4. Sending ===================================================================
{
  const { db, person } = await seed();
  const a = await person('gia', { email_consent: true });
  const b = await person('hal', { email_consent: true });
  const t = await person('ivy', { phone: '+12035550103', sms_consent: true });
  await runRevive(db, CC, { now: NOW, canSend: { email: true }, business: 'Crystal Clear', baseUrl: 'https://preview.example.invalid' });
  const agent = db.t.business_agents[0];
  check('nothing is sent while the business has email off', await expectFail(sendReady(db, CC, { agent: { ...agent, email_enabled: false }, send: mailer().send, caps, appBase: 'https://p', countSentToday: none }), 'email_not_enabled'));
  check('nothing is sent without the business mailing address', await expectFail(sendReady(db, CC, { agent: { ...agent, mailing_address: '  ' }, send: mailer().send, caps, appBase: 'https://p', countSentToday: none }), 'mailing_address_required'));

  Object.assign(db.t.crm_contacts.find((c) => c.id === b.id), { do_not_contact: true }); // hal opts out after it was prepared
  const m = mailer();
  const out = await sendReady(db, CC, { agent, send: m.send, caps, appBase: 'https://preview.example.invalid', now: NOW, countSentToday: none });
  const of = (c) => db.t.revive_outreach.find((o) => o.contact_id === c.id);
  check('the ready email goes to the customer who agreed to email', out.sent === 1 && m.sent.length === 1 && m.sent[0].to === 'gia@example.invalid');
  check('it is marked sent only with the provider\'s reference', of(a).status === 'sent' && of(a).provider_reference === 'email:re_1' && !!of(a).sent_at);
  check('a customer who opted out after it was prepared is not emailed', of(b).status === 'blocked' && of(b).blocked_reason === 'customer_opted_out' && out.held === 1);
  check('the text-only message is left for when texting is approved', of(t).status === 'blocked');
  const mail = m.sent[0];
  check('the email shows the business, its mailing address and an unsubscribe link', mail.fromName === 'Crystal Clear' && mail.text.includes('1 Main St, Westport, CT 06880') && /To stop these emails: https:\/\/preview\.example\.invalid\/api\/client\?resource=journey&op=unsubscribe&t=[0-9a-f]{48}$/.test(mail.text));
  check('the mail app gets a one-click unsubscribe header, and replies go to the business', mail.headers['List-Unsubscribe'].startsWith('<https://preview.example.invalid/api/client?resource=journey&op=unsubscribe&t=') && mail.headers['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click' && mail.replyTo === 'owner@crystal.example.invalid');
  check('the subject says who it is from', mail.subject === 'Crystal Clear: time for your next visit');
  const again = await sendReady(db, CC, { agent, send: m.send, caps, appBase: 'https://p', now: NOW, countSentToday: none });
  check('pressing Send again sends nothing twice', again.sent === 0 && m.sent.length === 1);

  // The customer clicks unsubscribe.
  const token = mail.text.match(/t=([0-9a-f]{48})$/)[1];
  check('a wrong or malformed token unsubscribes nobody', !(await unsubscribe(db, 'f'.repeat(48))) && !(await unsubscribe(db, 'nope')));
  check('the link unsubscribes that customer from email and every other message', (await unsubscribe(db, token)) && db.t.crm_contacts.find((c) => c.id === a.id).do_not_contact === true && db.t.crm_contacts.find((c) => c.id === a.id).email_consent === false);
}
{
  const { db, person } = await seed();
  for (const n of ['jo', 'kai', 'lu']) await person(n, { email_consent: true });
  await runRevive(db, CC, { now: NOW, canSend: { email: true }, business: 'Crystal Clear' });
  const m = mailer((msg) => msg.to === 'kai@example.invalid');
  let out = await sendReady(db, CC, { agent: db.t.business_agents[0], send: m.send, caps: { perBusiness: 25, total: 80 }, appBase: 'https://p', now: NOW, countSentToday: none });
  check('a message the provider did not accept stays ready to try again', out.failed === 1 && db.t.revive_outreach.find((o) => o.message.includes('kai')).status === 'ready');
  const { db: db2, person: p2 } = await seed();
  for (const n of ['mo', 'ned', 'oz']) await p2(n, { email_consent: true });
  await runRevive(db2, CC, { now: NOW, canSend: { email: true }, business: 'Crystal Clear' });
  out = await sendReady(db2, CC, { agent: db2.t.business_agents[0], send: mailer().send, caps: { perBusiness: 2, total: 80 }, appBase: 'https://p', now: NOW, countSentToday: none });
  check('the business\'s daily cap holds: the rest wait for tomorrow', out.sent === 2 && out.waiting_for_tomorrow === 1);
  out = await sendReady(db2, CC, { agent: db2.t.business_agents[0], send: mailer().send, caps: { perBusiness: 25, total: 80 }, appBase: 'https://p', now: NOW, countSentToday: async () => 80 });
  check('Nova\'s daily total across all businesses holds too', out.sent === 0 && out.waiting_for_tomorrow === 1);
}

// ============ 5. The weekly scorecard by email ==============================================
{
  const { db } = await seed();
  const m = mailer();
  let out = await sendScorecard(db, CC, { to: 'owner@crystal.example.invalid', business: 'Crystal Clear', send: m.send, now: NOW });
  check('the scorecard is emailed to the owner and recorded with the provider\'s reference', out.sent && m.sent[0].to === 'owner@crystal.example.invalid' && db.t.scorecard_sends[0].provider_reference === 'email:re_1' && m.sent[0].text.startsWith('Crystal Clear: '));
  out = await sendScorecard(db, CC, { to: 'owner@crystal.example.invalid', business: 'Crystal Clear', send: m.send, now: new Date(NOW.getTime() + 3600_000) });
  check('it goes at most once a day per business', !out.sent && out.reason === 'already_sent_today' && m.sent.length === 1);
  const { db: db2 } = await seed();
  out = await sendScorecard(db2, CC, { to: 'owner@crystal.example.invalid', business: 'Crystal Clear', send: mailer(() => true).send, now: NOW });
  check('if the provider does not accept it, nothing is recorded as sent', !out.sent && out.reason === 'not_accepted' && !(db2.t.scorecard_sends || []).length);
}

// ============ 6. HTTP: the owner's buttons, the unsubscribe page and the weekly schedule ====
{
  const { db, person } = await seed({ agent: { ...AGENT, email_enabled: false } });
  await person('pat', { email_consent: true });
  await db.insert('business_agents', { organization_id: OTHER, business_name: 'Other Shop', email_enabled: true, reply_email: 'other@example.invalid', mailing_address: '2 Elm St' });
  Object.assign(process.env, { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'k', RESEND_API_KEY: 're_test', APP_BASE_URL: 'https://preview.example.invalid', CRON_SECRET: 'cron-secret-123' });
  delete process.env.NOVA_EMAIL_SENDING;
  const mails = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
    if (u.host === 'api.resend.com') { mails.push(JSON.parse(init.body)); return json(200, { id: `re_http_${mails.length}` }); }
    const table = u.pathname.replace('/rest/v1/', ''), f = {};
    for (const [k, v] of u.searchParams) if (!['order', 'limit', 'select'].includes(k)) f[k] = v === 'is.null' ? null : (v.slice(3) === 'true' ? true : v.slice(3) === 'false' ? false : decodeURIComponent(v.slice(3)));
    try {
      if (!init.method || init.method === 'GET') return json(200, await db.select(table, f, { order: u.searchParams.get('order') || 'created_at.asc', limit: Number(u.searchParams.get('limit')) || 500 }));
      if (init.method === 'POST') return json(201, [await db.insert(table, JSON.parse(init.body))]);
      return json(200, await db.update(table, f, JSON.parse(init.body)));
    } catch (e) { return json(e.status || 500, {}); }
  };
  const deps = { requireStaff: async () => ({ id: 'u1', email: 'staff@example.invalid' }), requireOrgAccess: async () => true, sanitize: (v, n = 2000) => (typeof v === 'string' ? v.trim().slice(0, n) : ''), sanitizeEmail: (v) => v, rateLimit: () => true };
  const res = () => ({ code: 200, body: null, html: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(x) { this.body = x; return this; }, end(x) { this.html = x; return this; } });
  const call = async (method, op, payload, extra = {}) => { const r = res(); await handleJourney({ method, query: method === 'GET' ? payload : {}, body: method === 'POST' ? payload : undefined, headers: extra.headers || {} }, r, op, deps); return r; };

  let r = await call('POST', 'revive-run', { organization_id: CC });
  check('with email off, preparing says why nothing can be emailed', r.code === 200 && r.body.email_ready === false && /switched off/.test(r.body.email_note) && r.body.blocked === 1);
  r = await call('POST', 'revive-send', { organization_id: CC });
  check('and Send refuses with the reason', r.code === 409 && mails.length === 0);
  process.env.NOVA_EMAIL_SENDING = 'on';
  r = await call('POST', 'revive-run', { organization_id: CC });
  check('with Nova\'s switch on but the business\'s email off, it says to turn it on', r.body.email_ready === false && /Assistant tab/.test(r.body.email_note));
  db.t.business_agents.find((a) => a.organization_id === CC).email_enabled = true;
  r = await call('POST', 'revive-run', { organization_id: CC });
  check('once the business turns email on, the earlier message becomes ready', r.body.email_ready === true && r.body.reopened === 1);
  r = await call('POST', 'revive-send', { organization_id: CC });
  check('Send emails it', r.code === 200 && r.body.sent === 1 && mails.length === 1 && mails[0].to[0] === 'pat@example.invalid' && mails[0].from === 'Crystal Clear <noreply@nova-systems.app>');
  const token = mails[0].text.match(/t=([0-9a-f]{48})$/)[1];
  r = await call('GET', 'unsubscribe', { t: token });
  check('the unsubscribe link opens a plain confirmation page and opts the customer out', r.code === 200 && r.headers['Content-Type'].startsWith('text/html') && /unsubscribed/.test(r.html) && db.t.crm_contacts.find((c) => c.name === 'pat').do_not_contact === true);
  r = await call('POST', 'unsubscribe', { t: token });
  check('the mail app\'s one-click unsubscribe works too', r.code === 200 && r.body.ok === true);
  r = await call('GET', 'unsubscribe', { t: 'f'.repeat(48) });
  check('an unknown link says so and changes nothing', r.code === 404 && /not valid/.test(r.html));

  r = await call('POST', 'send-scorecard', { organization_id: CC });
  check('"Email me this report" sends the scorecard to the business\'s report address', r.code === 200 && r.body.sent === true && r.body.to === 'owner@crystal.example.invalid' && mails.at(-1).subject === 'Crystal Clear: your last 7 days');
  r = await call('GET', 'weekly-scorecards', {}, { headers: { authorization: 'Bearer wrong' } });
  check('the weekly schedule needs Nova\'s secret', r.code === 401);
  const before = mails.length;
  r = await call('GET', 'weekly-scorecards', {}, { headers: { authorization: 'Bearer cron-secret-123' } });
  check('with it, every business with email on gets its report once (one already went today)', r.code === 200 && r.body.sent === 1 && mails.length === before + 1 && mails.at(-1).to[0] === 'other@example.invalid' && r.body.results.some((x) => x.reason === 'already_sent_today'));
  process.env.NOVA_EMAIL_DAILY_CAP_TOTAL = '0';
  r = await call('POST', 'send-scorecard', { organization_id: OTHER });
  check('Nova\'s daily email allowance is respected', r.code === 409 && /allowance/.test(r.body.error));
  delete process.env.NOVA_EMAIL_DAILY_CAP_TOTAL;

  // The owner's assistant settings.
  const save = async (body) => { const out = res(); await handleAgentAdmin({ method: 'POST', query: {}, body: { organization_id: CC, business_name: 'Crystal Clear', ...body } }, out, 'save', { requireOrgAccess: async () => true, sanitize: deps.sanitize, rateLimit: () => true }); return out; };
  r = await save({ email_enabled: true, reply_email: 'owner@crystal.example.invalid', mailing_address: '' });
  check('email cannot be turned on without a mailing address', r.code === 400);
  r = await save({ email_enabled: true, reply_email: 'not-an-email', mailing_address: '1 Main St' });
  check('a bad reply address is refused', r.code === 400);
  r = await save({ email_enabled: true, reply_email: 'Owner@Crystal.example.invalid', mailing_address: '1 Main St, Westport, CT 06880' });
  const saved = db.t.business_agents.find((a) => a.organization_id === CC);
  check('the owner can turn email on with both filled in', r.code === 200 && saved.email_enabled === true && saved.reply_email === 'owner@crystal.example.invalid');
  r = await save({ greeting: 'Hi!' });
  check('an older screen that does not send the email fields leaves them as they were', r.code === 200 && db.t.business_agents.find((a) => a.organization_id === CC).email_enabled === true);
  check('the email footer reads cleanly', emailFooter({ business: 'B', mailingAddress: 'A', unsubscribeUrl: 'U' }) === '\n\n--\nB\nA\nYou are getting this because you are a customer of B. To stop these emails: U');
}

console.log(`\n${pass}/${pass + fail} outbound email checks passed (stand-in store and email provider — nothing sent, no database contacted)`);
process.exit(fail ? 1 : 0);
