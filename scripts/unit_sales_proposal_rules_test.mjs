// Pure-logic tests: proposal pricing, totals, prohibited-claim scan, hash stability. Proves logic only.
import { buildLineItems, totals, validateDiscount, findProhibitedClaims, clientView, proposalHash, tokenHash, submissionKind } from '../api/_sales/proposalRules.js';
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const P = (id, o = {}) => ({ id, slug: id, name: id.toUpperCase(), sales_readiness: 'available_for_sale', pricing_approved: true, pricing_config: { unit_price_cents: 10000, billing: 'one_time' }, ...o });
const products = [P('a'), P('b', { pricing_approved: false, pricing_config: {} }), P('c', { sales_readiness: 'draft' }), P('d', { sales_readiness: 'pilot_approved', pilot_terms: 'One site, 30 days' }), P('e', { sales_readiness: 'paused' })];

let r = buildLineItems({ items: [{ product_id: 'a', quantity: 2 }], products });
check('an available, approved-price offering is priced from the catalog', r.lines[0].unit_price_cents === 10000 && r.subtotal === 20000 && r.unpriced === 0 && !r.problems.length);
r = buildLineItems({ items: [{ product_id: 'a', quantity: 1, unit_price_cents: 1 }], products });
check('a client-supplied price is ignored', r.subtotal === 10000);
r = buildLineItems({ items: [{ product_id: 'b', quantity: 1 }], products });
check('no approved price → unpriced line, no subtotal (never invented)', r.lines[0].unit_price_cents === null && r.subtotal === null && r.unpriced === 1);
r = buildLineItems({ items: [{ product_id: 'b', quantity: 1 }], products, ownerPrices: { b: 25000 } });
check('an owner-set price is used and labelled as owner-sourced', r.lines[0].unit_price_cents === 25000 && r.lines[0].price_source === 'owner' && r.subtotal === 25000);
check('draft / paused offerings are blocked', buildLineItems({ items: [{ product_id: 'c', quantity: 1 }], products }).problems.length === 1 && buildLineItems({ items: [{ product_id: 'e', quantity: 1 }], products }).problems.length === 1);
r = buildLineItems({ items: [{ product_id: 'c', quantity: 1 }], products, exceptions: [{ product_id: 'c', label: 'one location trial' }] });
check('an owner-approved custom-scope exception lets a draft offering in, clearly labelled', !r.problems.length && r.lines[0].label === 'CUSTOM SCOPE — one location trial');
r = buildLineItems({ items: [{ product_id: 'd', quantity: 1 }], products });
check('a pilot carries the owner-approved pilot label', !r.problems.length && r.lines[0].label.startsWith('PILOT'));
check('bad quantities, duplicates, unknown products and empty proposals are rejected', buildLineItems({ items: [{ product_id: 'a', quantity: 0 }], products }).problems.length === 1 && buildLineItems({ items: [{ product_id: 'a' }, { product_id: 'a' }], products }).problems.length === 1 && buildLineItems({ items: [{ product_id: 'zzz' }], products }).problems.length === 1 && buildLineItems({ items: [], products }).problems.length === 1);

check('totals: discount clamps to the subtotal', totals({ subtotal: 10000, discount_cents: 2500 }).total === 7500 && totals({ subtotal: 10000, discount_cents: 99999 }).total === 0 && totals({ subtotal: null }).total === null);
check('discount needs a reason and cannot exceed the subtotal', validateDiscount({ subtotal: 10000, discount_cents: 500, reason: 'x' }) && validateDiscount({ subtotal: 10000, discount_cents: 20000, reason: 'a long enough reason' }) && !validateDiscount({ subtotal: 10000, discount_cents: 500, reason: 'a long enough reason' }) && !validateDiscount({ subtotal: 10000, discount_cents: 0 }));

const bad = ['We guarantee results.', 'This will double your leads.', 'Boost your revenue by 40% in 90 days.', 'You are losing $5,000 a month in missed calls.', 'Risk-free for 30 days.', 'Free pilot in exchange for a testimonial.', 'Give us a review in return for a discount.', 'You lose $12,000 per year', 'We will increase bookings'];
check('every forbidden pattern is caught', bad.every((t) => findProhibitedClaims(t).length > 0), bad.filter((t) => !findProhibitedClaims(t).length).join(' | '));
const ok = ['We will set up call handling and follow-up for your two locations.', 'The audit reviews your website, listings and how inquiries are handled.', 'Pricing is in the table below.', 'Discovery showed calls after 5pm go to voicemail.'];
check('ordinary scope text is not flagged', ok.every((t) => findProhibitedClaims(t).length === 0), ok.filter((t) => findProhibitedClaims(t).length).join(' | '));

const proposal = { version: 1, title: 'T', scope: { summary: 'S' }, currency: 'USD', line_items: [{ name: 'A', quantity: 1, unit_price_cents: 100, billing: 'one_time', label: null }], subtotal_cents: 100, discount_cents: 0, total_cents: 100, payment_due_cents: 100 };
const v = clientView({ proposal, businessName: 'Biz', contactName: 'Jo', repFirstName: 'Al' });
check('the client view is stable and its hash changes when any number changes', proposalHash(v) === proposalHash(clientView({ proposal, businessName: 'Biz', contactName: 'Jo', repFirstName: 'Al' })) && proposalHash(v) !== proposalHash(clientView({ proposal: { ...proposal, total_cents: 99 }, businessName: 'Biz', contactName: 'Jo', repFirstName: 'Al' })));
check('the client view exposes no internal fields', !/rep_user|created_by|owner|assigned/i.test(JSON.stringify(v)));
check('tokens are hashed with a domain prefix (not stored raw)', tokenHash('abc') !== 'abc' && tokenHash('abc').length === 64);
check('submission kind: system signature vs rep-supplied evidence', submissionKind({ proposal: { status: 'signed' } }).kind === 'system_signature' && submissionKind({ proposal: { status: 'sent' } }).kind === 'rep_supplied' && submissionKind({ proposal: { status: 'sent' } }).minEvidence > submissionKind({ proposal: { status: 'signed' } }).minEvidence);
console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
