// Nova Operations — the customer journey for a client business. Persists every step and every state
// change; re-checks tenant scope on every object (every query carries organization_id).
import { dbGet, dbOne, dbInsert, dbPatch, dbRpc, enc, nowIso, appBase } from '../_sales/core.js';
import { stripeRequest } from '../_stripe.js';
import { textPdf } from '../_sales/pdf.js';
import { calcomConfigured, getSlots as calcomSlots, createBooking as calcomCreate, rescheduleBooking as calcomReschedule, cancelBooking as calcomCancel } from '../_calcom.js';
import * as R from './rules.js';
import { sendSms, orgSettings } from './messaging.js';
import { extractService } from './model.js';

export const ERR = (status, message, extra = {}) => Object.assign(new Error(message), { status, expose: true, ...extra });
const one = async (table, orgId, id, select = '*') => dbOne(`${table}?id=eq.${enc(id)}&organization_id=eq.${enc(orgId)}&select=${select}`);

// ---------------------------------------------------------------------------------------------- transitions
// Conditional update (only from the expected state) + an append-only transition record. A lost race → 409.
export async function transition({ orgId, entity, table, id, field = 'status', from, to, actor, reason = null, evidence = {}, version = null, patch = {} }) {
  const machine = entity === 'fulfillment' ? 'fulfillment' : entity;
  if (from !== to && !R.canTransition(machine, from, to)) throw ERR(409, `Cannot move ${entity} from ${from} to ${to}`);
  const rows = await dbPatch(table, `id=eq.${enc(id)}&organization_id=eq.${enc(orgId)}&${field}=eq.${enc(from)}`, { [field]: to, ...patch, ...(table === 'ops_jobs' || table === 'ops_deposits' || table === 'ops_campaigns' ? { updated_at: nowIso() } : {}) });
  if (!rows.length) throw ERR(409, `${entity} changed meanwhile; reload and try again`);
  await dbInsert('ops_transitions', { organization_id: orgId, entity, entity_id: id, from_state: from, to_state: to, actor_type: actor?.type || 'system', actor_id: actor?.id ? String(actor.id) : null, reason, evidence, version });
  return rows[0];
}

// ---------------------------------------------------------------------------------------------- configuration
export async function businessContext(orgId) {
  const [org, ops, wave] = await Promise.all([
    dbOne(`organizations?id=eq.${enc(orgId)}&select=id,name,kind`),
    dbOne(`ops_business_settings?organization_id=eq.${enc(orgId)}&select=*`),
    orgSettings(orgId),
  ]);
  if (!org) throw ERR(404, 'Business not found');
  return { org, ops: ops || { organization_id: orgId, calendar_provider: 'nova', slot_interval_minutes: 30, hold_minutes: 20, lead_time_hours: 12, booking_horizon_days: 21 }, wave, display_name: ops?.display_name || org.name };
}
export const approvedServices = (orgId) => dbGet(`ops_price_rules?organization_id=eq.${enc(orgId)}&status=eq.approved&select=*&order=service_key.asc`);

export async function busyIntervals(orgId) {
  const rows = await dbGet(`ops_bookings?organization_id=eq.${enc(orgId)}&status=in.(held,confirmed)&end_at=gte.${enc(nowIso())}&select=start_at,end_at,status,hold_expires_at`);
  const now = Date.now();
  return rows.filter((b) => b.status === 'confirmed' || !b.hold_expires_at || new Date(b.hold_expires_at).getTime() > now).map((b) => ({ start: b.start_at, end: b.end_at }));
}
export async function availability(orgId, serviceKey, { now = new Date(), limit = 3, ctx = null, busy = null } = {}) {
  const c = ctx || await businessContext(orgId);
  const rule = (await approvedServices(orgId)).find((r) => r.service_key === serviceKey);
  if (!rule) return { ok: false, reason: 'no_approved_service', slots: [] };
  if (!c.wave.timezone) return { ok: false, reason: 'timezone_not_configured', slots: [] };
  const b = busy || await busyIntervals(orgId);
  let slots = R.generateSlots({ now, timeZone: c.wave.timezone, businessHours: c.wave.business_hours, durationMinutes: rule.duration_minutes, bufferMinutes: rule.buffer_minutes, intervalMinutes: c.ops.slot_interval_minutes, leadHours: c.ops.lead_time_hours, horizonDays: c.ops.booking_horizon_days, busy: b, limit: c.ops.calendar_provider === 'calcom' ? 40 : limit });
  if (c.ops.calendar_provider === 'calcom') {
    const eventTypeId = c.ops.calcom_event_types?.[serviceKey];
    if (!calcomConfigured(process.env) || !eventTypeId) return { ok: false, reason: 'calendar_provider_not_configured', slots: [] };
    try {
      const ext = await calcomSlots(process.env, { eventTypeId, startDate: now.toISOString().slice(0, 10), endDate: new Date(now.getTime() + c.ops.booking_horizon_days * 86400_000).toISOString().slice(0, 10), timeZone: c.wave.timezone });
      if (!ext.ok) return { ok: false, reason: 'calendar_provider_error', detail: `${ext.kind}${ext.status ? ` ${ext.status}` : ''}${ext.error ? `: ${ext.error}` : ''}`, slots: [] };
      const open = new Set((ext.slots || []).map((s) => new Date(s.start || s).toISOString()));
      slots = slots.filter((s) => open.has(s.start)).slice(0, limit); // must be free in BOTH Nova and the provider
    } catch (e) { return { ok: false, reason: 'calendar_provider_error', detail: e.message, slots: [] }; }
  }
  return { ok: true, slots, rule };
}

// ---------------------------------------------------------------------------------------------- jobs
export async function openJobForConversation({ orgId, contact, conversation, channel, isTest = false }) {
  const existing = await dbOne(`ops_jobs?organization_id=eq.${enc(orgId)}&conversation_id=eq.${enc(conversation.id)}&state=in.(new,qualifying,owner_quote_required,quoted,booking,awaiting_agreement,awaiting_deposit,escalated)&select=*`);
  if (existing) return existing;
  const testBiz = isTest || !!contact.is_test || !!(await dbOne(`ops_business_settings?organization_id=eq.${enc(orgId)}&is_test=eq.true&select=organization_id`));
  const ins = await dbInsert('ops_jobs', { organization_id: orgId, contact_id: contact.id, conversation_id: conversation.id, source_channel: channel, state: 'new', is_test: testBiz });
  if (ins.conflict) return dbOne(`ops_jobs?organization_id=eq.${enc(orgId)}&conversation_id=eq.${enc(conversation.id)}&state=neq.lost&state=neq.cancelled&state=neq.confirmed&select=*`);
  await dbInsert('ops_transitions', { organization_id: orgId, entity: 'job', entity_id: ins.row.id, from_state: null, to_state: 'new', actor_type: 'system', reason: `inquiry via ${channel}` });
  return ins.row;
}

