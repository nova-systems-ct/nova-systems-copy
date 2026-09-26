// Pure rules for the rep pipeline: stages, allowed transitions, entry/exit rules, prospect de-duplication keys. No I/O.
export const STAGES = ['new', 'contacted', 'qualified', 'discovery_scheduled', 'discovery_completed', 'proposal', 'awaiting_signature_payment', 'submitted_for_verification', 'won', 'lost'];
export const STAGE_LABELS = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', discovery_scheduled: 'Discovery Scheduled', discovery_completed: 'Discovery Completed', proposal: 'Proposal', awaiting_signature_payment: 'Awaiting Signature/Payment', submitted_for_verification: 'Submitted for Verification', won: 'Won', lost: 'Lost' };
export const OPEN_STAGES = STAGES.filter((s) => s !== 'won' && s !== 'lost');
export const OUTREACH_KINDS = ['call', 'email', 'sms', 'message', 'in_person'];
export const ACTIVITY_KINDS = ['note', 'task', 'reminder', 'call', 'email', 'sms', 'message', 'in_person', 'discovery'];
export const OUTCOMES = ['no_answer', 'left_message', 'spoke_with_contact', 'spoke_with_gatekeeper', 'meeting_booked', 'not_interested', 'wrong_number', 'asked_to_call_back', 'sent', 'replied', 'other'];
export const LOST_REASONS = ['no_need', 'no_budget_stated', 'chose_another_provider', 'no_response', 'bad_timing', 'not_decision_maker', 'offering_unavailable', 'duplicate', 'other'];

// Moves a REP may make by hand. Moves into proposal / awaiting / submitted / won are made by their own server paths
// (proposal create, proposal send, submit-for-verification, owner verification) so a stage can never be claimed without its evidence.
export const REP_MANUAL = {
  new: ['contacted'],
  contacted: ['qualified'],
  qualified: ['discovery_scheduled', 'contacted'],
  discovery_scheduled: ['discovery_completed', 'qualified'],
  discovery_completed: ['discovery_scheduled'],
  proposal: ['discovery_completed'],
  awaiting_signature_payment: ['proposal'],
};
export const isOpen = (stage) => OPEN_STAGES.includes(stage);

// Discovery is diagnostic: the notes must show the rep actually asked about the business's situation.
export const DISCOVERY_FIELDS = ['how_customers_reach_them', 'what_happens_to_missed_inquiries', 'current_follow_up_process', 'main_frustration', 'what_they_have_tried', 'who_decides'];
export function discoveryProblems(discovery) {
  const d = discovery && typeof discovery === 'object' ? discovery : {};
  const answered = DISCOVERY_FIELDS.filter((k) => String(d[k] || '').trim().length >= 8);
  const p = [];
  if (answered.length < 3) p.push(`Record what you learned: at least 3 of ${DISCOVERY_FIELDS.length} discovery questions need a real answer (${answered.length} so far).`);
  if (String(d.findings || '').trim().length < 20) p.push('Write your findings in your own words (at least a sentence) before moving on.');
  return p;
}
export function qualificationProblems(q) {
  const x = q && typeof q === 'object' ? q : {}; const p = [];
  if (String(x.summary || '').trim().length < 20) p.push('Write a qualification summary (at least a sentence): who they are and why they might need help.');
  if (!['yes', 'no', 'unknown'].includes(x.decision_maker)) p.push('State whether you have spoken with the decision maker (yes / no / unknown).');
  return p;
}

