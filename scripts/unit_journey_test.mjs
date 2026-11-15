// The four agents (api/_journey.js) take one customer from first contact to a closed job.
// Nova is the test business. Runs against an in-memory store that enforces the same unique
// rules as the migration. No database, model, payment provider or channel is contacted, and the
// prices used here are TEST FIXTURES, not Nova's real prices.
import crypto from 'node:crypto';
import { startJourney, advance, chooseService, acceptQuote, chooseSlot, cancelJourney, recordPayment, completeWork, setPaused, receivables, handleChannelTrigger, matchService, tokenMatches, handleJourney } from '../api/_journey.js';

const NOVA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOW = new Date('2026-11-16T15:00:00Z');
const UNIQUE = { journeys: ['organization_id', 'source_channel', 'source_event_id'], journey_events: ['idempotency_key'], journey_documents: ['journey_id', 'kind', 'seq'], business_services: ['organization_id', 'name'], business_offers: ['organization_id', 'code'] };

function memoryDb() {
  const t = {};
  const rows = (name) => (t[name] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : r[k] === v));
  return {
    t,
    select: async (name, f = {}, { order = 'created_at.asc', limit = 500 } = {}) => {
      const [col, dir] = order.split('.');
      return rows(name).filter((r) => hit(r, f)).sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : a._n - b._n) * (dir === 'desc' ? -1 : 1)).slice(0, limit).map((r) => ({ ...r }));
    },
    insert: async (name, row) => {
      const u = UNIQUE[name];
      if (u && rows(name).some((r) => u.every((k) => r[k] === row[k]))) throw Object.assign(new Error('conflict'), { status: 409 });
      const full = { id: crypto.randomUUID(), created_at: new Date(NOW.getTime() + rows(name).length).toISOString(), _n: rows(name).length, ...row };
      rows(name).push(full); return { ...full };
    },
    update: async (name, f, patch) => rows(name).filter((r) => hit(r, f)).map((r) => ({ ...Object.assign(r, patch) })),
  };
}
async function seed() {
  const db = memoryDb();
  const web = await db.insert('business_services', { organization_id: NOVA, name: 'Customer care', description: 'Customers answered and passed to the right person.', keywords: ['answer calls', 'missed calls'], price_cents: 40000, price_approved: true, deposit_cents: 10000, terms_text: 'Nova will answer customer inquiries as agreed. Either side may end the service with notice.', terms_approved: true, active: true });
  const sched = await db.insert('business_services', { organization_id: NOVA, name: 'Scheduling', description: 'Appointments booked and confirmed.', keywords: ['booking', 'appointments'], price_cents: null, price_approved: false, deposit_cents: null, terms_text: null, terms_approved: false, active: true });
  await db.insert('business_services', { organization_id: OTHER, name: 'Teeth cleaning', keywords: [], price_cents: 9000, price_approved: true, active: true });
  const slotA = await db.insert('voice_calendar_slots', { organization_id: NOVA, service_name: 'Intro', start_at: '2026-11-18T15:00:00Z', end_at: '2026-11-18T15:30:00Z', status: 'open' });
  const slotB = await db.insert('voice_calendar_slots', { organization_id: NOVA, service_name: 'Intro', start_at: '2026-11-19T15:00:00Z', end_at: '2026-11-19T15:30:00Z', status: 'open' });
  await db.insert('business_offers', { organization_id: NOVA, trigger_type: 'social_comment', channel: null, code: 'THANKS5', description: '5% off your first month', percent_off: 5, approved: true, active: true, expires_at: null });
  await db.insert('business_offers', { organization_id: NOVA, trigger_type: 'social_like', channel: null, code: 'DRAFT10', description: '10% off', percent_off: 10, approved: false, active: true, expires_at: null });
  return { db, web, sched, slotA, slotB };
}
const fresh = async (db, id) => (await db.select('journeys', { id }))[0];
const events = async (db, id) => (await db.select('journey_events', { journey_id: id })).map((e) => e.action);
const docs = async (db, id, kind) => db.select('journey_documents', { journey_id: id, ...(kind ? { kind } : {}) });
const opts = { now: NOW };
const expectFail = async (p, code) => { try { await p; return false; } catch (e) { return e.code === code; } };

let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };

