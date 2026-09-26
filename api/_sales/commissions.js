// Commission ledger and payouts. Rates come ONLY from an owner-approved, versioned plan; each deal is locked to a snapshot of the plan
// in force when its entry was created. States: Estimated → Pending Conditions → Eligible → Owner Approved → Scheduled → Paid | Failed.
// Nothing here can manufacture a "Paid": provider payouts become Paid only on a verified provider callback; without a provider,
// only the OWNER can record an externally made payment, with evidence, and it is labelled as not provider-confirmed.
import { sanitize } from '../_sanitize.js';
import { rateLimit } from '../_rateLimit.js';
import { stripeRequest } from '../_stripe.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, inList, nowIso, audit, bad, wrap, requirePerm, requireActiveRep, visibleRepUserIds, displayNameOf, notify, notifyOwners, appBase } from './core.js';
import { registerSalesHook, stripeAllowed, stripeKey } from './payments.js';
import { normalizePlan, planProblems, computeCommission, conditionsState, summarize, STATUS_LABELS, batchApprovalHash, csvCell } from './commissionRules.js';

const payoutsProviderOn = () => (process.env.SALES_PAYOUTS_MODE || '') === 'provider' && stripeAllowed().ok;

export async function approvedPlan() { return dbOne('sales_config?key=eq.commission_plan&status=eq.approved&select=*'); }

async function event(entry, from, to, actor, actorKind, detail = {}) {
  await dbInsert('sales_commission_events', { entry_id: entry.id, from_status: from, to_status: to, actor_id: actor?.id || null, actor_kind: actorKind, detail });
}
// Compare-and-set status change. Returns the updated row or null (someone else moved it first).
async function transition(entry, to, { actor = null, actorKind = 'system', reason = null, patch = {}, notifyRep = null } = {}) {
  const [row] = await dbPatch('sales_commission_entries', `id=eq.${enc(entry.id)}&status=eq.${enc(entry.status)}`, { status: to, status_reason: reason, updated_at: nowIso(), ...patch });
  if (!row) return null;
  await event(entry, entry.status, to, actor, actorKind, { reason });
  if (['owner_approved', 'scheduled', 'paid', 'failed', 'reversed'].includes(to)) await audit(actor || { id: null, kind: actorKind }, 'sales_commission', entry.id, `commission_${to}`, { amount_cents: entry.amount_cents, rep: entry.rep_user_id, reason });
  if (notifyRep) await notify({ userId: entry.rep_user_id, kind: `commission_${to}`, subject: notifyRep.subject, body: notifyRep.body, link: '/rep/earnings', channels: ['in_app', ...(notifyRep.email ? ['email'] : [])], idempotencyKey: `comm:${entry.id}:${to}:${row.updated_at}` });
  return row;
}

async function paidPaymentFor(dealId) { return dbOne(`sales_payments?deal_id=eq.${enc(dealId)}&status=eq.paid&order=paid_at.desc&select=id,paid_at`); }

export async function evaluateEntry(entry) {
  if (entry.status !== 'pending_conditions' || entry.kind !== 'sale') return entry;
  const pay = await paidPaymentFor(entry.deal_id);
  const st = conditionsState({ snapshot: entry.plan_snapshot, paymentReceivedAt: pay?.paid_at || null });
  if (st.met) return (await transition(entry, 'eligible', { reason: 'All conditions met', patch: { eligible_at: nowIso(), eligible_after: st.eligibleAfter?.toISOString() || null }, notifyRep: { subject: 'A commission is now eligible', body: 'Every condition for one of your commissions is met. Nova reviews and approves it before it is scheduled for payment.' } })) || entry;
  if (st.eligibleAfter && String(entry.eligible_after) !== st.eligibleAfter.toISOString()) { const [row] = await dbPatch('sales_commission_entries', `id=eq.${enc(entry.id)}&status=eq.pending_conditions`, { eligible_after: st.eligibleAfter.toISOString(), updated_at: nowIso() }); return row || entry; }
  return entry;
}

async function buildEntry({ dealId, proposalId, repUserId, planCfg, status }) {
  const proposal = await dbOne(`crm_proposals?id=eq.${enc(proposalId)}&select=id,line_items,discount_cents,total_cents,currency`);
  if (!proposal || !proposal.line_items?.length || proposal.line_items.some((l) => l.unit_price_cents == null)) return { skipped: 'proposal has no fully priced lines' };
  const plan = normalizePlan(planCfg.value); const calc = computeCommission({ plan, lines: proposal.line_items, discountCents: proposal.discount_cents || 0 });
  if (calc.amount_cents <= 0) return { skipped: 'the approved plan yields no commission for these offerings' };
  const ins = await dbInsert('sales_commission_entries', { kind: 'sale', rep_user_id: repUserId, deal_id: dealId, proposal_id: proposalId, plan_config_id: planCfg.id, plan_snapshot: { ...plan, plan_version: planCfg.version, calc: calc.detail }, basis_cents: calc.basis_cents, amount_cents: calc.amount_cents, currency: proposal.currency || 'USD', status });
  if (ins.conflict || !ins.row) return { existing: true };
  await event(ins.row, null, status, null, 'system', { plan_version: planCfg.version, amount_cents: calc.amount_cents });
  return { entry: ins.row };
}
const saleEntry = (dealId, repUserId) => dbOne(`sales_commission_entries?deal_id=eq.${enc(dealId)}&rep_user_id=eq.${enc(repUserId)}&kind=eq.sale&select=*`);

