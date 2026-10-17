// Nova loyalty (master prompt §10 "Apple Wallet loyalty and rewards"): a business-approved program and an append-only
// ledger. Reward economics come only from the owner — there are no default point values — and approval freezes the
// exact rules (hashed, versioned). Points: earned once per completed job; reversed when that job's payment is refunded;
// redeemed only at the approved threshold; expired first-in-first-out. Rewards are non-cash: cash, gift-card and
// store-credit rewards create stored-value liabilities and are refused here pending a separate owner decision.
// Every posting goes through the database function loyalty_post(), which locks the account (atomic balance checks).
import { dbGet, dbOne, dbInsert, dbPatch, dbRpc, enc, nowIso } from '../_sales/core.js';
import { sha256 } from './rules.js';

const ERR = (status, message) => Object.assign(new Error(message), { status });
const DAY = 86400_000;

export function validateLoyaltyRules(r = {}) {
  const e = [];
  if (!['per_completed_job', 'per_dollar'].includes(r.earn_type)) e.push('choose how points are earned: per completed job or per whole dollar of the job total');
  if (!Number.isInteger(r.earn_points) || r.earn_points < 1 || r.earn_points > 1000) e.push('points earned must be a whole number from 1 to 1000');
  if (!Number.isInteger(r.reward_threshold) || r.reward_threshold < 1 || r.reward_threshold > 100000) e.push('the reward threshold must be a whole number of points from 1 to 100000');
  const d = String(r.reward_description || '').trim();
  if (d.length < 5 || d.length > 200) e.push('describe the reward (5–200 characters)');
  if (/\$\s*\d|\b(cash|gift ?card|store credit|credit balance|prepaid|stored value)\b/i.test(d)) e.push('cash, gift-card and store-credit rewards create a stored-value liability; that needs a separate owner and legal decision and is not supported here');
  if (r.expiry_days != null && (!Number.isInteger(r.expiry_days) || r.expiry_days < 30 || r.expiry_days > 1095)) e.push('points expiry must be 30–1095 days, or none');
  if (!Number.isInteger(r.max_earns_per_day) || r.max_earns_per_day < 1 || r.max_earns_per_day > 10) e.push('set how many times one customer can earn per day (1–10) to limit abuse');
  if (String(r.terms_text || '').trim().length < 20) e.push('write the customer-facing terms (20+ characters)');
  return e;
}
const cleanRules = (r) => ({ earn_type: r.earn_type, earn_points: r.earn_points, reward_threshold: r.reward_threshold, reward_description: String(r.reward_description).trim(), expiry_days: r.expiry_days ?? null, max_earns_per_day: r.max_earns_per_day, terms_text: String(r.terms_text).trim() });
export const pointsForJob = (rules, totalCents) => (rules.earn_type === 'per_dollar' ? Math.floor((totalCents || 0) / 100) * rules.earn_points : rules.earn_points);

// FIFO lots from an account's ledger: what remains of each earn after reversals/expiries aimed at it and after
// redemptions/negative adjustments consumed the oldest points first. Pure.
export function computeLots(entries) {
  const lots = []; const byId = new Map();
  for (const x of [...entries].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))) {
    if (x.kind === 'earn' || (x.kind === 'adjust' && x.points > 0)) { const lot = { id: x.id, remaining: x.points, expires_at: x.expires_at || null, created_at: x.created_at }; lots.push(lot); byId.set(x.id, lot); continue; }
    if ((x.kind === 'reverse' || x.kind === 'expire') && x.lot_id && byId.has(x.lot_id)) { byId.get(x.lot_id).remaining += x.points; continue; }
    let take = -x.points; // redeem, negative adjust, or an unlinked reduction: oldest first
    for (const lot of lots) { if (take <= 0) break; const t = Math.min(Math.max(lot.remaining, 0), take); lot.remaining -= t; take -= t; }
  }
  return lots;
}

async function post(args) {
  try { return await dbRpc('loyalty_post', args); }
  catch (e) { if (/insufficient points/.test(e.detail || '')) throw ERR(409, 'Not enough points for this reward'); throw e; }
}
export async function liveProgram(orgId) { return dbOne(`loyalty_programs?organization_id=eq.${enc(orgId)}&status=eq.approved&select=*`); }

