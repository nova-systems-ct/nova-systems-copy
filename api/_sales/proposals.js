// Proposals, client signature, sale submission/verification and fulfillment handoff.
// Reps can build and send proposals, but cannot: set prices, approve their own discount, mark a signature or payment genuine,
// or mark a sale won. Those are server-recorded facts or owner decisions (see api/_sales/payments.js and the verify op below).
import { sanitize } from '../_sanitize.js';
import { rateLimit } from '../_rateLimit.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, inList, nowIso, audit, bad, wrap, requirePerm, requireActiveRep, isOwner, visibleRepUserIds, displayNameOf, notify, notifyOwners, novaOrgId, randomToken, appBase, emailPolicy } from './core.js';
import { loadDealFor, applyStage } from './leads.js';
import { runHooks, createCheckoutForProposal, stripeAllowed } from './payments.js';
import { buildLineItems, totals, validateDiscount, findProhibitedClaims, clientView, proposalHash, proposalSignatureHash, tokenHash, submissionKind, CLIENT_CONSENT_VERSION, CLIENT_CONSENT_TEXT } from './proposalRules.js';
import { validateTypedName, validateSignatureImage } from './documentRules.js';

const clientIp = (req) => String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim().slice(0, 64) || null;
const REP_PROPOSAL_FIELDS = 'id,deal_id,version,status,title,scope,line_items,subtotal_cents,discount_cents,discount_reason,discount_status,total_cents,payment_due_cents,currency,sent_at,viewed_at,signed_at,signer_name,declined_at,decline_reason,token_expires_at,created_at';

async function ownerPricesFor(proposalId) {
  const p = proposalId ? await dbOne(`crm_proposals?id=eq.${enc(proposalId)}&select=line_items`) : null;
  return Object.fromEntries((p?.line_items || []).filter((l) => l.price_source === 'owner').map((l) => [l.product_id, l.unit_price_cents]));
}
export function blockersFor(p) {
  const b = [];
  if (!p.line_items?.length) b.push('No offerings on the proposal.');
  if (p.line_items?.some((l) => l.unit_price_cents == null)) b.push('One or more offerings have no approved price. Ask the owner to set the price.');
  if (p.discount_cents > 0 && p.discount_status !== 'approved') b.push(p.discount_status === 'denied' ? 'The discount was denied. Remove it to send.' : 'The discount is waiting for the owner.');
  return b;
}
async function context(deal) {
  const [business, contact] = await Promise.all([deal.business_id ? dbOne(`businesses?id=eq.${enc(deal.business_id)}&select=id,name`) : null, deal.contact_id ? dbOne(`crm_contacts?id=eq.${enc(deal.contact_id)}&select=id,name,email,do_not_contact`) : null]);
  return { business, contact };
}
async function repFirstName(userId) { const n = await displayNameOf(userId); return String(n || '').split(/[\s@]/)[0] || null; }

async function priceAndSave({ deal, body, existing, actor }) {
  const [products, exceptions, ownerPrices] = await Promise.all([dbGet('products?select=id,slug,name,version,sales_readiness,pilot_terms,pricing_approved,pricing_config'), dbGet(`sales_scope_exceptions?deal_id=eq.${enc(deal.id)}&select=product_id,label`), ownerPricesFor(existing?.id)]);
  const built = buildLineItems({ items: body.items, products, exceptions, ownerPrices });
  if (built.problems.length) return { status: 422, error: built.problems[0], problems: built.problems };
  const summary = sanitize(body.scope_summary, 3000); const title = sanitize(body.title, 160) || null;
  if (summary.length < 30) return { status: 422, error: 'Describe the scope in your own words, based on what you learned in discovery (at least 30 characters).' };
  const claims = findProhibitedClaims(summary, title, body.discount_reason);
  if (claims.length) return { status: 422, error: `The proposal text contains ${claims.join(', ')}. Nova does not allow promises of results or invented figures. Reword it.`, claims };
  const discount = Number(body.discount_cents || 0); const dErr = validateDiscount({ subtotal: built.subtotal, discount_cents: discount, reason: body.discount_reason }); if (dErr) return { status: 422, error: dErr };
  const t = totals({ subtotal: built.subtotal, discount_cents: discount });
  const discountChanged = !existing || existing.discount_cents !== t.discount || existing.discount_reason !== (sanitize(body.discount_reason, 500) || null);
  const row = { title, scope: { summary }, line_items: built.lines, subtotal_cents: t.subtotal, discount_cents: t.discount, discount_reason: t.discount ? sanitize(body.discount_reason, 500) : null, total_cents: t.total, payment_due_cents: t.total, price_cents: t.total, currency: 'USD',
    discount_status: t.discount ? (discountChanged ? 'requested' : existing.discount_status) : 'none', ...(t.discount && discountChanged ? { discount_decided_by: null, discount_decided_at: null } : {}) };
  return { row, discountRequested: !!t.discount && discountChanged };
}

