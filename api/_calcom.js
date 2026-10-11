// Cal.com API v2 client (scheduling source for Wave One appointments).
// Endpoint shapes taken from Cal.com's published API reference on 2026-09-24 and the base URL confirmed
// reachable (https://api.cal.com/v2 answers 403 "no authentication provided" without a key). NO request
// has been made WITH a real key from this codebase — every function below is exercised only against an
// injected fetch in scripts/unit_wave1_api_test.mjs. A booking is "confirmed" ONLY when Cal.com itself
// reports status "accepted"; "pending" stays a request awaiting the host.
const DEFAULT_BASE = 'https://api.cal.com/v2';
const V = { slots: '2024-09-04', bookings: '2026-02-25' };

export const calcomConfigured = (env) => !!env.CALCOM_API_KEY;

async function call(env, { method, path, version, query, body, fetchImpl = fetch }) {
  if (!env.CALCOM_API_KEY) return { ok: false, kind: 'not_configured' };
  const url = new URL(`${(env.CALCOM_API_BASE || DEFAULT_BASE).replace(/\/$/, '')}${path}`);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000);
  let r;
  try {
    r = await fetchImpl(url.toString(), { method, signal: ctrl.signal, headers: { Authorization: `Bearer ${env.CALCOM_API_KEY}`, 'cal-api-version': version, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    // Timeout/network error on a WRITE means we cannot know whether Cal.com created the booking.
    return { ok: false, kind: method === 'GET' ? 'unreachable' : 'ambiguous', error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally { clearTimeout(timer); }
  const json = await r.json().catch(() => ({}));
  if (r.ok) return { ok: true, status: r.status, data: json.data ?? json };
  if (r.status >= 500 && method !== 'GET') return { ok: false, kind: 'ambiguous', status: r.status };
  return { ok: false, kind: r.status === 401 || r.status === 403 ? 'auth' : r.status === 429 ? 'rate_limited' : 'rejected', status: r.status, error: String(json?.error?.message || json?.message || '').slice(0, 300) };
}

// → { ok, slots: [ISO...] } (slot start times in UTC)
export async function getSlots(env, { eventTypeId, startDate, endDate, timeZone = 'UTC' }, fetchImpl) {
  const r = await call(env, { method: 'GET', path: '/slots', version: V.slots, query: { eventTypeId, start: startDate, end: endDate, timeZone }, fetchImpl });
  if (!r.ok) return r;
  const slots = Object.values(r.data || {}).flat().map((s) => new Date(s.start).toISOString()).filter((s) => s !== 'Invalid Date').sort();
  return { ok: true, slots };
}

// Cal.com's own booking-status vocabulary → ours. Only "accepted" is confirmed.
export const mapBookingStatus = (s) => ({ accepted: 'confirmed', pending: 'requested', cancelled: 'cancelled', rejected: 'cancelled' }[String(s || '').toLowerCase()] || null);

export async function createBooking(env, { eventTypeId, startIso, attendee, metadata }, fetchImpl) {
  const r = await call(env, { method: 'POST', path: '/bookings', version: V.bookings, body: { start: startIso, eventTypeId: Number(eventTypeId), attendee: { name: attendee.name, email: attendee.email, timeZone: attendee.timeZone, ...(attendee.phoneNumber ? { phoneNumber: attendee.phoneNumber } : {}) }, metadata: metadata || {} }, fetchImpl });
  if (!r.ok) return r;
  const status = mapBookingStatus(r.data?.status);
  if (!status || !r.data?.uid) return { ok: false, kind: 'ambiguous', error: 'Cal.com replied without a recognizable booking uid/status' };
  return { ok: true, uid: r.data.uid, status, start: r.data.start, end: r.data.end };
}

export async function getBooking(env, uid, fetchImpl) {
  const r = await call(env, { method: 'GET', path: `/bookings/${encodeURIComponent(uid)}`, version: V.bookings, fetchImpl });
  if (!r.ok) return r;
  const status = mapBookingStatus(r.data?.status);
  return status ? { ok: true, uid, status, start: r.data.start, end: r.data.end } : { ok: false, kind: 'rejected', error: 'Unrecognized booking status' };
}

export async function cancelBooking(env, uid, reason, fetchImpl) {
  return call(env, { method: 'POST', path: `/bookings/${encodeURIComponent(uid)}/cancel`, version: V.bookings, body: reason ? { cancellationReason: String(reason).slice(0, 300) } : {}, fetchImpl });
}
