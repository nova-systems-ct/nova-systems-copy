// Agreements & e-signature. Signer identity = the authenticated Supabase session (no bearer links). Every state change writes a
// hash-chained event. Text of an approved version is immutable (DB trigger); a signed record is immutable (DB trigger).
// This module records consent and a tamper-evident trail. It does NOT assert that any template is legally sufficient — the owner
// must review and confirm each version before it can be sent.
import { sanitize } from '../_sanitize.js';
import { rateLimit } from '../_rateLimit.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, inList, nowIso, audit, bad, wrap, requirePerm, isOwner, visibleRepUserIds, displayNameOf, notify, notifyOwners, authUserById } from './core.js';
import { documentHash, eventHash, verifyEventChain, signatureHash, imageHash, validateSignatureImage, validateTypedName, approvalProblems, documentState, ESIGN_CONSENT_VERSION, ESIGN_CONSENT_TEXT } from './documentRules.js';
import { textPdf } from './pdf.js';

const clientIp = (req) => String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim().slice(0, 64) || null;

export async function addEvent(requestId, event, actorId, detail = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await dbOne(`sales_document_events?request_id=eq.${enc(requestId)}&order=seq.desc&select=seq,hash`);
    const seq = (last?.seq || 0) + 1; const createdAt = nowIso(); const prevHash = last?.hash || null;
    const hash = eventHash({ requestId, seq, event, actor: actorId || null, detail, createdAt, prevHash });
    const ins = await dbInsert('sales_document_events', { request_id: requestId, seq, event, actor_user_id: actorId || null, detail, prev_hash: prevHash, hash, created_at: createdAt });
    if (ins.row) return ins.row;
  }
  throw Object.assign(new Error('could not append document event'), { status: 500 });
}

async function expireIfNeeded(r) {
  if (['sent', 'viewed'].includes(r.status) && new Date(r.expires_at) <= new Date()) {
    const [u] = await dbPatch('sales_document_requests', `id=eq.${enc(r.id)}&status=in.(sent,viewed)`, { status: 'expired' });
    if (u) await addEvent(r.id, 'expired', null, {});
    return { ...r, status: 'expired' };
  }
  return r;
}
export async function sweepExpiredDocuments() {
  const rows = await dbGet(`sales_document_requests?status=in.(sent,viewed)&expires_at=lt.${enc(nowIso())}&select=*&limit=200`);
  for (const r of rows) await expireIfNeeded(r);
  return rows.length;
}

// Per-template state for one signer (used by the rep's own screen AND the activation checklist)
export async function documentStatesFor(userId) {
  const [templates, versions, requests] = await Promise.all([dbGet('sales_document_templates?select=*&order=created_at.asc'), dbGet('sales_document_versions?select=id,template_id,version,status,material_change,approved_at&order=version.asc'), dbGet(`sales_document_requests?signer_user_id=eq.${enc(userId)}&select=id,template_id,version_id,status,expires_at,signed_at,countersigned_at,created_at`)]);
  const out = {};
  for (const t of templates) out[t.key] = { ...documentState({ template: t, versions: versions.filter((v) => v.template_id === t.id), requests: requests.filter((r) => r.template_id === t.id) }), title: t.title, requires_countersign: t.requires_countersign };
  return out;
}