// ---------------------------------------------------------------- hooks (registered when this module loads)
registerSalesHook('saleSubmitted', async ({ dealId, proposalId, repUserId }) => {
  const plan = await approvedPlan(); if (!plan) return;             // no approved plan → no estimate, and the rep is told so
  if (!(await saleEntry(dealId, repUserId))) await buildEntry({ dealId, proposalId, repUserId, planCfg: plan, status: 'estimated' });
});
registerSalesHook('saleVerified', async ({ dealId, proposalId, repUserId }) => {
  let entry = await saleEntry(dealId, repUserId);
  if (!entry) { const plan = await approvedPlan(); if (!plan) return; const b = await buildEntry({ dealId, proposalId, repUserId, planCfg: plan, status: 'estimated' }); entry = b.entry || (await saleEntry(dealId, repUserId)); }
  if (!entry) return;
  if (entry.status === 'estimated') entry = (await transition(entry, 'pending_conditions', { reason: 'Sale verified by owner' })) || entry;
  await evaluateEntry(entry);
});
registerSalesHook('saleRejected', async ({ dealId }) => {
  for (const e of await dbGet(`sales_commission_entries?deal_id=eq.${enc(dealId)}&status=eq.estimated&select=*`)) await transition(e, 'cancelled', { reason: 'Sale was not verified' });
});
registerSalesHook('paymentReceived', async ({ dealId }) => { for (const e of await dbGet(`sales_commission_entries?deal_id=eq.${enc(dealId)}&status=eq.pending_conditions&kind=eq.sale&select=*`)) await evaluateEntry(e); });
registerSalesHook('paymentReversed', async ({ dealId, reason }) => {
  for (const e of await dbGet(`sales_commission_entries?deal_id=eq.${enc(dealId)}&kind=eq.sale&select=*`)) {
    if (e.status === 'estimated') await transition(e, 'cancelled', { reason: `Client payment ${reason}` });
    else if (['pending_conditions', 'eligible', 'owner_approved'].includes(e.status)) await transition(e, 'reversed', { reason: `Client payment ${reason}`, notifyRep: { subject: 'A commission was reversed', body: `The client payment was ${reason}, so the related commission was reversed before it was paid.` } });
    else if (['scheduled', 'paid'].includes(e.status)) { // money may already have left: never silently claw back — record an adjustment for the owner to decide
      const ins = await dbInsert('sales_commission_entries', { kind: 'adjustment', parent_entry_id: e.id, rep_user_id: e.rep_user_id, deal_id: e.deal_id, proposal_id: e.proposal_id, plan_config_id: e.plan_config_id, plan_snapshot: e.plan_snapshot, basis_cents: 0, amount_cents: -e.amount_cents, currency: e.currency, status: 'pending_conditions', status_reason: `Client payment ${reason} after this commission was ${e.status}: owner decision needed` });
      if (ins.row) { await event(ins.row, null, 'pending_conditions', null, 'system', { parent: e.id }); await notifyOwners({ kind: 'commission_clawback', subject: 'Clawback decision needed', body: `A client payment was ${reason} after its commission was ${e.status}. An adjustment was recorded for you to resolve.`, link: '/dashboard/sales-team/commissions', channels: ['in_app', 'email'], idempotencyKey: `clawback:${ins.row.id}` }); }
    }
  }
});
// Provider callbacks for payouts and payout accounts (called from api/_sales/payments.js after signature verification)
registerSalesHook('providerEvent', async (event) => {
  const obj = event.data?.object || {};
  if (event.type === 'account.updated') {
    const acct = await dbOne(`sales_payout_accounts?provider_account_id=eq.${enc(String(obj.id).slice(0, 80))}&select=*`); if (!acct) return null;
    const status = obj.details_submitted && obj.payouts_enabled ? 'verified' : obj.requirements?.disabled_reason ? 'restricted' : 'onboarding';
    await dbPatch('sales_payout_accounts', `id=eq.${enc(acct.id)}`, { status, status_event_id: event.id, updated_at: nowIso() }); return { processed: true };
  }
  const pid = obj.metadata?.sales_payout_id;
  if (!pid || !/^transfer\./.test(event.type)) return null;
  const payout = await dbOne(`sales_payouts?id=eq.${enc(String(pid).slice(0, 60))}&select=*`); if (!payout) return null;
  const entry = await dbOne(`sales_commission_entries?id=eq.${enc(payout.entry_id)}&select=*`);
  if (event.type === 'transfer.created' || event.type === 'transfer.paid') {
    if (payout.status === 'paid') return { processed: true };
    if (obj.amount !== payout.amount_cents || String(obj.currency || '').toUpperCase() !== payout.currency.toUpperCase()) { await notifyOwners({ kind: 'payout_mismatch', subject: 'Payout confirmation did not match', body: `The provider reported ${obj.amount} ${obj.currency} for a payout expected to be ${payout.amount_cents} ${payout.currency}. It was NOT marked paid.`, link: '/dashboard/sales-team/commissions', channels: ['in_app', 'email'], idempotencyKey: `payoutmismatch:${event.id}` }); return { processed: false }; }
    const [row] = await dbPatch('sales_payouts', `id=eq.${enc(payout.id)}&status=in.(scheduled,processing)`, { status: 'paid', paid_at: nowIso(), provider_event_id: event.id, provider_transfer_id: obj.id, needs_reconciliation: false, updated_at: nowIso() });
    if (row && entry) await transition(entry, 'paid', { actorKind: 'stripe_webhook', reason: 'Provider confirmed the transfer', notifyRep: { subject: 'Your commission was paid', body: `A payout of ${(payout.amount_cents / 100).toFixed(2)} ${payout.currency} was confirmed by the payment provider.`, email: true } });
    await refreshBatch(payout.batch_id); return { processed: true };
  }
  if (event.type === 'transfer.reversed' || event.type === 'transfer.failed') {
    const [row] = await dbPatch('sales_payouts', `id=eq.${enc(payout.id)}&status=in.(scheduled,processing)`, { status: 'failed', failure_reason: `provider reported ${event.type}`, provider_event_id: event.id, updated_at: nowIso() });
    if (row && entry) await transition(entry, 'failed', { actorKind: 'stripe_webhook', reason: `Provider reported ${event.type}` });
    await notifyOwners({ kind: 'payout_failed', subject: 'A payout failed or was reversed', body: `Payout ${payout.id} (${(payout.amount_cents / 100).toFixed(2)} ${payout.currency}) ${payout.status === 'paid' ? 'was reversed AFTER being marked paid — manual follow-up needed' : 'failed'}.`, link: '/dashboard/sales-team/commissions', channels: ['in_app', 'email'], idempotencyKey: `payoutfail:${event.id}` });
    await refreshBatch(payout.batch_id); return { processed: true };
  }
  return null;
});