// ctx: { outreachCount, hasDraftProposal, contact, business, now }
// body: { reason, qualification, discovery, discovery_at, lost_reason_code }
// Returns { ok } or { error, problems? }
export function checkRepMove(deal, to, body = {}, ctx = {}) {
  const from = deal.stage; const now = ctx.now || new Date();
  if (from === to) return { error: 'The lead is already in that stage.' };
  if (to === 'lost') {
    if (!isOpen(from)) return { error: 'Only an open lead can be marked lost.' };
    if (from === 'submitted_for_verification') return { error: 'A submitted sale is decided by Nova. Ask your manager to withdraw it.' };
    if (!LOST_REASONS.includes(body.lost_reason_code)) return { error: 'Choose a reason for losing this lead.' };
    if (String(body.reason || '').trim().length < 10) return { error: 'Add a short note explaining what happened (at least 10 characters).' };
    return { ok: true };
  }
  if (from === 'lost') {
    if (to !== 'contacted') return { error: 'A lost lead can only be reopened to Contacted.' };
    if (ctx.contact?.do_not_contact) return { error: 'This contact asked not to be contacted. The lead cannot be reopened.' };
    if ((deal.reopened_count || 0) >= 3) return { error: 'This lead was reopened several times already. Ask your manager.' };
    if (String(body.reason || '').trim().length < 10) return { error: 'Say why you are reopening it (at least 10 characters).' };
    return { ok: true, reopen: true };
  }
  if (from === 'won') return { error: 'A won sale is final.' };
  const allowed = REP_MANUAL[from] || [];
  if (!allowed.includes(to)) {
    if (['proposal', 'awaiting_signature_payment', 'submitted_for_verification', 'won'].includes(to)) return { error: `"${STAGE_LABELS[to]}" is reached by its own step (${to === 'proposal' ? 'creating a proposal' : to === 'awaiting_signature_payment' ? 'sending the proposal' : to === 'submitted_for_verification' ? 'submitting the closed sale with evidence' : 'Nova verifying the sale'}), not by moving the card.` };
    return { error: `A lead in "${STAGE_LABELS[from]}" cannot move straight to "${STAGE_LABELS[to]}".` };
  }
  const backward = STAGES.indexOf(to) < STAGES.indexOf(from);
  if (backward && String(body.reason || '').trim().length < 5) return { error: 'Say why you are moving this lead backwards.' };
  if (to === 'contacted' && !backward && (ctx.outreachCount || 0) < 1) return { error: 'Log at least one real outreach attempt (call, email, text, message or visit) before marking the lead Contacted.' };
  if (to === 'qualified' && !backward) { const p = qualificationProblems(body.qualification || deal.qualification); if (p.length) return { error: p[0], problems: p }; }
  if (to === 'discovery_scheduled' && !backward) {
    const at = body.discovery_at ? new Date(body.discovery_at) : null;
    if (!at || Number.isNaN(at.getTime())) return { error: 'Choose the date and time of the discovery conversation.' };
    if (at <= now) return { error: 'The discovery time must be in the future.' };
    if (!ctx.contact?.name) return { error: 'Add the contact you will be speaking with first.' };
  }
  if (to === 'discovery_completed') { const p = discoveryProblems(body.discovery || deal.discovery); if (p.length) return { error: p[0], problems: p }; }
  return { ok: true, backward };
}

// ---------------------------------------------------------------- prospect identity keys (duplicate protection)
const FREE_MAIL = new Set(['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'msn.com', 'live.com', 'me.com', 'protonmail.com', 'comcast.net', 'verizon.net']);
export function domainOf(website) {
  const s = String(website || '').trim().toLowerCase(); if (!s) return null;
  const m = s.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0].replace(/:\d+$/, '');
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(m) ? m : null;
}
export const phoneDigits = (p) => { const d = String(p || '').replace(/\D/g, ''); const t = d.length === 11 && d.startsWith('1') ? d.slice(1) : d; return t.length === 10 ? t : null; };
const squash = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|the)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
export function prospectKeys({ business_name, website, phone, email, city, contact_phone, contact_email }) {
  const keys = new Set();
  const dom = domainOf(website); if (dom) keys.add(`domain:${dom}`);
  for (const e of [email, contact_email]) { const d = String(e || '').toLowerCase().split('@')[1]; if (d && !FREE_MAIL.has(d)) keys.add(`domain:${d}`); }
  for (const p of [phone, contact_phone]) { const d = phoneDigits(p); if (d) keys.add(`phone:${d}`); }
  const n = squash(business_name), c = squash(city); if (n && c) keys.add(`name:${n}|${c}`);
  return [...keys];
}
export function validateProspect(b) {
  const errors = {}; const name = String(b.business_name || '').trim();
  if (name.length < 2) errors.business_name = 'Business name is required.';
  if (!String(b.contact_name || '').trim()) errors.contact_name = 'Who will you be speaking with?';
  if (!phoneDigits(b.contact_phone) && !phoneDigits(b.phone) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.contact_email || b.email || ''))) errors.contact = 'A phone number or email is needed to work this lead.';
  if (b.website && !domainOf(b.website)) errors.website = 'That website does not look valid.';
  return errors;
}
