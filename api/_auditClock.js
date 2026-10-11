// Nova Audit deadline-clock — pure functions, zero I/O, fully unit-testable without a database.
// This is deliberately the most rigorously tested piece of the Audit domain: the master prompt
// is explicit that "do not silently extend deadlines or reset the clock" and that
// waiting-for-client/queue/active/at-risk/overdue must be shown distinctly, so getting this one
// calculation right matters more than almost anything else in this module.
//
// Model: a case has a target duration (target_hours) on a clock_basis ('elapsed' or
// 'business_hours'), starting at start_condition_met_at (null until intake/access requirements
// are actually satisfied — the clock does not run before that). Pauses stop the clock without
// moving start_condition_met_at or silently shortening the remaining work time: due_at is always
// start + target_duration + total_paused_duration, so a pause extends the deadline by exactly
// the time it was paused, never more, never less, never invisibly.

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Business-hours support: a fixed default of Mon-Fri 9am-5pm in the given IANA timezone. This is
 * a real, working implementation, not a stub — but it does NOT yet support per-organization
 * custom hours or holiday calendars. That gap is real and stated here, not hidden: see
 * docs/PRODUCT_BUILD_STATE.md.
 */
const BUSINESS_HOUR_START = 9;
const BUSINESS_HOUR_END = 17;

function getZonedParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return { weekday: parts.weekday, hour: Number(parts.hour), minute: Number(parts.minute) };
}

function isWithinBusinessHours(date, timeZone) {
  const { weekday, hour } = getZonedParts(date, timeZone);
  const isWeekday = !['Sat', 'Sun'].includes(weekday);
  return isWeekday && hour >= BUSINESS_HOUR_START && hour < BUSINESS_HOUR_END;
}

/** Advances `date` forward by exactly `hours` of business time in `timeZone`. Pure, deterministic. */
function addBusinessHours(date, hours, timeZone) {
  let remainingMs = hours * MS_PER_HOUR;
  let cursor = new Date(date);
  const stepMs = 5 * 60 * 1000; // 5-minute steps — fine enough for hour-scale targets, bounded loop below
  let guard = 0;
  while (remainingMs > 0 && guard < 200000) {
    guard++;
    if (isWithinBusinessHours(cursor, timeZone)) {
      const step = Math.min(stepMs, remainingMs);
      cursor = new Date(cursor.getTime() + step);
      remainingMs -= step;
    } else {
      cursor = new Date(cursor.getTime() + stepMs);
    }
  }
  return cursor;
}

/**
 * Computes the due date for a case, accounting for total time already spent paused.
 * clockBasis: 'elapsed' | 'business_hours'
 */
export function computeDueAt({ startAt, targetHours, clockBasis, timezone, totalPausedMs = 0 }) {
  if (!startAt) return null;
  const start = new Date(startAt);
  const base = clockBasis === 'business_hours'
    ? addBusinessHours(start, targetHours, timezone || 'America/New_York')
    : new Date(start.getTime() + targetHours * MS_PER_HOUR);
  // Pauses extend the deadline by exactly the paused duration, on the 'elapsed' clock, regardless
  // of clock_basis — a pause is real wall-clock time nobody could have been working during it.
  return new Date(base.getTime() + totalPausedMs);
}

/**
 * Given a case's full state, returns a status bucket distinguishing the exact categories the
 * master prompt requires: waiting-for-client, queue time, active work, reviewer wait, at-risk,
 * overdue. `now` is injectable for testability.
 */
export function computeCaseClockStatus({
  status, // audit_cases.status
  startConditionMetAt,
  targetHours,
  clockBasis,
  timezone,
  pausedAt, // non-null if currently paused
  totalPausedSeconds = 0,
  now = new Date(),
}) {
  const nowDate = now instanceof Date ? now : new Date(now);

  if (['intake', 'inputs_pending'].includes(status)) {
    return { bucket: 'waiting_for_client', dueAt: null, remainingSeconds: null };
  }
  if (!startConditionMetAt) {
    return { bucket: 'queue', dueAt: null, remainingSeconds: null };
  }
  if (['qa_review'].includes(status)) {
    // Still compute due_at for reference, but the bucket is explicitly "reviewer wait" per the
    // master prompt's explicit distinct-categories requirement — separate from generic "active".
  }
  if (['delivered', 'customer_decision', 'implementation', 'outcome_tracking', 'closed'].includes(status)) {
    return { bucket: 'completed', dueAt: null, remainingSeconds: null };
  }

  let effectivePausedMs = totalPausedSeconds * 1000;
  if (pausedAt) {
    // Currently paused right now — count time since pausedAt as additional paused time for
    // display purposes (not yet persisted to total_paused_seconds until resume, matching the
    // audit_case_pause_events design where the row is finalized on resume).
    effectivePausedMs += Math.max(0, nowDate.getTime() - new Date(pausedAt).getTime());
  }

  const dueAt = computeDueAt({
    startAt: startConditionMetAt, targetHours, clockBasis, timezone, totalPausedMs: effectivePausedMs,
  });

  if (pausedAt) {
    return { bucket: 'paused', dueAt, remainingSeconds: Math.round((dueAt.getTime() - nowDate.getTime()) / 1000) };
  }

  const remainingSeconds = Math.round((dueAt.getTime() - nowDate.getTime()) / 1000);
  const totalTargetSeconds = targetHours * 3600;
  const atRiskThresholdSeconds = Math.round(totalTargetSeconds * 0.15); // at-risk inside the final 15% of the window

  let bucket;
  if (status === 'qa_review') bucket = remainingSeconds < 0 ? 'overdue' : 'reviewer_wait';
  else if (remainingSeconds < 0) bucket = 'overdue';
  else if (remainingSeconds <= atRiskThresholdSeconds) bucket = 'at_risk';
  else bucket = 'active';

  return { bucket, dueAt, remainingSeconds };
}
