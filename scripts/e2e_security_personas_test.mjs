// SECURITY REPAIR 2026-09-30 — persona tests for every repaired endpoint (audit F-03, F-04, F-05, F-08,
// F-16, F-22, F-23, F-24, F-26, F-33, F-35). Real handlers (api/*.js) run in-process against a real,
// disposable PostgreSQL + PostgREST built from supabase/migration-manifest.json (the strict clean
// install). Supabase Auth/Storage and Resend are local stand-ins; Stripe is never contacted (webhooks are
// signed locally with a throwaway secret). Nothing here touches a real provider or a real database.
//
// Personas: anonymous visitor, applicant (nova_sales_candidate), sales representative (nova_sales),
// authorized Nova staff (nova_admin), other-organization staff (client_owner of a client org), owner
// (nova_super_admin).
//
// Usage: node scripts/e2e_security_personas_test.mjs   (exit 0 only when every check passes)
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { startTestEnv } from './testenv/env.mjs';
import { makeCaller } from './testenv/call.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };

// No real provider credentials may reach this process, whatever the parent shell holds.
for (const k of Object.keys(process.env)) if (/^(STRIPE_|TWILIO_|RESEND_|SUPABASE_|VITE_SUPABASE_|SALES_ALLOW_LIVE)/.test(k)) delete process.env[k];

const manifest = JSON.parse(fs.readFileSync('supabase/migration-manifest.json', 'utf8')).order;
const env = await startTestEnv({ migrations: manifest, bootstrap: 'platform', publicBuckets: [] });
Object.assign(process.env, env.appEnv, { APP_BASE_URL: 'http://localhost.test' });
const WH = 'whsec_local_persona_test_only';

const imp = async (p) => (await import(p)).default;
const client = makeCaller(await imp('../api/client.js'));
const intake = makeCaller(await imp('../api/intake.js'));
const notify = makeCaller(await imp('../api/notify.js'));
const bizIntake = makeCaller(await imp('../api/business-intake.js'));
const contracts = makeCaller(await imp('../api/contracts.js'));
const team = makeCaller(await imp('../api/team.js'));
const stripeHandler = await imp('../api/stripe.js');
const { ONBOARD_TIERS } = await import('../api/_onboardTiers.js');

async function webhook(event, { secret = WH, ts = Math.floor(Date.now() / 1000), tamper = null } = {}) {
  const payload = JSON.stringify(event);
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex');
  const req = Readable.from([Buffer.from(tamper ? tamper(payload) : payload)]);
  Object.assign(req, { method: 'POST', query: {}, socket: { remoteAddress: '127.0.0.1' }, headers: { 'stripe-signature': `t=${ts},v1=${sig}`, origin: 'https://nova-systems.app', 'x-forwarded-for': '10.200.0.1' } });
  const res = { code: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; }, end() { return this; } };
  await stripeHandler(req, res);
  return { status: res.code, body: res.body };
}
let evtN = 0;
const sessionEvent = (meta, over = {}) => ({ id: `evt_persona_${++evtN}`, type: 'checkout.session.completed', livemode: false, data: { object: { id: `cs_${evtN}`, payment_status: 'paid', currency: 'usd', amount_total: 25000, payment_intent: `pi_${evtN}`, metadata: meta, ...over } } });
const one = async (q, p) => (await env.sql(q, p)).rows[0];

