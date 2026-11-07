import assert from 'node:assert/strict';
import { provisionModule } from '../api/_ops/modules.js';
process.env.SUPABASE_URL = 'https://dependency.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-only';
let dependency = null;
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  assert.equal(u.host, 'dependency.test'); assert.equal(init.method || 'GET', 'GET');
  assert.equal(u.pathname, '/rest/v1/ops_installed_modules');
  assert.equal(u.searchParams.get('organization_id'), 'eq.business');
  assert.equal(u.searchParams.get('module_key'), 'eq.agents_booking');
  return Response.json(dependency ? [{ status: dependency }] : []);
};
for (const status of ['blocked', 'failed']) {
  dependency = status;
  const [step] = await provisionModule('business', 'followup_revive', { actor: { id: 'owner' } });
  assert.equal(step.status, 'blocked');
  assert.match(step.owner_action, /finish|fix|retry/i, 'A chosen dependency must point to its unfinished work');
  assert.doesNotMatch(step.owner_action, /select.*as well/i, 'Do not ask the owner to choose a module that is already chosen');
}
dependency = 'disabled';
assert.match((await provisionModule('business', 'followup_revive', {}))[0].owner_action, /turn.*on/i);
dependency = null;
assert.match((await provisionModule('business', 'followup_revive', {}))[0].owner_action, /select|choose/i);
console.log('4 passed — module dependency actions identify missing, disabled and unfinished setup correctly');
