// Nova Audit customer-style tests, Nova Revive, Nova Proof and the industry packs.
// In-memory store with the migration's unique rules. No database, provider or channel is
// contacted and nothing is sent. Prices and customers here are TEST FIXTURES.
import crypto from 'node:crypto';
import { detectPaidTools, paidToolsEvidence, customerTestToEvidence, leakEstimate } from '../api/_auditTests.js';
import { validateFinding } from '../api/_auditRules.js';
import { findOverdue, findColdLeads, runRevive, markSent, contactChannel, buildMessage } from '../api/_revive.js';
import { scorecard, scorecardText } from '../api/_proof.js';
import { INDUSTRY_PACKS, applyPack } from '../api/_industryPacks.js';
import { startJourney, acceptQuote, chooseSlot, completeWork, recordPayment, handleChannelTrigger, chooseService } from '../api/_journey.js';

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const T0 = new Date('2026-11-02T15:00:00Z');
const UNIQUE = { journeys: ['organization_id', 'source_channel', 'source_event_id'], journey_events: ['idempotency_key'], journey_documents: ['journey_id', 'kind', 'seq'], business_services: ['organization_id', 'name'], revive_outreach: ['idempotency_key'] };
let clock = T0;
function memoryDb() {
  const t = {}; const rows = (n) => (t[n] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : r[k] === v));
  return { t,
    select: async (n, f = {}, { order = 'created_at.asc', limit = 500 } = {}) => { const [c, d] = order.split('.'); return rows(n).filter((r) => hit(r, f)).sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : a._n - b._n) * (d === 'desc' ? -1 : 1)).slice(0, limit).map((r) => ({ ...r })); },
    insert: async (n, row) => { const u = UNIQUE[n]; if (u && rows(n).some((r) => u.every((k) => r[k] === row[k]))) throw Object.assign(new Error('conflict'), { status: 409 }); const full = { id: crypto.randomUUID(), created_at: new Date(clock.getTime() + rows(n).length).toISOString(), _n: rows(n).length, ...row }; rows(n).push(full); return { ...full }; },
    update: async (n, f, p) => rows(n).filter((r) => hit(r, f)).map((r) => ({ ...Object.assign(r, p) })),
  };
}
const days = (n) => new Date(T0.getTime() + n * 86400000);
const fresh = async (db, id) => (await db.select('journeys', { id }))[0];
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };

// ============ Audit: paid tools and customer-style tests ====================================
{
  const html = '<script src="https://connect.facebook.net/en_US/fbevents.js"></script><script>gtag("config","AW-123")</script><script src="//js.hs-scripts.com/1.js"></script><script src="https://cdn.callrail.com/x.js"></script>';
  const tools = detectPaidTools(html);
  check('the page scan finds the ad, marketing and call-tracking tools a site loads', ['Meta Pixel', 'Google Ads tag', 'HubSpot', 'CallRail'].every((n) => tools.some((t) => t.name === n)));
  const ev = paidToolsEvidence(tools, 'https://shop.example/', '2026-11-02T15:00:00Z');
  check('it records them as loaded, and says it cannot tell whether they are paying off', /does not show what the business pays/.test(ev.observation) && ev.confidence === 'medium');
  check('a page with no known tools produces no evidence at all', paidToolsEvidence(detectPaidTools('<p>hello</p>'), 'u', 't') === null);

  const good = customerTestToEvidence({ kind: 'phone_after_hours', performed_at: '2026-11-03T00:04:00Z', performed_by: 'Isaac Nova', target: '(860) 555-0100', responded: false, response_time: 45, notes: 'Rang out, no voicemail.' }, days(2));
  check('a missed after-hours call becomes first-hand evidence with who, when and what happened', good.record && good.record.method === 'customer_style_test:phone_after_hours' && /Isaac Nova called the listed phone number outside posted opening hours/.test(good.record.observation) && / No response was received within 45 seconds/.test(good.record.observation) && good.record.source_quality === 'high');
  check('the evidence says one test is not a pattern', /does not by itself show how the business usually responds/.test(good.record.observation));
  check('a test dated in the future is refused', !!customerTestToEvidence({ kind: 'web_form', performed_at: '2030-01-01T00:00:00Z', performed_by: 'X Y', target: 'site', responded: false }, days(0)).error);
  check('a test with nobody named as the tester is refused', !!customerTestToEvidence({ kind: 'web_form', performed_at: T0.toISOString(), performed_by: '', target: 'site', responded: false }, days(1)).error);
  check('"they responded" without saying how long it took is refused', !!customerTestToEvidence({ kind: 'web_form', performed_at: T0.toISOString(), performed_by: 'Isaac', target: 'site form', responded: true }, days(1)).error);
  check('an unknown kind of test is refused', !!customerTestToEvidence({ kind: 'hack_their_wifi', performed_at: T0.toISOString(), performed_by: 'Isaac', target: 'x y z', responded: false }, days(1)).error);

  const est = leakEstimate({ inquiriesPerWeek: 20, avgJobCents: 30000, closeRatePct: 40, testsRun: 5, testsUnanswered: 2 });
  check('with five tests and the owner\'s three numbers the audit gives a dollar range, not one number', est.estimate_low === 2078 && est.estimate_high === 4157 && est.estimate_low < est.estimate_high);
  check('the range states every assumption, including the small sample', /2 of 5 customer-style tests/.test(est.estimate_assumptions) && /small sample/.test(est.estimate_assumptions) && /will not always be true/.test(est.estimate_assumptions));
  check('that range passes the audit\'s existing rules for an estimate finding', validateFinding({ statement_type: 'estimate', title: 'Unanswered inquiries', detail: 'Two of five test inquiries received no response.', ...est }, 2).length === 0);
  check('with fewer than three tests it refuses to name a figure', !!leakEstimate({ inquiriesPerWeek: 20, avgJobCents: 30000, closeRatePct: 40, testsRun: 2, testsUnanswered: 2 }).refused);
  check('without the owner\'s numbers it refuses to name a figure', !!leakEstimate({ testsRun: 5, testsUnanswered: 2 }).refused);
  check('when every test was answered there is no loss to estimate', !!leakEstimate({ inquiriesPerWeek: 20, avgJobCents: 30000, closeRatePct: 40, testsRun: 5, testsUnanswered: 0 }).refused);
}

