// Nova Sales Academy v2 — all grading, gating and certificate eligibility is decided HERE, on the server, from stored data.
// The browser only ever sends choices/text; it never supplies a score, a status, a pass flag, or an id that grants access
// (ownership always comes from the verified session). Answer keys are never selected into a learner response.
import { sanitize } from '../_sanitize.js';
import { rateLimit } from '../_rateLimit.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, inList, nowIso, audit, bad, wrap, requirePerm, isOwner, visibleRepUserIds, randomCode, displayNameOf, notify, novaOrgId, authUserById } from './core.js';
import { DEFAULT_POLICY, normalizePolicy, resolvePolicy, gradeQuiz, attemptGate, statusAfterQuiz, validatePractical, validateRubricScores, certificateEligibility, holderDisplayName, CERTIFICATE_DISCLAIMER } from './academyRules.js';
import { textPdf } from './pdf.js';

async function currentPolicy() {
  const [approved, pending] = await Promise.all([dbOne("sales_config?key=eq.academy_policy&status=eq.approved&select=*"), dbOne('sales_config?key=eq.academy_policy&status=in.(draft,pending_approval)&order=version.desc&select=*')]);
  return resolvePolicy(approved, pending);
}
async function getEnrollment(programId, userId, { create = true } = {}) {
  const e = await dbOne(`academy_enrollments?program_id=eq.${enc(programId)}&staff_user_id=eq.${enc(userId)}&select=*`);
  if (e || !create) return e;
  const ins = await dbInsert('academy_enrollments', { staff_user_id: userId, organization_id: await novaOrgId(), program_id: programId, status: 'not_started' }, { onConflict: 'staff_user_id,program_id' });
  return ins.row || (await dbOne(`academy_enrollments?program_id=eq.${enc(programId)}&staff_user_id=eq.${enc(userId)}&select=*`));
}
const progressOf = async (enrollmentId) => (await dbGet(`academy_lesson_progress?enrollment_id=eq.${enc(enrollmentId)}&select=lesson_order&order=lesson_order.asc`)).map((r) => r.lesson_order);
const countedAttempts = (enrollmentId) => dbGet(`academy_quiz_attempts?enrollment_id=eq.${enc(enrollmentId)}&counted=eq.true&order=attempted_at.asc&select=id,score,passed,critical_failed,attempted_at,policy_provisional,question_results`);
const isScopedTo = async (caller, userId) => { const v = await visibleRepUserIds(caller); return v === null || v.includes(userId); };

