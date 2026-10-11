// Leads, contacts and the rep pipeline — on the SAME crm_deals / crm_contacts / businesses / crm_activities tables the rest of Nova uses.
// A rep can only ever reach deals where assigned_rep_id = their own user id (server-enforced; tables are API-only). Managers reach
// deals of the reps assigned to them; the owner reaches everything. No metric here is invented: everything is counted from stored rows.
import crypto from 'node:crypto';
import { sanitize, sanitizeEmail, sanitizePhone } from '../_sanitize.js';
import { rateLimit } from '../_rateLimit.js';
import { dbGet, dbOne, dbInsert, dbPatch, dbFetch, enc, inList, nowIso, audit, bad, wrap, requirePerm, requireActiveRep, isOwner, visibleRepUserIds, displayNameOf, notify, novaOrgId, authUserById } from './core.js';
import { STAGES, STAGE_LABELS, OPEN_STAGES, OUTREACH_KINDS, ACTIVITY_KINDS, OUTCOMES, LOST_REASONS, checkRepMove, isOpen, prospectKeys, validateProspect, DISCOVERY_FIELDS } from './pipelineRules.js';
import { documentStatesFor } from './documents.js';

const DEAL_REP_FIELDS = 'id,stage,pipeline,next_action,next_action_at,qualification,discovery,discovery_at,lost_reason,lost_reason_code,reopened_count,lead_source_kind,source,contact_id,business_id,assigned_rep_id,created_at,updated_at,closed_at,rep_reported_close_at,owner_verified_at,signed_agreement_at,invoice_issued_at,payment_received_at,fulfillment_started_at';
const CONTACT_FIELDS = 'id,name,email,phone,title,do_not_contact,sms_consent,email_consent,source';
const BUSINESS_FIELDS = 'id,name,website,phone,city,state,industry,notes';
const ago = (ms) => new Date(Date.now() - ms).toISOString();

async function claimKeys(keys, dealId) {
  const claimed = [];
  for (const key of keys) {
    const ins = await dbInsert('sales_lead_keys', { key, deal_id: dealId, active: true });
    if (ins.conflict || !ins.row) { for (const k of claimed) await dbFetch(`sales_lead_keys?key=eq.${enc(k)}&deal_id=eq.${enc(dealId)}`, { method: 'DELETE' }); return { conflict: key }; }
    claimed.push(key);
  }
  return { claimed };
}
const setKeysActive = (dealId, active) => dbPatch('sales_lead_keys', `deal_id=eq.${enc(dealId)}`, { active });

// Create business + contact + deal for a prospect. `assignee` may be null (unassigned pool) for owner-created leads.
export async function createProspect({ actor, actorKind, assignee, b, sourceKind }) {
  const errors = validateProspect(b); if (Object.keys(errors).length) return { status: 422, error: 'Please fix the highlighted fields.', errors };
  const keys = prospectKeys({ business_name: b.business_name, website: b.website, phone: b.phone, email: b.email, city: b.city, contact_phone: b.contact_phone, contact_email: b.contact_email });
  const dealId = crypto.randomUUID(); const claim = await claimKeys(keys, dealId);
  if (claim.conflict) {
    const existing = await dbOne(`sales_lead_keys?key=eq.${enc(claim.conflict)}&active=eq.true&select=deal_id`);
    return { status: 409, duplicate: true, existing_deal_id: actorKind === 'rep' ? undefined : existing?.deal_id, error: actorKind === 'rep' ? 'This business is already being worked. If you think this is a mistake, ask your manager — no details are shared between representatives.' : 'A matching active lead already exists.' };
  }
  const org = await novaOrgId();
  try {
    const biz = await dbInsert('businesses', { organization_id: org, name: sanitize(b.business_name, 200), website: sanitize(b.website, 200) || null, phone: sanitizePhone(b.phone) || null, city: sanitize(b.city, 100) || null, state: sanitize(b.state, 50) || null, industry: sanitize(b.industry, 100) || null, notes: sanitize(b.notes, 1000) || null });
    const email = sanitizeEmail(b.contact_email || b.email) || null;
    const contact = await dbInsert('crm_contacts', { organization_id: org, business_id: biz.row.id, name: sanitize(b.contact_name, 150), email, phone: sanitizePhone(b.contact_phone || b.phone) || null, title: sanitize(b.contact_title, 100) || null, source: sanitize(b.source, 100) || sourceKind });
    const deal = await dbInsert('crm_deals', { id: dealId, organization_id: org, business_id: biz.row.id, contact_id: contact.row.id, pipeline: 'nova_sales', stage: 'new', assigned_rep_id: assignee || null, owner_user_id: assignee || null, lead_source_kind: sourceKind, source: sanitize(b.source, 100) || sourceKind });
    if (assignee) await dbInsert('sales_lead_assignments', { deal_id: dealId, from_user: null, to_user: assignee, assigned_by: actor.id, reason: sourceKind === 'rep_sourced' ? 'Rep-sourced prospect' : 'Initial assignment' });
    await dbInsert('sales_deal_stage_events', { deal_id: dealId, from_stage: null, to_stage: 'new', actor_id: actor.id, actor_kind: actorKind, reason: 'Lead created' });
    await audit(actor, 'crm_deal', dealId, 'lead_created', { source: sourceKind, assignee: assignee || null });
    return { status: 200, deal: deal.row, business: biz.row, contact: contact.row };
  } catch (e) { await dbFetch(`sales_lead_keys?deal_id=eq.${enc(dealId)}`, { method: 'DELETE' }); throw e; }
}