export async function quoteJob({ orgId, job, serviceKey, optionKeys = [], actor }) {
  const rule = (await approvedServices(orgId)).find((r) => r.service_key === serviceKey);
  const q = R.computeQuote(rule, optionKeys);
  if (!q.ok) {
    if (q.reason === 'owner_quote_required' && ['new', 'qualifying'].includes(job.state)) {
      if (job.state === 'new') job = await transition({ orgId, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from: 'new', to: 'qualifying', actor, reason: 'service identified' });
      return { job: await transition({ orgId, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from: job.state, to: 'owner_quote_required', actor, reason: 'service is priced by quote', patch: { qualification: { ...job.qualification, service_key: serviceKey } } }), quote: q };
    }
    throw ERR(409, `Cannot quote: ${q.reason}`);
  }
  if (job.state === 'new') job = await transition({ orgId, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from: 'new', to: 'qualifying', actor, reason: 'service identified' });
  const from = job.state;
  if (!['qualifying', 'owner_quote_required', 'escalated', 'quoted'].includes(from)) throw ERR(409, `Job is ${from}; it cannot be re-quoted now`);
  const patch = { qualification: { ...job.qualification, service_key: serviceKey, options: optionKeys }, price_rule_id: rule.id, price_snapshot: q.snapshot, total_cents: q.total_cents, deposit_cents: q.deposit_cents, currency: q.currency };
  if (from === 'quoted') { const [j] = await dbPatch('ops_jobs', `id=eq.${enc(job.id)}&organization_id=eq.${enc(orgId)}&state=eq.quoted`, patch); return { job: j, quote: q }; }
  return { job: await transition({ orgId, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from, to: 'quoted', actor, reason: `approved price v${rule.version}`, evidence: { price_rule_id: rule.id, total_cents: q.total_cents }, version: String(rule.version), patch }), quote: q };
}

// Owner-entered quote for quote-only scope: binding prices come from a person with ops.configure, recorded with reason.
export async function ownerQuote({ orgId, job, totalCents, depositCents, durationMinutes, reason, actor }) {
  if (!Number.isInteger(totalCents) || totalCents <= 0 || !Number.isInteger(depositCents) || depositCents < 0 || depositCents > totalCents) throw ERR(400, 'Enter whole-cent total and deposit (deposit ≤ total)');
  if (!reason || String(reason).trim().length < 10) throw ERR(400, 'Record the basis for this quote (10+ characters)');
  const snap = { owner_quote: true, service_key: job.qualification?.service_key || 'custom', service_name: job.qualification?.service_name || 'Custom quote', total_cents: totalCents, deposit_cents: depositCents, currency: 'usd', duration_minutes: durationMinutes || 120, buffer_minutes: 0, quoted_by: actor.id, quoted_at: nowIso(), basis: String(reason).slice(0, 500) };
  return transition({ orgId, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from: job.state, to: 'quoted', actor, reason: 'owner quote', evidence: { basis: snap.basis }, patch: { price_snapshot: snap, total_cents: totalCents, deposit_cents: depositCents, currency: 'usd' } });
}

// Hold → the database's exclusion constraint settles simultaneous requests; a conflict returns ok:false.
export async function holdSlot({ orgId, job, slot, actor }) {
  // Idempotent: the same job asking again for the same time (a redelivery) gets its existing live hold back.
  const mine = await dbOne(`ops_bookings?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=eq.held&start_at=eq.${enc(new Date(slot.start).toISOString())}&hold_expires_at=gt.${enc(nowIso())}&select=*`);
  if (mine) return { ok: true, booking: mine, job, existing: true };
  const c = await businessContext(orgId);
  const snap = job.price_snapshot; if (!snap) throw ERR(409, 'Quote the job before booking');
  const startMs = new Date(slot.start).getTime();
  const end = new Date(startMs + (snap.duration_minutes + (snap.buffer_minutes || 0)) * 60_000).toISOString();
  // recheck availability right before committing
  const fresh = (await busyIntervals(orgId)).some((b) => startMs < new Date(b.end).getTime() && new Date(b.start).getTime() < new Date(end).getTime());
  if (fresh) return { ok: false, reason: 'slot_taken' };
  let booking;
  try { [booking] = await dbRpc('ops_hold_slot', { p_org: orgId, p_job: job.id, p_contact: job.contact_id, p_start: new Date(startMs).toISOString(), p_end: end, p_hold_minutes: c.ops.hold_minutes, p_is_test: !!job.is_test }).then((r) => (Array.isArray(r) ? r : [r])); }
  catch (e) { if (/23P01|exclusion|ops_bookings_no_overlap|conflicting key/i.test(`${e.message} ${e.detail}`)) return { ok: false, reason: 'slot_taken' }; throw e; }
  await dbInsert('ops_transitions', { organization_id: orgId, entity: 'booking', entity_id: booking.id, from_state: null, to_state: 'held', actor_type: actor?.type || 'system', actor_id: actor?.id ? String(actor.id) : null, reason: 'tentative hold', evidence: { start: booking.start_at, hold_expires_at: booking.hold_expires_at } });
  const j = job.state === 'booking' ? job : await transition({ orgId, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from: job.state, to: 'booking', actor, reason: 'time held' });
  return { ok: true, booking, job: j };
}

// Agreement from the APPROVED template only; customer link carries a random token (only its hash is stored).
export async function sendAgreement({ orgId, job, booking, actor, templateKey = 'service_agreement' }) {
  const tpl = await dbOne(`ops_agreement_templates?organization_id=eq.${enc(orgId)}&template_key=eq.${enc(templateKey)}&status=eq.approved&select=*`);
  if (!tpl) return { ok: false, reason: 'no_approved_agreement_template' };
  const c = await businessContext(orgId);
  const contact = await one('crm_contacts', orgId, job.contact_id, 'id,name,phone_e164,email');
  const snap = job.price_snapshot;
  const r = R.renderAgreement(tpl.body, {
    business_name: c.display_name, customer_name: contact?.name && !/^Unknown/.test(contact.name) ? contact.name : 'Customer',
    service_name: snap.service_name, price: R.formatMoney(snap.total_cents, snap.currency), deposit: R.formatMoney(snap.deposit_cents || 0, snap.currency),
    appointment: booking ? R.formatSlot(booking.start_at, c.wave.timezone) : 'to be scheduled', agreement_date: new Date().toISOString().slice(0, 10),
  });
  if (!r.ok) return { ok: false, reason: r.reason, fields: r.fields };
  // A new appointment or price is a material change: any earlier sent OR signed version is voided and must be re-signed.
  const prior = await dbOne(`ops_agreements?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=in.(sent,signed)&select=id,status`);
  if (prior) await transition({ orgId, entity: 'agreement', table: 'ops_agreements', id: prior.id, from: prior.status, to: 'void', actor, reason: 'superseded by a new version (re-signature required)' });
  const ins = await dbInsert('ops_agreements', { organization_id: orgId, job_id: job.id, template_id: tpl.id, template_version: tpl.version, title: tpl.title, body_rendered: r.text, content_sha256: r.sha256, expires_at: new Date(Date.now() + 72 * 3600_000).toISOString(), esign_consent_text: R.ESIGN_CONSENT, supersedes_id: prior?.id || null });
  if (ins.conflict) throw ERR(409, 'An agreement for this job already exists');
  await dbInsert('ops_transitions', { organization_id: orgId, entity: 'agreement', entity_id: ins.row.id, from_state: null, to_state: 'sent', actor_type: actor?.type || 'system', actor_id: actor?.id ? String(actor.id) : null, reason: `template ${tpl.template_key} v${tpl.version}`, evidence: { content_sha256: r.sha256, legal_review: tpl.legal_review }, version: String(tpl.version) });
  const t = R.newToken();
  const j = await transition({ orgId, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from: job.state, to: 'awaiting_agreement', actor, reason: 'agreement sent', patch: { customer_token_hash: t.hash, customer_token_expires_at: new Date(Date.now() + 14 * 86400_000).toISOString() } });
  return { ok: true, agreement: ins.row, job: j, link: `${appBase()}/service/${t.token}` };
}