async function refreshBatch(batchId) {
  const ps = await dbGet(`sales_payouts?batch_id=eq.${enc(batchId)}&select=status`); if (!ps.length) return;
  const st = ps.map((p) => p.status); const open = st.some((s) => ['scheduled', 'processing'].includes(s));
  const status = open ? (st.some((s) => s === 'processing') ? 'processing' : 'approved') : st.every((s) => s === 'paid') ? 'completed' : st.some((s) => s === 'paid') ? 'partially_failed' : st.every((s) => s === 'cancelled') ? 'cancelled' : 'partially_failed';
  await dbPatch('sales_payout_batches', `id=eq.${enc(batchId)}&status=in.(approved,processing,partially_failed)`, { status });
}

async function repNames(rows) { const m = {}; for (const id of [...new Set(rows.map((r) => r.rep_user_id))]) m[id] = await displayNameOf(id); return m; }
const entryView = (e, names, biz) => ({ id: e.id, kind: e.kind, deal_id: e.deal_id, business: biz?.[e.deal_id] || null, rep_user_id: e.rep_user_id, rep_name: names?.[e.rep_user_id], status: e.status, status_label: STATUS_LABELS[e.status], amount_cents: e.amount_cents, basis_cents: e.basis_cents, currency: e.currency, status_reason: e.status_reason, eligible_after: e.eligible_after, plan_version: e.plan_snapshot?.plan_version, conditions: e.plan_snapshot?.conditions, created_at: e.created_at, updated_at: e.updated_at });
async function bizFor(dealIds) { if (!dealIds.length) return {}; const deals = await dbGet(`crm_deals?id=in.${inList(dealIds)}&select=id,business_id`); const bids = [...new Set(deals.map((d) => d.business_id).filter(Boolean))]; const bz = bids.length ? await dbGet(`businesses?id=in.${inList(bids)}&select=id,name`) : []; return Object.fromEntries(deals.map((d) => [d.id, bz.find((b) => b.id === d.business_id)?.name || null])); }