export const handleProposals = wrap(async (req, res, op) => {
  const b = req.body || {};
  const need = (m) => { if (req.method !== m) { bad(res, 405, 'Method not allowed'); return false; } return true; };
  const repOps = ['create', 'update-draft', 'send', 'resend-link', 'recall', 'for-deal', 'submit-for-verification'];
  const ownerOps = ['queue', 'decide-discount', 'owner-set-price', 'approve-custom-scope', 'verify', 'mark-fulfillment-started', 'retry-handoff'];
  const isRep = repOps.includes(op);
  const caller = isRep ? await requireActiveRep(req, res) : await requirePerm(req, res, ownerOps.includes(op) ? 'sales.owner' : 'sales.manage');
  if (!caller) return;
  if (!rateLimit(req, res, 90, 60_000)) return;
  const org = await novaOrgId();

  // ================================================================== representative
  if (op === 'for-deal') {
    const r = await loadDealFor(caller, req.query?.deal_id); if (r.error) return bad(res, r.status, r.error);
    const rows = await dbGet(`crm_proposals?deal_id=eq.${enc(r.deal.id)}&order=version.desc&select=${REP_PROPOSAL_FIELDS}`);
    const pays = await dbGet(`sales_payments?deal_id=eq.${enc(r.deal.id)}&order=created_at.desc&select=id,status,amount_cents,currency,method,paid_at`);
    const ver = await dbGet(`sales_deal_verifications?deal_id=eq.${enc(r.deal.id)}&order=submitted_at.desc&select=id,status,submitted_at,reviewed_at,review_notes,evidence_kind`);
    return res.status(200).json({ proposals: rows.map((p) => ({ ...p, blockers: ['draft', 'pending_approval'].includes(p.status) ? blockersFor(p) : [] })), payments: pays.map((p) => ({ ...p, confirmation: p.method === 'manual_owner' ? 'recorded by Nova (not provider-confirmed)' : p.status === 'paid' ? 'confirmed by payment provider' : 'awaiting provider' })), verifications: ver, milestones: { rep_reported_close_at: r.deal.rep_reported_close_at, signed_agreement_at: r.deal.signed_agreement_at, invoice_issued_at: r.deal.invoice_issued_at, payment_received_at: r.deal.payment_received_at, owner_verified_at: r.deal.owner_verified_at, fulfillment_started_at: r.deal.fulfillment_started_at }, payments_provider_ready: stripeAllowed().ok });
  }

  if (op === 'create' || op === 'update-draft') {
    if (!need('POST')) return;
    const r = await loadDealFor(caller, b.deal_id); if (r.error) return bad(res, r.status, r.error);
    const deal = r.deal; let existing = null;
    if (op === 'update-draft') { existing = await dbOne(`crm_proposals?id=eq.${enc(sanitize(b.proposal_id, 60))}&deal_id=eq.${enc(deal.id)}&select=*`); if (!existing) return bad(res, 404, 'Proposal not found'); if (existing.status !== 'draft') return bad(res, 409, 'Only a draft can be edited. Create a new version instead.'); }
    else if (!['discovery_completed', 'proposal'].includes(deal.stage)) return bad(res, 409, 'Complete discovery before writing a proposal — this lead is in "' + deal.stage + '".');
    const { contact } = await context(deal);
    if (!contact) return bad(res, 409, 'Add the contact who will receive the proposal first.');
    const out = await priceAndSave({ deal, body: b, existing, actor: caller }); if (out.error) return res.status(out.status).json({ error: out.error, problems: out.problems, claims: out.claims });
    let prop;
    if (existing) { [prop] = await dbPatch('crm_proposals', `id=eq.${enc(existing.id)}&status=eq.draft`, out.row); }
    else {
      const last = await dbOne(`crm_proposals?deal_id=eq.${enc(deal.id)}&order=version.desc&select=version`);
      await dbPatch('crm_proposals', `deal_id=eq.${enc(deal.id)}&status=eq.draft`, { status: 'superseded' });
      const ins = await dbInsert('crm_proposals', { organization_id: org, deal_id: deal.id, version: (last?.version || 0) + 1, status: 'draft', created_by: caller.id, ...out.row }); prop = ins.row;
      if (deal.stage === 'discovery_completed') await applyStage(deal, 'proposal', { actor: caller, reason: 'Proposal drafted' });
    }
    if (out.discountRequested) await notifyOwners({ kind: 'discount_requested', subject: 'A discount needs your decision', body: `${caller.rep.display_name || 'A rep'} requested a discount of ${(out.row.discount_cents / 100).toFixed(2)} on a proposal. Reason: ${out.row.discount_reason}`, link: '/dashboard/sales-team/verification', channels: ['in_app'], idempotencyKey: `disc:${prop.id}:${out.row.discount_cents}` });
    await audit(caller, 'crm_proposal', prop.id, op === 'create' ? 'proposal_drafted' : 'proposal_edited', { deal: deal.id, total_cents: out.row.total_cents });
    return res.status(200).json({ ok: true, proposal: Object.fromEntries(REP_PROPOSAL_FIELDS.split(',').map((k) => [k, prop[k]])), blockers: blockersFor(prop) });
  }

  const loadOwnProposal = async () => { const p = await dbOne(`crm_proposals?id=eq.${enc(sanitize(b.proposal_id, 60))}&select=*`); if (!p) return { status: 404, error: 'Proposal not found' }; const r = await loadDealFor(caller, p.deal_id); if (r.error) return { status: 404, error: 'Proposal not found' }; return { p, deal: r.deal }; };

  if (op === 'send' || op === 'resend-link') {
    if (!need('POST')) return;
    const l = await loadOwnProposal(); if (l.error) return bad(res, l.status, l.error);
    let { p, deal } = l;
    if (op === 'send') { if (p.status !== 'draft') return bad(res, 409, 'Only a draft can be sent.'); const latest = await dbOne(`crm_proposals?deal_id=eq.${enc(deal.id)}&order=version.desc&select=version`); if (latest.version !== p.version) return bad(res, 409, 'A newer version exists.'); }
    else if (!['sent', 'viewed'].includes(p.status)) return bad(res, 409, 'Only a sent, unsigned proposal can be re-sent.');
    const { business, contact } = await context(deal);
    if (!contact?.email) return bad(res, 409, 'The contact needs an email address to receive the proposal.');
    if (contact.do_not_contact) return bad(res, 409, 'This contact asked not to be contacted.');
    if (op === 'send') {
      const blockers = blockersFor(p); if (blockers.length) return res.status(409).json({ error: blockers[0], blockers });
      const claims = findProhibitedClaims(p.scope?.summary, p.title, p.discount_reason); if (claims.length) return bad(res, 422, `The proposal text contains ${claims.join(', ')}.`);
      // Re-check readiness NOW: an offering may have been paused since the draft was written.
      const products = await dbGet(`products?id=in.${inList(p.line_items.map((x) => x.product_id))}&select=id,slug,name,version,sales_readiness,pilot_terms,pricing_approved,pricing_config`);
      const exc = await dbGet(`sales_scope_exceptions?deal_id=eq.${enc(deal.id)}&select=product_id,label`);
      const chk = buildLineItems({ items: p.line_items.map((x) => ({ product_id: x.product_id, quantity: x.quantity })), products, exceptions: exc, ownerPrices: await ownerPricesFor(p.id) });
      if (chk.problems.length) return res.status(409).json({ error: chk.problems[0], problems: chk.problems });
    }
    const token = randomToken(32); const days = Math.max(1, Math.min(60, Number(b.expires_days) || 14)); const expires = new Date(Date.now() + days * 86400_000).toISOString();
    const view = clientView({ proposal: p, businessName: business?.name, contactName: contact.name, repFirstName: await repFirstName(caller.id) });
    const patch = { client_token_hash: tokenHash(token), token_expires_at: expires };
    if (op === 'send') { patch.status = 'sent'; patch.sent_at = nowIso(); patch.sent_by = caller.id; patch.content_hash = proposalHash(view); }
    const [row] = await dbPatch('crm_proposals', `id=eq.${enc(p.id)}&status=eq.${enc(p.status)}`, patch); if (!row) return bad(res, 409, 'This proposal just changed.');
    if (op === 'send') {
      await dbPatch('crm_proposals', `deal_id=eq.${enc(deal.id)}&id=neq.${enc(p.id)}&status=in.(sent,viewed)`, { status: 'superseded', client_token_hash: null });
      await applyStage(deal, 'awaiting_signature_payment', { actor: caller, reason: `Proposal v${p.version} sent` });
    }
    const link = `${appBase()}/proposal/${token}`;
    const pol = emailPolicy(contact.email);
    await notify({ email: contact.email, kind: 'proposal_sent', subject: `Your proposal from Nova Systems${business?.name ? ` — ${business.name}` : ''}`, body: `Hello ${contact.name},\n\n${view.prepared_by} has prepared a proposal for you. You can review and sign it here:\n\n${link}\n\nThe link is personal to you and expires ${new Date(expires).toDateString()}. If you did not expect this, you can ignore this email.\n\nNova Systems`, link: null, channels: ['email'], idempotencyKey: `proposal:${p.id}:${patch.client_token_hash.slice(0, 12)}` });
    await audit(caller, 'crm_proposal', p.id, op === 'send' ? 'proposal_sent' : 'proposal_link_reissued', { deal: deal.id, to_domain: contact.email.split('@')[1], email_mode: pol.send ? 'live' : pol.status });
    return res.status(200).json({ ok: true, status: 'sent', expires_at: expires, email_status: pol.send ? 'queued_for_live_send' : pol.status, ...(pol.send ? {} : { dev_link: link, note: 'Email is not in live mode, so the link was NOT emailed. Only you can see this link.' }) });
  }

  if (op === 'recall') {
    if (!need('POST')) return;
    const l = await loadOwnProposal(); if (l.error) return bad(res, l.status, l.error);
    if (!['sent', 'viewed'].includes(l.p.status)) return bad(res, 409, 'Only an unsigned, sent proposal can be recalled.');
    const reason = sanitize(b.reason, 300); if (reason.length < 5) return bad(res, 422, 'Say why.');
    await dbPatch('crm_proposals', `id=eq.${enc(l.p.id)}&status=in.(sent,viewed)`, { status: 'void', client_token_hash: null });
    await applyStage(l.deal, 'proposal', { actor: caller, reason: `Proposal recalled: ${reason}` }); await audit(caller, 'crm_proposal', l.p.id, 'proposal_recalled', { reason });
    return res.status(200).json({ ok: true });
  }

  if (op === 'submit-for-verification') {
    if (!need('POST')) return;
    const r = await loadDealFor(caller, b.deal_id); if (r.error) return bad(res, r.status, r.error);
    const deal = r.deal; if (deal.stage !== 'awaiting_signature_payment') return bad(res, 409, 'Only a lead that is awaiting signature/payment can be submitted.');
    const p = await dbOne(`crm_proposals?deal_id=eq.${enc(deal.id)}&status=in.(signed,sent,viewed)&order=version.desc&select=*`); if (!p) return bad(res, 409, 'There is no sent proposal for this lead.');
    const sk = submissionKind({ proposal: p }); const evidence = sanitize(b.evidence, 2000);
    if (evidence.length < sk.minEvidence) return bad(res, 422, sk.kind === 'system_signature' ? 'Add a short note about the close (at least 10 characters).' : 'The client has not signed through Nova. Describe exactly what evidence you have (how they agreed, when, and where the signed document is) — at least 40 characters. The owner will check it.');
    const ins = await dbInsert('sales_deal_verifications', { deal_id: deal.id, proposal_id: p.id, rep_user_id: caller.id, evidence_kind: sk.kind, rep_evidence: evidence, snapshot: { proposal_status: p.status, total_cents: p.total_cents } });
    if (ins.conflict) return bad(res, 409, 'This sale is already submitted.');
    const row = await applyStage(deal, 'submitted_for_verification', { actor: caller, reason: 'Rep reported the sale closed', extra: { rep_reported_close_at: nowIso() }, detail: { evidence_kind: sk.kind } });
    if (!row) { await dbPatch('sales_deal_verifications', `id=eq.${enc(ins.row.id)}`, { status: 'withdrawn' }); return bad(res, 409, 'The lead just changed.'); }
    await audit(caller, 'crm_deal', deal.id, 'sale_submitted_for_verification', { evidence_kind: sk.kind, proposal: p.id });
    await runHooks('saleSubmitted', { dealId: deal.id, proposalId: p.id, repUserId: caller.id });
    await notifyOwners({ kind: 'sale_submitted', subject: 'A sale needs your verification', body: `${caller.rep.display_name || 'A representative'} reported a closed sale. The rep-reported close is NOT verified until you approve it.`, link: '/dashboard/sales-team/verification', channels: ['in_app', 'email'], idempotencyKey: `submitted:${ins.row.id}` });
    return res.status(200).json({ ok: true, note: 'Submitted. This is your report of a close — Nova still has to verify the sale.' });
  }

  // ================================================================== owner / manager
  const scope = await visibleRepUserIds(caller);
  if (op === 'queue') {
    if (!isOwner(caller)) return bad(res, 403, 'Owner only.');
    const [drafts, verifs] = await Promise.all([dbGet('crm_proposals?status=in.(draft,pending_approval)&order=created_at.desc&select=id,deal_id,version,title,line_items,subtotal_cents,discount_cents,discount_reason,discount_status,total_cents,created_by,created_at&limit=200'), dbGet('sales_deal_verifications?status=eq.submitted&order=submitted_at.asc&select=*')]);
    const decorate = async (rows, f) => { const out = []; for (const r of rows) out.push(await f(r)); return out; };
    const dealInfo = async (id) => { const d = await dbOne(`crm_deals?id=eq.${enc(id)}&select=id,stage,assigned_rep_id,business_id,contact_id,signed_agreement_at,payment_received_at,invoice_issued_at`); const bz = d?.business_id ? await dbOne(`businesses?id=eq.${enc(d.business_id)}&select=name`) : null; return { deal: d, business: bz?.name || null, rep: d?.assigned_rep_id ? await displayNameOf(d.assigned_rep_id) : null }; };
    const discountRequests = await decorate(drafts.filter((p) => p.discount_status === 'requested'), async (p) => ({ ...p, ...(await dealInfo(p.deal_id)) }));
    const needsPrice = await decorate(drafts.filter((p) => p.line_items.some((l) => l.unit_price_cents == null)), async (p) => ({ ...p, ...(await dealInfo(p.deal_id)) }));
    const verifications = await decorate(verifs, async (v) => { const info = await dealInfo(v.deal_id); const prop = v.proposal_id ? await dbOne(`crm_proposals?id=eq.${enc(v.proposal_id)}&select=id,version,status,total_cents,payment_due_cents,signed_at,signer_name,line_items`) : null; const pay = await dbGet(`sales_payments?deal_id=eq.${enc(v.deal_id)}&order=created_at.desc&select=id,status,method,amount_cents,paid_at`); return { ...v, ...info, proposal: prop, payments: pay }; });
    return res.status(200).json({ discount_requests: discountRequests, needs_price: needsPrice, verifications });
  }
  if (op === 'decide-discount') {
    if (!need('POST')) return;
    const p = await dbOne(`crm_proposals?id=eq.${enc(sanitize(b.proposal_id, 60))}&select=*`); if (!p) return bad(res, 404, 'Proposal not found');
    if (p.discount_status !== 'requested' || p.status !== 'draft') return bad(res, 409, 'There is no open discount request on this proposal.');
    const deal = await dbOne(`crm_deals?id=eq.${enc(p.deal_id)}&select=assigned_rep_id`); if (deal?.assigned_rep_id === caller.id) return bad(res, 403, 'You cannot decide a discount on a sale you are credited on.');
    const approve = b.decision === 'approve'; if (!approve && b.decision !== 'deny') return bad(res, 422, 'decision must be approve or deny.');
    const note = sanitize(b.note, 300); if (note.length < 5) return bad(res, 422, 'Record the reason for your decision.');
    await dbPatch('crm_proposals', `id=eq.${enc(p.id)}&status=eq.draft&discount_status=eq.requested`, { discount_status: approve ? 'approved' : 'denied', discount_decided_by: caller.id, discount_decided_at: nowIso() });
    await audit(caller, 'crm_proposal', p.id, approve ? 'discount_approved' : 'discount_denied', { discount_cents: p.discount_cents, note });
    if (deal?.assigned_rep_id) await notify({ userId: deal.assigned_rep_id, kind: 'discount_decided', subject: `Your discount request was ${approve ? 'approved' : 'denied'}`, body: note, link: '/rep/leads', channels: ['in_app'], idempotencyKey: `discdec:${p.id}:${Date.now()}` });
    return res.status(200).json({ ok: true });
  }
  if (op === 'owner-set-price') {
    if (!need('POST')) return;
    const p = await dbOne(`crm_proposals?id=eq.${enc(sanitize(b.proposal_id, 60))}&select=*`); if (!p) return bad(res, 404, 'Proposal not found'); if (p.status !== 'draft') return bad(res, 409, 'Only a draft can be priced.');
    const cents = Number(b.unit_price_cents); if (!Number.isInteger(cents) || cents < 100 || cents > 100_000_000) return bad(res, 422, 'Enter the price in cents.');
    const reason = sanitize(b.reason, 300); if (reason.length < 10) return bad(res, 422, 'Record why this custom price applies (at least 10 characters).');
    const deal = await dbOne(`crm_deals?id=eq.${enc(p.deal_id)}&select=assigned_rep_id`); if (deal?.assigned_rep_id === caller.id) return bad(res, 403, 'You cannot price a sale you are credited on.');
    const idx = p.line_items.findIndex((l) => l.product_id === sanitize(b.product_id, 60)); if (idx < 0) return bad(res, 404, 'That offering is not on the proposal.');
    const lines = p.line_items.map((l, i) => (i === idx ? { ...l, unit_price_cents: cents, price_source: 'owner' } : l));
    const unpriced = lines.some((l) => l.unit_price_cents == null); const subtotal = unpriced ? null : lines.reduce((s, l) => s + l.unit_price_cents * l.quantity, 0);
    const t = totals({ subtotal, discount_cents: p.discount_cents });
    await dbPatch('crm_proposals', `id=eq.${enc(p.id)}&status=eq.draft`, { line_items: lines, subtotal_cents: t.subtotal, discount_cents: t.discount, total_cents: t.total, payment_due_cents: t.total, price_cents: t.total, ...(p.discount_cents && t.discount !== p.discount_cents ? { discount_status: 'requested' } : {}) });
    await audit(caller, 'crm_proposal', p.id, 'owner_set_price', { product: lines[idx].slug, unit_price_cents: cents, reason }); return res.status(200).json({ ok: true, total_cents: t.total });
  }
  if (op === 'approve-custom-scope') {
    if (!need('POST')) return;
    const deal = await dbOne(`crm_deals?id=eq.${enc(sanitize(b.deal_id, 60))}&pipeline=eq.nova_sales&select=id,assigned_rep_id`); if (!deal) return bad(res, 404, 'Lead not found');
    const product = await dbOne(`products?id=eq.${enc(sanitize(b.product_id, 60))}&select=id,name`); if (!product) return bad(res, 404, 'Product not found');
    const label = sanitize(b.label, 200); if (label.length < 10) return bad(res, 422, 'Write the label the client will see (scope and limits), at least 10 characters.');
    const ins = await dbInsert('sales_scope_exceptions', { deal_id: deal.id, product_id: product.id, label, approved_by: caller.id }, { onConflict: 'deal_id,product_id' });
    if (!ins.row) await dbPatch('sales_scope_exceptions', `deal_id=eq.${enc(deal.id)}&product_id=eq.${enc(product.id)}`, { label, approved_by: caller.id, approved_at: nowIso() });
    await audit(caller, 'crm_deal', deal.id, 'custom_scope_approved', { product: product.name, label }); return res.status(200).json({ ok: true });
  }
  if (op === 'verify') {
    if (!need('POST')) return;
    const v = await dbOne(`sales_deal_verifications?id=eq.${enc(sanitize(b.verification_id, 60))}&select=*`); if (!v) return bad(res, 404, 'Not found');
    if (v.status !== 'submitted') return bad(res, 409, 'This submission was already decided.');
    const deal = await dbOne(`crm_deals?id=eq.${enc(v.deal_id)}&select=*`);
    if (deal.assigned_rep_id === caller.id || v.rep_user_id === caller.id) return bad(res, 403, 'You cannot verify a sale you are credited on.');
    const notes = sanitize(b.notes, 1000); if (notes.length < 10) return bad(res, 422, 'Record what you checked (at least 10 characters).');
    const proposal = v.proposal_id ? await dbOne(`crm_proposals?id=eq.${enc(v.proposal_id)}&select=*`) : null;
    if (b.decision === 'reject') {
      const [row] = await dbPatch('sales_deal_verifications', `id=eq.${enc(v.id)}&status=eq.submitted`, { status: 'rejected', reviewed_by: caller.id, reviewed_at: nowIso(), review_notes: notes }); if (!row) return bad(res, 409, 'Already decided.');
      await applyStage(deal, proposal?.status === 'signed' ? 'awaiting_signature_payment' : 'awaiting_signature_payment', { actor: caller, actorKind: 'owner', reason: `Verification rejected: ${notes}`, extra: { rep_reported_close_at: null } });
      await audit(caller, 'crm_deal', deal.id, 'sale_verification_rejected', { notes }); await runHooks('saleRejected', { dealId: deal.id });
      await notify({ userId: v.rep_user_id, kind: 'sale_rejected', subject: 'Your reported sale was not verified', body: notes, link: '/rep/leads', channels: ['in_app', 'email'], idempotencyKey: `verrej:${v.id}` });
      return res.status(200).json({ ok: true, decision: 'rejected' });
    }
    if (b.decision !== 'approve') return bad(res, 422, 'decision must be approve or reject.');
    if (!proposal) return bad(res, 409, 'There is no proposal to verify against.');
    if (v.evidence_kind === 'rep_supplied' && b.confirm_offline_evidence !== true) return bad(res, 422, 'The client did not sign through Nova. Confirm that you personally checked the rep\'s evidence (the signed document exists and the signer is genuine).');
    const paid = !!deal.payment_received_at; const unpaidReason = sanitize(b.unpaid_reason, 300);
    if (!paid && (b.accept_unpaid_terms !== true || unpaidReason.length < 15)) return res.status(409).json({ error: 'No payment has been received. Wait for payment, or explicitly accept the unpaid terms and record why (at least 15 characters). Commission will not become eligible until payment is received either way.', payment_received: false });
    const [row] = await dbPatch('sales_deal_verifications', `id=eq.${enc(v.id)}&status=eq.submitted`, { status: 'approved', reviewed_by: caller.id, reviewed_at: nowIso(), review_notes: notes, snapshot: { ...v.snapshot, at_decision: { proposal_status: proposal.status, signed_at: proposal.signed_at, total_cents: proposal.total_cents, payment_received: paid, unpaid_terms_accepted: !paid, unpaid_reason: paid ? null : unpaidReason, offline_evidence_confirmed: v.evidence_kind === 'rep_supplied' } } });
    if (!row) return bad(res, 409, 'Already decided.');
    const extra = { owner_verified_at: nowIso(), owner_verified_by: caller.id, closed_at: nowIso(), win_reason: notes.slice(0, 300) };
    if (!deal.signed_agreement_at) extra.signed_agreement_at = nowIso();
    const won = await applyStage(deal, 'won', { actor: caller, actorKind: 'owner', reason: 'Sale verified by owner', extra, detail: { evidence_kind: v.evidence_kind } });
    if (!won) return bad(res, 409, 'The lead changed while verifying. Nothing was completed — try again.');
    await dbPatch('sales_lead_keys', `deal_id=eq.${enc(deal.id)}`, { active: false });
    if (proposal.status !== 'accepted') await dbPatch('crm_proposals', `id=eq.${enc(proposal.id)}&status=in.(signed,sent,viewed)`, { status: 'accepted', accepted_at: nowIso(), acceptance_evidence: v.evidence_kind === 'rep_supplied' ? `Owner-verified offline evidence: ${v.rep_evidence.slice(0, 300)}` : 'Client e-signature recorded by Nova' });
    let handoff; try { handoff = await handoffFulfillment({ deal, proposal, actor: caller }); } catch (e) { console.error('[sales:handoff] failed after verification; use retry-handoff:', e.message); handoff = { failed: true, error: 'Fulfillment handoff failed; the sale IS verified. Use Retry handoff.' }; }
    await audit(caller, 'crm_deal', deal.id, 'sale_verified', { evidence_kind: v.evidence_kind, payment_received: paid, handoff });
    await runHooks('saleVerified', { dealId: deal.id, proposalId: proposal.id, repUserId: v.rep_user_id });
    await notify({ userId: v.rep_user_id, kind: 'sale_verified', subject: 'Your sale was verified', body: 'Nova verified your sale. Commission follows the approved plan and its conditions — see My Earnings.', link: '/rep/earnings', channels: ['in_app', 'email'], idempotencyKey: `verok:${v.id}` });
    return res.status(200).json({ ok: true, decision: 'approved', handoff });
  }
  if (op === 'retry-handoff') {
    if (!need('POST')) return;
    const deal = await dbOne(`crm_deals?id=eq.${enc(sanitize(b.deal_id, 60))}&select=*`); if (!deal || deal.stage !== 'won') return bad(res, 409, 'Only a verified sale can be handed off.');
    const proposal = await dbOne(`crm_proposals?deal_id=eq.${enc(deal.id)}&status=eq.accepted&select=*`); if (!proposal) return bad(res, 409, 'No accepted proposal.');
    const out = await handoffFulfillment({ deal, proposal, actor: caller }); await audit(caller, 'crm_deal', deal.id, 'handoff_retried', out); return res.status(200).json({ ok: true, handoff: out });
  }
  if (op === 'mark-fulfillment-started') {
    if (!need('POST')) return;
    const deal = await dbOne(`crm_deals?id=eq.${enc(sanitize(b.deal_id, 60))}&select=*`); if (!deal || deal.stage !== 'won') return bad(res, 409, 'Only a verified sale can enter fulfillment.');
    const orders = await dbGet(`orders?deal_id=eq.${enc(deal.id)}&select=id,status`); if (!orders.length) return bad(res, 409, 'There is no order for this sale.');
    for (const o of orders.filter((x) => ['accepted', 'waiting_for_inputs', 'ready_for_work'].includes(x.status))) { await dbPatch('orders', `id=eq.${enc(o.id)}`, { status: 'in_progress', updated_at: nowIso() }); await dbInsert('order_events', { order_id: o.id, event_type: 'status_changed', actor_user_id: caller.id, detail: { from: o.status, to: 'in_progress', via: 'sales_handoff' } }); }
    await dbPatch('crm_deals', `id=eq.${enc(deal.id)}&fulfillment_started_at=is.null`, { fulfillment_started_at: nowIso() });
    await audit(caller, 'crm_deal', deal.id, 'fulfillment_started', {}); return res.status(200).json({ ok: true });
  }
  return bad(res, 400, `Unknown proposals operation: ${op}`);
});