// ---------------------------------------------------------------------------------------------- conversation turn (worker)
export async function handleInboundTurn({ orgId, conversationId, messageId, now = new Date() }) {
  const conv = await one('wave1_conversations', orgId, conversationId);
  if (!conv) return { skipped: 'conversation_not_found' };
  const msg = await one('wave1_messages', orgId, messageId, 'id,body,direction,created_at,purpose');
  if (!msg || msg.direction !== 'inbound') return { skipped: 'not_an_inbound_message' };
  if (msg.purpose && msg.purpose !== 'message' && msg.purpose !== null) return { skipped: `keyword_${msg.purpose}` };
  if (conv.staff_takeover) return { skipped: 'staff_takeover' };
  // Redelivered turn (e.g. the worker crashed after replying): the reply for this inbound message already exists.
  if (await dbOne(`wave1_messages?organization_id=eq.${enc(orgId)}&idempotency_key=eq.${enc(`turn:${messageId}`)}&select=id`)) return { skipped: 'already_answered' };
  const contact = await one('crm_contacts', orgId, conv.contact_id);
  if (!contact || contact.suppressed) return { skipped: 'contact_suppressed' };
  const c = await businessContext(orgId);
  if (c.wave.paused) return { skipped: 'organization_paused' };
  const services = await approvedServices(orgId);
  let job = await openJobForConversation({ orgId, contact, conversation: conv, channel: conv.channel === 'form' ? 'form' : 'sms', isTest: !!c.ops.is_test });
  const busy = await busyIntervals(orgId);
  const slotCache = {};
  const slotsFor = (key) => {
    if (!slotCache[key]) { const rule = services.find((s) => s.service_key === key); slotCache[key] = rule && c.wave.timezone ? R.generateSlots({ now, timeZone: c.wave.timezone, businessHours: c.wave.business_hours, durationMinutes: rule.duration_minutes, bufferMinutes: rule.buffer_minutes, intervalMinutes: c.ops.slot_interval_minutes, leadHours: c.ops.lead_time_hours, horizonDays: c.ops.booking_horizon_days, busy, limit: 3 }) : []; }
    return slotCache[key];
  };
  let modelHint = null;
  if (conv.engine_state === 'awaiting_service' && c.ops.ai_extraction_enabled && !R.matchService(msg.body, services)) {
    modelHint = await extractService({ text: msg.body, services, enabledForOrg: true });
    if (modelHint) await dbInsert('ops_transitions', { organization_id: orgId, entity: 'job', entity_id: job.id, from_state: job.state, to_state: job.state, actor_type: 'model', reason: 'service extraction suggestion', evidence: modelHint, version: modelHint.prompt_version });
  }
  const d = R.decide({ state: conv.engine_state, context: conv.engine_context || {}, text: msg.body, services, slotsFor, business: { display_name: c.display_name }, timeZone: c.wave.timezone, modelHint });
  const actor = { type: 'system', id: 'core_engine' };
  let reply = d.reply; let nextState = d.nextState; const ctxOut = d.context; let purpose = 'reply';
  for (const a of d.actions) {
    if (a.type === 'escalate') {
      if (job.state !== 'escalated' && R.canTransition('job', job.state, 'escalated')) job = await transition({ orgId, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from: job.state, to: 'escalated', actor, reason: a.reason, patch: { escalation_reason: a.reason } });
      await notifyEscalation({ orgId, job, reason: a.reason, c });
    } else if (a.type === 'set_service') {
      try { ({ job } = await quoteJob({ orgId, job, serviceKey: a.service_key, actor })); } catch (e) { if (e.status !== 409) throw e; }
    } else if (a.type === 'owner_quote') {
      try { ({ job } = await quoteJob({ orgId, job, serviceKey: a.service_key, actor })); } catch (e) { if (e.status !== 409) throw e; }
      await notifyEscalation({ orgId, job, reason: 'owner_quote_required', c });
    } else if (a.type === 'hold_slot') {
      const held = await holdSlot({ orgId, job, slot: a.slot, actor });
      if (!held.ok) {
        const fresh = (await availability(orgId, ctxOut.service_key, { now, ctx: c })).slots;
        ctxOut.slot_options = fresh; nextState = fresh.length ? 'awaiting_time' : 'escalated';
        reply = fresh.length ? `Sorry, that time was just taken. Open times:\n${fresh.map((o, i) => `${i + 1}) ${R.formatSlot(o.start, c.wave.timezone)}`).join('\n')}\nReply with a number.` : 'Sorry, that time was just taken. A team member will reply with options.';
        continue;
      }
      job = held.job;
      const sent = await sendAgreement({ orgId, job, booking: held.booking, actor });
      if (!sent.ok) {
        nextState = 'escalated';
        reply = `Your time is held for ${c.ops.hold_minutes} minutes. A team member will send the booking details shortly.`;
        job = await transition({ orgId, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from: job.state, to: 'escalated', actor, reason: sent.reason, patch: { escalation_reason: sent.reason } });
        await notifyEscalation({ orgId, job, reason: sent.reason, c });
      } else {
        job = sent.job; nextState = 'awaiting_completion'; purpose = 'booking_link';
        const dep = job.deposit_cents ? ` and pay the ${R.formatMoney(job.deposit_cents, job.currency)} deposit` : '';
        reply = `Held: ${R.formatSlot(held.booking.start_at, c.wave.timezone)} for ${c.ops.hold_minutes} minutes. Review and sign the agreement${dep} here: ${sent.link}`;
      }
    }
  }
  await dbPatch('wave1_conversations', `id=eq.${enc(conv.id)}&organization_id=eq.${enc(orgId)}`, { engine_state: nextState, engine_context: ctxOut });
  let send = null;
  if (reply) send = await sendSms({ orgId, conversationId: conv.id, contactId: contact.id, body: reply, purpose, idempotencyKey: `turn:${messageId}`, triggerAt: msg.created_at, isTest: !!job.is_test, now });
  return { job_id: job.id, state: job.state, engine_state: nextState, reply_status: send?.status || 'no_reply', reply_reason: send?.reason || null };
}

async function notifyEscalation({ orgId, job, reason, c }) {
  const contacts = (c.wave.escalation_contacts || []).filter((x) => x.phone);
  await dbInsert('ops_incidents', { organization_id: orgId, check_key: `escalation:${job.id}`, severity: reason === 'emergency' ? 'critical' : 'warning', title: `Customer needs a person (${reason})`, detail: { job_id: job.id, reason } }).catch(() => null);
  return { owner_contacts: contacts.length };
}