export const handleCommissions = wrap(async (req, res, op) => {
  const b = req.body || {};
  const need = (m) => { if (req.method !== m) { bad(res, 405, 'Method not allowed'); return false; } return true; };
  const repOps = ['earnings', 'payout-account', 'payout-onboarding-link'];
  const financeOps = ['ledger', 'approve-entries', 'create-batch', 'batches', 'report', 'export-csv', 'plan'];
  const ownerOps = ['save-plan', 'approve-plan', 'approve-batch', 'cancel-batch', 'execute-batch', 'record-external', 'retry-failed', 'sweep', 'resolve-adjustment', 'create-for-deal'];
  const caller = repOps.includes(op) ? await requireActiveRep(req, res) : await requirePerm(req, res, ownerOps.includes(op) ? 'sales.owner' : op === 'team-ledger' ? 'sales.manage' : 'sales.finance');
  if (!caller) return;
  if (!rateLimit(req, res, 90, 60_000)) return;

  // ================================================================== representative
  if (op === 'earnings') {
    const [entries, plan, acct] = await Promise.all([dbGet(`sales_commission_entries?rep_user_id=eq.${enc(caller.id)}&order=created_at.desc&select=*`), approvedPlan(), dbOne(`sales_payout_accounts?rep_user_id=eq.${enc(caller.id)}&select=status,provider`)]);
    const biz = await bizFor([...new Set(entries.map((e) => e.deal_id))]);
    const payouts = await dbGet(`sales_payouts?rep_user_id=eq.${enc(caller.id)}&order=created_at.desc&select=id,entry_id,amount_cents,currency,status,mode,paid_at,external_method,failure_reason`);
    return res.status(200).json({
      plan: plan ? { version: plan.version, conditions: normalizePlan(plan.value).conditions } : null,
      plan_note: plan ? null : 'Nova has not approved a commission plan yet, so no commission can be estimated or earned. Nothing here is a promise of pay.',
      summary: summarize(entries), entries: entries.map((e) => entryView(e, null, biz)),
      payouts: payouts.map((p) => ({ ...p, confirmation: p.mode === 'external_record' ? 'Recorded by Nova (not provider-confirmed)' : p.status === 'paid' ? 'Confirmed by the payment provider' : 'Awaiting provider confirmation' })),
      payout_account: { status: acct?.status || 'not_started', provider_enabled: payoutsProviderOn() },
      labels: { estimated: 'Estimated commissions are NOT earnings. They can change or be cancelled.' },
    });
  }
  if (op === 'payout-account') { const a = await dbOne(`sales_payout_accounts?rep_user_id=eq.${enc(caller.id)}&select=status,provider,updated_at`); return res.status(200).json({ account: a || { status: 'not_started' }, provider_enabled: payoutsProviderOn() }); }
  if (op === 'payout-onboarding-link') {
    if (!need('POST')) return;
    if (!payoutsProviderOn()) return bad(res, 409, 'Provider payouts are not enabled yet. Nova will pay you using a method the owner records, and will tell you how.');
    let acct = await dbOne(`sales_payout_accounts?rep_user_id=eq.${enc(caller.id)}&select=*`);
    if (!acct?.provider_account_id) {
      const created = await stripeRequest(stripeKey(), 'POST', 'accounts', { type: 'express', country: 'US', capabilities: { transfers: { requested: true } }, metadata: { rep_user_id: caller.id } }, { idempotencyKey: `sales-acct:${caller.id}` });
      if (acct) [acct] = await dbPatch('sales_payout_accounts', `rep_user_id=eq.${enc(caller.id)}`, { provider_account_id: created.id, status: 'onboarding', updated_at: nowIso() });
      else acct = (await dbInsert('sales_payout_accounts', { rep_user_id: caller.id, provider_account_id: created.id, status: 'onboarding' })).row;
    }
    const link = await stripeRequest(stripeKey(), 'POST', 'account_links', { account: acct.provider_account_id, type: 'account_onboarding', refresh_url: `${appBase()}/rep/earnings?payout=refresh`, return_url: `${appBase()}/rep/earnings?payout=return` });
    return res.status(200).json({ ok: true, url: link.url, note: 'Provider-hosted page. Nova never sees your bank details, ID or tax information.' });
  }

  // ================================================================== manager view
  if (op === 'team-ledger') {
    const scope = await visibleRepUserIds(caller);
    let q = 'sales_commission_entries?order=created_at.desc&limit=500&select=*'; if (scope) q += scope.length ? `&rep_user_id=in.${inList(scope)}` : '&rep_user_id=eq.00000000-0000-0000-0000-000000000000';
    const rows = await dbGet(q); const [names, biz] = await Promise.all([repNames(rows), bizFor([...new Set(rows.map((e) => e.deal_id))])]); return res.status(200).json({ entries: rows.map((e) => entryView(e, names, biz)), summary: summarize(rows) });
  }

  // ================================================================== finance / owner
  if (op === 'plan') {
    const [approved, versions] = await Promise.all([approvedPlan(), dbGet('sales_config?key=eq.commission_plan&order=version.desc&select=id,version,status,value,change_note,approved_at,created_at')]);
    return res.status(200).json({ approved: approved ? { id: approved.id, version: approved.version, value: normalizePlan(approved.value) } : null, versions, note: approved ? null : 'No commission plan is approved. No commission can be calculated until you write and approve one.' });
  }
  if (op === 'ledger') {
    let q = 'sales_commission_entries?order=created_at.desc&limit=1000&select=*';
    if (req.query?.status && STATUS_LABELS[req.query.status]) q += `&status=eq.${enc(req.query.status)}`; if (req.query?.rep_id) q += `&rep_user_id=eq.${enc(sanitize(req.query.rep_id, 60))}`;
    const rows = await dbGet(q); const [names, biz] = await Promise.all([repNames(rows), bizFor([...new Set(rows.map((e) => e.deal_id))])]);
    const events = req.query?.entry_id ? await dbGet(`sales_commission_events?entry_id=eq.${enc(sanitize(req.query.entry_id, 60))}&order=created_at.asc&select=*`) : undefined;
    return res.status(200).json({ entries: rows.map((e) => entryView(e, names, biz)), summary: summarize(rows), events });
  }
  if (op === 'approve-entries') {
    if (!need('POST')) return;
    const ids = [...new Set((Array.isArray(b.entry_ids) ? b.entry_ids : []).map((x) => sanitize(x, 60)))].slice(0, 100); if (!ids.length) return bad(res, 422, 'Choose entries to approve.');
    const results = [];
    for (const id of ids) {
      const e = await dbOne(`sales_commission_entries?id=eq.${enc(id)}&select=*`);
      if (!e) { results.push({ id, ok: false, error: 'Not found' }); continue; }
      if (e.rep_user_id === caller.id) { results.push({ id, ok: false, error: 'You cannot approve your own commission.' }); continue; }
      if (e.status !== 'eligible') { results.push({ id, ok: false, error: `Only Eligible entries can be approved (this one is ${STATUS_LABELS[e.status]}).` }); continue; }
      if (e.kind !== 'sale' || e.amount_cents <= 0) { results.push({ id, ok: false, error: 'Adjustments are resolved separately.' }); continue; }
      const deal = await dbOne(`crm_deals?id=eq.${enc(e.deal_id)}&select=stage,owner_verified_at`); const pay = await paidPaymentFor(e.deal_id);
      if (deal?.stage !== 'won' || !deal.owner_verified_at) { results.push({ id, ok: false, error: 'The sale is not verified.' }); continue; }
      if ((e.plan_snapshot?.conditions?.require_payment_received ?? true) && !pay) { results.push({ id, ok: false, error: 'There is no confirmed client payment on record.' }); continue; }
      const row = await transition(e, 'owner_approved', { actor: caller, actorKind: 'finance', reason: sanitize(b.note, 300) || 'Approved', patch: { approved_by: caller.id, approved_at: nowIso() }, notifyRep: { subject: 'A commission was approved', body: 'Nova approved one of your commissions. It will be scheduled in a payout batch.' } });
      results.push({ id, ok: !!row, error: row ? undefined : 'Someone else changed this entry.' });
    }
    return res.status(200).json({ ok: true, results });
  }
  if (op === 'create-batch') {
    if (!need('POST')) return;
    const mode = b.mode === 'provider' ? 'provider' : 'external_record';
    const ids = [...new Set((Array.isArray(b.entry_ids) ? b.entry_ids : []).map((x) => sanitize(x, 60)))].slice(0, 200); if (!ids.length) return bad(res, 422, 'Choose approved entries.');
    const entries = await dbGet(`sales_commission_entries?id=in.${inList(ids)}&select=*`);
    if (entries.length !== ids.length || entries.some((e) => e.status !== 'owner_approved' || e.kind !== 'sale')) return bad(res, 409, 'Every entry in a batch must be Owner Approved.');
    const busy = await dbGet(`sales_payouts?entry_id=in.${inList(ids)}&status=in.(scheduled,processing,paid)&select=id`); if (busy.length) return bad(res, 409, 'An entry is already in a payout.');
    if (mode === 'provider') {
      if (!payoutsProviderOn()) return bad(res, 409, 'Provider payouts are not enabled in this environment. Use an externally-recorded batch.');
      for (const rid of [...new Set(entries.map((e) => e.rep_user_id))]) { const a = await dbOne(`sales_payout_accounts?rep_user_id=eq.${enc(rid)}&select=status`); if (a?.status !== 'verified') return bad(res, 409, `${await displayNameOf(rid)} has no verified payout account.`); }
    }
    const currencies = new Set(entries.map((e) => e.currency)); if (currencies.size > 1) return bad(res, 409, 'A batch cannot mix currencies.');
    const ins = await dbInsert('sales_payout_batches', { mode, entry_ids: ids, total_cents: entries.reduce((s, e) => s + e.amount_cents, 0), currency: [...currencies][0], created_by: caller.id, note: sanitize(b.note, 300) || null });
    await audit(caller, 'payout_batch', ins.row.id, 'batch_created', { mode, count: ids.length, total_cents: ins.row.total_cents });
    return res.status(200).json({ ok: true, batch: ins.row });
  }
  if (op === 'batches') {
    const rows = await dbGet('sales_payout_batches?order=created_at.desc&limit=100&select=*'); const ids = rows.map((r) => r.id);
    const payouts = ids.length ? await dbGet(`sales_payouts?batch_id=in.${inList(ids)}&select=id,batch_id,entry_id,rep_user_id,amount_cents,status,mode,needs_reconciliation,failure_reason,paid_at,external_method,external_reference`) : [];
    const names = await repNames(payouts);
    return res.status(200).json(rows.map((r) => ({ ...r, payouts: payouts.filter((p) => p.batch_id === r.id).map((p) => ({ ...p, rep_name: names[p.rep_user_id], confirmation: p.mode === 'external_record' ? (p.status === 'paid' ? 'Recorded by owner — NOT provider-confirmed' : null) : (p.status === 'paid' ? 'Confirmed by verified provider callback' : null) })) })));
  }
  if (op === 'report' || op === 'export-csv') {
    const [entries, payouts, batches] = await Promise.all([dbGet('sales_commission_entries?select=*&limit=5000'), dbGet('sales_payouts?select=*&limit=5000'), dbGet('sales_payout_batches?select=id,status')]);
    const names = await repNames(entries);
    if (op === 'export-csv') {
      const head = ['entry_id', 'kind', 'rep', 'deal_id', 'status', 'amount_cents', 'currency', 'plan_version', 'created_at'];
      const csv = [head.join(','), ...entries.map((e) => [e.id, e.kind, names[e.rep_user_id], e.deal_id, e.status, e.amount_cents, e.currency, e.plan_snapshot?.plan_version, e.created_at].map(csvCell).join(','))].join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="commission-ledger.csv"'); return res.status(200).send(csv);
    }
    const perRep = {}; for (const e of entries) { const r = (perRep[e.rep_user_id] ||= { rep_name: names[e.rep_user_id], entries: [] }); r.entries.push(e); }
    return res.status(200).json({ totals: summarize(entries), per_rep: Object.values(perRep).map((r) => ({ rep_name: r.rep_name, ...summarize(r.entries) })), payout_failures: payouts.filter((p) => p.status === 'failed').length, needs_reconciliation: payouts.filter((p) => p.needs_reconciliation).length, open_adjustments: entries.filter((e) => e.kind === 'adjustment' && !['reversed', 'cancelled', 'paid'].includes(e.status)).length, batches: batches.length });
  }

  // ================================================================== owner
  if (op === 'save-plan') {
    if (!need('POST')) return;
    const value = normalizePlan(b.plan || {}); const problems = planProblems(value); if (problems.length) return res.status(422).json({ error: problems[0], problems });
    const last = await dbOne('sales_config?key=eq.commission_plan&order=version.desc&select=version');
    const ins = await dbInsert('sales_config', { key: 'commission_plan', version: (last?.version || 0) + 1, status: 'pending_approval', value, change_note: sanitize(b.change_note, 500) || null, created_by: caller.id });
    await audit(caller, 'commission_plan', ins.row.id, 'proposed', value); return res.status(200).json({ ok: true, config: ins.row });
  }
  if (op === 'approve-plan') {
    if (!need('POST')) return;
    if (b.confirm !== true) return bad(res, 422, 'Confirm that these are the rates Nova will pay. Existing deals stay on the plan they were created under.');
    const cfg = await dbOne(`sales_config?id=eq.${enc(sanitize(b.config_id, 60))}&key=eq.commission_plan&select=*`); if (!cfg) return bad(res, 404, 'Plan version not found');
    if (planProblems(normalizePlan(cfg.value)).length) return bad(res, 422, 'This plan has problems.');
    if (cfg.status !== 'approved') { await dbPatch('sales_config', 'key=eq.commission_plan&status=eq.approved', { status: 'retired' }); await dbPatch('sales_config', `id=eq.${enc(cfg.id)}`, { status: 'approved', approved_by: caller.id, approved_at: nowIso() }); await audit(caller, 'commission_plan', cfg.id, 'approved', cfg.value); }
    return res.status(200).json({ ok: true });
  }
  if (op === 'create-for-deal') {
    if (!need('POST')) return;
    const deal = await dbOne(`crm_deals?id=eq.${enc(sanitize(b.deal_id, 60))}&select=*`); if (!deal || deal.stage !== 'won' || !deal.owner_verified_at) return bad(res, 409, 'Only a verified sale can receive a commission entry.');
    const reason = sanitize(b.reason, 300); if (reason.length < 15) return bad(res, 422, 'Record why this sale is being given a commission now (for example: it was verified before a plan existed) — at least 15 characters.');
    if (deal.assigned_rep_id === caller.id) return bad(res, 403, 'You cannot create your own commission.');
    const plan = await approvedPlan(); if (!plan) return bad(res, 409, 'There is no approved commission plan.');
    const proposal = await dbOne(`crm_proposals?deal_id=eq.${enc(deal.id)}&status=eq.accepted&select=id`); if (!proposal) return bad(res, 409, 'No accepted proposal.');
    if (await saleEntry(deal.id, deal.assigned_rep_id)) return bad(res, 409, 'This sale already has a commission entry.');
    const built = await buildEntry({ dealId: deal.id, proposalId: proposal.id, repUserId: deal.assigned_rep_id, planCfg: plan, status: 'estimated' });
    if (!built.entry) return bad(res, 409, built.skipped || 'No entry was created.');
    let entry = await transition(built.entry, 'pending_conditions', { actor: caller, actorKind: 'owner', reason: `Created by owner: ${reason}` }); entry = await evaluateEntry(entry);
    await audit(caller, 'sales_commission', built.entry.id, 'created_for_verified_deal', { reason, plan_version: plan.version });
    return res.status(200).json({ ok: true, entry_id: built.entry.id });
  }
  if (op === 'sweep') { let n = 0; for (const e of await dbGet('sales_commission_entries?status=eq.pending_conditions&kind=eq.sale&select=*&limit=500')) { const r = await evaluateEntry(e); if (r.status !== e.status) n++; } return res.status(200).json({ ok: true, became_eligible: n }); }
  if (op === 'approve-batch') {
    if (!need('POST')) return;
    const batch = await dbOne(`sales_payout_batches?id=eq.${enc(sanitize(b.batch_id, 60))}&select=*`); if (!batch) return bad(res, 404, 'Batch not found'); if (batch.status !== 'draft') return bad(res, 409, 'Only a draft batch can be approved.');
    const entries = await dbGet(`sales_commission_entries?id=in.${inList(batch.entry_ids)}&select=*`);
    if (entries.length !== batch.entry_ids.length || entries.some((e) => e.status !== 'owner_approved')) return bad(res, 409, 'One or more entries changed since the batch was created. Create a new batch.');
    if (entries.some((e) => e.rep_user_id === caller.id)) return bad(res, 403, 'You cannot approve a payout that includes your own commission.');
    const total = entries.reduce((s, e) => s + e.amount_cents, 0);
    if (Number(b.confirm_total_cents) !== total || Number(b.confirm_count) !== entries.length) return res.status(422).json({ error: `Confirm the exact batch: ${entries.length} payout(s) totalling ${total} cents.`, total_cents: total, count: entries.length });
    if (batch.mode === 'provider' && !payoutsProviderOn()) return bad(res, 409, 'Provider payouts are not enabled.');
    const created = [];
    try {
      for (const e of entries) { const ins = await dbInsert('sales_payouts', { batch_id: batch.id, entry_id: e.id, rep_user_id: e.rep_user_id, amount_cents: e.amount_cents, currency: e.currency, mode: batch.mode, status: 'scheduled', idempotency_key: `payout:${batch.id}:${e.id}` }); if (!ins.row) throw new Error('payout already exists'); created.push({ payout: ins.row, entry: e }); }
      const moved = [];
      for (const { entry } of created) { const row = await transition(entry, 'scheduled', { actor: caller, actorKind: 'owner', reason: `Batch ${batch.id}`, notifyRep: { subject: 'A commission was scheduled for payment', body: batch.mode === 'provider' ? 'Your commission is scheduled. It is Paid only when the payment provider confirms.' : 'Your commission is scheduled. Nova will pay it and record how.' } }); if (!row) throw new Error('entry changed'); moved.push(row); }
    } catch (err) {
      for (const c of created) { await dbPatch('sales_payouts', `id=eq.${enc(c.payout.id)}&status=eq.scheduled`, { status: 'cancelled', updated_at: nowIso() }); const cur = await dbOne(`sales_commission_entries?id=eq.${enc(c.entry.id)}&select=*`); if (cur?.status === 'scheduled') await transition(cur, 'owner_approved', { reason: 'Batch approval rolled back' }); }
      return bad(res, 409, 'The batch could not be approved because something changed. Nothing was scheduled.');
    }
    const hash = batchApprovalHash(created.map((c) => ({ entry_id: c.entry.id, rep_user_id: c.entry.rep_user_id, amount_cents: c.entry.amount_cents })));
    await dbPatch('sales_payout_batches', `id=eq.${enc(batch.id)}&status=eq.draft`, { status: 'approved', approved_by: caller.id, approved_at: nowIso(), approval_hash: hash, total_cents: total });
    await audit(caller, 'payout_batch', batch.id, 'batch_approved', { count: entries.length, total_cents: total, mode: batch.mode, approval_hash: hash });
    return res.status(200).json({ ok: true, approval_hash: hash });
  }
  if (op === 'cancel-batch') {
    if (!need('POST')) return;
    const batch = await dbOne(`sales_payout_batches?id=eq.${enc(sanitize(b.batch_id, 60))}&select=*`); if (!batch) return bad(res, 404, 'Batch not found');
    const ps = await dbGet(`sales_payouts?batch_id=eq.${enc(batch.id)}&select=*`);
    if (ps.some((p) => ['processing', 'paid'].includes(p.status))) return bad(res, 409, 'Money has already moved or is moving for part of this batch; it cannot be cancelled.');
    for (const p of ps.filter((x) => x.status === 'scheduled')) { await dbPatch('sales_payouts', `id=eq.${enc(p.id)}&status=eq.scheduled`, { status: 'cancelled', updated_at: nowIso() }); const e = await dbOne(`sales_commission_entries?id=eq.${enc(p.entry_id)}&select=*`); if (e?.status === 'scheduled') await transition(e, 'owner_approved', { actor: caller, actorKind: 'owner', reason: 'Batch cancelled' }); }
    await dbPatch('sales_payout_batches', `id=eq.${enc(batch.id)}&status=in.(draft,approved)`, { status: 'cancelled' }); await audit(caller, 'payout_batch', batch.id, 'batch_cancelled', {});
    return res.status(200).json({ ok: true });
  }
  if (op === 'execute-batch') {
    if (!need('POST')) return;
    const batch = await dbOne(`sales_payout_batches?id=eq.${enc(sanitize(b.batch_id, 60))}&select=*`); if (!batch) return bad(res, 404, 'Batch not found');
    if (batch.mode !== 'provider') return bad(res, 409, 'This batch is paid outside the platform; record each payment with its evidence instead.');
    if (!['approved', 'processing', 'partially_failed'].includes(batch.status)) return bad(res, 409, 'Approve the batch first.');
    if (!payoutsProviderOn()) return bad(res, 409, 'Provider payouts are not enabled in this environment (SALES_PAYOUTS_MODE=provider plus an allowed Stripe key are required).');
    const ps = await dbGet(`sales_payouts?batch_id=eq.${enc(batch.id)}&status=in.(scheduled,processing)&select=*`); const out = [];
    for (const p of ps) {
      if (p.status === 'processing' && !p.needs_reconciliation) { out.push({ id: p.id, result: 'already_processing' }); continue; }
      const acct = await dbOne(`sales_payout_accounts?rep_user_id=eq.${enc(p.rep_user_id)}&select=*`);
      if (acct?.status !== 'verified') { out.push({ id: p.id, result: 'skipped_no_verified_account' }); continue; }
      try {
        const t = await stripeRequest(stripeKey(), 'POST', 'transfers', { amount: p.amount_cents, currency: p.currency.toLowerCase(), destination: acct.provider_account_id, transfer_group: batch.id, metadata: { sales_payout_id: p.id, entry_id: p.entry_id } }, { idempotencyKey: p.idempotency_key });
        await dbPatch('sales_payouts', `id=eq.${enc(p.id)}&status=in.(scheduled,processing)`, { status: 'processing', provider_transfer_id: t.id, needs_reconciliation: false, updated_at: nowIso() });
        out.push({ id: p.id, result: 'submitted_awaiting_confirmation' });      // NOT paid: only the verified callback makes it paid
      } catch (err) {
        const definite = err.status && err.status >= 400 && err.status < 500;
        if (definite) { await dbPatch('sales_payouts', `id=eq.${enc(p.id)}&status=in.(scheduled,processing)`, { status: 'failed', failure_reason: String(err.message).slice(0, 300), updated_at: nowIso() }); const e = await dbOne(`sales_commission_entries?id=eq.${enc(p.entry_id)}&select=*`); if (e?.status === 'scheduled') await transition(e, 'failed', { actor: caller, actorKind: 'owner', reason: err.message }); await notifyOwners({ kind: 'payout_failed', subject: 'A payout failed', body: `Payout ${p.id}: ${err.message}`, link: '/dashboard/sales-team/commissions', channels: ['in_app', 'email'], idempotencyKey: `payoutfail:${p.id}:${Date.now()}` }); out.push({ id: p.id, result: 'failed', error: err.message }); }
        else { await dbPatch('sales_payouts', `id=eq.${enc(p.id)}`, { needs_reconciliation: true, updated_at: nowIso() }); out.push({ id: p.id, result: 'outcome_unknown_retry_is_safe' }); } // same idempotency key on retry → provider cannot double-pay
      }
    }
    await dbPatch('sales_payout_batches', `id=eq.${enc(batch.id)}&status=in.(approved,partially_failed)`, { status: 'processing' });
    await audit(caller, 'payout_batch', batch.id, 'batch_executed', { results: out.map((o) => o.result) }); await refreshBatch(batch.id);
    return res.status(200).json({ ok: true, results: out, note: 'Submitted payouts are marked Paid only when the provider confirms them.' });
  }
  if (op === 'record-external') {
    if (!need('POST')) return;
    const p = await dbOne(`sales_payouts?id=eq.${enc(sanitize(b.payout_id, 60))}&select=*`); if (!p) return bad(res, 404, 'Payout not found');
    if (p.mode !== 'external_record') return bad(res, 409, 'This payout is made through the provider.'); if (p.status !== 'scheduled') return bad(res, 409, 'Only a scheduled payout can be recorded.');
    if (p.rep_user_id === caller.id) return bad(res, 403, 'You cannot record a payment of your own commission.');
    const method = ['check', 'ach', 'cash', 'wire', 'other'].includes(b.method) ? b.method : null; if (!method) return bad(res, 422, 'Choose how it was paid.');
    const evidence = sanitize(b.evidence, 500); if (evidence.length < 15) return bad(res, 422, 'Record the evidence (reference, date, who confirmed it) — at least 15 characters.');
    const [row] = await dbPatch('sales_payouts', `id=eq.${enc(p.id)}&status=eq.scheduled`, { status: 'paid', paid_at: nowIso(), external_method: method, external_reference: sanitize(b.reference, 120) || null, external_evidence: evidence, recorded_by: caller.id, updated_at: nowIso() }); if (!row) return bad(res, 409, 'Already recorded.');
    const e = await dbOne(`sales_commission_entries?id=eq.${enc(p.entry_id)}&select=*`);
    if (e) await transition(e, 'paid', { actor: caller, actorKind: 'owner', reason: 'Recorded by owner (external payment)', notifyRep: { subject: 'Your commission was paid', body: `Nova recorded a payment of ${(p.amount_cents / 100).toFixed(2)} ${p.currency} (${method}). This was recorded by Nova, not confirmed by a payment provider.`, email: true } });
    await audit(caller, 'sales_payout', p.id, 'payout_recorded_external', { method, evidence }); await refreshBatch(p.batch_id);
    return res.status(200).json({ ok: true, note: 'Recorded from your evidence. This is not a provider confirmation.' });
  }
  if (op === 'retry-failed') {
    if (!need('POST')) return;
    const e = await dbOne(`sales_commission_entries?id=eq.${enc(sanitize(b.entry_id, 60))}&select=*`); if (!e || e.status !== 'failed') return bad(res, 409, 'Only a failed entry can be retried.');
    const row = await transition(e, 'owner_approved', { actor: caller, actorKind: 'owner', reason: 'Retry after failed payout' }); return row ? res.status(200).json({ ok: true }) : bad(res, 409, 'Changed by someone else.');
  }
  if (op === 'resolve-adjustment') {
    if (!need('POST')) return;
    const e = await dbOne(`sales_commission_entries?id=eq.${enc(sanitize(b.entry_id, 60))}&kind=eq.adjustment&select=*`); if (!e || e.status !== 'pending_conditions') return bad(res, 409, 'No open adjustment.');
    const note = sanitize(b.note, 500); if (note.length < 15) return bad(res, 422, 'Record the decision and evidence (at least 15 characters).');
    if (!['waive', 'recovered'].includes(b.resolution)) return bad(res, 422, 'resolution must be waive or recovered.');
    const to = b.resolution === 'recovered' ? 'reversed' : 'cancelled';
    const row = await transition(e, to, { actor: caller, actorKind: 'owner', reason: `${b.resolution}: ${note}` }); return row ? res.status(200).json({ ok: true }) : bad(res, 409, 'Changed by someone else.');
  }
  return bad(res, 400, `Unknown commissions operation: ${op}`);
});
