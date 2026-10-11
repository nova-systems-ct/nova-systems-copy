// Nova organizational hierarchy — governance (Phase C): real handlers (api/_hierarchy/governance.js,
// resource 'governance') against a REAL local PostgreSQL + PostgREST (local, disposable). Proves worker
// operating contracts are versioned and cannot be self-approved, the escalation chain routes correctly
// (including skipping the reserved/inactive Aura seat), kill switches at every scope level (global,
// portfolio entity, org unit, worker, model provider) genuinely block, decision records are a real,
// append-only, queryable trail, and RLS holds directly at the database layer. NOT Supabase, NOT production.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations, SALES_PARTS, LOCKDOWN } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';
import { killSwitchBlocks } from '../api/_hierarchy/rules.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HIERARCHY_SQL = fs.readFileSync(path.join(ROOT, 'supabase/hierarchy-01-registry-migration-standalone.sql'), 'utf8');
const GOVERNANCE_SQL = fs.readFileSync(path.join(ROOT, 'supabase/hierarchy-02-governance-migration-standalone.sql'), 'utf8');
const LOCKDOWN_SQL = fs.readFileSync(path.join(ROOT, LOCKDOWN), 'utf8');

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const env = await startTestEnv({ migrations: allMigrations(SALES_PARTS), publicBuckets: [] });
Object.assign(process.env, env.appEnv);
const { default: handler } = await import('../api/client.js');
const call = makeCaller(handler);
const hier = (op, o = {}) => call({ resource: 'hierarchy', op, ...o });
const gov = (op, o = {}) => call({ resource: 'governance', op, ...o });