// ---------------------------------------------------------------------------------------------- reschedule / cancel
// Move a job's active booking to a new time. The new time is held through the same database exclusion constraint as any
// booking (so it cannot collide with another customer); a confirmed booking stays confirmed only if its calendar source of
// truth (Nova, or Cal.com's own reply) accepts the move. The old booking is cancelled only after the new one exists.
export async function rescheduleJob({ orgId, job, start, reason, actor, notifyCustomer = false }) {
  if (!['booking', 'awaiting_agreement', 'awaiting_deposit', 'confirmed', 'escalated'].includes(job.state)) throw ERR(409, `Job is ${job.state}; there is no booking to move`);
  const startMs = new Date(start).getTime();
  if (!Number.isFinite(startMs) || startMs <= Date.now()) throw ERR(400, 'Choose a valid future start time');
  if (!reason || String(reason).trim().length < 3) throw ERR(400, 'A reason is required');
  const old = await dbOne(`ops_bookings?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=in.(held,confirmed)&select=*&order=created_at.desc`);
  if (!old) throw ERR(409, 'This job has no active booking to move');
  if (new Date(old.start_at).getTime() === startMs) return { ok: true, unchanged: true, booking: old };
  const c = await businessContext(orgId);
  const snap = job.price_snapshot; if (!snap) throw ERR(409, 'The job has no quote');
  const end = new Date(startMs + (snap.duration_minutes + (snap.buffer_minutes || 0)) * 60_000).toISOString();
  const others = (await dbGet(`ops_bookings?organization_id=eq.${enc(orgId)}&status=in.(held,confirmed)&end_at=gte.${enc(nowIso())}&id=neq.${enc(old.id)}&select=start_at,end_at,status,hold_expires_at`))
    .filter((b) => b.status === 'confirmed' || !b.hold_expires_at || new Date(b.hold_expires_at).getTime() > Date.now());
  if (startMs < new Date(old.end_at).getTime() && new Date(old.start_at).getTime() < new Date(end).getTime()) return { ok: false, reason: 'overlaps_current_booking', detail: 'Pick a time that does not overlap the current appointment, or cancel and rebook.' };
  if (others.some((b) => startMs < new Date(b.end_at).getTime() && new Date(b.start_at).getTime() < new Date(end).getTime())) return { ok: false, reason: 'slot_taken' };
  let nb;
  try { [nb] = await dbRpc('ops_hold_slot', { p_org: orgId, p_job: job.id, p_contact: job.contact_id, p_start: new Date(startMs).toISOString(), p_end: end, p_hold_minutes: c.ops.hold_minutes, p_is_test: !!job.is_test }).then((r) => (Array.isArray(r) ? r : [r])); }
  catch (e) { if (/23P01|exclusion|ops_bookings_no_overlap|conflicting key/i.test(`${e.message} ${e.detail}`)) return { ok: false, reason: 'slot_taken' }; throw e; }
  await dbInsert('ops_transitions', { organization_id: orgId, entity: 'booking', entity_id: nb.id, from_state: null, to_state: 'held', actor_type: actor?.type || 'system', actor_id: actor?.id ? String(actor.id) : null, reason: `reschedule from ${old.start_at}: ${String(reason).slice(0, 200)}`, evidence: { from_booking_id: old.id, from_start: old.start_at, to_start: nb.start_at } });
  const why = `rescheduled: ${String(reason).slice(0, 200)}`;
  let calendar = { provider: old.provider || 'nova', status: 'nova_calendar' };
  if (old.status === 'confirmed') {
    if (old.provider === 'calcom' && old.provider_booking_id) {
      const r = await calcomReschedule(process.env, old.provider_booking_id, { startIso: nb.start_at, reason });
      if (!r.ok) {
        // Release the new hold; the original appointment stands. An ambiguous reply needs a person to check Cal.com.
        await transition({ orgId, entity: 'booking', table: 'ops_bookings', id: nb.id, from: 'held', to: 'cancelled', actor, reason: `calendar provider did not accept the move (${r.kind})`, patch: { cancelled_at: nowIso(), cancel_reason: `provider ${r.kind}` } });
        if (r.kind === 'ambiguous') await notifyEscalation({ orgId, job, reason: 'calendar_reschedule_outcome_unknown_check_calcom', c });
        return { ok: false, reason: r.kind === 'ambiguous' ? 'calendar_outcome_unknown' : 'calendar_rejected', detail: r.error || null };
      }
      calendar = { provider: 'calcom', status: r.status, provider_booking_id: r.uid };
      if (r.status === 'confirmed') await transition({ orgId, entity: 'booking', table: 'ops_bookings', id: nb.id, from: 'held', to: 'confirmed', actor, reason: 'calendar provider accepted the new time', patch: { provider: 'calcom', provider_booking_id: r.uid, provider_status: r.status, confirmed_at: nowIso() } });
      else await dbPatch('ops_bookings', `id=eq.${enc(nb.id)}&organization_id=eq.${enc(orgId)}`, { provider: 'calcom', provider_booking_id: r.uid, provider_status: r.status });
    } else {
      await transition({ orgId, entity: 'booking', table: 'ops_bookings', id: nb.id, from: 'held', to: 'confirmed', actor, reason: 'confirmed in the Nova calendar at the new time', patch: { confirmed_at: nowIso(), provider_status: 'nova_confirmed' } });
    }
  }
  await transition({ orgId, entity: 'booking', table: 'ops_bookings', id: old.id, from: old.status, to: 'cancelled', actor, reason: why, patch: { cancelled_at: nowIso(), cancel_reason: why } });
  const agreement = await dbOne(`ops_agreements?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=in.(sent,signed)&select=id,status&order=created_at.desc`);
  let notice = null;
  if (notifyCustomer && job.conversation_id && job.contact_id) {
    notice = await sendSms({ orgId, conversationId: job.conversation_id, contactId: job.contact_id, body: `Your ${snap.service_name || 'appointment'} has moved to ${R.formatSlot(nb.start_at, c.wave.timezone)}. Reply here if that time does not work.`, purpose: 'booking_confirmation', idempotencyKey: `resched:${nb.id}`, actor, isTest: !!job.is_test });
  }
  const booking = await one('ops_bookings', orgId, nb.id);
  return { ok: true, booking, previous_booking_id: old.id, calendar,
    agreement_note: agreement ? (agreement.status === 'signed' ? 'The signed agreement names the original time. If the time is a term of your agreement, send an updated agreement for signature.' : 'The agreement awaiting signature names the original time. Send it again so it shows the new time.') : null,
    customer_notice: notice ? { status: notice.status, reason: notice.reason || null } : null };
}

// Cancels the calendar provider's copy of a booking (Nova's own row is moved by the caller). Failures become an incident,
// never a silent success.
export async function cancelProviderBooking({ orgId, booking, reason }) {
  if (booking.provider !== 'calcom' || !booking.provider_booking_id) return { provider: booking.provider || 'nova', status: 'not_applicable' };
  const r = await calcomCancel(process.env, booking.provider_booking_id, reason);
  if (r.ok) { await dbPatch('ops_bookings', `id=eq.${enc(booking.id)}&organization_id=eq.${enc(orgId)}`, { provider_status: 'cancelled' }); return { provider: 'calcom', status: 'cancelled' }; }
  await dbPatch('ops_bookings', `id=eq.${enc(booking.id)}&organization_id=eq.${enc(orgId)}`, { provider_status: `cancel_failed:${r.kind}` });
  await dbInsert('ops_incidents', { organization_id: orgId, check_key: `calendar_cancel_failed:${booking.id}`, severity: 'warning', title: 'Booking cancelled in Nova but not confirmed cancelled in Cal.com — check the calendar', detail: { booking_id: booking.id, provider_booking_id: booking.provider_booking_id, kind: r.kind } }).catch(() => null);
  return { provider: 'calcom', status: 'cancel_failed', kind: r.kind };
}

