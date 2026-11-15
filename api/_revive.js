// Nova Revive: no customer goes cold.
//
// Three fixed rules decide WHO to reach and WHY:
//   overdue    — a past customer is past the normal return time for the service they had
//   cold_lead  — someone was sent a quote and has not answered (day 2, day 7, day 30, then stop)
//   empty_slot — an open time is coming up soon and overdue customers could fill it
//
// For each person the rule prepares one outreach: the reason, a real open time when there is
// one, the owner-approved offer when there is one, and the link that puts them straight back
// into the front desk. Whether a message may actually go out is decided here too:
//   - the customer must have agreed to that kind of contact and not opted out,
//   - `canSend` must be true for that channel (a connected, permitted account).
// Otherwise the outreach is saved as "blocked" with the reason. Nothing in this file sends.
const DAY = 86400000;
export const COLD_LEAD_DAYS = [2, 7, 30];
const offerUsable = (o, now) => !!o && o.approved === true && o.active === true && (!o.expires_at || new Date(o.expires_at) > now);
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';
const friendlyTime = (iso, tz = 'America/New_York') => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz }).format(new Date(iso));

// Which channel may this customer be contacted on? '' means none.
export function contactChannel(contact) {
  if (!contact || contact.do_not_contact) return '';
  if (contact.sms_consent && contact.phone) return 'sms';
  if (contact.email_consent && contact.email) return 'email';
  return '';
}

// Past customers who are overdue: their most recent finished job for a service that has a
// normal return time (business_services.return_days) is older than that, and they have nothing
// in progress now.
export async function findOverdue(db, orgId, now = new Date()) {
  const services = (await db.select('business_services', { organization_id: orgId, active: true })).filter((s) => Number.isInteger(s.return_days) && s.return_days > 0);
  if (!services.length) return [];
  const journeys = await db.select('journeys', { organization_id: orgId });
  const active = new Set(journeys.filter((j) => !['closed', 'cancelled'].includes(j.stage)).map((j) => j.contact_id));
  const latest = new Map(); // contact|service → most recent closed journey
  for (const j of journeys) {
    if (j.stage !== 'closed' || !j.closed_at || !j.service_id) continue;
    const key = `${j.contact_id}|${j.service_id}`;
    if (!latest.has(key) || latest.get(key).closed_at < j.closed_at) latest.set(key, j);
  }
  const out = [];
  for (const j of latest.values()) {
    const svc = services.find((s) => s.id === j.service_id);
    if (!svc || active.has(j.contact_id)) continue;
    const days = Math.floor((now - new Date(j.closed_at)) / DAY);
    if (days >= svc.return_days) out.push({ kind: 'overdue', contact_id: j.contact_id, service: svc, last_journey_id: j.id, days_since: days, days_overdue: days - svc.return_days, step: `overdue:${j.id}` });
  }
  return out.sort((a, b) => b.days_overdue - a.days_overdue);
}

// Quotes sent and not answered. Each lead gets at most one nudge per step (day 2, 7, 30).
export async function findColdLeads(db, orgId, now = new Date()) {
  const out = [];
  for (const j of (await db.select('journeys', { organization_id: orgId })).filter((x) => x.stage === 'quoted' && !x.paused)) {
    const quote = (await db.select('journey_documents', { journey_id: j.id, kind: 'quote' })).pop();
    if (!quote) continue;
    const days = Math.floor((now - new Date(quote.created_at)) / DAY);
    const step = [...COLD_LEAD_DAYS].reverse().find((d) => days >= d);
    if (step) out.push({ kind: 'cold_lead', contact_id: j.contact_id, journey_id: j.id, service_id: j.service_id, days_since: days, step: `cold:${j.id}:${step}` });
  }
  return out;
}

export function buildMessage({ kind, contact, business, service, slot, offer, link, timezone }) {
  const hi = `Hi ${firstName(contact.name)}, it's ${business}.`;
  const time = slot ? ` I have an opening ${friendlyTime(slot.start_at, timezone)}.` : '';
  const deal = offer ? ` Use code ${offer.code} for ${offer.percent_off}% off.` : '';
  const stop = ' Reply STOP to opt out.';
  if (kind === 'cold_lead') return `${hi} Your quote for ${service?.name || 'your request'} is still open.${time}${deal} Pick up where you left off: ${link}${stop}`;
  return `${hi} It's been a while since your last ${service?.name || 'visit'}.${time}${deal} Book here: ${link}${stop}`;
}

