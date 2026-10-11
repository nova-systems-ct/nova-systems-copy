// Pure-logic tests: pipeline transitions/entry rules, prospect duplicate keys, catalog proposal gate. Proves logic only.
import { checkRepMove, prospectKeys, domainOf, phoneDigits, validateProspect, discoveryProblems, qualificationProblems, STAGES } from '../api/_sales/pipelineRules.js';
import { proposalGate, approvedPrice } from '../api/_sales/catalog.js';
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const D = (stage, x = {}) => ({ stage, reopened_count: 0, ...x });
const future = new Date(Date.now() + 86400000).toISOString();
const q = { summary: 'Family plumbing business, owner answers phones himself.', decision_maker: 'yes' };
const disc = { how_customers_reach_them: 'mostly phone calls', what_happens_to_missed_inquiries: 'goes to voicemail', current_follow_up_process: 'none written down', findings: 'They miss evening calls and never call back.' };

check('new → contacted needs a logged outreach attempt', checkRepMove(D('new'), 'contacted', {}, { outreachCount: 0 }).error && checkRepMove(D('new'), 'contacted', {}, { outreachCount: 1 }).ok);
check('contacted → qualified needs a real summary and a decision-maker answer', checkRepMove(D('contacted'), 'qualified', { qualification: { summary: 'short' } }).error && checkRepMove(D('contacted'), 'qualified', { qualification: { summary: q.summary } }).error && checkRepMove(D('contacted'), 'qualified', { qualification: q }).ok);
check('qualified → discovery_scheduled needs a FUTURE time and a named contact', checkRepMove(D('qualified'), 'discovery_scheduled', {}, { contact: { name: 'A' } }).error && checkRepMove(D('qualified'), 'discovery_scheduled', { discovery_at: '2001-01-01' }, { contact: { name: 'A' } }).error && checkRepMove(D('qualified'), 'discovery_scheduled', { discovery_at: future }, {}).error && checkRepMove(D('qualified'), 'discovery_scheduled', { discovery_at: future }, { contact: { name: 'A' } }).ok);
check('discovery_completed needs real discovery answers + findings (diagnosis first)', checkRepMove(D('discovery_scheduled'), 'discovery_completed', { discovery: { findings: 'x' } }).error && checkRepMove(D('discovery_scheduled'), 'discovery_completed', { discovery: disc }).ok && discoveryProblems({}).length === 2);
check('cannot skip stages', checkRepMove(D('new'), 'discovery_completed', {}).error && checkRepMove(D('contacted'), 'discovery_scheduled', {}).error);
check('proposal / awaiting / submitted / won cannot be reached by moving a card', ['proposal', 'awaiting_signature_payment', 'submitted_for_verification', 'won'].every((s) => /own step|cannot move/.test(checkRepMove(D('discovery_completed'), s, {}).error || '')));
check('a rep cannot mark a lead won at all', !!checkRepMove(D('awaiting_signature_payment'), 'won', {}).error && !!checkRepMove(D('submitted_for_verification'), 'won', {}).error);
check('backward moves need a reason', checkRepMove(D('discovery_scheduled'), 'qualified', {}).error && checkRepMove(D('discovery_scheduled'), 'qualified', { reason: 'client rescheduled' }).ok);
check('lost needs a reason code AND a note; unknown codes refused', checkRepMove(D('contacted'), 'lost', {}).error && checkRepMove(D('contacted'), 'lost', { lost_reason_code: 'bogus', reason: 'not going to happen' }).error && checkRepMove(D('contacted'), 'lost', { lost_reason_code: 'no_response', reason: 'no reply after 4 tries' }).ok);
check('a submitted sale cannot be marked lost by the rep', checkRepMove(D('submitted_for_verification'), 'lost', { lost_reason_code: 'no_need', reason: 'long enough reason' }).error);
check('reopen: only to contacted, with a reason, not for do-not-contact, max 3 times', checkRepMove(D('lost'), 'qualified', { reason: 'long enough reason' }).error && checkRepMove(D('lost'), 'contacted', { reason: 'ok' }).error && checkRepMove(D('lost'), 'contacted', { reason: 'they called me back today' }).reopen && checkRepMove(D('lost'), 'contacted', { reason: 'they called me back today' }, { contact: { do_not_contact: true } }).error && checkRepMove(D('lost', { reopened_count: 3 }), 'contacted', { reason: 'they called me back today' }).error);
check('won is final', checkRepMove(D('won'), 'contacted', { reason: 'long enough reason' }).error);
check('same-stage move refused', checkRepMove(D('new'), 'new', {}).error);
check('all ten stages defined', STAGES.length === 10);

check('domain extraction handles urls', domainOf('https://www.Acme-Plumbing.com/about?x=1') === 'acme-plumbing.com' && domainOf('nonsense') === null && domainOf('') === null);
check('phone digits normalise US formats', phoneDigits('(203) 555-0142') === '2035550142' && phoneDigits('+1 203-555-0142') === '2035550142' && phoneDigits('555') === null);
const k1 = prospectKeys({ business_name: 'Acme Plumbing, LLC', website: 'www.acme.com', phone: '203-555-0142', city: 'Waterbury' });
const k2 = prospectKeys({ business_name: 'ACME Plumbing Inc', website: 'https://acme.com', phone: '(203) 555 0142', city: 'waterbury', contact_email: 'joe@gmail.com' });
check('the same prospect written differently yields overlapping keys (domain, phone, name+city)', k1.filter((x) => k2.includes(x)).length === 3);
check('free-mail domains never become identity keys', !prospectKeys({ contact_email: 'a@gmail.com' }).length);
check('different firm with similar name in another city does not collide on name key', !prospectKeys({ business_name: 'Acme Plumbing', city: 'Hartford' }).some((x) => k1.includes(x)));
check('prospect validation', Object.keys(validateProspect({})).length >= 2 && Object.keys(validateProspect({ business_name: 'Acme', contact_name: 'Joe', contact_phone: '2035550142' })).length === 0 && validateProspect({ business_name: 'Acme', contact_name: 'Joe', contact_email: 'j@x.co', website: '???' }).website);
check('qualification helper', qualificationProblems({}).length === 2);

check('proposal gate: only Available for Sale, or pilot with owner-approved terms', proposalGate({ sales_readiness: 'available_for_sale' }).allowed && !proposalGate({ sales_readiness: 'draft' }).allowed && !proposalGate({ sales_readiness: 'internal_test' }).allowed && !proposalGate({ sales_readiness: 'paused' }).allowed && !proposalGate({ sales_readiness: 'pilot_approved' }).allowed && proposalGate({ sales_readiness: 'pilot_approved', pilot_terms: 'Two locations, 30 days' }).label.startsWith('PILOT'));
check('a price exists only when approved AND numeric', approvedPrice({ pricing_approved: true, pricing_config: { unit_price_cents: 50000 } }).unit_price_cents === 50000 && !approvedPrice({ pricing_approved: false, pricing_config: { unit_price_cents: 50000 } }) && !approvedPrice({ pricing_approved: true, pricing_config: {} }));
console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
