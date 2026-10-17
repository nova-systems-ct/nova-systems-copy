// Nova Demand acceptance on a real disposable database through the real handlers: campaigns sell only approved
// services; prospects need a source and fit evidence and are deduplicated; nothing may be contacted before the owner
// approves; contact only through approved channels and within the approved volume; do-not-contact sticks; an inquiry
// carrying the campaign code is attributed; the funnel counts from real records; no message is ever sent by Demand.
import fs from 'node:fs';
import { startTestEnv } from './testenv/env.mjs';
import { makeCaller } from './testenv/call.mjs';
import { startProviderStandIns, clearProviderEnv, setupTestBusiness, TW_TOKEN, WH_SECRET, PUBLIC_BASE } from './testenv/opsFixture.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
clearProviderEnv();
const prov = await startProviderStandIns();
const env = await startTestEnv({ migrations: JSON.parse(fs.readFileSync('supabase/migration-manifest.json', 'utf8')).order, bootstrap: 'platform', publicBuckets: [] });
Object.assign(process.env, env.appEnv, prov.env, { APP_BASE_URL: 'http://localhost.test', WAVE1_PUBLIC_BASE: PUBLIC_BASE, TWILIO_AUTH_TOKEN: TW_TOKEN, TWILIO_ACCOUNT_SID: 'AC_SIMULATED_LOCAL', STRIPE_SECRET_KEY: 'sk_test_local_only', STRIPE_WEBHOOK_SECRET: WH_SECRET });
const client = makeCaller((await import('../api/client.js')).default);
const one = async (q, p) => (await env.sql(q, p)).rows[0];

