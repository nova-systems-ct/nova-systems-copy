// Business desk form rules: what the owner types becomes exactly what the server is asked to save.
import assert from 'node:assert/strict';
import { toCents, dollars, needsOwner, serviceRequest, serviceToForm, waitingLabel } from '../src/lib/businessDesk.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('  ok', name); };

t('dollars typed become whole cents', () => { assert.equal(toCents('120'), 12000); assert.equal(toCents('$1,250.5'), 125050); assert.equal(toCents('0.07'), 7); assert.equal(toCents(' 49.99 '), 4999); });
t('empty amount is "not set", not zero', () => { assert.equal(toCents(''), null); assert.equal(toCents(null), null); });
t('bad amounts are refused, never guessed', () => { for (const v of ['abc', '-5', '12.345', '1e3', '0', '0.00', '12 50']) assert.ok(Number.isNaN(toCents(v)), v); });
t('money display', () => { assert.equal(dollars(125050), '$1,250.50'); assert.equal(dollars(null), 'Not set'); });
t('a service needs a name', () => assert.match(serviceRequest({ name: ' ' }, 'o').error, /name/));
t('approval without a price is dropped', () => { const { body } = serviceRequest({ name: 'Mow', price: '', price_approved: true }, 'o'); assert.equal(body.price_cents, null); assert.equal(body.price_approved, false); });
t('approval without wording is dropped', () => { const { body } = serviceRequest({ name: 'Mow', price: '40', terms_text: '  ', terms_approved: true }, 'o'); assert.equal(body.terms_approved, false); });
t('approved price and wording are sent as approved', () => { const { body } = serviceRequest({ name: 'Mow', price: '40', deposit: '10', price_approved: true, terms_text: 'Pay on the day.', terms_approved: true, return_days: '14', keywords: 'mow, grass ,' }, 'org-1'); assert.deepEqual(body, { organization_id: 'org-1', name: 'Mow', description: '', keywords: ['mow', 'grass'], price_cents: 4000, price_approved: true, deposit_cents: 1000, return_days: 14, terms_text: 'Pay on the day.', terms_approved: true, active: true }); });
t('deposit above price, or with no price, is refused', () => { assert.match(serviceRequest({ name: 'Mow', price: '40', deposit: '50' }, 'o').error, /deposit/i); assert.match(serviceRequest({ name: 'Mow', deposit: '5' }, 'o').error, /price/i); });
t('bad price or come-back days are refused', () => { assert.ok(serviceRequest({ name: 'Mow', price: 'forty' }, 'o').error); assert.ok(serviceRequest({ name: 'Mow', return_days: '2 weeks' }, 'o').error); });
t('editing a saved service round-trips unchanged', () => { const saved = { name: 'Mow', description: 'Front and back', keywords: ['mow'], price_cents: 4050, price_approved: true, deposit_cents: null, return_days: 14, terms_text: 'T', terms_approved: false, active: false }; const { body } = serviceRequest(serviceToForm(saved), 'o'); assert.equal(body.price_cents, 4050); assert.equal(body.price_approved, true); assert.equal(body.deposit_cents, null); assert.equal(body.terms_approved, false); assert.equal(body.active, false); assert.equal(body.return_days, 14); });
t('owner to-do lists what blocks customers, most-blocked first', () => {
  const services = [{ id: 'a', name: 'Mow', price_cents: 4000, price_approved: true, terms_text: 'T', terms_approved: true }, { id: 'b', name: 'Detail', price_cents: null, terms_text: null }, { id: 'c', name: 'Windows', price_cents: 9000, price_approved: false, terms_text: 'T', terms_approved: true }, { id: 'd', name: 'Old', active: false }];
  const journeys = [{ service_id: 'c', waiting_on: 'owner', waiting_reason: 'price_needs_approval' }, { service_id: 'c', waiting_on: 'owner', waiting_reason: 'price_needs_approval' }, { service_id: 'c', waiting_on: 'owner', waiting_reason: 'price_needs_approval', paused: true }, { service_id: 'b', waiting_on: 'owner', waiting_reason: 'price_needs_approval' }];
  const list = needsOwner(services, journeys);
  assert.deepEqual(list.map((x) => [x.service, x.kind, x.waiting, x.what]), [['Windows', 'price', 2, 'Approve the price'], ['Detail', 'price', 1, 'Set a price'], ['Detail', 'terms', 0, 'Add the agreement wording']]);
});
t('a ready service asks nothing of the owner', () => assert.equal(needsOwner([{ id: 'a', name: 'Mow', price_cents: 1, price_approved: true, terms_text: 'T', terms_approved: true }], []).length, 0));
t('plain-language status', () => { assert.match(waitingLabel({ stage: 'quoted', waiting_on: 'owner', waiting_reason: 'price_needs_approval' }), /approve a price/); assert.match(waitingLabel({ stage: 'quoted', paused: true }), /Paused/); assert.equal(waitingLabel({ stage: 'closed', waiting_reason: 'x' }), ''); });
console.log(`business desk: ${n} checks passed`);