async function stageEvent(dealId, from, to, actor, actorKind, reason, detail = {}) {
  await dbInsert('sales_deal_stage_events', { deal_id: dealId, from_stage: from, to_stage: to, actor_id: actor?.id || null, actor_kind: actorKind, reason: reason || null, detail });
}
// Change stage with optimistic concurrency (only if the deal is still in `deal.stage`).
export async function applyStage(deal, to, { actor, actorKind = 'rep', reason = null, extra = {}, detail = {} }) {
  const patch = { stage: to, updated_at: nowIso(), ...extra };
  if (to === 'lost') patch.closed_at = nowIso();
  if (deal.stage === 'lost' && to !== 'lost') patch.closed_at = null;
  const [row] = await dbPatch('crm_deals', `id=eq.${enc(deal.id)}&stage=eq.${enc(deal.stage)}`, patch);
  if (!row) return null;
  await stageEvent(deal.id, deal.stage, to, actor, actorKind, reason, detail);
  return row;
}

export async function loadDealFor(caller, dealId, { requireAssigned = true } = {}) {
  const deal = await dbOne(`crm_deals?id=eq.${enc(sanitize(dealId, 60))}&pipeline=eq.nova_sales&select=*`);
  if (!deal) return { status: 404, error: 'Lead not found' };
  if (requireAssigned && deal.assigned_rep_id !== caller.id) return { status: 404, error: 'Lead not found' }; // 404, not 403: do not confirm that other reps' leads exist
  return { deal };
}