// ============ 1. The whole process, start to finish, without the owner touching anything ====
{
  const { db, slotA, slotB } = await seed();
  const ev = crypto.randomUUID();
  let s = await startJourney(db, { orgId: NOVA, channel: 'web', eventId: ev, name: 'Maria Lopez', email: 'Maria@Example.invalid', phone: '(203) 555-0142', text: 'We keep getting missed calls while on jobs.', now: NOW });
  const id = s.journey.id;
  check('FRONT DESK understood the request and handed it to contracts', s.next.stage === 'quoted' && (await events(db, id)).includes('service_identified'));
  check('a customer record and a sales record were created for the business', db.t.crm_contacts.length === 1 && db.t.crm_contacts[0].email === 'maria@example.invalid' && db.t.crm_contacts[0].phone === '+12035550142' && db.t.crm_deals[0].pipeline === 'client_sales');
  check('CONTRACTS quoted the owner-approved price', s.next.quote.total_cents === 40000 && s.next.quote.text.includes('$400.00') && s.next.waiting_on === 'customer');
  check('the customer gets a private link token that only its hash is stored for', /^[0-9a-f]{64}$/.test(s.token) && tokenMatches(await fresh(db, id), s.token) && !tokenMatches(await fresh(db, id), 'f'.repeat(64)) && !JSON.stringify(db.t.journeys).includes(s.token));

  let n = await acceptQuote(db, await fresh(db, id), { quoteId: s.next.quote.id, typedName: 'Maria Lopez' }, opts);
  const agreement = (await docs(db, id, 'agreement'))[0];
  check('the customer accepts; the approved agreement is recorded with their typed name', agreement?.status === 'accepted' && agreement.acceptance_evidence.includes('Maria Lopez') && agreement.body.includes('Either side may end'));
  check('ACCOUNTING invoiced the deposit', n.stage === 'deposit_due' && n.invoice.amount_cents === 10000);

  n = await recordPayment(db, await fresh(db, id), { amountCents: 10000, source: 'owner_recorded', reference: 'check-1041' }, opts);
  check('once the deposit is recorded, FRONT DESK offers real open times', n.stage === 'scheduling' && n.options.length === 2);
  n = await chooseSlot(db, await fresh(db, id), slotA.id, opts);
  check('the customer books a time and the slot is taken', n.stage === 'scheduled' && db.t.voice_calendar_slots.find((x) => x.id === slotA.id).status === 'booked');
  n = await chooseSlot(db, await fresh(db, id), slotB.id, opts);
  check('changing the time moves the same booking and frees the old slot', db.t.voice_calendar_slots.find((x) => x.id === slotA.id).status === 'open' && db.t.voice_calendar_slots.find((x) => x.id === slotB.id).status === 'booked' && db.t.journeys.length === 1);

  check('work cannot be marked complete without saying what was done', await expectFail(completeWork(db, await fresh(db, id), { note: 'done' }, opts), 'evidence_required'));
  n = await completeWork(db, await fresh(db, id), { note: 'Set up the customer care line and answered five test inquiries.', by: 'isaac' }, opts);
  check('after completion evidence, ACCOUNTING invoices only the balance', n.stage === 'balance_due' && n.invoice.amount_cents === 30000);

  n = await recordPayment(db, await fresh(db, id), { amountCents: 20000, source: 'owner_recorded', reference: 'card-1' }, opts);
  check('a part payment does not close the job', n.stage === 'balance_due' && (await fresh(db, id)).paid_cents === 30000);
  await recordPayment(db, await fresh(db, id), { amountCents: 20000, source: 'owner_recorded', reference: 'card-1' }, opts);
  check('repeating the same payment while the invoice is still open counts it once', (await fresh(db, id)).paid_cents === 30000 && (await docs(db, id, 'receipt')).length === 2);
  check('FINANCE lists what is still owed', (await receivables(db, NOVA, NOW)).total_cents === 30000 && (await receivables(db, OTHER, NOW)).rows.length === 0);
  n = await recordPayment(db, await fresh(db, id), { amountCents: 10000, source: 'provider_verified', reference: 'pi_test_123' }, opts);
  const j = await fresh(db, id);
  check('the final payment closes the job', n.stage === 'closed' && j.paid_cents === 40000 && j.closed_at);
  const report = (await docs(db, id, 'owner_report'))[0];
  check('FINANCE wrote the owner report, separating provider-confirmed money from hand-entered money', report.body.includes('$100.00 confirmed by the payment provider') && report.body.includes('$300.00 entered by a person'));
  check('no follow-up is prepared because the customer never agreed to be contacted', db.t.journey_events.find((e) => e.action === 'follow_up').status === 'blocked');
  check('every handoff is on the record, in order', JSON.stringify(await events(db, id)) === JSON.stringify(['inquiry_received', 'service_identified', 'quote_issued', 'quote_accepted', 'deposit_invoiced', 'payment_recorded', 'offered_times', 'appointment_booked', 'appointment_moved', 'work_completed', 'balance_invoiced', 'payment_recorded', 'payment_recorded', 'follow_up', 'owner_report_written']));
  check('the documents exist: quote, agreement, two invoices, three receipts, completion, report', ['quote', 'agreement', 'deposit_invoice', 'balance_invoice', 'completion', 'owner_report'].every((k) => db.t.journey_documents.some((d) => d.kind === k)) && db.t.journey_documents.filter((d) => d.kind === 'receipt').length === 3);
  check('the sales record followed along', db.t.crm_deals[0].stage === 'payment_condition_satisfied' && db.t.crm_deals[0].value_cents === 40000);
}