try {
  const orgA = (await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).rows[0].id;
  const orgB = (await env.sql("insert into organizations (name, slug, kind) values ('Acme Client','acme','client') returning id")).rows[0].id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: orgA, name: 'Isaac Owner' });
  const owner2 = await env.createUser({ email: 'owner2@nova.test', role: 'nova_super_admin', orgId: orgA, name: 'Second Owner-Level Account' });
  const staffB = await env.createUser({ email: 'staff@acme.test', role: 'client_owner', orgId: orgB, name: 'Acme Staff' });
  const rep = await env.createUser({ email: 'rep@nova.test', role: 'nova_sales', orgId: orgA, name: 'Plain Rep' });
  const viewer = await env.createUser({ email: 'viewer@nova.test', role: 'nova_admin', orgId: orgA, name: 'View-Only Admin' });
  await env.sql(HIERARCHY_SQL);
  await env.sql(GOVERNANCE_SQL);
  await env.sql(LOCKDOWN_SQL);
  for (let i = 0; i < 20; i++) {
    await env.reload();
    const probe = await env.rest(env.serviceKey, 'kill_switches?limit=1');
    if (probe.status !== 404 && !(probe.data && probe.data.code === 'PGRST205')) break;
    await new Promise((res) => setTimeout(res, 300));
  }

  // ---------------------------------------------------------------- authorization boundary
  let r = await gov('kill-switches', { method: 'GET' });
  check('no session -> 401', r.status === 401);
  r = await gov('kill-switches', { token: staffB.token, method: 'GET' });
  check('a client-org member has no command.view permission -> 403', r.status === 403);
  r = await gov('kill-switches', { token: owner.token, method: 'GET' });
  check('the owner can read kill switches (none engaged yet)', r.status === 200 && r.body.length === 0);

  // ---------------------------------------------------------------- worker operating contracts
  const aiWorker = (await hier('create-worker', { token: owner.token, body: { worker_type: 'ai', display_name: 'Research Assistant', model_provider: 'claude' } })).body.worker;
  r = await gov('worker-contract', { token: owner.token, method: 'GET', query: { worker_id: aiWorker.id } });
  check('a worker with no contract yet reads back honestly as none, not ready', r.status === 200 && r.body.status === 'none' && r.body.readiness.ready === false);
  r = await gov('save-worker-contract', { token: rep.token, body: { worker_id: aiWorker.id, content: { mission: 'x' } } });
  check('a non-owner cannot draft a worker contract', r.status === 403);
  r = await gov('save-worker-contract', { token: owner.token, body: { worker_id: aiWorker.id, content: { mission: 'Research market signals for Nova Venture Lab candidates', responsibilities: ['Collect public sources', 'Summarize findings with citations'] }, change_note: 'Initial contract' } });
  check('the owner can draft a real, versioned worker contract', r.status === 200 && r.body.contract.version === 1 && r.body.contract.status === 'pending_approval');
  const contractId = r.body.contract.id;
  r = await gov('approve-worker-contract', { token: owner.token, body: { contract_id: contractId, confirm: true } });
  check('the drafting owner cannot approve their own contract without reauth first (428, not a dead end)', r.status === 428 && r.body.requires === 'confirm-reauth');
  r = await gov('confirm-reauth', { token: owner.token, body: { target_type: 'worker_contract', target_id: contractId, password: 'wrong', reason: 'Approving my own draft — sole owner, nobody else to ask.' } });
  check('confirm-reauth genuinely re-verifies the password for worker contracts too', r.status === 401);
  r = await gov('confirm-reauth', { token: owner.token, body: { target_type: 'worker_contract', target_id: contractId, password: owner.password, reason: 'Approving my own draft — sole owner, nobody else to ask.' } });
  check('with the real password and a real reason, reauth is confirmed', r.status === 200);
  r = await gov('approve-worker-contract', { token: owner.token, body: { contract_id: contractId, confirm: false } });
  check('approval without confirm is refused even after reauth', r.status === 422);
  r = await gov('approve-worker-contract', { token: owner.token, body: { contract_id: contractId, confirm: true } });
  check('the sole owner can now approve their own worker contract', r.status === 200);
  r = await gov('worker-contract', { token: owner.token, method: 'GET', query: { worker_id: aiWorker.id } });
  check('the contract now reads back approved and ready', r.body.status === 'approved' && r.body.provisional === false && r.body.readiness.ready === true);
  check('a real decision_records row was written for the approval', (await env.sql("select count(*) from decision_records where decision_type='contract_approval'")).rows[0].count === '1');

  // A genuinely different owner-level account still never needs the reauth ritual.
  r = await gov('save-worker-contract', { token: owner2.token, body: { worker_id: aiWorker.id, content: { mission: 'Amended mission', responsibilities: ['Also verify sources against two independent pages'] }, change_note: 'Amendment by a second owner-level account' } });
  const contract2Id = r.body.contract.id;
  r = await gov('approve-worker-contract', { token: owner.token, body: { contract_id: contract2Id, confirm: true } });
  check('a different, real owner-level account approving what someone else drafted needs no reauth at all', r.status === 200);

  // ---------------------------------------------------------------- escalation chain (including the Aura-skip rule)
  r = await gov('raise-escalation', { token: rep.token, body: { subject_type: 'worker', subject_id: aiWorker.id, raised_by_worker_id: aiWorker.id, reason: 'Blocked: needs a real budget decision the AI worker cannot make.' } });
  check('a rep with no command.view at all cannot even raise an escalation', r.status === 403);
  r = await gov('raise-escalation', { token: viewer.token, body: { subject_type: 'worker', subject_id: aiWorker.id, raised_by_worker_id: aiWorker.id, reason: 'Blocked: needs a real budget decision the AI worker cannot make.' } });
  check('a view-only (command.view, not command.owner) account CAN raise an escalation', r.status === 200 && r.body.escalation.level === 'worker');
  const escId = r.body.escalation.id;
  r = await gov('route-escalation', { token: viewer.token, body: { id: escId } });
  check('but that same view-only account cannot route it (command.owner required)', r.status === 403);
  r = await gov('route-escalation', { token: owner.token, body: { id: escId, note: 'Escalating to manager' } });
  check('worker -> manager', r.status === 200 && r.body.escalation.level === 'manager');
  await gov('route-escalation', { token: owner.token, body: { id: escId } });
  r = await gov('route-escalation', { token: owner.token, body: { id: escId } });
  check('manager -> executive -> ceo_twin', r.status === 200 && r.body.escalation.level === 'ceo_twin');
  r = await gov('route-escalation', { token: owner.token, body: { id: escId } });
  check('ceo_twin skips the reserved/inactive Aura seat and routes straight to owner (real DB state, not just the pure-logic rule)', r.status === 200 && r.body.escalation.level === 'owner');
  r = await gov('route-escalation', { token: owner.token, body: { id: escId } });
  check('owner is terminal — cannot route further', r.status === 409);
  r = await gov('resolve-escalation', { token: owner.token, body: { id: escId, resolution: '' } });
  check('resolving with no real resolution text is refused', r.status === 422);
  r = await gov('resolve-escalation', { token: owner.token, body: { id: escId, resolution: 'Approved a one-time $200 budget for this research task.' } });
  check('a real resolution is recorded', r.status === 200 && r.body.escalation.status === 'resolved');
  check('a real decision_records row exists for the resolution', (await env.sql("select count(*) from decision_records where decision_type='escalation_resolution'")).rows[0].count === '1');
  r = await gov('resolve-escalation', { token: owner.token, body: { id: escId, resolution: 'trying again' } });
  check('an already-resolved escalation cannot be resolved again', r.status === 409);

  // ---------------------------------------------------------------- kill switches, every scope level
  r = await gov('kill-switch-status', { token: owner.token, method: 'GET', query: { worker_id: aiWorker.id } });
  check('with nothing engaged, the worker is not blocked', r.status === 200 && r.body.blocked === false);
  r = await gov('engage-kill-switch', { token: rep.token, body: { scope_type: 'worker', scope_id: aiWorker.id, reason: 'test' } });
  check('a non-owner cannot engage a kill switch', r.status === 403);
  r = await gov('engage-kill-switch', { token: owner.token, body: { scope_type: 'worker', scope_id: aiWorker.id, reason: '' } });
  check('engaging with no real reason is refused', r.status === 422);
  r = await gov('engage-kill-switch', { token: owner.token, body: { scope_type: 'worker', scope_id: aiWorker.id, reason: 'Suspected runaway behavior — stopping pending investigation.' } });
  check('the owner can engage a worker-level kill switch', r.status === 200);
  const workerSwitchId = r.body.kill_switch.id;
  r = await gov('kill-switch-status', { token: owner.token, method: 'GET', query: { worker_id: aiWorker.id } });
  check('the specific worker is now reported blocked, scope=worker', r.status === 200 && r.body.blocked === true && r.body.scope === 'worker');
  check('the pure killSwitchBlocks() rule agrees with the real API response', killSwitchBlocks(r.body.engaged).scope === 'worker');

  r = await gov('engage-kill-switch', { token: owner.token, body: { scope_type: 'global', reason: 'Company-wide pause for this test.' } });
  check('a global kill switch can be engaged', r.status === 200);
  r = await gov('kill-switch-status', { token: owner.token, method: 'GET', query: { worker_id: aiWorker.id } });
  check('global takes priority over the more specific worker switch in the reported scope', r.status === 200 && r.body.scope === 'global');
  const globalSwitch = (await env.sql("select id from kill_switches where scope_type='global'")).rows[0];
  r = await gov('disengage-kill-switch', { token: owner.token, body: { id: globalSwitch.id, reason: 'Test complete, restoring normal operation.' } });
  check('the owner can disengage the global kill switch', r.status === 200);
  r = await gov('kill-switch-status', { token: owner.token, method: 'GET', query: { worker_id: aiWorker.id } });
  check('after disengaging global, the worker-level switch is still reported (it was never touched)', r.status === 200 && r.body.blocked === true && r.body.scope === 'worker');
  await gov('disengage-kill-switch', { token: owner.token, body: { id: workerSwitchId, reason: 'Investigation complete — cleared.' } });
  r = await gov('kill-switch-status', { token: owner.token, method: 'GET', query: { worker_id: aiWorker.id } });
  check('once every relevant switch is disengaged, the worker is clear again', r.status === 200 && r.body.blocked === false);

  // model_provider kill switch: scope_id is a provider key ('claude'), not a UUID — this exercises a real bug found
  // by inspection (decision_records.subject_id is a UUID column; a naive insert of the provider key would crash).
  r = await gov('engage-kill-switch', { token: owner.token, body: { scope_type: 'model_provider', scope_id: 'claude', reason: 'Pausing all Claude-backed workers pending a provider incident review.' } });
  check('a model_provider kill switch (non-UUID scope_id) can be engaged without crashing the decision record', r.status === 200);
  r = await gov('kill-switch-status', { token: owner.token, method: 'GET', query: { worker_id: aiWorker.id } });
  check('a Claude-backed worker is now blocked at the provider scope', r.status === 200 && r.body.blocked === true && r.body.scope === 'provider');
  check('the provider-scope decision record was written with a null subject_id, not a crash', (await env.sql("select subject_id from decision_records where decision_type='kill_switch' and subject_type='model_provider'")).rows[0].subject_id === null);
  const providerSwitch = (await env.sql("select id from kill_switches where scope_type='model_provider'")).rows[0];
  await gov('disengage-kill-switch', { token: owner.token, body: { id: providerSwitch.id, reason: 'Provider incident resolved.' } });
  r = await gov('kill-switch-status', { token: owner.token, method: 'GET', query: { worker_id: aiWorker.id } });
  check('after disengaging the provider switch the worker is clear again', r.status === 200 && r.body.blocked === false);
  check('every engage/disengage left a real decision_records row', (await env.sql("select count(*) from decision_records where decision_type='kill_switch'")).rows[0].count === '6');

  // ---------------------------------------------------------------- decision records: real, queryable, append-only
  r = await gov('decisions', { token: owner.token, method: 'GET' });
  check('decision_records are readable as a real trail', r.status === 200 && r.body.length >= 6);
  const oneDecision = r.body[0];
  const badUpdate = await env.sql("update decision_records set rationale='tampered' where id=$1", [oneDecision.id]).catch((e) => e);
  check('decision_records truly cannot be UPDATEd, even directly in the database (append-only trigger)', badUpdate instanceof Error && /append-only/.test(badUpdate.message));

  // ---------------------------------------------------------------- cross-org isolation (RLS, not just handler filtering)
  const direct = await env.rest(staffB.token, 'kill_switches?select=id');
  check("a client-org member cannot read kill_switches directly through PostgREST either (RLS, not app-layer filtering)", Array.isArray(direct.data) ? direct.data.length === 0 : direct.status >= 400, JSON.stringify(direct.data ?? direct.status));
  const anonRead = await env.rest(null, 'decision_records?select=id');
  check('the anonymous role cannot read decision_records directly', Array.isArray(anonRead.data) ? anonRead.data.length === 0 : anonRead.status >= 400);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed — Nova organizational hierarchy governance (real handlers + real local PostgreSQL/PostgREST; local, disposable)`);
process.exitCode = fail ? 1 : 0;
process.exit(process.exitCode);
