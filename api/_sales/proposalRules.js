// Pure rules for proposals: pricing from the approved catalog only, totals, prohibited-claim scan, client-visible content hash.
import crypto from 'node:crypto';
import { proposalGate, approvedPrice } from './catalog.js';

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));

export const CLIENT_CONSENT_VERSION = 'client-esign-2026-09-26-draft';
export const CLIENT_CONSENT_TEXT = 'I agree to sign this proposal electronically. My typed name (and drawn signature, if provided) is my signature. This wording is a draft pending review by Nova Systems.';

// Claims Nova's training forbids: guarantees, invented revenue/loss figures, testimonial-for-discount deals.
const PROHIBITED = [
  [/\bguarantee[sd]?\b/i, 'a guarantee'],
  [/\brisk[- ]?free\b/i, '"risk-free"'],
  [/\b100\s?%\s*(satisf|success|results|roi)/i, 'a 100% claim'],
  [/\bwill\s+(definitely\s+)?(increase|double|triple|boost|grow|generate|bring)\b/i, 'a promised result ("will increase/boost/generate")'],
  [/\b(increase|boost|grow|raise|improve)\s+(your\s+)?(revenue|sales|leads|bookings|customers|profit)\s+by\s+\d/i, 'a specific revenue/lead increase'],
  [/\$\s?\d[\d,.]*\s*(k|m|million|thousand)?\s*(a|per|each|every)?\s*(month|year|week)?\s*(in\s+)?(lost|missed|wasted|leaked)\s*(revenue|sales|leads|income|business)/i, 'an invented revenue-loss figure'],
  [/\b(losing|lose|lost)\s+(about\s+|around\s+|roughly\s+|over\s+)?\$\s?\d/i, 'an invented revenue-loss figure'],
  [/\b(testimonial|case study|review)\b[^.]{0,60}\b(in exchange|in return|for a discount|to get|required)\b/i, 'a testimonial-for-discount arrangement'],
  [/\b(in exchange|in return)\b[^.]{0,60}\b(testimonial|case study|review)\b/i, 'a testimonial-for-discount arrangement'],
  [/\bfree\s+(pilot|trial)\b[^.]{0,80}\b(testimonial|review|case study)\b/i, 'a testimonial-required pilot'],
];
export function findProhibitedClaims(...texts) {
  const found = new Set(); const t = texts.filter(Boolean).join('\n');
  for (const [re, label] of PROHIBITED) if (re.test(t)) found.add(label);
  return [...found];
}

// items: [{product_id, quantity}]; products: rows from `products`; exceptions: [{product_id, label}] owner-approved custom scope for THIS deal;
// ownerPrices: { [product_id]: cents } set by the owner for this proposal. Returns { lines, problems, subtotal, unpriced }.
export function buildLineItems({ items, products, exceptions = [], ownerPrices = {} }) {
  const problems = []; const lines = [];
  if (!Array.isArray(items) || !items.length) return { lines, problems: ['Add at least one offering to the proposal.'], subtotal: null, unpriced: 0 };
  const seen = new Set();
  for (const it of items.slice(0, 20)) {
    const p = products.find((x) => x.id === it.product_id);
    if (!p) { problems.push('An offering in the proposal does not exist.'); continue; }
    if (seen.has(p.id)) { problems.push(`${p.name} appears twice.`); continue; } seen.add(p.id);
    const qty = Number(it.quantity ?? 1); if (!Number.isInteger(qty) || qty < 1 || qty > 100) { problems.push(`Quantity for ${p.name} must be a whole number from 1 to 100.`); continue; }
    const gate = proposalGate(p); const exc = exceptions.find((e) => e.product_id === p.id);
    let label = null; let readiness = p.sales_readiness;
    if (!gate.allowed) {
      if (!exc) { problems.push(`${p.name}: ${gate.reason} Ask the owner to approve a custom scope if the client needs it.`); continue; }
      label = `CUSTOM SCOPE — ${exc.label}`;
    } else if (gate.label) label = gate.label;
    const catalog = approvedPrice(p);
    const ownerCents = ownerPrices[p.id];
    const unit = Number.isInteger(ownerCents) && ownerCents > 0 ? ownerCents : catalog ? catalog.unit_price_cents : null;
    lines.push({ product_id: p.id, slug: p.slug, name: p.name, quantity: qty, unit_price_cents: unit, price_source: Number.isInteger(ownerCents) && ownerCents > 0 ? 'owner' : catalog ? 'catalog' : null, billing: catalog?.billing || 'one_time', readiness, label });
  }
  const unpriced = lines.filter((l) => l.unit_price_cents == null).length;
  const subtotal = lines.length && !unpriced ? lines.reduce((s, l) => s + l.unit_price_cents * l.quantity, 0) : null;
  return { lines, problems, subtotal, unpriced };
}
export function totals({ subtotal, discount_cents = 0 }) {
  if (subtotal == null) return { subtotal: null, discount: 0, total: null };
  const discount = Math.max(0, Math.min(Number(discount_cents) || 0, subtotal));
  return { subtotal, discount, total: subtotal - discount };
}
export function validateDiscount({ subtotal, discount_cents, reason }) {
  const d = Number(discount_cents || 0);
  if (!d) return null;
  if (!Number.isInteger(d) || d < 0) return 'The discount must be a whole number of cents.';
  if (subtotal != null && d > subtotal) return 'The discount cannot exceed the subtotal.';
  if (String(reason || '').trim().length < 10) return 'A discount request needs a reason (at least 10 characters).';
  return null;
}
// What the client will see and sign. The hash of this is stored at send time.
export function clientView({ proposal, businessName, contactName, repFirstName }) {
  return { title: proposal.title || 'Proposal from Nova Systems', prepared_for: { business: businessName, contact: contactName }, prepared_by: repFirstName ? `${repFirstName}, Nova Systems` : 'Nova Systems', version: proposal.version, scope_summary: proposal.scope?.summary || '', items: proposal.line_items.map((l) => ({ name: l.name, quantity: l.quantity, unit_price_cents: l.unit_price_cents, line_total_cents: l.unit_price_cents * l.quantity, billing: l.billing, label: l.label })), subtotal_cents: proposal.subtotal_cents, discount_cents: proposal.discount_cents, total_cents: proposal.total_cents, payment_due_cents: proposal.payment_due_cents, payment_terms: proposal.payment_terms || null, currency: proposal.currency };
}
export const proposalHash = (view) => sha(canon(view));
export const proposalSignatureHash = ({ proposalId, contentHash, signerName, signedAt, consentVersion, ip }) => sha(canon({ proposalId, contentHash, signerName, signedAt, consentVersion, ip: ip || null }));
export const tokenHash = (t) => sha(`proposal-token:${t}`);

// Can the rep submit this deal for verification, and with which kind of evidence?
export function submissionKind({ proposal }) {
  if (proposal?.status === 'signed') return { kind: 'system_signature', minEvidence: 10 };
  return { kind: 'rep_supplied', minEvidence: 40 };
}