// ============ 2. Retries never duplicate ====================================================
{
  const { db } = await seed();
  const ev = crypto.randomUUID();
  const a = await startJourney(db, { orgId: NOVA, channel: 'web', eventId: ev, name: 'Sam', email: 'sam@example.invalid', text: 'missed calls', now: NOW });
  const b = await startJourney(db, { orgId: NOVA, channel: 'web', eventId: ev, name: 'Sam', email: 'sam@example.invalid', text: 'missed calls', now: NOW });
  check('the same first contact sent twice is one journey, one customer, one quote', b.repeated && b.token === null && db.t.journeys.length === 1 && db.t.crm_contacts.length === 1 && db.t.crm_deals.length === 1 && (await docs(db, a.journey.id, 'quote')).length === 1);
  await acceptQuote(db, await fresh(db, a.journey.id), { quoteId: a.next.quote.id, typedName: 'Sam Reed' }, opts);
  await recordPayment(db, await fresh(db, a.journey.id), { amountCents: 10000, source: 'owner_recorded', reference: 'dup-1' }, opts);
  const again = await expectFail(recordPayment(db, await fresh(db, a.journey.id), { amountCents: 10000, source: 'owner_recorded', reference: 'dup-1' }, opts), 'wrong_stage');
  check('the same payment reference cannot be counted twice', (await fresh(db, a.journey.id)).paid_cents === 10000 && (await docs(db, a.journey.id, 'receipt')).length === 1 && again);
  const c = await startJourney(db, { orgId: NOVA, channel: 'web', eventId: crypto.randomUUID(), name: 'Sam R', email: 'SAM@example.invalid', text: 'missed calls', now: NOW });
  check('a returning customer is matched by email, not duplicated', db.t.crm_contacts.length === 1 && c.journey.contact_id === a.journey.contact_id);
}