export const handleLeads = wrap(async (req, res, op) => {
  const b = req.body || {};
  const need = (m) => { if (req.method !== m) { bad(res, 405, 'Method not allowed'); return false; } return true; };
  const repOps = ['home', 'list', 'get', 'create', 'update-contact', 'move', 'log-activity', 'complete-task', 'mark-dnc', 'set-next-action', 'meta'];
  const ownerOps = ['owner-create', 'import', 'reassign-from-rep', 'stage-override', 'clear-dnc'];
  const isRep = repOps.includes(op);
  const caller = isRep ? await requireActiveRep(req, res) : await requirePerm(req, res, ownerOps.includes(op) ? 'sales.owner' : 'sales.manage');
  if (!caller) return;
  if (!rateLimit(req, res, 120, 60_000)) return;
  const org = await novaOrgId();

  // ================================================================== representative
  if (op === 'meta') return res.status(200).json({ stages: STAGES.map((s) => ({ key: s, label: STAGE_LABELS[s] })), lost_reasons: LOST_REASONS, outcomes: OUTCOMES, activity_kinds: ACTIVITY_KINDS, discovery_fields: DISCOVERY_FIELDS });

  if (op === 'home') {
    const deals = await dbGet(`crm_deals?assigned_rep_id=eq.${enc(caller.id)}&pipeline=eq.nova_sales&select=id,stage,next_action,next_action_at,discovery_at,updated_at,business_id,contact_id&limit=2000`);
    const open = deals.filter((d) => isOpen(d.stage)); const now = Date.now(); const in7 = now + 7 * 86400_000;
    const tasks = await dbGet(`crm_activities?rep_user_id=eq.${enc(caller.id)}&kind=in.(task,reminder)&done_at=is.null&select=id,deal_id,kind,body,due_at&order=due_at.asc&limit=100`);
    const [enrolls, programs, docStates] = await Promise.all([dbGet(`academy_enrollments?staff_user_id=eq.${enc(caller.id)}&select=status`), dbGet('academy_programs?select=id'), documentStatesFor(caller.id)]);
    const names = new Map(); const bizIds = [...new Set(deals.map((d) => d.business_id).filter(Boolean))];
    if (bizIds.length) for (const x of await dbGet(`businesses?id=in.${inList(bizIds)}&select=id,name`)) names.set(x.id, x.name);
    const label = (d) => ({ deal_id: d.id, business: names.get(d.business_id) || 'Unnamed business', stage: d.stage });
    const overdue = open.filter((d) => d.next_action_at && new Date(d.next_action_at).getTime() < now);
    const dueToday = open.filter((d) => d.next_action_at && new Date(d.next_action_at).getTime() >= now && new Date(d.next_action_at).getTime() < now + 86400_000);
    return res.status(200).json({
      counts: { open: open.length, won: deals.filter((d) => d.stage === 'won').length, lost: deals.filter((d) => d.stage === 'lost').length, by_stage: Object.fromEntries(STAGES.map((s) => [s, deals.filter((d) => d.stage === s).length])) },
      new_uncontacted: deals.filter((d) => d.stage === 'new').map(label),
      follow_ups_overdue: overdue.map((d) => ({ ...label(d), next_action: d.next_action, next_action_at: d.next_action_at })),
      follow_ups_due_today: dueToday.map((d) => ({ ...label(d), next_action: d.next_action, next_action_at: d.next_action_at })),
      upcoming_discovery: open.filter((d) => d.stage === 'discovery_scheduled' && d.discovery_at && new Date(d.discovery_at).getTime() < in7).map((d) => ({ ...label(d), discovery_at: d.discovery_at })),
      no_next_action: open.filter((d) => !d.next_action_at && d.stage !== 'submitted_for_verification').length,
      open_tasks: tasks,
      training: { programs_total: programs.length, programs_completed: enrolls.filter((e) => e.status === 'completed').length },
      documents_outstanding: Object.entries(docStates).filter(([, s]) => !s.satisfied).map(([key, s]) => ({ key, title: s.title, state: s.state })),
    });
  }

  if (op === 'list') {
    let q = `crm_deals?assigned_rep_id=eq.${enc(caller.id)}&pipeline=eq.nova_sales&select=${DEAL_REP_FIELDS}&order=updated_at.desc&limit=500`;
    if (req.query?.stage && STAGES.includes(req.query.stage)) q += `&stage=eq.${enc(req.query.stage)}`;
    const deals = await dbGet(q); const bizIds = [...new Set(deals.map((d) => d.business_id).filter(Boolean))], conIds = [...new Set(deals.map((d) => d.contact_id).filter(Boolean))];
    const [biz, con] = await Promise.all([bizIds.length ? dbGet(`businesses?id=in.${inList(bizIds)}&select=${BUSINESS_FIELDS}`) : [], conIds.length ? dbGet(`crm_contacts?id=in.${inList(conIds)}&select=${CONTACT_FIELDS}`) : []]);
    const search = sanitize(req.query?.q, 80).toLowerCase();
    const rows = deals.map((d) => ({ ...d, business: biz.find((x) => x.id === d.business_id) || null, contact: con.find((x) => x.id === d.contact_id) || null })).filter((d) => !search || `${d.business?.name} ${d.contact?.name}`.toLowerCase().includes(search));
    return res.status(200).json(rows);
  }

  if (op === 'get') {
    const r = await loadDealFor(caller, req.query?.id); if (r.error) return bad(res, r.status, r.error);
    const d = r.deal;
    const [business, contact, activities, events, assignments] = await Promise.all([d.business_id ? dbOne(`businesses?id=eq.${enc(d.business_id)}&select=${BUSINESS_FIELDS}`) : null, d.contact_id ? dbOne(`crm_contacts?id=eq.${enc(d.contact_id)}&select=${CONTACT_FIELDS}`) : null, dbGet(`crm_activities?deal_id=eq.${enc(d.id)}&order=created_at.desc&limit=200&select=id,kind,body,outcome,due_at,done_at,occurred_at,created_at,rep_user_id`), dbGet(`sales_deal_stage_events?deal_id=eq.${enc(d.id)}&order=created_at.asc&select=from_stage,to_stage,actor_kind,reason,created_at`), dbGet(`sales_lead_assignments?deal_id=eq.${enc(d.id)}&order=created_at.asc&select=created_at,reason`)]);
    const picked = Object.fromEntries(DEAL_REP_FIELDS.split(',').map((k) => [k, d[k]]));
    return res.status(200).json({ deal: picked, business, contact, activities, stage_history: events, assignment_history: assignments });
  }

  if (op === 'create') {
    if (!need('POST')) return;
    if (!rateLimit(req, res, 20, 60_000)) return;
    const out = await createProspect({ actor: caller, actorKind: 'rep', assignee: caller.id, b, sourceKind: 'rep_sourced' });
    return res.status(out.status).json(out.status === 200 ? { ok: true, deal_id: out.deal.id } : { error: out.error, errors: out.errors, duplicate: out.duplicate });
  }

  if (op === 'update-contact') {
    if (!need('POST')) return;
    const r = await loadDealFor(caller, b.deal_id); if (r.error) return bad(res, r.status, r.error);
    const patch = { updated_at: nowIso() };
    if (b.name !== undefined) { const n = sanitize(b.name, 150); if (!n) return bad(res, 422, 'A contact needs a name.'); patch.name = n; }
    if (b.email !== undefined) patch.email = b.email ? sanitizeEmail(b.email) || null : null;
    if (b.phone !== undefined) patch.phone = sanitizePhone(b.phone) || null;
    if (b.title !== undefined) patch.title = sanitize(b.title, 100) || null;
    // Consent flags are NOT settable here: a rep cannot grant consent on someone's behalf.
    if (!r.deal.contact_id) return bad(res, 409, 'This lead has no contact yet.');
    const [row] = await dbPatch('crm_contacts', `id=eq.${enc(r.deal.contact_id)}&organization_id=eq.${enc(org)}`, patch);
    return res.status(200).json({ ok: true, contact: row && Object.fromEntries(CONTACT_FIELDS.split(',').map((k) => [k, row[k]])) });
  }

  if (op === 'set-next-action') {
    if (!need('POST')) return;
    const r = await loadDealFor(caller, b.deal_id); if (r.error) return bad(res, r.status, r.error);
    if (!isOpen(r.deal.stage)) return bad(res, 409, 'This lead is closed.');
    const at = new Date(b.next_action_at); if (!b.next_action_at || Number.isNaN(at.getTime())) return bad(res, 422, 'Choose when.');
    const text = sanitize(b.next_action, 300); if (text.length < 3) return bad(res, 422, 'Describe the next step.');
    await dbPatch('crm_deals', `id=eq.${enc(r.deal.id)}`, { next_action: text, next_action_at: at.toISOString(), updated_at: nowIso() });
    return res.status(200).json({ ok: true });
  }

  if (op === 'log-activity') {
    if (!need('POST')) return;
    const r = await loadDealFor(caller, b.deal_id); if (r.error) return bad(res, r.status, r.error);
    const kind = sanitize(b.kind, 20); if (!ACTIVITY_KINDS.includes(kind)) return bad(res, 422, 'Unknown activity type.');
    const body = sanitize(b.body, 2000); if (body.length < 3) return bad(res, 422, 'Write what happened (a few words is fine).');
    if (b.outcome && !OUTCOMES.includes(b.outcome)) return bad(res, 422, 'Unknown outcome.');
    const contact = r.deal.contact_id ? await dbOne(`crm_contacts?id=eq.${enc(r.deal.contact_id)}&select=id,do_not_contact`) : null;
    if (OUTREACH_KINDS.includes(kind) && contact?.do_not_contact) return bad(res, 409, 'This contact asked not to be contacted. Do not reach out again.');
    if (['task', 'reminder'].includes(kind)) { const t = new Date(b.due_at); if (!b.due_at || Number.isNaN(t.getTime())) return bad(res, 422, 'A task or reminder needs a due date.'); }
    let occurred = b.occurred_at ? new Date(b.occurred_at) : new Date(); if (Number.isNaN(occurred.getTime()) || occurred.getTime() > Date.now() + 5 * 60_000) return bad(res, 422, 'The time of the activity cannot be in the future.');
    const ins = await dbInsert('crm_activities', { organization_id: org, deal_id: r.deal.id, contact_id: r.deal.contact_id, kind, body, outcome: b.outcome || null, due_at: ['task', 'reminder'].includes(kind) ? new Date(b.due_at).toISOString() : null, occurred_at: occurred.toISOString(), created_by: caller.id, rep_user_id: caller.id });
    const patch = { updated_at: nowIso() };
    if (b.next_action) { const at = new Date(b.next_action_at); if (Number.isNaN(at.getTime())) return bad(res, 422, 'Choose when the next step is due.'); patch.next_action = sanitize(b.next_action, 300); patch.next_action_at = at.toISOString(); }
    await dbPatch('crm_deals', `id=eq.${enc(r.deal.id)}`, patch);
    return res.status(200).json({ ok: true, activity_id: ins.row.id });
  }

  if (op === 'complete-task') {
    if (!need('POST')) return;
    const a = await dbOne(`crm_activities?id=eq.${enc(sanitize(b.id, 60))}&rep_user_id=eq.${enc(caller.id)}&kind=in.(task,reminder)&select=id,deal_id`); if (!a) return bad(res, 404, 'Task not found');
    await dbPatch('crm_activities', `id=eq.${enc(a.id)}&done_at=is.null`, { done_at: nowIso() });
    return res.status(200).json({ ok: true });
  }

  if (op === 'mark-dnc') {
    if (!need('POST')) return;
    const r = await loadDealFor(caller, b.deal_id); if (r.error) return bad(res, r.status, r.error);
    if (!r.deal.contact_id) return bad(res, 409, 'No contact on this lead.');
    await dbPatch('crm_contacts', `id=eq.${enc(r.deal.contact_id)}&organization_id=eq.${enc(org)}`, { do_not_contact: true, sms_consent: false, email_consent: false, updated_at: nowIso() });
    await dbInsert('crm_activities', { organization_id: org, deal_id: r.deal.id, contact_id: r.deal.contact_id, kind: 'note', body: `Contact asked not to be contacted. ${sanitize(b.note, 300)}`.trim(), created_by: caller.id, rep_user_id: caller.id, occurred_at: nowIso() });
    await audit(caller, 'crm_contact', r.deal.contact_id, 'do_not_contact_set', { deal: r.deal.id });
    if (isOpen(r.deal.stage) && r.deal.stage !== 'submitted_for_verification') { await applyStage(r.deal, 'lost', { actor: caller, reason: 'Contact asked not to be contacted', extra: { lost_reason: 'Contact asked not to be contacted', lost_reason_code: 'other' } }); await setKeysActive(r.deal.id, false); }
    return res.status(200).json({ ok: true });
  }

  if (op === 'move') {
    if (!need('POST')) return;
    const r = await loadDealFor(caller, b.deal_id); if (r.error) return bad(res, r.status, r.error);
    const deal = r.deal; const to = sanitize(b.to, 40);
    if (!STAGES.includes(to)) return bad(res, 422, 'Unknown stage.');
    const [contact, outreach, proposals] = await Promise.all([deal.contact_id ? dbOne(`crm_contacts?id=eq.${enc(deal.contact_id)}&select=id,name,do_not_contact`) : null, dbGet(`crm_activities?deal_id=eq.${enc(deal.id)}&kind=in.${inList(OUTREACH_KINDS)}&select=id&limit=1`), dbGet(`crm_proposals?deal_id=eq.${enc(deal.id)}&status=in.(draft,pending_approval,sent,viewed,signed,accepted)&select=id&limit=1`)]);
    const chk = checkRepMove(deal, to, b, { outreachCount: outreach.length, hasDraftProposal: proposals.length > 0, contact });
    if (!chk.ok) return res.status(422).json({ error: chk.error, problems: chk.problems });
    const extra = {};
    if (to === 'qualified') extra.qualification = { summary: sanitize(b.qualification?.summary, 1000), decision_maker: b.qualification?.decision_maker, notes: sanitize(b.qualification?.notes, 1000) || undefined };
    if (to === 'discovery_scheduled') extra.discovery_at = new Date(b.discovery_at).toISOString();
    if (to === 'discovery_completed') extra.discovery = Object.fromEntries([...DISCOVERY_FIELDS, 'findings'].map((k) => [k, sanitize(b.discovery?.[k], 1500)]));
    if (to === 'lost') { extra.lost_reason = sanitize(b.reason, 500); extra.lost_reason_code = b.lost_reason_code; }
    if (chk.reopen) { extra.reopened_count = (deal.reopened_count || 0) + 1; extra.lost_reason = null; extra.lost_reason_code = null; extra.next_action = 'Follow up on reopened lead'; extra.next_action_at = new Date(Date.now() + 86400_000).toISOString(); }
    if (chk.reopen) { // the prospect may have been claimed by someone else while this was lost
      const keys = await dbGet(`sales_lead_keys?deal_id=eq.${enc(deal.id)}&select=key`); for (const k of keys) { const other = await dbOne(`sales_lead_keys?key=eq.${enc(k.key)}&active=eq.true&deal_id=neq.${enc(deal.id)}&select=deal_id`); if (other) return bad(res, 409, 'This prospect is now being worked elsewhere, so it cannot be reopened. Ask your manager.'); }
    }
    const row = await applyStage(deal, to, { actor: caller, reason: sanitize(b.reason, 500) || null, extra, detail: to === 'lost' ? { lost_reason_code: b.lost_reason_code } : {} });
    if (!row) return bad(res, 409, 'This lead just changed. Reload and try again.');
    if (to === 'lost') await setKeysActive(deal.id, false); if (chk.reopen) await setKeysActive(deal.id, true);
    return res.status(200).json({ ok: true, stage: row.stage });
  }

  // ================================================================== manager / owner
  const scope = await visibleRepUserIds(caller);
  const inScope = (uid) => !scope || (uid && scope.includes(uid));

  if (op === 'team-list') {
    let q = `crm_deals?pipeline=eq.nova_sales&select=${DEAL_REP_FIELDS}&order=updated_at.desc&limit=1000`;
    if (req.query?.rep_id) { const rid = sanitize(req.query.rep_id, 60); if (!inScope(rid)) return bad(res, 403, 'That representative is not on your team.'); q += `&assigned_rep_id=eq.${enc(rid)}`; }
    else if (scope) q += scope.length ? `&assigned_rep_id=in.${inList(scope)}` : '&assigned_rep_id=eq.00000000-0000-0000-0000-000000000000';
    if (req.query?.unassigned === 'true') { if (scope) return bad(res, 403, 'Only the owner can see unassigned leads.'); q = `crm_deals?pipeline=eq.nova_sales&assigned_rep_id=is.null&select=${DEAL_REP_FIELDS}&order=created_at.desc&limit=500`; }
    if (req.query?.stage && STAGES.includes(req.query.stage)) q += `&stage=eq.${enc(req.query.stage)}`;
    const deals = await dbGet(q); const now = Date.now();
    const bizIds = [...new Set(deals.map((d) => d.business_id).filter(Boolean))]; const biz = bizIds.length ? await dbGet(`businesses?id=in.${inList(bizIds)}&select=id,name`) : [];
    const repNames = {}; for (const id of [...new Set(deals.map((d) => d.assigned_rep_id).filter(Boolean))]) repNames[id] = await displayNameOf(id);
    let rows = deals.map((d) => ({ ...d, business_name: biz.find((x) => x.id === d.business_id)?.name || null, rep_name: repNames[d.assigned_rep_id] || null, overdue: isOpen(d.stage) && !!d.next_action_at && new Date(d.next_action_at).getTime() < now, stale_days: isOpen(d.stage) ? Math.floor((now - new Date(d.updated_at).getTime()) / 86400_000) : 0 }));
    if (req.query?.overdue === 'true') rows = rows.filter((d) => d.overdue);
    return res.status(200).json({ deals: rows, counts: Object.fromEntries(STAGES.map((s) => [s, rows.filter((d) => d.stage === s).length])) });
  }
  if (op === 'team-get') {
    const deal = await dbOne(`crm_deals?id=eq.${enc(sanitize(req.query?.id, 60))}&pipeline=eq.nova_sales&select=*`); if (!deal) return bad(res, 404, 'Lead not found');
    if (scope && !inScope(deal.assigned_rep_id)) return bad(res, 403, 'This lead is not on your team.');
    const [business, contact, activities, events, assignments] = await Promise.all([deal.business_id ? dbOne(`businesses?id=eq.${enc(deal.business_id)}&select=*`) : null, deal.contact_id ? dbOne(`crm_contacts?id=eq.${enc(deal.contact_id)}&select=*`) : null, dbGet(`crm_activities?deal_id=eq.${enc(deal.id)}&order=created_at.desc&limit=300&select=*`), dbGet(`sales_deal_stage_events?deal_id=eq.${enc(deal.id)}&order=created_at.asc&select=*`), dbGet(`sales_lead_assignments?deal_id=eq.${enc(deal.id)}&order=created_at.asc&select=*`)]);
    return res.status(200).json({ deal, business, contact, activities, stage_history: events, assignment_history: assignments, rep_name: deal.assigned_rep_id ? await displayNameOf(deal.assigned_rep_id) : null });
  }
  if (op === 'assign') {
    if (!need('POST')) return;
    const deal = await dbOne(`crm_deals?id=eq.${enc(sanitize(b.deal_id, 60))}&pipeline=eq.nova_sales&select=*`); if (!deal) return bad(res, 404, 'Lead not found');
    if (scope && (!deal.assigned_rep_id || !inScope(deal.assigned_rep_id))) return bad(res, 403, 'This lead is not on your team.');
    const to = b.to_user_id ? sanitize(b.to_user_id, 60) : null;
    if (to) { const rep = await dbOne(`sales_reps?user_id=eq.${enc(to)}&select=status`); if (!rep || rep.status !== 'active') return bad(res, 422, 'Leads can only be assigned to an active representative.'); if (!inScope(to)) return bad(res, 403, 'That representative is not on your team.'); }
    else if (scope) return bad(res, 403, 'Only the owner can return a lead to the unassigned pool.');
    if (!isOpen(deal.stage)) return bad(res, 409, 'Only open leads can be reassigned.');
    if (deal.assigned_rep_id === to) return bad(res, 409, 'Already assigned to that person.');
    const reason = sanitize(b.reason, 300); if (reason.length < 5) return bad(res, 422, 'Record why the lead is being reassigned.');
    const [row] = await dbPatch('crm_deals', `id=eq.${enc(deal.id)}&assigned_rep_id${deal.assigned_rep_id ? `=eq.${enc(deal.assigned_rep_id)}` : '=is.null'}`, { assigned_rep_id: to, owner_user_id: to, updated_at: nowIso() });
    if (!row) return bad(res, 409, 'This lead just changed.');
    await dbInsert('sales_lead_assignments', { deal_id: deal.id, from_user: deal.assigned_rep_id, to_user: to, assigned_by: caller.id, reason });
    await audit(caller, 'crm_deal', deal.id, 'lead_reassigned', { from: deal.assigned_rep_id, to, reason });
    if (to) { const u = await authUserById(to); await notify({ userId: to, email: u?.email, kind: 'lead_assigned', subject: 'A lead was assigned to you', body: 'A new lead is waiting in your Leads list.', link: '/rep/leads', channels: ['in_app'], idempotencyKey: `assign:${deal.id}:${Date.now()}` }); }
    return res.status(200).json({ ok: true });
  }
  if (op === 'owner-create' || op === 'import') {
    if (!need('POST')) return;
    const list = op === 'import' ? (Array.isArray(b.rows) ? b.rows.slice(0, 200) : null) : [b]; if (!list?.length) return bad(res, 422, 'No rows.');
    let assignee = b.assign_to ? sanitize(b.assign_to, 60) : null;
    if (assignee) { const rep = await dbOne(`sales_reps?user_id=eq.${enc(assignee)}&select=status`); if (!rep || rep.status !== 'active') return bad(res, 422, 'Leads can only be assigned to an active representative.'); }
    const results = [];
    for (const [i, row] of list.entries()) { const out = await createProspect({ actor: caller, actorKind: 'owner', assignee, b: row, sourceKind: 'owner_assigned' }); results.push({ row: i, ok: out.status === 200, deal_id: out.deal?.id, error: out.status === 200 ? undefined : out.error, duplicate: out.duplicate || undefined, errors: out.errors }); }
    if (op === 'owner-create') return results[0].ok ? res.status(200).json({ ok: true, deal_id: results[0].deal_id }) : res.status(results[0].duplicate ? 409 : 422).json({ error: results[0].error, errors: results[0].errors });
    return res.status(200).json({ ok: true, created: results.filter((x) => x.ok).length, duplicates: results.filter((x) => x.duplicate).length, failed: results.filter((x) => !x.ok && !x.duplicate).length, results });
  }
  if (op === 'reassign-from-rep') {
    if (!need('POST')) return;
    const from = sanitize(b.from_user_id, 60); const to = b.to_user_id ? sanitize(b.to_user_id, 60) : null;
    if (to) { const rep = await dbOne(`sales_reps?user_id=eq.${enc(to)}&select=status`); if (!rep || rep.status !== 'active') return bad(res, 422, 'The receiving representative must be active.'); }
    const reason = sanitize(b.reason, 300); if (reason.length < 5) return bad(res, 422, 'Record why.');
    const deals = await dbGet(`crm_deals?assigned_rep_id=eq.${enc(from)}&pipeline=eq.nova_sales&stage=in.${inList(OPEN_STAGES.filter((s) => s !== 'submitted_for_verification'))}&select=id`);
    let moved = 0;
    for (const d of deals) { const [row] = await dbPatch('crm_deals', `id=eq.${enc(d.id)}&assigned_rep_id=eq.${enc(from)}`, { assigned_rep_id: to, owner_user_id: to, updated_at: nowIso() }); if (row) { await dbInsert('sales_lead_assignments', { deal_id: d.id, from_user: from, to_user: to, assigned_by: caller.id, reason }); moved++; } }
    await audit(caller, 'sales_rep', from, 'leads_reassigned', { to, count: moved, reason });
    return res.status(200).json({ ok: true, moved, kept_with_original: 'Leads already submitted for verification stay with the original representative so their credit is not lost.' });
  }
  if (op === 'stage-override') {
    if (!need('POST')) return;
    const deal = await dbOne(`crm_deals?id=eq.${enc(sanitize(b.deal_id, 60))}&pipeline=eq.nova_sales&select=*`); if (!deal) return bad(res, 404, 'Lead not found');
    const to = sanitize(b.to, 40); if (!STAGES.includes(to) || to === 'won') return bad(res, 422, 'Choose a valid stage. Sales are marked won only through verification.');
    const reason = sanitize(b.reason, 500); if (reason.length < 10) return bad(res, 422, 'An owner override needs a written reason.');
    const extra = to === 'lost' ? { lost_reason: reason, lost_reason_code: LOST_REASONS.includes(b.lost_reason_code) ? b.lost_reason_code : 'other' } : {};
    const row = await applyStage(deal, to, { actor: caller, actorKind: 'owner', reason, extra, detail: { override: true } });
    if (!row) return bad(res, 409, 'The lead just changed.');
    await setKeysActive(deal.id, isOpen(to)); await audit(caller, 'crm_deal', deal.id, 'stage_override', { from: deal.stage, to, reason });
    return res.status(200).json({ ok: true });
  }
  if (op === 'clear-dnc') {
    if (!need('POST')) return;
    const reason = sanitize(b.reason, 300); if (reason.length < 10) return bad(res, 422, 'Do-not-contact flags are only cleared with documented written permission from the contact. Record it.');
    await dbPatch('crm_contacts', `id=eq.${enc(sanitize(b.contact_id, 60))}&organization_id=eq.${enc(org)}`, { do_not_contact: false, updated_at: nowIso() });
    await audit(caller, 'crm_contact', sanitize(b.contact_id, 60), 'do_not_contact_cleared', { reason }); return res.status(200).json({ ok: true });
  }
  return bad(res, 400, `Unknown leads operation: ${op}`);
});
void ago; void crypto;
