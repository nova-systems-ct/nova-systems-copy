import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize } from './_sanitize.js';
import { requireStaff } from './_auth.js';

// Nova Sales Academy — dispatch via ?action=. Every academy_* table is accessed exclusively
// through this file using the service-role key; there is no direct RLS-authenticated read path
// to academy_quiz_questions, specifically so a quiz taker can never read correct_index/
// explanation off PostgREST before (or instead of) actually taking the quiz. Grading happens
// entirely here, server-side, against the real stored answer key — never trust a client-supplied
// score. See supabase/schema-update.sql's "Nova Sales Academy" section for the schema this reads/
// writes, and its own comment for why RLS SELECT policies were deliberately NOT added for
// 'authenticated' on these tables.
//
//   programs            GET   [any staff] list all programs + caller's own enrollment status
//   program-detail       GET   [any staff] &id=<program_id> lesson content + quiz text (no
//                                          answers) + caller's own progress
//   my-enrollments         GET   [any staff] caller's own enrollments + certificates
//   enroll                   POST  [any staff, self only unless admin.view] { program_id,
//                                          staff_user_id? }
//   complete-lesson            POST  [any staff, self] { program_id, lesson_order }
//   submit-quiz                   POST  [any staff, self] { program_id, answers:
//                                          [{question_order, choice_index}] } — graded server-side
//   issue-certificate                POST  [any staff, self] { program_id } — re-verifies
//                                          eligibility server-side before issuing
//   practical-review                    POST  [admin.view] { enrollment_id, approved, notes }
//   admin-overview                         GET   [admin.view] every rep's enrollments/scores
//   verify-certificate                        GET   PUBLIC &code=<verification_code>

const SCORE_THRESHOLD_PERCENT = 80; // Proposed default per the master build prompt — NOT yet
// formally approved by Isaac as a business rule. Configurable here in one place; do not treat
// this number as final without that approval.

function sb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function sbFetch(path, opts = {}) {
  const s = sb();
  if (!s) throw new Error('Supabase not configured');
  const r = await fetch(`${s.url}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: s.key,
      Authorization: `Bearer ${s.key}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  return r;
}

async function fetchAuthUser(userId) {
  const s = sb();
  if (!s) return null;
  const r = await fetch(`${s.url}/auth/v1/admin/users/${userId}`, {
    headers: { apikey: s.key, Authorization: `Bearer ${s.key}` },
  });
  if (!r.ok) return null;
  return r.json();
}

// ------------------------------------------------------------------- programs
async function handlePrograms(req, res, caller) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const [progRes, lessonRes, quizRes, enrollRes] = await Promise.all([
    sbFetch('academy_programs?order=order_index.asc'),
    sbFetch('academy_lessons?select=id,program_id'),
    sbFetch('academy_quiz_questions?select=id,program_id'),
    sbFetch(`academy_enrollments?staff_user_id=eq.${encodeURIComponent(caller.id)}`),
  ]);
  if (!progRes.ok) { console.error('[academy:programs] error:', await progRes.text()); return res.status(500).json({ error: 'Failed to load programs' }); }

  const programs = await progRes.json();
  const lessons = lessonRes.ok ? await lessonRes.json() : [];
  const quiz = quizRes.ok ? await quizRes.json() : [];
  const enrollments = enrollRes.ok ? await enrollRes.json() : [];

  const lessonCounts = {};
  for (const l of lessons) lessonCounts[l.program_id] = (lessonCounts[l.program_id] || 0) + 1;
  const quizCounts = {};
  for (const q of quiz) quizCounts[q.program_id] = (quizCounts[q.program_id] || 0) + 1;
  const enrollByProgram = {};
  for (const e of enrollments) enrollByProgram[e.program_id] = e;

  const out = programs.map((p) => ({
    id: p.id, slug: p.slug, order_index: p.order_index, title: p.title, description: p.description,
    requires_practical: p.requires_practical, critical_compliance: p.critical_compliance,
    lesson_count: lessonCounts[p.id] || 0, quiz_question_count: quizCounts[p.id] || 0,
    enrollment: enrollByProgram[p.id] || null,
  }));
  return res.status(200).json(out);
}