// ============ A small barbershop with history ==============================================
async function shop() {
  clock = T0; const db = memoryDb();
  await applyPack(db, ORG, 'barbershop');
  const cut = db.t.business_services.find((s) => s.name === 'Haircut');
  Object.assign(cut, { price_cents: 3000, price_approved: true });
  await db.insert('business_offers', { organization_id: ORG, trigger_type: 'manual', channel: null, code: 'BACK5', description: '5% off', percent_off: 5, approved: true, active: true, expires_at: null });
  await db.insert('business_offers', { organization_id: ORG, trigger_type: 'social_comment', channel: null, code: 'OPEN5', description: '5% off', percent_off: 5, approved: true, active: true, expires_at: null });
  const slot = async (d) => db.insert('voice_calendar_slots', { organization_id: ORG, service_name: 'Cut', start_at: days(d).toISOString(), end_at: days(d).toISOString(), status: 'open' });
  // A finished visit for one customer, start to paid.
  const visit = async (name, extra = {}) => {
    const s = await startJourney(db, { orgId: ORG, channel: 'web', eventId: crypto.randomUUID(), name, email: `${name}@example.invalid`, phone: null, text: 'need a haircut', now: clock });
    Object.assign(db.t.crm_contacts.find((c) => c.id === s.journey.contact_id), extra);
    await acceptQuote(db, await fresh(db, s.journey.id), { quoteId: s.next.quote.id, typedName: `${name} Test` }, { now: clock });
    const sl = await slot(0.01);
    await chooseSlot(db, await fresh(db, s.journey.id), sl.id, { now: clock });
    await completeWork(db, await fresh(db, s.journey.id), { note: 'Haircut done, customer happy.', by: 'barber' }, { now: clock });
    await recordPayment(db, await fresh(db, s.journey.id), { amountCents: 3000, source: 'owner_recorded', reference: `cash-${name}` }, { now: clock });
    return s.journey;
  };
  return { db, cut, slot, visit };
}

// ============ Industry packs ================================================================
{
  const { db } = await shop();
  check('a pack gives a new business its services in its own trade\'s words', db.t.business_services.length === 3 && db.t.business_services.some((s) => s.name === 'Beard trim' && s.return_days === 14));
  check('a pack never sets or approves a price', db.t.business_services.filter((s) => s.name !== 'Haircut').every((s) => s.price_cents === null && s.price_approved === false));
  const again = await applyPack(db, ORG, 'barbershop');
  check('applying the same pack twice adds nothing and leaves the owner\'s price alone', again.added.length === 0 && again.skipped.length === 3 && db.t.business_services.find((s) => s.name === 'Haircut').price_cents === 3000);
  check('no pack anywhere contains a price', !/\$|price_cents/.test(JSON.stringify(INDUSTRY_PACKS)));
  let threw = false; try { await applyPack(db, ORG, 'nope'); } catch (e) { threw = e.status === 422; }
  check('an unknown pack is refused', threw);
}

