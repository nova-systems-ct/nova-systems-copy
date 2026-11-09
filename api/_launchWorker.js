import { createHash } from 'node:crypto';
import { validateServiceRequest } from './_serviceSmsRequest.js';
import { requireStaff } from './_auth.js';

export const LAUNCH_SERVICES = Object.freeze({
  calls: 'Calls & reception', messages: 'Customer messages', booking: 'Bookings & scheduling',
  follow_up: 'Follow-up & CRM', systems: 'A connected business system', not_sure: 'Help choosing a system',
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;
const ERRORS = {
  slot_unavailable: 'That time is no longer available. Please choose another time or send your request without an appointment.',
  phone_required: 'Enter a phone number for your phone appointment, or send your request without booking a time.',
  request_conflict: 'This request reference is already in use. Reload this page before sending a new request.',
  request_not_found: 'This request could not be verified.', appointment_started: 'This appointment has already started. Contact Nova to make changes.',
  owner_required: 'Only the Nova account owner can manage this calendar.', invalid_slot: 'Choose a future time between 30 minutes and 60 days from now, lasting no more than four hours.',
  slot_overlap: 'This time overlaps an existing appointment or published slot.', slot_not_available: 'Only an unbooked slot can be withdrawn.',
};
export async function launchRpc(name, args) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('storage_unavailable');
  const r = await fetch(`${base.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args), signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.code === '22023' || e.code === '22P02' ? 'invalid_input' : 'storage_unavailable');
  }
  return r.json();
}
function answer(res, result) {
  if (result?.ok !== true) {
    const code = result?.code || 'storage_unavailable';
    const status = code === 'owner_required' ? 403 : code === 'request_not_found' ? 404 : 409;
    return res.status(status).json({ ok: false, code, error: ERRORS[code] || 'The request could not be completed. Please try again.' });
  }
  return res.status(200).json({ ...result, marketing_consent: false });
}
function unavailable(res, e) {
  const invalid = e.message === 'invalid_input';
  console.error('[launch-worker]', invalid ? 'Invalid input' : 'Transaction could not be confirmed');
  return res.status(invalid ? 422 : 502).json({ ok: false, error: invalid ? 'Please check the request details.' : 'Nova could not confirm this action. Please retry; your request reference prevents duplicate bookings.' });
}
function management(body) {
  return typeof body?.management_token === 'string' && TOKEN.test(body.management_token)
    ? createHash('sha256').update(body.management_token).digest('hex') : null;
}
export async function handleLaunchPublic(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET' && req.query?.action === 'availability') {
      return answer(res, await launchRpc('nova_launch_availability', { p_test: req.query?.test === '1' }));
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
    const b = req.body || {};
    const hash = management(b);
    if (!hash) return res.status(422).json({ ok: false, error: 'Reload the assistant to start a secure request.' });
    if (b.request_type === 'launch_cancel') {
      if (typeof b.submission_id !== 'string' || !UUID.test(b.submission_id)) return res.status(422).json({ ok: false, error: 'Invalid request reference.' });
      return answer(res, await launchRpc('nova_launch_cancel', { p_request_id: b.submission_id, p_management_hash: hash }));
    }
    if (b.request_type !== 'launch_worker_request') return res.status(400).json({ ok: false, error: 'Unknown request.' });
    const v = validateServiceRequest(b);
    if (v.error) return res.status(422).json({ ok: false, error: v.error });
    if (!Object.hasOwn(LAUNCH_SERVICES, b.service_key)) return res.status(422).json({ ok: false, error: 'Choose the system you need help with.' });
    if (b.slot_id != null && b.slot_id !== '' && (typeof b.slot_id !== 'string' || !UUID.test(b.slot_id))) return res.status(422).json({ ok: false, error: 'Choose one of the available appointment times.' });
    const test = b.test_mode === true;
    if (test && (!v.data.email.endsWith('@example.invalid') || (v.data.phone_e164 && !/^\+1[2-9][0-9]{2}55501\d{2}$/.test(v.data.phone_e164)))) {
      return res.status(422).json({ ok: false, error: 'Use an @example.invalid email and a reserved 555-01xx phone number in the test workspace.' });
    }
    return answer(res, await launchRpc('nova_launch_request', {
      p_request: v.data, p_management_hash: hash, p_service: b.service_key, p_slot: b.slot_id || null, p_test: test,
    }));
  } catch (e) { return unavailable(res, e); }
}
export async function handleLaunchAdmin(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  const caller = await requireStaff(req, res, 'admin.view');
  if (!caller) return;
  const b = req.body || {};
  const action = req.method === 'GET' ? 'overview' : b.action;
  if (!['overview', 'add_slot', 'withdraw_slot', 'cancel_request'].includes(action)) return res.status(400).json({ ok: false, error: 'Unknown calendar action.' });
  try {
    if (action === 'add_slot') {
      const start = Date.parse(b.starts_at), end = Date.parse(b.ends_at);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 14400000) return res.status(422).json({ ok: false, error: ERRORS.invalid_slot });
    }
    if (['withdraw_slot', 'cancel_request'].includes(action) && (typeof b.id !== 'string' || !UUID.test(b.id))) return res.status(422).json({ ok: false, error: 'Invalid appointment slot.' });
    return answer(res, await launchRpc('nova_launch_owner', {
      p_actor: caller.id, p_action: action,
      p_payload: action === 'add_slot' ? { starts_at: b.starts_at, ends_at: b.ends_at, is_test: b.is_test === true } : { id: b.id },
    }));
  } catch (e) { return unavailable(res, e); }
}
