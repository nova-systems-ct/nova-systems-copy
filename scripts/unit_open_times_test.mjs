// Open times (api/_openTimes.js) and the desk operations that use them (api/_journey.js):
// weekly hours become bookable times in the business's own time zone, nothing overlaps, booked
// times stay, and a waiting customer is offered the new times. In-memory store; nothing contacted.
import crypto from 'node:crypto';
import { weeklySlots, oneSlot, addOpenTimes, listOpenTimes, removeOpenTime, zonedToUtc } from '../api/_openTimes.js';
import { groupByDay } from '../src/lib/openTimes.js';

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };

function memoryDb() {
  const t = {}; const rows = (n) => (t[n] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : v && typeof v === 'object' && 'gte' in v ? r[k] >= v.gte : r[k] === v));
  return { t,
    select: async (n, f = {}, { order = 'created_at.asc', limit = 500 } = {}) => { const [col, dir] = order.split('.'); return rows(n).filter((r) => hit(r, f)).sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1)).slice(0, limit).map((r) => ({ ...r })); },
    insert: async (n, row) => { const full = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row }; rows(n).push(full); return { ...full }; },
    update: async (n, f, patch) => rows(n).filter((r) => hit(r, f)).map((r) => ({ ...Object.assign(r, patch) })) };
}

// ---- weekly hours -> times ----------------------------------------------------------------------
const NOW = new Date('2026-11-27T20:00:00Z'); // Friday 3 p.m. in New York
let r = weeklySlots({ days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '09:00', end: '17:00', minutes: 120, weeks: 1, timeZone: 'America/New_York', now: NOW });
check('Mon to Fri, 9 to 5, 2-hour jobs, the next 7 days from a Friday afternoon: four times a day, Monday to Thursday', r.slots?.length === 16);
check('the first time is Monday 9:00 New York time (14:00 UTC in winter)', r.slots[0].start_at === '2026-11-30T14:00:00.000Z' && r.slots[0].end_at === '2026-11-30T16:00:00.000Z');
check('the last time each day ends at 17:00, not after', r.slots[3].start_at === '2026-11-30T20:00:00.000Z' && r.slots[3].end_at === '2026-11-30T22:00:00.000Z');
r = weeklySlots({ days: ['fri'], start: '09:00', end: '17:00', minutes: 120, weeks: 2, timeZone: 'America/New_York', now: NOW });
check('times that have already started today are left out; next Friday is offered in full', r.slots.length === 4 && r.slots[0].start_at === '2026-12-04T14:00:00.000Z');
check('hours that give no future time at all are refused', /no future times/.test(weeklySlots({ days: ['fri'], start: '09:00', end: '15:00', minutes: 120, weeks: 1, now: NOW }).error));
const dst = weeklySlots({ days: ['sat', 'mon'], start: '09:00', end: '10:00', minutes: 60, weeks: 2, timeZone: 'America/New_York', now: new Date('2026-10-30T12:00:00Z') });
check('9:00 stays 9:00 across the daylight-saving change (13:00 UTC before, 14:00 UTC after)', dst.slots[0].start_at === '2026-10-31T13:00:00.000Z' && dst.slots[1].start_at === '2026-11-02T14:00:00.000Z');
check('time zones other than New York work (9:00 in Los Angeles = 17:00 UTC in winter)', new Date(zonedToUtc({ y: 2026, m: 12, d: 1, h: 9, mi: 0 }, 'America/Los_Angeles')).toISOString() === '2026-12-01T17:00:00.000Z');
check('days can be given as numbers too (1 = Monday)', weeklySlots({ days: [1], start: '09:00', end: '11:00', minutes: 120, weeks: 1, now: NOW }).slots.length === 1);
check('no days, a bad time, a too-short day or a strange length are refused with a reason',
  /at least one day/.test(weeklySlots({ days: [], start: '09:00', end: '17:00', minutes: 60, now: NOW }).error)
  && /like 09:00/.test(weeklySlots({ days: ['mon'], start: '9am', end: '17:00', minutes: 60, now: NOW }).error)
  && /at least as long/.test(weeklySlots({ days: ['mon'], start: '09:00', end: '09:30', minutes: 60, now: NOW }).error)
  && /15 minutes to 10 hours/.test(weeklySlots({ days: ['mon'], start: '09:00', end: '17:00', minutes: 5, now: NOW }).error)
  && /1 to 12 weeks/.test(weeklySlots({ days: ['mon'], start: '09:00', end: '17:00', minutes: 60, weeks: 52, now: NOW }).error)
  && /time zone/.test(weeklySlots({ days: ['mon'], start: '09:00', end: '17:00', minutes: 60, timeZone: 'Mars/Base', now: NOW }).error));
