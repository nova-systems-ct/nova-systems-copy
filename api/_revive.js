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

// Which channel may this customer be contacted on? '' means none. When `canSend` is given, a
// channel the customer agreed to AND that can actually send right now is preferred.
export function contactChannel(contact, canSend = null) {
  if (!contact || contact.do_not_contact) return '';
  const sms = !!(contact.sms_consent && contact.phone), email = !!(contact.email_consent && contact.email);
  if (canSend) { if (sms && canSend.sms === true) return 'sms'; if (email && canSend.email === true) return 'email'; }
  if (sms) return 'sms';
  if (email) return 'email';
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

// A text ends with how to stop; an email carries its unsubscribe link and the business's mailing
// address in the footer instead (see emailFooter).
const SMS_STOP = ' Reply STOP to opt out.';
export function buildMessage({ kind, contact, business, service, slot, offer, link, timezone, channel = 'sms' }) {
  const hi = `Hi ${firstName(contact.name)}, it's ${business}.`;
  const time = slot ? ` I have an opening ${friendlyTime(slot.start_at, timezone)}.` : '';
  const deal = offer ? ` Use code ${offer.code} for ${offer.percent_off}% off.` : '';
  const stop = channel === 'email' ? '' : SMS_STOP;
  if (kind === 'cold_lead') return `${hi} Your quote for ${service?.name || 'your request'} is still open.${time}${deal} Pick up where you left off: ${link}${stop}`;
  if (kind === 'review_request') return `${hi} Thank you for choosing us for your ${service?.name || 'job'}. How did we do? Rate us from 1 to 5 here: ${link}${stop}`;
  return `${hi} It's been a while since your last ${service?.name || 'visit'}.${time}${deal} Book here: ${link}${stop}`;
}

// Finished, paid jobs from the last two weeks whose customer has not been asked how it went.
export async function findReviewRequests(db, orgId, now = new Date()) {
  const asked = new Set((await db.select('customer_feedback', { organization_id: orgId }, { limit: 5000 })).map((f) => f.journey_id));
  return (await db.select('journeys', { organization_id: orgId }))
    .filter((j) => j.stage === 'closed' && j.paid_cents > 0 && j.closed_at && !asked.has(j.id) && now - new Date(j.closed_at) <= 14 * DAY)
    .map((j) => ({ kind: 'review_request', contact_id: j.contact_id, journey_id: j.id, service_id: j.service_id, days_since: Math.floor((now - new Date(j.closed_at)) / DAY), step: `review:${j.id}`, journey: j }));
}

// Runs the rules for one business and saves one outreach per person per step. Safe to run as
// often as you like: a step that was already prepared is skipped.
//   canSend: { sms: boolean, email: boolean } — true only for channels with a connected account.
//   baseUrl: where the customer page lives, e.g. https://nova-systems.app
export async function runRevive(db, orgId, { now = new Date(), canSend = {}, baseUrl = 'https://nova-systems.app', business = 'us', timezone } = {}) {
  const targets = [...await findOverdue(db, orgId, now), ...await findColdLeads(db, orgId, now), ...await findReviewRequests(db, orgId, now)];
  const openSlots = (await db.select('voice_calendar_slots', { organization_id: orgId, status: 'open' }, { order: 'start_at.asc', limit: 50 })).filter((s) => new Date(s.start_at) > now);
  const offers = (await db.select('business_offers', { organization_id: orgId, trigger_type: 'manual' })).filter((o) => offerUsable(o, now));
  const offer = offers[0] || null;
  const results = [];
  let slotIndex = 0;
  for (const t of targets) {
    const contact = (await db.select('crm_contacts', { id: t.contact_id, organization_id: orgId }, { limit: 1 }))[0];
    if (!contact) continue;
    const channel = contactChannel(contact, canSend);
    const service = t.service || (t.service_id ? (await db.select('business_services', { id: t.service_id, organization_id: orgId }, { limit: 1 }))[0] : null);
    if (t.kind === 'review_request') {
      // Asked only of customers who agreed to be contacted; the private rating link is made once.
      if (!channel) continue;
      const { newRatingLink } = await import('./_reviews.js');
      const token = await newRatingLink(db, t.journey);
      if (!token) continue;
      const status = canSend[channel] === true ? 'ready' : 'blocked';
      const row = { organization_id: orgId, contact_id: contact.id, journey_id: t.journey_id, kind: 'review_request', service_id: service?.id || null, offer_id: null, slot_id: null, channel, status, blocked_reason: status === 'blocked' ? 'channel_not_connected' : null, message: buildMessage({ kind: 'review_request', contact, business, service, link: `${baseUrl}/rate?t=${token}`, channel }), days_since: t.days_since, idempotency_key: `${orgId}:${t.step}` };
      try { results.push(await db.insert('revive_outreach', row)); } catch (err) { if (err.status !== 409) throw err; }
      continue;
    }
    // Offer each open time to one person at a time so two people are not promised the same slot.
    const slot = openSlots.length ? openSlots[slotIndex++ % openSlots.length] : null;
    const link = `${baseUrl}/start?org=${orgId}${offer && t.kind === 'overdue' ? `&code=${encodeURIComponent(offer.code)}` : ''}`;
    const usedOffer = t.kind === 'overdue' ? offer : null; // a cold lead already has a quote; no new discount is invented for it
    const status = !channel ? 'blocked' : canSend[channel] === true ? 'ready' : 'blocked';
    const reason = !channel ? (contact.do_not_contact ? 'customer_opted_out' : 'no_contact_permission') : status === 'blocked' ? 'channel_not_connected' : null;
    const row = {
      organization_id: orgId, contact_id: contact.id, journey_id: t.journey_id || null, kind: t.kind, service_id: service?.id || null,
      offer_id: usedOffer?.id || null, slot_id: slot?.id || null, channel: channel || null, status, blocked_reason: reason,
      message: buildMessage({ kind: t.kind, contact, business, service, slot, offer: usedOffer, link, timezone, channel: channel || 'sms' }),
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

// ---- sending (system 20) ------------------------------------------------------------------
// The owner presses "Send" in the Business desk; that press is the approval for the batch.
// Every message is checked again at the moment of sending (the customer may have opted out
// since it was prepared) and is marked 'sent' only with the provider's own reference.

const fail = (code, message, status = 409) => Object.assign(new Error(message), { code, status, expected: true });
const sameDay = (iso, now) => !!iso && now - new Date(iso) < DAY;

// Messages saved as "not sent" only because no channel was connected become ready once one is.
export async function reopenBlocked(db, orgId, canSend) {
  let reopened = 0;
  for (const o of await db.select('revive_outreach', { organization_id: orgId, status: 'blocked', blocked_reason: 'channel_not_connected' })) {
    const contact = (await db.select('crm_contacts', { id: o.contact_id, organization_id: orgId }, { limit: 1 }))[0];
    const channel = contactChannel(contact, canSend);
    if (!channel || canSend[channel] !== true) continue;
    const base = o.message.endsWith(SMS_STOP) ? o.message.slice(0, -SMS_STOP.length) : o.message;
    await db.update('revive_outreach', { id: o.id, organization_id: orgId, status: 'blocked' }, { status: 'ready', channel, blocked_reason: null, message: channel === 'sms' ? base + SMS_STOP : base });
    reopened++;
  }
  return reopened;
}

// Each contact gets one random, unguessable token for the unsubscribe link in emails.
async function unsubscribeLink(db, orgId, contact, appBase) {
  let token = contact.unsubscribe_token;
  if (!token) {
    token = (await import('node:crypto')).randomBytes(24).toString('hex');
    await db.update('crm_contacts', { id: contact.id, organization_id: orgId }, { unsubscribe_token: token });
  }
  return `${appBase}/api/client?resource=journey&op=unsubscribe&t=${token}`;
}

export function emailFooter({ business, mailingAddress, unsubscribeUrl }) {
  return `\n\n--\n${business}\n${mailingAddress}\nYou are getting this because you are a customer of ${business}. To stop these emails: ${unsubscribeUrl}`;
}

// Sends the ready come-back messages for one business by email.
//   agent:  the business's business_agents row (email_enabled, reply_email, mailing_address)
//   send:   (message) => { ok, id } — the email provider
//   caps:   { perBusiness, total } emails per day
export async function sendReady(db, orgId, { agent, send, caps, appBase, now = new Date(), countSentToday }) {
  if (!agent || agent.email_enabled !== true) throw fail('email_not_enabled', 'Turn on email for this business in the Assistant tab first.');
  if (!String(agent.mailing_address || '').trim()) throw fail('mailing_address_required', 'Add the business mailing address in the Assistant tab. US law requires it in marketing emails.', 422);
  const business = agent.business_name || 'Your local business';
  const sentByUs = (await db.select('revive_outreach', { organization_id: orgId, status: 'sent' })).filter((o) => sameDay(o.sent_at, now)).length;
  let room = Math.min(caps.perBusiness - sentByUs, caps.total - await countSentToday());
  const out = { sent: 0, held: 0, failed: 0, waiting_for_tomorrow: 0, errors: [] };
  for (const o of await db.select('revive_outreach', { organization_id: orgId, status: 'ready' }, { order: 'created_at.asc', limit: 200 })) {
    if (o.channel !== 'email') continue; // texting waits on carrier approval; those stay ready
    const contact = (await db.select('crm_contacts', { id: o.contact_id, organization_id: orgId }, { limit: 1 }))[0];
    if (!contact || contact.do_not_contact || !contact.email_consent || !contact.email) {
      await db.update('revive_outreach', { id: o.id, organization_id: orgId, status: 'ready' }, { status: 'blocked', blocked_reason: contact?.do_not_contact ? 'customer_opted_out' : 'no_contact_permission' });
      out.held++; continue;
    }
    if (room <= 0) { out.waiting_for_tomorrow++; continue; }
    const url = await unsubscribeLink(db, orgId, contact, appBase);
    const subject = o.kind === 'cold_lead' ? `${business}: your quote is still open` : o.kind === 'review_request' ? `${business}: how did we do?` : `${business}: time for your next visit`;
    const r = await send({ to: contact.email, subject, text: o.message + emailFooter({ business, mailingAddress: agent.mailing_address.trim(), unsubscribeUrl: url }), fromName: business, replyTo: agent.reply_email, headers: { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }, idempotencyKey: `revive:${o.id}` });
    if (r.ok && r.id) { await markSent(db, orgId, o.id, `email:${r.id}`); out.sent++; room--; }
    else { out.failed++; out.errors.push({ outreach_id: o.id, error: r.error || 'not accepted' }); } // stays ready; try again later
  }
  return out;
}

// The customer pressed the unsubscribe link. Opt-out always wins, for every channel.
export async function unsubscribe(db, token) {
  if (!/^[0-9a-f]{48}$/.test(String(token || ''))) return false;
  const contact = (await db.select('crm_contacts', { unsubscribe_token: token }, { limit: 1 }))[0];
  if (!contact) return false;
  await db.update('crm_contacts', { id: contact.id, organization_id: contact.organization_id }, { do_not_contact: true, email_consent: false });
  for (const o of await db.select('revive_outreach', { organization_id: contact.organization_id, contact_id: contact.id, status: 'ready' })) {
    await db.update('revive_outreach', { id: o.id, organization_id: contact.organization_id, status: 'ready' }, { status: 'blocked', blocked_reason: 'customer_opted_out' });
  }
  return true;
}
