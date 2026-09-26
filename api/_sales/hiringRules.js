// Pure rules for the sales application and hiring workflow. No I/O — unit-tested in scripts/unit_sales_hiring_rules_test.mjs.

export const POSITION = 'Sales Representative';
export const PRIVACY_NOTICE_VERSION = '2026-09-26-draft'; // a DRAFT notice: the owner must supply/approve the final text before real applicants use this
export const CHANNELS = ['in_person', 'telephone', 'email', 'messaging', 'other'];
export const CHANNEL_LABELS = { in_person: 'In-person visits', telephone: 'Telephone', email: 'Email', messaging: 'Text/social messaging', other: 'Other approved channel' };

// Stages the applicant and reviewers see. Legacy statuses (new/reviewing/interview_scheduled/hired/declined) belong to the older Careers flow.
export const STAGES = ['draft', 'submitted', 'under_review', 'interview_requested', 'changes_requested', 'accepted', 'rejected', 'withdrawn'];
export const STAGE_LABELS = { draft: 'Draft (not submitted)', submitted: 'Submitted', under_review: 'Under review', interview_requested: 'Interview / practical requested', changes_requested: 'More information requested', accepted: 'Accepted', rejected: 'Not moving forward', withdrawn: 'Withdrawn' };
export const FINAL_STAGES = ['accepted', 'rejected', 'withdrawn'];
const TRANSITIONS = {
  draft: ['submitted', 'withdrawn'],
  submitted: ['under_review', 'interview_requested', 'changes_requested', 'accepted', 'rejected', 'withdrawn'],
  under_review: ['interview_requested', 'changes_requested', 'accepted', 'rejected', 'withdrawn'],
  interview_requested: ['under_review', 'changes_requested', 'accepted', 'rejected', 'withdrawn'],
  changes_requested: ['under_review', 'withdrawn', 'rejected'],   // applicant resubmits → under_review
  accepted: ['withdrawn'],
  rejected: [],
  withdrawn: [],
};
export const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);
export const applicantMayEdit = (status) => ['draft', 'changes_requested'].includes(status);

// ---- questions (kept here so form, server validation and reviewers all use the same text)
export const SCENARIOS = [
  { key: 'scenario_no_data', prompt: 'A small-business owner asks: "How much more money will I make if I hire Nova?" You have not looked at their business yet. What do you say, and why?' },
  { key: 'scenario_objection', prompt: 'A prospect says they already have a website and "everything is fine." What is your next question, and what are you trying to learn?' },
];
const LIMITS = { name: 100, phone: 30, city: 100, timezone: 60, experience: 2000, motivation: 1500, scenario: 1500, availability_notes: 500, preferred_hours: 300 };

