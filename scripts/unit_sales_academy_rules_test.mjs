// Pure-logic tests for the Academy rules and the PDF writer (no database). Proves logic only.
import { DEFAULT_POLICY, normalizePolicy, resolvePolicy, gradeQuiz, attemptGate, statusAfterQuiz, validatePractical, validateRubricScores, certificateEligibility, holderDisplayName } from '../api/_sales/academyRules.js';
import { textPdf } from '../api/_sales/pdf.js';
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };

const p = normalizePolicy({});
check('default policy is 80/3/0 and provisional when no approved version exists', p.pass_threshold_pct === 80 && p.max_attempts === 3 && resolvePolicy(null, null).provisional === true && resolvePolicy(null, null).status === 'none');
check('an approved version is not provisional and overrides the default', (() => { const r = resolvePolicy({ id: 'x', version: 2, value: { pass_threshold_pct: 70, max_attempts: 5 } }, null); return !r.provisional && r.policy.pass_threshold_pct === 70 && r.policy.max_attempts === 5 && r.version === 2; })());
check('a pending version is used but stays provisional', (() => { const r = resolvePolicy(null, { id: 'y', version: 1, status: 'pending_approval', value: { pass_threshold_pct: 75 } }); return r.provisional && r.policy.pass_threshold_pct === 75; })());
check('policy values are clamped (threshold 10 → 50, attempts 0 → 1)', normalizePolicy({ pass_threshold_pct: 10, max_attempts: 0 }).pass_threshold_pct === 50 && normalizePolicy({ max_attempts: 0 }).max_attempts === 1);

const qs = Array.from({ length: 10 }, (_, i) => ({ order_index: i + 1, correct_index: 1, critical: i === 9, explanation: `why ${i + 1}` }));
const all = (idx) => qs.map((q) => ({ question_order: q.order_index, choice_index: idx }));
let g = gradeQuiz({ questions: qs, answers: all(1), policy: p });
check('all correct → 100 and passed', g.score === 100 && g.passed && g.answeredAll);
const nineOK = all(1); nineOK[0].choice_index = 0; g = gradeQuiz({ questions: qs, answers: nineOK, policy: p });
check('90% passes an 80% threshold and reveals an explanation for the miss only', g.score === 90 && g.passed && g.results[0].explanation === 'why 1' && !g.results[1].explanation);
const crit = all(1); crit[9].choice_index = 0; g = gradeQuiz({ questions: qs, answers: crit, policy: p });
check('a missed critical question fails even at 90%', g.score === 90 && g.criticalFailed && !g.passed);
const seven = all(1); [0, 1, 2].forEach((i) => { seven[i].choice_index = 0; }); g = gradeQuiz({ questions: qs, answers: seven, policy: p });
check('70% fails an 80% threshold but passes when the owner approves 70', !g.passed && gradeQuiz({ questions: qs, answers: seven, policy: { ...p, pass_threshold_pct: 70 } }).passed);
g = gradeQuiz({ questions: qs, answers: all(1).slice(0, 5), policy: p });
check('unanswered questions are flagged, not silently scored', !g.answeredAll && g.results.filter((r) => !r.answered).length === 5);
g = gradeQuiz({ questions: qs, answers: [...all(1), { question_order: 1, choice_index: 0 }], policy: p });
check('a duplicate answer for the same question cannot override the first', g.score === 100);
g = gradeQuiz({ questions: qs, answers: [{ question_order: 1, choice_index: '1abc' }], policy: p });
check('garbage answers score zero', g.score === 0 && !g.passed);
check('results never contain the correct index', !JSON.stringify(gradeQuiz({ questions: qs, answers: all(0), policy: p }).results).includes('correct_index'));
check('an empty question bank never passes', !gradeQuiz({ questions: [], answers: [], policy: p }).passed);
check('explanations can be turned off by policy', !('explanation' in gradeQuiz({ questions: qs, answers: all(0), policy: { ...p, reveal_explanations: false } }).results[0]));

const base = { policy: p, enrollmentStatus: 'in_progress', attempts: [], lessonsCompleted: 5, totalLessons: 5 };
check('lessons must be completed before the quiz', !attemptGate({ ...base, lessonsCompleted: 3 }).allowed && attemptGate({ ...base, lessonsCompleted: 3 }).reason === 'lessons_incomplete');
check('quiz allowed when lessons are done', attemptGate(base).allowed && attemptGate(base).attemptsLeft === 3);
check('attempts exhausted blocks', attemptGate({ ...base, attempts: [{}, {}, {}] }).reason === 'attempts_exhausted');
const now = new Date('2026-01-01T12:00:00Z');
check('cooldown blocks until the time passes', attemptGate({ ...base, policy: { ...p, cooldown_hours: 24 }, attempts: [{ attempted_at: '2026-01-01T00:00:00Z' }], now }).reason === 'cooldown' && attemptGate({ ...base, policy: { ...p, cooldown_hours: 24 }, attempts: [{ attempted_at: '2025-12-30T00:00:00Z' }], now }).allowed);
check('completed / under review / failed states block', ['completed', 'awaiting_practical_review', 'failed'].every((s) => !attemptGate({ ...base, enrollmentStatus: s }).allowed));

