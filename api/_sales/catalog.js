// Product sales-readiness, per-offering sales information, approved pricing, audit terms, and the Sales Toolkit.
// Nothing is "available for sale" by default. Reps see what the owner has approved and the readiness label that goes with it.
import { sanitize } from '../_sanitize.js';
import { rateLimit } from '../_rateLimit.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso, audit, bad, wrap, requirePerm, isOwner } from './core.js';

export const READINESS = ['draft', 'internal_test', 'pilot_approved', 'available_for_sale', 'paused'];
export const READINESS_LABELS = { draft: 'Draft', internal_test: 'Internal Test', pilot_approved: 'Pilot Approved', available_for_sale: 'Available for Sale', paused: 'Paused' };
const TOOLKIT_KINDS = ['script', 'email_template', 'sms_template', 'message_template', 'checklist', 'objection', 'faq', 'guide', 'link'];
const INFO_KEYS = ['what_it_is', 'who_for', 'includes', 'excludes', 'prerequisites', 'discovery_questions', 'objections', 'timeline_note'];

// What may a proposal include for a product in this state? (Pure; unit-tested.)
export function proposalGate(product) {
  const r = product.sales_readiness;
  if (r === 'available_for_sale') return { allowed: true, label: null };
  if (r === 'pilot_approved') return product.pilot_terms ? { allowed: true, label: `PILOT — ${product.pilot_terms}`, pilot: true } : { allowed: false, reason: 'This offering is a pilot but has no owner-approved pilot terms yet.' };
  return { allowed: false, reason: r === 'paused' ? 'This offering is paused and cannot be proposed.' : `This offering is "${READINESS_LABELS[r]}" and is not available to sell.` };
}
export const approvedPrice = (p) => (p.pricing_approved && Number.isInteger(p.pricing_config?.unit_price_cents) && p.pricing_config.unit_price_cents > 0 ? { unit_price_cents: p.pricing_config.unit_price_cents, billing: p.pricing_config.billing || 'one_time' } : null);

const cleanInfo = (x = {}) => Object.fromEntries(INFO_KEYS.map((k) => [k, Array.isArray(x[k]) ? x[k].map((s) => sanitize(s, 400)).filter(Boolean).slice(0, 30) : sanitize(x[k], 1500)]).filter(([, v]) => (Array.isArray(v) ? v.length : v)));

