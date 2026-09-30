// Nova organizational hierarchy — the ONE reusable server-side authority check.
//
// checkAuthority() evaluates a requested action against everything Nova's governance layer
// actually knows: the currently-APPROVED Authority Matrix (sales_config['authority_matrix'] —
// unapproved/no matrix fails closed), kill switches (global, and worker-scoped if a worker is
// acting), the actor's authority level (derived from their organization_members role), and — when
// the actor is a registered worker — their operating contract's real spending limit and data
// clearance. It never widens what a caller may do: it is a NARROWING check layered on top of
// whatever a specific handler already enforces, never a replacement for it. A handler that already
// has its own, stronger, specific authorization logic (proposals, payouts, documents, ...) keeps
// that logic exactly as-is; this function is an ADDITIONAL gate available to call before or after
// it, not instead of it.
//
// Documented integration points for modules NOT yet wired to this function (each is a real,
// independently-authorized system already — this is deliberately not implemented there in this
// pass, to avoid destabilizing tested, working authorization code under time pressure):
//   - api/_sales/proposals.js (discount/pricing approval) — call checkAuthority({ actor, action:
//     'change_pricing', amountCents: discountCents }) before allowing a rep-entered custom price.
//   - api/_sales/payments.js / commissions.js (payouts) — checkAuthority({ actor, action:
//     'transfer_money', amountCents }) before releasing a payout batch.
//   - api/_sales/documents.js (contract signing) — checkAuthority({ actor, action: 'sign_contract' }).
//   - a future marketing-publication handler — checkAuthority({ actor, action: 'publish_public_content' }).
//   - a future communications/outreach handler — checkAuthority({ actor, action: 'contact_real_prospect' }
//     or 'send_bulk_communications').
//   - deployment tooling — checkAuthority({ actor, action: 'change_production_security' }).
//   - api/team.js (role/permission grants) — checkAuthority({ actor, action: 'increase_agent_permissions' }).
// Wired INTO this pass: api/_hierarchy/workitems.js (create-work-item -> 'create_internal_task',
// assign-work-item -> 'reassign_routine_task', set-venture-stage closing a venture ->
// 'close_venture_experiment').
import { dbOne } from '../_sales/core.js';
import { authoritySufficient, authorityLevelForRoles, killSwitchBlocks } from './rules.js';
import { killSwitchStateFor } from './governance.js';

export async function checkAuthority({ actor, action, workerId = null, amountCents = null, dataClassification = null }) {
  const cfg = await dbOne("sales_config?key=eq.authority_matrix&status=eq.approved&select=value");
  if (!cfg) return { allowed: false, reason: 'No approved Authority Matrix exists yet — nothing can be authorized through it.', label: null };
  const label = cfg.value?.[action];
  if (!label) return { allowed: false, reason: `No Authority Matrix entry exists for action "${action}".`, label: null };
  if (label === 'prohibited') return { allowed: false, reason: `"${action}" is marked prohibited in the approved Authority Matrix.`, label };

  const worker = workerId ? await dbOne(`workers?id=eq.${encodeURIComponent(workerId)}&select=*`) : null;
  const killed = killSwitchBlocks(await killSwitchStateFor(worker));
  if (killed.blocked) return { allowed: false, reason: `Blocked by a kill switch at the ${killed.scope} level.`, label };

  const actorLevel = authorityLevelForRoles(actor?.roles || []);
  if (!authoritySufficient(actorLevel, label)) return { allowed: false, reason: `"${action}" requires authority level for "${label}"; this account's role does not meet it.`, label, actorLevel };

  if (worker && amountCents != null && worker.spending_limit_cents != null && amountCents > worker.spending_limit_cents) {
    return { allowed: false, reason: `Amount ($${(amountCents / 100).toFixed(2)}) exceeds this worker's approved spending limit ($${(worker.spending_limit_cents / 100).toFixed(2)}).`, label };
  }
  if (worker && dataClassification) {
    const RANK = { public: 0, internal: 1, confidential: 2, restricted: 3 };
    if ((RANK[dataClassification] ?? 0) > (RANK[worker.data_classification] ?? 1)) {
      return { allowed: false, reason: `This action touches ${dataClassification} data, above this worker's ${worker.data_classification} clearance.`, label };
    }
  }
  return { allowed: true, label, actorLevel };
}