// ---------------------------------------------------------------------------------------------- customer link
export async function jobByToken(token) {
  if (!token || String(token).length < 20) return null;
  const job = await dbOne(`ops_jobs?customer_token_hash=eq.${enc(R.sha256(token))}&select=*`);
  if (!job || !job.customer_token_expires_at || new Date(job.customer_token_expires_at) < new Date()) return null;
  return job;
}
export async function customerView(token) {
  const job = await jobByToken(token);
  if (!job) throw ERR(404, 'This link is invalid or has expired.');
  const orgId = job.organization_id;
  const c = await businessContext(orgId);
  const [booking, agreement, deposit, account] = await Promise.all([
    dbOne(`ops_bookings?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=in.(held,confirmed,completed)&select=id,start_at,end_at,status,hold_expires_at,provider&order=created_at.desc`),
    dbOne(`ops_agreements?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=in.(sent,signed)&select=id,title,body_rendered,content_sha256,status,expires_at,esign_consent_text,signer_name,signed_at`),
    dbOne(`ops_deposits?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&select=id,amount_cents,currency,status,livemode,paid_at&order=created_at.desc`),
    dbOne(`ops_payment_accounts?organization_id=eq.${enc(orgId)}&select=mode,funds_recipient,live_enabled,stripe_account_ref`),
  ]);
  const holdExpired = booking?.status === 'held' && new Date(booking.hold_expires_at) < new Date();
  return {
    business: c.display_name, timezone: c.wave.timezone, is_test: !!job.is_test,
    request: { state: job.state, fulfillment_status: job.fulfillment_status, service_name: job.price_snapshot?.service_name, total_cents: job.total_cents, deposit_cents: job.deposit_cents, currency: job.currency, terms_version: job.price_snapshot?.version ?? null, owner_quote: !!job.price_snapshot?.owner_quote },
    booking: booking ? { start_at: booking.start_at, status: holdExpired ? 'expired' : booking.status, hold_expires_at: booking.hold_expires_at } : null,
    agreement: agreement ? { id: agreement.id, title: agreement.title, text: agreement.body_rendered, content_sha256: agreement.content_sha256, status: agreement.status, expires_at: agreement.expires_at, consent_text: agreement.esign_consent_text, signer_name: agreement.signer_name, signed_at: agreement.signed_at } : null,
    deposit: deposit ? { status: deposit.status, amount_cents: deposit.amount_cents, currency: deposit.currency, test_mode: !deposit.livemode, paid_at: deposit.paid_at } : null,
    payments: { available: (account?.mode === 'nova_test_platform' || (account?.mode === 'client_connected_account' && R.isStripeAccountId(account?.stripe_account_ref))) && String(process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test'), mode: account?.mode || 'not_configured', funds_recipient: account?.funds_recipient || null },
  };
}

export async function customerSign({ token, signerName, consent, contentSha256, ip, userAgent }) {
  const job = await jobByToken(token);
  if (!job) throw ERR(404, 'This link is invalid or has expired.');
  const orgId = job.organization_id;
  if (consent !== true) throw ERR(400, 'Please confirm you agree to sign electronically.');
  const name = String(signerName || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (name.length < 3) throw ERR(400, 'Type your full name to sign.');
  const ag = await dbOne(`ops_agreements?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=eq.sent&select=*`);
  if (!ag) throw ERR(409, 'There is no agreement waiting for a signature.');
  if (new Date(ag.expires_at) < new Date()) { await transition({ orgId, entity: 'agreement', table: 'ops_agreements', id: ag.id, from: 'sent', to: 'expired', actor: { type: 'system' }, reason: 'expired before signature' }); throw ERR(410, 'This agreement expired. Ask the business to send a new one.'); }
  if (contentSha256 !== ag.content_sha256 || R.sha256(ag.body_rendered) !== ag.content_sha256) throw ERR(409, 'The agreement text changed. Reload the page and read it again.');
  const booking = await dbOne(`ops_bookings?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=eq.held&select=*&order=created_at.desc`);
  if (booking && new Date(booking.hold_expires_at) < new Date()) throw ERR(410, 'The held time expired before signing. Reply to the business to choose a new time.');
  const signedAt = nowIso();
  const sigHash = R.sha256([ag.id, ag.content_sha256, name, signedAt, ip || '', userAgent || ''].join('|'));
  const pdf = textPdf({ title: ag.title, blocks: [{ style: 'h1', text: ag.title }, ...ag.body_rendered.split(/\n{2,}/).map((t) => ({ style: 'p', text: t })), { style: 'gap' }, { style: 'h2', text: 'Electronic signature' }, { style: 'p', text: `Signed by: ${name}` }, { style: 'p', text: `Signed at (server time, UTC): ${signedAt}` }, { style: 'mono', text: `Content SHA-256: ${ag.content_sha256}` }, { style: 'mono', text: `Signature record: ${sigHash}` }, { style: 'p', text: `Consent: ${ag.esign_consent_text}` }] });
  const path = `ops/${orgId}/agreements/${ag.id}.pdf`;
  const up = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/ops-private/${path}`, { method: 'POST', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/pdf', 'x-upsert': 'false' }, body: pdf });
  const signed = await transition({ orgId, entity: 'agreement', table: 'ops_agreements', id: ag.id, from: 'sent', to: 'signed', actor: { type: 'customer', id: name }, reason: 'customer e-signature', evidence: { content_sha256: ag.content_sha256, signature_hash: sigHash }, patch: { signer_name: name, signed_at: signedAt, signer_ip: ip || null, signer_user_agent: String(userAgent || '').slice(0, 200), signature_hash: sigHash, signed_pdf_path: up.ok ? path : null } });
  let j = job;
  const c = await businessContext(orgId);
  // time to pay: at least 35 minutes, longer than Stripe's minimum 30-minute checkout session, so a paid checkout never lands on an expired hold
  if (booking) await dbPatch('ops_bookings', `id=eq.${enc(booking.id)}&organization_id=eq.${enc(orgId)}&status=eq.held`, { hold_expires_at: new Date(Date.now() + Math.max(c.ops.hold_minutes, 35) * 60_000).toISOString() });
  if ((job.deposit_cents || 0) > 0) j = await transition({ orgId, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from: job.state, to: 'awaiting_deposit', actor: { type: 'customer', id: name }, reason: 'agreement signed' });
  else j = await confirmJob({ orgId, job, actor: { type: 'customer', id: name }, reason: 'agreement signed; no deposit required' });
  return { agreement: { status: signed.status, signed_at: signed.signed_at, content_sha256: signed.content_sha256 }, job_state: j.state };
}

export async function customerAgreementPdf(token) {
  const job = await jobByToken(token);
  if (!job) throw ERR(404, 'This link is invalid or has expired.');
  const ag = await dbOne(`ops_agreements?organization_id=eq.${enc(job.organization_id)}&job_id=eq.${enc(job.id)}&status=eq.signed&select=signed_pdf_path`);
  if (!ag?.signed_pdf_path) throw ERR(404, 'No signed copy yet.');
  const r = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/sign/ops-private/${ag.signed_pdf_path}`, { method: 'POST', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 300 }) });
  if (!r.ok) throw ERR(404, 'Signed copy unavailable.');
  const { signedURL } = await r.json();
  return { url: `${process.env.SUPABASE_URL}/storage/v1${signedURL}`, expires_in: 300 };
}