// ============ 3. The agents never invent a price, wording or a discount =====================
{
  const { db, sched } = await seed();
  const s = await startJourney(db, { orgId: NOVA, channel: 'web', eventId: crypto.randomUUID(), name: 'Dee', phone: '2035550177', text: 'I need help with booking', now: NOW });
  check('no approved price: CONTRACTS stops and asks the owner instead of quoting', s.next.stage === 'qualified' && s.next.waiting_on === 'owner' && (await docs(db, s.journey.id, 'quote')).length === 0 && db.t.approval_requests.length === 1 && !/\$/.test(s.next.message));
  await advance(db, await fresh(db, s.journey.id), opts);
  check('asking again does not raise a second owner request', db.t.approval_requests.length === 1);
  await db.update('business_services', { id: sched.id }, { price_cents: 25000, price_approved: true, terms_text: 'Draft wording', terms_approved: false });
  let n = await advance(db, await fresh(db, s.journey.id), opts);
  check('once the owner approves a price, the quote goes out by itself', n.stage === 'quoted' && n.quote.total_cents === 25000);
  n = await acceptQuote(db, await fresh(db, s.journey.id), { quoteId: n.quote.id, typedName: 'Dee Park' }, opts);
  check('unapproved agreement wording is never shown to a customer as an agreement', n.waiting_on === 'owner' && (await docs(db, s.journey.id, 'agreement')).length === 0 && (await fresh(db, s.journey.id)).stage === 'quoted');
  const q = (await docs(db, s.journey.id, 'quote'))[0];
  check('a stale quote cannot be accepted', await expectFail(acceptQuote(db, { ...(await fresh(db, s.journey.id)), total_cents: 99 }, { quoteId: q.id, typedName: 'Dee Park' }, opts), 'quote_changed'));

  await db.insert('business_services', { organization_id: NOVA, name: 'Marketing', keywords: ['videos'], price_cents: 90000, price_approved: false, active: true });
  const draftPrice = await startJourney(db, { orgId: NOVA, channel: 'web', eventId: crypto.randomUUID(), name: 'Rae', email: 'rae@example.invalid', text: 'we want videos', now: NOW });
  check('a price the owner typed but has not approved is never quoted', draftPrice.next.waiting_on === 'owner' && (await docs(db, draftPrice.journey.id, 'quote')).length === 0);

  const vague = await startJourney(db, { orgId: NOVA, channel: 'web', eventId: crypto.randomUUID(), name: 'Lee', email: 'lee@example.invalid', text: 'hello, can you help my shop?', now: NOW });
  check('an unclear request gets a question with the real service list, not a guess', vague.next.waiting_on === 'customer' && vague.next.options.length === 3 && vague.next.options.every((o) => o.name));
  check('a customer cannot pick another business\'s service', await expectFail(chooseService(db, await fresh(db, vague.journey.id), db.t.business_services.find((x) => x.organization_id === OTHER).id, opts), 'unknown_service'));
  check('service matching needs one clear match', matchService('booking and missed calls', db.t.business_services.filter((x) => x.organization_id === NOVA)) === null);
}

// ============ 4. Like or comment → approved offer → discount on the quote ===================
{
  const { db } = await seed();
  const t = await handleChannelTrigger(db, { orgId: NOVA, channel: 'tiktok', type: 'social_comment', eventId: 'cmt_1', handle: '@joesplumbing', canSend: false, now: NOW });
  const issued = db.t.journey_events.find((e) => e.action === 'offer_issued');
  check('a comment starts a journey with the owner-approved 5% offer attached', t.started && t.offer.code === 'THANKS5' && (await fresh(db, t.journey.id)).offer_id === t.offer.id);
  check('with no connected account the offer message is recorded as NOT sent', t.send === false && issued.status === 'blocked' && issued.detail.reason === 'channel_not_connected');
  const again = await handleChannelTrigger(db, { orgId: NOVA, channel: 'tiktok', type: 'social_comment', eventId: 'cmt_1', handle: '@joesplumbing', canSend: true, now: NOW });
  check('the same comment delivered twice issues one offer', again.started === false && again.send === false && db.t.journey_events.filter((e) => e.action === 'offer_issued').length === 1);
  const n = await chooseService(db, await fresh(db, t.journey.id), db.t.business_services[0].id, opts);
  check('the discount is applied to the quote exactly once', n.quote.total_cents === 38000 && n.quote.text.includes('THANKS5') && (await fresh(db, t.journey.id)).discount_cents === 2000);
  const like = await handleChannelTrigger(db, { orgId: NOVA, channel: 'instagram', type: 'social_like', eventId: 'like_1', handle: '@someone', canSend: true, now: NOW });
  check('an offer the owner has not approved is never issued', like.started === false && like.reason === 'no_approved_offer');
  const typed = await startJourney(db, { orgId: NOVA, channel: 'web', eventId: crypto.randomUUID(), name: 'Pat', email: 'pat@example.invalid', text: 'missed calls', offerCode: 'DRAFT10', now: NOW });
  check('typing an unapproved code gives no discount', typed.next.quote.total_cents === 40000 && db.t.journey_events.some((e) => e.action === 'offer_not_applied'));
}

