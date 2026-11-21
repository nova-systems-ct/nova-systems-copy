// The Audit "Customer tests" screen (system 22): the helpers in src/lib/auditTests.js, checked
// against the server's own rules in api/_auditTests.js. No database or network is contacted.
import { customerTestToEvidence, leakEstimate, CUSTOMER_TESTS } from '../api/_auditTests.js';
import { TESTS, testsFrom, printableAudit, esc } from '../src/lib/auditTests.js';

let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
const NOW = new Date('2026-11-23T23:00:00Z');

check('the screen offers exactly the tests the server accepts, with the same units', TESTS.length === Object.keys(CUSTOMER_TESTS).length && TESTS.every(([k, label, unit]) => CUSTOMER_TESTS[k] && CUSTOMER_TESTS[k].label === label && CUSTOMER_TESTS[k].unit === unit));

// Three tests as the screen sends them: two unanswered, one answered after 40 seconds.
const sent = [
  { kind: 'phone_open_hours', performed_at: '2026-11-23T17:00:00Z', performed_by: 'Isaac', target: '(203) 878-3113', responded: false, response_time: null, notes: 'Voicemail full' },
  { kind: 'phone_after_hours', performed_at: '2026-11-23T23:00:00Z', performed_by: 'Isaac', target: '(203) 878-3113', responded: false, response_time: null },
  { kind: 'text_message', performed_at: '2026-11-23T17:05:00Z', performed_by: 'Isaac', target: '(203) 878-3113', responded: true, response_time: 2 },
];
const evidence = sent.map((t, i) => ({ id: `e${i}`, method: `customer_style_test:${t.kind}`, capture_date: t.performed_at, ...customerTestToEvidence(t, NOW).record }));
evidence.push({ id: 'x', method: 'public_page_review', capture_date: NOW.toISOString(), observation: 'Website has a contact form.' });
const tests = testsFrom(evidence);
check('only customer-style tests are listed, not other evidence', tests.length === 3 && !tests.some((t) => t.id === 'x'));
check('answered and unanswered are read from the server\'s own wording', tests.filter((t) => !t.answered).length === 2 && tests.find((t) => t.kind === 'text_message').answered === true);

const est = leakEstimate({ inquiriesPerWeek: 20, avgJobCents: 20000, closeRatePct: 40, testsRun: tests.length, testsUnanswered: tests.filter((t) => !t.answered).length });
check('the server gives a range from the tests and the owner\'s three numbers', est.estimate_low > 0 && est.estimate_high > est.estimate_low && /2 of 3 customer-style tests/.test(est.estimate_assumptions));
const html = printableAudit({ business: 'True Blue <Personal> Touch & Co', tests, estimate: est });
check('the printout names the business safely (no HTML can be injected)', html.includes('True Blue &lt;Personal&gt; Touch &amp; Co') && !html.includes('<Personal>'));
check('the printout shows each test and the plain count', (html.match(/<tr><td>/g) || []).length === 3 && html.includes('2 of 3 tries got no answer.'));
check('the printout shows the range and its assumptions, and says it is an estimate, not a promise', html.includes(`$${est.estimate_low.toLocaleString('en-US')} to $${est.estimate_high.toLocaleString('en-US')} a month`) && html.includes('not a promise'));
check('without an estimate, the printout leaves the money section out', !printableAudit({ business: 'B', tests, estimate: null }).includes('may be worth'));
check('fewer than three tests: the server refuses to put a dollar figure on it', !!leakEstimate({ inquiriesPerWeek: 20, avgJobCents: 20000, closeRatePct: 40, testsRun: 2, testsUnanswered: 1 }).refused);
check('escaping handles quotes and ampersands', esc('"A" & B') === '&quot;A&quot; &amp; B');

console.log(`\n${pass}/${pass + fail} audit screen checks passed (pure helpers and the server's own rules — no database or network)`);
process.exit(fail ? 1 : 0);