// -------------------------------------------------------------- program-detail
async function handleProgramDetail(req, res, caller) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const id = sanitize(req.query?.id, 100);
  if (!id) return res.status(400).json({ error: 'id is required' });

  const [progRes, lessonRes, quizRes, enrollRes] = await Promise.all([
    sbFetch(`academy_programs?id=eq.${encodeURIComponent(id)}&limit=1`),
    sbFetch(`academy_lessons?program_id=eq.${encodeURIComponent(id)}&order=order_index.asc`),
    sbFetch(`academy_quiz_questions?program_id=eq.${encodeURIComponent(id)}&order=order_index.asc&select=id,order_index,question,choices`),
    sbFetch(`academy_enrollments?program_id=eq.${encodeURIComponent(id)}&staff_user_id=eq.${encodeURIComponent(caller.id)}&limit=1`),
  ]);
  if (!progRes.ok) return res.status(500).json({ error: 'Failed to load program' });
  const programs = await progRes.json();
  if (!programs.length) return res.status(404).json({ error: 'Program not found' });

  const lessons = lessonRes.ok ? await lessonRes.json() : [];
  const quiz = quizRes.ok ? await quizRes.json() : []; // correct_index/explanation deliberately
  // not selected above — the client never receives the answer key, even for its own program.
  const enrollments = enrollRes.ok ? await enrollRes.json() : [];

  return res.status(200).json({
    program: programs[0], lessons, quiz_questions: quiz, enrollment: enrollments[0] || null,
  });
}

// -------------------------------------------------------------- my-enrollments
async function handleMyEnrollments(req, res, caller) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const [enrollRes, certRes] = await Promise.all([
    sbFetch(`academy_enrollments?staff_user_id=eq.${encodeURIComponent(caller.id)}&select=*,academy_programs(title,slug,order_index,requires_practical)`),
    sbFetch(`academy_certificates?staff_user_id=eq.${encodeURIComponent(caller.id)}`),
  ]);
  const enrollments = enrollRes.ok ? await enrollRes.json() : [];
  const certificates = certRes.ok ? await certRes.json() : [];
  return res.status(200).json({ enrollments, certificates });
}

// ------------------------------------------------------------------- enroll
async function handleEnroll(req, res, caller) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;

  const b = req.body || {};
  const program_id = sanitize(b.program_id, 100);
  const requestedFor = sanitize(b.staff_user_id, 100) || caller.id;
  if (!program_id) return res.status(400).json({ error: 'program_id is required' });

  if (requestedFor !== caller.id) {
    if (!(await requireStaff(req, res, 'admin.view'))) return; // enrolling someone else requires admin
  }

  try {
    const r = await sbFetch('academy_enrollments', {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=ignore-duplicates' },
      body: JSON.stringify({ staff_user_id: requestedFor, program_id, status: 'not_started' }),
    });
    if (!r.ok) { console.error('[academy:enroll] error:', await r.text()); return res.status(500).json({ error: 'Failed to enroll' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, enrollment: rows[0] || null });
  } catch (err) {
    console.error('[academy:enroll] error:', err.message);
    return res.status(500).json({ error: 'Failed to enroll' });
  }
}

async function getOrCreateEnrollment(program_id, staff_user_id) {
  const existing = await sbFetch(`academy_enrollments?program_id=eq.${encodeURIComponent(program_id)}&staff_user_id=eq.${encodeURIComponent(staff_user_id)}&limit=1`);
  if (existing.ok) {
    const rows = await existing.json();
    if (rows.length) return rows[0];
  }
  const created = await sbFetch('academy_enrollments', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ staff_user_id, program_id, status: 'not_started' }),
  });
  if (!created.ok) return null;
  const rows = await created.json();
  return rows[0] || null;
}

