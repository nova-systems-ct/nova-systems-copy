// Aura 0.1: the morning brief. For one business, what happened since yesterday and what needs the
// owner today, counted from saved records only (no model, no estimate). The Aura screen asks for
// this for every business the person belongs to and shows them together.
import { receivables } from './_journey.js';

const DAY = 86400000;
const dollars = (cents) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'A customer';
const localDay = (iso, timeZone) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const clock = (iso, timeZone) => new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const WAITING = { price_needs_approval: 'a price to approve', terms_need_approval: 'agreement wording to approve', arrange_time: 'a time to arrange' };

export async function briefFor(db, orgId, { now = new Date(), timeZone = 'America/New_York' } = {}) {
  const [journeys, contacts, services, slots, feedback, outreach, events, docs, agent, org] = await Promise.all([
    db.select('journeys', { organization_id: orgId }, { limit: 2000 }),
    db.select('crm_contacts', { organization_id: orgId }, { limit: 5000 }),
    db.select('business_services', { organization_id: orgId }, { limit: 500 }),
    db.select('voice_calendar_slots', { organization_id: orgId, status: 'booked' }, { limit: 2000 }),
    db.select('customer_feedback', { organization_id: orgId, follow_up: 'owner_to_call' }, { limit: 200 }),
    db.select('revive_outreach', { organization_id: orgId, status: 'ready' }, { limit: 500 }),
    db.select('journey_events', { organization_id: orgId, action: 'card_payment_needs_review' }, { limit: 200 }),
    db.select('journey_documents', { organization_id: orgId, kind: 'receipt' }, { order: 'created_at.desc', limit: 500 }),
    db.select('business_agents', { organization_id: orgId }, { limit: 1 }).then((r) => r[0] || null),
    db.select('organizations', { id: orgId }, { limit: 1 }).then((r) => r[0] || null),
  ]);
  const who = (id) => firstName(contacts.find((c) => c.id === id)?.name);
  const what = (id) => services.find((s) => s.id === id)?.name || 'a job';
  const today = localDay(now, timeZone);
  const since = now.getTime() - DAY;

  const fresh = journeys.filter((j) => new Date(j.created_at).getTime() >= since);
  const waiting = journeys.filter((j) => j.waiting_on === 'owner' && !j.paused && !['closed', 'cancelled'].includes(j.stage));
  const jobs = journeys.filter((j) => j.stage === 'scheduled' && j.slot_id).map((j) => ({ j, slot: slots.find((s) => s.id === j.slot_id) }))
    .filter((x) => x.slot && localDay(x.slot.start_at, timeZone) === today).sort((a, b) => new Date(a.slot.start_at) - new Date(b.slot.start_at));
  const owed = await receivables(db, orgId, now);
  const collected = docs.filter((d) => new Date(d.created_at).getTime() >= since).reduce((n, d) => n + (d.amount_cents || 0), 0);
  const review = events.filter((e) => now - new Date(e.created_at) <= 7 * DAY);

  const out = {
    organization_id: orgId,
    business: agent?.business_name || org?.name || 'Your business',
    new_requests: fresh.map((j) => ({ journey_id: j.id, customer: who(j.contact_id), service: j.service_id ? what(j.service_id) : null })),
    needs_you: waiting.map((j) => ({ journey_id: j.id, customer: who(j.contact_id), service: what(j.service_id), reason: WAITING[j.waiting_reason] || 'a decision' })),
    jobs_today: jobs.map(({ j, slot }) => ({ journey_id: j.id, time: clock(slot.start_at, timeZone), customer: who(j.contact_id), service: what(j.service_id), address: j.service_address || null })),
    money: { collected_last_day_cents: collected, owed_cents: owed.total_cents, owed_invoices: owed.rows.length, oldest_days: owed.rows[0]?.days_outstanding ?? null },
    customers_to_call: feedback.map((f) => ({ customer: who(f.contact_id), rating: f.rating, comment: f.comment || null })),
    card_payments_to_check: review.length,
    come_back_messages_ready: outreach.length,
  };
  out.text = briefText(out);
  return out;
}

// The same brief in plain words. Every number here comes from the structure above.
export function briefText(b) {
  const lines = [`${b.business}:`];
  if (b.new_requests.length) lines.push(`${plural(b.new_requests.length, 'new request', 'new requests')} since yesterday (${b.new_requests.slice(0, 4).map((r) => `${r.customer}${r.service ? `, ${r.service}` : ''}`).join('; ')}${b.new_requests.length > 4 ? '; and more' : ''}).`);
  if (b.jobs_today.length) lines.push(`Today: ${b.jobs_today.map((x) => `${x.time} ${x.customer}, ${x.service}${x.address ? ` at ${x.address}` : ''}`).join('; ')}.`);
  if (b.needs_you.length) lines.push(`Waiting on you: ${b.needs_you.slice(0, 4).map((x) => `${x.customer} needs ${x.reason} (${x.service})`).join('; ')}${b.needs_you.length > 4 ? '; and more' : ''}.`);
  if (b.customers_to_call.length) lines.push(`Call ${b.customers_to_call.map((c) => `${c.customer} (rated ${c.rating} of 5)`).join(', ')}.`);
  if (b.card_payments_to_check) lines.push(`${plural(b.card_payments_to_check, 'card payment', 'card payments')} to check in Stripe.`);
  if (b.money.collected_last_day_cents) lines.push(`Collected ${dollars(b.money.collected_last_day_cents)} since yesterday.`);
  if (b.money.owed_cents) lines.push(`Owed to you: ${dollars(b.money.owed_cents)} on ${plural(b.money.owed_invoices, 'invoice', 'invoices')}${b.money.oldest_days ? `, the oldest ${plural(b.money.oldest_days, 'day', 'days')}` : ''}.`);
  if (b.come_back_messages_ready) lines.push(`${plural(b.come_back_messages_ready, 'come-back message is', 'come-back messages are')} ready to send.`);
  if (lines.length === 1) lines.push('Nothing new and nothing waiting on you.');
  return lines.join('\n');
}