// Stripe-hosted test checkout. Amount from the job's snapshot; funds recipient must be configured; live blocked.
export async function customerDepositCheckout(token) {
  const job = await jobByToken(token);
  if (!job) throw ERR(404, 'This link is invalid or has expired.');
  const orgId = job.organization_id;
  if (job.state !== 'awaiting_deposit') throw ERR(409, job.state === 'confirmed' ? 'This booking is already confirmed.' : 'Sign the agreement first.');
  if (process.env.OPS_KILL_SWITCH === 'true') throw ERR(503, 'Online payments are temporarily paused. The business will contact you.');
  const acct = await dbOne(`ops_payment_accounts?organization_id=eq.${enc(orgId)}&select=*`);
  const key = String(process.env.STRIPE_SECRET_KEY || '');
  if (!acct || acct.mode === 'not_configured') throw ERR(409, 'Online deposits are not set up for this business yet. The business will contact you.');
  // Client-owned payments (owner decision 2026-10-16): the deposit is a direct charge on the business's own connected Stripe
  // account. Nova's account never receives the customer's money; Nova bills its own fees separately.
  const connected = acct.mode === 'client_connected_account';
  if (connected && !R.isStripeAccountId(acct.stripe_account_ref)) throw ERR(409, 'The business has not connected its Stripe account yet. The business will contact you.');
  if (!key) throw ERR(409, 'Online payment is not configured.');
  if (key.startsWith('sk_live') || key.startsWith('rk_live')) throw ERR(409, 'Live payments are disabled.');
  const booking = await dbOne(`ops_bookings?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=in.(held,confirmed)&select=*&order=created_at.desc`);
  if (!booking || (booking.status === 'held' && new Date(booking.hold_expires_at) < new Date())) throw ERR(410, 'The held time expired. Reply to the business to choose a new time.');
  let dep = await dbOne(`ops_deposits?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=in.(created,checkout_open)&select=*`);
  if (!dep) {
    const ins = await dbInsert('ops_deposits', { organization_id: orgId, job_id: job.id, amount_cents: job.deposit_cents, currency: job.currency || 'usd', status: 'created', account_mode: acct.mode, livemode: false });
    dep = ins.conflict ? await dbOne(`ops_deposits?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=in.(created,checkout_open,paid)&select=*`) : ins.row;
    if (!ins.conflict) await dbInsert('ops_transitions', { organization_id: orgId, entity: 'deposit', entity_id: dep.id, from_state: null, to_state: 'created', actor_type: 'customer', reason: 'deposit started', evidence: { amount_cents: dep.amount_cents } });
  }
  if (dep.status === 'paid') throw ERR(409, 'This deposit is already paid.');
  if (dep.status === 'checkout_open' && dep.checkout_url) return { url: dep.checkout_url };
  const c = await businessContext(orgId);
  const session = await stripeRequest(key, 'POST', 'checkout/sessions', {
    mode: 'payment', success_url: `${appBase()}/service/${encodeURIComponent(token)}?deposit=returned`, cancel_url: `${appBase()}/service/${encodeURIComponent(token)}?deposit=cancelled`,
    line_items: [{ quantity: 1, price_data: { currency: dep.currency, unit_amount: dep.amount_cents, product_data: { name: `Deposit — ${job.price_snapshot?.service_name || 'service'} (${c.display_name})` } } }],
    metadata: { ops_deposit_id: dep.id, organization_id: orgId, job_id: job.id, expected_amount_cents: String(dep.amount_cents) },
    payment_intent_data: { metadata: { ops_deposit_id: dep.id, organization_id: orgId, job_id: job.id } },
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
  }, { idempotencyKey: `ops-deposit:${dep.id}:${dep.amount_cents}`, ...(connected ? { stripeAccount: acct.stripe_account_ref } : {}) });
  await transition({ orgId, entity: 'deposit', table: 'ops_deposits', id: dep.id, from: dep.status, to: 'checkout_open', actor: { type: 'customer' }, reason: 'Stripe Checkout session created', patch: { provider_session_id: session.id, checkout_url: session.url } }).catch((e) => { if (e.status !== 409) throw e; });
  return { url: session.url };
}

// Called only after api/stripe.js verified the signature and recorded the event id (duplicates never reach here).
export async function applyOpsStripeEvent(event) {
  const obj = event.data?.object || {}; const meta = obj.metadata || {};
  if (!meta.ops_deposit_id) return { handled: false };
  const dep = await dbOne(`ops_deposits?id=eq.${enc(String(meta.ops_deposit_id).slice(0, 60))}&organization_id=eq.${enc(String(meta.organization_id || '').slice(0, 60))}&select=*`);
  if (!dep) return { handled: true, applied: false, reason: 'deposit not found for that organization' };
  // The event must come from the account that holds the money: the business's connected account for a connected deposit,
  // Nova's own platform account (no event.account) otherwise. A matching id from another account is ignored.
  if (dep.account_mode === 'client_connected_account') {
    const acct = await dbOne(`ops_payment_accounts?organization_id=eq.${enc(dep.organization_id)}&select=stripe_account_ref`);
    if (!event.account || event.account !== acct?.stripe_account_ref) return { handled: true, applied: false, reason: 'event is not from the business\'s connected account' };
  } else if (event.account) return { handled: true, applied: false, reason: 'connected-account event for a platform deposit' };
  const orgId = dep.organization_id; const actor = { type: 'provider', id: event.id };
  const type = event.type;
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(type)) {
    const keyLive = String(process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live');
    if (Boolean(event.livemode) !== keyLive || event.livemode) return { handled: true, applied: false, reason: 'mode mismatch or live event — ignored' };
    if (obj.payment_status !== 'paid') return { handled: true, applied: false, reason: 'not paid' };
    if (obj.amount_total !== dep.amount_cents || String(obj.currency).toLowerCase() !== dep.currency.toLowerCase()) return { handled: true, applied: false, reason: 'amount or currency mismatch' };
    if (dep.provider_session_id && obj.id !== dep.provider_session_id) return { handled: true, applied: false, reason: 'session does not match deposit' };
    if (dep.status === 'paid') return { handled: true, applied: false, reason: 'already paid' };
    if (dep.status === 'created') await transition({ orgId, entity: 'deposit', table: 'ops_deposits', id: dep.id, from: 'created', to: 'checkout_open', actor, reason: 'provider session', patch: { provider_session_id: obj.id } }).catch(() => null);
    const cur = await one('ops_deposits', orgId, dep.id);
    await transition({ orgId, entity: 'deposit', table: 'ops_deposits', id: dep.id, from: cur.status, to: 'paid', actor, reason: 'Stripe confirmed payment', evidence: { event_id: event.id, amount_total: obj.amount_total }, patch: { paid_at: nowIso(), provider_event_id: event.id, provider_payment_intent: obj.payment_intent || null, livemode: !!event.livemode } });
    const job = await one('ops_jobs', orgId, dep.job_id);
    const liveHold = await dbOne(`ops_bookings?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=in.(held,confirmed)&select=id`);
    if (job.state === 'awaiting_deposit' && liveHold) await confirmJob({ orgId, job, actor, reason: 'deposit paid' });
    else if (job.state !== 'confirmed') {
      // Money arrived but the time is gone (or the job moved on): a person must reschedule or refund. Never auto-confirm.
      if (R.canTransition('job', job.state, 'escalated')) await transition({ orgId, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from: job.state, to: 'escalated', actor, reason: 'deposit_paid_without_live_booking', patch: { escalation_reason: 'deposit_paid_without_live_booking' } });
      await dbInsert('ops_incidents', { organization_id: orgId, check_key: `deposit_without_booking:${dep.id}`, severity: 'critical', title: 'Deposit paid but the held time had expired — reschedule or refund', detail: { job_id: job.id, deposit_id: dep.id } }).catch(() => null);
    }
    return { handled: true, applied: true };
  }
  if (type === 'checkout.session.expired') {
    if (dep.status === 'checkout_open') await transition({ orgId, entity: 'deposit', table: 'ops_deposits', id: dep.id, from: 'checkout_open', to: 'expired', actor, reason: 'checkout expired' });
    return { handled: true, applied: true };
  }
  if (type === 'charge.refunded') {
    const refunded = obj.amount_refunded || 0;
    if (dep.status === 'paid' || dep.status === 'partially_refunded') await transition({ orgId, entity: 'deposit', table: 'ops_deposits', id: dep.id, from: dep.status, to: refunded >= dep.amount_cents ? 'refunded' : 'partially_refunded', actor, reason: 'refund recorded by Stripe', patch: { refunded_cents: refunded, refunded_at: nowIso() } });
    return { handled: true, applied: true };
  }
  return { handled: true, applied: false, reason: `ignored ${type}` };
}

