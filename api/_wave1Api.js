// `wave1` resource for api/client.js (kept in its own module: the 12-function Vercel cap means new
// resources are dispatched from client.js, and this keeps that file from growing further).
// PUBLIC (signature/token-verified, no session): sms-inbound, call-status, form-intake.
// STAFF (organization-scoped via has_permission on the SPECIFIC org): settings, conversations,
// takeover, operator, pilots, pilot-permissions, pilot-checklist, preflight, pilot-results.
import { randomBytes } from 'node:crypto';
import { createPostgrestRepo } from './_wave1Repo.js';
import { calcomConfigured, getSlots, createBooking, getBooking, cancelBooking } from './_calcom.js';
import { handleSmsInbound, handleCallStatus, handleSmsStatus, handleFormIntake } from './_wave1Handlers.js';

const STANDARD_CHECKLIST = [
  ['preflight', 'settings_saved', 'Messaging settings saved for this organization'],
  ['preflight', 'timezone_set', 'Business timezone configured'],
  ['preflight', 'business_hours_set', 'Business hours configured'],
  ['preflight', 'escalation_contact_set', 'At least one human escalation contact'],
  ['preflight', 'number_assigned', 'Phone number assigned and unique to this organization'],
  ['preflight', 'template_reviewed', 'Missed-call template written and reviewed by the owner'],
  ['preflight', 'provider_registration_approved', 'Messaging registration approved by the provider (where required)'],
  ['preflight', 'webhook_urls_registered', 'Twilio webhook URLs registered and pointing at this deployment'],
  ['preflight', 'worker_running', 'Worker deployed and processing jobs'],
  ['acceptance', 'controlled_call_test', 'Controlled inbound call reaches the right business and creates the right CRM record'],
  ['acceptance', 'missed_call_followup_test', 'Eligible missed call produces exactly one follow-up'],
  ['acceptance', 'reply_stops_automation_test', 'Inbound reply appears in the conversation and stops automation'],
  ['acceptance', 'opt_out_test', 'STOP stores suppression and blocks later automated sends'],
  ['acceptance', 'booking_test', 'Booking confirms only after the scheduling source confirms; duplicate request does not double-book'],
  ['acceptance', 'human_handoff_test', 'Human handoff/callback works and staff takeover prevents conflicting automation'],
  ['acceptance', 'isolation_test', 'This organization cannot see another organization\'s data'],
  ['go_live', 'owner_approval', 'Owner approved go-live'],
  ['go_live', 'pause_switch_tested', 'Organization and channel pause switches tested'],
  ['go_live', 'support_contact_confirmed', 'Support contact confirmed with the owner'],
];

// Forward-only pilot lifecycle with server-enforced entry conditions.
const NEXT = { proposed: ['agreed', 'closed'], agreed: ['onboarding', 'closed'], onboarding: ['active', 'closed'], active: ['review', 'closed'], review: ['converted', 'extended', 'closed'], extended: ['review', 'closed'], converted: [], closed: [] };