async function signedPdf(r) {
  const [version, template, events, signerName] = await Promise.all([dbOne(`sales_document_versions?id=eq.${enc(r.version_id)}&select=*`), dbOne(`sales_document_templates?id=eq.${enc(r.template_id)}&select=*`), dbGet(`sales_document_events?request_id=eq.${enc(r.id)}&order=seq.asc&select=seq,event,created_at,hash`), displayNameOf(r.signer_user_id)]);
  const chain = verifyEventChain(r.id, await dbGet(`sales_document_events?request_id=eq.${enc(r.id)}&order=seq.asc&select=*`));
  return textPdf({ title: template.title, blocks: [
    { style: 'h1', text: template.title }, { style: 'small', text: `Nova Systems LLC — document version ${version.version}` }, { style: 'gap' },
    { style: 'p', text: version.body }, { style: 'gap' },
    { style: 'h2', text: 'Signature record' },
    { style: 'p', text: `Signed electronically by: ${r.signer_typed_name} (account: ${signerName || r.signer_email})` }, { style: 'p', text: `Signed at (server time): ${r.signed_at}` },
    { style: 'p', text: `Electronic-signature consent recorded: ${r.esign_consent ? 'yes' : 'no'} (${r.esign_consent_text_version || 'n/a'})` },
    ...(r.signature_image ? [{ style: 'p', text: 'A drawn signature image was also captured and is stored with this record.' }] : []),
    ...(r.countersigned_at ? [{ style: 'p', text: `Countersigned by Nova Systems: ${r.countersign_name} at ${r.countersigned_at}` }] : template.requires_countersign ? [{ style: 'p', text: 'Nova countersignature: pending' }] : []),
    { style: 'gap' }, { style: 'h2', text: 'Integrity' },
    { style: 'mono', text: `Document SHA-256: ${r.content_hash}` }, { style: 'mono', text: `Signature SHA-256: ${r.signature_hash}` }, { style: 'mono', text: `Record ID: ${r.id}` },
    { style: 'mono', text: `Audit chain: ${chain.ok ? `verified (${chain.events} events)` : `NOT VERIFIED — ${chain.reason}`}` },
    ...events.map((e) => ({ style: 'mono', text: `#${e.seq} ${e.event} ${new Date(e.created_at).toISOString()} ${e.hash.slice(0, 16)}` })),
  ] });
}