export const handleCatalog = wrap(async (req, res, op) => {
  const b = req.body || {};
  const need = (m) => { if (req.method !== m) { bad(res, 405, 'Method not allowed'); return false; } return true; };
  const ownerOps = ['set-readiness', 'save-info', 'review-info', 'set-pricing', 'toolkit-save', 'toolkit-approve', 'toolkit-retire', 'save-audit-terms', 'approve-audit-terms'];
  const caller = await requirePerm(req, res, ownerOps.includes(op) ? 'sales.owner' : 'sales.onboarding'); if (!caller) return;
  if (!rateLimit(req, res, 90, 60_000)) return;
  const owner = isOwner(caller);
  const workspaceRole = owner || caller.roles.some((r) => ['nova_sales', 'nova_sales_manager', 'nova_admin'].includes(r));
  if (!ownerOps.includes(op) && !workspaceRole) return bad(res, 403, 'This is available once your account is activated.'); // candidates do not get the live toolkit/catalog

  if (op === 'products') {
    const rows = await dbGet('products?select=id,slug,name,category,description,sales_readiness,pilot_terms,sales_info,sales_info_reviewed,pricing_approved,pricing_config,version&order=category.asc,name.asc');
    return res.status(200).json({ readiness_labels: READINESS_LABELS, products: rows.map((p) => ({ id: p.id, slug: p.slug, name: p.name, category: p.category, description: p.description, readiness: p.sales_readiness, readiness_label: READINESS_LABELS[p.sales_readiness], pilot_terms: p.sales_readiness === 'pilot_approved' ? p.pilot_terms : null, info: p.sales_info_reviewed || owner ? p.sales_info : null, info_reviewed: p.sales_info_reviewed, price: approvedPrice(p), price_note: approvedPrice(p) ? null : 'No approved price yet. Do not quote one — ask your manager.', can_propose: proposalGate(p).allowed, propose_blocked_reason: proposalGate(p).reason || null })) });
  }
  if (op === 'audit-terms') {
    const approved = await dbOne('sales_config?key=eq.audit_terms&status=eq.approved&select=value,version,approved_at');
    const pending = owner ? await dbOne('sales_config?key=eq.audit_terms&status=in.(draft,pending_approval)&order=version.desc&select=*') : null;
    return res.status(200).json({ approved: approved ? approved.value : null, note: approved ? null : 'The audit turnaround has not been confirmed by Nova. Do not promise any timeline.', ...(owner ? { pending } : {}) });
  }
  if (op === 'toolkit') {
    let q = 'sales_toolkit_items?order=kind.asc,title.asc&select=*';
    if (!owner) q += '&status=eq.approved'; else if (req.query?.status) q += `&status=eq.${enc(sanitize(req.query.status, 20))}`;
    if (req.query?.kind) q += `&kind=eq.${enc(sanitize(req.query.kind, 30))}`;
    return res.status(200).json(await dbGet(q));
  }

  // ------------------------------------------------------------------ owner
  if (op === 'set-readiness') {
    if (!need('POST')) return;
    const p = await dbOne(`products?id=eq.${enc(sanitize(b.product_id, 60))}&select=*`); if (!p) return bad(res, 404, 'Product not found');
    const to = sanitize(b.to, 30); if (!READINESS.includes(to)) return bad(res, 422, 'Unknown readiness state.');
    const reason = sanitize(b.reason, 500); if (reason.length < 5) return bad(res, 422, 'Record why.');
    if (to === 'available_for_sale') {
      if (!p.sales_info_reviewed) return bad(res, 422, 'Review and confirm the sales information first.');
      if (!approvedPrice(p)) return bad(res, 422, 'An offering cannot be Available for Sale without an approved price.');
    }
    if (to === 'pilot_approved') { const terms = sanitize(b.pilot_terms, 800) || p.pilot_terms; if (!terms) return bad(res, 422, 'Write the pilot terms reps must use (scope, limits, what is and is not promised).'); b.pilot_terms = terms; }
    if (to === p.sales_readiness) return bad(res, 409, 'Already in that state.');
    const [row] = await dbPatch('products', `id=eq.${enc(p.id)}`, { sales_readiness: to, ...(to === 'pilot_approved' ? { pilot_terms: b.pilot_terms } : {}) });
    await dbInsert('sales_product_readiness_history', { product_id: p.id, from_state: p.sales_readiness, to_state: to, changed_by: caller.id, reason });
    await audit(caller, 'product', p.id, 'sales_readiness_changed', { from: p.sales_readiness, to, reason });
    return res.status(200).json({ ok: true, readiness: row.sales_readiness });
  }
  if (op === 'save-info') {
    if (!need('POST')) return;
    const [row] = await dbPatch('products', `id=eq.${enc(sanitize(b.product_id, 60))}`, { sales_info: cleanInfo(b.info), sales_info_reviewed: false });
    if (!row) return bad(res, 404, 'Product not found');
    await audit(caller, 'product', row.id, 'sales_info_saved', {}); return res.status(200).json({ ok: true, note: 'Saved as unreviewed. Confirm the review before reps can see it.' });
  }
  if (op === 'review-info') {
    if (!need('POST')) return;
    if (b.confirm !== true) return bad(res, 422, 'Confirm that you have reviewed this information for accuracy.');
    const p = await dbOne(`products?id=eq.${enc(sanitize(b.product_id, 60))}&select=id,sales_info`); if (!p) return bad(res, 404, 'Product not found');
    if (!p.sales_info?.what_it_is) return bad(res, 422, 'Add at least a description of what it is.');
    await dbPatch('products', `id=eq.${enc(p.id)}`, { sales_info_reviewed: true }); await audit(caller, 'product', p.id, 'sales_info_reviewed', {});
    return res.status(200).json({ ok: true });
  }
  if (op === 'set-pricing') {
    if (!need('POST')) return;
    if (b.confirm !== true) return bad(res, 422, 'Confirm that this is the price Nova has decided to charge.');
    const cents = Number(b.unit_price_cents); if (!Number.isInteger(cents) || cents < 100 || cents > 100_000_000) return bad(res, 422, 'Enter the price in cents (a whole number).');
    const billing = ['one_time', 'monthly'].includes(b.billing) ? b.billing : null; if (!billing) return bad(res, 422, 'Choose one_time or monthly.');
    const [row] = await dbPatch('products', `id=eq.${enc(sanitize(b.product_id, 60))}`, { pricing_config: { unit_price_cents: cents, billing }, pricing_approved: true });
    if (!row) return bad(res, 404, 'Product not found');
    await audit(caller, 'product', row.id, 'pricing_approved', { unit_price_cents: cents, billing }); return res.status(200).json({ ok: true });
  }
  if (op === 'toolkit-save') {
    if (!need('POST')) return;
    const kind = sanitize(b.kind, 30); if (!TOOLKIT_KINDS.includes(kind)) return bad(res, 422, 'Unknown item type.');
    const title = sanitize(b.title, 160); const body = String(b.body || '').slice(0, 20000); if (title.length < 3 || body.trim().length < 10) return bad(res, 422, 'A title and content are required.');
    const fields = { kind, title, body, program_slug: sanitize(b.program_slug, 80) || null, product_slug: sanitize(b.product_slug, 80) || null, compliance_note: sanitize(b.compliance_note, 500) || null, updated_at: nowIso() };
    if (b.id) {
      const it = await dbOne(`sales_toolkit_items?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!it) return bad(res, 404, 'Item not found');
      if (it.status === 'draft') { const [row] = await dbPatch('sales_toolkit_items', `id=eq.${enc(it.id)}&status=eq.draft`, fields); return res.status(200).json({ ok: true, item: row }); }
      const ins = await dbInsert('sales_toolkit_items', { ...fields, version: it.version + 1, status: 'draft', created_by: caller.id }); // editing an approved item makes a new draft; the approved one stays live until the new one is approved
      return res.status(200).json({ ok: true, item: ins.row, note: 'Saved as a new draft version. The approved version stays live until you approve this one.' });
    }
    const ins = await dbInsert('sales_toolkit_items', { ...fields, status: 'draft', created_by: caller.id }); return res.status(200).json({ ok: true, item: ins.row });
  }
  if (op === 'toolkit-approve') {
    if (!need('POST')) return;
    if (b.confirm !== true) return bad(res, 422, 'Confirm that you have reviewed this item (accuracy, no invented figures or guarantees, compliant with contact rules).');
    const it = await dbOne(`sales_toolkit_items?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!it) return bad(res, 404, 'Item not found');
    if (it.status !== 'draft') return bad(res, 409, 'Only a draft can be approved.');
    const [row] = await dbPatch('sales_toolkit_items', `id=eq.${enc(it.id)}&status=eq.draft`, { status: 'approved', approved_by: caller.id, approved_at: nowIso() });
    if (!row) return bad(res, 409, 'Someone else changed this item.');
    await dbPatch('sales_toolkit_items', `title=eq.${enc(it.title)}&kind=eq.${enc(it.kind)}&status=eq.approved&id=neq.${enc(it.id)}`, { status: 'retired' });
    await audit(caller, 'toolkit_item', it.id, 'approved', { title: it.title, version: it.version }); return res.status(200).json({ ok: true });
  }
  if (op === 'toolkit-retire') {
    if (!need('POST')) return;
    const [row] = await dbPatch('sales_toolkit_items', `id=eq.${enc(sanitize(b.id, 60))}&status=neq.retired`, { status: 'retired', updated_at: nowIso() }); if (!row) return bad(res, 404, 'Item not found');
    await audit(caller, 'toolkit_item', row.id, 'retired', {}); return res.status(200).json({ ok: true });
  }
  if (op === 'save-audit-terms') {
    if (!need('POST')) return;
    const min = Number(b.turnaround_min_hours), max = Number(b.turnaround_max_hours); const statement = sanitize(b.statement, 500);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min || max > 24 * 30) return bad(res, 422, 'Enter a valid turnaround range in hours.');
    if (statement.length < 10) return bad(res, 422, 'Write the exact sentence reps may use.');
    const last = await dbOne('sales_config?key=eq.audit_terms&order=version.desc&select=version');
    const ins = await dbInsert('sales_config', { key: 'audit_terms', version: (last?.version || 0) + 1, status: 'pending_approval', value: { turnaround_min_hours: min, turnaround_max_hours: max, statement }, created_by: caller.id });
    await audit(caller, 'audit_terms', ins.row.id, 'proposed', ins.row.value); return res.status(200).json({ ok: true, config: ins.row });
  }
  if (op === 'approve-audit-terms') {
    if (!need('POST')) return;
    const cfg = await dbOne(`sales_config?id=eq.${enc(sanitize(b.config_id, 60))}&key=eq.audit_terms&select=*`); if (!cfg) return bad(res, 404, 'Not found');
    if (cfg.value.turnaround_min_hours == null) return bad(res, 422, 'This version has no turnaround values.');
    if (cfg.status !== 'approved') { await dbPatch('sales_config', 'key=eq.audit_terms&status=eq.approved', { status: 'retired' }); await dbPatch('sales_config', `id=eq.${enc(cfg.id)}`, { status: 'approved', approved_by: caller.id, approved_at: nowIso() }); await audit(caller, 'audit_terms', cfg.id, 'approved', cfg.value); }
    return res.status(200).json({ ok: true });
  }
  return bad(res, 400, `Unknown catalog operation: ${op}`);
});
