// Isaac's Sales Team dashboard numbers, computed from stored rows only. Scoped: a manager sees their own reps; money and commission
// sections are returned only to the owner/admin/finance. Pipeline totals are labelled as NOT revenue.
import { dbGet, enc, inList, isOwner } from './core.js';
import { summarize } from './commissionRules.js';
import { STAGES, OPEN_STAGES } from './pipelineRules.js';
import { documentStatesFor } from './documents.js';

const NONE = '00000000-0000-0000-0000-000000000000';
const by = (rows, k) => rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] || 0) + 1), m), {});

export async function hqDashboard(caller, scopeIds) {
  const roles = caller.roles || [];
  const owner = isOwner(caller) || roles.includes('nova_admin'); const finance = isOwner(caller) || roles.includes('nova_finance'); const now = Date.now();
  const scoped = (col) => (scopeIds ? `&${col}=in.${scopeIds.length ? inList(scopeIds) : `(${NONE})`}` : '');
  const reps = await dbGet(`sales_reps?select=*&order=created_at.desc&limit=500${scoped('user_id')}`);
  const [apps, invs, enrolls, practicals, docs, deals, props, pays, ledger, payouts, badMail, discountQ, verifQ, unassigned] = await Promise.all([
    owner ? dbGet('applications?position=eq.Sales%20Representative&select=status') : [],
    owner ? dbGet('application_invitations?select=status') : [],
    dbGet(`academy_enrollments?select=status,staff_user_id&limit=5000${scoped('staff_user_id')}`),
    dbGet('academy_practical_submissions?status=eq.submitted&select=id'),
    dbGet(`sales_document_requests?select=status,countersigned_at&limit=5000${scoped('signer_user_id')}`),
    dbGet(`crm_deals?pipeline=eq.nova_sales&select=id,stage,assigned_rep_id,next_action_at,updated_at,owner_verified_at&limit=5000${scoped('assigned_rep_id')}`),
    dbGet('crm_proposals?select=id,deal_id,status,total_cents&limit=5000'),
    owner || finance ? dbGet('sales_payments?select=status,method,amount_cents,deal_id&limit=5000') : [],
    finance ? dbGet('sales_commission_entries?select=status,amount_cents,kind&limit=5000') : [],
    finance ? dbGet('sales_payouts?select=status,needs_reconciliation&limit=5000') : [],
    owner ? dbGet('sales_notifications?channel=eq.email&status=in.(failed,bounced)&select=id&limit=500') : [],
    owner ? dbGet('crm_proposals?status=eq.draft&discount_status=eq.requested&select=id') : [],
    owner ? dbGet('sales_deal_verifications?status=eq.submitted&select=id') : [],
    owner && !scopeIds ? dbGet('crm_deals?pipeline=eq.nova_sales&assigned_rep_id=is.null&stage=in.(new,contacted,qualified)&select=id') : [],
  ]);
  const dealIds = new Set(deals.map((d) => d.id)); const open = deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const inPlay = {}; const accepted = {};
  for (const p of props) { if (!dealIds.has(p.deal_id)) continue; if (['sent', 'viewed', 'signed'].includes(p.status)) inPlay[p.deal_id] = p; if (p.status === 'accepted') accepted[p.deal_id] = p; }
  const paid = pays.filter((p) => p.status === 'paid' && dealIds.has(p.deal_id));
  const perRep = reps.map((r) => {
    const mine = deals.filter((d) => d.assigned_rep_id === r.user_id); const mineOpen = mine.filter((d) => OPEN_STAGES.includes(d.stage));
    return { rep_id: r.id, user_id: r.user_id, name: r.display_name, status: r.status, manager_user_id: r.manager_user_id, open_leads: mineOpen.length, overdue_followups: mineOpen.filter((d) => d.next_action_at && new Date(d.next_action_at).getTime() < now).length, verified_sales: mine.filter((d) => d.stage === 'won' && d.owner_verified_at).length, lost: mine.filter((d) => d.stage === 'lost').length, training_completed: enrolls.filter((e) => e.staff_user_id === r.user_id && e.status === 'completed').length };
  });
  return {
    scope: scopeIds ? 'your team' : 'everyone',
    applicants: owner ? { total: apps.length, by_status: by(apps, 'status'), invitations: by(invs, 'status') } : null,
    training: { enrollments_by_status: by(enrolls, 'status'), practical_reviews_waiting: scopeIds ? null : practicals.length, awaiting_review: enrolls.filter((e) => e.status === 'awaiting_practical_review').length },
    documents: { by_status: by(docs, 'status'), awaiting_countersign: docs.filter((d) => d.status === 'signed' && !d.countersigned_at).length },
    reps: { by_status: by(reps, 'status'), per_rep: perRep },
    pipeline: { by_stage: Object.fromEntries(STAGES.map((s) => [s, deals.filter((d) => d.stage === s).length])), open: open.length },
    money: owner || finance ? {
      pipeline_proposed_cents: open.filter((d) => ['proposal', 'awaiting_signature_payment', 'submitted_for_verification'].includes(d.stage)).reduce((s, d) => s + (inPlay[d.id]?.total_cents || 0), 0), pipeline_note: 'Totals of proposals still in play. This is NOT revenue.',
      verified_sales_cents: deals.filter((d) => d.stage === 'won' && d.owner_verified_at).reduce((s, d) => s + (accepted[d.id]?.total_cents || 0), 0),
      collected_provider_confirmed_cents: paid.filter((p) => p.method === 'stripe_checkout').reduce((s, p) => s + p.amount_cents, 0),
      collected_owner_recorded_cents: paid.filter((p) => p.method === 'manual_owner').reduce((s, p) => s + p.amount_cents, 0),
      refunded_or_disputed_cents: pays.filter((p) => ['refunded', 'disputed'].includes(p.status) && dealIds.has(p.deal_id)).reduce((s, p) => s + p.amount_cents, 0),
    } : null,
    commissions: finance ? summarize(ledger.filter((e) => e.kind === 'sale')) : null,
    exceptions: {
      overdue_followups: perRep.reduce((s, r) => s + r.overdue_followups, 0),
      stale_leads_14d: open.filter((d) => now - new Date(d.updated_at).getTime() > 14 * 86400_000).length,
      unassigned_leads: owner && !scopeIds ? unassigned.length : null,
      sales_awaiting_verification: owner ? verifQ.length : null, discount_requests: owner ? discountQ.length : null,
      payout_failures: finance ? payouts.filter((p) => p.status === 'failed').length : null,
      payouts_needing_reconciliation: finance ? payouts.filter((p) => p.needs_reconciliation).length : null,
      open_clawback_adjustments: finance ? ledger.filter((e) => e.kind === 'adjustment' && e.status === 'pending_conditions').length : null,
      email_delivery_problems: owner ? badMail.length : null,
    },
  };
}

// Extra per-representative history for the owner/manager detail screen.
export async function repExtras(rep, caller) {
  const finance = isOwner(caller) || (caller.roles || []).includes('nova_finance');
  const [training, documents, deals, ledger] = await Promise.all([
    dbGet(`academy_enrollments?staff_user_id=eq.${enc(rep.user_id)}&select=status,best_score,practical_approved_at,academy_programs(title,order_index)`),
    documentStatesFor(rep.user_id),
    dbGet(`crm_deals?assigned_rep_id=eq.${enc(rep.user_id)}&pipeline=eq.nova_sales&select=id,stage&limit=2000`),
    finance ? dbGet(`sales_commission_entries?rep_user_id=eq.${enc(rep.user_id)}&order=created_at.desc&select=id,deal_id,kind,status,amount_cents,currency,created_at`) : [],
  ]);
  return { training, documents, leads: { total: deals.length, by_stage: Object.fromEntries(STAGES.map((s) => [s, deals.filter((d) => d.stage === s).length])) }, ledger: finance ? { entries: ledger, summary: summarize(ledger.filter((e) => e.kind === 'sale')) } : null };
}
