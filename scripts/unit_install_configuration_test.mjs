import assert from 'node:assert/strict';
import { buildManifest } from '../api/_ops/install.js';
import { paymentReadiness } from '../api/_ops/paymentReadiness.js';

process.env.SUPABASE_URL = 'https://install-config.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-test-only';
const data = {
  organizations: [{ id: 'o', name: 'Nova Systems' }],
  ops_business_settings: [{ organization_id: 'o', display_name: 'Nova Systems', lead_time_hours: 2, scoreboard_enabled: false }],
  wave1_org_settings: [{ organization_id: 'o', timezone: 'America/New_York', business_hours: { mon: [{ start: '09:00', end: '17:00' }] }, escalation_contacts: [{ name: 'Owner', email: 'owner@example.test' }] }],
  ops_price_rules: [{ id: 'price', organization_id: 'o', status: 'approved', service_key: 'consultation', name: 'Consultation', version: 1, price_cents: 10000, deposit_cents: 0, duration_minutes: 60 }],
  ops_agreement_templates: [{ id: 'agreement', organization_id: 'o', status: 'approved', template_key: 'service_agreement', version: 1, body: 'Approved terms' }],
  ops_payment_accounts: [{ organization_id: 'o', mode: 'not_configured', live_enabled: false }],
  voice_configurations: [],
  ops_installed_modules: [{ organization_id: 'o', module_key: 'agents_booking', status: 'selected', config: {} }],
};
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  assert.equal(u.host, 'install-config.test', 'This test must never reach a real service');
  assert.equal(init.method || 'GET', 'GET', 'Previewing a plan must be read-only');
  let rows = data[u.pathname.slice('/rest/v1/'.length)] || [];
  for (const [key, value] of u.searchParams) {
    if (['select', 'order', 'limit'].includes(key)) continue;
    if (value.startsWith('eq.')) rows = rows.filter(row => String(row[key]) === value.slice(3));
    else if (value.startsWith('neq.')) rows = rows.filter(row => String(row[key]) !== value.slice(4));
    else if (value === 'is.null') rows = rows.filter(row => row[key] == null);
    else throw Error(`Unexpected filter ${key}=${value}`);
  }
  return Response.json(rows);
};

const fingerprint = async () => (await buildManifest('o')).sha;
let passed = 0;
async function changed(label, table, patch) {
  const before = await fingerprint();
  const old = structuredClone(data[table][0]);
  Object.assign(data[table][0], patch);
  assert.notEqual(await fingerprint(), before, label);
  data[table][0] = old;
  passed++;
}
await changed('A price change with the same service count must invalidate acceptance', 'ops_price_rules', { price_cents: 20000 });
await changed('Changed business hours need a new plan', 'wave1_org_settings', { business_hours: { mon: [{ start: '11:00', end: '15:00' }] } });
await changed('Changed agreement text needs a new plan', 'ops_agreement_templates', { body: 'Different approved terms' });
await changed('A new price version must be tested again', 'ops_price_rules', { id: 'new-price', version: 2 });
await changed('Calendar lead time changes invalidate availability acceptance', 'ops_business_settings', { lead_time_hours: 48 });
await changed('Removing the escalation contact invalidates acceptance', 'wave1_org_settings', { escalation_contacts: [] });
await changed('Changing a payment destination invalidates acceptance', 'ops_payment_accounts', { mode: 'client_connected_account', stripe_account_ref: 'acct_TestDestination' });
await changed('Disabling a selected module changes the plan', 'ops_installed_modules', { status: 'disabled' });
const stable = await fingerprint();
Object.assign(data.ops_business_settings[0], { updated_at: new Date().toISOString(), scoreboard_enabled: true, go_live_approved_at: new Date().toISOString() });
Object.assign(data.wave1_org_settings[0], { updated_at: new Date().toISOString(), form_token: 'issued-on-first-install' });
data.ops_installed_modules[0].status = 'installed';
assert.equal(await fingerprint(), stable, 'Installation bookkeeping, form issuance and worker registration must not cause endless new plan versions');
const hours = data.wave1_org_settings[0];
hours.escalation_contacts = [{ email: 'owner@example.test', name: 'Owner' }];
assert.equal(await fingerprint(), stable, 'JSON key order must not change a plan');
const testEnv = { STRIPE_SECRET_KEY: 'sk_test_local', STRIPE_WEBHOOK_SECRET: 'whsec_local' };
const testAccount = { mode: 'nova_test_platform' };
assert.equal(paymentReadiness(null, { env: testEnv }).status, 'blocked');
assert.equal(paymentReadiness(testAccount, { isTest: false, env: testEnv }).test_ready, false, 'Nova platform tests cannot become customer deposit accounts');
assert.deepEqual(paymentReadiness(testAccount, { isTest: true, env: testEnv }).status, 'partial', 'A test result must never be labelled live-ready');
assert.equal(paymentReadiness(testAccount, { isTest: true, env: testEnv }).test_ready, true);
assert.equal(paymentReadiness(testAccount, { isTest: true, env: { ...testEnv, STRIPE_SECRET_KEY: 'sk_live_NOT_A_REAL_KEY' } }).test_ready, false);
assert.equal(paymentReadiness(testAccount, { isTest: true, env: { STRIPE_SECRET_KEY: 'sk_test_local' } }).test_ready, false, 'Payment confirmation webhook is required');
assert.equal(paymentReadiness(testAccount, { isTest: true, env: { ...testEnv, OPS_KILL_SWITCH: 'true' } }).test_ready, false);
console.log(`${passed + 9} passed — installation configuration and payment readiness (read-only, no network services)`);