// ============ 5. Booking, cancelling and a person taking over ===============================
{
  const { db, slotA } = await seed();
  await db.update('business_services', { organization_id: NOVA, name: 'Customer care' }, { deposit_cents: null, terms_text: null });
  const mk = async (name) => { const s = await startJourney(db, { orgId: NOVA, channel: 'web', eventId: crypto.randomUUID(), name, email: `${name}@example.invalid`, text: 'missed calls', now: NOW }); await acceptQuote(db, await fresh(db, s.journey.id), { quoteId: s.next.quote.id, typedName: `${name} Test` }, opts); return s.journey.id; };
  const one = await mk('ann'), two = await mk('bob');
  check('with no deposit and no agreement needed, accepting goes straight to choosing a time', (await fresh(db, one)).stage === 'scheduling' && (await docs(db, one, 'agreement')).length === 0);
  const results = await Promise.allSettled([chooseSlot(db, await fresh(db, one), slotA.id, opts), chooseSlot(db, await fresh(db, two), slotA.id, opts)]);
  check('two customers reaching for the same time: exactly one gets it', results.filter((r) => r.status === 'fulfilled').length === 1 && results.find((r) => r.status === 'rejected').reason.code === 'slot_unavailable');
  const winner = (await fresh(db, one)).slot_id ? one : two;
  await cancelJourney(db, await fresh(db, winner), 'customer');
  check('cancelling frees the time and closes the sales record as lost', db.t.voice_calendar_slots.find((x) => x.id === slotA.id).status === 'open' && (await fresh(db, winner)).stage === 'cancelled' && db.t.crm_deals.some((d) => d.stage === 'lost'));
  const loser = winner === one ? two : one;
  await setPaused(db, await fresh(db, loser), true, 'isaac');
  const paused = await advance(db, await fresh(db, loser), opts);
  check('when a person takes over, the agents stand down', paused.reason === 'a_person_has_taken_over' && (await fresh(db, loser)).stage === 'scheduling');
}

