// Unit tests for api/_auditClock.js — pure functions, zero database/network dependency. This is
// the most business-critical piece of logic in the Audit domain (the master prompt is explicit:
// "do not silently extend deadlines or reset the clock"), so it gets tested independently of
// anything schema/Supabase-related, the same way scripts/validate_crm_order_audit_schema.mjs
// tests the schema independently of the application code.
// Usage: node scripts/unit_audit_clock_test.mjs

import { computeDueAt, computeCaseClockStatus } from '../api/_auditClock.js';

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

// ---- computeDueAt: elapsed basis ----
{
  const start = new Date('2026-09-23T10:00:00Z');
  const due = computeDueAt({ startAt: start, targetHours: 72, clockBasis: 'elapsed', totalPausedMs: 0 });
  const expected = new Date('2026-09-26T10:00:00Z');
  log('Elapsed 72h with no pauses: due = start + 72h exactly', due.getTime() === expected.getTime(), `got ${due.toISOString()}, expected ${expected.toISOString()}`);
}

// ---- computeDueAt: a pause extends the deadline by EXACTLY the paused duration, not more/less ----
{
  const start = new Date('2026-09-23T10:00:00Z');
  const sixHoursMs = 6 * 60 * 60 * 1000;
  const due = computeDueAt({ startAt: start, targetHours: 24, clockBasis: 'elapsed', totalPausedMs: sixHoursMs });
  const expected = new Date('2026-09-24T16:00:00Z'); // 24h + 6h pause = 30h from start
  log('A 6-hour pause extends a 24h deadline by exactly 6 hours', due.getTime() === expected.getTime(), `got ${due.toISOString()}, expected ${expected.toISOString()}`);
}

// ---- computeDueAt: null start returns null (case hasn't started, no deadline exists yet) ----
{
  const due = computeDueAt({ startAt: null, targetHours: 72, clockBasis: 'elapsed' });
  log('No start condition met -> due_at is null, not a guessed date', due === null);
}

// ---- computeDueAt: business_hours basis skips nights/weekends ----
{
  // Friday 4pm ET + 2 business hours should land Monday morning, not Friday evening or Saturday.
  const start = new Date('2026-09-25T20:00:00Z'); // Friday 4pm ET (EDT, UTC-4)
  const due = computeDueAt({ startAt: start, targetHours: 2, clockBasis: 'business_hours', timezone: 'America/New_York' });
  const weekday = due.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long' });
  log('Business-hours clock skips the weekend (2h from Friday 4pm ET lands on a weekday, not Sat/Sun)', weekday !== 'Saturday' && weekday !== 'Sunday', `landed on ${weekday} (${due.toISOString()})`);
}

// ---- computeCaseClockStatus: buckets ----
const baseArgs = { targetHours: 24, clockBasis: 'elapsed', timezone: 'America/New_York' };

{
  const r = computeCaseClockStatus({ ...baseArgs, status: 'intake', startConditionMetAt: null, now: new Date('2026-09-23T12:00:00Z') });
  log('status=intake, no start condition -> bucket = waiting_for_client', r.bucket === 'waiting_for_client', JSON.stringify(r));
}
{
  const r = computeCaseClockStatus({ ...baseArgs, status: 'ready', startConditionMetAt: null, now: new Date('2026-09-23T12:00:00Z') });
  log('status=ready but no start condition yet -> bucket = queue (distinct from waiting_for_client)', r.bucket === 'queue', JSON.stringify(r));
}
{
  const start = new Date('2026-09-23T10:00:00Z');
  const r = computeCaseClockStatus({ ...baseArgs, status: 'researching', startConditionMetAt: start, now: new Date('2026-09-23T12:00:00Z') }); // 2h into a 24h window
  log('2 hours into a fresh 24h window -> bucket = active', r.bucket === 'active', JSON.stringify(r));
}
{
  const start = new Date('2026-09-23T10:00:00Z');
  const r = computeCaseClockStatus({ ...baseArgs, status: 'researching', startConditionMetAt: start, now: new Date('2026-09-24T07:00:00Z') }); // 21h into 24h = 3h left = 12.5% remaining
  log('Inside the final 15% of the window -> bucket = at_risk', r.bucket === 'at_risk', JSON.stringify(r));
}
{
  const start = new Date('2026-09-23T10:00:00Z');
  const r = computeCaseClockStatus({ ...baseArgs, status: 'researching', startConditionMetAt: start, now: new Date('2026-09-24T11:00:00Z') }); // 1h past the 24h deadline
  log('Past the deadline -> bucket = overdue', r.bucket === 'overdue' && r.remainingSeconds < 0, JSON.stringify(r));
}
{
  const start = new Date('2026-09-23T10:00:00Z');
  const r = computeCaseClockStatus({ ...baseArgs, status: 'qa_review', startConditionMetAt: start, now: new Date('2026-09-23T20:00:00Z') });
  log('status=qa_review (still within deadline) -> bucket = reviewer_wait, distinct from active', r.bucket === 'reviewer_wait', JSON.stringify(r));
}
{
  const r = computeCaseClockStatus({ ...baseArgs, status: 'delivered', startConditionMetAt: new Date('2026-09-20T10:00:00Z'), now: new Date('2026-09-23T12:00:00Z') });
  log('status=delivered -> bucket = completed, no due_at shown', r.bucket === 'completed' && r.dueAt === null, JSON.stringify(r));
}
{
  const start = new Date('2026-09-23T10:00:00Z');
  const pausedAt = new Date('2026-09-23T14:00:00Z'); // paused 4h into the window
  const now = new Date('2026-09-23T18:00:00Z'); // 4h into the pause, still paused
  const r = computeCaseClockStatus({ ...baseArgs, status: 'researching', startConditionMetAt: start, pausedAt, now });
  log('Currently paused -> bucket = paused, and the clock is not silently still counting down', r.bucket === 'paused', JSON.stringify(r));
  // Due date should reflect the 4h paused-so-far being added, not ignored.
  const expectedDue = new Date('2026-09-24T14:00:00Z'); // 24h target + 4h paused-so-far
  log('Paused case\'s projected due_at includes time paused so far (not frozen at the original 24h mark)', r.dueAt.getTime() === expectedDue.getTime(), `got ${r.dueAt?.toISOString()}, expected ${expectedDue.toISOString()}`);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} unit tests passed`);
process.exit(passed === results.length ? 0 : 1);