try {
  for (let i = 0; i < 30 && (await env.rest(env.serviceKey, 'demand_campaigns?select=id&limit=0')).status !== 200; i++) await env.reload();
  const nova = (await one("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: nova });
  const { biz } = await setupTestBusiness({ env, client, ownerToken: owner.token, name: 'TEST Cafe' });
  const manager = await env.createUser({ email: 'manager@cafe.test', role: 'client_admin', orgId: biz });
  const other = (await one("insert into organizations (name, slug, kind) values ('TEST Other','other','client') returning id")).id;
  const outsider = await env.createUser({ email: 'x@other.test', role: 'client_owner', orgId: other });
  await env.sql("update wave1_org_settings set form_token='test-form-token-cafe-0123456789' where organization_id=$1", [biz]);
  const D = (body, token = owner.token) => client({ resource: 'ops', op: 'demand', method: 'POST', body: { organization_id: biz, ...body }, token });
  const G = (query, token = owner.token) => client({ resource: 'ops', op: 'demand', method: 'GET', query: { organization_id: biz, ...query }, token });

  let r = await D({ action: 'create', name: 'X', objective: 'Y', service_key: 'not_a_service', offer_text: 'Z', channels: ['email'] });
  check('a campaign can only sell an approved service', r.status === 400 && /approved services/.test(r.body.error));
  r = await D({ action: 'create', name: 'Office catering', objective: 'Two new paying catering customers in 30 days', service_key: 'full_detail', offer_text: 'Lunch catering for office meetings of 10–40 people.', channels: [] });
  check('a campaign needs at least one permitted channel', r.status === 400);
  r = await D({ action: 'create', name: 'Office catering', objective: 'Two new paying catering customers in 30 days', service_key: 'full_detail', offer_text: 'Lunch catering for office meetings of 10–40 people.', audience: 'Offices within 5 miles', channels: ['email', 'in_person'], volume_limit: 2 });
  const camp = r.body.campaign; const id = camp?.id;
  check('a draft campaign is created with an attribution code', r.status === 200 && camp.status === 'draft' && /^[A-Z0-9x]{6}$/i.test(camp.code), JSON.stringify(r.body).slice(0, 200));

  r = await D({ action: 'add-prospect', id, business_name: 'TEST Law Office', source: '' , fit_evidence: '' });
  check('a prospect without a source and fit evidence is refused', r.status === 400);
  const add = (name, web) => D({ action: 'add-prospect', id, business_name: name, website: web, source: `https://${web}/contact (public page)`, fit_evidence: 'Hosts weekly client meetings (public events page)', contact_route: 'Published office email' });
  const p1 = (await add('TEST Law Office', 'law.example.test')).body.prospect;
  const p2 = (await add('TEST Clinic Admin', 'clinic.example.test')).body.prospect;
  const p3 = (await add('TEST Agency', 'agency.example.test')).body.prospect;
  r = await add('TEST Law Office', 'https://www.law.example.test/');
  check('the same business is not added twice', r.status === 409);
  r = await D({ action: 'prospect-event', id, prospect_id: p1.id, kind: 'contacted', channel: 'email' });
  check('nobody can be contacted before the campaign is approved', r.status === 409);
  r = await D({ action: 'approve-prospects', id });
  check('prospects cannot be approved for contact before the campaign is approved', r.status === 409);
  r = await D({ action: 'approve', id }, manager.token);
  check("a manager who is not the business owner cannot approve the campaign", r.status === 403);
  r = await client({ resource: 'ops', op: 'demand', method: 'POST', body: { organization_id: biz, action: 'approve', id }, token: outsider.token });
  check('another organization cannot touch this campaign', r.status === 403);
  r = await D({ action: 'approve', id });
  check('the owner approves; the approval records the exact offer, service price, channels and limits', r.status === 200 && r.body.campaign.status === 'approved' && r.body.campaign.approval_snapshot?.service?.price_cents === 18000 && r.body.campaign.approval_snapshot.volume_limit === 2 && !!r.body.campaign.approval_snapshot.offer_sha256);
  r = await D({ action: 'approve-prospects', id });
  check('only as many prospects as the approved volume are approved for contact', r.status === 200 && r.body.approved === 2 && r.body.limit_reached === true && (await one("select status from demand_prospects where id=$1", [p3.id])).status === 'researched');
  r = await D({ action: 'prospect-event', id, prospect_id: p1.id, kind: 'contacted', channel: 'phone' });
  check('contact through a channel the owner did not approve is refused', r.status === 409 && /not an approved channel/.test(r.body.error));
  r = await D({ action: 'prospect-event', id, prospect_id: p1.id, kind: 'contacted', channel: 'email', note: 'Sent the approved intro email' });
  check('a contact through an approved channel is recorded', r.status === 200 && r.body.prospect.status === 'contacted');
  r = await D({ action: 'prospect-event', id, prospect_id: p2.id, kind: 'do_not_contact', note: 'Asked not to be contacted' });
  const again = await D({ action: 'prospect-event', id, prospect_id: p2.id, kind: 'contacted', channel: 'email' });
  check('do-not-contact sticks: no further contact can be recorded', r.status === 200 && again.status === 409);

  // a reply arrives through the real web form, carrying the campaign code
  r = await client({ resource: 'ops', op: 'web-inquiry', method: 'POST', body: { form: 'test-form-token-cafe-0123456789', campaign: camp.code, continue_on_web: true, submission_id: 'demand-1', rendered_at: Date.now() - 5000, fields: { name: 'TEST Law Office Manager', email: 'manager@law.example.test', message: 'We would like a full detail quote for the office car.' } } });
  const job = await one('select id, demand_campaign_id, state from ops_jobs where demand_campaign_id=$1', [id]);
  check('an inquiry carrying the campaign code is attributed to the campaign and quoted from the approved price', r.status === 200 && !!job && job.state === 'quoted', JSON.stringify([r.status, r.body, job]));
  r = await G({ action: 'detail', id });
  const f = r.body.funnel;
  check('the funnel counts from real records: prospects, approved, contacted, inquiries, quoted', f.prospects === 3 && f.approved_for_contact === 1 && f.contacted === 1 && f.do_not_contact === 1 && f.inquiries === 1 && f.quoted === 1 && f.booked === 0, JSON.stringify(f));
  check('the funnel says plainly that value is not profit and deposits are not double counted', /not profit/.test(f.note) && /not added/.test(f.note));
  r = await D({ action: 'pause', id });
  const paused = await D({ action: 'prospect-event', id, prospect_id: p1.id, kind: 'contacted', channel: 'email' });
  check('a paused campaign records no new contacts', r.status === 200 && paused.status === 409);
  check('Demand sent no message to anyone', prov.twilio.messages.length === 0 && env.stubs.outbox.length === 0);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); await prov.stop(); }
console.log(`\n${pass} passed, ${fail} failed — Nova Demand campaigns (real handlers + local PostgreSQL)`);
process.exitCode = fail ? 1 : 0;
setTimeout(() => process.exit(process.exitCode ?? 0), 10_000).unref();
