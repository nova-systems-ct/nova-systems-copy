// Reviews (system 19): api/_reviews.js, the review request in Revive, and the HTTP ops. In-memory
// store, TEST FIXTURES only: no database, email provider or review site is contacted.
import crypto from 'node:crypto';
import { startJourney, acceptQuote, chooseSlot, completeWork, recordPayment, handleJourney } from '../api/_journey.js';
import { rate, newRatingLink, journeyForRatingLink, resolveFeedback, feedbackList, finishedPaid } from '../api/_reviews.js';
import { runRevive } from '../api/_revive.js';
import { scorecard, scorecardText } from '../api/_proof.js';

const CC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NOW = new Date('2026-11-24T14:00:00Z');
const UNIQUE = { journeys: ['organization_id', 'source_channel', 'source_event_id'], journey_events: ['idempotency_key'], journey_documents: ['journey_id', 'kind', 'seq'], business_services: ['organization_id', 'name'], customer_feedback: ['journey_id'], revive_outreach: ['idempotency_key'] };
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
const fresh = async (db, id) => (await db.select('journeys', { id }))[0];
const opts = { now: NOW };

async function finishedJob(db, slot, name, email) {
  const s = await startJourney(db, { orgId: CC, channel: 'web', eventId: crypto.randomUUID(), name, email, text: 'detail', now: NOW });
  await acceptQuote(db, s.journey, { quoteId: s.next.quote.id, typedName: name }, opts);
  await chooseSlot(db, await fresh(db, s.journey.id), slot.id, opts);
  await completeWork(db, await fresh(db, s.journey.id), { note: 'Full detail done, inside and out.', by: 'pro' }, opts);
  await recordPayment(db, await fresh(db, s.journey.id), { amountCents: 19900, source: 'owner_recorded', reference: `r-${name}` }, opts);
  return { id: s.journey.id, token: s.token };
}
async function seed({ reviewUrl = 'https://g.page/r/crystal-clear/review' } = {}) {
  const db = memoryDb();
  await db.insert('business_agents', { organization_id: CC, business_name: 'Crystal Clear', review_url: reviewUrl });
  await db.insert('business_services', { organization_id: CC, name: 'Car detail', keywords: ['detail'], price_cents: 19900, price_approved: true, deposit_cents: null, active: true });
  const slot = await db.insert('voice_calendar_slots', { organization_id: CC, service_name: 'Detail', start_at: '2026-11-25T15:00:00Z', end_at: '2026-11-25T17:00:00Z', status: 'open' });
  const slot2 = await db.insert('voice_calendar_slots', { organization_id: CC, service_name: 'Detail', start_at: '2026-11-26T15:00:00Z', end_at: '2026-11-26T17:00:00Z', status: 'open' });
  return { db, slot, slot2 };
}