// Creates (or finds) the customer org, one order per line item, and ONE follow-up task — all idempotent, so re-running never duplicates.
export async function handoffFulfillment({ deal, proposal, actor }) {
  const org = await novaOrgId();
  const business = deal.business_id ? await dbOne(`businesses?id=eq.${enc(deal.business_id)}&select=id,name`) : null;
  const slug = `client-${String(deal.business_id || deal.id).slice(0, 8)}`;
  let cust = await dbOne(`organizations?slug=eq.${enc(slug)}&select=id`);
  let orgCreated = false;
  if (!cust) { const ins = await dbInsert('organizations', { name: business?.name || 'New client', slug, kind: 'client' }); cust = ins.row || (await dbOne(`organizations?slug=eq.${enc(slug)}&select=id`)); orgCreated = !!ins.row; }
  let created = 0, existing = 0;
  for (const line of proposal.line_items) {
    const prod = await dbOne(`products?id=eq.${enc(line.product_id)}&select=id,version`);
    const have = await dbOne(`orders?deal_id=eq.${enc(deal.id)}&product_id=eq.${enc(line.product_id)}&select=id`);
    if (have) { existing++; continue; }
    const ins = await dbInsert('orders', { organization_id: cust.id, business_id: deal.business_id, deal_id: deal.id, product_id: line.product_id, product_version: prod?.version || 1, scope: { proposal_id: proposal.id, proposal_version: proposal.version, offering: line.name, quantity: line.quantity, label: line.label, summary: proposal.scope?.summary }, price_cents: line.unit_price_cents * line.quantity, currency: proposal.currency, agreement_version: `proposal v${proposal.version}`, payment_condition: 'see sales_payments', owner_user_id: null, status: 'accepted', status_history: [{ status: 'accepted', at: nowIso(), by: 'sales_handoff' }] });
    if (ins.row) { created++; await dbInsert('order_events', { order_id: ins.row.id, event_type: 'created_from_verified_sale', actor_user_id: actor.id, detail: { deal_id: deal.id, proposal_id: proposal.id } }); } else existing++;
  }
  const taskBody = `Begin fulfillment for ${business?.name || 'new client'}: ${proposal.line_items.map((l) => l.name).join(', ')}`;
  const prior = await dbOne(`crm_activities?deal_id=eq.${enc(deal.id)}&kind=eq.task&body=eq.${enc(taskBody)}&select=id`);
  if (!prior) await dbInsert('crm_activities', { organization_id: org, deal_id: deal.id, contact_id: deal.contact_id, kind: 'task', body: taskBody, due_at: new Date(Date.now() + 2 * 86400_000).toISOString(), created_by: actor.id });
  await notifyOwners({ kind: 'fulfillment_handoff', subject: 'A verified sale is ready for fulfillment', body: taskBody, link: '/dashboard/sales-team/verification', channels: ['in_app'], idempotencyKey: `handoff:${deal.id}` });
  return { customer_org_created: orgCreated, orders_created: created, orders_existing: existing, task_created: !prior };
}