// Confirms the booking with its source of truth, then the job; fulfillment becomes ready.
export async function confirmJob({ orgId, job, actor, reason }) {
  const c = await businessContext(orgId);
  const booking = await dbOne(`ops_bookings?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=eq.held&select=*&order=created_at.desc`);
  if (booking) {
    if (c.ops.calendar_provider === 'calcom') {
      const contact = await one('crm_contacts', orgId, job.contact_id, 'name,email,phone_e164');
      try {
        const b = await calcomCreate(process.env, { eventTypeId: c.ops.calcom_event_types?.[job.price_snapshot?.service_key], startIso: booking.start_at, attendee: { name: contact?.name || 'Customer', email: contact?.email, timeZone: c.wave.timezone, phoneNumber: contact?.phone_e164 }, metadata: { ops_booking_id: booking.id } });
        if (!b.ok) {
          await dbPatch('ops_bookings', `id=eq.${enc(booking.id)}&organization_id=eq.${enc(orgId)}`, { provider: 'calcom', provider_status: b.kind === 'ambiguous' ? 'outcome_unknown' : `failed:${b.kind}` });
          await notifyEscalation({ orgId, job, reason: (b.kind === 'ambiguous' ? 'calendar_outcome_unknown_check_calcom' : `calendar_booking_failed_${b.kind}`).slice(0, 120), c });
        } else {
          const patch = { provider: 'calcom', provider_booking_id: b.uid, provider_status: b.status };
          if (b.status === 'confirmed') await transition({ orgId, entity: 'booking', table: 'ops_bookings', id: booking.id, from: 'held', to: 'confirmed', actor, reason: 'calendar provider accepted', patch: { ...patch, confirmed_at: nowIso() } });
          else await dbPatch('ops_bookings', `id=eq.${enc(booking.id)}&organization_id=eq.${enc(orgId)}`, patch);
        }
      } catch (e) { await notifyEscalation({ orgId, job, reason: `calendar_booking_failed: ${e.message}`.slice(0, 120), c }); }
    } else {
      await transition({ orgId, entity: 'booking', table: 'ops_bookings', id: booking.id, from: 'held', to: 'confirmed', actor, reason: 'confirmed in the Nova calendar (source of truth for this business)', patch: { confirmed_at: nowIso(), provider_status: 'nova_confirmed' } });
    }
  }
  const b2 = await dbOne(`ops_bookings?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=eq.confirmed&select=id`);
  const j = await transition({ orgId, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from: job.state, to: 'confirmed', actor, reason });
  if (b2) await transition({ orgId, entity: 'fulfillment', table: 'ops_jobs', id: job.id, field: 'fulfillment_status', from: 'not_ready', to: 'ready', actor, reason: 'booking confirmed, agreement signed, deposit settled' });
  if (job.conversation_id && job.contact_id) {
    const bk = await dbOne(`ops_bookings?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&select=start_at,status&order=created_at.desc`);
    if (bk?.status === 'confirmed') await sendSms({ orgId, conversationId: job.conversation_id, contactId: job.contact_id, body: `Confirmed: ${job.price_snapshot?.service_name || 'your appointment'} on ${R.formatSlot(bk.start_at, c.wave.timezone)}. Reply here with any questions.`, purpose: 'booking_confirmation', idempotencyKey: `confirm:${job.id}`, isTest: !!job.is_test });
  }
  return j;
}

// ---------------------------------------------------------------------------------------------- fulfillment
export async function completeJob({ orgId, jobId, actor, notes, outcome = 'completed', enqueue }) {
  const job = await one('ops_jobs', orgId, jobId);
  if (!job) throw ERR(404, 'Job not found');
  if (!['ready', 'in_progress'].includes(job.fulfillment_status)) throw ERR(409, `Fulfillment is ${job.fulfillment_status}`);
  const j = await transition({ orgId, entity: 'fulfillment', table: 'ops_jobs', id: job.id, field: 'fulfillment_status', from: job.fulfillment_status, to: outcome, actor, reason: notes ? String(notes).slice(0, 300) : outcome, patch: outcome === 'completed' ? { completed_at: nowIso(), completed_by: actor.id, completion_notes: notes ? String(notes).slice(0, 2000) : null } : {} });
  const bk = await dbOne(`ops_bookings?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=eq.confirmed&select=id`);
  if (bk) await transition({ orgId, entity: 'booking', table: 'ops_bookings', id: bk.id, from: 'confirmed', to: outcome === 'completed' ? 'completed' : 'no_show', actor, reason: outcome });
  if (outcome === 'completed') {
    const at = new Date(Date.now() + 2 * 3600_000).toISOString();
    for (const kind of ['review_request', 'referral_invite']) {
      const ins = await dbInsert('ops_followups', { organization_id: orgId, job_id: job.id, contact_id: job.contact_id, kind, scheduled_at: at });
      if (ins.row && enqueue) await enqueue({ job_type: 'ops_followup_send', organization_id: orgId, payload: { followup_id: ins.row.id }, scheduled_at: at, idempotency_key: `ops_followup:${ins.row.id}` });
    }
  }
  return j;
}