const prog = { requires_practical: true }, noPrac = { requires_practical: false };
check('critical miss → human review regardless of attempts', statusAfterQuiz({ program: noPrac, passed: false, criticalFailed: true, attemptsUsed: 1, policy: p, lessonsAllComplete: true }).locked_reason === 'critical_question_review');
check('pass with practical → quiz_passed (NOT completed)', statusAfterQuiz({ program: prog, passed: true, criticalFailed: false, attemptsUsed: 1, policy: p, lessonsAllComplete: true }).status === 'quiz_passed');
check('pass without practical → completed', statusAfterQuiz({ program: noPrac, passed: true, criticalFailed: false, attemptsUsed: 1, policy: p, lessonsAllComplete: true }).status === 'completed');
check('final failed attempt locks the program', statusAfterQuiz({ program: noPrac, passed: false, criticalFailed: false, attemptsUsed: 3, policy: p, lessonsAllComplete: true }).status === 'failed');
check('non-final failure stays in progress', statusAfterQuiz({ program: noPrac, passed: false, criticalFailed: false, attemptsUsed: 1, policy: p, lessonsAllComplete: true }).status === 'in_progress');

check('practical needs real substance', validatePractical('short') !== null && validatePractical('x'.repeat(250)) === null && validatePractical('x'.repeat(13000)) !== null);
const rubric = [{ key: 'a' }, { key: 'b' }];
check('approval requires every criterion scored ≥ 3', validateRubricScores(rubric, { a: 4, b: 2 }, true).error && !validateRubricScores(rubric, { a: 4, b: 3 }, true).error && validateRubricScores(rubric, { a: 4 }, true).error && !validateRubricScores(rubric, { a: 2 }, false).error);
check('a program with no rubric configured cannot be approved (fail closed)', !!validateRubricScores([], {}, true).error && !validateRubricScores([], {}, false).error);
check('rubric scores must be whole numbers 1–5', validateRubricScores(rubric, { a: 6, b: 3 }, true).error && validateRubricScores(rubric, { a: 3.5, b: 3 }, true).error);

const enr = { status: 'completed' };
check('certificate: eligible when everything is complete', certificateEligibility({ enrollment: enr, program: prog, totalLessons: 5, lessonsCompleted: 5, passedAttempt: {}, practicalApproved: true }).eligible);
check('certificate: status alone is not enough (forged/edited status)', !certificateEligibility({ enrollment: enr, program: prog, totalLessons: 5, lessonsCompleted: 2, passedAttempt: null, practicalApproved: false }).eligible);
check('certificate: practical program requires an approved practical', !certificateEligibility({ enrollment: enr, program: prog, totalLessons: 5, lessonsCompleted: 5, passedAttempt: {}, practicalApproved: false }).eligible);
check('certificate: a documented critical approval substitutes for a passing attempt', certificateEligibility({ enrollment: enr, program: noPrac, totalLessons: 5, lessonsCompleted: 5, passedAttempt: null, practicalApproved: false, criticalApproved: true }).eligible);
check('holder display name is minimal', holderDisplayName('Jane Marie Doe') === 'Jane D.' && holderDisplayName('Cher') === 'Cher' && holderDisplayName('') === 'Nova Systems representative');

// PDF structure
const pdf = textPdf({ title: 'T (x)', blocks: [{ style: 'h1', text: 'Title' }, ...Array.from({ length: 120 }, (_, i) => ({ style: 'p', text: `Line ${i} ` + 'word '.repeat(30) }))] });
const s = pdf.toString('latin1');
check('PDF header/trailer present, multiple pages', s.startsWith('%PDF-1.4') && s.trimEnd().endsWith('%%EOF') && /\/Count ([2-9]|\d\d)/.test(s));
const startx = Number(/startxref\n(\d+)/.exec(s)[1]);
check('startxref points at the xref table', s.slice(startx, startx + 4) === 'xref');
const lines = s.slice(startx).split('\n'); const n = Number(lines[1].split(' ')[1]);
let ok = true; for (let i = 1; i < n; i++) { const off = Number(lines[2 + i].slice(0, 10)); if (!s.slice(off).startsWith(`${i} 0 obj`)) ok = false; }
check('every xref offset points at its object', ok);
check('non-latin characters cannot corrupt the file', textPdf({ blocks: [{ style: 'p', text: '日本語 “quotes” — dash (paren) \\ back' }] }).toString('latin1').includes('\\(paren\\)'));
void DEFAULT_POLICY;
console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