export const handleDocuments = wrap(async (req, res, op) => {
  const b = req.body || {};
  const need = (m) => { if (req.method !== m) { bad(res, 405, 'Method not allowed'); return false; } return true; };
  const ownerOps = ['templates', 'save-version', 'approve-version', 'send', 'void', 'countersign', 'verify'];
  const manageOps = ['requests'];
  const perm = ownerOps.includes(op) ? 'sales.owner' : manageOps.includes(op) ? 'sales.manage' : 'sales.onboarding';
  const caller = await requirePerm(req, res, perm); if (!caller) return;
  if (!rateLimit(req, res, 90, 60_000)) return;

  // ------------------------------------------------------------------ owner: templates & versions
  if (op === 'templates') {
    const [templates, versions] = await Promise.all([dbGet('sales_document_templates?order=created_at.asc&select=*'), dbGet('sales_document_versions?order=version.desc&select=id,template_id,version,status,review_status,material_change,change_note,created_at,approved_at,content_hash,body')]);
    return res.status(200).json({ consent: { version: ESIGN_CONSENT_VERSION, text: ESIGN_CONSENT_TEXT }, templates: templates.map((t) => ({ ...t, versions: versions.filter((v) => v.template_id === t.id) })) });
  }
  if (op === 'save-version') {
    if (!need('POST')) return;
    const tpl = await dbOne(`sales_document_templates?key=eq.${enc(sanitize(b.template_key, 60))}&select=*`); if (!tpl) return bad(res, 404, 'Template not found');
    const body = String(b.body || '').slice(0, 60000); if (!body.trim()) return bad(res, 422, 'The document text is empty.');
    if (b.version_id) {
      const v = await dbOne(`sales_document_versions?id=eq.${enc(sanitize(b.version_id, 60))}&template_id=eq.${enc(tpl.id)}&select=*`); if (!v) return bad(res, 404, 'Version not found');
      if (v.status !== 'draft') return bad(res, 409, 'Only a draft can be edited. Save a new version instead.');
      const [row] = await dbPatch('sales_document_versions', `id=eq.${enc(v.id)}&status=eq.draft`, { body, material_change: b.material_change !== false, change_note: sanitize(b.change_note, 500) || null });
      await audit(caller, 'document_version', v.id, 'draft_edited', { template: tpl.key });
      return res.status(200).json({ ok: true, version: row });
    }
    for (let i = 0; i < 4; i++) {
      const last = await dbOne(`sales_document_versions?template_id=eq.${enc(tpl.id)}&order=version.desc&select=version`);
      const ins = await dbInsert('sales_document_versions', { template_id: tpl.id, version: (last?.version || 0) + 1, body, material_change: b.material_change !== false, change_note: sanitize(b.change_note, 500) || null, created_by: caller.id });
      if (ins.row) { await audit(caller, 'document_version', ins.row.id, 'draft_created', { template: tpl.key, version: ins.row.version }); return res.status(200).json({ ok: true, version: ins.row }); }
    }
    return bad(res, 409, 'Could not allocate a version number. Try again.');
  }
  if (op === 'approve-version') {
    if (!need('POST')) return;
    const v = await dbOne(`sales_document_versions?id=eq.${enc(sanitize(b.version_id, 60))}&select=*,sales_document_templates(id,key,title)`); if (!v) return bad(res, 404, 'Version not found');
    if (v.status !== 'draft') return bad(res, 409, 'This version is already approved or retired.');
    const problems = approvalProblems({ version: v, confirmReviewed: b.confirm_reviewed === true }); if (problems.length) return res.status(422).json({ error: problems[0], problems });
    const hash = documentHash(v.sales_document_templates.title, v.body);
    const [row] = await dbPatch('sales_document_versions', `id=eq.${enc(v.id)}&status=eq.draft`, { status: 'approved', review_status: 'owner_confirmed_reviewed', content_hash: hash, approved_by: caller.id, approved_at: nowIso() });
    if (!row) return bad(res, 409, 'Someone else just changed this version.');
    await dbPatch('sales_document_versions', `template_id=eq.${enc(v.template_id)}&status=eq.approved&id=neq.${enc(v.id)}`, { status: 'retired' });
    let superseded = 0;
    if (v.material_change) { // requests still open on an older version must not be signed any more
      const open = await dbGet(`sales_document_requests?template_id=eq.${enc(v.template_id)}&status=in.(sent,viewed)&version_id=neq.${enc(v.id)}&select=id`);
      for (const o of open) { const [u] = await dbPatch('sales_document_requests', `id=eq.${enc(o.id)}&status=in.(sent,viewed)`, { status: 'superseded' }); if (u) { await addEvent(o.id, 'superseded', caller.id, { by_version: v.version }); superseded++; } }
    }
    await audit(caller, 'document_version', v.id, 'approved', { template: v.sales_document_templates.key, version: v.version, material_change: v.material_change, content_hash: hash, superseded_open_requests: superseded });
    return res.status(200).json({ ok: true, version: row, superseded_open_requests: superseded });
  }
  if (op === 'send') {
    if (!need('POST')) return;
    const tpl = await dbOne(`sales_document_templates?key=eq.${enc(sanitize(b.template_key, 60))}&select=*`); if (!tpl) return bad(res, 404, 'Template not found');
    const version = await dbOne(`sales_document_versions?template_id=eq.${enc(tpl.id)}&status=eq.approved&review_status=eq.owner_confirmed_reviewed&order=version.desc&select=*`);
    if (!version) return bad(res, 409, 'This document has no approved, reviewed version. Approve a version first — unreviewed templates cannot be sent.');
    const ids = [...new Set((Array.isArray(b.user_ids) ? b.user_ids : []).map((x) => sanitize(x, 60)).filter(Boolean))].slice(0, 50); if (!ids.length) return bad(res, 422, 'Choose who should sign.');
    const days = Math.max(1, Math.min(60, Number(b.expires_days) || 14)); const results = [];
    for (const uid of ids) {
      const rep = await dbOne(`sales_reps?user_id=eq.${enc(uid)}&select=id,status`);
      if (!rep || ['inactive'].includes(rep.status)) { results.push({ user_id: uid, ok: false, error: 'Not a current candidate or representative.' }); continue; }
      const au = await authUserById(uid);
      const existing = await dbGet(`sales_document_requests?signer_user_id=eq.${enc(uid)}&template_id=eq.${enc(tpl.id)}&status=in.(sent,viewed)&select=id`);
      for (const e of existing) { const [u] = await dbPatch('sales_document_requests', `id=eq.${enc(e.id)}&status=in.(sent,viewed)`, { status: 'superseded' }); if (u) await addEvent(e.id, 'superseded', caller.id, { reason: 'resent' }); }
      const ins = await dbInsert('sales_document_requests', { version_id: version.id, template_id: tpl.id, signer_user_id: uid, signer_email: au?.email || null, content_hash: version.content_hash, sent_by: caller.id, expires_at: new Date(Date.now() + days * 86400_000).toISOString() });
      if (!ins.row) { results.push({ user_id: uid, ok: false, error: 'A request is already open.' }); continue; }
      await addEvent(ins.row.id, 'sent', caller.id, { version: version.version, expires_days: days });
      await notify({ userId: uid, email: au?.email, kind: 'document_sent', subject: `Please review and sign: ${tpl.title}`, body: `Nova Systems has sent you "${tpl.title}" to review and sign. Sign in and open Training & Documents. It expires in ${days} days.`, link: '/rep/documents', channels: ['in_app', 'email'], idempotencyKey: `docsent:${ins.row.id}` });
      results.push({ user_id: uid, ok: true, request_id: ins.row.id });
    }
    await audit(caller, 'document_template', tpl.id, 'sent', { version: version.version, recipients: results.filter((x) => x.ok).length });
    return res.status(200).json({ ok: true, results });
  }
  if (op === 'void') {
    if (!need('POST')) return;
    const r = await dbOne(`sales_document_requests?id=eq.${enc(sanitize(b.request_id, 60))}&select=*`); if (!r) return bad(res, 404, 'Request not found');
    const reason = sanitize(b.reason, 500); if (reason.length < 5) return bad(res, 422, 'Record why this is being voided.');
    if (['declined', 'expired', 'void', 'superseded'].includes(r.status)) return bad(res, 409, 'That request is already closed.');
    const [u] = await dbPatch('sales_document_requests', `id=eq.${enc(r.id)}&status=in.(sent,viewed,signed)`, { status: 'void', voided_by: caller.id, voided_at: nowIso(), void_reason: reason });
    if (!u) return bad(res, 409, 'That request just changed.');
    await addEvent(r.id, 'void', caller.id, { reason }); await audit(caller, 'document_request', r.id, 'voided', { reason });
    return res.status(200).json({ ok: true });
  }
  if (op === 'countersign') {
    if (!need('POST')) return;
    const r = await dbOne(`sales_document_requests?id=eq.${enc(sanitize(b.request_id, 60))}&select=*,sales_document_templates(requires_countersign,title)`); if (!r) return bad(res, 404, 'Request not found');
    if (r.status !== 'signed') return bad(res, 409, 'Only a signed document can be countersigned.');
    if (!r.sales_document_templates.requires_countersign) return bad(res, 409, 'This document does not need a countersignature.');
    if (r.countersigned_at) return bad(res, 409, 'Already countersigned.');
    if (r.signer_user_id === caller.id) return bad(res, 403, 'You cannot countersign a document you signed yourself.');
    const nm = validateTypedName(b.typed_name); if (nm.error) return bad(res, 422, nm.error);
    const [u] = await dbPatch('sales_document_requests', `id=eq.${enc(r.id)}&status=eq.signed&countersigned_at=is.null`, { countersigned_by: caller.id, countersigned_at: nowIso(), countersign_name: nm.name });
    if (!u) return bad(res, 409, 'Already countersigned.');
    await addEvent(r.id, 'countersigned', caller.id, { name: nm.name }); await audit(caller, 'document_request', r.id, 'countersigned', { signer: r.signer_user_id });
    await notify({ userId: r.signer_user_id, kind: 'document_countersigned', subject: `${r.sales_document_templates.title} countersigned`, body: 'Nova Systems has countersigned your document. A copy is available in Training & Documents.', link: '/rep/documents', channels: ['in_app'], idempotencyKey: `doccs:${r.id}` });
    return res.status(200).json({ ok: true });
  }
  if (op === 'verify') {
    const r = await dbOne(`sales_document_requests?id=eq.${enc(sanitize(req.query?.id, 60))}&select=*`); if (!r) return bad(res, 404, 'Request not found');
    const v = await dbOne(`sales_document_versions?id=eq.${enc(r.version_id)}&select=body,content_hash,sales_document_templates(title)`);
    const events = await dbGet(`sales_document_events?request_id=eq.${enc(r.id)}&order=seq.asc&select=*`);
    const chain = verifyEventChain(r.id, events);
    const textOk = documentHash(v.sales_document_templates.title, v.body) === r.content_hash && v.content_hash === r.content_hash;
    const sigOk = r.status !== 'signed' && !r.signature_hash ? null : signatureHash({ requestId: r.id, versionId: r.version_id, contentHash: r.content_hash, signerUserId: r.signer_user_id, typedName: r.signer_typed_name, signedAt: new Date(r.signed_at).toISOString(), consentVersion: r.esign_consent_text_version, ip: r.signer_ip, imageHash: imageHash(r.signature_image) }) === r.signature_hash;
    return res.status(200).json({ intact: chain.ok && textOk && sigOk !== false, chain, document_text_matches: textOk, signature_record_matches: sigOk });
  }
  if (op === 'requests') {
    const scope = await visibleRepUserIds(caller);
    let q = 'sales_document_requests?order=created_at.desc&limit=300&select=id,template_id,version_id,signer_user_id,signer_email,status,sent_at,expires_at,viewed_at,signed_at,countersigned_at,declined_at,sales_document_templates(key,title,requires_countersign),sales_document_versions(version)';
    if (req.query?.status) q += `&status=eq.${enc(sanitize(req.query.status, 20))}`;
    if (req.query?.user_id) q += `&signer_user_id=eq.${enc(sanitize(req.query.user_id, 60))}`;
    if (scope) q += scope.length ? `&signer_user_id=in.${inList(scope)}` : '&signer_user_id=eq.00000000-0000-0000-0000-000000000000';
    const rows = await dbGet(q); const names = {}; for (const id of [...new Set(rows.map((r) => r.signer_user_id))]) names[id] = await displayNameOf(id);
    return res.status(200).json(rows.map((r) => ({ ...r, signer_name: names[r.signer_user_id] })));
  }

  // ------------------------------------------------------------------ signer: own documents only
  if (op === 'my-documents') {
    await sweepExpiredDocuments();
    const rows = await dbGet(`sales_document_requests?signer_user_id=eq.${enc(caller.id)}&order=created_at.desc&select=id,status,sent_at,expires_at,viewed_at,signed_at,declined_at,countersigned_at,sales_document_templates(key,title,requires_countersign),sales_document_versions(version)`);
    return res.status(200).json({ consent: { version: ESIGN_CONSENT_VERSION, text: ESIGN_CONSENT_TEXT }, requests: rows, states: await documentStatesFor(caller.id) });
  }
  const mine = async () => { const r = await dbOne(`sales_document_requests?id=eq.${enc(sanitize(req.query?.id || b.request_id, 60))}&signer_user_id=eq.${enc(caller.id)}&select=*`); return r ? expireIfNeeded(r) : null; };
  if (op === 'view') {
    const r = await mine(); if (!r) return bad(res, 404, 'Document not found');
    if (r.status === 'expired') return bad(res, 410, 'This request has expired. Ask Nova to send it again.');
    if (['void', 'superseded', 'declined'].includes(r.status)) return bad(res, 410, r.status === 'superseded' ? 'This version was replaced. Open the newer request.' : 'This request is closed.');
    const v = await dbOne(`sales_document_versions?id=eq.${enc(r.version_id)}&select=body,version,sales_document_templates(title)`);
    if (r.status === 'sent') { const [u] = await dbPatch('sales_document_requests', `id=eq.${enc(r.id)}&status=eq.sent`, { status: 'viewed', viewed_at: nowIso() }); if (u) await addEvent(r.id, 'viewed', caller.id, { ip: clientIp(req) }); }
    return res.status(200).json({ id: r.id, title: v.sales_document_templates.title, version: v.version, body: v.body, content_hash: r.content_hash, status: r.status === 'sent' ? 'viewed' : r.status, expires_at: r.expires_at, signed_at: r.signed_at, consent: { version: ESIGN_CONSENT_VERSION, text: ESIGN_CONSENT_TEXT } });
  }
  if (op === 'sign') {
    if (!need('POST')) return;
    if (!rateLimit(req, res, 10, 60_000)) return;
    const r = await mine(); if (!r) return bad(res, 404, 'Document not found');
    if (r.status === 'expired') return bad(res, 410, 'This request has expired. Ask Nova to send it again.');
    if (r.status === 'signed') return bad(res, 409, 'You already signed this document.');
    if (r.status !== 'viewed') return bad(res, 409, r.status === 'sent' ? 'Open and read the document before signing.' : 'This request is closed.');
    const rep = await dbOne(`sales_reps?user_id=eq.${enc(caller.id)}&select=status`); if (!rep || ['suspended', 'inactive'].includes(rep.status)) return bad(res, 403, 'Your account cannot sign documents right now.');
    if (b.consent !== true) return bad(res, 422, 'You must agree to sign electronically to continue.');
    if (b.content_hash !== r.content_hash) return bad(res, 409, 'The document changed since you opened it. Reload and read it again.');
    const nm = validateTypedName(b.typed_name); if (nm.error) return bad(res, 422, nm.error);
    const imgErr = validateSignatureImage(b.signature_image); if (imgErr) return bad(res, 422, imgErr);
    const signedAt = nowIso(); const ip = clientIp(req); const ua = sanitize(req.headers?.['user-agent'], 300) || null; const img = b.signature_image || null;
    const sigHash = signatureHash({ requestId: r.id, versionId: r.version_id, contentHash: r.content_hash, signerUserId: caller.id, typedName: nm.name, signedAt, consentVersion: ESIGN_CONSENT_VERSION, ip, imageHash: imageHash(img) });
    const [u] = await dbPatch('sales_document_requests', `id=eq.${enc(r.id)}&status=eq.viewed`, { status: 'signed', signed_at: signedAt, signer_typed_name: nm.name, signature_image: img, esign_consent: true, esign_consent_text_version: ESIGN_CONSENT_VERSION, signer_ip: ip, signer_user_agent: ua, signature_hash: sigHash });
    if (!u) return bad(res, 409, 'This document was just signed or closed.');
    await addEvent(r.id, 'signed', caller.id, { signature_hash: sigHash, has_drawn_signature: !!img });
    await audit(caller, 'document_request', r.id, 'signed', { template: r.template_id });
    const tpl = await dbOne(`sales_document_templates?id=eq.${enc(r.template_id)}&select=title,requires_countersign`);
    if (tpl?.requires_countersign) { await notifyOwners({ kind: 'document_needs_countersign', subject: `Countersign needed: ${tpl.title}`, body: `${nm.name} signed "${tpl.title}". Open Sales Team → Documents to countersign.`, link: '/dashboard/sales-team/documents', idempotencyKey: `doccsneed:${r.id}` }); }
    return res.status(200).json({ ok: true, signed_at: signedAt, signature_hash: sigHash, awaiting_countersign: !!tpl?.requires_countersign });
  }
  if (op === 'decline') {
    if (!need('POST')) return;
    const r = await mine(); if (!r) return bad(res, 404, 'Document not found');
    if (!['sent', 'viewed'].includes(r.status)) return bad(res, 409, 'This request is not open.');
    const reason = sanitize(b.reason, 500) || null;
    const [u] = await dbPatch('sales_document_requests', `id=eq.${enc(r.id)}&status=in.(sent,viewed)`, { status: 'declined', declined_at: nowIso(), decline_reason: reason });
    if (!u) return bad(res, 409, 'This request just changed.');
    await addEvent(r.id, 'declined', caller.id, { reason }); await audit(caller, 'document_request', r.id, 'declined', {});
    await notifyOwners({ kind: 'document_declined', subject: 'A document was declined', body: `${await displayNameOf(caller.id)} declined a document${reason ? `: ${reason}` : '.'}`, link: '/dashboard/sales-team/documents', idempotencyKey: `docdecl:${r.id}` });
    return res.status(200).json({ ok: true });
  }
  if (op === 'download') {
    const id = sanitize(req.query?.id, 60); const r = await dbOne(`sales_document_requests?id=eq.${enc(id)}&select=*`); if (!r) return bad(res, 404, 'Document not found');
    if (r.signer_user_id !== caller.id && !isOwner(caller)) return bad(res, 403, 'You can only download your own signed documents.');
    if (r.status !== 'signed') return bad(res, 409, 'Only a signed document can be downloaded.');
    const pdf = await signedPdf(r);
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="signed-${r.id}.pdf"`); res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(pdf);
  }
  return bad(res, 400, `Unknown documents operation: ${op}`);
});