// ============ 1. Rating a finished, paid job ===============================================
{
  const { db, slot, slot2 } = await seed();
  const s = await startJourney(db, { orgId: CC, channel: 'web', eventId: crypto.randomUUID(), name: 'Early', email: 'early@example.invalid', text: 'detail', now: NOW });
  check('a job that is not finished and paid cannot be rated', await expectFail(rate(db, await fresh(db, s.journey.id), { rating: 5 }), 'not_finished'));
  const happy = await finishedJob(db, slot, 'Dana', 'dana@example.invalid');
  check('the job is finished and paid', finishedPaid(await fresh(db, happy.id)));
  check('a rating must be a whole number from 1 to 5', await expectFail(rate(db, await fresh(db, happy.id), { rating: 6 }), 'bad_rating') && await expectFail(rate(db, await fresh(db, happy.id), { rating: 4.5 }), 'bad_rating'));
  const r5 = await rate(db, await fresh(db, happy.id), { rating: 5, comment: 'Car looks new', now: NOW });
  check('a 5 is thanked and offered the owner\'s public review page', r5.review_url === 'https://g.page/r/crystal-clear/review' && /public review/.test(r5.message));
  check('a second rating for the same job is refused', await expectFail(rate(db, await fresh(db, happy.id), { rating: 1 }), 'already_rated'));
  const sad = await finishedJob(db, slot2, 'Eli', 'eli@example.invalid');
  const r2 = await rate(db, await fresh(db, sad.id), { rating: 2, comment: 'Missed the back seats', now: NOW });
  check('a 2 is apologised to, and the owner is asked to call', /owner will contact you/.test(r2.message) && db.t.customer_feedback.find((f) => f.rating === 2).follow_up === 'owner_to_call');
  check('the review page is offered at every rating, never only to happy customers (no review gating)', r2.review_url === r5.review_url && /public review/.test(r2.message));
  check('the owner gets a task with the customer\'s words', db.t.approval_requests.some((a) => a.item_type === 'customer_feedback' && /Eli rated their job 2 out of 5: "Missed the back seats"\. Call them\./.test(a.action_summary)));
  check('both ratings are in each job\'s history', db.t.journey_events.some((e) => e.action === 'customer_happy') && db.t.journey_events.some((e) => e.action === 'customer_unhappy' && e.status === 'waiting_owner'));
  const list = await feedbackList(db, CC);
  check('the owner\'s list has both, with names, and no link secrets', list.length === 2 && list.some((f) => f.customer_name === 'Eli') && !JSON.stringify(list).includes('token_hash'));
  await resolveFeedback(db, CC, db.t.customer_feedback.find((f) => f.rating === 2).id, 'owner@example.invalid');
  check('the owner marks the call handled', db.t.customer_feedback.find((f) => f.rating === 2).follow_up === 'resolved');
  const card = await scorecard(db, CC, { from: new Date(NOW.getTime() - 7 * 86400000), to: new Date(NOW.getTime() + 86400000), now: NOW });
  check('the scorecard counts the ratings and their average', card.feedback.answered === 2 && card.feedback.average === 3.5 && /rated 2 jobs: 3\.5 out of 5/.test(scorecardText(card, 'Crystal Clear')));
}
{
  const { db, slot } = await seed({ reviewUrl: null });
  const j = await finishedJob(db, slot, 'Fay', 'fay@example.invalid');
  const r = await rate(db, await fresh(db, j.id), { rating: 5 });
  check('with no review page set, the customer is simply thanked', r.review_url === null && /glad it went well/.test(r.message));
}

// ============ 2. The rating question by email, through Revive ============================
{
  const { db, slot, slot2 } = await seed();
  const a = await finishedJob(db, slot, 'Gia', 'gia@example.invalid');
  const b = await finishedJob(db, slot2, 'Hal', 'hal@example.invalid');
  Object.assign(db.t.crm_contacts.find((c) => c.name === 'Gia'), { email_consent: true });
  const out = await runRevive(db, CC, { now: new Date(NOW.getTime() + 86400000), canSend: { email: true }, business: 'Crystal Clear', baseUrl: 'https://preview.example.invalid' });
  const ask = db.t.revive_outreach.find((o) => o.kind === 'review_request');
  check('a customer who agreed to email is asked how it went, with a private rating link', out.prepared === 1 && ask.status === 'ready' && ask.channel === 'email' && /How did we do\? Rate us from 1 to 5 here: https:\/\/preview\.example\.invalid\/rate\?t=[0-9a-f]{48}$/.test(ask.message));
  check('a customer who never agreed to be contacted is not asked at all', !db.t.revive_outreach.some((o) => o.journey_id === b.id) && !db.t.customer_feedback.some((f) => f.journey_id === b.id));
  check('only the link\'s hash is stored', !JSON.stringify(db.t.customer_feedback).includes(ask.message.split('t=')[1]));
  const again = await runRevive(db, CC, { now: new Date(NOW.getTime() + 2 * 86400000), canSend: { email: true }, business: 'Crystal Clear' });
  check('nobody is asked twice', again.prepared === 0);
  const token = ask.message.split('t=')[1];
  const found = await journeyForRatingLink(db, token);
  check('the link finds exactly that job; a wrong one finds nothing', found?.j.id === a.id && !(await journeyForRatingLink(db, 'f'.repeat(48))));
  check('a second link is never made for a job already asked', (await newRatingLink(db, await fresh(db, a.id))) === null);
  const late = await runRevive(db, CC, { now: new Date(NOW.getTime() + 30 * 86400000), canSend: { email: true } });
  check('jobs finished more than two weeks ago are not chased for a rating', late.outreach.every((o) => o.kind !== 'review_request'));
}

