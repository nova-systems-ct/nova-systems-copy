// The four agents that take one customer of a client business from first contact to a closed job.
//
//   front_desk  — takes the inquiry, works out which service is wanted, books the time
//   contracts   — issues the quote from an owner-approved price, records the agreement
//   accounting  — issues invoices, records confirmed payments, issues receipts
//   finance     — follows up, lists what is still owed, writes the owner's report
//
// Every step is a fixed rule over saved records. No model is called here and nothing is sent to
// a paid provider: a step either completes and leaves a record, or it stops and says exactly who
// it is waiting for (the customer, the owner, a staff member). The agents never invent a price,
// a discount, agreement wording or a payment.
//
// Storage goes through a small `db` object ({select, insert, update}) so the same rules run
// against PostgREST in production (restDb) and an in-memory stand-in in tests.
import crypto from 'node:crypto';
import { normalizePhone } from './_wave1.js';
import { findOverdue, findColdLeads, runRevive, reopenBlocked, sendReady, unsubscribe } from './_revive.js';
import { scorecard, scorecardText, sendScorecard } from './_proof.js';
import { emailSwitch, emailCaps, sendEmail, validEmail } from './_email.js';
import { INDUSTRY_PACKS, applyPack } from './_industryPacks.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[0-9a-f]{64}$/;
export const money = (cents) => `$${(cents / 100).toFixed(2)}`;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const fail = (code, message, status = 409) => Object.assign(new Error(message), { code, status, expected: true });

