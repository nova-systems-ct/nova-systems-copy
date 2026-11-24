// Install files (installs/*.json) and the installer (api/_install.js): Crystal Clear and Flare are
// set up exactly as approved, nothing is switched on, and a second run changes nothing. In-memory
// store; no database is contacted.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { checkInstallFile, planInstall, applyInstall, describeStep } from '../api/_install.js';
import { applyPack } from '../api/_industryPacks.js';
import { converse } from '../api/_conversation.js';

const CC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', FL = 'ffffffff-ffff-4fff-8fff-ffffffffffff', NOVA = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const NOW = new Date('2026-11-22T15:00:00Z');
const UNIQUE = { journeys: ['organization_id', 'source_channel', 'source_event_id'], journey_events: ['idempotency_key'], journey_documents: ['journey_id', 'kind', 'seq'] };
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
function memoryDb() {
  const t = {}; const rows = (n) => (t[n] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : r[k] === v));
  return { t,
    select: async (n, f = {}, { order = 'created_at.asc', limit = 500 } = {}) => { const [col, dir] = order.split('.'); return rows(n).filter((r) => hit(r, f)).sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : a._n - b._n) * (dir === 'desc' ? -1 : 1)).slice(0, limit).map((r) => ({ ...r })); },
    insert: async (n, row) => { const u = UNIQUE[n]; if (u && rows(n).some((r) => u.every((k) => r[k] === row[k]))) throw Object.assign(new Error('conflict'), { status: 409 }); const full = { id: crypto.randomUUID(), created_at: new Date(NOW.getTime() + rows(n).length).toISOString(), _n: rows(n).length, ...row }; rows(n).push(full); return { ...full }; },
    update: async (n, f, patch) => rows(n).filter((r) => hit(r, f)).map((r) => ({ ...Object.assign(r, patch) })) };
}
const ccFile = JSON.parse(fs.readFileSync('installs/crystal-clear.json', 'utf8'));
const flFile = JSON.parse(fs.readFileSync('installs/flare.json', 'utf8'));

check('the Crystal Clear and Flare install files pass every check', checkInstallFile(ccFile).length === 0 && checkInstallFile(flFile).length === 0);
const bad = checkInstallFile({ services: [{ name: 'A', price_cents: 100, price_approved: true }, { name: 'a', price_cents: 500, deposit_cents: 900 }], assistant: { status: 'active', monthly_spend_cap_cents: 1000 }, split_proposal: { shares: [{ label: 'x', percent: 60, to_worker: true }], approved: true } });
check('a bad file is refused with every reason', bad.length >= 6 && bad.some((p) => /approved_by/.test(p)) && bad.some((p) => /listed twice/.test(p)) && bad.some((p) => /deposit cannot exceed/.test(p)) && bad.some((p) => /assistant\.status/.test(p)) && bad.some((p) => /never approves a split/.test(p)));

// Crystal Clear as registration leaves it: the Lawn care trade list (unpriced) and a draft assistant.
const db = memoryDb();
await db.insert('organizations', { id: CC, name: 'Crystal Clear', slug: 'crystal-clear', kind: 'client', status: 'active' });
await db.insert('organizations', { id: FL, name: 'Flare', slug: 'flare', kind: 'client', status: 'active' });
await db.insert('organizations', { id: NOVA, name: 'Nova Systems', slug: 'nova', kind: 'nova_internal', status: 'active' });
await applyPack(db, CC, 'lawn_care');
await db.insert('business_agents', { organization_id: CC, business_name: 'Crystal Clear', agent_name: 'the assistant', tone: 'friendly', sms_enabled: false, voice_enabled: false, monthly_spend_cap_cents: null, status: 'draft' });