// ============ 3. HTTP: the customer's page and the rating link =============================
{
  const { db, slot } = await seed();
  process.env.SUPABASE_URL = 'https://db.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url)), table = u.pathname.replace('/rest/v1/', ''), f = {};
    for (const [k, v] of u.searchParams) if (!['order', 'limit'].includes(k)) f[k] = v === 'is.null' ? null : (v.slice(3) === 'true' ? true : v.slice(3) === 'false' ? false : decodeURIComponent(v.slice(3)));
    const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
    try {
      if (!init.method) return json(200, await db.select(table, f, { order: u.searchParams.get('order') || 'created_at.asc', limit: Number(u.searchParams.get('limit')) || 500 }));
      if (init.method === 'POST') return json(201, [await db.insert(table, JSON.parse(init.body))]);
      return json(200, await db.update(table, f, JSON.parse(init.body)));
    } catch (e) { return json(e.status || 500, {}); }
  };
  const deps = { requireStaff: async () => ({ id: 'u1', email: 'owner@example.invalid' }), requireOrgAccess: async () => true, sanitize: (v, n = 2000) => (typeof v === 'string' ? v.trim().slice(0, n) : ''), sanitizeEmail: (v) => v, rateLimit: () => true };
  const call = async (method, op, payload) => { const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(x) { this.body = x; return this; } }; await handleJourney({ method, query: method === 'GET' ? payload : {}, body: method === 'POST' ? payload : undefined }, res, op, deps); return res; };
  const j = await finishedJob(db, slot, 'Ivy', 'ivy@example.invalid');
  let r = await call('POST', 'status', { journey_id: j.id, token: j.token });
  check('the customer\'s own page asks how it went once the job is paid', r.code === 200 && r.body.next.stage === 'closed' && r.body.next.ask_rating === true);
  r = await call('POST', 'rate', { journey_id: j.id, token: j.token, rating: 4 });
  check('they rate it there', r.code === 200 && r.body.rating === 4 && !!r.body.review_url);
  r = await call('POST', 'status', { journey_id: j.id, token: j.token });
  check('and are not asked again', !r.body.next.ask_rating);
  const { db: db2, slot: s2 } = await seed();
  const k = await finishedJob(db2, s2, 'Jo', 'jo@example.invalid');
  const token = await newRatingLink(db2, await fresh(db2, k.id));
  const swap = db2; // the same stand-in, pointed at the second store
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url)), table = u.pathname.replace('/rest/v1/', ''), f = {};
    for (const [kk, v] of u.searchParams) if (!['order', 'limit'].includes(kk)) f[kk] = v === 'is.null' ? null : decodeURIComponent(v.slice(3));
    const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
    try {
      if (!init.method) return json(200, await swap.select(table, f, { order: u.searchParams.get('order') || 'created_at.asc', limit: Number(u.searchParams.get('limit')) || 500 }));
      if (init.method === 'POST') return json(201, [await swap.insert(table, JSON.parse(init.body))]);
      return json(200, await swap.update(table, f, JSON.parse(init.body)));
    } catch (e) { return json(e.status || 500, {}); }
  };
  r = await call('POST', 'rate-info', { t: token });
  check('the emailed link shows the business and the job', r.code === 200 && r.body.business === 'Crystal Clear' && r.body.service === 'Car detail' && r.body.already_rated === false);
  r = await call('POST', 'rate-link', { t: token, rating: 1, comment: 'Late and rushed' });
  check('a rating through the link works and a low one goes to the owner', r.code === 200 && db2.t.customer_feedback[0].follow_up === 'owner_to_call');
  r = await call('POST', 'rate-link', { t: 'e'.repeat(48), rating: 5 });
  check('a made-up link does nothing', r.code === 404);
  r = await call('GET', 'feedback', { organization_id: CC });
  check('the owner\'s Results tab lists it', r.code === 200 && r.body.feedback.length === 1 && r.body.feedback[0].comment === 'Late and rushed');
}

console.log(`\n${pass}/${pass + fail} review checks passed (in-memory store, test data — nothing sent, no review site contacted)`);
process.exit(fail ? 1 : 0);