try {
  check('the strict clean-install manifest built the test database with no SQL errors', env.migrationErrors.length === 0, JSON.stringify(env.migrationErrors.slice(0, 2)));
  for (let i = 0; i < 30 && (await env.rest(env.serviceKey, 'organizations?select=id&limit=1')).status !== 200; i++) await env.reload();

  // ------------------------------------------------------------------ personas
  const nova = (await one("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).id;
  const orgB = (await one("insert into organizations (name, slug, kind) values ('Client B','client-b','client') returning id")).id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: nova });
  const admin = await env.createUser({ email: 'admin@nova.test', role: 'nova_admin', orgId: nova });
  const auditor = await env.createUser({ email: 'auditor@nova.test', role: 'nova_auditor', orgId: nova });
  const rep = await env.createUser({ email: 'rep@nova.test', role: 'nova_sales', orgId: nova });
  const applicant = await env.createUser({ email: 'applicant@nova.test', role: 'nova_sales_candidate', orgId: nova });
  const other = await env.createUser({ email: 'owner@clientb.test', role: 'client_owner', orgId: orgB });

  // ------------------------------------------------------------------ data
  const novaClient = (await one("insert into clients (full_name, business_name, email, organization_id) values ('Real Client','Real Co','billing@realclient.test',$1) returning id", [nova])).id;
  const bClient = (await one("insert into clients (full_name, email, organization_id) values ('B Client','b@clientb.test',$1) returning id", [orgB])).id;
  const inv1 = (await one("insert into client_invoices (client_id, organization_id, invoice_number, total, status, line_items) values ($1,$2,'INV-1',250,'Unpaid','[]') returning id", [novaClient, nova])).id;
  const inv2 = (await one("insert into client_invoices (client_id, organization_id, invoice_number, total, status) values ($1,$2,'INV-2',90,'Unpaid') returning id", [novaClient, nova])).id;
  const invB = (await one("insert into client_invoices (client_id, organization_id, invoice_number, total, status) values ($1,$2,'B-1',10,'Unpaid') returning id", [bClient, orgB])).id;

  // ================================================================== F-03: public intake (save-client / welcome-complete / clients)
  let r = await intake({ action: 'save-client', body: { full_name: 'Visitor', email: 'visitor@x.test', tier_id: 'website', tier_name: 'Everything', tier_price: 1, status: 'Active', payment_status: 'Paid', organization_id: orgB } });
  const saved = r.body?.client_id && await one('select tier_name, tier_price, status, payment_status, organization_id from clients where id=$1', [r.body.client_id]);
  check('anonymous save-client stores the PUBLISHED price/plan, never the browser figure', r.status === 200 && saved?.tier_name === ONBOARD_TIERS.website.name && Number(saved?.tier_price) === ONBOARD_TIERS.website.price, JSON.stringify(saved));
  check('anonymous save-client cannot set paid/active status or choose the organization', saved?.status === 'Pending Payment' && saved?.payment_status === 'Pending' && saved?.organization_id === nova, JSON.stringify(saved));
  r = await intake({ action: 'save-client', body: { id: novaClient, full_name: 'Overwrite', email: 'billing@realclient.test', tier_id: 'website' } });
  check('save-client is insert-only: supplying an existing id does not overwrite that client', (await one('select full_name from clients where id=$1', [novaClient])).full_name === 'Real Client');
  r = await intake({ action: 'save-client', body: { full_name: 'V', email: 'v@x.test', tier_id: 'made-up' } });
  check('an unknown plan is refused', r.status === 400);
  r = await intake({ action: 'welcome-complete', body: { client_id: novaClient, payment_intent_id: 'pi_fake', password: 'x' } });
  check('welcome-complete (browser-asserted payment → account) is retired: 410', r.status === 410);
  r = await intake({ action: 'clients', method: 'GET' });
  check('client list: anonymous → 401', r.status === 401);
  for (const [who, u] of [['applicant', applicant], ['representative', rep], ['other-organization staff', other]]) {
    r = await intake({ action: 'clients', method: 'GET', token: u.token });
    check(`client list: ${who} → 403`, r.status === 403, String(r.status));
  }
  r = await intake({ action: 'clients', method: 'GET', token: admin.token });
  check("client list: Nova staff see Nova's clients only (not Client B's)", r.status === 200 && JSON.stringify(r.body).includes(novaClient) && !JSON.stringify(r.body).includes(bClient), String(r.status));

  // ================================================================== F-04: invoice e-mail + contact relays
  const sendInv = (token, body) => notify({ action: 'send-invoice', token, body });
  check('send-invoice: anonymous → 401', (await sendInv(null, { organization_id: nova, invoice_id: inv1 })).status === 401);
  for (const [who, u] of [['applicant', applicant], ['representative', rep], ['other-organization staff', other]]) {
    check(`send-invoice: ${who} → 403`, (await sendInv(u.token, { organization_id: nova, invoice_id: inv1 })).status === 403);
  }
  r = await sendInv(admin.token, { organization_id: nova, invoice_id: invB });
  check("send-invoice: another organization's invoice id under Nova's org → 404", r.status === 404, String(r.status));
  const before = env.stubs.outbox.length;
  r = await sendInv(admin.token, { organization_id: nova, invoice_id: inv1, to: 'attacker@evil.test', client_email: 'attacker@evil.test', total: 1, pay_link: 'https://evil.test/pay', pdf_base64: Buffer.from('%PDF- forged').toString('base64') });
  const sent = env.stubs.outbox.slice(before);
  check('send-invoice: authorized staff → 200, provider accepted', r.status === 200 && r.body?.ok === true, JSON.stringify(r.body));
  check('the invoice email goes ONLY to the stored client address (request-supplied recipient ignored)', sent.length === 1 && JSON.stringify(sent[0].to) === JSON.stringify(['billing@realclient.test']), JSON.stringify(sent.map((m) => m.to)));
  check('amount and link come from the stored invoice (forged total/link ignored)', /\$250\.00/.test(sent[0]?.text || '') && !/evil\.test/.test(sent[0]?.text || ''));
  check('the attachment is a server-built PDF, not the browser-supplied file', sent[0]?.attachments?.length === 1 && sent[0].attachments[0].pdf === true && sent[0].attachments[0].bytes > 200, JSON.stringify(sent[0]?.attachments));

  const c0 = env.stubs.outbox.length;
  r = await notify({ action: 'contact', body: { name: 'Sam Submitter', email: 'sam@submitter.test', message: 'Hello there', confirmTo: 'victim@target.test', replyTo: 'attacker@evil.test', confirmName: 'Win a prize at http://evil.test/claim' } });
  const cmail = env.stubs.outbox.slice(c0);
  check('contact form: accepted', r.status === 200, String(r.status));
  check('contact form cannot be used as a relay: nothing is sent to a caller-chosen address', cmail.length > 0 && cmail.every((m) => !JSON.stringify(m.to).includes('victim@target.test') && !JSON.stringify(m.to).includes('attacker@evil.test')), JSON.stringify(cmail.map((m) => m.to)));
  check('contact form: reply-to is the submitter, and links are stripped from the echoed name', cmail.every((m) => !m.reply_to || JSON.stringify(m.reply_to).includes('sam@submitter.test')) && cmail.every((m) => !/evil\.test/.test(`${m.text || ''}${m.html || ''}`)));

  // ================================================================== F-05: browser cannot mark paid; owner-recorded evidence
  r = await client({ resource: 'invoices', token: admin.token, body: { action: 'create', organization_id: nova, client_id: novaClient, invoice_number: 'INV-X', total: 5, status: 'Paid' } });
  check("creating an invoice with status 'Paid' from the browser stores 'Unpaid'", r.status === 200 && r.body.invoice.status === 'Unpaid', JSON.stringify(r.body));
  r = await client({ resource: 'invoices', token: admin.token, body: { action: 'update', organization_id: nova, id: inv2, total: 90, status: 'Paid' } });
  check("updating an invoice cannot change its status to 'Paid'", (await one('select status from client_invoices where id=$1', [inv2])).status === 'Unpaid');
  r = await client({ resource: 'invoices', token: other.token, body: { action: 'update', organization_id: orgB, id: inv2, total: 1 } });
  check('other-organization staff cannot reach Nova invoices at all → 403', r.status === 403, String(r.status));
  r = await client({ resource: 'invoices', token: admin.token, body: { action: 'record-payment', organization_id: nova, id: inv2, method: 'check', evidence: 'Check #4411 deposited 2026-09-30' } });
  check('record-payment: staff who are not the owner → 403', r.status === 403);
  r = await client({ resource: 'invoices', token: owner.token, body: { action: 'record-payment', organization_id: nova, id: inv2, method: 'check', evidence: 'paid' } });
  check('record-payment: the owner must give real evidence (≥15 characters) → 422', r.status === 422);
  r = await client({ resource: 'invoices', token: owner.token, body: { action: 'record-payment', organization_id: nova, id: inv2, method: 'check', evidence: 'Check #4411 deposited 2026-09-30' } });
  const rec = await one('select status, payment_source, payment_method, payment_evidence from client_invoices where id=$1', [inv2]);
  check("owner-recorded payment is stored as 'owner_recorded' with method and evidence (distinct from provider-confirmed)", r.status === 200 && rec.status === 'Paid' && rec.payment_source === 'owner_recorded' && rec.payment_method === 'check', JSON.stringify(rec));

  // ================================================================== F-05: Stripe webhook authority
  const meta1 = { invoice_id: inv1, organization_id: nova };
  r = await webhook(sessionEvent(meta1));
  check('webhook with no configured secret is refused (503), nothing recorded', r.status === 503 && (await one('select status from client_invoices where id=$1', [inv1])).status === 'Unpaid');
  process.env.STRIPE_WEBHOOK_SECRET = WH;
  process.env.STRIPE_SECRET_KEY = 'sk_test_local_persona_never_sent'; // test mode; no Stripe API call is made on the webhook path
  r = await webhook(sessionEvent(meta1), { secret: 'whsec_wrong' });
  check('forged signature → 400', r.status === 400);
  r = await webhook(sessionEvent(meta1), { ts: Math.floor(Date.now() / 1000) - 900 });
  check('replayed (stale) signature → 400', r.status === 400);
  r = await webhook(sessionEvent(meta1), { tamper: (p) => p.replace('"amount_total":25000', '"amount_total":1') });
  check('body altered after signing → 400', r.status === 400);
  const unpaid = async () => (await one('select status from client_invoices where id=$1', [inv1])).status === 'Unpaid';
  r = await webhook(sessionEvent(meta1, { amount_total: 100 }));
  check('a signed event for the WRONG amount does not mark the invoice paid', r.status === 200 && (await unpaid()));
  r = await webhook(sessionEvent(meta1, { currency: 'eur' }));
  check('a signed event in the wrong currency does not mark it paid', r.status === 200 && (await unpaid()));
  r = await webhook({ ...sessionEvent(meta1), livemode: true });
  check('a LIVE-mode event while running test keys does not mark it paid', r.status === 200 && (await unpaid()));
  r = await webhook(sessionEvent({ invoice_id: inv1, organization_id: orgB }));
  check('an event naming the wrong organization does not mark it paid', r.status === 200 && (await unpaid()));
  r = await webhook(sessionEvent(meta1, { payment_status: 'unpaid' }));
  check('an unpaid session does not mark it paid', r.status === 200 && (await unpaid()));
  const alerts0 = env.stubs.outbox.filter((m) => /Invoice paid/.test(m.subject || '')).length;
  const good = sessionEvent(meta1);
  r = await webhook(good);
  const paid = await one('select status, payment_source, provider_event_id, paid_at from client_invoices where id=$1', [inv1]);
  check("the matching, signed, test-mode event marks it Paid with payment_source 'stripe' and the event id", r.status === 200 && paid.status === 'Paid' && paid.payment_source === 'stripe' && paid.provider_event_id === good.id, JSON.stringify(paid));
  r = await webhook(good);
  check('a repeat delivery of the same event is acknowledged as a duplicate', r.status === 200 && r.body?.duplicate === true, JSON.stringify(r.body));
  r = await webhook(sessionEvent(meta1));
  const paid2 = await one('select paid_at, provider_event_id from client_invoices where id=$1', [inv1]);
  check('a second, different event for an already-paid invoice changes nothing', r.status === 200 && String(paid2.paid_at) === String(paid.paid_at) && paid2.provider_event_id === good.id);
  check('the owner payment alert was sent exactly once', env.stubs.outbox.filter((m) => /Invoice paid/.test(m.subject || '')).length === alerts0 + 1);
  const onb = (await intake({ action: 'save-client', body: { full_name: 'Onboard Buyer', email: 'buyer@onboard.test', tier_id: 'website' } })).body.client_id;
  const piEvent = (amount) => ({ id: `evt_persona_${++evtN}`, type: 'payment_intent.succeeded', livemode: false, data: { object: { id: `pi_onb_${evtN}`, status: 'succeeded', currency: 'usd', amount_received: amount, metadata: { client_id: onb } } } });
  await webhook(piEvent(100));
  check('onboarding: a signed payment for less than the published price does not activate the client', (await one('select payment_status from clients where id=$1', [onb])).payment_status === 'Pending');
  await webhook(piEvent(ONBOARD_TIERS.website.price * 100));
  const onbRow = await one('select payment_status, status, payment_source from clients where id=$1', [onb]);
  check('onboarding: the exact published price activates the client, labelled stripe', onbRow.payment_status === 'Paid' && onbRow.status === 'Active' && onbRow.payment_source === 'stripe', JSON.stringify(onbRow));
  // A transient outage while recording a legacy payment must answer 500 AND let Stripe's retry through
  // (the event id is recorded first, so without the repair the retry was answered as a "duplicate").
  const inv3 = (await one("insert into client_invoices (client_id, organization_id, invoice_number, total, status) values ($1,$2,'INV-3',40,'Unpaid') returning id", [novaClient, nova])).id;
  const retryEvt = sessionEvent({ invoice_id: inv3, organization_id: nova }, { amount_total: 4000 });
  const realFetch = globalThis.fetch; let outage = true;
  globalThis.fetch = (u, o) => (outage && String(u).includes('/rest/v1/client_invoices') ? ((outage = false), Promise.reject(new Error('injected outage'))) : realFetch(u, o));
  let r1; try { r1 = await webhook(retryEvt); } finally { globalThis.fetch = realFetch; }
  const r2 = await webhook(retryEvt);
  check('a transient failure answers 500, and the retried event is then applied (not dropped as a duplicate)', r1.status === 500 && r2.status === 200 && !r2.body?.duplicate && (await one('select status from client_invoices where id=$1', [inv3])).status === 'Paid', `${r1.status} ${JSON.stringify(r2.body)}`);
  delete process.env.STRIPE_SECRET_KEY;

  // ================================================================== F-16: intake uploads
  const upload = (body) => bizIntake({ action: 'upload-file', body });
  const pdfB64 = Buffer.from('%PDF-1.4\n% persona test document\n').toString('base64');
  check('upload without a token → 401', (await upload({ file_base64: pdfB64, filename: 'a.pdf' })).status === 401);
  check('upload with a forged token → 401', (await upload({ upload_token: 'intake.forged.token', file_base64: pdfB64, filename: 'a.pdf' })).status === 401);
  const tokA = (await bizIntake({ action: 'upload-token' })).body.upload_token;
  const tokB = (await bizIntake({ action: 'upload-token' })).body.upload_token;
  r = await upload({ upload_token: tokA, file_base64: Buffer.from('<html><script>alert(1)</script></html>').toString('base64'), filename: 'invoice.pdf', content_type: 'application/pdf' });
  check('HTML disguised as a PDF is refused by content sniffing → 415', r.status === 415, String(r.status));
  r = await upload({ upload_token: tokA, file_base64: pdfB64, filename: '../../evil name.pdf' });
  const pathA = r.body?.path || '';
  check('a real PDF is stored under the token’s own random prefix with a server-chosen name', r.status === 200 && /^intake\/[0-9a-f]{32}\/\d+-[0-9a-f]{12}-[A-Za-z0-9_-]+\.pdf$/.test(pathA), pathA);
  const fileUrl = (token, path) => bizIntake({ action: 'file-url', method: 'GET', token, query: { path } });
  check('file link: anonymous → 401', (await fileUrl(null, pathA)).status === 401);
  for (const [who, u] of [['applicant', applicant], ['representative', rep], ['other-organization staff', other]]) {
    check(`file link: ${who} → 403`, (await fileUrl(u.token, pathA)).status === 403);
  }
  r = await fileUrl(admin.token, pathA);
  const got = r.body?.url ? await fetch(r.body.url) : null;
  check('file link: Nova staff get a short-lived signed link that returns the file', r.status === 200 && r.body.expires_in === 300 && got?.status === 200 && (await got.text()).startsWith('%PDF'), String(r.status));
  check('file link: a traversal path is refused → 400', (await fileUrl(admin.token, 'intake/../nova-vault/secret.pdf')).status === 400);
  r = await bizIntake({ action: 'submit', body: { name: 'Biz Owner', email: 'biz@owner.test', phone: '203-555-0100', businesses: [{ business_name: 'Owner Biz' }], agree_terms: true, agree_privacy: true, agree_audit_authorization: true, agree_no_services_until_signed: true, agree_no_charge_today: true, agree_cancellation_policy: true, ai_authorization: true, digital_signature: 'Biz Owner', upload_token: tokB, document_urls: { financial: [{ path: pathA, filename: 'stolen.pdf' }, { path: 'intake/00000000000000000000000000000000/x.pdf', filename: 'x.pdf' }] } } });
  const subRow = await one("select document_urls from intake_submissions where email='biz@owner.test' order by created_at desc limit 1");
  check("a submission cannot claim files uploaded under another submission's token", r.status === 200 && JSON.stringify(subRow?.document_urls || {}) === '{}', `${r.status} ${JSON.stringify(subRow)}`);

  // ================================================================== F-08: vault re-sign uses the row's own path
  env.stubs.objects.set('nova-vault/contracts/real.pdf', { data: Buffer.from('%PDF-real'), type: 'application/pdf' });
  env.stubs.objects.set('nova-vault/private/other-client.pdf', { data: Buffer.from('%PDF-other'), type: 'application/pdf' });
  const vdoc = (await one("insert into vault_documents (file_name, storage_path, type) values ('real.pdf','contracts/real.pdf','Contract') returning id")).id;
  r = await client({ resource: 'vault', op: 'resign', token: admin.token, body: { id: vdoc, path: 'private/other-client.pdf', storage_path: 'private/other-client.pdf' } });
  check('vault re-sign signs ONLY the stored path; a caller-supplied path is ignored', r.status === 200 && /contracts\/real\.pdf/.test(r.body.file_url) && !/other-client/.test(r.body.file_url), JSON.stringify(r.body));
  check('vault re-sign: other-organization staff → 403', (await client({ resource: 'vault', op: 'resign', token: other.token, body: { id: vdoc } })).status === 403);

  // ================================================================== F-33: blog drafts
  await env.sql("insert into blog_posts (title, slug, published) values ('Secret draft','secret-draft',false), ('Live post','live-post',true)");
  r = await client({ resource: 'blog', op: 'posts', method: 'GET', query: { slug: 'secret-draft' } });
  check('an unpublished post is not readable by slug anonymously', r.status === 200 && r.body === null, JSON.stringify(r.body));
  r = await client({ resource: 'blog', op: 'posts', method: 'GET', query: { slug: 'live-post' } });
  check('a published post is readable by slug', r.body?.slug === 'live-post');
  check('the drafts view requires staff → 401 anonymously', (await client({ resource: 'blog', op: 'posts', method: 'GET', query: { admin: 'true' } })).status === 401);

  // ================================================================== F-26: contract signing
  const c1 = (await one("insert into contracts (client_name, client_email, contract_type, status, sent_at, organization_id) values ('Sign Co','signer@signco.test','Digital Foundation','pending', now(), $1) returning id", [nova])).id;
  const cOld = (await one("insert into contracts (client_name, client_email, contract_type, status, sent_at, organization_id) values ('Old Co','old@old.test','Digital Foundation','pending', now() - interval '8 days', $1) returning id", [nova])).id;
  r = await contracts({ action: 'get', method: 'GET', query: { id: c1 } });
  const hash = r.body?.content_sha256;
  check('the public contract view returns the content hash and no signer email or signature data', r.status === 200 && /^[0-9a-f]{64}$/.test(hash || '') && !('client_email' in r.body) && !('signature_data' in r.body), JSON.stringify(r.body));
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const sign = (id, over = {}) => contracts({ action: 'sign', body: { id, signed_name: 'Pat Signer', signature_data: png, agreed: true, content_sha256: hash, ...over } });
  check('signing with a content hash that does not match the stored text → 409', (await sign(c1, { content_sha256: 'f'.repeat(64) })).status === 409);
  check('signing with a non-PNG "signature" → 422', (await sign(c1, { signature_data: 'data:text/html;base64,PGgxPg==' })).status === 422);
  check('an expired signing link is refused → 410', (await sign(cOld)).status === 410);
  const m0 = env.stubs.outbox.length;
  r = await sign(c1, { pdf_base64: Buffer.from('%PDF- forged').toString('base64') });
  const crow = await one('select status, content_sha256, signature_hash, signer_ip, pdf_url from contracts where id=$1', [c1]);
  check('a valid signature records the content hash, a signature hash, the signer IP and a server-made PDF', r.status === 200 && crow.status === 'signed' && crow.content_sha256 === hash && /^[0-9a-f]{64}$/.test(crow.signature_hash || '') && !!crow.signer_ip && /^vault:/.test(crow.pdf_url || ''), JSON.stringify(crow));
  const cm = env.stubs.outbox.slice(m0);
  check('the signed copy is emailed from the server PDF to the stored signer address', cm.some((m) => JSON.stringify(m.to).includes('signer@signco.test') && m.attachments?.some((a) => a.pdf && a.bytes > 200)), JSON.stringify(cm.map((m) => [m.to, m.attachments])));
  check('a signed contract cannot be signed again', (await sign(c1)).status === 400);

  // ================================================================== F-35: owner protection (team)
  const teamCall = (token, op, body) => team({ op, token, body });
  check('team: other-organization staff → 403', (await team({ op: 'list', method: 'GET', token: other.token })).status === 403);
  check('team: an admin cannot deactivate the owner → 403', (await teamCall(admin.token, 'deactivate', { staff_user_id: owner.id })).status === 403);
  check('team: an admin cannot change the owner role → 403', (await teamCall(admin.token, 'update-role', { staff_user_id: owner.id, role: 'nova_auditor' })).status === 403);
  check('team: an admin cannot grant the admin role → 403', (await teamCall(admin.token, 'update-role', { staff_user_id: auditor.id, role: 'nova_admin' })).status === 403);
  check('team: nobody can deactivate themselves → 409', (await teamCall(owner.token, 'deactivate', { staff_user_id: owner.id })).status === 409);
  check('team: the last active owner cannot be demoted → 409', (await teamCall(owner.token, 'update-role', { staff_user_id: owner.id, role: 'nova_admin' })).status === 409);
  r = await teamCall(owner.token, 'deactivate', { staff_user_id: auditor.id });
  check('team: the owner can still deactivate an ordinary staff member (legitimate access kept)', r.status === 200 && (await one("select status from organization_members where staff_user_id=$1", [auditor.id])).status === 'inactive');

  // ================================================================== F-22/F-23/F-24: cross-organization writes
  const novaCust = (await one("insert into crystal_customers (organization_id, name) values ($1,'Nova Customer') returning id", [nova])).id;
  r = await client({ resource: 'crystal', op: 'customers', token: other.token, body: { action: 'update', organization_id: orgB, id: novaCust, name: 'Hijacked' } });
  check("Crystal: Client B staff cannot rename Nova's customer through their own org → 404", r.status === 404, String(r.status));
  r = await client({ resource: 'crystal', op: 'customers', token: other.token, body: { action: 'update', organization_id: nova, id: novaCust, name: 'Hijacked' } });
  check("Crystal: Client B staff naming Nova's org → 403", r.status === 403, String(r.status));
  check("Crystal: Nova's customer is unchanged", (await one('select name, organization_id from crystal_customers where id=$1', [novaCust])).name === 'Nova Customer');
  r = await client({ resource: 'crystal', op: 'customers', token: other.token, body: { action: 'create', organization_id: orgB, name: 'B Customer' } });
  check('Crystal: Client B staff can still manage their own customers (legitimate access kept)', r.status === 200 && r.body.customer.organization_id === orgB, JSON.stringify(r.body));
  check('marketing (Nova workspace): other-organization staff → 403', (await client({ resource: 'marketing', op: 'brands', method: 'GET', token: other.token, query: { organization_id: orgB } })).status === 403);
  check('marketing (Nova workspace): representative without growth access → 403', (await client({ resource: 'marketing', op: 'brands', method: 'GET', token: rep.token, query: { organization_id: nova } })).status === 403);
  const apB = (await one("insert into approval_requests (organization_id, item_type, action_summary, status) values ($1,'spending','Buy ads for Client B','pending') returning id", [orgB])).id;
  r = await client({ resource: 'approvals', token: admin.token, body: { action: 'approve', id: apB } });
  check("approvals: Nova staff with no role in Client B cannot approve Client B's request (→ 404)", r.status === 404 && (await one('select status from approval_requests where id=$1', [apB])).status === 'pending', String(r.status));
  check('approvals: other-organization staff → 403', (await client({ resource: 'approvals', method: 'GET', token: other.token })).status === 403);

  // ================================================================== applicant / representative at the database layer
  for (const [who, u] of [['applicant', applicant], ['representative', rep], ['other-organization staff', other]]) {
    const d = await env.rest(u.token, 'client_invoices?select=id');
    check(`${who}: direct database read of invoices returns nothing`, Array.isArray(d.data) && d.data.length === 0, JSON.stringify(d.data).slice(0, 120));
    const o = await env.rest(u.token, 'organizations?select=id');
    check(`${who}: sees only their own organization`, Array.isArray(o.data) && o.data.every((x) => x.id === (u === other ? orgB : nova)), JSON.stringify(o.data));
  }
  const anonC = await env.rest(null, 'clients?select=id');
  check('anonymous: direct database read of clients is refused or empty', anonC.status >= 400 || (Array.isArray(anonC.data) && anonC.data.length === 0));
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed — security persona checks (real handlers + real local PostgreSQL/PostgREST; auth/storage/email are stand-ins; Stripe never contacted)`);
process.exitCode = fail ? 1 : 0;