// Neutral feedback request (link shown to everyone) and an independent referral invitation (only with
// approved terms). Both need recorded marketing consent; neither depends on the other or on a rating.
export async function sendFollowup({ orgId, followupId, now = new Date(), enqueue = null }) {
  const f = await one('ops_followups', orgId, followupId);
  if (!f || f.status !== 'scheduled') return { skipped: f ? `already_${f.status}` : 'not_found' };
  const job = await one('ops_jobs', orgId, f.job_id);
  const c = await businessContext(orgId);
  const block = async (reason) => { await dbPatch('ops_followups', `id=eq.${enc(f.id)}&organization_id=eq.${enc(orgId)}&status=eq.scheduled`, { status: 'blocked', blocked_reason: reason }); return { status: 'blocked', reason }; };
  if (job?.fulfillment_status !== 'completed') return block('job_not_completed');
  let body;
  if (f.kind === 'review_request') {
    if (!c.ops.review_url) return block('no_review_link_configured');
    body = `Thanks for choosing ${c.display_name}. We'd value your honest feedback about your visit: ${c.ops.review_url}  Reply STOP to opt out.`;
  } else {
    if (c.ops.referral_terms_status !== 'approved' || !c.ops.referral_terms) return block('referral_terms_not_approved');
    let ref = await dbOne(`ops_referrals?organization_id=eq.${enc(orgId)}&source_job_id=eq.${enc(job.id)}&select=*`);
    if (!ref) { const code = `REF-${R.newToken().token.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()}`; ref = (await dbInsert('ops_referrals', { organization_id: orgId, referrer_contact_id: job.contact_id, source_job_id: job.id, code })).row; }
    body = `${c.display_name}: if you know someone who could use us, share your code ${ref.code}. ${c.ops.referral_terms}  Reply STOP to opt out.`;
  }
  // Permission first (a follow-up without consent is blocked once, never deferred), then quiet hours defer.
  const who = await one('crm_contacts', orgId, job.contact_id, 'suppressed,do_not_contact,sms_consent,sms_consent_source,sms_consent_at');
  if (who?.suppressed) return block('suppressed_opt_out');
  if (who?.do_not_contact) return block('do_not_contact');
  if (!who?.sms_consent || !who.sms_consent_source || !who.sms_consent_at) return block('no_recorded_consent');
  const ws = await orgSettings(orgId);
  if (ws.timezone && R.localParts(now, ws.timezone) && enqueue) {
    const { isQuietHour, localHour, nextSendWindow } = await import('../_wave1.js');
    const qh = ws.quiet_hours || { start: 21, end: 8 };
    if (isQuietHour(localHour(now, ws.timezone), qh)) {
      const at = nextSendWindow(now, ws.timezone, qh);
      await dbPatch('ops_followups', `id=eq.${enc(f.id)}&organization_id=eq.${enc(orgId)}&status=eq.scheduled`, { scheduled_at: at });
      await enqueue({ job_type: 'ops_followup_send', organization_id: orgId, payload: { followup_id: f.id }, scheduled_at: at, idempotency_key: `ops_followup:${f.id}:${at}` });
      return { status: 'deferred', until: at };
    }
  }
  const r = await sendSms({ orgId, conversationId: job.conversation_id, contactId: job.contact_id, body, purpose: f.kind === 'review_request' ? 'review_request' : 'referral_invite', idempotencyKey: `followup:${f.id}`, isTest: !!job.is_test, now });
  // Courtesy limits (minimum gap, daily cap) postpone a follow-up instead of dropping it — for at most 3 days.
  if (r.status === 'blocked' && ['min_gap', 'frequency_limit'].includes(r.reason) && enqueue && now - new Date(f.created_at) < 3 * 86400_000) {
    const at = new Date(now.getTime() + (r.reason === 'min_gap' ? 11 * 60_000 : 24 * 3600_000)).toISOString();
    await dbPatch('ops_followups', `id=eq.${enc(f.id)}&organization_id=eq.${enc(orgId)}&status=eq.scheduled`, { scheduled_at: at });
    await enqueue({ job_type: 'ops_followup_send', organization_id: orgId, payload: { followup_id: f.id }, scheduled_at: at, idempotency_key: `ops_followup:${f.id}:${at}` });
    return { status: 'deferred', reason: r.reason, until: at };
  }
  const status = r.status === 'provider_accepted' ? 'provider_accepted' : r.status === 'dry_run' ? 'dry_run' : r.status === 'failed' ? 'failed' : 'blocked';
  await dbPatch('ops_followups', `id=eq.${enc(f.id)}&organization_id=eq.${enc(orgId)}`, { status, blocked_reason: status === 'blocked' ? r.reason : null, message_id: r.message?.id || null });
  return { status, reason: r.reason || null };
}

// A referral is credited once per referred job, and only "verified" when that job's deposit is provider-confirmed.
export async function applyReferralCode({ orgId, jobId, code, actor }) {
  const ref = await dbOne(`ops_referrals?organization_id=eq.${enc(orgId)}&code=eq.${enc(String(code || '').trim().toUpperCase())}&select=*`);
  if (!ref || ref.status === 'void') throw ERR(404, 'Unknown referral code');
  if (ref.referred_job_id && ref.referred_job_id !== jobId) throw ERR(409, 'This code was already used');
  const job = await one('ops_jobs', orgId, jobId); if (!job) throw ERR(404, 'Job not found');
  if (job.contact_id === ref.referrer_contact_id) throw ERR(409, 'A customer cannot refer themselves');
  await dbPatch('ops_referrals', `id=eq.${enc(ref.id)}&organization_id=eq.${enc(orgId)}&referred_job_id=is.null`, { referred_job_id: jobId, status: 'used' });
  await dbPatch('ops_jobs', `id=eq.${enc(jobId)}&organization_id=eq.${enc(orgId)}`, { referral_code_used: ref.code });
  await dbInsert('ops_transitions', { organization_id: orgId, entity: 'job', entity_id: jobId, from_state: job.state, to_state: job.state, actor_type: actor?.type || 'user', actor_id: actor?.id ? String(actor.id) : null, reason: `referral code ${ref.code} applied` });
  return ref;
}
export async function verifyReferrals(orgId) {
  const used = await dbGet(`ops_referrals?organization_id=eq.${enc(orgId)}&status=eq.used&select=*`);
  let verified = 0;
  for (const r of used) {
    const dep = await dbOne(`ops_deposits?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(r.referred_job_id)}&status=eq.paid&select=id`);
    if (dep) { await dbPatch('ops_referrals', `id=eq.${enc(r.id)}&status=eq.used`, { status: 'verified', verified_deposit_id: dep.id }); verified++; }
  }
  return verified;
}

// Expired holds release their time; their job returns to "quoted" so the customer can pick again.
export async function expireHolds(now = new Date()) {
  const stale = await dbGet(`ops_bookings?status=eq.held&hold_expires_at=lt.${enc(now.toISOString())}&select=id,organization_id,job_id&limit=200`);
  for (const b of stale) {
    try {
      await transition({ orgId: b.organization_id, entity: 'booking', table: 'ops_bookings', id: b.id, from: 'held', to: 'expired', actor: { type: 'system', id: 'hold_expiry' }, reason: 'hold expired' });
      const job = await one('ops_jobs', b.organization_id, b.job_id);
      if (job && ['booking', 'awaiting_agreement', 'awaiting_deposit'].includes(job.state)) {
        await transition({ orgId: b.organization_id, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from: job.state, to: job.state === 'booking' ? 'quoted' : 'booking', actor: { type: 'system', id: 'hold_expiry' }, reason: 'held time expired' }).catch(() => null);
        if (job.conversation_id) await dbPatch('wave1_conversations', `id=eq.${enc(job.conversation_id)}&organization_id=eq.${enc(b.organization_id)}`, { engine_state: 'awaiting_service', engine_context: {} });
      }
    } catch (e) { if (e.status !== 409) throw e; }
  }
  return stale.length;
}
