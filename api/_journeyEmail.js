// Email for each customer's request (Nova system 16): the quote, each invoice and a reminder the
// day before the appointment, from the business's name, with replies going to the business.
//
// Sent only when Nova's email is switched on (api/_email.js), the business has switched email on
// with a reply address and a mailing address, and the customer gave an email address. These are
// messages about a request the customer made (no marketing), so they carry the business's details
// and no unsubscribe link. Each one is sent once: a sent email is recorded on the request, and the
// provider gets the same idempotency key, so a retry can never send it twice. Free on Resend's
// free plan; within the daily caps in api/_email.js.
import { emailSwitch, emailCaps, sendEmail, validEmail } from './_email.js';
import { reminderBalance, reminderCopy, reminderKey } from './_balanceReminders.js';
import { customerLink, money, recordStep } from './_journey.js';

const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;
const DOC_KINDS = { quote: 'quoted', deposit_invoice: 'deposit_due', balance_invoice: 'balance_due' };
const dayStart = (now) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
const firstName = (name) => (String(name || '').trim().split(/\s+/)[0] || '').replace(/[^\p{L}'-]/gu, '').slice(0, 40);
const when = (iso, timeZone) => new Date(iso).toLocaleString('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// What this request should have emailed by now and has not: the current quote or invoice, and a
// reminder when the appointment starts in the next 12 to 36 hours.
async function due(db, j, now) {
  const out = [];
  const docKind = Object.keys(DOC_KINDS).find((k) => DOC_KINDS[k] === j.stage);
  if (docKind && (docKind !== 'quote' || j.waiting_reason === 'accept_quote')) {
    const docs = await db.select('journey_documents', { journey_id: j.id, kind: docKind, status: 'issued' }, { order: 'seq.desc', limit: 1 });
    if (docs[0]) {
      const doc = docs[0];
      out.push({ kind: docKind, key: `email:${docKind}:${doc.id}`, doc });
      if (reminderBalance(j, doc) > 0 && now - new Date(doc.created_at) >= 7 * 86400000) {
        const keys = { idempotency_key: `${j.id}:${reminderKey(doc)}:approved` };
        if (await one(db, 'journey_events', keys)) out.push({ kind: 'balance_reminder', key: 'email:' + reminderKey(doc), doc });
      }
    }
  }
  if (j.stage === 'scheduled' && j.slot_id) {
    const slot = await one(db, 'voice_calendar_slots', { id: j.slot_id, organization_id: j.organization_id });
    const hours = slot ? (new Date(slot.start_at) - now) / 3_600_000 : -1;
    if (hours > 12 && hours <= 36) out.push({ kind: 'reminder', key: `email:reminder:${slot.id}:${slot.start_at}`, slot });
  }
  return out;
}

function compose(kind, { business, agent, contact, svc, doc, slot, link, timeZone }) {
  const hi = firstName(contact.name) ? `Hi ${firstName(contact.name)},` : 'Hi,';
  const sign = `\n\n${business}\n${agent.mailing_address}\nQuestions? Reply to this email.`;
  if (kind === 'quote') return { subject: `Your quote from ${business}`, text: `${hi}\n\nHere is your quote from ${business}:\n\n${doc.body}\n\nSee it, accept it and choose a time here:\n${link}${sign}` };
  if (kind === 'deposit_invoice' || kind === 'balance_invoice') {
    return { subject: `${kind === 'deposit_invoice' ? 'Deposit' : 'Invoice'} from ${business}: ${money(doc.amount_cents)}`, text: `${hi}\n\n${doc.body}\n\nSee how to pay here:\n${link}${sign}` };
  }
  return { subject: `Reminder: ${svc?.name || 'your appointment'} with ${business}`, text: `${hi}\n\nThis is a reminder that ${svc?.name || 'your appointment'} with ${business} is on ${when(slot.start_at, timeZone)}.\n\nYour request, if anything changes:\n${link}${sign}` };
}

// Sends whatever this request is due. Never throws for a provider problem; returns what happened.
export async function sendJourneyEmails(db, j, { env = process.env, now = new Date(), timeZone = 'America/New_York' } = {}) {
  if (!emailSwitch(env).on) return { sent: [], skipped: 'email_off' };
  const items = await due(db, j, now);
  if (!items.length) return { sent: [], skipped: 'nothing_due' };
  const agent = await one(db, 'business_agents', { organization_id: j.organization_id });
  if (!agent?.email_enabled || !validEmail(agent.reply_email) || !agent.mailing_address) return { sent: [], skipped: 'business_email_off' };
  const contact = j.contact_id ? await one(db, 'crm_contacts', { id: j.contact_id, organization_id: j.organization_id }) : null;
  if (!validEmail(contact?.email)) return { sent: [], skipped: 'no_customer_email' };
  const svc = j.service_id ? await one(db, 'business_services', { id: j.service_id, organization_id: j.organization_id }) : null;
  const caps = emailCaps(env);
  const sent = [];
  let link = null; // one private link per run: a new link retires the one before it
  for (const item of items) {
    const key = `${j.id}:${item.key}`;
    if (await one(db, 'journey_events', { idempotency_key: key })) continue; // already sent
    const today = await db.select('journey_events', { action: 'email_sent', created_at: { gte: dayStart(now) } }, { limit: 5000 });
    if (today.filter((e) => e.organization_id === j.organization_id).length >= caps.perBusiness || today.length >= caps.total) return { sent, skipped: 'daily_cap' };
    let balance = 0;
    if (item.kind === 'balance_reminder') {
      const live = await one(db, 'journeys', { id: j.id, organization_id: j.organization_id });
      const doc = await one(db, 'journey_documents', { id: item.doc.id, organization_id: j.organization_id, journey_id: j.id });
      const recipient = await one(db, 'crm_contacts', { id: j.contact_id, organization_id: j.organization_id });
      balance = live && reminderBalance(live, doc);
      if (!balance || !recipient?.email_consent || recipient.do_not_contact || recipient.email !== contact.email) continue;
      // Only one sender can claim it. An ambiguous delivery stays in the event trail for staff review.
      if (!(await recordStep(db, j, { agent: 'accounting', action: 'balance_reminder_attempt', key: item.key + ':attempt', detail: { document_id: doc.id, amount_cents: balance } }))) continue;
    }
    link ||= await customerLink(db, j);
    const { subject, text } = item.kind === 'balance_reminder' ? { subject: `Your open invoice with ${agent.business_name}`, text: `${reminderCopy(balance, agent.business_name)}\n\n${link}\n\n${agent.business_name}\n${agent.mailing_address}` } : compose(item.kind, { business: agent.business_name, agent, contact, svc, doc: item.doc, slot: item.slot, link, timeZone });
    const out = await sendEmail({ to: contact.email, subject, text, fromName: agent.business_name, replyTo: agent.reply_email, idempotencyKey: key.slice(0, 256) }, env);
    if (!out.ok || !out.id) {
      try { await db.insert('journey_events', { organization_id: j.organization_id, journey_id: j.id, agent: 'front_desk', action: 'email_failed', status: 'failed', detail: { kind: item.kind, error: String(out.error).slice(0, 200) }, idempotency_key: `${key}:failed:${dayStart(now).slice(0, 10)}` }); } catch (err) { if (err.status !== 409) throw err; }
      continue;
    }
    try { await db.insert('journey_events', { organization_id: j.organization_id, journey_id: j.id, agent: item.kind === 'reminder' ? 'front_desk' : 'accounting', action: 'email_sent', status: 'done', detail: { kind: item.kind, provider_id: out.id, document_id: item.doc?.id }, idempotency_key: key }); }
    catch (err) { if (err.status !== 409) throw err; }
    sent.push(item.kind);
  }
  return { sent };
}

// The daily run (cron): reminders for tomorrow's appointments, and any quote or invoice email that
// could not go out at the time. Looks at requests changed in the last 7 days and every upcoming one.
export async function dailyJourneyEmails(db, { env = process.env, now = new Date() } = {}) {
  if (!emailSwitch(env).on) return { checked: 0, sent: 0, skipped: 'email_off' };
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const recent = await db.select('journeys', { updated_at: { gte: since } }, { limit: 2000 });
  const scheduled = await db.select('journeys', { stage: 'scheduled' }, { limit: 2000 });
  const approved = await db.select('journey_events', { action: 'balance_reminder_approved' }, { order: 'created_at.desc', limit: 2000 });
  const reminderJobs = [];
  for (const e of approved) {
    const j = await one(db, 'journeys', { id: e.journey_id, organization_id: e.organization_id, stage: 'balance_due' });
    if (j) reminderJobs.push(j);
  }
  const all = [...new Map([...recent, ...scheduled, ...reminderJobs].map((j) => [j.id, j])).values()].filter((j) => !j.paused && ['quoted', 'deposit_due', 'balance_due', 'scheduled'].includes(j.stage));
  let sent = 0;
  for (const j of all) {
    try { sent += (await sendJourneyEmails(db, j, { env, now })).sent.length; }
    catch (err) { console.error('[journey-email]', j.id, err.message); }
  }
  return { checked: all.length, sent };
}