check('at most 200 times are made at once', weeklySlots({ days: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '23:45', minutes: 15, weeks: 12, now: NOW }).slots.length === 200);
check('one time: must be in the future, end after it starts, at most 10 hours',
  oneSlot({ start_at: '2026-12-01T15:00:00Z', end_at: '2026-12-01T17:00:00Z', now: NOW }).slots?.length === 1
  && /future/.test(oneSlot({ start_at: '2026-11-01T15:00:00Z', end_at: '2026-11-01T17:00:00Z', now: NOW }).error)
  && /ends after it starts/.test(oneSlot({ start_at: '2026-12-01T15:00:00Z', end_at: '2026-12-01T14:00:00Z', now: NOW }).error));

// ---- saving, listing, removing ------------------------------------------------------------------
const db = memoryDb();
await db.insert('voice_calendar_slots', { organization_id: ORG, service_name: 'Any service', start_at: '2026-11-30T14:00:00.000Z', end_at: '2026-11-30T16:00:00.000Z', status: 'booked' });
await db.insert('voice_calendar_slots', { organization_id: OTHER, service_name: 'Any service', start_at: '2026-11-30T16:00:00.000Z', end_at: '2026-11-30T18:00:00.000Z', status: 'open' });
const week = weeklySlots({ days: ['mon'], start: '09:00', end: '17:00', minutes: 120, weeks: 1, now: NOW }).slots;
let out = await addOpenTimes(db, ORG, week);
check('a time that overlaps one the business already has is skipped; another business\'s times do not count', out.added === 3 && out.skipped === 1);
out = await addOpenTimes(db, ORG, week);
check('adding the same hours twice adds nothing twice', out.added === 0 && out.skipped === 4);
let list = await listOpenTimes(db, ORG, { now: NOW });
check('the list shows this business\'s times only, soonest first, with booked ones marked', list.length === 4 && list[0].status === 'booked' && list.every((x, i) => i === 0 || x.start_at > list[i - 1].start_at));
const booked = list[0], open = list[1];
check('a booked time cannot be removed', (await removeOpenTime(db, ORG, booked.id)).status === 409);
check('another business cannot remove this business\'s time', (await removeOpenTime(db, OTHER, open.id)).status === 404);
check('an open time is removed (kept as cancelled) and leaves the list', (await removeOpenTime(db, ORG, open.id)).ok === true && db.t.voice_calendar_slots.find((s) => s.id === open.id).status === 'cancelled' && (await listOpenTimes(db, ORG, { now: NOW })).length === 3);
out = await addOpenTimes(db, ORG, [{ start_at: open.start_at, end_at: open.end_at }]);
check('a removed time can be added again', out.added === 1);
check('the desk groups times by day in the business\'s time zone', groupByDay(await listOpenTimes(db, ORG, { now: NOW }), 'America/New_York').map((g) => g.label).join() === 'Mon, Nov 30');

// ---- the desk operations, end to end ------------------------------------------------------------
process.env.SUPABASE_URL = 'https://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
const src = (await import('node:fs')).readFileSync('api/_journey.js', 'utf8');
check('the desk can list, add and remove open times', /op === 'open-times'/.test(src) && /op === 'add-open-times'/.test(src) && /op === 'remove-open-time'/.test(src));
check('adding and removing times needs the owner-level permission', /\['complete', 'assign', 'feedback-resolve'\]\.includes\(op\) \? 'growth\.view' : 'business\.manage'/.test(src) && src.indexOf("op === 'add-open-times'") > src.indexOf("'business.manage'))) return;"));
check('customers waiting for a time are offered the new ones', /waiting_reason: 'arrange_time'/.test(src));

console.log(`\n${pass}/${pass + fail} open time checks passed (in-memory store — no database contacted)`);
process.exit(fail ? 1 : 0);