// Runs the rules for one business and saves one outreach per person per step. Safe to run as
// often as you like: a step that was already prepared is skipped.
//   canSend: { sms: boolean, email: boolean } — true only for channels with a connected account.
//   baseUrl: where the customer page lives, e.g. https://nova-systems.app
export async function runRevive(db, orgId, { now = new Date(), canSend = {}, baseUrl = 'https://nova-systems.app', business = 'us', timezone } = {}) {
  const targets = [...await findOverdue(db, orgId, now), ...await findColdLeads(db, orgId, now)];
  const openSlots = (await db.select('voice_calendar_slots', { organization_id: orgId, status: 'open' }, { order: 'start_at.asc', limit: 50 })).filter((s) => new Date(s.start_at) > now);
  const offers = (await db.select('business_offers', { organization_id: orgId, trigger_type: 'manual' })).filter((o) => offerUsable(o, now));
  const offer = offers[0] || null;
  const results = [];
  let slotIndex = 0;
  for (const t of targets) {
    const contact = (await db.select('crm_contacts', { id: t.contact_id, organization_id: orgId }, { limit: 1 }))[0];
    if (!contact) continue;
    const channel = contactChannel(contact);
    const service = t.service || (t.service_id ? (await db.select('business_services', { id: t.service_id, organization_id: orgId }, { limit: 1 }))[0] : null);
    // Offer each open time to one person at a time so two people are not promised the same slot.
    const slot = openSlots.length ? openSlots[slotIndex++ % openSlots.length] : null;
    const link = `${baseUrl}/start?org=${orgId}${offer && t.kind === 'overdue' ? `&code=${encodeURIComponent(offer.code)}` : ''}`;
    const usedOffer = t.kind === 'overdue' ? offer : null; // a cold lead already has a quote; no new discount is invented for it
    const status = !channel ? 'blocked' : canSend[channel] === true ? 'ready' : 'blocked';
    const reason = !channel ? (contact.do_not_contact ? 'customer_opted_out' : 'no_contact_permission') : status === 'blocked' ? 'channel_not_connected' : null;
    const row = {
      organization_id: orgId, contact_id: contact.id, journey_id: t.journey_id || null, kind: t.kind, service_id: service?.id || null,
      offer_id: usedOffer?.id || null, slot_id: slot?.id || null, channel: channel || null, status, blocked_reason: reason,
      message: buildMessage({ kind: t.kind, contact, business, service, slot, offer: usedOffer, link, timezone }),
      days_since: t.days_since, idempotency_key: `${orgId}:${t.step}`,
    };
    try { results.push(await db.insert('revive_outreach', row)); }
    catch (err) { if (err.status !== 409) throw err; } // this step was already prepared
  }
  return { prepared: results.length, ready: results.filter((r) => r.status === 'ready').length, blocked: results.filter((r) => r.status === 'blocked').length, outreach: results };
}

// Marks an outreach as sent after the caller has a real carrier or provider acceptance in hand.
export async function markSent(db, orgId, outreachId, providerReference) {
  if (!providerReference) throw Object.assign(new Error('A provider reference is required to mark an outreach sent.'), { expected: true, status: 422 });
  return (await db.update('revive_outreach', { id: outreachId, organization_id: orgId, status: 'ready' }, { status: 'sent', provider_reference: String(providerReference), sent_at: new Date().toISOString() }))[0] || null;
}

// Customers who came back AFTER an outreach that was really sent. An outreach that was blocked
// never reached anyone, so it is never credited with a return.
export async function recoveredCustomers(db, orgId, { from, to }) {
  const sent = (await db.select('revive_outreach', { organization_id: orgId, status: 'sent' }));
  const journeys = await db.select('journeys', { organization_id: orgId });
  const out = [];
  for (const o of sent) {
    const after = new Date(o.sent_at || o.created_at);
    const hit = o.kind === 'cold_lead'
      ? journeys.find((j) => j.id === o.journey_id && !['inquiry', 'qualified', 'quoted', 'cancelled'].includes(j.stage) && new Date(j.updated_at || j.created_at) > after)
      : journeys.find((j) => j.contact_id === o.contact_id && new Date(j.created_at) > after);
    if (!hit) continue;
    const when = new Date(o.kind === 'cold_lead' ? (hit.updated_at || hit.created_at) : hit.created_at);
    if (when >= from && when <= to) out.push({ outreach_id: o.id, journey_id: hit.id, kind: o.kind });
  }
  return out;
}
