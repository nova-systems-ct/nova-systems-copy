// Workforce role decisions (owner brief 2026-10-30 §11). Deterministic: scheduling, calculations and approval routing
// are code; nothing here calls a model, moves money or sends a message.

const DAY = 86400_000;

// CFO: may this expense go ahead? Uses only an owner-entered or connected balance with its "as of" date, subtracts
// commitments, and applies the owner's policy. Without a current balance the answer is "unknown", never a guess.
export function cfoDecision({ amountCents, balance, commitmentsCents = 0, spentThisMonthCents = 0, prefs = {}, now = new Date() }) {
  const reasons = []; const freshDays = Number(prefs.balance_freshness_days) || 7;
  if (!balance) return { decision: 'needs_owner', recommendation: 'unknown', available_cents: null, reasons: ['No balance on record: available funds are unknown. Enter a current balance (or connect an account) for the CFO to check.'] };
  const ageDays = Math.floor((now - new Date(balance.as_of)) / DAY);
  if (ageDays > freshDays) return { decision: 'needs_owner', recommendation: 'unknown', available_cents: null, reasons: [`The latest balance is ${ageDays} days old (limit ${freshDays}); available funds are unknown until it is updated.`] };
  const available = Number(balance.balance_cents) - Number(commitmentsCents || 0);
  reasons.push(`Available: ${available} cents (balance as of ${String(balance.as_of).slice(0, 10)} minus ${commitmentsCents} cents committed).`);
  if (amountCents > available) return { decision: 'needs_owner', recommendation: 'deny', available_cents: available, reasons: [...reasons, 'The amount is more than the available funds.'] };
  const auto = Number(prefs.auto_approve_cents) || 0; const budget = prefs.monthly_budget_cents == null ? null : Number(prefs.monthly_budget_cents);
  if (budget != null && spentThisMonthCents + amountCents > budget) return { decision: 'needs_owner', recommendation: 'approve', available_cents: available, reasons: [...reasons, `It would exceed the monthly budget (${spentThisMonthCents} spent + ${amountCents} > ${budget}).`] };
  if (!auto) return { decision: 'needs_owner', recommendation: 'approve', available_cents: available, reasons: [...reasons, 'No automatic approval limit is set by the owner, so the owner decides.'] };
  if (amountCents > auto) return { decision: 'needs_owner', recommendation: 'approve', available_cents: available, reasons: [...reasons, `Above the owner's automatic approval limit (${auto} cents).`] };
  if (budget == null) return { decision: 'needs_owner', recommendation: 'approve', available_cents: available, reasons: [...reasons, 'No monthly budget is set, so automatic approval does not apply.'] };
  return { decision: 'approved_by_policy', recommendation: 'approve', available_cents: available, reasons: [...reasons, `Within the owner's automatic approval limit (${auto} cents) and monthly budget.`] };
}

// COO: which failed jobs may be put back in the queue. Only repeatable maintenance work; never anything that sends,
// charges or books; never a dead-lettered job; at most once a day per job (bounded recovery).
const SAFE_RETRY = new Set(['ops_sentry_sweep', 'ops_scoreboard_tick', 'hierarchy_work_item_check', 'sales_maintenance', 'role_ea_brief', 'role_coo_check', 'role_cfo_review', 'role_cmo_review']);
export function cooRetry(job, { now = new Date() } = {}) {
  if (job.status !== 'failed') return { retry: false, reason: `status ${job.status}` };
  if (!SAFE_RETRY.has(job.job_type)) return { retry: false, reason: `${job.job_type} can send, charge or book; a person decides` };
  if (job.payload?.coo_retried_at && now - new Date(job.payload.coo_retried_at) < DAY) return { retry: false, reason: 'already retried by the COO in the last 24 hours' };
  if (Number(job.attempts) >= Number(job.max_attempts)) return { retry: false, reason: 'no attempts left' };
  return { retry: true, reason: 'repeatable maintenance job' };
}

// Executive assistant: what the owner should look at first. Customer escalations, then money, then approvals and
// reviews, then overdue work; oldest first within each. Anything older than the owner's limit is escalated.
const WEIGHT = { escalation: 0, expense: 1, approval: 2, review: 3, overdue: 4, blocked: 5 };
export function eaPrioritize(items, prefs = {}, now = new Date()) {
  const limitH = Number(prefs.escalate_after_hours) || 24;
  return [...items]
    .map((x) => ({ ...x, waited_hours: Math.max(0, Math.floor((now - new Date(x.since)) / 3600_000)) }))
    .sort((a, b) => (WEIGHT[a.kind] ?? 9) - (WEIGHT[b.kind] ?? 9) || b.waited_hours - a.waited_hours)
    .map((x) => ({ ...x, escalate: x.waited_hours >= limitH }));
}

// CMO: proposals from real records. Revive for stalled inquiries; campaign performance from recorded sends, replies and
// bookings; an expense only for the test budget the owner set (never an invented amount).
export function cmoProposals({ stalled = 0, optedOut = 0, campaigns = [], prefs = {} }) {
  const proposals = []; const notes = [];
  if (stalled > 0) proposals.push({ kind: 'revive', title: `Revive ${stalled} stalled inquir${stalled === 1 ? 'y' : 'ies'}`, detail: `${stalled} inquiries had no reply or booking for 7+ days${optedOut ? ` (${optedOut} opted out and excluded)` : ''}. Eligibility is re-checked when each message is sent.` });
  else notes.push('No stalled inquiries to revive.');
  const performance = campaigns.map((c) => ({ name: c.name, sent: c.sent, replied: c.replied, booked: c.booked, reply_rate: c.sent ? Math.round((c.replied / c.sent) * 100) / 100 : null, booking_rate: c.sent ? Math.round((c.booked / c.sent) * 100) / 100 : null }));
  if (!campaigns.length) notes.push('No campaign has sent anything yet, so there is no performance to report.');
  const budget = Number(prefs.cmo_test_budget_cents) || 0;
  const expense = budget > 0 ? { amount_cents: budget, purpose: 'Small paid test for the next approved campaign (owner test budget)', category: 'marketing' } : null;
  if (!expense) notes.push('No test budget is set by the owner, so no expense is proposed.');
  return { proposals, performance, expense, notes };
}