// ---- sensitive-identifier guard: the initial application must not collect bank details, government IDs or tax IDs.
const luhn = (digits) => { let sum = 0, alt = false; for (let i = digits.length - 1; i >= 0; i--) { let n = Number(digits[i]); if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; } return sum % 10 === 0; };
export function findSensitiveIdentifiers(text) {
  const t = String(text || ''); const hits = [];
  if (/\b\d{3}[- ]\d{2}[- ]\d{4}\b/.test(t)) hits.push('a Social Security–style number');
  if (/\b\d{2}-\d{7}\b/.test(t)) hits.push('an EIN-style tax number');
  if (/(routing|aba|account)\s*(number|no\.?|#)?\s*[:#]?\s*\d{6,}/i.test(t)) hits.push('bank routing or account details');
  if (/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/.test(t)) hits.push('an IBAN-style bank number');
  for (const m of t.match(/\b(?:\d[ -]?){13,19}\b/g) || []) { const d = m.replace(/\D/g, ''); if (d.length >= 13 && d.length <= 19 && luhn(d)) { hits.push('a payment card number'); break; } }
  if (/\b(driver'?s?\s*licen[sc]e|passport)\s*(number|no\.?|#)?\s*[:#]?\s*[A-Z0-9]{6,}/i.test(t)) hits.push('a government ID number');
  return [...new Set(hits)];
}

export function isValidTimezone(tz) { try { new Intl.DateTimeFormat('en-US', { timeZone: String(tz) }); return !!tz; } catch { return false; } }
const str = (v, n) => (typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, n) : '');

// Normalize whatever the browser sent into the canonical profile shape. Unknown keys are dropped.
export function normalizeProfile(input = {}) {
  const b = input && typeof input === 'object' ? input : {};
  const channels = Array.isArray(b.channels) ? [...new Set(b.channels.filter((c) => CHANNELS.includes(c)))] : [];
  const hours = Number(b.hours_per_week);
  return {
    name: str(b.name, LIMITS.name), phone: str(b.phone, LIMITS.phone).replace(/[^0-9+\-()\s.]/g, ''), city: str(b.city, LIMITS.city), timezone: str(b.timezone, LIMITS.timezone),
    hours_per_week: Number.isFinite(hours) ? Math.max(0, Math.min(80, hours)) : null,
    availability_days: Array.isArray(b.availability_days) ? [...new Set(b.availability_days.filter((d) => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(d)))] : [],
    preferred_hours: str(b.preferred_hours, LIMITS.preferred_hours), availability_notes: str(b.availability_notes, LIMITS.availability_notes),
    experience: str(b.experience, LIMITS.experience), years_sales: str(b.years_sales, 20), channels,
    motivation: str(b.motivation, LIMITS.motivation),
    scenario_no_data: str(b.scenario_no_data, LIMITS.scenario), scenario_objection: str(b.scenario_objection, LIMITS.scenario),
    ack_privacy: b.ack_privacy === true, ack_no_guarantee: b.ack_no_guarantee === true, ack_conduct: b.ack_conduct === true, ack_truthful: b.ack_truthful === true,
  };
}
// Draft saves accept partial data but still refuse sensitive identifiers. Submission needs everything.
export function validateForSave(p) {
  const errors = {};
  for (const k of ['experience', 'motivation', 'scenario_no_data', 'scenario_objection', 'availability_notes', 'preferred_hours']) {
    const hits = findSensitiveIdentifiers(p[k]); if (hits.length) errors[k] = `Please remove ${hits[0]} — we do not collect bank, government-ID or tax numbers in the application.`;
  }
  if (p.timezone && !isValidTimezone(p.timezone)) errors.timezone = 'Choose a valid time zone.';
  return errors;
}
export function validateForSubmit(p) {
  const errors = validateForSave(p);
  const need = (k, msg) => { if (!errors[k]) errors[k] = msg; };
  if (!p.name || p.name.length < 2) need('name', 'Enter your full name.');
  if (!p.phone || p.phone.replace(/\D/g, '').length < 10) need('phone', 'Enter a phone number we can reach you on (10+ digits).');
  if (!p.city) need('city', 'Enter your general location (city and state).');
  if (!p.timezone) need('timezone', 'Choose your time zone.');
  if (p.hours_per_week == null || p.hours_per_week <= 0) need('hours_per_week', 'Tell us roughly how many hours per week you can work.');
  if (!p.availability_days.length && !p.availability_notes) need('availability_days', 'Select the days you are available, or describe your availability.');
  if (p.experience.length < 20) need('experience', 'Describe your relevant sales or customer-service experience (or say honestly that you have none yet).');
  if (!p.channels.length) need('channels', 'Choose at least one way you would be comfortable working with customers.');
  if (p.motivation.length < 40) need('motivation', 'Tell us in a few sentences why you want this role.');
  for (const s of SCENARIOS) if (p[s.key].length < 30) need(s.key, 'Please answer this scenario in a few sentences.');
  if (!p.ack_privacy) need('ack_privacy', 'You must acknowledge the privacy notice.');
  if (!p.ack_truthful) need('ack_truthful', 'You must confirm your answers are your own and truthful.');
  if (!p.ack_no_guarantee) need('ack_no_guarantee', 'You must acknowledge that no income, hiring or work is guaranteed.');
  if (!p.ack_conduct) need('ack_conduct', 'You must acknowledge that Nova representatives may not invent figures or promise results.');
  return errors;
}

// Fields an applicant may ever see about their own application (never notes, evaluations, or reviewer identity).
export function applicantView(app, { changeRequests = [], events = [], invitation = null } = {}) {
  return {
    id: app.id, reference_code: app.reference_code, status: app.status, stage_label: STAGE_LABELS[app.status] || app.status, position: app.position,
    submitted_at: app.submitted_at, updated_at: app.updated_at, resubmission_count: app.resubmission_count || 0,
    can_edit: applicantMayEdit(app.status), profile: app.sales_profile || {}, has_resume: !!app.portfolio_file_path,
    applicant_message: app.applicant_message || null,
    open_change_requests: changeRequests.filter((c) => c.status === 'open').map((c) => ({ id: c.id, message: c.message, fields: c.fields, created_at: c.created_at })),
    history: events.filter((e) => e.applicant_visible).map((e) => ({ at: e.at, to_status: e.to_status, label: STAGE_LABELS[e.to_status] || e.event_type })),
    invitation: invitation ? { status: invitation.status, expires_at: invitation.expires_at } : null,
    next_step: nextStep(app.status, { hasOpenChange: changeRequests.some((c) => c.status === 'open'), invitation }),
  };
}
export function nextStep(status, { hasOpenChange = false, invitation = null } = {}) {
  switch (status) {
    case 'draft': return 'Finish your application and submit it. You can leave and come back — your draft is saved.';
    case 'submitted': return 'We have your application. Nothing else is needed right now; we will email you when the status changes.';
    case 'under_review': return 'Your application is being reviewed. No action needed.';
    case 'interview_requested': return 'We would like to talk or run a short practical exercise. Check the message below and your email for details.';
    case 'changes_requested': return hasOpenChange ? 'We need a little more information. Update your application and resubmit.' : 'Update your application and resubmit.';
    case 'accepted': return invitation && ['queued', 'sent', 'delivered'].includes(invitation.status) ? 'You have been accepted. Check your email for a secure invitation link to set up your training account.' : invitation?.status === 'accepted' ? 'Your training account is set up. Sign in to continue.' : 'You have been accepted. Your invitation is being prepared.';
    case 'rejected': return 'This application is not moving forward.';
    case 'withdrawn': return 'You withdrew this application. You are welcome to apply again.';
    default: return '';
  }
}

export function validatePassword(pw, email = '') {
  if (typeof pw !== 'string' || pw.length < 12) return 'Use at least 12 characters.';
  if (pw.length > 128) return 'That password is too long.';
  if (email && pw.toLowerCase().includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length >= 4) return 'Do not include your email name in your password.';
  if (/^(.)\1+$/.test(pw) || /^(password|123456|qwerty)/i.test(pw)) return 'Choose a less predictable password.';
  return null;
}

export const invitationExpiryDays = (cfg) => Math.max(1, Math.min(30, Number(cfg?.invitation_days) || 7));
export const invitationState = (inv, now = new Date()) => (!inv ? 'none' : ['accepted', 'revoked'].includes(inv.status) ? inv.status : new Date(inv.expires_at) <= now ? 'expired' : inv.status);