// -------------------------------------------------------------- complete-lesson
async function handleCompleteLesson(req, res, caller) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const b = req.body || {};
  const program_id = sanitize(b.program_id, 100);
  const lesson_order = Number(b.lesson_order);
  if (!program_id || !Number.isFinite(lesson_order) || lesson_order < 1) {
    return res.status(400).json({ error: 'program_id and a valid lesson_order are required' });
  }

  const enrollment = await getOrCreateEnrollment(program_id, caller.id);
  if (!enrollment) return res.status(500).json({ error: 'Failed to load enrollment' });

  const newCount = Math.max(enrollment.lessons_completed || 0, lesson_order);
  const nextStatus = enrollment.status === 'not_started' ? 'in_progress' : enrollment.status;

  const r = await sbFetch(`academy_enrollments?id=eq.${encodeURIComponent(enrollment.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ lessons_completed: newCount, status: nextStatus, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) { console.error('[academy:complete-lesson] error:', await r.text()); return res.status(500).json({ error: 'Failed to update progress' }); }
  const rows = await r.json();
  return res.status(200).json({ ok: true, enrollment: rows[0] || null });
}

// ------------------------------------------------------------------ submit-quiz
async function handleSubmitQuiz(req, res, caller) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 15, 60_000)) return;

  const b = req.body || {};
  const program_id = sanitize(b.program_id, 100);
  const answers = Array.isArray(b.answers) ? b.answers : [];
  if (!program_id || !answers.length) return res.status(400).json({ error: 'program_id and answers are required' });

  const [progRes, quizRes] = await Promise.all([
    sbFetch(`academy_programs?id=eq.${encodeURIComponent(program_id)}&limit=1`),
    sbFetch(`academy_quiz_questions?program_id=eq.${encodeURIComponent(program_id)}&select=id,order_index,correct_index,critical`),
  ]);
  if (!progRes.ok || !quizRes.ok) return res.status(500).json({ error: 'Failed to load quiz' });
  const programs = await progRes.json();
  if (!programs.length) return res.status(404).json({ error: 'Program not found' });
  const program = programs[0];
  const questions = await quizRes.json();
  if (!questions.length) return res.status(500).json({ error: 'This program has no quiz questions configured yet' });

  // Grade entirely against the real stored answer key — the client's answers array only ever
  // carries question_order + choice_index, never a claimed correctness or score.
  const byOrder = Object.fromEntries(questions.map((q) => [q.order_index, q]));
  let correctCount = 0;
  let criticalFailed = false;
  for (const q of questions) {
    const given = answers.find((a) => Number(a.question_order) === q.order_index);
    const isCorrect = given && Number(given.choice_index) === q.correct_index;
    if (isCorrect) correctCount++;
    else if (q.critical) criticalFailed = true;
  }
  const score = Math.round((correctCount / questions.length) * 1000) / 10; // one decimal place
  const meetsThreshold = score >= SCORE_THRESHOLD_PERCENT && !criticalFailed;

  const enrollment = await getOrCreateEnrollment(program_id, caller.id);
  if (!enrollment) return res.status(500).json({ error: 'Failed to load enrollment' });

  const attemptRes = await sbFetch('academy_quiz_attempts', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      enrollment_id: enrollment.id, staff_user_id: caller.id, answers,
      score, passed: meetsThreshold, critical_failed: criticalFailed,
    }),
  });
  if (!attemptRes.ok) { console.error('[academy:submit-quiz] attempt error:', await attemptRes.text()); return res.status(500).json({ error: 'Failed to record attempt' }); }
  const attemptRows = await attemptRes.json();

  let nextStatus;
  if (criticalFailed) nextStatus = 'awaiting_practical_review'; // a critical-compliance miss always
  // gets a human look, regardless of overall score — per the master prompt's "critical compliance
  // failures can require manual review."
  else if (meetsThreshold) nextStatus = program.requires_practical ? 'awaiting_practical_review' : 'completed';
  else nextStatus = 'in_progress'; // below threshold, non-critical: free to retake

  const bestScore = Math.max(Number(enrollment.best_score) || 0, score);
  const updateRes = await sbFetch(`academy_enrollments?id=eq.${encodeURIComponent(enrollment.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: nextStatus, best_score: bestScore, updated_at: new Date().toISOString() }),
  });
  const updateRows = updateRes.ok ? await updateRes.json() : [];

  return res.status(200).json({
    ok: true,
    score, passed: meetsThreshold, critical_failed: criticalFailed,
    threshold: SCORE_THRESHOLD_PERCENT,
    correct_count: correctCount, total_questions: questions.length,
    attempt: attemptRows[0] || null,
    enrollment: updateRows[0] || enrollment,
  });
}

