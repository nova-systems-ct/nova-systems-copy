// Open times: the bookable times a business offers (voice_calendar_slots). The scheduling worker
// in api/_journey.js offers customers only these; without any, a request stops at "the team will
// contact you to arrange a time". Until this file nothing created them, so no customer could book.
//
// The owner sets weekly hours ("Mon to Fri, 9:00 to 17:00, 2-hour jobs, the next 4 weeks") or adds
// one time. Times are worked out in the business's own time zone, so 9:00 stays 9:00 across a
// daylight-saving change. A time that already exists is not added twice, a booked time is never
// removed, and every read and write is limited to the one organization.
const MAX_SLOTS = 200;
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validTimeZone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return typeof tz === 'string' && tz.length > 0; } catch { return false; }
}

// The wall-clock parts of instant `ms` in time zone `tz`.
function wallParts(ms, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(ms)).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
  return { y: parts.year, m: parts.month, d: parts.day, h: parts.hour === 24 ? 0 : parts.hour, mi: parts.minute, s: parts.second };
}

// The instant whose wall clock in `tz` reads y-m-d h:mi. Two passes settle daylight-saving edges.
export function zonedToUtc({ y, m, d, h, mi }, tz) {
  const want = Date.UTC(y, m - 1, d, h, mi);
  let guess = want;
  for (let i = 0; i < 2; i++) {
    const w = wallParts(guess, tz);
    guess += want - Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  }
  return guess;
}

// The calendar date (y, m, d) and weekday of instant `ms` in `tz`.
function zonedDate(ms, tz) {
  const w = wallParts(ms, tz);
  return { y: w.y, m: w.m, d: w.d, dow: new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay() };
}

function readDays(days) {
  const list = (Array.isArray(days) ? days : []).map((x) => (typeof x === 'string' ? DAY_NAMES.indexOf(x.slice(0, 3).toLowerCase()) : Number(x)));
  return [...new Set(list.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))];
}

// Weekly hours → [{ start_at, end_at }] for the coming weeks, future times only.
// Returns { slots } or { error } (the error is a sentence for the owner).
export function weeklySlots({ days, start, end, minutes, weeks = 4, timeZone = 'America/New_York', now = new Date() }) {
  const dayList = readDays(days);
  if (!dayList.length) return { error: 'Choose at least one day.' };
  if (!HHMM.test(String(start || '')) || !HHMM.test(String(end || ''))) return { error: 'Enter start and end times like 09:00 and 17:00.' };
  const len = Number(minutes);
  if (!Number.isInteger(len) || len < 15 || len > 600) return { error: 'Each time is 15 minutes to 10 hours long.' };
  const wk = Number(weeks);
  if (!Number.isInteger(wk) || wk < 1 || wk > 12) return { error: 'Add 1 to 12 weeks at a time.' };
  if (!validTimeZone(timeZone)) return { error: 'Unknown time zone.' };
  const [sh, sm] = start.split(':').map(Number), [eh, em] = end.split(':').map(Number);
  const first = sh * 60 + sm, last = eh * 60 + em;
  if (last - first < len) return { error: 'The day must be at least as long as one time.' };

  const today = zonedDate(now.getTime(), timeZone), slots = [];
  for (let i = 0; i < wk * 7 && slots.length < MAX_SLOTS; i++) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    if (!dayList.includes(day.getUTCDay())) continue;
    const ymd = { y: day.getUTCFullYear(), m: day.getUTCMonth() + 1, d: day.getUTCDate() };
    for (let t = first; t + len <= last && slots.length < MAX_SLOTS; t += len) {
      const s = zonedToUtc({ ...ymd, h: Math.floor(t / 60), mi: t % 60 }, timeZone);
      const e = zonedToUtc({ ...ymd, h: Math.floor((t + len) / 60), mi: (t + len) % 60 }, timeZone);
      if (s > now.getTime()) slots.push({ start_at: new Date(s).toISOString(), end_at: new Date(e).toISOString() });
    }
  }
  return slots.length ? { slots } : { error: 'Those hours give no future times.' };
}

// One time: { start_at, end_at } as ISO strings, in the future, end after start, at most 10 hours.
export function oneSlot({ start_at, end_at, now = new Date() }) {
  const s = Date.parse(start_at), e = Date.parse(end_at);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return { error: 'Enter a start and an end.' };
  if (s <= now.getTime()) return { error: 'The time must be in the future.' };
  if (e <= s || e - s > 600 * 60_000) return { error: 'A time ends after it starts and lasts at most 10 hours.' };
  return { slots: [{ start_at: new Date(s).toISOString(), end_at: new Date(e).toISOString() }] };
}

const overlaps = (a, b) => Date.parse(a.start_at) < Date.parse(b.end_at) && Date.parse(b.start_at) < Date.parse(a.end_at);

// Saves the times that do not overlap a time the business already has (open, held or booked).
export async function addOpenTimes(db, orgId, slots, { serviceName = 'Any service' } = {}) {
  const have = (await db.select('voice_calendar_slots', { organization_id: orgId }, { order: 'start_at.asc', limit: 2000 })).filter((x) => x.status !== 'cancelled');
  const added = [];
  let skipped = 0;
  for (const s of slots.slice(0, MAX_SLOTS)) {
    if (have.some((h) => overlaps(h, s)) || added.some((a) => overlaps(a, s))) { skipped++; continue; }
    added.push(await db.insert('voice_calendar_slots', { organization_id: orgId, service_name: String(serviceName).slice(0, 120) || 'Any service', start_at: s.start_at, end_at: s.end_at, status: 'open' }));
  }
  return { added: added.length, skipped, slots: added };
}

// The business's times from now on (cancelled ones left out), soonest first.
export async function listOpenTimes(db, orgId, { now = new Date(), limit = 300 } = {}) {
  return (await db.select('voice_calendar_slots', { organization_id: orgId, start_at: { gte: now.toISOString() } }, { order: 'start_at.asc', limit }))
    .filter((x) => x.status !== 'cancelled')
    .map(({ id, start_at, end_at, status, service_name }) => ({ id, start_at, end_at, status, service_name }));
}

// Takes an OPEN time away (kept as cancelled for the record). A held or booked time is refused.
export async function removeOpenTime(db, orgId, slotId) {
  const row = (await db.select('voice_calendar_slots', { id: slotId, organization_id: orgId }, { limit: 1 }))[0];
  if (!row) return { status: 404, error: 'That time was not found.' };
  if (row.status !== 'open') return { status: 409, error: 'That time is booked or being booked, so it stays. Cancel the booking first.' };
  const done = await db.update('voice_calendar_slots', { id: slotId, organization_id: orgId, status: 'open' }, { status: 'cancelled' });
  return done.length ? { ok: true } : { status: 409, error: 'That time was just booked, so it stays.' };
}