let plan = await planInstall(db, NOVA, ccFile);
check('an install file is never applied to Nova\'s own organization', plan.ok === false);
plan = await planInstall(db, CC, ccFile);
const kinds = plan.steps.map((s) => s.kind);
check('the plan adds the six services, switches off the four trade-list ones, updates the assistant and proposes the split', kinds.filter((k) => k === 'add_service').length === 6 && kinds.filter((k) => k === 'switch_off_service').length === 4 && kinds.includes('update_assistant') && kinds.includes('propose_split'));
check('every step can be described in plain words', plan.steps.every((s) => describeStep(s).length > 10) && /not approved/.test(describeStep(plan.steps.find((s) => s.kind === 'propose_split'))));
check('planning changes nothing', db.t.business_services.length === 4 && !(db.t.pay_split_rules || []).length && db.t.business_agents[0].service_area === undefined);
await applyInstall(db, CC, plan, NOW);
const svc = (name) => db.t.business_services.find((s) => s.organization_id === CC && s.name === name);
check('approved prices are installed exactly: sedan $199, SUV/truck $249, windows $199, junk $175, Holiday Ready $299', svc('Full detail, sedan').price_cents === 19900 && svc('Full detail, SUV or truck').price_cents === 24900 && svc('Outside window cleaning, up to 20 windows').price_cents === 19900 && svc('Junk removal, quarter truck load').price_cents === 17500 && svc('Holiday Ready (book by Dec 15): sedan full detail plus outside windows').price_cents === 29900 && ['Full detail, sedan', 'Full detail, SUV or truck', 'Outside window cleaning, up to 20 windows', 'Junk removal, quarter truck load'].every((n) => svc(n).price_approved === true && svc(n).active === true));
check('no deposit or agreement wording is invented', db.t.business_services.filter((s) => s.organization_id === CC).every((s) => s.deposit_cents == null && !s.terms_text && s.terms_approved !== true));
check('lawn mowing has no price and stays off until spring', svc('Lawn mowing, up to a quarter acre').price_cents === null && svc('Lawn mowing, up to a quarter acre').price_approved === false && svc('Lawn mowing, up to a quarter acre').active === false);
check('the trade-list services are switched off, not deleted', ['Lawn mowing', 'Leaf and yard cleanup', 'Hedge and shrub trimming', 'Snow shovelling'].every((n) => svc(n) && svc(n).active === false));
const agent = db.t.business_agents.find((a) => a.organization_id === CC);
check('the assistant knows the business and its area', agent.service_area === 'Fairfield County, Connecticut' && /junk/.test(agent.services) && agent.web_chat_enabled === true);
check('nothing is switched on: still a draft, texting off, no spending cap', agent.status === 'draft' && agent.sms_enabled === false && agent.monthly_spend_cap_cents === null);
const rule = db.t.pay_split_rules.find((r) => r.organization_id === CC);
check('the pay split is saved as a proposal only', rule.approved === false && rule.approved_by === null && rule.shares.map((s) => `${s.label}:${s.percent}:${s.to_worker}`).join() === 'Pro who did the job:50:true,Crystal Clear:50:false');
plan = await planInstall(db, CC, ccFile);
check('running it again changes nothing (only notes the existing split)', plan.steps.length === 1 && plan.steps[0].kind === 'keep_split');

// What customers now get from the assistant.
let n = 0;
const ask = (text, who = '+12035550101') => converse(db, { orgId: CC, channel: 'sms', customerKey: who, phone: who, messageId: `m${++n}`, text, now: NOW });
let r = await ask('How much to detail my SUV?', '+12035550111');
check('"detail my SUV" is quoted the approved $249', /\$249\.00/.test(r.reply));
r = await ask('I need my car detailed', '+12035550112');
check('a plain "car" request asks sedan or SUV first instead of guessing', /1\. /.test(r.reply) && /Full detail, sedan/.test(r.reply) && /Full detail, SUV or truck/.test(r.reply) && !/\$/.test(r.reply));
r = await ask('Is the holiday deal still on?', '+12035550113');
check('"holiday" is quoted the Holiday Ready price, with its deadline in the name', /\$299\.00/.test(r.reply) && /book by Dec 15/.test(r.reply));
r = await ask('can you mow my lawn', '+12035550114');
check('lawn mowing is not offered while it is off', !/Lawn mowing/.test(r.reply || '') && !/\$45/.test(r.reply || ''));

// Flare: prepared, but on hold.
plan = await planInstall(db, FL, flFile);
await applyInstall(db, FL, plan, NOW);
check('Flare: four services, none priced, all off; a draft assistant with chat off', db.t.business_services.filter((s) => s.organization_id === FL).length === 4 && db.t.business_services.filter((s) => s.organization_id === FL).every((s) => s.active === false && s.price_cents === null) && db.t.business_agents.find((a) => a.organization_id === FL)?.status === 'draft' && db.t.business_agents.find((a) => a.organization_id === FL).web_chat_enabled === false);
r = await converse(db, { orgId: FL, channel: 'sms', customerKey: '+12035550199', phone: '+12035550199', messageId: 'f1', text: 'How much is a mystery box?', now: NOW });
check('Flare quotes nothing while it is on hold; a person answers instead', r.reply === null && r.handed_to_person === true);

check('an install file can prepare AI answers (the owner\'s answers and the AI) but never switch them on', checkInstallFile({ services: [{ name: 'A' }], assistant: { faq: 'We are insured.', ai_provider: 'google' } }).length === 0
  && checkInstallFile({ services: [{ name: 'A' }], assistant: { ai_enabled: true } }).some((p) => /ai_enabled cannot be set/.test(p))
  && checkInstallFile({ services: [{ name: 'A' }], assistant: { ai_provider: 'llama', faq: 'x'.repeat(4001) } }).length === 2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