// ============ Revive ========================================================================
{
  const { db, slot, visit } = await shop();
  await visit('ana', { sms_consent: true, phone: '+12035550101' });  // may be texted
  await visit('ben', { email_consent: true });                      // may be emailed
  await visit('cy');                                                 // never agreed to contact
  await visit('dee', { sms_consent: true, phone: '+12035550104', do_not_contact: true }); // opted out
  check('right after a visit nobody is overdue', (await findOverdue(db, ORG, days(5))).length === 0);
  const overdue = await findOverdue(db, ORG, days(30));
  check('three weeks is the haircut return time, so at day 30 all four are overdue', overdue.length === 4 && overdue.every((o) => o.days_overdue === 9 && o.service.name === 'Haircut'));
  check('another business sees none of them', (await findOverdue(db, OTHER, days(30))).length === 0);
  check('contact rules: text only with text consent, email only with email consent, never after opt-out', contactChannel({ sms_consent: true, phone: '+1' }) === 'sms' && contactChannel({ email_consent: true, email: 'a@b.c' }) === 'email' && contactChannel({ phone: '+1', email: 'a@b.c' }) === '' && contactChannel({ sms_consent: true, phone: '+1', do_not_contact: true }) === '');

  clock = days(30); await slot(31);
  let run = await runRevive(db, ORG, { now: days(30), canSend: { sms: true }, business: 'Fade Factory', timezone: 'America/New_York' });
  const by = (email) => db.t.revive_outreach.find((o) => o.contact_id === db.t.crm_contacts.find((c) => c.email === email).id);
  check('the customer who agreed to texts gets a ready message', by('ana@example.invalid').status === 'ready' && by('ana@example.invalid').channel === 'sms');
  check('the message names the business, a real opening, the approved offer and how to stop', /Hi ana, it's Fade Factory/.test(by('ana@example.invalid').message) && /I have an opening/.test(by('ana@example.invalid').message) && /BACK5 for 5% off/.test(by('ana@example.invalid').message) && /code=BACK5/.test(by('ana@example.invalid').message) && /Reply STOP/.test(by('ana@example.invalid').message));
  check('email is not connected, so that customer\'s message is saved as not sent', by('ben@example.invalid').status === 'blocked' && by('ben@example.invalid').blocked_reason === 'channel_not_connected');
  check('a customer who never agreed to be contacted is not contacted', by('cy@example.invalid').status === 'blocked' && by('cy@example.invalid').blocked_reason === 'no_contact_permission');
  check('a customer who opted out is never contacted', by('dee@example.invalid').status === 'blocked' && by('dee@example.invalid').blocked_reason === 'customer_opted_out');
  check('the run reports what it did honestly', run.prepared === 4 && run.ready === 1 && run.blocked === 3);
  run = await runRevive(db, ORG, { now: days(31), canSend: { sms: true } });
  check('running it again the next day does not message anyone twice', run.prepared === 0 && db.t.revive_outreach.length === 4);
  const nothing = await runRevive(db, ORG, { now: days(31), canSend: {} });
  check('with no channel connected nothing can be marked ready', nothing.ready === 0);
  let refused = false; try { await markSent(db, ORG, by('ana@example.invalid').id, ''); } catch (e) { refused = e.status === 422; }
  check('an outreach cannot be marked sent without the provider\'s own reference', refused && by('ana@example.invalid').status === 'ready');
  await markSent(db, ORG, by('ana@example.invalid').id, 'SM123');
  check('with a reference it is marked sent', by('ana@example.invalid').status === 'sent' && by('ana@example.invalid').provider_reference === 'SM123');
  check('a blocked message can never be marked sent', (await markSent(db, ORG, by('cy@example.invalid').id, 'SM999')) === null && by('cy@example.invalid').status === 'blocked');

  // The customer comes back through the link.
  clock = days(32);
  const back = await startJourney(db, { orgId: ORG, channel: 'web', eventId: crypto.randomUUID(), name: 'ana', email: 'ana@example.invalid', text: 'haircut please', offerCode: 'BACK5', recoveryRef: by('ana@example.invalid').id, now: days(32) });
  check('she returns as the same customer with the discount on her quote', back.journey.contact_id === by('ana@example.invalid').contact_id && back.next.quote.total_cents === 2850);
  check('a customer with a visit in progress is no longer overdue', !(await findOverdue(db, ORG, days(33))).some((o) => o.contact_id === back.journey.contact_id));

  // A quote that goes quiet.
  const quiet = await startJourney(db, { orgId: ORG, channel: 'web', eventId: crypto.randomUUID(), name: 'eli', email: 'eli@example.invalid', text: 'haircut', now: days(32) });
  Object.assign(db.t.crm_contacts.find((c) => c.id === quiet.journey.contact_id), { email_consent: true });
  check('a one-day-old quote is not chased', (await findColdLeads(db, ORG, days(33))).filter((l) => l.journey_id === quiet.journey.id).length === 0);
  const d2 = (await findColdLeads(db, ORG, days(34.1))).find((l) => l.journey_id === quiet.journey.id);
  const d9 = (await findColdLeads(db, ORG, days(41.1))).find((l) => l.journey_id === quiet.journey.id);
  check('it is chased at day 2 and again at day 7, as separate steps', d2?.step.endsWith(':2') && d9?.step.endsWith(':7'));
  clock = days(41.1);
  await runRevive(db, ORG, { now: days(41.1), canSend: { email: true }, business: 'Fade Factory' });
  const nudge = db.t.revive_outreach.find((o) => o.kind === 'cold_lead' && o.journey_id === quiet.journey.id);
  check('the nudge points at the open quote and invents no new discount', nudge.status === 'ready' && /quote for Haircut is still open/.test(nudge.message) && nudge.offer_id === null && !/% off/.test(nudge.message));
  check('message wording: an overdue note with no opening and no offer still reads cleanly', buildMessage({ kind: 'overdue', contact: { name: 'Sam Lee' }, business: 'Fade Factory', service: { name: 'Haircut' }, slot: null, offer: null, link: 'L' }) === "Hi Sam, it's Fade Factory. It's been a while since your last Haircut. Book here: L Reply STOP to opt out.");

  // ============ Proof ======================================================================
  clock = days(33);
  const t = await handleChannelTrigger(db, { orgId: ORG, channel: 'instagram', type: 'social_comment', eventId: 'c1', handle: '@newguy', canSend: false, now: days(33) });
  await chooseService(db, await fresh(db, t.journey.id), db.t.business_services.find((s) => s.name === 'Haircut').id, { now: days(33) });
  // ben's message was blocked (email not connected). He happens to come back on his own.
  clock = days(40);
  await startJourney(db, { orgId: ORG, channel: 'web', eventId: crypto.randomUUID(), name: 'ben', email: 'ben@example.invalid', text: 'haircut', now: days(40) });
  const first = await scorecard(db, ORG, { from: days(-1), to: days(1), now: days(1) });
  check('week one: four inquiries, four quotes accepted, four booked, four jobs done', first.inquiries.total === 4 && first.quotes.issued === 4 && first.quotes.accepted === 4 && first.appointments_booked === 4 && first.jobs_completed === 4);
  check('money is the sum of receipts, and all of it is labelled as entered by a person', first.money_collected.total_cents === 12000 && first.money_collected.entered_by_a_person_cents === 12000 && first.money_collected.provider_confirmed_cents === 0);
  check('with only four inquiries it says there is too little to judge a trend', first.enough_to_judge === false && /not enough activity/.test(scorecardText(first)));
  const later = await scorecard(db, ORG, { from: days(29), to: days(42), now: days(42) });
  check('later: inquiries are split by where they came from', later.inquiries.by_channel.web === 3 && later.inquiries.by_channel.instagram === 1);
  check('each offer shows how many customers it brought', later.offers.find((o) => o.code === 'OPEN5')?.customers === 1 && later.offers.find((o) => o.code === 'BACK5')?.customers === 1);
  check('Revive is counted honestly: prepared, sent, blocked and why', later.revive.prepared === 6 && later.revive.sent === 1 && later.revive.ready_to_send === 1 && later.revive.blocked === 4 && later.revive.blocked_reasons.no_contact_permission === 1 && later.revive.blocked_reasons.customer_opted_out === 1 && later.revive.blocked_reasons.channel_not_connected === 2);
  check('a customer whose message was never sent is not credited to Revive when he returns on his own', later.revive.customers_who_came_back === 1 && later.inquiries.total === 4);
  check('it flags the quotes nobody answered, oldest first', later.leaks.length >= 2 && later.leaks.every((l) => l.kind === 'quote_unanswered') && later.leaks[0].days >= later.leaks[1].days);
  const none = await scorecard(db, OTHER, { from: days(-1), to: days(42), now: days(42) });
  check('another business\'s scorecard is empty', none.inquiries.total === 0 && none.money_collected.total_cents === 0 && none.leaks.length === 0 && none.revive.prepared === 0);
  const text = scorecardText(later, 'Fade Factory');
  check('the plain-words summary uses only numbers from the scorecard', text.startsWith('Fade Factory: 4 new inquiries') && /Offer BACK5: 1 customer/.test(text) && /1 sent, 1 ready to send, 4 held back. 1 came back/.test(text) && /Needs attention: a quote has had no answer/.test(text));
}

console.log(`\n${pass}/${pass + fail} audit-test, Revive, Proof and pack checks passed (in-memory store, test data — nothing sent, no database or provider contacted)`);
process.exit(fail ? 1 : 0);