// ==================================================================================================== public (client) proposal
export const handleClientProposal = wrap(async (req, res, op) => {
  const b = req.body || {}; const isGet = req.method === 'GET';
  if (!rateLimit(req, res, op === 'sign' ? 10 : 40, 60_000)) return;
  const token = sanitize(isGet ? req.query?.token : b.token, 200);
  const p = token.length >= 20 ? await dbOne(`crm_proposals?client_token_hash=eq.${enc(tokenHash(token))}&select=*`) : null;
  if (!p) return bad(res, 404, 'This link is not valid. Please check the link in your email or ask your Nova representative to send a new one.');
  let status = p.status;
  if (['sent', 'viewed'].includes(status) && p.token_expires_at && new Date(p.token_expires_at) <= new Date()) { await dbPatch('crm_proposals', `id=eq.${enc(p.id)}&status=in.(sent,viewed)`, { status: 'expired' }); status = 'expired'; }
  if (['expired', 'void', 'superseded', 'declined'].includes(status)) return res.status(410).json({ error: status === 'expired' ? 'This proposal link has expired. Ask your Nova representative to send a new one.' : status === 'declined' ? 'This proposal was declined.' : 'This proposal is no longer current. Ask your Nova representative for the latest version.', status });
  const deal = await dbOne(`crm_deals?id=eq.${enc(p.deal_id)}&select=*`); const { business, contact } = await context(deal);
  const view = clientView({ proposal: p, businessName: business?.name, contactName: contact?.name, repFirstName: await repFirstName(p.sent_by) });

  if (op === 'view') {
    if (p.status === 'sent') { await dbPatch('crm_proposals', `id=eq.${enc(p.id)}&status=eq.sent`, { status: 'viewed', viewed_at: nowIso() }); await audit({ id: null, kind: 'client' }, 'crm_proposal', p.id, 'proposal_viewed', {}); const rep = deal.assigned_rep_id; if (rep) await notify({ userId: rep, kind: 'proposal_viewed', subject: 'Your proposal was opened', body: `${contact?.name || 'The client'} opened the proposal.`, link: '/rep/leads', channels: ['in_app'], idempotencyKey: `propview:${p.id}` }); }
    const pay = await dbOne(`sales_payments?proposal_id=eq.${enc(p.id)}&status=in.(pending,paid)&select=status,amount_cents`);
    return res.status(200).json({ proposal: view, content_hash: p.content_hash, status: p.status === 'sent' ? 'viewed' : p.status, expires_at: p.token_expires_at, signed_at: p.signed_at, signer_name: p.signed_at ? p.signer_name : null, consent: { version: CLIENT_CONSENT_VERSION, text: CLIENT_CONSENT_TEXT }, payment: { due_cents: p.payment_due_cents, status: pay?.status || 'unpaid', online_available: stripeAllowed().ok } });
  }
  if (op === 'sign') {
    if (req.method !== 'POST') return bad(res, 405, 'Method not allowed');
    if (p.status === 'signed') return bad(res, 409, 'This proposal is already signed.');
    if (p.status !== 'viewed') return bad(res, 409, 'Open and read the proposal before signing.');
    if (b.consent !== true) return bad(res, 422, 'You must agree to sign electronically to continue.');
    if (b.content_hash !== p.content_hash) return bad(res, 409, 'The proposal changed since you opened it. Reload and read it again.');
    const nm = validateTypedName(b.typed_name); if (nm.error) return bad(res, 422, nm.error);
    const imgErr = validateSignatureImage(b.signature_image); if (imgErr) return bad(res, 422, imgErr);
    const signedAt = nowIso(); const ip = clientIp(req);
    const sigHash = proposalSignatureHash({ proposalId: p.id, contentHash: p.content_hash, signerName: nm.name, signedAt, consentVersion: CLIENT_CONSENT_VERSION, ip });
    const [row] = await dbPatch('crm_proposals', `id=eq.${enc(p.id)}&status=eq.viewed`, { status: 'signed', signed_at: signedAt, signer_name: nm.name, signer_email: contact?.email || null, signature_image: b.signature_image || null, signer_ip: ip, esign_consent_version: CLIENT_CONSENT_VERSION, signature_hash: sigHash });
    if (!row) return bad(res, 409, 'This proposal was just signed or changed.');
    await dbPatch('crm_deals', `id=eq.${enc(deal.id)}&signed_agreement_at=is.null`, { signed_agreement_at: signedAt });
    await audit({ id: null, kind: 'client' }, 'crm_proposal', p.id, 'proposal_signed', { signature_hash: sigHash, deal: deal.id });
    if (deal.assigned_rep_id) await notify({ userId: deal.assigned_rep_id, kind: 'proposal_signed', subject: 'Your client signed the proposal', body: `${nm.name} signed. Payment and Nova's verification are separate steps.`, link: '/rep/leads', channels: ['in_app', 'email'], idempotencyKey: `propsigned:${p.id}` });
    await notifyOwners({ kind: 'proposal_signed', subject: 'A client signed a proposal', body: `${nm.name} signed a proposal.`, link: '/dashboard/sales-team/verification', channels: ['in_app'], idempotencyKey: `propsignedown:${p.id}` });
    return res.status(200).json({ ok: true, signed_at: signedAt, payment_due_cents: p.payment_due_cents, online_payment_available: stripeAllowed().ok });
  }
  if (op === 'decline') {
    if (req.method !== 'POST') return bad(res, 405, 'Method not allowed');
    if (!['sent', 'viewed'].includes(p.status)) return bad(res, 409, 'This proposal can no longer be declined.');
    const reason = sanitize(b.reason, 500) || null;
    await dbPatch('crm_proposals', `id=eq.${enc(p.id)}&status=in.(sent,viewed)`, { status: 'declined', declined_at: nowIso(), decline_reason: reason, client_token_hash: null });
    await applyStage(deal, 'proposal', { actor: { id: null }, actorKind: 'client', reason: 'Client declined the proposal' });
    if (deal.assigned_rep_id) await notify({ userId: deal.assigned_rep_id, kind: 'proposal_declined', subject: 'A proposal was declined', body: reason || 'The client declined without a reason.', link: '/rep/leads', channels: ['in_app'], idempotencyKey: `propdecl:${p.id}` });
    return res.status(200).json({ ok: true });
  }
  if (op === 'pay') {
    if (req.method !== 'POST') return bad(res, 405, 'Method not allowed');
    if (!['signed', 'accepted'].includes(p.status)) return bad(res, 409, 'Please sign the proposal first.');
    const out = await createCheckoutForProposal({ proposal: p, deal, token });
    if (out.error) return bad(res, out.status || 409, out.error === 'The payment provider is not configured.' ? 'Online payment is not available yet. Nova will send you payment instructions.' : out.error);
    return res.status(200).json({ ok: true, checkout_url: out.url });
  }
  return bad(res, 400, `Unknown operation: ${op}`);
});