export const handleAcademy = wrap(async (req, res, action) => {
  // ---------------------------------------------------------------- public verification (minimal data)
  if (action === 'verify-certificate') {
    if (req.method !== 'GET') return bad(res, 405, 'Method not allowed');
    if (!rateLimit(req, res, 30, 60_000)) return;
    const code = sanitize(req.query?.code, 30).toUpperCase(); if (!code) return bad(res, 400, 'code is required');
    const c = await dbOne(`academy_certificates?verification_code=eq.${enc(code)}&select=certificate_number,issued_at,status,revoked_at,program_version,holder_display,policy_provisional,academy_programs(title)`);
    if (!c) return res.status(404).json({ valid: false, status: 'not_found' });
    return res.status(200).json({ valid: c.status === 'valid', status: c.status, certificate_number: c.certificate_number, program_title: c.academy_programs?.title, program_version: c.program_version, issued_at: c.issued_at, holder_name: c.holder_display, revoked_at: c.status === 'revoked' ? c.revoked_at : undefined, provisional_policy: c.policy_provisional, issuer: 'Nova Systems LLC', disclaimer: CERTIFICATE_DISCLAIMER });
  }

  const adminOps = ['admin-overview', 'practical-queue', 'review-practical', 'policy', 'certificates', 'programs-admin'];
  const ownerOps = ['critical-review', 'reset-attempts', 'revoke-certificate', 'save-policy', 'approve-policy', 'approve-content'];
  const caller = await requirePerm(req, res, ownerOps.includes(action) ? 'sales.owner' : adminOps.includes(action) ? 'sales.manage' : 'academy.view'); if (!caller) return;
  if (!rateLimit(req, res, 120, 60_000)) return;
  const b = req.body || {};
  const need = (m) => { if (req.method !== m) { bad(res, 405, 'Method not allowed'); return false; } return true; };

  // ================================================================ learner actions
  if (action === 'programs') {
    const [programs, lessons, quiz, exercises, enrolls, pol] = await Promise.all([dbGet('academy_programs?order=order_index.asc&select=id,slug,order_index,title,description,requires_practical,critical_compliance,version,content_review_status,learning_objectives'), dbGet('academy_lessons?select=program_id'), dbGet('academy_quiz_questions?select=program_id'), dbGet('academy_exercises?select=program_id'), dbGet(`academy_enrollments?staff_user_id=eq.${enc(caller.id)}&select=*`), currentPolicy()]);
    const count = (rows, id) => rows.filter((r) => r.program_id === id).length;
    return res.status(200).json({ policy: { ...pol.policy, provisional: pol.provisional, status: pol.status, version: pol.version }, programs: programs.map((p) => ({ ...p, lesson_count: count(lessons, p.id), quiz_question_count: count(quiz, p.id), exercise_count: count(exercises, p.id), enrollment: enrolls.find((e) => e.program_id === p.id) || null })) });
  }

  if (action === 'program-detail') {
    const id = sanitize(req.query?.id, 60); const program = id && (await dbOne(`academy_programs?id=eq.${enc(id)}&select=*`)); if (!program) return bad(res, 404, 'Program not found');
    const enrollment = await getEnrollment(id, caller.id);
    const [lessons, quiz, exercises, done, attempts, practicals, responses, pol, certRow] = await Promise.all([dbGet(`academy_lessons?program_id=eq.${enc(id)}&order=order_index.asc`), dbGet(`academy_quiz_questions?program_id=eq.${enc(id)}&order=order_index.asc&select=id,order_index,question,choices`), dbGet(`academy_exercises?program_id=eq.${enc(id)}&order=order_index.asc&select=id,order_index,lesson_order,title,prompt`), progressOf(enrollment.id), countedAttempts(enrollment.id), dbGet(`academy_practical_submissions?enrollment_id=eq.${enc(enrollment.id)}&order=attempt_no.asc`), dbGet(`academy_exercise_responses?enrollment_id=eq.${enc(enrollment.id)}&select=exercise_id,response,submitted_at`), currentPolicy(), dbOne(`academy_certificates?enrollment_id=eq.${enc(enrollment.id)}&select=id,certificate_number,verification_code,issued_at,status,policy_provisional,program_version`)]);
    const gate = attemptGate({ policy: pol.policy, enrollmentStatus: enrollment.status, attempts, lessonsCompleted: done.length, totalLessons: lessons.length });
    const exWithFeedback = [];
    for (const ex of exercises) {
      const r = responses.find((x) => x.exercise_id === ex.id);
      if (!r) { exWithFeedback.push({ ...ex, submitted: false }); continue; }
      const full = await dbOne(`academy_exercises?id=eq.${enc(ex.id)}&select=self_check,model_answer`); // revealed only AFTER the learner's own attempt
      exWithFeedback.push({ ...ex, submitted: true, response: r.response, self_check: full?.self_check || [], model_answer: full?.model_answer || null });
    }
    const nextLesson = lessons.find((l) => !done.includes(l.order_index))?.order_index || null;
    return res.status(200).json({
      program: { id: program.id, slug: program.slug, title: program.title, description: program.description, version: program.version, requires_practical: program.requires_practical, critical_compliance: program.critical_compliance, learning_objectives: program.learning_objectives, content_review_status: program.content_review_status, practical_prompt: program.requires_practical ? program.practical_prompt : null, practical_rubric: program.requires_practical ? program.practical_rubric : [] },
      lessons: lessons.map((l) => ({ ...l, completed: done.includes(l.order_index), locked: l.order_index > 1 && !done.includes(l.order_index - 1) && !done.includes(l.order_index) })),
      certificate: certRow || null, quiz_questions: quiz, exercises: exWithFeedback, enrollment: { ...enrollment, lessons_completed: done.length }, resume_lesson: nextLesson,
      quiz: { attempts_used: attempts.length, attempts_left: Math.max(0, pol.policy.max_attempts - attempts.length), best_score: attempts.reduce((m, a) => Math.max(m, Number(a.score)), 0) || null, last_results: attempts.length ? { score: attempts[attempts.length - 1].score, passed: attempts[attempts.length - 1].passed, critical_failed: attempts[attempts.length - 1].critical_failed, questions: attempts[attempts.length - 1].question_results } : null, gate },
      practicals: practicals.map((p) => ({ id: p.id, attempt_no: p.attempt_no, status: p.status, feedback: p.feedback, submitted_at: p.submitted_at, reviewed_at: p.reviewed_at, response: p.response })),
      policy: { ...pol.policy, provisional: pol.provisional, status: pol.status, version: pol.version },
    });
  }

  if (action === 'my-enrollments') {
    const [enrollments, certificates] = await Promise.all([dbGet(`academy_enrollments?staff_user_id=eq.${enc(caller.id)}&select=*,academy_programs(title,slug,order_index,requires_practical)`), dbGet(`academy_certificates?staff_user_id=eq.${enc(caller.id)}&select=id,certificate_number,verification_code,issued_at,status,program_id,program_version,holder_display,policy_provisional`)]);
    return res.status(200).json({ enrollments, certificates });
  }

  if (action === 'enroll') {
    if (!need('POST')) return;
    const target = sanitize(b.staff_user_id, 60) || caller.id;
    if (target !== caller.id && !(await isOwnerCaller(caller))) return bad(res, 403, 'Only the owner can enroll someone else.');
    const programId = sanitize(b.program_id, 60); if (!(await dbOne(`academy_programs?id=eq.${enc(programId)}&select=id`))) return bad(res, 404, 'Program not found');
    return res.status(200).json({ ok: true, enrollment: await getEnrollment(programId, target) });
  }

  if (action === 'complete-lesson') {
    if (!need('POST')) return;
    const programId = sanitize(b.program_id, 60); const order = Number(b.lesson_order);
    const lessons = await dbGet(`academy_lessons?program_id=eq.${enc(programId)}&select=order_index&order=order_index.asc`);
    if (!Number.isInteger(order) || !lessons.some((l) => l.order_index === order)) return bad(res, 400, 'That lesson does not exist in this program.');
    const enrollment = await getEnrollment(programId, caller.id); if (!enrollment) return bad(res, 404, 'Program not found');
    const done = await progressOf(enrollment.id);
    if (order > 1 && !done.includes(order - 1) && !done.includes(order)) return bad(res, 409, 'Complete the earlier lessons first.');
    await dbInsert('academy_lesson_progress', { enrollment_id: enrollment.id, lesson_order: order }, { onConflict: 'enrollment_id,lesson_order' });
    const total = (await progressOf(enrollment.id)).length;
    const [row] = await dbPatch('academy_enrollments', `id=eq.${enc(enrollment.id)}`, { lessons_completed: total, last_lesson_order: order, status: enrollment.status === 'not_started' ? 'in_progress' : enrollment.status, updated_at: nowIso() });
    return res.status(200).json({ ok: true, enrollment: row, lessons_completed: total, of: lessons.length });
  }

  if (action === 'submit-exercise') {
    if (!need('POST')) return;
    const ex = await dbOne(`academy_exercises?id=eq.${enc(sanitize(b.exercise_id, 60))}&select=*`); if (!ex) return bad(res, 404, 'Exercise not found');
    const text = sanitize(b.response, 6000); if (text.length < 20) return bad(res, 422, 'Write your own answer first (at least a couple of sentences) — the model answer appears after you submit.');
    const enrollment = await getEnrollment(ex.program_id, caller.id);
    await dbInsert('academy_exercise_responses', { enrollment_id: enrollment.id, exercise_id: ex.id, response: text }, { onConflict: 'enrollment_id,exercise_id' });
    return res.status(200).json({ ok: true, self_check: ex.self_check, model_answer: ex.model_answer });
  }

  if (action === 'submit-quiz') {
    if (!need('POST')) return;
    if (!rateLimit(req, res, 15, 60_000)) return;
    const programId = sanitize(b.program_id, 60); const program = await dbOne(`academy_programs?id=eq.${enc(programId)}&select=*`); if (!program) return bad(res, 404, 'Program not found');
    const questions = await dbGet(`academy_quiz_questions?program_id=eq.${enc(programId)}&select=order_index,correct_index,critical,explanation`);
    if (!questions.length) return bad(res, 409, 'This program has no quiz configured yet.');
    const enrollment = await getEnrollment(programId, caller.id); const pol = await currentPolicy();
    const [attempts, done, lessonTotal] = await Promise.all([countedAttempts(enrollment.id), progressOf(enrollment.id), dbGet(`academy_lessons?program_id=eq.${enc(programId)}&select=id`)]);
    const gate = attemptGate({ policy: pol.policy, enrollmentStatus: enrollment.status, attempts, lessonsCompleted: done.length, totalLessons: lessonTotal.length });
    if (!gate.allowed) return res.status(409).json({ error: gate.message, reason: gate.reason, retry_at: gate.retryAt });
    const g = gradeQuiz({ questions, answers: b.answers, policy: pol.policy });
    if (!g.answeredAll) return bad(res, 422, 'Answer every question before submitting.');
    const ins = await dbInsert('academy_quiz_attempts', { enrollment_id: enrollment.id, staff_user_id: caller.id, answers: (Array.isArray(b.answers) ? b.answers : []).slice(0, 100).map((a) => ({ question_order: Number(a.question_order), choice_index: Number(a.choice_index) })), score: g.score, passed: g.passed, critical_failed: g.criticalFailed, policy_config_id: pol.config_id, policy_snapshot: pol.policy, policy_provisional: pol.provisional, question_results: g.results, counted: true });
    const next = statusAfterQuiz({ program, passed: g.passed, criticalFailed: g.criticalFailed, attemptsUsed: attempts.length + 1, policy: pol.policy, lessonsAllComplete: done.length >= lessonTotal.length });
    const best = Math.max(Number(enrollment.best_score) || 0, g.score);
    const [row] = await dbPatch('academy_enrollments', `id=eq.${enc(enrollment.id)}`, { status: next.status, locked_reason: next.locked_reason, best_score: best, updated_at: nowIso() });
    await audit(caller, 'academy_attempt', ins.row.id, 'quiz_graded', { program: program.slug, score: g.score, passed: g.passed, critical_failed: g.criticalFailed, policy_version: pol.version, provisional: pol.provisional });
    return res.status(200).json({ ok: true, score: g.score, passed: g.passed, critical_failed: g.criticalFailed, threshold: pol.policy.pass_threshold_pct, policy_provisional: pol.provisional, correct_count: g.correct, total_questions: g.total, questions: g.results, attempts_used: attempts.length + 1, attempts_left: Math.max(0, pol.policy.max_attempts - attempts.length - 1), enrollment: row, next_step: next.status === 'quiz_passed' ? 'Quiz passed. Submit your practical for review.' : next.status === 'awaiting_practical_review' ? 'A reviewer must look at this result before you continue.' : next.status === 'completed' ? 'Program complete. You can now get your certificate.' : next.status === 'failed' ? 'You have used every attempt. Nova will review before you can try again.' : 'Review the feedback and try again.' });
  }

  if (action === 'submit-practical') {
    if (!need('POST')) return;
    const programId = sanitize(b.program_id, 60); const program = await dbOne(`academy_programs?id=eq.${enc(programId)}&select=*`);
    if (!program?.requires_practical) return bad(res, 409, 'This program has no practical assessment.');
    const enrollment = await getEnrollment(programId, caller.id); const pol = await currentPolicy();
    if (enrollment.status !== 'quiz_passed') return bad(res, 409, enrollment.status === 'awaiting_practical_review' ? 'Your practical is already with a reviewer.' : 'Pass the quiz first, then submit your practical.');
    const err = validatePractical(b.response); if (err) return bad(res, 422, err);
    const prior = await dbGet(`academy_practical_submissions?enrollment_id=eq.${enc(enrollment.id)}&select=attempt_no,status&order=attempt_no.desc`);
    if (prior.length >= pol.policy.practical_max_attempts) return bad(res, 409, `You have used all ${pol.policy.practical_max_attempts} practical attempts. Nova will contact you.`);
    const ins = await dbInsert('academy_practical_submissions', { enrollment_id: enrollment.id, attempt_no: (prior[0]?.attempt_no || 0) + 1, response: String(b.response).trim().slice(0, 12000) });
    if (ins.conflict) return bad(res, 409, 'A submission is already awaiting review.');
    await dbPatch('academy_enrollments', `id=eq.${enc(enrollment.id)}`, { status: 'awaiting_practical_review', locked_reason: 'practical_review', updated_at: nowIso() });
    await audit(caller, 'academy_practical', ins.row.id, 'submitted', { program: program.slug });
    return res.status(200).json({ ok: true, submission_id: ins.row.id, status: 'awaiting_practical_review' });
  }

  if (action === 'issue-certificate') {
    if (!need('POST')) return;
    const programId = sanitize(b.program_id, 60); const program = await dbOne(`academy_programs?id=eq.${enc(programId)}&select=*`); if (!program) return bad(res, 404, 'Program not found');
    const enrollment = await getEnrollment(programId, caller.id, { create: false });
    if (!enrollment) return bad(res, 403, 'You are not enrolled in this program.');
    const existing = await dbOne(`academy_certificates?enrollment_id=eq.${enc(enrollment.id)}&select=*`); if (existing) return res.status(200).json({ ok: true, certificate: existing, reused: true });
    const [done, lessons, attempts, practical] = await Promise.all([progressOf(enrollment.id), dbGet(`academy_lessons?program_id=eq.${enc(programId)}&select=id`), dbGet(`academy_quiz_attempts?enrollment_id=eq.${enc(enrollment.id)}&passed=eq.true&counted=eq.true&select=id,policy_config_id,policy_provisional&limit=1`), dbOne(`academy_practical_submissions?enrollment_id=eq.${enc(enrollment.id)}&status=eq.approved&select=id`)]);
    const criticalApproved = enrollment.locked_reason === 'critical_approved';
    const el = certificateEligibility({ enrollment, program, totalLessons: lessons.length, lessonsCompleted: done.length, passedAttempt: attempts[0], practicalApproved: !!practical, criticalApproved });
    if (!el.eligible) return res.status(403).json({ error: `A certificate cannot be issued yet: ${el.reasons.join('; ')}.` });
    const authUser = await authUserById(caller.id); const rep = await dbOne(`sales_reps?user_id=eq.${enc(caller.id)}&select=display_name`);
    const full = rep?.display_name || authUser?.user_metadata?.full_name || caller.email;
    const pol = await currentPolicy();
    let cert = null;
    for (let i = 0; i < 4 && !cert; i++) {
      const ins = await dbInsert('academy_certificates', { enrollment_id: enrollment.id, staff_user_id: caller.id, program_id: programId, program_version: program.version || 1, certificate_number: randomCode(8, `NOVA-CERT-${new Date().getFullYear()}-`), verification_code: randomCode(12), holder_full_name: full, holder_display: holderDisplayName(full), policy_config_id: attempts[0]?.policy_config_id || pol.config_id, policy_provisional: attempts[0]?.policy_provisional ?? pol.provisional, status: 'valid' });
      if (ins.row) cert = ins.row; else { const again = await dbOne(`academy_certificates?enrollment_id=eq.${enc(enrollment.id)}&select=*`); if (again) cert = again; }
    }
    await audit(caller, 'academy_certificate', cert.id, 'issued', { program: program.slug, provisional_policy: cert.policy_provisional });
    return res.status(200).json({ ok: true, certificate: cert });
  }

  if (action === 'certificate-pdf') {
    const c = await dbOne(`academy_certificates?id=eq.${enc(sanitize(req.query?.id, 60))}&select=*,academy_programs(title)`); if (!c) return bad(res, 404, 'Certificate not found');
    if (c.staff_user_id !== caller.id && !(await isOwnerCaller(caller))) return bad(res, 403, 'You can only download your own certificate.');
    const pdf = textPdf({ title: `Nova Certificate ${c.certificate_number}`, blocks: [
      { style: 'h1', text: 'NOVA SYSTEMS' }, { style: 'h2', text: 'Certificate of Training Completion' }, { style: 'gap' },
      { style: 'p', text: `This certifies that ${c.holder_full_name || c.holder_display} completed the Nova Sales Academy program:` }, { style: 'h2', text: `${c.academy_programs?.title} (version ${c.program_version})` }, { style: 'gap' },
      { style: 'p', text: `Issued: ${new Date(c.issued_at).toISOString().slice(0, 10)}` }, { style: 'mono', text: `Certificate ID: ${c.certificate_number}` }, { style: 'mono', text: `Verification code: ${c.verification_code}` }, { style: 'mono', text: `Verify at: /verify-certificate` },
      { style: 'gap' }, { style: 'p', text: `Status: ${c.status === 'valid' ? 'VALID' : `REVOKED ${c.revoked_at ? new Date(c.revoked_at).toISOString().slice(0, 10) : ''}`}` },
      ...(c.policy_provisional ? [{ style: 'p', text: 'Note: issued while the Academy passing rule was still pending owner approval (provisional).' }] : []),
      { style: 'gap' }, { style: 'small', text: CERTIFICATE_DISCLAIMER }] });
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${c.certificate_number}.pdf"`);
    return res.status(200).send(pdf);
  }

  // ================================================================ manager / owner actions
  if (action === 'admin-overview') {
    const scope = await visibleRepUserIds(caller);
    let q = 'academy_enrollments?select=*,academy_programs(title,slug,order_index,requires_practical,critical_compliance)&order=updated_at.desc&limit=500';
    if (scope) q += scope.length ? `&staff_user_id=in.${inList(scope)}` : '&staff_user_id=eq.00000000-0000-0000-0000-000000000000';
    const rows = await dbGet(q); const names = {};
    for (const id of [...new Set(rows.map((r) => r.staff_user_id))]) names[id] = await displayNameOf(id);
    return res.status(200).json(rows.map((r) => ({ ...r, staff: { name: names[r.staff_user_id] } })));
  }
  if (action === 'certificates') {
    const scope = await visibleRepUserIds(caller);
    let q = 'academy_certificates?order=issued_at.desc&limit=300&select=id,staff_user_id,certificate_number,issued_at,status,revoked_at,revoked_reason,policy_provisional,program_version,academy_programs(title)';
    if (scope) q += scope.length ? `&staff_user_id=in.${inList(scope)}` : '&staff_user_id=eq.00000000-0000-0000-0000-000000000000';
    const rows = await dbGet(q); const names = {}; for (const id of [...new Set(rows.map((r) => r.staff_user_id))]) names[id] = await displayNameOf(id);
    return res.status(200).json(rows.map((r) => ({ ...r, holder: names[r.staff_user_id] })));
  }
  if (action === 'programs-admin') {
    const rows = await dbGet('academy_programs?order=order_index.asc&select=id,slug,order_index,title,version,content_review_status,content_reviewed_at,requires_practical,critical_compliance');
    return res.status(200).json(rows);
  }
  if (action === 'practical-queue') {
    const scope = await visibleRepUserIds(caller);
    const subs = await dbGet('academy_practical_submissions?status=eq.submitted&order=submitted_at.asc&select=*,academy_enrollments(staff_user_id,program_id,academy_programs(title,practical_rubric,practical_prompt))');
    const out = []; for (const s of subs) { const uid = s.academy_enrollments?.staff_user_id; if (scope && !scope.includes(uid)) continue; out.push({ id: s.id, attempt_no: s.attempt_no, response: s.response, submitted_at: s.submitted_at, learner: { id: uid, name: await displayNameOf(uid) }, program: s.academy_enrollments?.academy_programs?.title, rubric: s.academy_enrollments?.academy_programs?.practical_rubric || [], prompt: s.academy_enrollments?.academy_programs?.practical_prompt }); }
    return res.status(200).json(out);
  }
  if (action === 'review-practical') {
    if (!need('POST')) return;
    const sub = await dbOne(`academy_practical_submissions?id=eq.${enc(sanitize(b.submission_id, 60))}&select=*,academy_enrollments(id,staff_user_id,program_id,academy_programs(practical_rubric,title))`); if (!sub) return bad(res, 404, 'Submission not found');
    if (sub.status !== 'submitted') return bad(res, 409, 'This submission was already reviewed.');
    const learner = sub.academy_enrollments.staff_user_id;
    if (learner === caller.id) return bad(res, 403, 'You cannot review your own work.');
    if (!(await isScopedTo(caller, learner))) return bad(res, 403, 'This learner is not on your team.');
    const decision = { approve: 'approved', changes: 'changes_requested', reject: 'rejected' }[b.decision]; if (!decision) return bad(res, 422, 'decision must be approve, changes or reject.');
    const feedback = sanitize(b.feedback, 3000); if (feedback.length < 10) return bad(res, 422, 'Write constructive feedback the learner will see (at least a sentence).');
    const sc = validateRubricScores(sub.academy_enrollments.academy_programs.practical_rubric, b.rubric_scores, decision === 'approved'); if (sc.error) return bad(res, 422, sc.error);
    const [row] = await dbPatch('academy_practical_submissions', `id=eq.${enc(sub.id)}&status=eq.submitted`, { status: decision, reviewer_id: caller.id, rubric_scores: sc.scores, feedback, reviewed_at: nowIso() });
    if (!row) return bad(res, 409, 'This submission was just reviewed by someone else.');
    const enrollStatus = decision === 'approved' ? 'completed' : decision === 'changes_requested' ? 'quiz_passed' : 'failed';
    await dbPatch('academy_enrollments', `id=eq.${enc(sub.academy_enrollments.id)}`, { status: enrollStatus, locked_reason: decision === 'rejected' ? 'practical_rejected' : null, practical_approved_by: decision === 'approved' ? caller.id : null, practical_approved_at: decision === 'approved' ? nowIso() : null, practical_notes: feedback, updated_at: nowIso() });
    await audit(caller, 'academy_practical', sub.id, `practical_${decision}`, { learner });
    await notify({ userId: learner, kind: 'practical_reviewed', subject: `Practical review: ${decision.replace('_', ' ')}`, body: `${feedback}\n\nOpen the program in your training to continue.`, link: '/rep/training', channels: ['in_app'], idempotencyKey: `prac:${sub.id}` });
    return res.status(200).json({ ok: true, status: decision, enrollment_status: enrollStatus });
  }
  if (action === 'policy') {
    const pol = await currentPolicy(); const versions = await dbGet('sales_config?key=eq.academy_policy&order=version.desc&select=id,version,status,value,change_note,approved_at');
    return res.status(200).json({ current: { ...pol.policy, provisional: pol.provisional, status: pol.status, version: pol.version }, versions });
  }
  if (action === 'save-policy') {
    if (!need('POST')) return;
    const v = normalizePolicy(b); const last = await dbOne('sales_config?key=eq.academy_policy&order=version.desc&select=version');
    const ins = await dbInsert('sales_config', { key: 'academy_policy', version: (last?.version || 0) + 1, status: 'pending_approval', value: v, change_note: sanitize(b.change_note, 500) || null, created_by: caller.id });
    await audit(caller, 'academy_policy', ins.row.id, 'proposed', v);
    return res.status(200).json({ ok: true, config: ins.row });
  }
  if (action === 'approve-policy') {
    if (!need('POST')) return;
    const cfg = await dbOne(`sales_config?id=eq.${enc(sanitize(b.config_id, 60))}&key=eq.academy_policy&select=*`); if (!cfg) return bad(res, 404, 'Policy version not found');
    if (cfg.status === 'approved') return res.status(200).json({ ok: true, unchanged: true });
    await dbPatch('sales_config', 'key=eq.academy_policy&status=eq.approved', { status: 'retired' });
    const [row] = await dbPatch('sales_config', `id=eq.${enc(cfg.id)}`, { status: 'approved', approved_by: caller.id, approved_at: nowIso() });
    await audit(caller, 'academy_policy', cfg.id, 'approved', cfg.value);
    return res.status(200).json({ ok: true, config: row });
  }
  if (action === 'approve-content') {
    if (!need('POST')) return;
    const [row] = await dbPatch('academy_programs', `id=eq.${enc(sanitize(b.program_id, 60))}`, { content_review_status: 'approved', content_reviewed_by: caller.id, content_reviewed_at: nowIso() });
    if (!row) return bad(res, 404, 'Program not found');
    await audit(caller, 'academy_program', row.id, 'content_approved', { version: row.version });
    return res.status(200).json({ ok: true });
  }
  if (action === 'reset-attempts') {
    if (!need('POST')) return;
    const e = await dbOne(`academy_enrollments?id=eq.${enc(sanitize(b.enrollment_id, 60))}&select=*`); if (!e) return bad(res, 404, 'Enrollment not found');
    const reason = sanitize(b.reason, 500); if (reason.length < 5) return bad(res, 422, 'Record why attempts are being reset.');
    await dbPatch('academy_quiz_attempts', `enrollment_id=eq.${enc(e.id)}&counted=eq.true`, { counted: false }); // history kept; they simply stop counting
    const [row] = await dbPatch('academy_enrollments', `id=eq.${enc(e.id)}`, { status: e.status === 'completed' ? 'completed' : 'in_progress', locked_reason: null, attempts_reset_count: (e.attempts_reset_count || 0) + 1, updated_at: nowIso() });
    await audit(caller, 'academy_enrollment', e.id, 'attempts_reset', { reason });
    return res.status(200).json({ ok: true, enrollment: row });
  }
  if (action === 'critical-review') {
    if (!need('POST')) return;
    const e = await dbOne(`academy_enrollments?id=eq.${enc(sanitize(b.enrollment_id, 60))}&select=*`);
    if (!e || e.locked_reason !== 'critical_question_review') return bad(res, 409, 'This enrollment is not waiting on a critical-question review.');
    const notes = sanitize(b.notes, 2000); if (notes.length < 15) return bad(res, 422, 'Document the conversation and reasoning (at least a sentence).');
    if (b.decision === 'allow_retake') { const [row] = await dbPatch('academy_enrollments', `id=eq.${enc(e.id)}`, { status: 'in_progress', locked_reason: null, practical_notes: notes, updated_at: nowIso() }); await audit(caller, 'academy_enrollment', e.id, 'critical_retake_allowed', { notes }); return res.status(200).json({ ok: true, enrollment: row }); }
    if (b.decision === 'approve') { const [row] = await dbPatch('academy_enrollments', `id=eq.${enc(e.id)}`, { status: 'completed', locked_reason: 'critical_approved', practical_approved_by: caller.id, practical_approved_at: nowIso(), practical_notes: notes, updated_at: nowIso() }); await audit(caller, 'academy_enrollment', e.id, 'critical_approved', { notes }); return res.status(200).json({ ok: true, enrollment: row }); }
    return bad(res, 422, 'decision must be allow_retake or approve.');
  }
  if (action === 'revoke-certificate') {
    if (!need('POST')) return;
    const reason = sanitize(b.reason, 500); if (reason.length < 5) return bad(res, 422, 'A revocation needs a recorded reason.');
    const [row] = await dbPatch('academy_certificates', `id=eq.${enc(sanitize(b.certificate_id, 60))}&status=eq.valid`, { status: 'revoked', revoked_at: nowIso(), revoked_by: caller.id, revoked_reason: reason });
    if (!row) return bad(res, 404, 'No valid certificate with that id.');
    await audit(caller, 'academy_certificate', row.id, 'revoked', { reason });
    return res.status(200).json({ ok: true });
  }
  return bad(res, 400, `Unknown action: ${action}`);
});
const isOwnerCaller = async (caller) => isOwner(caller);
void DEFAULT_POLICY;
