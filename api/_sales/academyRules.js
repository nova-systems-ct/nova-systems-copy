// Pure Academy rules: policy resolution, grading, attempt gating, eligibility, certificate naming. No I/O.
// Unit-tested in scripts/unit_sales_academy_rules_test.mjs.

// The proposed (NOT approved) default. Used only when no approved policy exists, and then everything derived from it is
// labelled provisional.
export const DEFAULT_POLICY = Object.freeze({ pass_threshold_pct: 80, max_attempts: 3, cooldown_hours: 0, require_lessons_before_quiz: true, practical_max_attempts: 3, reveal_explanations: true });

export function normalizePolicy(v = {}) {
  const n = (x, lo, hi, d) => { const y = Number(x); return Number.isFinite(y) ? Math.max(lo, Math.min(hi, y)) : d; };
  return {
    pass_threshold_pct: n(v.pass_threshold_pct, 50, 100, DEFAULT_POLICY.pass_threshold_pct),
    max_attempts: Math.round(n(v.max_attempts, 1, 20, DEFAULT_POLICY.max_attempts)),
    cooldown_hours: n(v.cooldown_hours, 0, 168, DEFAULT_POLICY.cooldown_hours),
    require_lessons_before_quiz: v.require_lessons_before_quiz !== false,
    practical_max_attempts: Math.round(n(v.practical_max_attempts, 1, 10, DEFAULT_POLICY.practical_max_attempts)),
    reveal_explanations: v.reveal_explanations !== false,
  };
}
// approved: the current approved sales_config row (or null); pending: latest draft/pending row (or null)
export function resolvePolicy(approved, pending) {
  if (approved) return { policy: normalizePolicy(approved.value), config_id: approved.id, version: approved.version, provisional: false, status: 'approved' };
  return { policy: normalizePolicy(pending?.value || DEFAULT_POLICY), config_id: pending?.id || null, version: pending?.version || 0, provisional: true, status: pending?.status || 'none' };
}

// questions: [{order_index, correct_index, critical, explanation}], answers: [{question_order, choice_index}]
export function gradeQuiz({ questions, answers, policy }) {
  const byQ = new Map(); for (const a of Array.isArray(answers) ? answers : []) { const o = Number(a?.question_order); if (Number.isInteger(o) && !byQ.has(o)) byQ.set(o, Number(a.choice_index)); }
  let correct = 0, criticalFailed = false; const results = [];
  for (const q of questions) {
    const given = byQ.get(q.order_index); const isCorrect = Number.isInteger(given) && given === q.correct_index;
    if (isCorrect) correct++; else if (q.critical) criticalFailed = true;
    results.push({ order: q.order_index, correct: isCorrect, answered: Number.isInteger(given), critical: !!q.critical, ...(policy.reveal_explanations && !isCorrect && q.explanation ? { explanation: q.explanation } : {}) });
  }
  const total = questions.length; const score = total ? Math.round((correct / total) * 1000) / 10 : 0;
  return { score, correct, total, criticalFailed, passed: total > 0 && score >= policy.pass_threshold_pct && !criticalFailed, results, answeredAll: results.every((r) => r.answered) };
}

// attempts: counted attempts for this enrollment (ascending); returns whether a new quiz attempt is allowed right now.
export function attemptGate({ policy, enrollmentStatus, attempts, lessonsCompleted, totalLessons, now = new Date() }) {
  if (['completed'].includes(enrollmentStatus)) return { allowed: false, reason: 'already_completed', message: 'This program is already completed.' };
  if (enrollmentStatus === 'awaiting_practical_review') return { allowed: false, reason: 'under_review', message: 'A reviewer is looking at your submission. You cannot retake the quiz until that is decided.' };
  if (enrollmentStatus === 'failed') return { allowed: false, reason: 'locked', message: 'This program is locked. Ask Nova to review it.' };
  if (policy.require_lessons_before_quiz && totalLessons > 0 && lessonsCompleted < totalLessons) return { allowed: false, reason: 'lessons_incomplete', message: `Finish all ${totalLessons} lessons first (${lessonsCompleted} done).` };
  if (attempts.length >= policy.max_attempts) return { allowed: false, reason: 'attempts_exhausted', message: `You have used all ${policy.max_attempts} attempts. Nova will review before another attempt is allowed.` };
  const last = attempts[attempts.length - 1];
  if (last && policy.cooldown_hours > 0) { const next = new Date(new Date(last.attempted_at).getTime() + policy.cooldown_hours * 3600_000); if (next > now) return { allowed: false, reason: 'cooldown', retryAt: next.toISOString(), message: `Please wait until ${next.toISOString()} before another attempt.` }; }
  return { allowed: true, attemptsUsed: attempts.length, attemptsLeft: policy.max_attempts - attempts.length };
}

// After a graded quiz: where does the enrollment go?
export function statusAfterQuiz({ program, passed, criticalFailed, attemptsUsed, policy, lessonsAllComplete }) {
  if (criticalFailed) return { status: 'awaiting_practical_review', locked_reason: 'critical_question_review' }; // existing behaviour: a critical miss always gets a human decision
  if (passed) {
    if (program.requires_practical) return { status: 'quiz_passed', locked_reason: null };
    return lessonsAllComplete ? { status: 'completed', locked_reason: null } : { status: 'in_progress', locked_reason: null };
  }
  if (attemptsUsed >= policy.max_attempts) return { status: 'failed', locked_reason: 'attempts_exhausted' };
  return { status: 'in_progress', locked_reason: null };
}

export function validatePractical(text, min = 200) {
  const t = String(text || '').trim(); if (t.length < min) return `Write at least ${min} characters — describe what you did, what you found, and what you would do next.`;
  if (t.length > 12000) return 'That is longer than 12,000 characters. Please tighten it.';
  return null;
}
export function validateRubricScores(rubric, scores, approve) {
  const keys = (rubric || []).map((r) => r.key); const out = {};
  if (approve && !keys.length) return { error: 'This program has no practical rubric configured yet, so it cannot be approved. Ask the owner to finish the program content.' };
  for (const k of keys) { const v = Number(scores?.[k]); if (scores?.[k] == null || !Number.isInteger(v) || v < 1 || v > 5) { if (approve || scores?.[k] != null) return { error: `Score "${k}" must be a whole number from 1 to 5.` }; continue; } out[k] = v; }
  if (approve && Object.values(out).some((v) => v < 3)) return { error: 'A practical cannot be approved while any criterion is scored below 3. Request changes instead.' };
  return { scores: out };
}

// Certificate: eligible only when everything the program requires is complete. Never trust the enrollment status alone.
export function certificateEligibility({ enrollment, program, totalLessons, lessonsCompleted, passedAttempt, practicalApproved, criticalApproved }) {
  const reasons = [];
  if (enrollment.status !== 'completed') reasons.push('program is not marked completed');
  if (lessonsCompleted < totalLessons) reasons.push('not every lesson is completed');
  if (!passedAttempt && !criticalApproved) reasons.push('no passing quiz result on record');
  if (program.requires_practical && !practicalApproved) reasons.push('the practical has not been approved');
  return { eligible: reasons.length === 0, reasons };
}
export function holderDisplayName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Nova Systems representative';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
export const CERTIFICATE_DISCLAIMER = 'Issued by Nova Systems LLC as an internal training certificate. It is not an accredited, licensed or third-party credential, and it does not authorize a person to act for Nova Systems — only activation by Nova does.';