export function restDb() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('storage_unavailable');
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  // A filter value is matched exactly; null means "is empty"; { gte: x } means "at least x".
  const qs = (filter, extra = '') => Object.entries(filter).map(([k, v]) => `${k}=${v === null ? 'is.null' : v && typeof v === 'object' && 'gte' in v ? 'gte.' + encodeURIComponent(v.gte) : 'eq.' + encodeURIComponent(v)}`).join('&') + extra;
  const call = async (path, init) => {
    const r = await fetch(`${url}/rest/v1/${path}`, { ...init, headers });
    if (!r.ok) throw Object.assign(new Error('storage_unavailable'), { status: r.status });
    return r.json();
  };
  return {
    select: (table, filter = {}, { order = 'created_at.asc', limit = 500 } = {}) => call(`${table}?${qs(filter, `&order=${order}&limit=${limit}`)}`, {}),
    insert: async (table, row) => (await call(table, { method: 'POST', body: JSON.stringify(row) }))[0],
    update: (table, filter, patch) => call(`${table}?${qs(filter)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  };
}

// ---- small helpers -------------------------------------------------------------------------

// Records one step. The idempotency key makes a repeated step a no-op; returns false if it was
// already recorded.
export const recordStep = (db, j, e) => record(db, j, e);
async function record(db, j, e) {
  try {
    await db.insert('journey_events', { organization_id: j.organization_id, journey_id: j.id, agent: e.agent, handed_to: e.handed_to || null, action: e.action, status: e.status || 'done', detail: e.detail || {}, idempotency_key: `${j.id}:${e.key || e.action}` });
    return true;
  } catch (err) { if (err.status === 409) return false; throw err; }
}
async function setJourney(db, j, patch) {
  const rows = await db.update('journeys', { id: j.id, organization_id: j.organization_id }, { ...patch, updated_at: new Date().toISOString() });
  return Object.assign(j, rows[0] || patch);
}
async function addDocument(db, j, doc) {
  const existing = await db.select('journey_documents', { journey_id: j.id, kind: doc.kind });
  try { return await db.insert('journey_documents', { organization_id: j.organization_id, journey_id: j.id, seq: existing.length + 1, status: 'issued', ...doc }); }
  catch (err) { if (err.status === 409) return existing[existing.length - 1]; throw err; }
}
const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;

// Which service is the customer asking for? Only an unambiguous match counts.
export function matchService(text, services) {
  const words = ` ${String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  const hits = services.filter((s) => [s.name, ...(s.keywords || [])].some((k) => k && words.includes(` ${String(k).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `)));
  return hits.length === 1 ? hits[0] : null;
}
const offerUsable = (o, now) => !!o && o.approved === true && o.active === true && (!o.expires_at || new Date(o.expires_at) > now);

// ---- first contact -------------------------------------------------------------------------

// Finds the customer by an exact email or phone match inside this organization. A name alone is
// never a match. If the email and phone point at two different people, nobody is merged: a new
// contact is made and the conflict is recorded for a person to resolve.
async function findOrCreateContact(db, orgId, { name, email, phone, channel }) {
  const byEmail = email ? (await db.select('crm_contacts', { organization_id: orgId, email, merged_into_id: null }, { limit: 2 })) : [];
  const byPhone = phone ? (await db.select('crm_contacts', { organization_id: orgId, phone, merged_into_id: null }, { limit: 2 })) : [];
  const ids = new Set([...byEmail, ...byPhone].map((c) => c.id));
  if (ids.size === 1) return { contact: byEmail[0] || byPhone[0], conflict: false };
  const contact = await db.insert('crm_contacts', { organization_id: orgId, name, email: email || null, phone: phone || null, source: channel });
  return { contact, conflict: ids.size > 1 };
}

export async function startJourney(db, { orgId, channel, eventId, name, email, phone, text, offerCode, address, now = new Date() }) {
  const existing = await one(db, 'journeys', { organization_id: orgId, source_channel: channel, source_event_id: eventId });
  if (existing) return { journey: existing, token: null, next: await advance(db, existing, { now }), repeated: true };

  const cleanEmail = email ? String(email).trim().toLowerCase() : null;
  const cleanPhone = phone ? normalizePhone(phone) : null;
  const { contact, conflict } = await findOrCreateContact(db, orgId, { name, email: cleanEmail, phone: cleanPhone, channel });
  const deal = await db.insert('crm_deals', { organization_id: orgId, contact_id: contact.id, pipeline: 'client_sales', stage: 'new', source: channel });
  const offer = offerCode ? await one(db, 'business_offers', { organization_id: orgId, code: offerCode }) : null;
  const token = crypto.randomBytes(32).toString('hex');
  let journey;
  try {
    journey = await db.insert('journeys', { organization_id: orgId, contact_id: contact.id, deal_id: deal.id, offer_id: offerUsable(offer, now) ? offer.id : null, stage: 'inquiry', agent: 'front_desk', source_channel: channel, source_event_id: eventId, request_text: text || null, customer_token_hash: sha(token), discount_cents: 0, paid_cents: 0, paused: false, ...(address ? { service_address: address } : {}) });
  } catch (err) {
    if (err.status !== 409) throw err; // two copies of the same first contact arrived together
    const winner = await one(db, 'journeys', { organization_id: orgId, source_channel: channel, source_event_id: eventId });
    return { journey: winner, token: null, next: await advance(db, winner, { now }), repeated: true };
  }
  await record(db, journey, { agent: 'front_desk', action: 'inquiry_received', detail: { channel, contact_id: contact.id, deal_id: deal.id } });
  if (conflict) await record(db, journey, { agent: 'front_desk', handed_to: 'owner', action: 'possible_duplicate_contact', status: 'waiting_owner', detail: { reason: 'Email and phone match two different existing contacts. A new contact was created; nothing was merged.' } });
  if (offerCode && !journey.offer_id) await record(db, journey, { agent: 'front_desk', action: 'offer_not_applied', detail: { code: offerCode, reason: 'Offer is unknown, unapproved, inactive or expired.' } });
  return { journey, token, next: await advance(db, journey, { now }) };
}

// A like, comment or follow on a connected channel. If the owner has approved an offer for that
// trigger, a journey starts with the offer attached. Whether the offer message can actually be
// sent depends on the channel: `canSend` must come from a real connected, permitted account.
export async function handleChannelTrigger(db, { orgId, channel, type, eventId, handle, canSend = false, now = new Date() }) {
  const offers = (await db.select('business_offers', { organization_id: orgId, trigger_type: type })).filter((o) => offerUsable(o, now) && (!o.channel || o.channel === channel));
  if (!offers.length) return { started: false, reason: 'no_approved_offer' };
  const offer = offers[0];
  const started = await startJourney(db, { orgId, channel, eventId, name: handle, text: null, offerCode: offer.code, now });
  const first = await record(db, started.journey, {
    agent: 'front_desk', action: 'offer_issued', key: 'offer_issued', status: canSend ? 'done' : 'blocked',
    detail: { code: offer.code, description: offer.description, message: `Thanks for the ${type.replace('social_', '')}! Here is ${offer.percent_off}% off: use code ${offer.code}.`, ...(canSend ? {} : { reason: 'channel_not_connected', note: 'The offer is attached to this customer but no message was sent.' }) },
  });
  return { started: !started.repeated, journey: started.journey, offer, send: canSend && first, token: started.token };
}

// ---- the agents ----------------------------------------------------------------------------

// Runs every step that needs no outside input, then reports what the journey is waiting for.
export async function advance(db, j, { now = new Date() } = {}) {
  for (let guard = 0; guard < 12; guard++) {
    if (j.paused || j.stage === 'closed' || j.stage === 'cancelled') break;
    const svc = j.service_id ? await one(db, 'business_services', { id: j.service_id, organization_id: j.organization_id }) : null;

    if (j.stage === 'inquiry') { // FRONT DESK: what does the customer want?
      const services = await db.select('business_services', { organization_id: j.organization_id, active: true });
      const chosen = svc || matchService(j.request_text, services);
      if (!chosen) { await setJourney(db, j, { waiting_on: 'customer', waiting_reason: 'choose_service' }); await record(db, j, { agent: 'front_desk', handed_to: 'customer', action: 'asked_which_service', status: 'waiting_customer' }); break; }
      await setJourney(db, j, { service_id: chosen.id, stage: 'qualified', agent: 'contracts', waiting_on: null, waiting_reason: null });
      if (j.deal_id) await db.update('crm_deals', { id: j.deal_id, organization_id: j.organization_id }, { stage: 'qualified', next_action: 'Send quote' });
      await record(db, j, { agent: 'front_desk', handed_to: 'contracts', action: 'service_identified', detail: { service: chosen.name } });
      continue;
    }

    if (j.stage === 'qualified') { // CONTRACTS: quote from an approved price only
      if (!svc || !svc.price_approved || !Number.isInteger(svc.price_cents)) {
        await setJourney(db, j, { waiting_on: 'owner', waiting_reason: 'price_needs_approval' });
        if (await record(db, j, { agent: 'contracts', handed_to: 'owner', action: 'price_needs_approval', status: 'waiting_owner', detail: { service: svc?.name } })) {
          await db.insert('approval_requests', { organization_id: j.organization_id, item_type: 'pricing_exception', item_ref: `journey:${j.id}`, action_summary: `Set and approve a price for "${svc?.name}" so a quote can be sent.`, status: 'pending' });
        }
        break;
      }
      const offer = j.offer_id ? await one(db, 'business_offers', { id: j.offer_id, organization_id: j.organization_id }) : null;
      const discount = offerUsable(offer, now) ? Math.floor(svc.price_cents * offer.percent_off / 100) : 0;
      const total = svc.price_cents - discount;
      const body = [`Quote for ${svc.name}`, svc.description || '', `Price: ${money(svc.price_cents)}`, discount ? `Discount (${offer.code}, ${offer.percent_off}% off): -${money(discount)}` : '', `Total: ${money(total)}`, svc.deposit_cents ? `Deposit to book: ${money(Math.min(svc.deposit_cents, total))}` : ''].filter(Boolean).join('\n');
      await addDocument(db, j, { kind: 'quote', body, amount_cents: total });
      await setJourney(db, j, { quote_cents: svc.price_cents, discount_cents: discount, total_cents: total, stage: 'quoted', waiting_on: 'customer', waiting_reason: 'accept_quote' });
      if (j.deal_id) await db.update('crm_deals', { id: j.deal_id, organization_id: j.organization_id }, { stage: 'proposal', value_cents: total, next_action: 'Customer to accept quote' });
      await record(db, j, { agent: 'contracts', handed_to: 'customer', action: 'quote_issued', status: 'waiting_customer', detail: { total_cents: total, discount_cents: discount } });
      break;
    }

    if (j.stage === 'quoted') break; // waiting for the customer to accept

    if (j.stage === 'agreed') { // ACCOUNTING: deposit, if the service has one
      const deposit = svc?.deposit_cents ? Math.min(svc.deposit_cents, j.total_cents) : 0;
      if (deposit > j.paid_cents) {
        await addDocument(db, j, { kind: 'deposit_invoice', body: `Deposit invoice for ${svc.name}\nAmount due: ${money(deposit - j.paid_cents)}`, amount_cents: deposit - j.paid_cents });
        await setJourney(db, j, { stage: 'deposit_due', agent: 'accounting', waiting_on: 'customer', waiting_reason: 'pay_deposit' });
        await record(db, j, { agent: 'accounting', handed_to: 'customer', action: 'deposit_invoiced', status: 'waiting_customer', detail: { amount_cents: deposit - j.paid_cents } });
        break;
      }
      await setJourney(db, j, { stage: 'scheduling', agent: 'front_desk', waiting_on: null, waiting_reason: null });
      continue;
    }

    if (j.stage === 'deposit_due') {
      const deposit = Math.min(svc?.deposit_cents || 0, j.total_cents);
      if (j.paid_cents < deposit) break;
      await setJourney(db, j, { stage: 'scheduling', agent: 'front_desk', waiting_on: null, waiting_reason: null });
      continue;
    }

    if (j.stage === 'scheduling') { // FRONT DESK: get it on the calendar
      if (j.slot_id) { await setJourney(db, j, { stage: 'scheduled', waiting_on: 'staff', waiting_reason: 'complete_work' }); continue; }
      const open = (await db.select('voice_calendar_slots', { organization_id: j.organization_id, status: 'open' }, { order: 'start_at.asc', limit: 20 })).filter((s) => new Date(s.start_at) > now);
      const reason = open.length ? 'choose_time' : 'arrange_time';
      await setJourney(db, j, { waiting_on: open.length ? 'customer' : 'staff', waiting_reason: reason });
      await record(db, j, { agent: 'front_desk', handed_to: open.length ? 'customer' : 'staff', action: open.length ? 'offered_times' : 'no_open_times', status: open.length ? 'waiting_customer' : 'waiting_staff' });
      break;
    }

    if (j.stage === 'scheduled') break; // waiting for the work to be done and evidence recorded

    if (j.stage === 'fulfilled') { // ACCOUNTING: bill what is left
      const balance = j.total_cents - j.paid_cents;
      if (balance > 0) {
        await addDocument(db, j, { kind: 'balance_invoice', body: `Invoice for ${svc?.name}\nTotal: ${money(j.total_cents)}\nPaid so far: ${money(j.paid_cents)}\nBalance due: ${money(balance)}`, amount_cents: balance });
        await setJourney(db, j, { stage: 'balance_due', agent: 'accounting', waiting_on: 'customer', waiting_reason: 'pay_balance' });
        await record(db, j, { agent: 'accounting', handed_to: 'customer', action: 'balance_invoiced', status: 'waiting_customer', detail: { amount_cents: balance } });
        break;
      }
      await setJourney(db, j, { stage: 'paid', agent: 'finance', waiting_on: null, waiting_reason: null });
      continue;
    }

    if (j.stage === 'balance_due') {
      if (j.paid_cents < j.total_cents) break;
      await setJourney(db, j, { stage: 'paid', agent: 'finance', waiting_on: null, waiting_reason: null });
      continue;
    }

    if (j.stage === 'paid') { // FINANCE: follow up, record each person's share, report to the owner
      await recordSplit(db, j);
      const contact = await one(db, 'crm_contacts', { id: j.contact_id, organization_id: j.organization_id });
      const mayFollowUp = contact && !contact.do_not_contact && (contact.email_consent || contact.sms_consent);
      await record(db, j, { agent: 'finance', action: 'follow_up', status: mayFollowUp ? 'waiting_staff' : 'blocked', detail: mayFollowUp ? { note: 'Customer agreed to be contacted. Thank-you and review request are ready to send.' } : { reason: 'no_contact_permission', note: 'The customer has not agreed to follow-up messages, so none is prepared.' } });
      const events = await db.select('journey_events', { journey_id: j.id });
      const receipts = await db.select('journey_documents', { journey_id: j.id, kind: 'receipt' });
      const verified = receipts.filter((r) => r.payment_source === 'provider_verified').reduce((n, r) => n + r.amount_cents, 0);
      const body = [`Owner report: ${svc?.name} for ${contact?.name || 'customer'}`, `First contact: ${j.source_channel}`, `Quoted ${money(j.quote_cents)}, discount ${money(j.discount_cents)}, total ${money(j.total_cents)}`,
        `Payments recorded: ${money(j.paid_cents)} (${money(verified)} confirmed by the payment provider, ${money(j.paid_cents - verified)} entered by a person)`, `Steps taken: ${events.length}`, ...events.map((e) => `- ${e.agent}: ${e.action} (${e.status})`)].join('\n');
      await addDocument(db, j, { kind: 'owner_report', body, amount_cents: j.total_cents });
      await setJourney(db, j, { stage: 'closed', waiting_on: null, waiting_reason: null, closed_at: now.toISOString() });
      if (j.deal_id) await db.update('crm_deals', { id: j.deal_id, organization_id: j.organization_id }, { stage: 'payment_condition_satisfied', next_action: null, closed_at: now.toISOString() });
      await record(db, j, { agent: 'finance', handed_to: 'owner', action: 'owner_report_written' });
      break;
    }
    break;
  }
  return describeNext(db, j, now);
}

// FINANCE: each person's share of the money actually received, by the business's approved split
// rule (system 25). A record only: paying anyone is done by a person. The last share takes any
// leftover cent so the shares always add up to the money received. No rule, no record.
async function recordSplit(db, j) {
  try {
    const rule = await one(db, 'pay_split_rules', { organization_id: j.organization_id });
    if (!rule || rule.approved !== true || !Array.isArray(rule.shares) || !rule.shares.length || !(j.paid_cents > 0)) return;
    const done = (await db.select('job_assignments', { journey_id: j.id, organization_id: j.organization_id })).filter((a) => a.status === 'done').pop();
    let left = j.paid_cents;
    const rows = rule.shares.map((s, i) => {
      const amount = i === rule.shares.length - 1 ? left : Math.floor(j.paid_cents * Number(s.percent) / 100);
      left -= amount;
      return { organization_id: j.organization_id, journey_id: j.id, worker_id: s.to_worker ? done?.worker_id || null : null, label: s.label, percent: Number(s.percent), basis_cents: j.paid_cents, amount_cents: amount, rule_snapshot: rule.shares };
    });
    for (const row of rows) { try { await db.insert('pay_split_entries', row); } catch (err) { if (err.status !== 409) throw err; } }
    await record(db, j, { agent: 'finance', action: 'pay_split_recorded', detail: { basis_cents: j.paid_cents, shares: rows.map((r) => ({ label: r.label, amount_cents: r.amount_cents, worker_id: r.worker_id })) } });
  } catch {
    await record(db, j, { agent: 'finance', handed_to: 'owner', action: 'pay_split_not_recorded', status: 'waiting_owner', detail: { reason: 'The pay split could not be recorded. Nothing was paid; record the shares by hand.' } }).catch(() => {});
  }
}

// What the customer (or owner) sees next, in plain words.
async function describeNext(db, j, now) {
  const base = { journey_id: j.id, stage: j.stage, waiting_on: j.paused ? 'staff' : j.waiting_on, reason: j.paused ? 'a_person_has_taken_over' : j.waiting_reason };
  if (j.paused) return { ...base, message: 'A team member is handling your request personally and will be in touch.' };
  switch (j.waiting_reason) {
    case 'choose_service': return { ...base, message: 'Which service do you need?', options: (await db.select('business_services', { organization_id: j.organization_id, active: true })).map((s) => ({ service_id: s.id, name: s.name, description: s.description })) };
    case 'price_needs_approval': return { ...base, message: 'Thanks. The team is preparing your quote and will send it shortly.' };
    case 'accept_quote': { const q = (await db.select('journey_documents', { journey_id: j.id, kind: 'quote' })).pop(); return { ...base, message: 'Here is your quote. Accept it to continue.', quote: { id: q.id, text: q.body, total_cents: q.amount_cents } }; }
    case 'terms_need_approval': return { ...base, message: 'Thanks for accepting. The team is finalizing your agreement and will send it shortly.' };
    case 'pay_deposit': case 'pay_balance': { const kind = j.waiting_reason === 'pay_deposit' ? 'deposit_invoice' : 'balance_invoice'; const inv = (await db.select('journey_documents', { journey_id: j.id, kind })).pop(); return { ...base, message: 'Your invoice is ready. The business will confirm how to pay.', invoice: { id: inv.id, text: inv.body, amount_cents: inv.amount_cents } }; }
    case 'choose_time': return { ...base, message: 'Choose a time that works for you.', options: (await db.select('voice_calendar_slots', { organization_id: j.organization_id, status: 'open' }, { order: 'start_at.asc', limit: 20 })).filter((s) => new Date(s.start_at) > now).map((s) => ({ slot_id: s.id, start_at: s.start_at, end_at: s.end_at })) };
    case 'arrange_time': return { ...base, message: 'No open times are published right now. The team will contact you to arrange one.' };
    case 'complete_work': return { ...base, message: 'You are booked. See you then.' };
    default: return { ...base, message: j.stage === 'closed' ? 'All done. Thank you.' : j.stage === 'cancelled' ? 'This request was cancelled.' : 'Your request is being handled.' };
  }
}

// ---- customer actions ----------------------------------------------------------------------

// A fresh private link to this journey's request page, for a customer who started by phone, chat or
// message. Only the hash is stored, so issuing a new link retires the previous one. The key is in
// the part of the address after '#', which browsers never send to any server.
export async function customerLink(db, j, base = appBase()) {
  const token = crypto.randomBytes(32).toString('hex');
  // A separate key from the customer's own browser session, so sending a link never logs them out.
  await db.update('journeys', { id: j.id, organization_id: j.organization_id }, { customer_link_hash: sha(token) });
  j.customer_link_hash = sha(token);
  return `${base}/start?org=${j.organization_id}#j=${j.id}&k=${token}`;
}

// Emails the customer whatever the request is now due (quote, invoice, reminder; api/_journeyEmail.js).
// Best effort: a problem with email never fails the customer's or the owner's action.
async function emailAfter(db, j) {
  try { const { sendJourneyEmails } = await import('./_journeyEmail.js'); await sendJourneyEmails(db, j); }
  catch (err) { console.error('[journey-email]', err.message); }
}

export function tokenMatches(j, token) {
  if (!TOKEN_RE.test(token || '')) return false;
  const a = Buffer.from(sha(token));
  return [j.customer_token_hash, j.customer_link_hash].some((h) => { const b = Buffer.from(h || ''); return a.length === b.length && crypto.timingSafeEqual(a, b); });
}

export async function chooseService(db, j, serviceId, opts) {
  if (j.stage !== 'inquiry') throw fail('wrong_stage', 'The service has already been chosen.');
  const svc = await one(db, 'business_services', { id: serviceId, organization_id: j.organization_id, active: true });
  if (!svc) throw fail('unknown_service', 'Choose one of the listed services.', 422);
  await setJourney(db, j, { service_id: svc.id });
  await record(db, j, { agent: 'customer', action: 'chose_service', detail: { service: svc.name } });
  return advance(db, j, opts);
}

// The customer accepts the exact quote they were shown. If the service needs an agreement, the
// owner-approved wording is recorded with the customer's typed name as evidence.
export async function acceptQuote(db, j, { quoteId, typedName }, opts = {}) {
  const now = opts.now || new Date();
  if (j.stage !== 'quoted') throw fail('wrong_stage', 'There is no quote waiting for acceptance.');
  const name = String(typedName || '').trim();
  if (name.length < 2) throw fail('name_required', 'Type your full name to accept.', 422);
  const quote = (await db.select('journey_documents', { journey_id: j.id, kind: 'quote' })).pop();
  if (!quote || quote.id !== quoteId || quote.amount_cents !== j.total_cents) throw fail('quote_changed', 'This quote has changed. Review the current quote before accepting.');
  const svc = await one(db, 'business_services', { id: j.service_id, organization_id: j.organization_id });
  if (svc.terms_text && !svc.terms_approved) {
    await setJourney(db, j, { waiting_on: 'owner', waiting_reason: 'terms_need_approval' });
    if (await record(db, j, { agent: 'contracts', handed_to: 'owner', action: 'terms_need_approval', status: 'waiting_owner', detail: { service: svc.name } })) {
      await db.insert('approval_requests', { organization_id: j.organization_id, item_type: 'content', item_ref: `journey:${j.id}`, action_summary: `Approve the agreement wording for "${svc.name}".`, status: 'pending' });
    }
    return describeNext(db, j, now);
  }
  const evidence = `Accepted by "${name}" at ${now.toISOString()} via private customer link`;
  await db.update('journey_documents', { id: quote.id, journey_id: j.id }, { status: 'accepted', accepted_at: now.toISOString(), acceptance_evidence: evidence });
  if (svc.terms_text) await addDocument(db, j, { kind: 'agreement', body: `Agreement for ${svc.name}\n\n${svc.terms_text}\n\nTotal: ${money(j.total_cents)}`, amount_cents: j.total_cents, status: 'accepted', accepted_at: now.toISOString(), acceptance_evidence: evidence });
  await setJourney(db, j, { stage: 'agreed', agent: 'accounting', waiting_on: null, waiting_reason: null });
  if (j.deal_id) await db.update('crm_deals', { id: j.deal_id, organization_id: j.organization_id }, { stage: 'accepted', next_action: 'Schedule the work' });
  await record(db, j, { agent: 'customer', handed_to: 'accounting', action: 'quote_accepted', detail: { agreement: !!svc.terms_text } });
  return advance(db, j, opts);
}

// Reserves a time exactly once: the update only succeeds while the slot is still open. Used for
// the first booking and for a change of time (the old slot is released only after the new one
// is secured).
export async function chooseSlot(db, j, slotId, opts) {
  if (!['scheduling', 'scheduled'].includes(j.stage)) throw fail('wrong_stage', 'This request is not ready to be scheduled.');
  if (slotId === j.slot_id) return advance(db, j, opts);
  const taken = await db.update('voice_calendar_slots', { id: slotId, organization_id: j.organization_id, status: 'open' }, { status: 'booked', booking_contact_id: j.contact_id });
  if (!taken.length) throw fail('slot_unavailable', 'That time is no longer available. Please choose another.');
  const previous = j.slot_id;
  await setJourney(db, j, { slot_id: slotId, stage: 'scheduling' });
  if (previous) await db.update('voice_calendar_slots', { id: previous, organization_id: j.organization_id, status: 'booked' }, { status: 'open', booking_contact_id: null });
  await record(db, j, { agent: 'front_desk', action: previous ? 'appointment_moved' : 'appointment_booked', key: `slot:${slotId}`, detail: { slot_id: slotId, start_at: taken[0].start_at, released_slot_id: previous || undefined } });
  return advance(db, j, opts);
}

export async function cancelJourney(db, j, by = 'customer') {
  if (['closed', 'cancelled'].includes(j.stage)) return describeNext(db, j, new Date());
  if (j.paid_cents > 0) throw fail('has_payments', 'A payment has been recorded on this request. Contact the business to cancel.');
  if (j.slot_id) await db.update('voice_calendar_slots', { id: j.slot_id, organization_id: j.organization_id, status: 'booked' }, { status: 'open', booking_contact_id: null });
  for (const kind of ['deposit_invoice', 'balance_invoice']) await db.update('journey_documents', { journey_id: j.id, kind, status: 'issued' }, { status: 'void' });
  await setJourney(db, j, { stage: 'cancelled', slot_id: null, waiting_on: null, waiting_reason: null, closed_at: new Date().toISOString() });
  if (j.deal_id) await db.update('crm_deals', { id: j.deal_id, organization_id: j.organization_id }, { stage: 'lost', lost_reason: `Cancelled by ${by}` });
  await record(db, j, { agent: by === 'customer' ? 'customer' : 'owner', action: 'cancelled' });
  return describeNext(db, j, new Date());
}

// ---- staff and owner actions ---------------------------------------------------------------

// Records a payment. `source` says who confirmed it: 'provider_verified' may only be used by a
// caller that has verified the provider's own signed event; a person's entry is 'owner_recorded'
// and stays labelled that way on the receipt and in the owner report. The reference makes a
// repeated call a no-op.
export async function recordPayment(db, j, { amountCents, source, reference }, opts) {
  if (!['deposit_due', 'balance_due'].includes(j.stage)) throw fail('wrong_stage', 'No invoice is waiting for payment on this request.');
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw fail('bad_amount', 'Enter the amount received.', 422);
  if (!['provider_verified', 'owner_recorded'].includes(source)) throw fail('bad_source', 'Say how the payment was confirmed.', 422);
  if (!reference || String(reference).length > 120) throw fail('reference_required', 'Enter a payment reference.', 422);
  const fresh = await record(db, j, { agent: 'accounting', action: 'payment_recorded', key: `payment:${reference}`, detail: { amount_cents: amountCents, source, reference } });
  if (!fresh) return advance(db, j, opts);
  const current = await one(db, 'journeys', { id: j.id, organization_id: j.organization_id });
  await setJourney(db, j, { paid_cents: current.paid_cents + amountCents });
  await addDocument(db, j, { kind: 'receipt', body: `Receipt\nAmount received: ${money(amountCents)}\nReference: ${reference}\n${source === 'provider_verified' ? 'Confirmed by the payment provider.' : 'Entered by the business; not confirmed by a payment provider.'}`, amount_cents: amountCents, status: 'paid', payment_source: source, payment_reference: String(reference) });
  const invoiceKind = j.stage === 'deposit_due' ? 'deposit_invoice' : 'balance_invoice';
  const invoice = (await db.select('journey_documents', { journey_id: j.id, kind: invoiceKind })).pop();
  const due = j.stage === 'deposit_due' ? invoice.amount_cents : j.total_cents - (j.paid_cents - amountCents);
  if (invoice && amountCents >= due) await db.update('journey_documents', { id: invoice.id, journey_id: j.id }, { status: 'paid' });
  return advance(db, j, opts);
}

// The work was done. Evidence is required: a job is not "complete" on someone's say-so alone.
export async function completeWork(db, j, { note, by }, opts) {
  if (j.stage !== 'scheduled') throw fail('wrong_stage', 'This request is not scheduled work.');
  const evidence = String(note || '').trim();
  if (evidence.length < 10) throw fail('evidence_required', 'Describe what was done (at least a sentence).', 422);
  await addDocument(db, j, { kind: 'completion', body: `Work completed.\n${evidence}\nRecorded by: ${by || 'staff'}`, status: 'accepted' });
  await setJourney(db, j, { stage: 'fulfilled', agent: 'accounting', waiting_on: null, waiting_reason: null });
  if (j.deal_id) await db.update('crm_deals', { id: j.deal_id, organization_id: j.organization_id }, { stage: 'onboarding', next_action: 'Collect balance' });
  await record(db, j, { agent: 'owner', handed_to: 'accounting', action: 'work_completed', detail: { by: by || 'staff' } });
  return advance(db, j, opts);
}

export async function setPaused(db, j, paused, by) {
  await setJourney(db, j, { paused });
  await record(db, j, { agent: 'owner', action: paused ? 'person_took_over' : 'agents_resumed', key: `${paused ? 'pause' : 'resume'}:${Date.now()}`, detail: { by } });
  return paused ? describeNext(db, j, new Date()) : advance(db, j);
}

// FINANCE: what is owed right now, oldest first. Quotes are not money owed and are not listed.
export async function receivables(db, orgId, now = new Date()) {
  const open = (await db.select('journeys', { organization_id: orgId })).filter((j) => ['deposit_due', 'balance_due'].includes(j.stage));
  const rows = [];
  for (const j of open) {
    const kind = j.stage === 'deposit_due' ? 'deposit_invoice' : 'balance_invoice';
    const inv = (await db.select('journey_documents', { journey_id: j.id, kind })).pop();
    if (inv && inv.status === 'issued') rows.push({ journey_id: j.id, kind, amount_cents: inv.amount_cents, days_outstanding: Math.floor((now - new Date(inv.created_at)) / 86400000) });
  }
  return { rows: rows.sort((a, b) => b.days_outstanding - a.days_outstanding), total_cents: rows.reduce((n, r) => n + r.amount_cents, 0) };
}

// ---- HTTP: /api/client?resource=journey ----------------------------------------------------
// Customer ops (no login; rate-limited; every op after `start` needs the private link token):
//   POST op=business (what the public page shows: name, services, current public offer)
//   POST op=start | status | choose-service | accept | choose-time | cancel | pay
// Staff ops (staff session + permission in THAT organization):
//   GET  op=list | detail | receivables | card-payments
//   POST op=save-service | save-offer | record-payment | complete | pause | resume
//        | card-payments-connect | card-payments-refresh
export const JOURNEY_CUSTOMER_OPS = new Set(['business', 'start', 'status', 'choose-service', 'accept', 'choose-time', 'cancel', 'pay', 'rate']);

// A finished, paid job the customer has not rated yet: their page asks "How did we do, 1 to 5?".
async function withRatingOption(db, j, next) {
  if (!next || next.stage !== 'closed' || !(j.paid_cents > 0)) return next;
  const { hasRated } = await import('./_reviews.js');
  return (await hasRated(db, j)) ? next : { ...next, ask_rating: true };
}

const appBase = () => (process.env.APP_BASE_URL || 'https://nova-systems.app').replace(/\/$/, '');

// Emails Nova sent in the last 24 hours, across every business (the email provider's daily limit
// is for Nova's whole account). The daily caps are far below 200, so the newest 200 are enough.
async function sentTodayAcrossNova(db, now = new Date()) {
  const recent = (rows, col) => rows.filter((r) => r[col] && now - new Date(r[col]) < 86400000).length;
  return recent(await db.select('revive_outreach', { status: 'sent' }, { order: 'sent_at.desc', limit: 200 }), 'sent_at')
    + recent(await db.select('scorecard_sends', {}, { order: 'created_at.desc', limit: 200 }), 'created_at');
}

// The weekly scorecard for every business that turned email on (Vercel's scheduler calls this
// with Nova's CRON_SECRET). Each business gets at most one a day, whatever retries happen.
async function weeklyScorecards(db) {
  if (!emailSwitch().on) return { sent: 0, reason: 'email_off', results: [] };
  const caps = emailCaps(); const results = [];
  for (const a of (await db.select('business_agents', { email_enabled: true })).filter((x) => validEmail(x.reply_email))) {
    if (await sentTodayAcrossNova(db) >= caps.total) { results.push({ organization_id: a.organization_id, sent: false, reason: 'daily_limit' }); continue; }
    const { scorecard: _card, ...out } = await sendScorecard(db, a.organization_id, { to: a.reply_email, business: a.business_name, send: (m) => sendEmail(m) });
    results.push({ organization_id: a.organization_id, ...out });
  }
  return { sent: results.filter((r) => r.sent).length, results };
}

const PAGE = (title, text) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="font:16px/1.6 system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 20px"><h1 style="font-size:22px">${title}</h1><p>${text}</p></body></html>`;

// When an invoice is waiting and the business takes cards, the customer is offered "Pay by card".
async function withPayOption(db, orgId, next) {
  if (!next?.invoice) return next;
  const { canPayOnline } = await import('./_cardPayments.js');
  if (!(await canPayOnline(db, orgId))) return next;
  return { ...next, can_pay_online: true, message: 'Your invoice is ready. Pay by card below, or the business will confirm other ways to pay.' };
}

export async function handleJourney(req, res, op, { requireStaff, requireOrgAccess, sanitize, sanitizeEmail, rateLimit }) {
  res.setHeader('Cache-Control', 'no-store');
  const b = req.body || {};
  try {
    const db = restDb();
    // The unsubscribe link in a business's marketing email: opened from the email (GET) or the
    // mail app's one-click button (POST). No login; the random token is the only key.
    if (op === 'unsubscribe') {
      if (!rateLimit(req, res, 30, 60_000)) return;
      const ok = await unsubscribe(db, sanitize(String(req.query?.t || b.t || ''), 100));
      if (req.method === 'POST') return res.status(ok ? 200 : 404).json({ ok });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(ok ? 200 : 404).end(ok ? PAGE('You are unsubscribed', 'You will not get any more of these emails or texts from this business.') : PAGE('Link not recognized', 'This unsubscribe link is not valid. Reply to the email and ask the business to stop contacting you.'));
    }
    if (op === 'daily-emails') { // reminders for tomorrow's appointments, and quote or invoice emails that could not go out
      const secret = process.env.CRON_SECRET || '';
      const got = Buffer.from(String(req.headers?.authorization || '')), want = Buffer.from(`Bearer ${secret}`);
      if (!secret || got.length !== want.length || !crypto.timingSafeEqual(got, want)) return res.status(401).json({ error: 'Not allowed' });
      const { dailyJourneyEmails } = await import('./_journeyEmail.js');
      return res.status(200).json({ ok: true, ...(await dailyJourneyEmails(db)) });
    }
    if (op === 'weekly-scorecards') {
      const secret = process.env.CRON_SECRET || '';
      const got = Buffer.from(String(req.headers?.authorization || '')), want = Buffer.from(`Bearer ${secret}`);
      if (!secret || got.length !== want.length || !crypto.timingSafeEqual(got, want)) return res.status(401).json({ error: 'Not allowed' });
      return res.status(200).json({ ok: true, ...(await weeklyScorecards(db)) });
    }
    // The business's public one-page website at /b/<slug> (system 5), built from its own records.
    if (op === 'site') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      if (!rateLimit(req, res, 120, 60_000)) return;
      const { siteFor } = await import('./_site.js');
      const out = await siteFor(db, sanitize(String(req.query?.slug || ''), 80).toLowerCase());
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', out.status === 200 ? 'public, max-age=300' : 'no-store');
      return res.status(out.status).end(out.html);
    }
    // The private rating link sent by email or text after a paid job (no login; the link is the key).
    if (op === 'rate-info' || op === 'rate-link') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      if (!rateLimit(req, res, 20, 60_000)) return;
      const rv = await import('./_reviews.js');
      const found = await rv.journeyForRatingLink(db, String(b.t || ''));
      if (!found) return res.status(404).json({ error: 'This link is not valid. Thank you anyway.' });
      if (op === 'rate-info') return res.status(200).json({ ok: true, ...(await rv.ratingInfo(db, found.j)) });
      return res.status(200).json({ ok: true, ...(await rv.rate(db, found.j, { rating: b.rating, comment: sanitize(b.comment, 1000) })) });
    }
    // Website chat (system 10): the chat box on a business's website and on /b/<slug>. No login; a
    // random key kept in the visitor's browser identifies their conversation.
    if (op === 'chat-open' || op === 'chat' || op === 'chat-history') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      if (!rateLimit(req, res, op === 'chat' ? 15 : 60, 60_000)) return;
      const wc = await import('./_webChat.js');
      const slug = sanitize(String(b.b || ''), 80).toLowerCase(), key = String(b.k || '').slice(0, 64);
      const out = op === 'chat-open' ? await wc.chatOpen(db, slug)
        : op === 'chat' ? await wc.chatSend(db, { slug, key, messageId: String(b.id || '').slice(0, 36), text: sanitize(typeof b.text === 'string' ? b.text : '', 1000), name: sanitize(b.name, 80) })
          : await wc.chatHistory(db, { slug, key });
      return res.status(out.status).json(out.body);
    }
    if (op === 'crew-jobs' || op === 'crew-done') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      if (!rateLimit(req, res, 40, 60_000)) return;
      const team = await import('./_team.js');
      const worker = await team.workerByToken(db, String(b.t || ''));
      if (!worker) return res.status(404).json({ error: 'This link is not active. Ask the business for a new one.' });
      if (op === 'crew-jobs') return res.status(200).json({ ok: true, ...(await team.crewJobs(db, worker)) });
      const out = await team.crewDone(db, worker, { assignmentId: sanitize(b.assignment_id, 100), note: sanitize(b.note, 2000) });
      return res.status(200).json({ ok: true, ...out, ...(await team.crewJobs(db, worker)) });
    }
    if (JOURNEY_CUSTOMER_OPS.has(op)) {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      if (!rateLimit(req, res, op === 'start' ? 8 : 40, 60_000)) return;
      if (op === 'business') {
        const orgId = sanitize(b.organization_id, 100);
        if (!UUID_RE.test(orgId)) return res.status(400).json({ error: 'This link is not valid.' });
        const services = await db.select('business_services', { organization_id: orgId, active: true });
        if (!services.length) return res.status(404).json({ error: 'This business is not taking requests here yet.' });
        const agent = await one(db, 'business_agents', { organization_id: orgId });
        const org = agent ? null : await one(db, 'organizations', { id: orgId });
        // Only an offer the owner approved AND marked for website visitors is shown publicly.
        const promo = (await db.select('business_offers', { organization_id: orgId, trigger_type: 'web_visit' })).find((o) => offerUsable(o, new Date()));
        // Prices are deliberately not listed here: the customer sees a price only on their own quote.
        return res.status(200).json({ ok: true, business: { name: agent?.business_name || org?.name || 'This business', services: services.map((x) => ({ name: x.name, description: x.description || '' })), offer: promo ? { code: promo.code, description: promo.description, percent_off: promo.percent_off, expires_at: promo.expires_at || null } : null } });
      }
      if (op === 'start') {
        const orgId = sanitize(b.organization_id, 100), eventId = sanitize(b.submission_id, 100);
        if (!UUID_RE.test(orgId) || !UUID_RE.test(eventId)) return res.status(400).json({ error: 'This request link is not valid.' });
        if (b.website_url_confirm) return res.status(200).json({ ok: true }); // honeypot: pretend, store nothing
        const name = sanitize(b.name, 100), email = sanitizeEmail(b.email), phone = b.phone ? normalizePhone(b.phone) : null;
        if (!name || (!email && !phone)) return res.status(422).json({ error: 'Enter your name and an email or phone number.' });
        // Only a business that has published at least one service takes requests here.
        if (!(await db.select('business_services', { organization_id: orgId, active: true }, { limit: 1 })).length) return res.status(404).json({ error: 'This business is not taking requests here yet.' });
        const out = await startJourney(db, { orgId, channel: 'web', eventId, name, email, phone, text: sanitize(b.message, 2000), offerCode: sanitize(b.offer_code, 40) || undefined, address: sanitize(b.address, 300) || undefined });
        await emailAfter(db, out.journey);
        return res.status(200).json({ ok: true, journey_id: out.journey.id, token: out.token, next: await withPayOption(db, orgId, out.next) });
      }
      const id = sanitize(b.journey_id, 100);
      const j = UUID_RE.test(id) ? await one(db, 'journeys', { id }) : null;
      if (!j || !tokenMatches(j, b.token)) return res.status(404).json({ error: 'This request could not be found.' });
      if (j.paused && op !== 'status' && op !== 'rate') return res.status(409).json({ error: 'A team member is handling this request personally.' });
      if (op === 'rate') { const { rate } = await import('./_reviews.js'); return res.status(200).json({ ok: true, ...(await rate(db, j, { rating: b.rating, comment: sanitize(b.comment, 1000) })) }); }
      if (op === 'pay') { // Stripe's own page, for exactly what is still owed; the webhook records it
        const { createPayLink } = await import('./_cardPayments.js');
        const link = await createPayLink(db, j);
        return res.status(200).json({ ok: true, url: link.url, amount_cents: link.amount_cents });
      }
      let next;
      if (op === 'status') next = await advance(db, j);
      else if (op === 'choose-service') next = await chooseService(db, j, sanitize(b.service_id, 100));
      else if (op === 'accept') next = await acceptQuote(db, j, { quoteId: sanitize(b.quote_id, 100), typedName: sanitize(b.typed_name, 120) });
      else if (op === 'choose-time') next = await chooseSlot(db, j, sanitize(b.slot_id, 100));
      else next = await cancelJourney(db, j, 'customer');
      await emailAfter(db, j);
      return res.status(200).json({ ok: true, next: await withRatingOption(db, j, await withPayOption(db, j.organization_id, next)) });
    }

    const caller = await requireStaff(req, res);
    if (!caller) return;
    if (req.method === 'GET') {
      const orgId = sanitize(req.query?.organization_id, 100);
      if (!UUID_RE.test(orgId)) return res.status(400).json({ error: 'organization_id is required' });
      // The month's invoices, payments and shares for the accountant: money, so the owner-level permission.
      if (op === 'bookkeeping-export') {
        if (!(await requireOrgAccess(req, res, orgId, 'business.manage'))) return;
        const { monthExport } = await import('./_bookkeeping.js');
        return res.status(200).json(await monthExport(db, orgId, { month: sanitize(req.query?.month, 7), timeZone: sanitize(req.query?.tz, 60) || 'America/New_York' }));
      }
      if (!(await requireOrgAccess(req, res, orgId, 'growth.view'))) return;
      if (op === 'receivables') return res.status(200).json(await receivables(db, orgId));
      if (op === 'card-payments') { const { paymentStatus } = await import('./_cardPayments.js'); return res.status(200).json({ payments: await paymentStatus(db, orgId) }); }
      if (op === 'team') { const { teamView } = await import('./_team.js'); return res.status(200).json(await teamView(db, orgId)); }
      if (op === 'feedback') { const { feedbackList } = await import('./_reviews.js'); return res.status(200).json({ feedback: await feedbackList(db, orgId) }); }
      if (op === 'brief') { const { briefFor } = await import('./_brief.js'); return res.status(200).json({ brief: await briefFor(db, orgId, { timeZone: sanitize(req.query?.tz, 60) || 'America/New_York' }) }); }
      if (op === 'scorecard') { // Nova Proof: default is the last 7 days
        const to = req.query?.to ? new Date(req.query.to) : new Date();
        const from = req.query?.from ? new Date(req.query.from) : new Date(to.getTime() - 7 * 86400000);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) return res.status(400).json({ error: 'from must be before to' });
        const card = await scorecard(db, orgId, { from, to });
        return res.status(200).json({ scorecard: card, text: scorecardText(card) });
      }
      // Nova Revive, read-only: who is overdue or has gone quiet. Writes nothing.
      if (op === 'revive-preview') return res.status(200).json({ overdue: await findOverdue(db, orgId), cold_leads: await findColdLeads(db, orgId) });
      if (op === 'packs') return res.status(200).json({ packs: Object.entries(INDUSTRY_PACKS).map(([key, p]) => ({ key, name: p.name, services: p.services.map((x) => x.name) })) });
      if (op === 'detail') {
        const jid = sanitize(req.query?.journey_id, 100);
        const j = UUID_RE.test(jid) ? await one(db, 'journeys', { id: jid, organization_id: orgId }) : null;
        if (!j) return res.status(404).json({ error: 'Not found' });
        const { customer_token_hash: _hidden, ...safe } = j;
        const who = await one(db, 'crm_contacts', { id: j.contact_id, organization_id: orgId });
        const live = (await db.select('job_assignments', { journey_id: j.id, organization_id: orgId, status: 'assigned' }))[0] || null;
        return res.status(200).json({ journey: safe, customer: who ? { name: who.name || null, email: who.email || null, phone: who.phone || null } : null, events: await db.select('journey_events', { journey_id: j.id }), documents: await db.select('journey_documents', { journey_id: j.id }), assignment: live ? { id: live.id, worker_id: live.worker_id } : null });
      }
      // Names come only from this organization's own contacts, so one business never sees another's customers.
      const people = new Map((await db.select('crm_contacts', { organization_id: orgId }, { order: 'created_at.desc', limit: 1000 })).map((c) => [c.id, c.name || c.email || c.phone || 'Customer']));
      const journeys = (await db.select('journeys', { organization_id: orgId }, { order: 'updated_at.desc', limit: 200 })).map(({ customer_token_hash: _hidden, ...safe }) => ({ ...safe, customer_name: people.get(safe.contact_id) || 'Customer' }));
      return res.status(200).json({ journeys, services: await db.select('business_services', { organization_id: orgId }), offers: await db.select('business_offers', { organization_id: orgId }) });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!rateLimit(req, res, 30, 60_000)) return;
    const orgId = sanitize(b.organization_id, 100);
    if (!UUID_RE.test(orgId)) return res.status(400).json({ error: 'organization_id is required' });
    // Prices, discounts, agreement wording and money: the owner-level permission (business.manage)
    // in that organization. Client owners hold it; admin.view stays Nova-only.
    if (!(await requireOrgAccess(req, res, orgId, ['complete', 'assign', 'feedback-resolve'].includes(op) ? 'growth.view' : 'business.manage'))) return;
    if (op === 'feedback-resolve') { const { resolveFeedback } = await import('./_reviews.js'); return res.status(200).json({ ok: true, feedback: await resolveFeedback(db, orgId, sanitize(b.feedback_id, 100), caller.email || caller.id) }); }
    // Team and pay (systems 24 and 25).
    if (['save-worker', 'worker-link', 'assign', 'save-split', 'mark-paid-out'].includes(op)) {
      const team = await import('./_team.js');
      const by = caller.email || caller.id;
      if (op === 'save-worker') {
        const out = await team.saveWorker(db, orgId, { workerId: UUID_RE.test(sanitize(b.worker_id, 100)) ? sanitize(b.worker_id, 100) : null, name: sanitize(b.name, 100), phone: b.phone ? normalizePhone(b.phone) : null, email: sanitizeEmail(b.email) || null, kind: b.kind, active: b.active });
        return res.status(200).json({ ok: true, worker: out.worker, link: out.token ? `${appBase()}/crew?t=${out.token}` : null });
      }
      if (op === 'worker-link') { const out = await team.newWorkerLink(db, orgId, sanitize(b.worker_id, 100)); return res.status(200).json({ ok: true, link: `${appBase()}/crew?t=${out.token}` }); }
      if (op === 'assign') return res.status(200).json({ ok: true, ...(await team.assignJob(db, orgId, { journeyId: sanitize(b.journey_id, 100), workerId: sanitize(b.worker_id, 100), by })) });
      if (op === 'save-split') return res.status(200).json({ ok: true, rule: await team.saveSplitRule(db, orgId, { shares: Array.isArray(b.shares) ? b.shares.slice(0, 7) : [], approved: b.approved === true, by }) });
      return res.status(200).json({ ok: true, entry: await team.markPaidOut(db, orgId, sanitize(b.entry_id, 100), by) });
    }

    // Nova Revive. Preparing saves one message per person per step; a message is "ready" only
    // when the customer agreed to that channel and the business can send on it. Email is the
    // only channel that can send today (texting waits on carrier approval). Sending is a
    // separate press of the button by the owner.
    if (op === 'revive-run' || op === 'revive-send') {
      const agent = await one(db, 'business_agents', { organization_id: orgId });
      const sw = emailSwitch();
      const emailOk = sw.on && agent?.email_enabled === true && !!String(agent?.mailing_address || '').trim();
      const why = !sw.on ? sw.reason : agent?.email_enabled !== true ? 'Email is off for this business. Turn it on in the Assistant tab.' : emailOk ? null : 'Add the business mailing address in the Assistant tab.';
      if (op === 'revive-run') {
        const out = await runRevive(db, orgId, { canSend: { email: emailOk }, baseUrl: appBase(), business: agent?.business_name || sanitize(b.business_name, 120) || 'us' });
        const reopened = emailOk ? await reopenBlocked(db, orgId, { email: true }) : 0;
        return res.status(200).json({ ok: true, ...out, reopened, email_ready: emailOk, email_note: why });
      }
      if (!emailOk) return res.status(409).json({ error: why });
      const out = await sendReady(db, orgId, { agent, send: (m) => sendEmail(m), caps: emailCaps(), appBase: appBase(), countSentToday: () => sentTodayAcrossNova(db) });
      return res.status(200).json({ ok: true, ...out });
    }
    // Nova Proof: email the last 7 days to the owner now (the weekly schedule does the same).
    if (op === 'send-scorecard') {
      const sw = emailSwitch();
      if (!sw.on) return res.status(409).json({ error: sw.reason });
      if (await sentTodayAcrossNova(db) >= emailCaps().total) return res.status(409).json({ error: 'Nova has used today\'s email allowance. Try again tomorrow.' });
      const agent = await one(db, 'business_agents', { organization_id: orgId });
      const to = validEmail(agent?.reply_email) ? agent.reply_email : caller.email;
      if (!validEmail(to)) return res.status(422).json({ error: 'Add an email for the weekly report in the Assistant tab.' });
      const out = await sendScorecard(db, orgId, { to, business: agent?.business_name || 'Your business', send: (m) => sendEmail(m) });
      if (!out.sent && out.reason === 'not_accepted') return res.status(502).json({ error: `The email provider did not accept it: ${out.error}` });
      return res.status(200).json({ ok: true, sent: out.sent, reason: out.reason || null, to });
    }
    // Card payments: the owner connects the business's own Stripe account on Stripe's page.
    if (op === 'card-payments-connect' || op === 'card-payments-refresh') {
      const cp = await import('./_cardPayments.js');
      if (op === 'card-payments-refresh') return res.status(200).json({ ok: true, payments: await cp.refreshAccount(db, { orgId }) });
      const agent = await one(db, 'business_agents', { organization_id: orgId });
      const org = agent?.business_name ? null : await one(db, 'organizations', { id: orgId });
      const out = await cp.startOnboarding(db, { orgId, businessName: agent?.business_name || org?.name || '' });
      return res.status(200).json({ ok: true, url: out.url, payments: out.status });
    }
    if (op === 'apply-pack') return res.status(200).json({ ok: true, ...(await applyPack(db, orgId, sanitize(b.pack, 60))) });
    if (op === 'save-service') {
      const name = sanitize(b.name, 120);
      if (!name) return res.status(400).json({ error: 'name is required' });
      const cents = (v) => (v == null || v === '' ? null : Number(v));
      const price = cents(b.price_cents), deposit = cents(b.deposit_cents);
      if ((price !== null && (!Number.isInteger(price) || price <= 0)) || (deposit !== null && (!Number.isInteger(deposit) || deposit <= 0 || (price !== null && deposit > price)))) return res.status(400).json({ error: 'Prices are whole cents; a deposit cannot exceed the price.' });
      const terms = sanitize(b.terms_text, 8000) || null;
      const returnDays = b.return_days == null || b.return_days === '' ? null : Number(b.return_days);
      if (returnDays !== null && (!Number.isInteger(returnDays) || returnDays < 1 || returnDays > 1825)) return res.status(400).json({ error: 'return_days is a whole number of days between 1 and 1825, or empty.' });
      const row = { organization_id: orgId, name, description: sanitize(b.description, 1000) || null, keywords: Array.isArray(b.keywords) ? b.keywords.map((k) => sanitize(k, 40)).filter(Boolean).slice(0, 20) : [], price_cents: price, price_approved: b.price_approved === true && price !== null, deposit_cents: deposit, return_days: returnDays, terms_text: terms, terms_approved: b.terms_approved === true && !!terms, active: b.active !== false, updated_at: new Date().toISOString() };
      const existing = await one(db, 'business_services', { organization_id: orgId, name });
      const saved = existing ? (await db.update('business_services', { id: existing.id, organization_id: orgId }, row))[0] : await db.insert('business_services', row);
      // Anything that was waiting on this decision moves on by itself.
      for (const j of (await db.select('journeys', { organization_id: orgId, service_id: saved.id })).filter((x) => x.waiting_on === 'owner')) await advance(db, j);
      return res.status(200).json({ ok: true, service: saved });
    }
    if (op === 'save-offer') {
      const code = sanitize(b.code, 40).toUpperCase(), pct = Number(b.percent_off);
      if (!/^[A-Z0-9-]{3,40}$/.test(code) || !Number.isInteger(pct) || pct < 1 || pct > 100) return res.status(400).json({ error: 'Enter a code (letters, numbers, dashes) and a whole-number percent from 1 to 100.' });
      const row = { organization_id: orgId, trigger_type: sanitize(b.trigger_type, 40), channel: sanitize(b.channel, 40) || null, code, description: sanitize(b.description, 300) || `${pct}% off`, percent_off: pct, approved: b.approved === true, active: b.active !== false, expires_at: b.expires_at || null };
      if (!['social_comment', 'social_like', 'social_follow', 'message', 'web_visit', 'manual'].includes(row.trigger_type)) return res.status(400).json({ error: 'Choose what earns this offer.' });
      const existing = await one(db, 'business_offers', { organization_id: orgId, code });
      return res.status(200).json({ ok: true, offer: existing ? (await db.update('business_offers', { id: existing.id, organization_id: orgId }, row))[0] : await db.insert('business_offers', row) });
    }
    const jid = sanitize(b.journey_id, 100);
    const j = UUID_RE.test(jid) ? await one(db, 'journeys', { id: jid, organization_id: orgId }) : null;
    if (!j) return res.status(404).json({ error: 'Not found' });
    let next;
    // A person at the business entering a payment is always 'owner_recorded'. Only Stripe's
    // signed Connect webhook (api/_cardPayments.js) records 'provider_verified'.
    if (op === 'record-payment') next = await recordPayment(db, j, { amountCents: Number(b.amount_cents), source: 'owner_recorded', reference: sanitize(b.reference, 120) });
    else if (op === 'complete') next = await completeWork(db, j, { note: sanitize(b.note, 2000), by: caller.email || caller.id });
    else if (op === 'pause' || op === 'resume') next = await setPaused(db, j, op === 'pause', caller.email || caller.id);
    else return res.status(400).json({ error: 'Unknown action' });
    await emailAfter(db, j);
    return res.status(200).json({ ok: true, next });
  } catch (err) {
    if (err.expected) return res.status(err.status).json({ error: err.message, code: err.code });
    if (err.stripeError) return res.status(502).json({ error: `Stripe could not complete that: ${err.message}` });
    console.error('[journey]', err.message);
    return res.status(502).json({ error: 'That step could not be confirmed. Nothing further was changed.' });
  }
}