export async function handleWave1(req, res, op, deps) {
  const { requireStaff, requireOrgAccess, sanitize, rateLimit } = deps;
  const env = process.env;
  const repoFor = () => createPostgrestRepo({ url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY });
  const base = (env.WAVE1_PUBLIC_BASE || '').replace(/\/$/, '');
  const xml = (r) => { res.setHeader('Content-Type', r.type || 'application/json'); return res.status(r.status).send(typeof r.body === 'string' ? r.body : JSON.stringify(r.body)); };

  // ------------------------------------------------------------ public, verified webhooks
  if (op === 'sms-inbound' || op === 'call-status' || op === 'sms-status') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const url = base ? `${base}/api/client?resource=wave1&op=${op}` : '';
    const params = req.body && typeof req.body === 'object' ? req.body : {};
    const fn = op === 'sms-inbound' ? handleSmsInbound : op === 'sms-status' ? handleSmsStatus : handleCallStatus;
    try { return xml(await fn({ url, params, signature: req.headers['x-twilio-signature'] }, repoFor(), env)); }
    catch (err) { console.error(`[wave1:${op}] error:`, err.message); return res.status(500).json({ error: 'Webhook processing failed' }); } // non-2xx → Twilio retries; dedupe makes that safe
  }
  if (op === 'form-intake') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!rateLimit(req, res, 20, 60_000)) return;
    try { const r = await handleFormIntake({ token: sanitize(req.query?.token || req.body?.token, 100), body: req.body || {} }, repoFor()); return res.status(r.status).json(r.body); }
    catch (err) { console.error('[wave1:form-intake] error:', err.message); return res.status(500).json({ ok: false, error: 'Submission failed' }); }
  }

  // ------------------------------------------------------------ staff
  const caller = await requireStaff(req, res);
  if (!caller) return;
  if (!rateLimit(req, res, 60, 60_000)) return;
  const repo = repoFor();
  const b = req.body || {};
  const orgId = sanitize(req.method === 'GET' ? req.query?.organization_id : b.organization_id, 100);
  const needAdmin = req.method === 'POST' && ['settings', 'pilots', 'pilot-permissions', 'pilot-checklist'].includes(op);
  if (!(await requireOrgAccess(req, res, orgId, needAdmin ? 'admin.view' : 'growth.view'))) return;
  const get = async (path) => { const { url, key } = { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY }; const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }); return r.ok ? r.json() : []; };
  const e = encodeURIComponent;

  if (op === 'settings') {
    if (req.method === 'GET') return res.status(200).json((await repo.getSettings(orgId)) || null);
    const rec = { organization_id: orgId, updated_at: new Date().toISOString() };
    if (b.timezone !== undefined) {
      const tz = sanitize(b.timezone, 60);
      try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { return res.status(400).json({ error: 'Invalid IANA timezone' }); }
      rec.timezone = tz;
    }
    if (b.quiet_hours) { const s = Number(b.quiet_hours.start), en = Number(b.quiet_hours.end); if (![s, en].every((n) => Number.isInteger(n) && n >= 0 && n <= 23)) return res.status(400).json({ error: 'quiet_hours start/end must be integer hours 0-23' }); rec.quiet_hours = { start: s, end: en }; }
    if (b.paused !== undefined) rec.paused = b.paused === true;
    if (Array.isArray(b.channels_paused)) rec.channels_paused = b.channels_paused.filter((c) => ['sms', 'voice', 'email'].includes(c));
    if (b.max_automated_per_day !== undefined) rec.max_automated_per_day = Math.max(0, Math.min(50, Number(b.max_automated_per_day) || 0));
    if (b.min_gap_minutes !== undefined) rec.min_gap_minutes = Math.max(0, Math.min(1440, Number(b.min_gap_minutes) || 0));
    if (b.sms_number_ref !== undefined) { const n = sanitize(b.sms_number_ref, 20); rec.sms_number_ref = n || null; }
    if (Array.isArray(b.escalation_contacts)) rec.escalation_contacts = b.escalation_contacts.slice(0, 10).map((c) => ({ name: sanitize(c.name, 100), phone: sanitize(c.phone, 30), email: sanitize(c.email, 200) }));
    if (b.business_hours && typeof b.business_hours === 'object') rec.business_hours = b.business_hours;
    if (b.templates && typeof b.templates === 'object') rec.templates = Object.fromEntries(Object.entries(b.templates).slice(0, 20).map(([k, v]) => [sanitize(k, 50), sanitize(v, 480)]));
    if (b.calcom_event_type_id !== undefined) { const n = Number(b.calcom_event_type_id); rec.calcom_event_type_id = Number.isInteger(n) && n > 0 ? n : null; }
    if (b.provider_registration) rec.provider_registration = ['unknown', 'not_started', 'pending', 'approved', 'rejected'].includes(b.provider_registration) ? b.provider_registration : 'unknown';
    if (b.rotate_form_token === true) rec.form_token = randomBytes(24).toString('base64url'); // unguessable, rotatable
    const existing = await repo.getSettings(orgId);
    const { url, key } = { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY };
    const r = await fetch(`${url}/rest/v1/wave1_org_settings${existing ? `?organization_id=eq.${e(orgId)}` : ''}`, { method: existing ? 'PATCH' : 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(rec) });
    if (!r.ok) { const t = await r.text(); return res.status(/duplicate|unique/i.test(t) ? 409 : 500).json({ error: /duplicate|unique/i.test(t) ? 'That number is already assigned to another organization' : 'Failed to save settings' }); }
    return res.status(200).json({ ok: true, settings: (await r.json())[0] });
  }

  if (op === 'conversations') {
    const id = sanitize(req.query?.id, 100);
    if (id) {
      const conv = await repo.getConversation(orgId, id);
      if (!conv) return res.status(404).json({ error: 'Conversation not found' });
      return res.status(200).json({ ...conv, contact: await repo.getContact(orgId, conv.contact_id), messages: await get(`wave1_messages?organization_id=eq.${e(orgId)}&conversation_id=eq.${e(id)}&order=created_at.asc`) });
    }
    return res.status(200).json(await get(`wave1_conversations?organization_id=eq.${e(orgId)}&order=last_inbound_at.desc.nullslast&limit=100&select=*,crm_contacts(name,phone_e164,suppressed)`));
  }

  if (op === 'takeover' && req.method === 'POST') {
    const id = sanitize(b.conversation_id, 100);
    const conv = await repo.getConversation(orgId, id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const on = b.on !== false;
    await repo.updateConversation(orgId, id, { staff_takeover: on, takeover_by: on ? caller.id : null });
    return res.status(200).json({ ok: true, staff_takeover: on });
  }

  if (op === 'operator') {
    const [messages, jobs, appts, settings] = await Promise.all([
      get(`wave1_messages?organization_id=eq.${e(orgId)}&status=in.(blocked,failed,undelivered,ambiguous)&order=created_at.desc&limit=50`),
      get(`jobs?organization_id=eq.${e(orgId)}&status=in.(dead_letter,failed)&order=created_at.desc&limit=50`),
      get(`wave1_appointments?organization_id=eq.${e(orgId)}&start_at=gte.${e(new Date().toISOString())}&order=start_at.asc&limit=50`),
      repo.getSettings(orgId),
    ]);
    return res.status(200).json({
      problem_messages: messages, dead_or_failed_jobs: jobs, upcoming_appointments: appts,
      paused: settings?.paused === true, channels_paused: settings?.channels_paused || [],
      // Stated plainly rather than silently omitted: not implemented yet.
      not_available: ['integration health (no provider heartbeat implemented)', 'usage and spend limits (no usage metering implemented)', 'failed call handoffs (no transfer records implemented)', 'worker liveness (no heartbeat implemented)'],
    });
  }

  if (op === 'preflight') {
    const s = (await repo.getSettings(orgId)) || {};
    const has = (v) => (Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? Object.keys(v).length > 0 : !!v);
    const checks = [
      ['settings_saved', !!s.organization_id, 'No messaging settings row exists for this organization'],
      ['timezone_set', has(s.timezone), 'Timezone not configured — automated sends are blocked until it is'],
      ['business_hours_set', has(s.business_hours), 'Business hours not configured'],
      ['escalation_contact_set', has(s.escalation_contacts), 'No human escalation contact'],
      ['number_assigned', has(s.sms_number_ref), 'No phone number assigned'],
      ['template_reviewed', has(s.templates?.missed_call), 'No missed-call template written'],
      ['provider_registration_approved', s.provider_registration === 'approved', `Provider registration is "${s.provider_registration || 'unknown'}"`],
      ['webhook_base_configured', !!env.WAVE1_PUBLIC_BASE, 'WAVE1_PUBLIC_BASE is not set on this deployment — webhooks fail closed'],
      ['twilio_credentials_present', !!env.TWILIO_AUTH_TOKEN && !!env.TWILIO_ACCOUNT_SID, 'Twilio credentials missing on this deployment'],
      ['live_sends_enabled', env.WAVE1_SEND_ENABLED === 'true', 'Live sending is OFF (WAVE1_SEND_ENABLED != true) — follow-ups are dry runs. This is deliberate until authorized.'],
    ].map(([key, ok, why]) => ({ key, status: ok ? 'pass' : 'fail', detail: ok ? null : why }));
    // These cannot be established from this endpoint — reported as UNKNOWN, never as pass.
    checks.push({ key: 'worker_running', status: 'unknown', detail: 'No worker heartbeat is implemented; verify the worker process manually' });
    checks.push({ key: 'webhook_urls_registered_with_provider', status: 'unknown', detail: 'Cannot be verified from here; confirm in the Twilio console' });
    return res.status(200).json({ ready: checks.every((c) => c.status === 'pass'), checks });
  }

  // ------------------------------------------------------------ availability + appointments
  const dbw = (path, method, body) => fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { method, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(body) });
  const calFail = (r) => res.status({ not_configured: 409, auth: 502, rate_limited: 429, unreachable: 502, rejected: 422, ambiguous: 202 }[r.kind] || 502).json({ ok: false, error: r.kind === 'not_configured' ? 'Cal.com is not connected on this deployment (CALCOM_API_KEY is not set)' : `Cal.com ${r.kind}${r.error ? `: ${r.error}` : ''}` });

  if (op === 'availability') {
    const s = (await repo.getSettings(orgId)) || {};
    if (!s.calcom_event_type_id) return res.status(409).json({ error: 'No Cal.com event type is configured for this organization' });
    const from = sanitize(req.query?.start, 10), to = sanitize(req.query?.end, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return res.status(400).json({ error: 'start and end must be YYYY-MM-DD' });
    const r = await getSlots(env, { eventTypeId: s.calcom_event_type_id, startDate: from, endDate: to, timeZone: s.timezone || 'UTC' });
    return r.ok ? res.status(200).json({ source: 'calcom', slots: r.slots }) : calFail(r);
  }

  if (op === 'appointments') {
    if (req.method === 'GET') return res.status(200).json(await get(`wave1_appointments?organization_id=eq.${e(orgId)}&order=start_at.asc&limit=200`));
    const action = sanitize(b.action, 20);
    const appt = async (id) => (await get(`wave1_appointments?id=eq.${e(id)}&organization_id=eq.${e(orgId)}&limit=1`))[0] || null;
    const patchAppt = async (id, patch) => { const r = await dbw(`wave1_appointments?id=eq.${e(id)}&organization_id=eq.${e(orgId)}`, 'PATCH', patch); return r.ok ? (await r.json())[0] : null; };
    // Only a CONFIRMED booking stops automated follow-up; a request must not.
    const markBooked = (contactId) => dbw(`wave1_conversations?organization_id=eq.${e(orgId)}&contact_id=eq.${e(contactId)}`, 'PATCH', { appointment_confirmed: true });
    const startsAt = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) || d.getTime() < Date.now() ? null : d; };

    if (action === 'request-manual' || action === 'book') {
      const contact = await repo.getContact(orgId, sanitize(b.contact_id, 100));
      if (!contact) return res.status(404).json({ error: 'Contact not found in this organization' });
      const start = startsAt(b.start_at);
      if (!start) return res.status(400).json({ error: 'start_at must be a valid future time' });
      const minutes = Math.max(5, Math.min(480, Number(b.duration_minutes) || 30));
      const end = new Date(start.getTime() + minutes * 60_000);
      const clash = (await get(`wave1_appointments?organization_id=eq.${e(orgId)}&start_at=eq.${e(start.toISOString())}&status=in.(requested,confirmed)&select=id,contact_id`));
      if (clash.length) return res.status(409).json({ error: clash.some((c) => c.contact_id === contact.id) ? 'This contact already has an appointment at that time' : 'Another appointment already occupies that start time' });

      if (action === 'request-manual') {
        const r = await dbw('wave1_appointments', 'POST', { organization_id: orgId, contact_id: contact.id, start_at: start.toISOString(), end_at: end.toISOString(), status: 'requested', provider: 'manual', requested_via: sanitize(b.requested_via, 20) || 'staff', notes: sanitize(b.notes, 1000) || null });
        return r.ok ? res.status(200).json({ ok: true, appointment: (await r.json())[0], note: 'REQUESTED only — it becomes confirmed when staff record the confirmation' }) : res.status(500).json({ error: 'Failed to save the request' });
      }

      const s = (await repo.getSettings(orgId)) || {};
      if (!calcomConfigured(env)) return calFail({ kind: 'not_configured' });
      if (!s.calcom_event_type_id) return res.status(409).json({ error: 'No Cal.com event type is configured for this organization' });
      if (!contact.email) return res.status(409).json({ error: 'Cal.com needs the contact\'s email address to book' });
      const day = start.toISOString().slice(0, 10);
      const avail = await getSlots(env, { eventTypeId: s.calcom_event_type_id, startDate: day, endDate: day, timeZone: 'UTC' });
      if (!avail.ok) return calFail(avail);
      if (!avail.slots.includes(start.toISOString())) return res.status(409).json({ error: 'That time is not in the scheduling source\'s current availability', slots: avail.slots.slice(0, 20) });
      // Claim the slot locally first so a concurrent duplicate request is refused, then ask Cal.com.
      const claimR = await dbw('wave1_appointments', 'POST', { organization_id: orgId, contact_id: contact.id, start_at: start.toISOString(), end_at: end.toISOString(), status: 'requested', provider: 'calcom', requested_via: sanitize(b.requested_via, 20) || 'staff' });
      if (!claimR.ok) return res.status(500).json({ error: 'Failed to reserve the slot locally' });
      const claim = (await claimR.json())[0];
      const out = await createBooking(env, { eventTypeId: s.calcom_event_type_id, startIso: start.toISOString(), attendee: { name: contact.name, email: contact.email, timeZone: s.timezone || 'UTC', phoneNumber: contact.phone_e164 }, metadata: { nova_org: orgId, nova_appointment: claim.id } });
      if (out.ok) {
        const confirmed = out.status === 'confirmed';
        const row = await patchAppt(claim.id, { provider_booking_id: out.uid, status: out.status, end_at: out.end || claim.end_at, confirmed_at: confirmed ? new Date().toISOString() : null });
        if (confirmed) await markBooked(contact.id);
        return res.status(200).json({ ok: true, appointment: row, confirmed, note: confirmed ? 'Confirmed by the scheduling source' : 'Cal.com holds it as PENDING — the host must accept it. Not confirmed.' });
      }
      if (out.kind === 'ambiguous') {
        await patchAppt(claim.id, { notes: 'AMBIGUOUS: Cal.com may or may not have created this booking. Check Cal.com before retrying.' });
        return res.status(202).json({ ok: false, ambiguous: true, appointment_id: claim.id, error: 'The scheduling source did not answer clearly. Nothing is confirmed. Check Cal.com before retrying, then use sync.' });
      }
      await patchAppt(claim.id, { status: 'cancelled', notes: `Booking refused by scheduling source (${out.kind})` });
      return calFail(out);
    }

    if (action === 'sync') {
      const a = await appt(sanitize(b.id, 100));
      if (!a) return res.status(404).json({ error: 'Appointment not found' });
      if (a.provider !== 'calcom' || !a.provider_booking_id) return res.status(409).json({ error: 'Only a Cal.com booking with a booking id can be synced' });
      const g = await getBooking(env, a.provider_booking_id);
      if (!g.ok) return calFail(g);
      const row = await patchAppt(a.id, { status: g.status, end_at: g.end || a.end_at, confirmed_at: g.status === 'confirmed' ? a.confirmed_at || new Date().toISOString() : a.confirmed_at });
      if (g.status === 'confirmed') await markBooked(a.contact_id);
      return res.status(200).json({ ok: true, appointment: row });
    }

    if (action === 'confirm') {
      const a = await appt(sanitize(b.id, 100));
      if (!a) return res.status(404).json({ error: 'Appointment not found' });
      if (a.provider !== 'manual') return res.status(409).json({ error: 'Cal.com bookings are confirmed by Cal.com — use sync' });
      if (a.status !== 'requested') return res.status(409).json({ error: `Appointment is ${a.status}, not requested` });
      const note = sanitize(b.confirmation_note, 500);
      if (!note) return res.status(400).json({ error: 'Recording a confirmation needs a note on how it was confirmed with the customer' });
      const row = await patchAppt(a.id, { status: 'confirmed', confirmed_at: new Date().toISOString(), notes: `${a.notes ? a.notes + ' | ' : ''}Confirmed by ${caller.email || caller.id}: ${note}` });
      await markBooked(a.contact_id);
      return res.status(200).json({ ok: true, appointment: row });
    }

    if (action === 'cancel') {
      const a = await appt(sanitize(b.id, 100));
      if (!a) return res.status(404).json({ error: 'Appointment not found' });
      if (['cancelled', 'completed'].includes(a.status)) return res.status(409).json({ error: `Appointment is already ${a.status}` });
      if (a.provider === 'calcom' && a.provider_booking_id) {
        const c = await cancelBooking(env, a.provider_booking_id, sanitize(b.reason, 300));
        if (!c.ok) return calFail(c); // never mark cancelled locally if the scheduling source did not
      }
      return res.status(200).json({ ok: true, appointment: await patchAppt(a.id, { status: 'cancelled' }) });
    }
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }

  if (op === 'pilots') {
    if (req.method === 'GET') return res.status(200).json(await get(`pilots?organization_id=eq.${e(orgId)}&order=created_at.desc`));
    const { url, key } = { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY };
    const w = (path, method, body) => fetch(`${url}/rest/v1/${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(body) });
    const action = sanitize(b.action, 30);
    if (action === 'create') {
      if (!sanitize(b.name, 200)) return res.status(400).json({ error: 'name is required' });
      const r = await w('pilots', 'POST', { organization_id: orgId, name: sanitize(b.name, 200), business_id: sanitize(b.business_id, 100) || null });
      if (!r.ok) return res.status(500).json({ error: 'Failed to create pilot' });
      return res.status(200).json({ ok: true, pilot: (await r.json())[0] });
    }
    const pid = sanitize(b.pilot_id, 100);
    const [pilot] = await get(`pilots?id=eq.${e(pid)}&organization_id=eq.${e(orgId)}&limit=1`);
    if (!pilot) return res.status(404).json({ error: 'Pilot not found' });

    if (action === 'update') {
      const patch = { updated_at: new Date().toISOString() };
      for (const f of ['agreed_services', 'success_criteria', 'channels', 'usage_limits', 'escalation_contacts']) if (b[f] !== undefined) patch[f] = b[f];
      for (const f of ['start_date', 'end_date', 'baseline_start', 'baseline_end']) if (b[f] !== undefined) patch[f] = sanitize(b[f], 12) || null;
      for (const f of ['support_contact', 'rollback_plan', 'offboarding_plan']) if (b[f] !== undefined) patch[f] = sanitize(b[f], 2000) || null;
      if (b.provider_cost_payer !== undefined) { if (!['nova', 'client', 'shared'].includes(b.provider_cost_payer)) return res.status(400).json({ error: 'provider_cost_payer must be nova, client or shared' }); patch.provider_cost_payer = b.provider_cost_payer; }
      const r = await w(`pilots?id=eq.${e(pid)}&organization_id=eq.${e(orgId)}`, 'PATCH', patch);
      return r.ok ? res.status(200).json({ ok: true, pilot: (await r.json())[0] }) : res.status(500).json({ error: 'Failed to update pilot' });
    }
    if (action === 'record-agreement') {
      // Acceptance needs real evidence (a signed document or email reference) — a checkbox is not evidence.
      const status = sanitize(b.agreement_status, 20);
      if (!['draft', 'sent', 'accepted', 'declined'].includes(status)) return res.status(400).json({ error: 'Invalid agreement_status' });
      if (status === 'accepted' && !sanitize(b.agreement_evidence, 500)) return res.status(400).json({ error: 'Recording acceptance requires agreement_evidence (e.g. a signed-document or email reference)' });
      const patch = { agreement_status: status, agreement_version: sanitize(b.agreement_version, 60) || pilot.agreement_version, updated_at: new Date().toISOString() };
      if (status === 'accepted') { patch.agreement_accepted_at = new Date().toISOString(); patch.agreement_evidence = sanitize(b.agreement_evidence, 500); }
      const r = await w(`pilots?id=eq.${e(pid)}&organization_id=eq.${e(orgId)}`, 'PATCH', patch);
      return r.ok ? res.status(200).json({ ok: true, pilot: (await r.json())[0] }) : res.status(500).json({ error: 'Failed to record agreement' });
    }
    if (action === 'set-status') {
      const to = sanitize(b.status, 20);
      if (!(NEXT[pilot.status] || []).includes(to)) return res.status(409).json({ error: `Cannot move a pilot from ${pilot.status} to ${to}` });
      if (to === 'agreed' && pilot.agreement_status !== 'accepted') return res.status(409).json({ error: 'A pilot cannot be marked agreed until an agreement with evidence is recorded as accepted' });
      if (to === 'active') {
        if (!pilot.provider_cost_payer) return res.status(409).json({ error: 'Set who pays provider costs before going active' });
        const items = await get(`pilot_checklist_items?pilot_id=eq.${e(pid)}`);
        const open = items.filter((i) => i.phase !== 'preflight' ? i.status !== 'passed' && i.status !== 'not_applicable' : i.status === 'failed');
        if (!items.length) return res.status(409).json({ error: 'No checklist exists — seed and complete the acceptance and go-live checks first' });
        if (open.length) return res.status(409).json({ error: `Go-live blocked: ${open.length} acceptance/go-live check(s) not passed`, open: open.map((i) => i.item_key) });
      }
      const patch = { status: to, updated_at: new Date().toISOString() };
      if (['converted', 'extended', 'closed'].includes(to)) {
        const outcome = { converted: 'paid', extended: 'extended', closed: 'closed_no_conversion' }[to];
        if (!sanitize(b.outcome_reason, 1000)) return res.status(400).json({ error: 'An outcome_reason is required (win/loss reasons are recorded, not assumed)' });
        patch.outcome = outcome; patch.outcome_reason = sanitize(b.outcome_reason, 1000);
      }
      const r = await w(`pilots?id=eq.${e(pid)}&organization_id=eq.${e(orgId)}`, 'PATCH', patch);
      return r.ok ? res.status(200).json({ ok: true, pilot: (await r.json())[0] }) : res.status(500).json({ error: 'Failed to update status' });
    }
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }

  if (op === 'pilot-permissions') {
    const { url, key } = { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY };
    const pid = sanitize(req.method === 'GET' ? req.query?.pilot_id : b.pilot_id, 100);
    const [pilot] = await get(`pilots?id=eq.${e(pid)}&organization_id=eq.${e(orgId)}&limit=1`);
    if (!pilot) return res.status(404).json({ error: 'Pilot not found' });
    if (req.method === 'GET') return res.status(200).json(await get(`pilot_permissions?pilot_id=eq.${e(pid)}`));
    const kind = sanitize(b.kind, 20);
    if (!['business_name', 'logo', 'quotation', 'video', 'case_study'].includes(kind)) return res.status(400).json({ error: 'kind must be one of business_name, logo, quotation, video, case_study' });
    const grant = b.granted === true;
    if (grant && (!sanitize(b.granted_by_name, 200) || !sanitize(b.evidence, 500))) return res.status(400).json({ error: 'Granting permission requires the name of the person who granted it and evidence of how' });
    // Deliberately NOT gated on agreement/service acceptance: permission is a separate decision.
    const rec = { pilot_id: pid, kind, granted: grant, granted_by_name: grant ? sanitize(b.granted_by_name, 200) : null, evidence: grant ? sanitize(b.evidence, 500) : null, granted_at: grant ? new Date().toISOString() : null, revoked_at: grant ? null : new Date().toISOString() };
    const r = await fetch(`${url}/rest/v1/pilot_permissions?on_conflict=pilot_id,kind`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(rec) });
    return r.ok ? res.status(200).json({ ok: true, permission: (await r.json())[0] }) : res.status(500).json({ error: 'Failed to record permission' });
  }

  if (op === 'pilot-checklist') {
    const { url, key } = { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY };
    const pid = sanitize(req.method === 'GET' ? req.query?.pilot_id : b.pilot_id, 100);
    const [pilot] = await get(`pilots?id=eq.${e(pid)}&organization_id=eq.${e(orgId)}&limit=1`);
    if (!pilot) return res.status(404).json({ error: 'Pilot not found' });
    if (req.method === 'GET') return res.status(200).json(await get(`pilot_checklist_items?pilot_id=eq.${e(pid)}&order=phase.asc,item_key.asc`));
    const wr = (path, body, prefer) => fetch(`${url}/rest/v1/${path}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: prefer }, body: JSON.stringify(body) });
    if (b.action === 'seed') {
      const r = await wr('pilot_checklist_items?on_conflict=pilot_id,item_key', STANDARD_CHECKLIST.map(([phase, item_key, label]) => ({ pilot_id: pid, phase, item_key, label })), 'resolution=ignore-duplicates,return=representation');
      return r.ok ? res.status(200).json({ ok: true, created: (await r.json()).length }) : res.status(500).json({ error: 'Failed to seed checklist' });
    }
    const status = sanitize(b.status, 20);
    if (!['pending', 'passed', 'failed', 'not_applicable'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (status === 'passed' && !sanitize(b.evidence, 1000)) return res.status(400).json({ error: 'A check cannot be marked passed without evidence (what was observed, when, by whom)' });
    const r = await fetch(`${url}/rest/v1/pilot_checklist_items?pilot_id=eq.${e(pid)}&item_key=eq.${e(sanitize(b.item_key, 80))}`, { method: 'PATCH', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ status, evidence: sanitize(b.evidence, 1000) || null, checked_by: caller.id, checked_at: new Date().toISOString() }) });
    const rows = r.ok ? await r.json() : [];
    return rows.length ? res.status(200).json({ ok: true, item: rows[0] }) : res.status(404).json({ error: 'Checklist item not found — seed the checklist first' });
  }

  if (op === 'pilot-results') {
    const pid = sanitize(req.query?.pilot_id, 100);
    const [pilot] = await get(`pilots?id=eq.${e(pid)}&organization_id=eq.${e(orgId)}&limit=1`);
    if (!pilot) return res.status(404).json({ error: 'Pilot not found' });
    const inRange = (iso, from, to) => iso && from && to && iso.slice(0, 10) >= from && iso.slice(0, 10) <= to;
    const [convs, msgs, appts] = await Promise.all([
      get(`wave1_conversations?organization_id=eq.${e(orgId)}&select=id,created_at,is_test`),
      get(`wave1_messages?organization_id=eq.${e(orgId)}&select=direction,status,automated,created_at,is_test`),
      get(`wave1_appointments?organization_id=eq.${e(orgId)}&select=status,confirmed_at,created_at,is_test`),
    ]);
    const period = (from, to) => {
      if (!from || !to) return { defined: false, note: 'Period dates not set — nothing is counted, and this is NOT zero' };
      const real = (r) => !r.is_test && inRange(r.created_at, from, to);
      return {
        defined: true,
        inquiries_captured: convs.filter(real).length,
        appointments_requested: appts.filter(real).length,
        appointments_confirmed: appts.filter((a) => real(a) && ['confirmed', 'completed'].includes(a.status) && a.confirmed_at).length,
        automated_messages_blocked: msgs.filter((m) => real(m) && m.automated && m.status === 'blocked').length,
        message_failures: msgs.filter((m) => real(m) && ['failed', 'undelivered', 'ambiguous'].includes(m.status)).length,
      };
    };
    const testActivity = { conversations: convs.filter((c) => c.is_test).length, messages: msgs.filter((m) => m.is_test).length, appointments: appts.filter((a) => a.is_test).length };
    return res.status(200).json({
      pilot_id: pid, baseline: period(pilot.baseline_start, pilot.baseline_end), pilot_period: period(pilot.start_date, pilot.end_date), test_activity_excluded: testActivity,
      not_measured: { verified_revenue: 'Not collected by this system — record it separately; nothing is inferred', qualified_leads: 'No qualification field exists yet — "inquiries captured" is NOT the same as qualified leads', response_time: 'First-response time is not yet recorded per conversation — shown as unavailable, not zero', owner_feedback: 'Collect via the testimonial/interview workflow' },
      definitions: { inquiries_captured: 'Real (non-test) conversations created in the period', appointments_confirmed: 'Appointments with status confirmed/completed AND a confirmed_at set by the scheduling source or authorized staff' },
      limitations: 'Counts describe activity in this system only. They do not establish causation or recovered revenue.',
    });
  }

  return res.status(400).json({ error: `Unknown wave1 op: ${op}` });
}
