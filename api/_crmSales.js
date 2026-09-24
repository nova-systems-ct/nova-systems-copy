// Sales/pilot workflow + CRM completeness ops, dispatched from api/client.js (`crm` resource):
// pipeline, activities (notes/tasks/reminders), versioned proposals, contact export/duplicates/merge/import.
// Every op requires organization_id + a verified permission on THAT org, and every id supplied by the
// caller is checked to belong to the same org before it is read or written.
import { normalizePhone } from './_wave1.js';

export const DEAL_STAGES = ['new', 'assigned', 'attempted', 'connected', 'qualified', 'discovery', 'proposal', 'accepted', 'payment_condition_satisfied', 'onboarding', 'lost', 'disqualified', 'nurture', 'paused',
  'prospect', 'contacted', 'audit_ordered', 'audit_delivered', 'recommendation', 'pilot_agreement', 'installation', 'active_pilot', 'results_review', 'won_paid', 'won_extended', 'closed_no_conversion'];
export const TERMINAL_STAGES = new Set(['lost', 'disqualified', 'won_paid', 'won_extended', 'closed_no_conversion']);

// Returns an error string when the move is not allowed, else null. hasAcceptedProposal comes from the DB.
export function checkDealStageChange(existing, to, body, { hasAcceptedProposal }) {
  if (!DEAL_STAGES.includes(to)) return 'Invalid stage';
  if (TERMINAL_STAGES.has(existing.stage) && to !== existing.stage) return `A deal in "${existing.stage}" is closed — create a new deal instead of reopening it`;
  const need = (v) => String(v || '').trim().length > 0;
  if (['lost', 'closed_no_conversion'].includes(to) && !need(body.lost_reason) && !need(existing.lost_reason)) return 'A reason is required to close a deal as lost (loss reasons are recorded, not assumed)';
  if (['won_paid', 'won_extended'].includes(to) && !need(body.win_reason) && !need(existing.win_reason)) return 'A win reason is required (what actually made the customer say yes)';
  if (to === 'pilot_agreement' && !hasAcceptedProposal) return 'A proposal with recorded acceptance evidence is required before a deal can reach pilot_agreement';
  return null;
}

