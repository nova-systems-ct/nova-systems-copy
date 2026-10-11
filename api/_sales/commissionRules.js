// Pure commission rules: plan validation, calculation from a verified proposal, eligibility conditions, batch approval hash. No I/O.
// There are NO default rates here. A plan exists only when the owner writes and approves one.
import crypto from 'node:crypto';

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));

// value: { rules: [{ product_slug: '*'|slug, type: 'percent'|'flat', percent_bp?, flat_cents? }], conditions: { require_payment_received, holdback_days } }
export function normalizePlan(v = {}) {
  const rules = (Array.isArray(v.rules) ? v.rules : []).slice(0, 40).map((r) => {
    const slug = String(r?.product_slug || '*').toLowerCase().replace(/[^a-z0-9*_-]/g, '').slice(0, 80) || '*';
    if (r?.type === 'percent') return { product_slug: slug, type: 'percent', percent_bp: Number(r.percent_bp) };
    if (r?.type === 'flat') return { product_slug: slug, type: 'flat', flat_cents: Number(r.flat_cents) };
    return { product_slug: slug, type: 'invalid' };
  });
  const hb = Math.round(Number(v.conditions?.holdback_days ?? 0));
  return { rules, conditions: { require_payment_received: v.conditions?.require_payment_received !== false, holdback_days: Number.isFinite(hb) ? Math.max(0, Math.min(365, hb)) : 0 }, currency: 'USD', note: String(v.note || '').slice(0, 500) };
}
export function planProblems(p) {
  const e = [];
  if (!p.rules.length) e.push('Add at least one commission rule.');
  for (const [i, r] of p.rules.entries()) {
    if (r.type === 'invalid') e.push(`Rule ${i + 1}: choose percent or flat.`);
    else if (r.type === 'percent' && !(Number.isInteger(r.percent_bp) && r.percent_bp >= 0 && r.percent_bp <= 10000)) e.push(`Rule ${i + 1}: percent must be between 0 and 100 (in basis points, 0–10000).`);
    else if (r.type === 'flat' && !(Number.isInteger(r.flat_cents) && r.flat_cents >= 0 && r.flat_cents <= 100_000_000)) e.push(`Rule ${i + 1}: flat amount must be a whole number of cents.`);
  }
  const slugs = p.rules.map((r) => r.product_slug); if (new Set(slugs).size !== slugs.length) e.push('Each offering (or "*") may have only one rule.');
  return e;
}
// Allocate the discount across lines proportionally (integer cents; remainder to the last line) so per-offering rules see net amounts.
export function netLines(lines, discountCents = 0) {
  const sub = lines.reduce((s, l) => s + l.unit_price_cents * l.quantity, 0); let left = Math.max(0, Math.min(discountCents, sub));
  return lines.map((l, i) => { const gross = l.unit_price_cents * l.quantity; const share = i === lines.length - 1 ? left : Math.round((discountCents * gross) / (sub || 1)); const d = Math.min(share, left, gross); left -= d; return { ...l, gross, net: gross - d }; });
}
export function computeCommission({ plan, lines, discountCents = 0 }) {
  const rows = netLines(lines, discountCents); let total = 0; const detail = [];
  for (const l of rows) {
    const rule = plan.rules.find((r) => r.product_slug === l.slug) || plan.rules.find((r) => r.product_slug === '*');
    if (!rule) { detail.push({ slug: l.slug, net: l.net, commission: 0, rule: null }); continue; }
    const c = rule.type === 'percent' ? Math.round((l.net * rule.percent_bp) / 10000) : rule.flat_cents * l.quantity;
    detail.push({ slug: l.slug, net: l.net, commission: c, rule }); total += c;
  }
  return { basis_cents: rows.reduce((s, l) => s + l.net, 0), amount_cents: total, detail };
}
// Conditions for moving pending_conditions → eligible. Returns { met, waitingFor:[...], eligibleAfter }
export function conditionsState({ snapshot, paymentReceivedAt, now = new Date() }) {
  const c = snapshot?.conditions || { require_payment_received: true, holdback_days: 0 }; const waiting = []; let eligibleAfter = null;
  if (c.require_payment_received) {
    if (!paymentReceivedAt) waiting.push('client payment not yet received');
    else eligibleAfter = new Date(new Date(paymentReceivedAt).getTime() + c.holdback_days * 86400_000);
  } else if (c.holdback_days) eligibleAfter = new Date(now.getTime() + c.holdback_days * 86400_000);
  if (eligibleAfter && eligibleAfter > now) waiting.push(`hold-back period until ${eligibleAfter.toISOString().slice(0, 10)}`);
  return { met: waiting.length === 0, waitingFor: waiting, eligibleAfter };
}
export const STATUS_LABELS = { estimated: 'Estimated', pending_conditions: 'Pending Conditions', eligible: 'Eligible', owner_approved: 'Owner Approved', scheduled: 'Scheduled', paid: 'Paid', failed: 'Failed', reversed: 'Reversed', cancelled: 'Cancelled' };
export const TERMINAL = new Set(['paid', 'reversed', 'cancelled']);
// Totals by status — estimates are NEVER folded into anything the rep might read as "earned".
export function summarize(entries) {
  const by = Object.fromEntries(Object.keys(STATUS_LABELS).map((s) => [s, { count: 0, cents: 0 }]));
  for (const e of entries) { by[e.status].count++; by[e.status].cents += e.amount_cents; }
  return { by_status: by, estimated_not_earned_cents: by.estimated.cents, pending_cents: by.pending_conditions.cents, eligible_cents: by.eligible.cents + by.owner_approved.cents + by.scheduled.cents, paid_cents: by.paid.cents };
}
export const batchApprovalHash = (items) => sha(canon(items.map((i) => ({ entry_id: i.entry_id, rep: i.rep_user_id, cents: i.amount_cents })).sort((a, b) => a.entry_id.localeCompare(b.entry_id))));
export const csvCell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