export async function createProgram({ orgId, name, rules, actor }) {
  const errs = validateLoyaltyRules(rules); if (errs.length) throw ERR(400, errs.join('; '));
  const prev = await dbOne(`loyalty_programs?organization_id=eq.${enc(orgId)}&select=version&order=version.desc`);
  const ins = await dbInsert('loyalty_programs', { organization_id: orgId, name: String(name || 'Rewards').slice(0, 80), version: (prev?.version || 0) + 1, rules: cleanRules(rules), created_by: actor.id });
  return ins.row;
}
export async function approveProgram({ orgId, programId, actor }) {
  const p = await dbOne(`loyalty_programs?id=eq.${enc(programId)}&organization_id=eq.${enc(orgId)}&select=*`);
  if (!p) throw ERR(404, 'Program not found');
  if (p.status !== 'draft') throw ERR(409, `This program is ${p.status}`);
  if (await liveProgram(orgId)) throw ERR(409, 'Retire the current program before approving a new one');
  const [row] = await dbPatch('loyalty_programs', `id=eq.${enc(p.id)}&status=eq.draft`, { status: 'approved', approved_by: actor.id, approved_at: nowIso(), rules_sha256: sha256(JSON.stringify(p.rules)), updated_at: nowIso() });
  return row;
}
export async function setProgramStatus({ orgId, programId, to }) {
  const allowed = { pause: ['approved', 'paused'], resume: ['paused', 'approved'], retire: [null, 'retired'] };
  const p = await dbOne(`loyalty_programs?id=eq.${enc(programId)}&organization_id=eq.${enc(orgId)}&select=*`);
  if (!p) throw ERR(404, 'Program not found');
  const [from, next] = allowed[to] || [];
  if (!next || (from && p.status !== from) || p.status === 'retired') throw ERR(409, `Cannot ${to} a ${p.status} program`);
  const [row] = await dbPatch('loyalty_programs', `id=eq.${enc(p.id)}`, { status: next, updated_at: nowIso() });
  return row;
}

async function accountFor({ orgId, program, contactId, isTest }) {
  const found = await dbOne(`loyalty_accounts?program_id=eq.${enc(program.id)}&contact_id=eq.${enc(contactId)}&select=*`);
  if (found) return found;
  const ins = await dbInsert('loyalty_accounts', { organization_id: orgId, program_id: program.id, contact_id: contactId, is_test: !!isTest }, { onConflict: 'program_id,contact_id' });
  return ins.row || dbOne(`loyalty_accounts?program_id=eq.${enc(program.id)}&contact_id=eq.${enc(contactId)}&select=*`);
}

// Called when a job is marked completed. Once per job; nothing happens without an approved program.
export async function earnForJob({ orgId, job, actor, now = new Date() }) {
  const program = await liveProgram(orgId);
  if (!program) return { skipped: 'no_approved_program' };
  if (job.fulfillment_status !== 'completed') return { skipped: 'job_not_completed' };
  const points = pointsForJob(program.rules, job.total_cents);
  if (points < 1) return { skipped: 'no_points_for_this_total' };
  const acc = await accountFor({ orgId, program, contactId: job.contact_id, isTest: job.is_test });
  const since = new Date(now.getTime() - DAY).toISOString();
  const today = await dbGet(`loyalty_ledger?account_id=eq.${enc(acc.id)}&kind=eq.earn&created_at=gte.${enc(since)}&select=id`);
  if (today.length >= program.rules.max_earns_per_day) {
    await dbInsert('ops_transitions', { organization_id: orgId, entity: 'job', entity_id: job.id, from_state: job.state, to_state: job.state, actor_type: 'system', reason: 'loyalty: daily earn limit reached; no points posted', evidence: { account_id: acc.id } });
    return { skipped: 'daily_earn_limit' };
  }
  const entry = await post({ p_account: acc.id, p_kind: 'earn', p_points: points, p_reason: `Completed job ${job.price_snapshot?.service_name || ''}`.trim(), p_key: `earn:${job.id}`, p_job: job.id, p_expires: program.rules.expiry_days ? new Date(now.getTime() + program.rules.expiry_days * DAY).toISOString() : null, p_actor: String(actor?.id || 'system') });
  return { entry, account_id: acc.id };
}