const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function handleCrmSales(req, res, op, caller, d) {
  const { sbSelect, sbWrite, requireOrgAccess, sanitize, sanitizeEmail, rateLimit } = d;
  const enc = encodeURIComponent;
  const b = req.body || {};
  const isGet = req.method === 'GET';
  if (!isGet && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, isGet ? 60 : 30, 60_000)) return;
  const orgId = sanitize(isGet ? req.query?.organization_id : b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'growth.view'))) return;
  const rows = async (path) => { const r = await sbSelect(path); return r.ok ? r.json() : []; };
  const inOrg = async (table, id) => !!id && (await rows(`${table}?id=eq.${enc(id)}&organization_id=eq.${enc(orgId)}&select=id&limit=1`)).length > 0;
  const fail = (code, error, extra = {}) => res.status(code).json({ error, ...extra });
  const now = () => new Date().toISOString();

  // ------------------------------------------------------------------ pipeline (owner view)
  if (op === 'pipeline' && isGet) {
    const owner = sanitize(req.query?.owner_user_id, 100);
    const deals = await rows(`crm_deals?organization_id=eq.${enc(orgId)}${owner ? `&owner_user_id=eq.${enc(owner)}` : ''}&order=updated_at.desc&limit=1000`);
    const byStage = {}; const open = deals.filter((x) => !TERMINAL_STAGES.has(x.stage));
    for (const x of deals) (byStage[x.stage] ||= []).push(x);
    const t = Date.now();
    return res.status(200).json({
      counts: Object.fromEntries(Object.entries(byStage).map(([k, v]) => [k, v.length])),
      by_stage: byStage,
      overdue_next_action: open.filter((x) => x.next_action_at && new Date(x.next_action_at).getTime() < t),
      no_next_action: open.filter((x) => !x.next_action_at),
    });
  }

  // ------------------------------------------------------------------ activities
  if (op === 'activities') {
    if (isGet) {
      let p = `crm_activities?organization_id=eq.${enc(orgId)}&order=created_at.desc&limit=200`;
      const dealId = sanitize(req.query?.deal_id, 100), contactId = sanitize(req.query?.contact_id, 100);
      if (dealId) p += `&deal_id=eq.${enc(dealId)}`; if (contactId) p += `&contact_id=eq.${enc(contactId)}`;
      if (req.query?.open === 'true') p += '&done_at=is.null&kind=in.(task,reminder)&order=due_at.asc';
      return res.status(200).json(await rows(p));
    }
    const action = sanitize(b.action, 20);
    if (action === 'create') {
      const kind = sanitize(b.kind, 10); const body = sanitize(b.body, 2000);
      if (!['note', 'task', 'reminder'].includes(kind)) return fail(400, 'kind must be note, task or reminder');
      if (!body) return fail(400, 'body is required');
      const dueAt = b.due_at ? new Date(b.due_at) : null;
      if (b.due_at && Number.isNaN(dueAt.getTime())) return fail(400, 'due_at is not a valid date');
      if (kind === 'reminder' && !dueAt) return fail(400, 'a reminder needs a due_at');
      const dealId = sanitize(b.deal_id, 100) || null, contactId = sanitize(b.contact_id, 100) || null;
      if (!dealId && !contactId) return fail(400, 'attach the activity to a deal or a contact');
      if (dealId && !(await inOrg('crm_deals', dealId))) return fail(400, 'deal_id does not belong to this organization');
      if (contactId && !(await inOrg('crm_contacts', contactId))) return fail(400, 'contact_id does not belong to this organization');
      const r = await sbWrite('crm_activities', 'POST', { organization_id: orgId, deal_id: dealId, contact_id: contactId, kind, body, due_at: dueAt ? dueAt.toISOString() : null, created_by: caller.id });
      return r.ok ? res.status(200).json({ ok: true, activity: (await r.json())[0] }) : fail(500, 'Failed to save activity');
    }
    if (action === 'complete') {
      const r = await sbWrite(`crm_activities?id=eq.${enc(sanitize(b.id, 100))}&organization_id=eq.${enc(orgId)}`, 'PATCH', { done_at: now() });
      const out = r.ok ? await r.json() : [];
      return out.length ? res.status(200).json({ ok: true, activity: out[0] }) : fail(404, 'Activity not found');
    }
    return fail(400, `Unknown action: ${action}`);
  }

  // ------------------------------------------------------------------ deal follow-up fields
  if (op === 'deal-plan' && !isGet) {
    const id = sanitize(b.id, 100);
    if (!(await inOrg('crm_deals', id))) return fail(404, 'Deal not found');
    const patch = { updated_at: now() };
    if (b.next_action !== undefined) patch.next_action = sanitize(b.next_action, 500) || null;
    if (b.next_action_at !== undefined) { const t = b.next_action_at ? new Date(b.next_action_at) : null; if (t && Number.isNaN(t.getTime())) return fail(400, 'next_action_at is not a valid date'); patch.next_action_at = t ? t.toISOString() : null; }
    if (b.discovery !== undefined) { if (!b.discovery || typeof b.discovery !== 'object' || Array.isArray(b.discovery)) return fail(400, 'discovery must be an object'); patch.discovery = b.discovery; }
    if (b.owner_user_id !== undefined) patch.owner_user_id = sanitize(b.owner_user_id, 100) || null;
    const r = await sbWrite(`crm_deals?id=eq.${enc(id)}&organization_id=eq.${enc(orgId)}`, 'PATCH', patch);
    return r.ok ? res.status(200).json({ ok: true, deal: (await r.json())[0] }) : fail(500, 'Failed to update deal');
  }

  // ------------------------------------------------------------------ proposals (versioned)
  if (op === 'proposals') {
    if (isGet) {
      const dealId = sanitize(req.query?.deal_id, 100);
      if (!dealId) return fail(400, 'deal_id is required');
      return res.status(200).json(await rows(`crm_proposals?organization_id=eq.${enc(orgId)}&deal_id=eq.${enc(dealId)}&order=version.desc`));
    }
    const action = sanitize(b.action, 20);
    if (action === 'create-draft') {
      const dealId = sanitize(b.deal_id, 100);
      if (!(await inOrg('crm_deals', dealId))) return fail(404, 'Deal not found');
      const scope = b.scope && typeof b.scope === 'object' && !Array.isArray(b.scope) ? b.scope : {};
      const items = Array.isArray(scope.items) ? scope.items : [];
      const price = b.price_cents === undefined || b.price_cents === null || b.price_cents === '' ? null : Number(b.price_cents);
      if (price !== null && (!Number.isInteger(price) || price < 0)) return fail(400, 'price_cents must be a non-negative integer');
      const products = [];
      for (const it of items) {
        const pid = sanitize(it.product_id, 100);
        const [p] = await rows(`products?id=eq.${enc(pid)}&select=id,name,pricing_approved&limit=1`);
        if (!p) return fail(400, `Unknown product in scope: ${pid}`);
        products.push(p);
        if (it.recommendation_id) {
          const [rec] = await rows(`audit_recommendations?id=eq.${enc(sanitize(it.recommendation_id, 100))}&select=id,audit_cases!inner(organization_id)&audit_cases.organization_id=eq.${enc(orgId)}&limit=1`);
          if (!rec) return fail(400, 'A recommendation in scope does not belong to this organization');
        }
      }
      // Pricing is never invented or defaulted: a price may only be recorded when every product it covers
      // has had its pricing explicitly approved in the catalog.
      const unapproved = products.filter((p) => !p.pricing_approved);
      if (price !== null && (!products.length || unapproved.length)) return fail(409, unapproved.length ? `Pricing is not approved for: ${unapproved.map((p) => p.name).join(', ')}. Leave the price empty until it is` : 'A price needs at least one scoped product');
      const latest = (await rows(`crm_proposals?deal_id=eq.${enc(dealId)}&organization_id=eq.${enc(orgId)}&select=version&order=version.desc&limit=1`))[0]?.version || 0;
      await sbWrite(`crm_proposals?deal_id=eq.${enc(dealId)}&organization_id=eq.${enc(orgId)}&status=in.(draft,sent)`, 'PATCH', { status: 'superseded' });
      const r = await sbWrite('crm_proposals', 'POST', { organization_id: orgId, deal_id: dealId, version: latest + 1, status: 'draft', scope, price_cents: price, currency: sanitize(b.currency, 10) || 'USD', created_by: caller.id });
      return r.ok ? res.status(200).json({ ok: true, proposal: (await r.json())[0] }) : fail(500, 'Failed to create proposal');
    }
    const id = sanitize(b.id, 100);
    const [prop] = await rows(`crm_proposals?id=eq.${enc(id)}&organization_id=eq.${enc(orgId)}&limit=1`);
    if (!prop) return fail(404, 'Proposal not found');
    const [newest] = await rows(`crm_proposals?deal_id=eq.${enc(prop.deal_id)}&organization_id=eq.${enc(orgId)}&select=version&order=version.desc&limit=1`);
    if (newest && newest.version > prop.version) return fail(409, `Superseded by v${newest.version}`);
    const patchTo = async (patch, from) => {
      const r = await sbWrite(`crm_proposals?id=eq.${enc(id)}&organization_id=eq.${enc(orgId)}&status=eq.${from}`, 'PATCH', patch);
      const out = r.ok ? await r.json() : [];
      return out.length ? res.status(200).json({ ok: true, proposal: out[0] }) : fail(409, `Proposal is no longer ${from}`);
    };
    if (action === 'send') { if (prop.status !== 'draft') return fail(409, 'Only a draft can be sent'); return patchTo({ status: 'sent' }, 'draft'); }
    if (action === 'accept') {
      if (prop.status !== 'sent') return fail(409, 'Only a sent proposal can be accepted');
      const ev = sanitize(b.acceptance_evidence, 500);
      if (!ev) return fail(400, 'Recording acceptance requires acceptance_evidence (e.g. signed-document or email reference)');
      return patchTo({ status: 'accepted', acceptance_evidence: ev, accepted_at: now() }, 'sent');
    }
    if (action === 'decline') { if (!['draft', 'sent'].includes(prop.status)) return fail(409, 'Only an open proposal can be declined'); return patchTo({ status: 'declined' }, prop.status); }
    return fail(400, `Unknown action: ${action}`);
  }

  // ------------------------------------------------------------------ contacts: export / duplicates / merge / import
  const liveContacts = () => rows(`crm_contacts?organization_id=eq.${enc(orgId)}&merged_into_id=is.null&order=created_at.asc&limit=5000`);
  const phoneOf = (c) => normalizePhone(c.phone_e164 || c.phone);

  if (op === 'contacts-export' && isGet) {
    const cs = await liveContacts();
    const head = ['id', 'name', 'email', 'phone', 'title', 'source', 'sms_consent', 'sms_consent_source', 'sms_consent_at', 'email_consent', 'do_not_contact', 'suppressed', 'created_at'];
    const csv = [head.join(','), ...cs.map((c) => head.map((h) => csvCell(c[h])).join(','))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    return res.status(200).send(csv);
  }

  if (op === 'contacts-duplicates' && isGet) {
    const cs = await liveContacts(); const groups = new Map();
    for (const c of cs) for (const k of [phoneOf(c) && `phone:${phoneOf(c)}`, c.email && `email:${String(c.email).trim().toLowerCase()}`].filter(Boolean)) (groups.get(k) || groups.set(k, []).get(k)).push(c);
    const seen = new Set(); const out = [];
    for (const [key, list] of groups) { if (list.length < 2) continue; const sig = list.map((c) => c.id).sort().join('|'); if (seen.has(sig)) continue; seen.add(sig); out.push({ matched_on: key, contacts: list }); }
    return res.status(200).json({ groups: out, note: 'Candidates only — nothing is merged automatically. Review each group, then call contacts-merge.' });
  }

  if (op === 'contacts-merge' && !isGet) {
    const keepId = sanitize(b.keep_id, 100), dropId = sanitize(b.drop_id, 100);
    if (!keepId || !dropId || keepId === dropId) return fail(400, 'keep_id and drop_id are required and must differ');
    const [keep] = await rows(`crm_contacts?id=eq.${enc(keepId)}&organization_id=eq.${enc(orgId)}&limit=1`);
    const [drop] = await rows(`crm_contacts?id=eq.${enc(dropId)}&organization_id=eq.${enc(orgId)}&limit=1`);
    if (!keep || !drop) return fail(404, 'Both contacts must exist in this organization');
    if (keep.merged_into_id || drop.merged_into_id) return fail(409, 'A merged contact cannot be merged again');
    const dropDeals = await rows(`crm_deals?organization_id=eq.${enc(orgId)}&contact_id=eq.${enc(dropId)}&select=id`);
    const dropConvs = await rows(`wave1_conversations?organization_id=eq.${enc(orgId)}&contact_id=eq.${enc(dropId)}&select=id,channel,staff_takeover`);
    const preview = { keep: { id: keep.id, name: keep.name }, drop: { id: drop.id, name: drop.name }, deals_moved: dropDeals.length, conversations_affected: dropConvs.length, suppression_carried: !!(drop.suppressed || drop.do_not_contact) };
    if (b.confirm !== true) return res.status(200).json({ ok: true, dry_run: true, preview, note: 'Nothing changed. Send confirm: true to merge.' });

    // 1. Opt-outs travel with the person: applied to the surviving record FIRST, so an interrupted merge can never leave a suppressed number contactable.
    const keepPatch = { updated_at: now() };
    if (drop.suppressed && !keep.suppressed) Object.assign(keepPatch, { suppressed: true, suppressed_at: drop.suppressed_at || now(), suppression_source: drop.suppression_source || 'merge' });
    if (drop.do_not_contact) keepPatch.do_not_contact = true;
    if (!keep.email && drop.email) keepPatch.email = drop.email;
    if (!keep.phone && drop.phone) keepPatch.phone = drop.phone;
    // Consent is attached to a specific number: carried only when both records are the SAME number and keep has none.
    if (!keep.sms_consent && drop.sms_consent && drop.sms_consent_at && phoneOf(keep) && phoneOf(keep) === phoneOf(drop)) Object.assign(keepPatch, { sms_consent: true, sms_consent_source: drop.sms_consent_source, sms_consent_at: drop.sms_consent_at });
    let r = await sbWrite(`crm_contacts?id=eq.${enc(keepId)}&organization_id=eq.${enc(orgId)}`, 'PATCH', keepPatch);
    if (!r.ok) return fail(500, 'Merge stopped before moving anything (could not update the surviving contact)');

    // 2. Re-point owned records (each step is idempotent — re-running a failed merge completes it).
    for (const table of ['crm_deals', 'crm_activities', 'wave1_appointments']) {
      r = await sbWrite(`${table}?organization_id=eq.${enc(orgId)}&contact_id=eq.${enc(dropId)}`, 'PATCH', { contact_id: keepId });
      if (!r.ok && table !== 'wave1_appointments') return fail(500, `Merge stopped while moving ${table}; safe to retry`);
    }
    for (const conv of dropConvs) {
      const [twin] = await rows(`wave1_conversations?organization_id=eq.${enc(orgId)}&contact_id=eq.${enc(keepId)}&channel=eq.${enc(conv.channel)}&limit=1`);
      if (!twin) { r = await sbWrite(`wave1_conversations?id=eq.${enc(conv.id)}&organization_id=eq.${enc(orgId)}`, 'PATCH', { contact_id: keepId }); if (!r.ok) return fail(500, 'Merge stopped while moving a conversation; safe to retry'); continue; }
      r = await sbWrite(`wave1_messages?organization_id=eq.${enc(orgId)}&conversation_id=eq.${enc(conv.id)}`, 'PATCH', { conversation_id: twin.id });
      if (!r.ok) return fail(500, 'Merge stopped while moving messages; safe to retry');
      if (conv.staff_takeover) await sbWrite(`wave1_conversations?id=eq.${enc(twin.id)}&organization_id=eq.${enc(orgId)}`, 'PATCH', { staff_takeover: true });
      await sbWrite(`wave1_conversations?id=eq.${enc(conv.id)}&organization_id=eq.${enc(orgId)}`, 'DELETE', undefined);
    }
    // 3. Retire the duplicate (kept, not deleted, so history and the audit trail stay intact) and free its unique identifiers.
    r = await sbWrite(`crm_contacts?id=eq.${enc(dropId)}&organization_id=eq.${enc(orgId)}`, 'PATCH', { merged_into_id: keepId, merged_at: now(), do_not_contact: true, ...(drop.phone_e164 !== undefined ? { phone_e164: null } : {}), updated_at: now() });
    if (!r.ok) return fail(500, 'Merge moved the records but could not retire the duplicate; safe to retry');
    await sbWrite('crm_activities', 'POST', { organization_id: orgId, contact_id: keepId, kind: 'note', body: `Merged duplicate contact "${drop.name}" (${dropId}) into this record.`, created_by: caller.id });
    return res.status(200).json({ ok: true, preview });
  }

  if (op === 'contacts-import' && !isGet) {
    const list = Array.isArray(b.rows) ? b.rows : null;
    if (!list || !list.length) return fail(400, 'rows must be a non-empty array');
    if (list.length > 500) return fail(400, 'At most 500 rows per import');
    const existing = await liveContacts();
    const seenPhones = new Set(existing.map(phoneOf).filter(Boolean)); const seenEmails = new Set(existing.map((c) => String(c.email || '').trim().toLowerCase()).filter(Boolean));
    const results = []; let created = 0;
    for (const [i, row] of list.entries()) {
      const name = sanitize(row?.name, 200); const phone = row?.phone ? normalizePhone(row.phone) : null; const email = row?.email ? sanitizeEmail(row.email) : null;
      if (!name) { results.push({ row: i, status: 'invalid', reason: 'name is required' }); continue; }
      if (row.phone && !phone) { results.push({ row: i, status: 'invalid', reason: 'phone is not a valid number' }); continue; }
      if (row.email && !email) { results.push({ row: i, status: 'invalid', reason: 'email is not valid' }); continue; }
      if (!phone && !email) { results.push({ row: i, status: 'invalid', reason: 'a phone or email is required' }); continue; }
      if ((phone && seenPhones.has(phone)) || (email && seenEmails.has(email.toLowerCase()))) { results.push({ row: i, status: 'duplicate' }); continue; }
      // An import can NEVER grant consent: consent needs a recorded source and timestamp from the person themselves.
      const rec = { organization_id: orgId, name, email, phone: sanitize(row.phone, 30) || null, source: sanitize(b.source, 100) || 'import', sms_consent: false, email_consent: false };
      let w = await sbWrite('crm_contacts', 'POST', phone ? { ...rec, phone_e164: phone } : rec);
      if (!w.ok && phone) w = await sbWrite('crm_contacts', 'POST', rec); // wave1 migration (phone_e164) not applied yet
      if (!w.ok) { results.push({ row: i, status: 'error' }); continue; }
      if (phone) seenPhones.add(phone); if (email) seenEmails.add(email.toLowerCase());
      created++; results.push({ row: i, status: 'created' });
    }
    return res.status(200).json({ ok: true, created, duplicates: results.filter((x) => x.status === 'duplicate').length, invalid: results.filter((x) => x.status === 'invalid').length, errors: results.filter((x) => x.status === 'error').length, results });
  }

  return fail(400, `Unknown crm op: ${op}`);
}
