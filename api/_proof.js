// Nova Proof: what Nova did for a business this week, counted from saved records.
//
// Every number here is a count or a sum of rows that already exist (journeys, their events and
// documents, Revive outreach). Nothing is estimated and nothing is blended into a score:
// inquiries, quotes, bookings, completed jobs and money are reported separately, and money a
// person typed in is kept apart from money a payment provider confirmed.
import { receivables } from './_journey.js';
import { recoveredCustomers } from './_revive.js';

const DAY = 86400000;
const within = (iso, from, to) => { const t = new Date(iso); return t >= from && t <= to; };
const dollars = (cents) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function scorecard(db, orgId, { from, to, now = new Date() }) {
  const journeys = await db.select('journeys', { organization_id: orgId });
  const events = await db.select('journey_events', { organization_id: orgId });
  const documents = await db.select('journey_documents', { organization_id: orgId });
  const offers = await db.select('business_offers', { organization_id: orgId });
  const outreach = await db.select('revive_outreach', { organization_id: orgId });
  const slots = await db.select('voice_calendar_slots', { organization_id: orgId });
  const byId = new Map(journeys.map((j) => [j.id, j]));

  const started = journeys.filter((j) => within(j.created_at, from, to));
  const count = (list, key) => list.reduce((m, x) => { const k = key(x); m[k] = (m[k] || 0) + 1; return m; }, {});
  const receipts = documents.filter((d) => d.kind === 'receipt' && within(d.created_at, from, to));
  const sum = (list) => list.reduce((n, d) => n + (d.amount_cents || 0), 0);
  const progressed = (j) => !['inquiry', 'qualified', 'quoted', 'cancelled'].includes(j.stage);

  const byOffer = offers.map((o) => {
    const mine = started.filter((j) => j.offer_id === o.id);
    return { code: o.code, description: o.description, customers: mine.length, accepted: mine.filter(progressed).length };
  }).filter((o) => o.customers > 0);

  // Things that are stuck right now. Each is a fixed check over live records.
  const leaks = [];
  for (const j of journeys) {
    if (j.paused || ['closed', 'cancelled'].includes(j.stage)) continue;
    const age = (iso) => Math.floor((now - new Date(iso)) / DAY);
    if (j.stage === 'quoted') { const q = documents.filter((d) => d.journey_id === j.id && d.kind === 'quote').pop(); if (q && age(q.created_at) >= 2) leaks.push({ kind: 'quote_unanswered', journey_id: j.id, days: age(q.created_at), what: 'A quote has had no answer' }); }
    if (j.waiting_on === 'owner' && age(j.updated_at || j.created_at) >= 1) leaks.push({ kind: 'waiting_on_owner', journey_id: j.id, days: age(j.updated_at || j.created_at), what: j.waiting_reason === 'price_needs_approval' ? 'A customer is waiting because a price has not been approved' : 'A customer is waiting on an owner decision' });
    if (j.stage === 'scheduled' && j.slot_id) { const s = slots.find((x) => x.id === j.slot_id); if (s && age(s.end_at) >= 1) leaks.push({ kind: 'job_not_closed_out', journey_id: j.id, days: age(s.end_at), what: 'An appointment has passed and the work has not been marked done' }); }
    if (['deposit_due', 'balance_due'].includes(j.stage)) { const inv = documents.filter((d) => d.journey_id === j.id && d.kind === (j.stage === 'deposit_due' ? 'deposit_invoice' : 'balance_invoice')).pop(); if (inv && inv.status === 'issued' && age(inv.created_at) >= 7) leaks.push({ kind: 'invoice_overdue', journey_id: j.id, days: age(inv.created_at), what: 'An invoice has been unpaid for a week or more' }); }
  }

  const owed = await receivables(db, orgId, now);
  const recovered = await recoveredCustomers(db, orgId, { from, to });
  const windowOutreach = outreach.filter((o) => within(o.created_at, from, to));

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    inquiries: { total: started.length, by_channel: count(started, (j) => j.source_channel) },
    quotes: { issued: documents.filter((d) => d.kind === 'quote' && within(d.created_at, from, to)).length, accepted: documents.filter((d) => d.kind === 'quote' && d.accepted_at && within(d.accepted_at, from, to)).length },
    appointments_booked: events.filter((e) => e.action === 'appointment_booked' && within(e.created_at, from, to)).length,
    jobs_completed: documents.filter((d) => d.kind === 'completion' && within(d.created_at, from, to)).length,
    money_collected: {
      total_cents: sum(receipts),
      provider_confirmed_cents: sum(receipts.filter((r) => r.payment_source === 'provider_verified')),
      entered_by_a_person_cents: sum(receipts.filter((r) => r.payment_source !== 'provider_verified')),
    },
    money_owed_now: { total_cents: owed.total_cents, invoices: owed.rows.length },
    offers: byOffer,
    revive: { prepared: windowOutreach.length, sent: windowOutreach.filter((o) => o.status === 'sent').length, ready_to_send: windowOutreach.filter((o) => o.status === 'ready').length, blocked: windowOutreach.filter((o) => o.status === 'blocked').length, blocked_reasons: count(windowOutreach.filter((o) => o.status === 'blocked'), (o) => o.blocked_reason), customers_who_came_back: recovered.length },
    waiting_now: count(journeys.filter((j) => !['closed', 'cancelled'].includes(j.stage) && j.waiting_on), (j) => j.waiting_on),
    leaks: leaks.sort((a, b) => b.days - a.days),
    // With very little activity the numbers are real but say nothing about a trend.
    enough_to_judge: started.length >= 5,
    _journeys: byId.size,
  };
}

