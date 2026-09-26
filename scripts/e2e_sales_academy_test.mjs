// Academy v2: real handlers (api/academy.js) against REAL PostgreSQL + PostgREST (local, disposable). Auth/Storage/Resend are stand-ins.
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const env = await startTestEnv({ migrations: allMigrations(), publicBuckets: [] });
Object.assign(process.env, env.appEnv, { APP_BASE_URL: 'https://app.test', SALES_EMAIL_MODE: 'dry_run' });
const { default: academy } = await import('../api/academy.js');
const A = makeCaller(academy);
try {
  const org = (await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).rows[0].id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: org, name: 'Isaac Owner' });
  const mgr = await env.createUser({ email: 'mgr@nova.test', role: 'nova_sales_manager', orgId: org, name: 'Mia Manager' });
  const mgr2 = await env.createUser({ email: 'mgr2@nova.test', role: 'nova_sales_manager', orgId: org, name: 'Other Manager' });
  const c1 = await env.createUser({ email: 'c1@nova.test', role: 'nova_sales_candidate', orgId: org, name: 'Jane Marie Doe' });
  const c2 = await env.createUser({ email: 'c2@nova.test', role: 'nova_sales_candidate', orgId: org, name: 'Sam Second' });
  const client = await env.createUser({ email: 'client@x.test', role: 'client_owner', orgId: (await env.sql("insert into organizations (name, slug, kind) values ('Acme','acme','client') returning id")).rows[0].id });
  await env.sql("insert into sales_reps (user_id, organization_id, display_name, status, manager_user_id) values ($1,$3,'Jane Marie Doe','candidate',$2), ($4,$3,'Sam Second','candidate',$5)", [c1.id, mgr.id, org, c2.id, mgr2.id]);
  await env.reload();

  const prog = async (where) => (await env.sql(`select * from academy_programs where ${where} order by order_index limit 1`)).rows[0];
  const p1 = await prog('requires_practical=false and critical_compliance=false');
  const p6 = await prog('requires_practical=true');
  const p10 = await prog('critical_compliance=true');
  const key = async (pid) => (await env.sql('select order_index, correct_index, critical from academy_quiz_questions where program_id=$1 order by order_index', [pid])).rows;
  const answers = async (pid, { wrong = [] } = {}) => (await key(pid)).map((q) => ({ question_order: q.order_index, choice_index: wrong.includes(q.order_index) ? (q.correct_index + 1) % 4 : q.correct_index }));
  const lessonsOf = async (pid) => (await env.sql('select order_index from academy_lessons where program_id=$1 order by order_index', [pid])).rows.map((r) => r.order_index);
  const doLessons = async (tok, pid) => { for (const o of await lessonsOf(pid)) await A({ action: 'complete-lesson', token: tok, body: { program_id: pid, lesson_order: o } }); };

  // ---------------------------------------------------------------- listing / detail: no answer key
  let r = await A({ action: 'programs', method: 'GET', token: c1.token });
  check('programs list: 10 programs, policy is PROVISIONAL (owner has not approved 80%)', r.status === 200 && r.body.programs.length === 10 && r.body.policy.provisional === true && r.body.policy.pass_threshold_pct === 80);
  check('programs list contains no answer material', !/"correct_index"|"explanation"/.test(JSON.stringify(r.body)));
  r = await A({ action: 'program-detail', method: 'GET', token: c1.token, query: { id: p1.id } });
  check('program-detail: lessons + questions with choices, and NO correct_index/explanation', r.status === 200 && r.body.lessons.length >= 1 && r.body.quiz_questions.length >= 1 && !/correct_index|explanation/.test(JSON.stringify(r.body.quiz_questions)));
  check('program-detail: first lesson open, later lessons locked until the earlier one is done', r.body.lessons[0].locked === false && (r.body.lessons.length < 2 || r.body.lessons[1].locked === true));
  r = await A({ action: 'programs', method: 'GET' });
  check('no session → 401', r.status === 401);
  r = await A({ action: 'programs', method: 'GET', token: client.token });
  check('a client-org user is rejected (no academy.view)', r.status === 403);

  // ---------------------------------------------------------------- lesson gating & quiz gating
  const lessons1 = await lessonsOf(p1.id);
  r = await A({ action: 'submit-quiz', token: c1.token, body: { program_id: p1.id, answers: await answers(p1.id) } });
  check('quiz refused until every lesson is completed', r.status === 409 && r.body.reason === 'lessons_incomplete');
  if (lessons1.length > 1) { r = await A({ action: 'complete-lesson', token: c1.token, body: { program_id: p1.id, lesson_order: lessons1[1] } }); check('lessons cannot be completed out of order', r.status === 409); }
  r = await A({ action: 'complete-lesson', token: c1.token, body: { program_id: p1.id, lesson_order: 999 } });
  check('a nonexistent lesson is rejected', r.status === 400);
  await doLessons(c1.token, p1.id);
  r = await A({ action: 'program-detail', method: 'GET', token: c1.token, query: { id: p1.id } });
  check('progress persisted; resume points past completed lessons', r.body.enrollment.lessons_completed === lessons1.length && r.body.resume_lesson === null);

  // ---------------------------------------------------------------- grading: server decides
  r = await A({ action: 'submit-quiz', token: c1.token, body: { program_id: p1.id, answers: (await answers(p1.id)).slice(0, 1) } });
  check('incomplete answers rejected and NOT counted as an attempt', r.status === 422 && (await env.sql('select count(*) from academy_quiz_attempts')).rows[0].count === '0');
  const allWrong = (await key(p1.id)).map((q) => q.order_index);
  r = await A({ action: 'submit-quiz', token: c1.token, body: { program_id: p1.id, score: 100, passed: true, status: 'completed', answers: await answers(p1.id, { wrong: allWrong }) } });
  check('client-supplied score/passed/status are ignored: all-wrong answers fail', r.status === 200 && r.body.passed === false && r.body.score === 0 && r.body.enrollment.status === 'in_progress');
  check('response reveals per-question correctness but never the correct index', !/correct_index|correctIndex/.test(JSON.stringify(r.body)));
  const at = (await env.sql('select policy_snapshot, policy_provisional, counted, score from academy_quiz_attempts')).rows[0];
  check('attempt stores the policy snapshot + provisional flag', at.policy_snapshot.pass_threshold_pct === 80 && at.policy_provisional === true && at.counted === true);
  await A({ action: 'submit-quiz', token: c1.token, body: { program_id: p1.id, answers: await answers(p1.id, { wrong: allWrong }) } });
  r = await A({ action: 'submit-quiz', token: c1.token, body: { program_id: p1.id, answers: await answers(p1.id, { wrong: allWrong }) } });
  check('third failure locks the program (attempt limit from policy)', r.body.enrollment.status === 'failed' && r.body.attempts_left === 0);
  r = await A({ action: 'submit-quiz', token: c1.token, body: { program_id: p1.id, answers: await answers(p1.id) } });
  check('no 4th attempt while locked', r.status === 409);

  // owner reset
  const enr1 = (await env.sql('select id from academy_enrollments where staff_user_id=$1 and program_id=$2', [c1.id, p1.id])).rows[0].id;
  r = await A({ action: 'reset-attempts', token: c1.token, body: { enrollment_id: enr1, reason: 'please' } });
  check('a candidate cannot reset their own attempts', r.status === 403);
  r = await A({ action: 'reset-attempts', token: mgr.token, body: { enrollment_id: enr1, reason: 'please' } });
  check('a manager cannot reset attempts (owner only)', r.status === 403);
  r = await A({ action: 'reset-attempts', token: owner.token, body: { enrollment_id: enr1, reason: '' } });
  check('reset needs a recorded reason', r.status === 422);
  r = await A({ action: 'reset-attempts', token: owner.token, body: { enrollment_id: enr1, reason: 'Learner had a connection problem during attempts' } });
  check('owner reset works, keeps attempt history (uncounted) and is audited', r.status === 200 && (await env.sql("select count(*) from academy_quiz_attempts where enrollment_id=$1 and counted=false", [enr1])).rows[0].count === '3' && (await env.sql("select count(*) from sales_audit_log where action='attempts_reset'")).rows[0].count === '1');
  r = await A({ action: 'submit-quiz', token: c1.token, body: { program_id: p1.id, answers: await answers(p1.id) } });
  check('after reset a correct submission passes → program completed (no practical needed)', r.status === 200 && r.body.passed && r.body.score === 100 && r.body.enrollment.status === 'completed');

  // ---------------------------------------------------------------- certificate
  r = await A({ action: 'issue-certificate', token: c2.token, body: { program_id: p1.id } });
  check('cannot issue a certificate without being enrolled/complete', r.status === 403);
  r = await A({ action: 'issue-certificate', token: c1.token, body: { program_id: p1.id } });
  const cert = r.body.certificate;
  check('certificate issued: unique id + verification code, provisional policy flagged, holder name kept private-side', r.status === 200 && /^NOVA-CERT-\d{4}-/.test(cert.certificate_number) && cert.policy_provisional === true && cert.holder_display === 'Jane D.' && cert.program_version === 1);
  r = await A({ action: 'issue-certificate', token: c1.token, body: { program_id: p1.id } });
  check('re-issuing returns the same certificate (no duplicates)', r.body.certificate.id === cert.id && (await env.sql('select count(*) from academy_certificates')).rows[0].count === '1');
  r = await A({ action: 'verify-certificate', method: 'GET', query: { code: cert.verification_code.toLowerCase() } });
  check('public verification: valid, minimal PII (first name + initial), disclaimer, no email/user id', r.status === 200 && r.body.valid && r.body.holder_name === 'Jane D.' && /not an accredited/.test(r.body.disclaimer) && !/c1@nova|staff_user_id|Marie/.test(JSON.stringify(r.body)));
  r = await A({ action: 'verify-certificate', method: 'GET', query: { code: 'NOPE' } });
  check('unknown code → 404 valid:false', r.status === 404 && r.body.valid === false);
  r = await A({ action: 'certificate-pdf', method: 'GET', token: c1.token, query: { id: cert.id } });
  check('holder can download a real PDF', r.status === 200 && r.headers['Content-Type'] === 'application/pdf' && Buffer.from(r.body).toString('latin1').startsWith('%PDF-') && Buffer.from(r.body).toString('latin1').includes(cert.certificate_number));
  r = await A({ action: 'certificate-pdf', method: 'GET', token: c2.token, query: { id: cert.id } });
  check("another candidate cannot download someone else's certificate", r.status === 403);
  r = await A({ action: 'revoke-certificate', token: mgr.token, body: { certificate_id: cert.id, reason: 'testing' } });
  check('a manager cannot revoke a certificate', r.status === 403);
  r = await A({ action: 'revoke-certificate', token: owner.token, body: { certificate_id: cert.id, reason: 'Issued in error during test' } });
  const v2 = await A({ action: 'verify-certificate', method: 'GET', query: { code: cert.verification_code } });
  check('owner revocation works; verification now shows revoked (and stays 200 so the status is visible)', r.status === 200 && v2.body.valid === false && v2.body.status === 'revoked');

  // ---------------------------------------------------------------- practical program (6/7)
  await env.sql("update academy_programs set practical_rubric=$2::jsonb where id=$1", [p6.id, JSON.stringify([{ key: 'diagnosis_first', label: 'Diagnosis first' }, { key: 'no_promises', label: 'No promises' }])]);
  await doLessons(c1.token, p6.id);
  r = await A({ action: 'submit-practical', token: c1.token, body: { program_id: p6.id, response: 'x'.repeat(300) } });
  check('practical cannot be submitted before the quiz is passed', r.status === 409);
  r = await A({ action: 'submit-quiz', token: c1.token, body: { program_id: p6.id, answers: await answers(p6.id) } });
  check('quiz passed → quiz_passed (NOT completed) because the program needs a practical', r.body.passed && r.body.enrollment.status === 'quiz_passed');
  const enr6 = r.body.enrollment.id;
  r = await A({ action: 'issue-certificate', token: c1.token, body: { program_id: p6.id } });
  check('no certificate after the quiz alone', r.status === 403);
  r = await A({ action: 'submit-practical', token: c1.token, body: { program_id: p6.id, response: 'too short' } });
  check('a thin practical is rejected', r.status === 422);
  r = await A({ action: 'submit-practical', token: c1.token, body: { program_id: p6.id, response: 'I opened by asking how new customers reach the business and what happens to missed calls. '.repeat(4) } });
  const sub1 = r.body.submission_id;
  check('practical submitted → awaiting_practical_review', r.status === 200 && r.body.status === 'awaiting_practical_review');
  r = await A({ action: 'submit-practical', token: c1.token, body: { program_id: p6.id, response: 'again '.repeat(60) } });
  check('a second submission while one is open is refused', r.status === 409);
  r = await A({ action: 'practical-queue', method: 'GET', token: c1.token });
  check('a candidate cannot open the review queue', r.status === 403);
  r = await A({ action: 'practical-queue', method: 'GET', token: mgr2.token });
  check("a manager sees only THEIR reps' submissions (mgr2 sees none)", r.status === 200 && r.body.length === 0);
  r = await A({ action: 'practical-queue', method: 'GET', token: mgr.token });
  check("the assigned manager sees it with the rubric and prompt", r.body.length === 1 && Array.isArray(r.body[0].rubric));
  const rubric = r.body[0].rubric; const scores = (n) => Object.fromEntries(rubric.map((c) => [c.key, n]));
  r = await A({ action: 'review-practical', token: mgr2.token, body: { submission_id: sub1, decision: 'approve', feedback: 'Looks good to me overall.', rubric_scores: scores(4) } });
  check("a manager cannot review another manager's rep", r.status === 403);
  r = await A({ action: 'review-practical', token: mgr.token, body: { submission_id: sub1, decision: 'approve', feedback: 'ok', rubric_scores: scores(4) } });
  check('feedback is required', r.status === 422);
  r = await A({ action: 'review-practical', token: mgr.token, body: { submission_id: sub1, decision: 'approve', feedback: 'Strong opening but no diagnosis yet.', rubric_scores: scores(2) } });
  check('cannot approve with a criterion below 3', r.status === 422);
  r = await A({ action: 'review-practical', token: mgr.token, body: { submission_id: sub1, decision: 'changes', feedback: 'Ask what happens to missed calls before proposing anything.', rubric_scores: scores(2) } });
  check('changes requested → learner returns to quiz_passed with feedback visible', r.status === 200 && r.body.enrollment_status === 'quiz_passed');
  r = await A({ action: 'program-detail', method: 'GET', token: c1.token, query: { id: p6.id } });
  check('learner sees reviewer feedback and can resubmit', r.body.practicals[0].feedback.includes('missed calls') && r.body.practicals[0].status === 'changes_requested');
  r = await A({ action: 'review-practical', token: mgr.token, body: { submission_id: sub1, decision: 'approve', feedback: 'Second review attempt.', rubric_scores: scores(4) } });
  check('an already-reviewed submission cannot be reviewed again', r.status === 409);
  r = await A({ action: 'submit-practical', token: c1.token, body: { program_id: p6.id, response: 'This time I diagnosed first: asked about missed calls, follow-up speed and booking, and only then proposed a next step. '.repeat(3) } });
  const sub2 = r.body.submission_id;
  r = await A({ action: 'review-practical', token: mgr.token, body: { submission_id: sub2, decision: 'approve', feedback: 'Diagnosis-first and no promises. Approved.', rubric_scores: scores(4) } });
  check('approval → enrollment completed with approver recorded', r.status === 200 && (await env.sql('select status, practical_approved_by from academy_enrollments where id=$1', [enr6])).rows[0].practical_approved_by === mgr.id);
  r = await A({ action: 'issue-certificate', token: c1.token, body: { program_id: p6.id } });
  check('certificate now issues for the practical program', r.status === 200 && r.body.certificate.status === 'valid');

  // ---------------------------------------------------------------- critical-question program
  await doLessons(c1.token, p10.id);
  const crit = (await key(p10.id)).filter((q) => q.critical).map((q) => q.order_index);
  check('program 10 has critical questions', crit.length >= 1);
  r = await A({ action: 'submit-quiz', token: c1.token, body: { program_id: p10.id, answers: await answers(p10.id, { wrong: [crit[0]] }) } });
  const enr10 = r.body.enrollment.id;
  check('missing one critical question fails regardless of score and routes to human review', r.body.critical_failed && !r.body.passed && r.body.enrollment.status === 'awaiting_practical_review' && r.body.enrollment.locked_reason === 'critical_question_review');
  r = await A({ action: 'submit-quiz', token: c1.token, body: { program_id: p10.id, answers: await answers(p10.id) } });
  check('cannot retake while it awaits review', r.status === 409);
  r = await A({ action: 'critical-review', token: mgr.token, body: { enrollment_id: enr10, decision: 'approve', notes: 'Talked it through and they understood.' } });
  check('only the owner can resolve a critical-question review', r.status === 403);
  r = await A({ action: 'critical-review', token: owner.token, body: { enrollment_id: enr10, decision: 'approve', notes: 'x' } });
  check('critical review requires documented notes', r.status === 422);
  r = await A({ action: 'critical-review', token: owner.token, body: { enrollment_id: enr10, decision: 'allow_retake', notes: 'Discussed the ethics rule with the learner; retake allowed.' } });
  check('owner can allow a retake', r.status === 200 && r.body.enrollment.status === 'in_progress');
  r = await A({ action: 'submit-quiz', token: c1.token, body: { program_id: p10.id, answers: await answers(p10.id) } });
  check('perfect retake completes the final program', r.body.passed && r.body.enrollment.status === 'completed');

  // ---------------------------------------------------------------- cross-user & privilege boundaries
  r = await A({ action: 'enroll', token: c2.token, body: { program_id: p1.id, staff_user_id: c1.id } });
  check("a candidate cannot enroll someone else", r.status === 403);
  r = await A({ action: 'my-enrollments', method: 'GET', token: c2.token });
  check("my-enrollments returns only the caller's own rows", r.body.enrollments.every((e) => e.staff_user_id === c2.id) && r.body.certificates.length === 0);
  r = await A({ action: 'save-policy', token: c1.token, body: { pass_threshold_pct: 50 } });
  check('a candidate cannot change the passing policy', r.status === 403);
  r = await A({ action: 'save-policy', token: mgr.token, body: { pass_threshold_pct: 50 } });
  check('a manager cannot change the passing policy', r.status === 403);
  r = await A({ action: 'approve-content', token: mgr.token, body: { program_id: p1.id } });
  check('a manager cannot approve program content', r.status === 403);
  r = await A({ action: 'admin-overview', method: 'GET', token: mgr.token });
  check("manager overview is scoped to their own reps", r.status === 200 && r.body.every((x) => x.staff_user_id === c1.id) && r.body.length > 0);
  r = await A({ action: 'admin-overview', method: 'GET', token: mgr2.token });
  check("the other manager sees only their rep's rows (none started)", r.body.every((x) => x.staff_user_id === c2.id));
  r = await A({ action: 'admin-overview', method: 'GET', token: c1.token });
  check('candidates cannot open the admin overview', r.status === 403);
  const direct = await env.rest(c1.token, 'academy_quiz_questions?select=correct_index');
  check('answer key is NOT readable through PostgREST by an authenticated candidate', direct.status === 401 || direct.status === 403 || (Array.isArray(direct.data) && direct.data.length === 0) || direct.status === 404, `${direct.status}`);
  const directAnon = await env.rest(null, 'academy_quiz_questions?select=correct_index');
  check('...nor anonymously', directAnon.status === 401 || directAnon.status === 403 || (Array.isArray(directAnon.data) && directAnon.data.length === 0) || directAnon.status === 404, `${directAnon.status}`);
  const directSub = await env.rest(c2.token, 'academy_practical_submissions?select=*');
  check("practical submissions are not directly readable by another candidate", directSub.status !== 200 || directSub.data.length === 0);

  // ---------------------------------------------------------------- owner policy approval changes future grading
  r = await A({ action: 'policy', method: 'GET', token: owner.token });
  check('policy endpoint shows the seeded proposal as pending approval', r.body.current.provisional && r.body.versions[0].status === 'pending_approval');
  r = await A({ action: 'save-policy', token: owner.token, body: { pass_threshold_pct: 70, max_attempts: 5, cooldown_hours: 0, change_note: 'Owner decision' } });
  const v2id = r.body.config.id;
  r = await A({ action: 'approve-policy', token: owner.token, body: { config_id: v2id } });
  check('owner approves policy v2', r.status === 200 && (await env.sql("select count(*) from sales_config where key='academy_policy' and status='approved'")).rows[0].count === '1');
  const p2 = await prog('requires_practical=false and critical_compliance=false and id<>$1'.replace('$1', `'${p1.id}'`));
  await doLessons(c2.token, p2.id);
  const some = (await key(p2.id)); const wrong = some.slice(0, Math.floor(some.length * 0.25)).map((q) => q.order_index);
  r = await A({ action: 'submit-quiz', token: c2.token, body: { program_id: p2.id, answers: await answers(p2.id, { wrong }) } });
  check('grading now uses the APPROVED policy (not provisional) and its threshold', r.body.policy_provisional === false && r.body.threshold === 70 && r.body.attempts_left === 4);
  const old = (await env.sql('select policy_snapshot from academy_quiz_attempts where staff_user_id=$1 order by attempted_at limit 1', [c1.id])).rows[0];
  check('earlier attempts keep the snapshot of the policy that graded them', old.policy_snapshot.pass_threshold_pct === 80);
  r = await A({ action: 'approve-content', token: owner.token, body: { program_id: p1.id } });
  check('owner can mark program content approved', r.status === 200 && (await env.sql('select content_review_status from academy_programs where id=$1', [p1.id])).rows[0].content_review_status === 'approved');

  // exercise flow
  const ex = (await env.sql('select id from academy_exercises limit 1')).rows[0];
  if (ex) {
    const exProg = (await env.sql('select program_id from academy_exercises where id=$1', [ex.id])).rows[0].program_id;
    r = await A({ action: 'submit-exercise', token: c2.token, body: { exercise_id: ex.id, response: 'short' } });
    check('exercise: model answer is withheld until a real attempt is submitted', r.status === 422);
    r = await A({ action: 'submit-exercise', token: c2.token, body: { exercise_id: ex.id, response: 'My own attempt: ask about missed calls, follow-up, and booking first.' } });
    check('exercise: self-check + model answer returned after submitting', r.status === 200 && Array.isArray(r.body.self_check));
    void exProg;
  }
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