// -------------------------------------------------------------- practical-review
async function handlePracticalReview(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;

  const caller = await requireStaff(req, res, 'admin.view');
  if (!caller) return;

  const b = req.body || {};
  const enrollment_id = sanitize(b.enrollment_id, 100);
  const approved = b.approved === true || b.approved === 'true';
  const notes = sanitize(b.notes, 2000);
  if (!enrollment_id) return res.status(400).json({ error: 'enrollment_id is required' });

  const r = await sbFetch(`academy_enrollments?id=eq.${encodeURIComponent(enrollment_id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      status: approved ? 'completed' : 'failed',
      practical_approved_by: approved ? caller.id : null,
      practical_approved_at: approved ? new Date().toISOString() : null,
      practical_notes: notes || null,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!r.ok) { console.error('[academy:practical-review] error:', await r.text()); return res.status(500).json({ error: 'Failed to update enrollment' }); }
  const rows = await r.json();
  return res.status(200).json({ ok: true, enrollment: rows[0] || null });
}

// -------------------------------------------------------------- issue-certificate
function randomCode(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function handleIssueCertificate(req, res, caller) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const b = req.body || {};
  const program_id = sanitize(b.program_id, 100);
  if (!program_id) return res.status(400).json({ error: 'program_id is required' });

  // Re-verify eligibility server-side — never trust that the client's UI state is accurate.
  const enrollRes = await sbFetch(`academy_enrollments?program_id=eq.${encodeURIComponent(program_id)}&staff_user_id=eq.${encodeURIComponent(caller.id)}&limit=1`);
  if (!enrollRes.ok) return res.status(500).json({ error: 'Failed to verify eligibility' });
  const enrollments = await enrollRes.json();
  const enrollment = enrollments[0];
  if (!enrollment || enrollment.status !== 'completed') {
    return res.status(403).json({ error: 'This program is not yet completed — a certificate cannot be issued.' });
  }

  // Idempotent: if a certificate already exists for this enrollment, return it instead of
  // minting a second one.
  const existingRes = await sbFetch(`academy_certificates?enrollment_id=eq.${encodeURIComponent(enrollment.id)}&limit=1`);
  if (existingRes.ok) {
    const existing = await existingRes.json();
    if (existing.length) return res.status(200).json({ ok: true, certificate: existing[0], reused: true });
  }

  const progRes = await sbFetch(`academy_programs?id=eq.${encodeURIComponent(program_id)}&limit=1`);
  const progRows = progRes.ok ? await progRes.json() : [];
  const program = progRows[0];
  if (!program) return res.status(404).json({ error: 'Program not found' });

  const year = new Date().getFullYear();
  const certificate_number = `NOVA-ACAD-${year}-${randomCode(6)}`;
  const verification_code = randomCode(10);

  const insertRes = await sbFetch('academy_certificates', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      enrollment_id: enrollment.id, staff_user_id: caller.id, program_id,
      certificate_number, verification_code,
    }),
  });
  if (!insertRes.ok) { console.error('[academy:issue-certificate] error:', await insertRes.text()); return res.status(500).json({ error: 'Failed to issue certificate' }); }
  const rows = await insertRes.json();

  const authUser = await fetchAuthUser(caller.id);
  const holder_name = authUser?.user_metadata?.full_name || caller.email;

  return res.status(200).json({ ok: true, certificate: rows[0], program, holder_name });
}

// -------------------------------------------------------------- admin-overview
async function handleAdminOverview(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  if (!(await requireStaff(req, res, 'admin.view'))) return;

  const r = await sbFetch('academy_enrollments?select=*,academy_programs(title,slug,requires_practical,critical_compliance)&order=updated_at.desc');
  if (!r.ok) { console.error('[academy:admin-overview] error:', await r.text()); return res.status(500).json({ error: 'Failed to load overview' }); }
  const enrollments = await r.json();

  // Attach a display name/email per distinct staff_user_id without one admin API call per row.
  const uniqueIds = [...new Set(enrollments.map((e) => e.staff_user_id))];
  const users = {};
  await Promise.all(uniqueIds.map(async (id) => {
    const u = await fetchAuthUser(id);
    if (u) users[id] = { email: u.email, name: u.user_metadata?.full_name || u.email };
  }));

  return res.status(200).json(enrollments.map((e) => ({ ...e, staff: users[e.staff_user_id] || null })));
}

// -------------------------------------------------------------- verify-certificate
async function handleVerifyCertificate(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;

  const code = sanitize(req.query?.code, 20);
  if (!code) return res.status(400).json({ error: 'code is required' });

  const r = await sbFetch(`academy_certificates?verification_code=eq.${encodeURIComponent(code)}&select=certificate_number,issued_at,staff_user_id,academy_programs(title)&limit=1`);
  if (!r.ok) return res.status(500).json({ error: 'Verification failed' });
  const rows = await r.json();
  if (!rows.length) return res.status(404).json({ valid: false });

  const cert = rows[0];
  const authUser = await fetchAuthUser(cert.staff_user_id);
  const holder_name = authUser?.user_metadata?.full_name || authUser?.email || 'Nova Systems representative';

  return res.status(200).json({
    valid: true,
    certificate_number: cert.certificate_number,
    program_title: cert.academy_programs?.title,
    issued_at: cert.issued_at,
    holder_name,
    issuer: 'Nova Systems LLC',
  });
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const action = typeof req.query?.action === 'string' ? req.query.action : '';

  // Public, unauthenticated actions first.
  if (action === 'verify-certificate') return handleVerifyCertificate(req, res);

  // admin-overview and practical-review check admin.view themselves (a stricter permission than
  // academy.view, and nova_super_admin/nova_admin — the only roles with admin.view — already
  // carry academy.view too, so this ordering costs nothing). Every other action requires
  // academy.view specifically — NOT just "any active staff" — because a hidden UI link is not
  // authorization: a client-org role with no academy.view must be rejected here even if it knows
  // the raw API action name, not merely kept off the dashboard nav.
  if (action === 'admin-overview' || action === 'practical-review') {
    return action === 'admin-overview' ? handleAdminOverview(req, res) : handlePracticalReview(req, res);
  }

  const caller = await requireStaff(req, res, 'academy.view');
  if (!caller) return;

  switch (action) {
    case 'programs':            return handlePrograms(req, res, caller);
    case 'program-detail':      return handleProgramDetail(req, res, caller);
    case 'my-enrollments':      return handleMyEnrollments(req, res, caller);
    case 'enroll':              return handleEnroll(req, res, caller);
    case 'complete-lesson':     return handleCompleteLesson(req, res, caller);
    case 'submit-quiz':         return handleSubmitQuiz(req, res, caller);
    case 'issue-certificate':   return handleIssueCertificate(req, res, caller);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