// The same numbers in plain words, for a text or an email to the owner. No number appears here
// that is not in the scorecard.
export function scorecardText(card, business = 'Your business') {
  const m = card.money_collected;
  const lines = [
    `${business}: ${card.inquiries.total} new ${card.inquiries.total === 1 ? 'inquiry' : 'inquiries'}, ${card.quotes.issued} quoted, ${card.quotes.accepted} accepted, ${card.appointments_booked} booked, ${card.jobs_completed} ${card.jobs_completed === 1 ? 'job' : 'jobs'} finished.`,
    `Collected ${dollars(m.total_cents)}${m.total_cents ? ` (${dollars(m.provider_confirmed_cents)} confirmed by the payment provider, ${dollars(m.entered_by_a_person_cents)} entered by a person)` : ''}. Still owed: ${dollars(card.money_owed_now.total_cents)} across ${card.money_owed_now.invoices} ${card.money_owed_now.invoices === 1 ? 'invoice' : 'invoices'}.`,
  ];
  const channels = Object.entries(card.inquiries.by_channel).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(', ');
  if (channels) lines.push(`Where they came from: ${channels}.`);
  for (const o of card.offers) lines.push(`Offer ${o.code}: ${o.customers} ${o.customers === 1 ? 'customer' : 'customers'}, ${o.accepted} accepted a quote.`);
  if (card.revive.prepared) lines.push(`Revive prepared ${card.revive.prepared} come-back ${card.revive.prepared === 1 ? 'message' : 'messages'}: ${card.revive.sent} sent, ${card.revive.ready_to_send} ready to send, ${card.revive.blocked} held back. ${card.revive.customers_who_came_back} came back.`);
  if (card.leaks.length) lines.push(`Needs attention: ${card.leaks.slice(0, 5).map((l) => `${l.what.toLowerCase()} (${l.days} ${l.days === 1 ? 'day' : 'days'})`).join('; ')}.`);
  if (!card.enough_to_judge) lines.push('There is not enough activity yet to say whether things are improving.');
  return lines.join('\n');
}

// ---- sending (system 23) ------------------------------------------------------------------
// The week's scorecard, emailed to the owner. Sent at most once per business per day (the
// weekly schedule and a manual "email me this" share the same record), and recorded only after
// the email provider accepted it.
export async function sendScorecard(db, orgId, { to, business, send, now = new Date(), days = 7 }) {
  const from = new Date(now.getTime() - days * DAY);
  const periodStart = now.toISOString().slice(0, 10);
  if ((await db.select('scorecard_sends', { organization_id: orgId, period_start: periodStart }, { limit: 1 })).length) return { sent: false, reason: 'already_sent_today' };
  const card = await scorecard(db, orgId, { from, to: now, now });
  const text = `${scorecardText(card, business)}\n\nThe last ${days} days, counted from your saved records. Payments you typed in are counted separately from payments confirmed by a payment provider.\n\nNova Systems`;
  const r = await send({ to, subject: `${business}: your last ${days} days`, text, fromName: 'Nova Systems', idempotencyKey: `scorecard:${orgId}:${periodStart}` });
  if (!r.ok || !r.id) return { sent: false, reason: 'not_accepted', error: r.error || 'not accepted' };
  try { await db.insert('scorecard_sends', { organization_id: orgId, period_start: periodStart, period_end: now.toISOString(), sent_to: to, provider_reference: `email:${r.id}` }); }
  catch (err) { if (err.status !== 409) throw err; }
  return { sent: true, provider_reference: `email:${r.id}`, scorecard: card };
}