// ============ 6. The HTTP layer: tokens and organization permissions ========================
{
  const { db } = await seed();
  const s = await startJourney(db, { orgId: NOVA, channel: 'web', eventId: crypto.randomUUID(), name: 'Kim', email: 'kim@example.invalid', text: 'missed calls', now: NOW });
  process.env.SUPABASE_URL = 'https://db.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  // Serve PostgREST calls from the same in-memory store.
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url)), table = u.pathname.replace('/rest/v1/', ''), f = {};
    for (const [k, v] of u.searchParams) if (!['order', 'limit'].includes(k)) f[k] = v === 'is.null' ? null : (v.slice(3) === 'true' ? true : v.slice(3) === 'false' ? false : v.slice(3));
    const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
    try {
      if (!init.method) return json(200, await db.select(table, f, { order: u.searchParams.get('order') || 'created_at.asc', limit: Number(u.searchParams.get('limit')) || 500 }));
      if (init.method === 'POST') return json(201, [await db.insert(table, JSON.parse(init.body))]);
      return json(200, await db.update(table, f, JSON.parse(init.body)));
    } catch (e) { return json(e.status || 500, {}); }
  };
  const deps = (staff, allowed) => ({ requireStaff: async (_r, res) => { if (!staff) res.status(401).json({ error: 'login' }); return staff ? { id: 'u1', email: 'owner@example.invalid' } : null; }, requireOrgAccess: async (_r, res) => { if (!allowed) res.status(403).json({ error: 'no' }); return allowed; }, sanitize: (v, n = 2000) => (typeof v === 'string' ? v.trim().slice(0, n) : ''), sanitizeEmail: (v) => (typeof v === 'string' && /^\S+@\S+\.\S+$/.test(v) ? v.trim().toLowerCase() : ''), rateLimit: () => true });
  const call = async (method, op, payload, d = deps(false, false)) => { const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(x) { this.body = x; return this; } }; await handleJourney({ method, query: method === 'GET' ? payload : {}, body: method === 'POST' ? payload : undefined }, res, op, d); return res; };

  let r = await call('POST', 'status', { journey_id: s.journey.id, token: 'f'.repeat(64) });
  check('a wrong link token reveals nothing', r.code === 404);
  r = await call('POST', 'status', { journey_id: s.journey.id, token: s.token });
  check('the customer\'s own link shows their next step', r.code === 200 && r.body.next.stage === 'quoted' && !JSON.stringify(r.body).includes('customer_token_hash'));
  r = await call('POST', 'accept', { journey_id: s.journey.id, token: s.token, quote_id: r.body.next.quote.id, typed_name: 'Kim Vale' });
  check('the customer can accept through the API', r.code === 200 && r.body.next.stage === 'deposit_due');
  r = await call('POST', 'record-payment', { organization_id: NOVA, journey_id: s.journey.id, amount_cents: 10000, reference: 'x' });
  check('a customer link cannot record a payment: that needs a staff login', r.code === 401 && (await fresh(db, s.journey.id)).paid_cents === 0);
  r = await call('POST', 'record-payment', { organization_id: NOVA, journey_id: s.journey.id, amount_cents: 10000, reference: 'x' }, deps(true, false));
  check('staff from outside the organization cannot record a payment either', r.code === 403 && (await fresh(db, s.journey.id)).paid_cents === 0);
  r = await call('POST', 'record-payment', { organization_id: OTHER, journey_id: s.journey.id, amount_cents: 10000, reference: 'x' }, deps(true, true));
  check('an owner of another business cannot touch this business\'s journey', r.code === 404 && (await fresh(db, s.journey.id)).paid_cents === 0);
  r = await call('POST', 'record-payment', { organization_id: NOVA, journey_id: s.journey.id, amount_cents: 10000, reference: 'cash-7' }, deps(true, true));
  check('the business\'s owner can, and it is labelled as entered by a person', r.code === 200 && db.t.journey_documents.find((d) => d.kind === 'receipt').payment_source === 'owner_recorded');
  r = await call('POST', 'start', { organization_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', submission_id: crypto.randomUUID(), name: 'X', email: 'x@example.invalid' });
  check('a business with no published services takes no public requests', r.code === 404);
  const before = db.t.journeys.length;
  r = await call('POST', 'start', { organization_id: NOVA, submission_id: crypto.randomUUID(), name: 'Bot', email: 'bot@example.invalid', website_url_confirm: 'http://spam' });
  check('a filled hidden field stores nothing', r.code === 200 && db.t.journeys.length === before);
  r = await call('POST', 'save-service', { organization_id: NOVA, name: 'Marketing', price_cents: 50000, price_approved: true, deposit_cents: 60000 }, deps(true, true));
  check('a deposit larger than the price is refused', r.code === 400);
  r = await call('POST', 'save-offer', { organization_id: NOVA, code: 'big', percent_off: 150, trigger_type: 'manual' }, deps(true, true));
  check('an impossible discount is refused', r.code === 400);
  await db.insert('organizations', { id: NOVA, name: 'Nova Systems' });
  await db.insert('business_offers', { organization_id: NOVA, trigger_type: 'web_visit', channel: null, code: 'FRIDAY', description: 'Black Friday: 10% off your first month', percent_off: 10, approved: true, active: true, expires_at: '2026-12-01T05:00:00Z' });
  await db.insert('business_offers', { organization_id: NOVA, trigger_type: 'web_visit', channel: null, code: 'SECRET', description: 'Unapproved', percent_off: 50, approved: false, active: true, expires_at: null });
  r = await call('POST', 'business', { organization_id: NOVA });
  check('the public page gets the business name, its services and only the approved public offer', r.code === 200 && r.body.business.name === 'Nova Systems' && r.body.business.services.length >= 2 && r.body.business.offer?.code === 'FRIDAY');
  check('the public page never receives prices, unapproved offers or other offers', !/price|cents|SECRET|THANKS5|DRAFT10/.test(JSON.stringify(r.body)));
  r = await call('POST', 'business', { organization_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });
  check('a business with no services has no public page', r.code === 404);
  r = await call('GET', 'list', { organization_id: NOVA }, deps(true, true));
  check('the owner\'s list never includes customer link secrets', r.code === 200 && r.body.journeys.length > 0 && !JSON.stringify(r.body).includes('customer_token_hash'));
}

console.log(`\n${pass}/${pass + fail} customer journey checks passed (in-memory store, test prices — no database, payment provider or channel contacted)`);
process.exit(fail ? 1 : 0);