// Called when a job's payment is refunded: the points that job earned are reversed (once).
export async function reverseForJob({ orgId, jobId, reason = 'payment refunded' }) {
  const earn = await dbOne(`loyalty_ledger?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(jobId)}&kind=eq.earn&select=*`);
  if (!earn) return { skipped: 'no_points_earned' };
  const entry = await post({ p_account: earn.account_id, p_kind: 'reverse', p_points: -earn.points, p_reason: `Reversed: ${reason}`, p_key: `reverse:${earn.id}`, p_job: jobId, p_lot: earn.id, p_actor: 'system' });
  return { entry };
}

// Expire what remains of lots past their expiry, oldest first (idempotent per lot).
export async function expireAccount({ accountId, now = new Date() }) {
  const entries = await dbGet(`loyalty_ledger?account_id=eq.${enc(accountId)}&select=*&order=created_at.asc`);
  let n = 0;
  for (const lot of computeLots(entries)) {
    if (lot.expires_at && new Date(lot.expires_at) <= now && lot.remaining > 0) { await post({ p_account: accountId, p_kind: 'expire', p_points: -lot.remaining, p_reason: 'Points expired', p_key: `expire:${lot.id}`, p_lot: lot.id, p_actor: 'system' }); n++; }
  }
  return n;
}
export async function expireDue({ now = new Date() } = {}) {
  const due = await dbGet(`loyalty_ledger?kind=in.(earn,adjust)&expires_at=lte.${enc(now.toISOString())}&select=account_id&limit=2000`);
  let n = 0; for (const a of [...new Set(due.map((d) => d.account_id))]) n += await expireAccount({ accountId: a, now });
  return { lots_expired: n };
}

export async function redeem({ orgId, accountId, requestId, actor, now = new Date() }) {
  const acc = await dbOne(`loyalty_accounts?id=eq.${enc(accountId)}&organization_id=eq.${enc(orgId)}&select=*`);
  if (!acc) throw ERR(404, 'Account not found');
  const program = await dbOne(`loyalty_programs?id=eq.${enc(acc.program_id)}&select=*`);
  if (program.status !== 'approved') throw ERR(409, `The program is ${program.status}; rewards cannot be redeemed`);
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(String(requestId || ''))) throw ERR(400, 'A request id is required so a double tap cannot redeem twice');
  await expireAccount({ accountId: acc.id, now }); // expired points can never be spent
  const entry = await post({ p_account: acc.id, p_kind: 'redeem', p_points: -program.rules.reward_threshold, p_reason: `Redeemed: ${program.rules.reward_description}`, p_key: `redeem:${acc.id}:${requestId}`, p_actor: String(actor.id) });
  return { entry, reward: program.rules.reward_description };
}

export async function adjust({ orgId, accountId, points, reason, actor }) {
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 10000) throw ERR(400, 'Adjustment must be a non-zero whole number of points');
  if (String(reason || '').trim().length < 10) throw ERR(400, 'Record why (10+ characters)');
  const acc = await dbOne(`loyalty_accounts?id=eq.${enc(accountId)}&organization_id=eq.${enc(orgId)}&select=*`);
  if (!acc) throw ERR(404, 'Account not found');
  // points granted by hand follow the same expiry rule as earned points
  const program = await dbOne(`loyalty_programs?id=eq.${enc(acc.program_id)}&select=rules`);
  const expires = points > 0 && program?.rules?.expiry_days ? new Date(Date.now() + program.rules.expiry_days * DAY).toISOString() : null;
  return post({ p_account: acc.id, p_kind: 'adjust', p_points: points, p_expires: expires, p_reason: `Adjusted by owner: ${String(reason).trim().slice(0, 300)}`, p_key: `adjust:${acc.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`, p_actor: String(actor.id) });
}

// What a Wallet pass needs, and whether it can be issued. Nothing is signed or distributed without Apple credentials.
export function walletReadiness(env = process.env) {
  const missing = ['APPLE_PASS_TYPE_ID', 'APPLE_TEAM_ID', 'APPLE_PASS_CERT_P12_BASE64', 'APPLE_PASS_CERT_PASSWORD', 'APPLE_WWDR_CERT_BASE64'].filter((k) => !env[k]);
  return { can_issue: false, missing, reason: missing.length ? 'Apple Wallet pass signing credentials are not configured (owner: Apple Developer account → Pass Type ID + certificate)' : 'Pass signing is not implemented yet in this build; credentials are present' };
}
