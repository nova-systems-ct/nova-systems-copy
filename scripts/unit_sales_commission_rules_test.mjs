// Pure-logic tests: commission plan validation, calculation, conditions, summaries, batch hash, CSV safety. Proves logic only.
import { normalizePlan, planProblems, computeCommission, netLines, conditionsState, summarize, batchApprovalHash, csvCell } from '../api/_sales/commissionRules.js';
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };

const plan = normalizePlan({ rules: [{ product_slug: '*', type: 'percent', percent_bp: 1000 }, { product_slug: 'lead-capture', type: 'flat', flat_cents: 5000 }], conditions: { holdback_days: 14 } });
check('a plan with no rules is refused (no default rates exist)', planProblems(normalizePlan({})).length === 1 && planProblems(normalizePlan({ rules: [] })).length === 1);
check('a valid plan has no problems and defaults to requiring payment', planProblems(plan).length === 0 && plan.conditions.require_payment_received === true && plan.conditions.holdback_days === 14);
check('invalid percents / flats / duplicate rules are rejected', planProblems(normalizePlan({ rules: [{ type: 'percent', percent_bp: 20000 }] })).length === 1 && planProblems(normalizePlan({ rules: [{ type: 'percent', percent_bp: -1 }] })).length === 1 && planProblems(normalizePlan({ rules: [{ type: 'flat', flat_cents: 1.5 }] })).length === 1 && planProblems(normalizePlan({ rules: [{ type: 'bogus' }] })).length === 1 && planProblems(normalizePlan({ rules: [{ type: 'percent', percent_bp: 100 }, { type: 'percent', percent_bp: 200 }] })).length === 1);
check('hold-back is clamped', normalizePlan({ rules: [], conditions: { holdback_days: 9999 } }).conditions.holdback_days === 365 && normalizePlan({ rules: [], conditions: { holdback_days: -5 } }).conditions.holdback_days === 0);

const lines = [{ slug: 'nova-audit-digital', quantity: 1, unit_price_cents: 50000 }, { slug: 'lead-capture', quantity: 2, unit_price_cents: 20000 }];
let c = computeCommission({ plan, lines, discountCents: 0 });
check('percent rule applies to net line amounts; flat rule is per unit', c.amount_cents === 5000 + 10000 && c.basis_cents === 90000);
c = computeCommission({ plan, lines, discountCents: 9000 });
check('discount is allocated proportionally before percentages are applied (10% of 50000-5000=45000 → 4500) and flat is unchanged', c.detail[0].net === 45000 && c.detail[0].commission === 4500 && c.detail[1].commission === 10000 && c.basis_cents === 81000);
check('discount allocation sums exactly to the discount (no cents lost)', netLines(lines, 3333).reduce((s, l) => s + (l.gross - l.net), 0) === 3333 && netLines(lines, 999999).every((l) => l.net === 0));
check('a product with no rule and no wildcard earns nothing', computeCommission({ plan: normalizePlan({ rules: [{ product_slug: 'lead-capture', type: 'flat', flat_cents: 100 }] }), lines: [{ slug: 'x', quantity: 1, unit_price_cents: 1000 }] }).amount_cents === 0);
check('integer cents throughout', Number.isInteger(computeCommission({ plan: normalizePlan({ rules: [{ type: 'percent', percent_bp: 333 }] }), lines: [{ slug: 'a', quantity: 1, unit_price_cents: 9999 }] }).amount_cents));

const snap = { conditions: { require_payment_received: true, holdback_days: 14 } };
const now = new Date('2026-06-30T00:00:00Z');
check('no payment → waiting for payment', conditionsState({ snapshot: snap, paymentReceivedAt: null, now }).waitingFor[0].includes('payment'));
check('payment received but inside the hold-back → waiting, with the date', (() => { const s = conditionsState({ snapshot: snap, paymentReceivedAt: '2026-06-25T00:00:00Z', now }); return !s.met && /2026-07-09/.test(s.waitingFor[0]); })());
check('payment older than the hold-back → met', conditionsState({ snapshot: snap, paymentReceivedAt: '2026-06-01T00:00:00Z', now }).met);
check('a plan that does not require payment is met immediately with no hold-back', conditionsState({ snapshot: { conditions: { require_payment_received: false, holdback_days: 0 } }, paymentReceivedAt: null, now }).met);

const s = summarize([{ status: 'estimated', amount_cents: 1000 }, { status: 'pending_conditions', amount_cents: 2000 }, { status: 'eligible', amount_cents: 3000 }, { status: 'owner_approved', amount_cents: 400 }, { status: 'paid', amount_cents: 500 }, { status: 'reversed', amount_cents: 99 }]);
check('estimated is reported separately and never folded into pending/eligible/paid', s.estimated_not_earned_cents === 1000 && s.pending_cents === 2000 && s.eligible_cents === 3400 && s.paid_cents === 500);
const items = [{ entry_id: 'b', rep_user_id: 'r1', amount_cents: 200 }, { entry_id: 'a', rep_user_id: 'r2', amount_cents: 100 }];
check('batch approval hash is order-independent and changes with any amount', batchApprovalHash(items) === batchApprovalHash([...items].reverse()) && batchApprovalHash(items) !== batchApprovalHash([items[0], { ...items[1], amount_cents: 101 }]));
check('CSV export neutralises spreadsheet formulas', csvCell('=1+1').startsWith("'") && csvCell('=HYPERLINK("x")').includes("'=HYPERLINK") && csvCell('@cmd') === "'@cmd" && csvCell('a,b') === '"a,b"' && csvCell(5) === '5');
console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
