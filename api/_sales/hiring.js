// Applicant portal + owner hiring workspace. Canonical identity only: an applicant is a real Supabase Auth user with NO
// organization membership (zero permissions) until an owner-approved invitation is accepted, at which point they become a
// 'nova_sales_candidate'. Nothing here trusts a client-supplied status, score, role or id.
import { sanitize, sanitizeEmail } from '../_sanitize.js';
import { rateLimit } from '../_rateLimit.js';
import {
  dbGet, dbOne, dbInsert, dbPatch, enc, inList, nowIso, audit, bad, wrap, requireUser, requirePerm, isOwner, sha256, randomToken, randomCode,
  authUserByEmail, authCreateUser, authUpdateUser, authMagicLink, storagePut, storageSign, notify, notifyOwners, userHasPerm, displayNameOf, novaOrgId, appBase, env,
} from './core.js';
import {
  POSITION, STAGE_LABELS, canTransition, applicantMayEdit, normalizeProfile, validateForSave, validateForSubmit, applicantView, validatePassword, invitationExpiryDays, invitationState, PRIVACY_NOTICE_VERSION,
} from './hiringRules.js';

const OPEN_APP = "status=not.in.(rejected,withdrawn,declined,hired)";
const EVAL_CRITERIA = ['communication', 'curiosity', 'honesty_ethics', 'coachability', 'reliability'];

async function appEvent(appId, kind, type, { actor = null, from = null, to = null, visible = false, detail = {} } = {}) {
  await dbInsert('application_events', { application_id: appId, actor_user_id: actor?.id || null, actor_kind: kind, event_type: type, from_status: from, to_status: to, applicant_visible: visible, detail });
}
async function loadAppFor(userId) {
  const rows = await dbGet(`applications?auth_user_id=eq.${enc(userId)}&position=eq.${enc(POSITION)}&order=created_at.desc&limit=5`);
  return rows.find((a) => !['withdrawn', 'rejected', 'declined'].includes(a.status)) || rows[0] || null;
}
async function activeConfig(key) { return (await dbOne(`sales_config?key=eq.${enc(key)}&status=eq.approved&select=*`))?.value || null; }

// =========================================================================================== applicant + public
export const handleApply = wrap(async (req, res, op) => {
  // ---- public: begin or resume by email (sends a one-time sign-in link; never reveals whether an account exists)
  if (op === 'start') {
    if (req.method !== 'POST') return bad(res, 405, 'Method not allowed');
    if (!rateLimit(req, res, 6, 60_000)) return;
    const b = req.body || {};
    if (b.hp) return res.status(200).json({ ok: true }); // honeypot: bots fill hidden fields
    const email = sanitizeEmail(b.email); if (!email) return bad(res, 400, 'Enter a valid email address.');
    const recent = await dbGet(`sales_notifications?kind=eq.apply_link&email=eq.${enc(email)}&created_at=gte.${enc(new Date(Date.now() - 3600_000).toISOString())}&select=id`);
    if (recent.length >= 5) return res.status(200).json({ ok: true }); // per-address throttle, silent
    let user = await authUserByEmail(email);
    if (user) {
      const member = await dbOne(`organization_members?staff_user_id=eq.${enc(user.id)}&select=id`);
      if (member) return res.status(200).json({ ok: true }); // an existing Nova account signs in normally; do not start an application on it
    } else {
      const c = await authCreateUser(email, { name: sanitize(b.name, 100) || undefined });
      if (!c.ok) return bad(res, 502, 'We could not start your application. Please try again shortly.');
      user = c.json;
    }
    let app = await loadAppFor(user.id);
    if (!app || ['withdrawn', 'rejected', 'declined'].includes(app.status)) {
      if (app && app.status === 'rejected') return res.status(200).json({ ok: true }); // no silent re-application after a decision; the applicant sees the status when signed in
      app = null; // a withdrawn/declined application is closed: start a fresh one
      for (let i = 0; i < 4 && !app; i++) {
        const ins = await dbInsert('applications', { name: sanitize(b.name, 100) || null, email, email_normalized: email, position: POSITION, status: 'draft', auth_user_id: user.id, reference_code: randomCode(8, 'NOVA-'), sales_profile: {}, submitted_at: null });
        if (ins.row) { app = ins.row; await appEvent(app.id, 'applicant', 'draft_created', { to: 'draft', visible: true }); }
        else app = await loadAppFor(user.id); // lost a race to the unique index: use the winner
      }
    }
    const link = await authMagicLink(email, `${appBase()}/apply/continue`);
    if (!link.ok || !link.json.action_link) return bad(res, 502, 'We could not send your sign-in link. Please try again shortly.');
    await notify({ userId: null, email, kind: 'apply_link', subject: 'Continue your Nova Systems application', body: `Use this one-time link to continue your application (reference ${app?.reference_code || 'pending'}):\n\n${link.json.action_link}\n\nIf you did not ask for this, ignore this email — nothing happens unless the link is opened.`, channels: ['email'] });
    return res.status(200).json({ ok: true });
  }

  // ---- public: what an invitation link is for (no personal data beyond a masked email)
  if (op === 'invitation-info') {
    if (!rateLimit(req, res, 30, 60_000)) return;
    const token = sanitize(req.query?.token, 200); if (!token) return res.status(200).json({ state: 'invalid' });
    const inv = await dbOne(`application_invitations?token_hash=eq.${enc(sha256(token))}&select=*`);
    if (!inv) return res.status(200).json({ state: 'invalid' });
    const state = invitationState(inv); if (state === 'accepted' || state === 'revoked' || state === 'expired') return res.status(200).json({ state });
    const [u, d] = inv.email.split('@'); return res.status(200).json({ state: 'valid', email_hint: `${u.slice(0, 2)}***@${d}`, expires_at: inv.expires_at });
  }
  // ---- public: accept an invitation, set a password, become a candidate
  if (op === 'accept-invitation') {
    if (req.method !== 'POST') return bad(res, 405, 'Method not allowed');
    if (!rateLimit(req, res, 8, 60_000)) return;
    const token = sanitize(req.body?.token, 200); const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const inv = token && (await dbOne(`application_invitations?token_hash=eq.${enc(sha256(token))}&select=*`));
    if (!inv) return bad(res, 400, 'This invitation link is not valid.');
    const st = invitationState(inv); if (st === 'accepted') return bad(res, 409, 'This invitation was already used. Sign in with the account you created.');
    if (st === 'revoked') return bad(res, 410, 'This invitation was cancelled. Ask Nova to send a new one.');
    if (st === 'expired') { await dbPatch('application_invitations', `id=eq.${enc(inv.id)}&status=in.(queued,sent,delivered)`, { status: 'expired', last_event_at: nowIso() }); return bad(res, 410, 'This invitation has expired. Ask Nova to send a new one.'); }
    const pwErr = validatePassword(password, inv.email); if (pwErr) return bad(res, 422, pwErr);
    const app = await dbOne(`applications?id=eq.${enc(inv.application_id)}&select=*`);
    if (!app || app.status !== 'accepted') return bad(res, 409, 'This application is no longer accepted.');
    // compare-and-set FIRST so two concurrent uses of one link cannot both succeed
    const claimed = await dbPatch('application_invitations', `id=eq.${enc(inv.id)}&status=in.(queued,sent,delivered)&expires_at=gt.${enc(nowIso())}`, { status: 'accepted', accepted_at: nowIso(), last_event_at: nowIso() });
    if (!claimed.length) return bad(res, 409, 'This invitation was already used or has just expired.');
    const undo = () => dbPatch('application_invitations', `id=eq.${enc(inv.id)}&status=eq.accepted`, { status: inv.status, accepted_at: null });
    try {
      let user = await authUserByEmail(inv.email); const orgId = await novaOrgId();
      if (user) {
        const other = await dbOne(`organization_members?staff_user_id=eq.${enc(user.id)}&select=role,status`);
        if (other && other.role !== 'nova_sales_candidate') { await undo(); return bad(res, 409, 'This email already belongs to a Nova account. Sign in instead.'); }
        const u = await authUpdateUser(user.id, { password, email_confirm: true, user_metadata: { full_name: app.name || undefined } }); if (!u.ok) throw new Error('password set failed');
      } else {
        const c = await authCreateUser(inv.email, { password, name: app.name || undefined }); if (!c.ok) throw new Error('account create failed'); user = c.json;
      }
      if (!(await dbOne(`organization_members?staff_user_id=eq.${enc(user.id)}&organization_id=eq.${enc(orgId)}&select=id`))) {
        await dbInsert('organization_members', { organization_id: orgId, member_type: 'staff', staff_user_id: user.id, role: 'nova_sales_candidate', status: 'active' });
      }
      await dbInsert('sales_reps', { user_id: user.id, organization_id: orgId, application_id: app.id, display_name: app.name || null, status: 'candidate' }, { onConflict: 'user_id' });
      await dbPatch('applications', `id=eq.${enc(app.id)}`, { auth_user_id: user.id, invited_at: app.invited_at || nowIso() });
      await dbPatch('application_invitations', `id=eq.${enc(inv.id)}`, { accepted_user_id: user.id });
      const programs = await dbGet('academy_programs?select=id&order=order_index.asc');
      if (programs.length) await dbInsert('academy_enrollments', programs.map((p) => ({ staff_user_id: user.id, organization_id: orgId, program_id: p.id, status: 'not_started' })), { onConflict: 'staff_user_id,program_id' });
      await appEvent(app.id, 'applicant', 'invitation_accepted', { detail: { invitation_id: inv.id }, visible: true, to: 'accepted' });
      await audit({ id: user.id, kind: 'applicant' }, 'application', app.id, 'invitation_accepted', { invitation_id: inv.id });
      await notify({ userId: user.id, email: inv.email, kind: 'account_ready', subject: 'Your Nova training account is ready', body: `Welcome, ${app.name || 'there'}. Sign in at ${appBase()}/login to start your training. You have candidate access only: training, your documents and your onboarding status. Nothing else is available until Nova activates you.`, link: '/rep/onboarding', idempotencyKey: `acct:${inv.id}` });
      await notifyOwners({ kind: 'invitation_accepted', subject: `${app.name || inv.email} accepted their invitation`, body: 'They now have a candidate account and are enrolled in the Academy.', link: '/dashboard/sales-team/applications', idempotencyKey: `inv-acc:${inv.id}`, channels: ['in_app'] });
      return res.status(200).json({ ok: true, email: inv.email });
    } catch (e) { await undo().catch(() => {}); throw e; }
  }

  // ---- everything below needs a signed-in applicant (or candidate)
  const user = await requireUser(req, res); if (!user) return;
  if (op === 'me') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const app = await loadAppFor(user.id); if (!app) return res.status(200).json({ application: null });
    const [crs, evs, invs] = await Promise.all([dbGet(`application_change_requests?application_id=eq.${enc(app.id)}&order=created_at.desc`), dbGet(`application_events?application_id=eq.${enc(app.id)}&order=at.asc`), dbGet(`application_invitations?application_id=eq.${enc(app.id)}&order=created_at.desc&limit=1`)]);
    return res.status(200).json({ application: applicantView(app, { changeRequests: crs, events: evs, invitation: invs[0] ? { ...invs[0], status: invitationState(invs[0]) } : null }), privacy_notice_version: PRIVACY_NOTICE_VERSION });
  }
  const app = await loadAppFor(user.id);
  if (!app) return bad(res, 404, 'No application found for this account.');

  if (op === 'save' || op === 'submit') {
    if (req.method !== 'POST') return bad(res, 405, 'Method not allowed');
    if (!rateLimit(req, res, 40, 60_000)) return;
    if (!applicantMayEdit(app.status)) return bad(res, 409, `This application is ${STAGE_LABELS[app.status] || app.status} and can no longer be edited.`);
    const merged = normalizeProfile({ ...(app.sales_profile || {}), ...(req.body?.profile || {}) });
    const patch = { sales_profile: merged, name: merged.name || app.name, phone: merged.phone || app.phone, city: merged.city || app.city, timezone: merged.timezone || app.timezone, updated_at: nowIso() };
    if (merged.ack_privacy && !app.privacy_ack_at) { patch.privacy_ack_at = nowIso(); patch.privacy_notice_version = PRIVACY_NOTICE_VERSION; }
    if (op === 'save') {
      const errors = validateForSave(merged); if (Object.keys(errors).length) return res.status(422).json({ error: 'Please fix the highlighted fields.', errors });
      const [row] = await dbPatch('applications', `id=eq.${enc(app.id)}&auth_user_id=eq.${enc(user.id)}&status=in.(draft,changes_requested)`, patch);
      if (!row) return bad(res, 409, 'This application can no longer be edited.');
      return res.status(200).json({ ok: true, saved_at: patch.updated_at });
    }
    const errors = validateForSubmit(merged); if (Object.keys(errors).length) return res.status(422).json({ error: 'Some required answers are missing or need changes.', errors });
    const resubmission = app.status === 'changes_requested';
    const version = resubmission ? (app.resubmission_count || 0) + 2 : 1;
    const to = resubmission ? 'under_review' : 'submitted';
    const [row] = await dbPatch('applications', `id=eq.${enc(app.id)}&auth_user_id=eq.${enc(user.id)}&status=eq.${enc(app.status)}`, { ...patch, status: to, submitted_at: resubmission ? app.submitted_at : nowIso(), resubmission_count: resubmission ? (app.resubmission_count || 0) + 1 : 0, privacy_ack_at: patch.privacy_ack_at || app.privacy_ack_at });
    if (!row) return bad(res, 409, 'This application was changed in another window. Reload and try again.');
    await dbInsert('application_versions', { application_id: app.id, version, snapshot: { profile: merged, resume_path: app.portfolio_file_path || null } });
    await dbPatch('application_change_requests', `application_id=eq.${enc(app.id)}&status=eq.open`, { status: 'resolved', resolved_at: nowIso() });
    await appEvent(app.id, 'applicant', resubmission ? 'resubmitted' : 'submitted', { from: app.status, to, visible: true, detail: { version } });
    await notify({ userId: user.id, email: user.email, kind: 'application_received', subject: `Application received — ${app.reference_code}`, body: `We received your Nova Systems application (reference ${app.reference_code}).\n\nWhat happens next: we review every application personally. You will hear from us by email, and you can check your status any time at ${appBase()}/apply/status. Nothing is guaranteed at this stage — including an interview, a role, or any income.`, link: '/apply/status', idempotencyKey: `recv:${app.id}:${version}` });
    await notifyOwners({ kind: resubmission ? 'application_resubmitted' : 'application_submitted', subject: `${resubmission ? 'Resubmitted' : 'New'} application: ${merged.name || app.email}`, body: `Reference ${app.reference_code}. Review it in the Sales Team workspace.`, link: '/dashboard/sales-team/applications', idempotencyKey: `own-app:${app.id}:${version}` });
    return res.status(200).json({ ok: true, reference_code: app.reference_code, status: to });
  }

  if (op === 'withdraw') {
    if (req.method !== 'POST') return bad(res, 405, 'Method not allowed');
    if (!canTransition(app.status, 'withdrawn')) return bad(res, 409, 'This application cannot be withdrawn.');
    const [row] = await dbPatch('applications', `id=eq.${enc(app.id)}&auth_user_id=eq.${enc(user.id)}&status=eq.${enc(app.status)}`, { status: 'withdrawn', withdrawn_at: nowIso(), updated_at: nowIso() });
    if (!row) return bad(res, 409, 'This application changed. Reload and try again.');
    await dbPatch('application_invitations', `application_id=eq.${enc(app.id)}&status=in.(queued,sent,delivered)`, { status: 'revoked', last_event_at: nowIso() });
    await dbPatch('application_change_requests', `application_id=eq.${enc(app.id)}&status=eq.open`, { status: 'cancelled' });
    await appEvent(app.id, 'applicant', 'withdrawn', { from: app.status, to: 'withdrawn', visible: true });
    return res.status(200).json({ ok: true });
  }

  if (op === 'upload-resume') {
    if (req.method !== 'POST') return bad(res, 405, 'Method not allowed');
    if (!rateLimit(req, res, 6, 60_000)) return;
    if (!applicantMayEdit(app.status)) return bad(res, 409, 'This application can no longer be edited.');
    const b64 = typeof req.body?.file_base64 === 'string' ? req.body.file_base64.replace(/^data:[^;]+;base64,/, '') : '';
    let buf; try { buf = Buffer.from(b64, 'base64'); } catch { buf = null; }
    if (!buf || !buf.length) return bad(res, 400, 'Choose a file to upload.');
    if (buf.length > 3 * 1024 * 1024) return bad(res, 413, 'Files must be 3 MB or smaller.');
    // Type is decided by the file's own first bytes, never by the name or the browser-declared type.
    const isPdf = buf.subarray(0, 5).toString('latin1') === '%PDF-';
    const isDocx = buf[0] === 0x50 && buf[1] === 0x4b && /word\//.test(buf.toString('latin1', 0, Math.min(buf.length, 4000)));
    if (!isPdf && !isDocx) return bad(res, 415, 'Upload a PDF or Word (.docx) résumé.');
    const path = `sales-applications/${app.id}/resume-${Date.now()}.${isPdf ? 'pdf' : 'docx'}`;
    await storagePut('portfolios', path, buf, isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    await dbPatch('applications', `id=eq.${enc(app.id)}&auth_user_id=eq.${enc(user.id)}`, { portfolio_file_path: path, updated_at: nowIso() });
    await appEvent(app.id, 'applicant', 'resume_uploaded', { detail: { bytes: buf.length } });
    return res.status(200).json({ ok: true });
  }
  return bad(res, 400, `Unknown apply op: ${op}`);
});

// =========================================================================================== owner / reviewer workspace
const reviewerName = async (id) => (id ? displayNameOf(id).catch(() => 'Unknown') : null);

async function invitationView(inv) { return inv ? { id: inv.id, status: invitationState(inv), created_at: inv.created_at, expires_at: inv.expires_at, sent_at: inv.sent_at, accepted_at: inv.accepted_at, delivery_error: inv.delivery_error } : null; }

export const handleHiring = wrap(async (req, res, op) => {
  const ownerOps = ['decide', 'invite', 'revoke-invite', 'resend-invite'];
  const caller = await requirePerm(req, res, ownerOps.includes(op) ? 'sales.owner' : 'sales.hiring'); if (!caller) return;
  if (!rateLimit(req, res, 90, 60_000)) return;
  const b = req.body || {};

  if (op === 'list') {
    let q = `applications?position=eq.${enc(POSITION)}&order=submitted_at.desc.nullslast,created_at.desc&limit=${Math.min(200, Number(req.query?.limit) || 100)}&select=id,reference_code,name,email,status,submitted_at,created_at,assigned_reviewer_id,resubmission_count,decided_at`;
    const status = sanitize(req.query?.status, 30); q += status ? `&status=eq.${enc(status)}` : '&status=neq.draft';
    if (req.query?.reviewer_id) q += `&assigned_reviewer_id=eq.${enc(sanitize(req.query.reviewer_id, 60))}`;
    const term = sanitize(req.query?.q, 80).replace(/[*,()]/g, ' ').trim(); if (term) q += `&or=(name.ilike.*${enc(term)}*,email.ilike.*${enc(term)}*,reference_code.ilike.*${enc(term)}*)`;
    const rows = await dbGet(q); const ids = rows.map((r) => r.id);
    const [evals, invs] = ids.length ? await Promise.all([dbGet(`application_evaluations?application_id=in.${inList(ids)}&select=application_id,recommendation,created_at&order=created_at.desc`), dbGet(`application_invitations?application_id=in.${inList(ids)}&select=application_id,status,expires_at,created_at&order=created_at.desc`)]) : [[], []];
    const out = [];
    for (const r of rows) {
      const e = evals.filter((x) => x.application_id === r.id); const i = invs.find((x) => x.application_id === r.id);
      out.push({ ...r, stage_label: STAGE_LABELS[r.status] || r.status, reviewer_name: await reviewerName(r.assigned_reviewer_id), evaluation_count: e.length, latest_recommendation: e[0]?.recommendation || null, invitation_state: i ? invitationState(i) : 'none' });
    }
    return res.status(200).json(out);
  }

  const id = sanitize(req.query?.id || b.id, 60);
  if (!id) return bad(res, 400, 'id is required');
  const app = await dbOne(`applications?id=eq.${enc(id)}&position=eq.${enc(POSITION)}&select=*`);
  if (!app) return bad(res, 404, 'Application not found');

  if (op === 'get') {
    const [events, evals, crs, invs, versions] = await Promise.all([dbGet(`application_events?application_id=eq.${enc(id)}&order=at.asc`), dbGet(`application_evaluations?application_id=eq.${enc(id)}&order=created_at.desc`), dbGet(`application_change_requests?application_id=eq.${enc(id)}&order=created_at.desc`), dbGet(`application_invitations?application_id=eq.${enc(id)}&order=created_at.desc`), dbGet(`application_versions?application_id=eq.${enc(id)}&order=version.asc`)]);
    const evalsNamed = []; for (const e of evals) evalsNamed.push({ ...e, reviewer_name: await reviewerName(e.reviewer_id) });
    const { password_hash, ...safe } = app; void password_hash;
    const rep = app.auth_user_id ? await dbOne(`sales_reps?user_id=eq.${enc(app.auth_user_id)}&select=id,status`) : null;
    return res.status(200).json({ application: { ...safe, stage_label: STAGE_LABELS[app.status] || app.status }, assigned_reviewer_name: await reviewerName(app.assigned_reviewer_id), events, evaluations: evalsNamed, change_requests: crs, invitations: await Promise.all(invs.map(invitationView)), versions, rep, criteria: EVAL_CRITERIA });
  }

  if (req.method !== 'POST' && op !== 'resume-url') return bad(res, 405, 'Method not allowed');

  if (op === 'resume-url') {
    if (!app.portfolio_file_path) return bad(res, 404, 'No résumé on file.');
    const url = await storageSign('portfolios', app.portfolio_file_path, 300);
    await audit(caller, 'application', id, 'resume_viewed', {});
    return res.status(200).json({ ok: true, url, expires_in: 300 });
  }

  if (op === 'assign') {
    const reviewerId = sanitize(b.reviewer_id, 60);
    if (reviewerId && !(await userHasPerm(reviewerId, 'sales.hiring'))) return bad(res, 422, 'That person is not allowed to review applications.');
    const [row] = await dbPatch('applications', `id=eq.${enc(id)}`, { assigned_reviewer_id: reviewerId || null, updated_at: nowIso() });
    await appEvent(id, isOwner(caller) ? 'owner' : 'reviewer', 'reviewer_assigned', { actor: caller, detail: { reviewer_id: reviewerId || null } });
    await audit(caller, 'application', id, 'reviewer_assigned', { reviewer_id: reviewerId || null });
    return res.status(200).json({ ok: true, application_id: row.id });
  }

  if (op === 'evaluate') {
    if (!['submitted', 'under_review', 'interview_requested'].includes(app.status)) return bad(res, 409, `An application that is ${STAGE_LABELS[app.status] || app.status} cannot be assessed.`);
    if (!isOwner(caller) && app.assigned_reviewer_id && app.assigned_reviewer_id !== caller.id) return bad(res, 403, 'This application is assigned to another reviewer.');
    const scores = {}; for (const k of EVAL_CRITERIA) { const v = Number(b.scores?.[k]); if (b.scores?.[k] != null) { if (!Number.isInteger(v) || v < 1 || v > 5) return bad(res, 422, `${k} must be a whole number from 1 to 5.`); scores[k] = v; } }
    const kind = ['review', 'interview', 'practical'].includes(b.kind) ? b.kind : 'review';
    const recommendation = ['advance', 'hold', 'reject'].includes(b.recommendation) ? b.recommendation : null;
    if (!Object.keys(scores).length && !sanitize(b.notes, 5)) return bad(res, 422, 'Add at least one score or a note.');
    const ins = await dbInsert('application_evaluations', { application_id: id, reviewer_id: caller.id, kind, scores, recommendation, notes: sanitize(b.notes, 4000) || null });
    if (app.status === 'submitted') { await dbPatch('applications', `id=eq.${enc(id)}&status=eq.submitted`, { status: 'under_review', updated_at: nowIso() }); await appEvent(id, 'reviewer', 'review_started', { actor: caller, from: 'submitted', to: 'under_review', visible: true }); }
    await audit(caller, 'application', id, 'evaluated', { kind, recommendation });
    return res.status(200).json({ ok: true, evaluation_id: ins.row.id });
  }

  if (op === 'request-changes' || op === 'request-interview') {
    const to = op === 'request-changes' ? 'changes_requested' : 'interview_requested';
    if (!canTransition(app.status, to)) return bad(res, 409, `Cannot move an application that is ${STAGE_LABELS[app.status] || app.status} to "${STAGE_LABELS[to]}".`);
    const message = sanitize(b.message, 1500); if (message.length < 10) return bad(res, 422, 'Write a clear message for the applicant (this is what they will see).');
    const [row] = await dbPatch('applications', `id=eq.${enc(id)}&status=eq.${enc(app.status)}`, { status: to, applicant_message: message, updated_at: nowIso() });
    if (!row) return bad(res, 409, 'This application changed. Reload and try again.');
    if (to === 'changes_requested') await dbInsert('application_change_requests', { application_id: id, requested_by: caller.id, message, fields: Array.isArray(b.fields) ? b.fields.map((f) => sanitize(f, 40)).slice(0, 20) : [] });
    await appEvent(id, isOwner(caller) ? 'owner' : 'reviewer', to === 'changes_requested' ? 'changes_requested' : 'interview_requested', { actor: caller, from: app.status, to, visible: true });
    await audit(caller, 'application', id, op, {});
    if (app.auth_user_id) await notify({ userId: app.auth_user_id, email: app.email, kind: to, subject: to === 'changes_requested' ? 'We need a little more information for your Nova application' : 'Next step for your Nova application', body: `${message}\n\nSee the details and respond at ${appBase()}/apply/status`, link: '/apply/status', idempotencyKey: `${to}:${id}:${Date.now()}` });
    return res.status(200).json({ ok: true, status: to });
  }

  if (op === 'decide') {
    const decision = b.decision === 'accept' ? 'accepted' : b.decision === 'reject' ? 'rejected' : null; if (!decision) return bad(res, 422, 'decision must be "accept" or "reject".');
    if (!canTransition(app.status, decision)) return bad(res, 409, `An application that is ${STAGE_LABELS[app.status] || app.status} cannot be ${decision}.`);
    const reason = sanitize(b.reason, 1500); if (reason.length < 5) return bad(res, 422, 'Record the reason for this decision (kept internal).');
    const applicantMessage = sanitize(b.applicant_message, 1000) || (decision === 'accepted' ? 'Congratulations — you have been accepted into Nova training.' : 'Thank you for applying. We will not be moving forward with your application.');
    const [row] = await dbPatch('applications', `id=eq.${enc(id)}&status=eq.${enc(app.status)}`, { status: decision, decided_at: nowIso(), decided_by: caller.id, decision_reason: reason, applicant_message: applicantMessage, updated_at: nowIso() });
    if (!row) return bad(res, 409, 'This application changed. Reload and try again.');
    await appEvent(id, 'owner', `decision_${decision}`, { actor: caller, from: app.status, to: decision, visible: true });
    await audit(caller, 'application', id, `decision_${decision}`, { reason });
    if (app.auth_user_id) await notify({ userId: app.auth_user_id, email: app.email, kind: 'application_decision', subject: decision === 'accepted' ? 'Your Nova Systems application: accepted' : 'Your Nova Systems application', body: `${applicantMessage}${decision === 'accepted' ? '\n\nYou will receive a separate secure invitation to set up your training account.' : ''}`, link: '/apply/status', idempotencyKey: `decision:${id}:${decision}` });
    return res.status(200).json({ ok: true, status: decision });
  }

  if (op === 'invite' || op === 'resend-invite') {
    if (app.status !== 'accepted') return bad(res, 409, 'Only an accepted application can be invited.');
    const live = await dbOne(`application_invitations?application_id=eq.${enc(id)}&status=in.(queued,sent,delivered)&select=*`);
    if (live && op === 'invite') {
      if (invitationState(live) !== 'expired') return bad(res, 409, 'A live invitation already exists. Use resend to replace it.');
    }
    if (live) await dbPatch('application_invitations', `id=eq.${enc(live.id)}`, { status: 'revoked', last_event_at: nowIso() });
    const days = invitationExpiryDays(await activeConfig('invitation_policy'));
    const token = randomToken(32);
    const ins = await dbInsert('application_invitations', { application_id: id, email: app.email, token_hash: sha256(token), status: 'queued', created_by: caller.id, expires_at: new Date(Date.now() + days * 86400e3).toISOString() });
    if (ins.conflict) return bad(res, 409, 'Another invitation was created at the same time. Reload.');
    const link = `${appBase()}/join/${token}`;
    const [nid] = await notify({ userId: null, email: app.email, kind: 'invitation', subject: 'You are invited to Nova Systems training', body: `You have been accepted.\n\nUse this secure link to set up your training account. It works once and expires in ${days} days:\n\n${link}\n\nIf you did not apply to Nova Systems, ignore this email.`, channels: ['email'], idempotencyKey: `invite:${ins.row.id}` });
    const n = nid ? await dbOne(`sales_notifications?id=eq.${enc(nid)}&select=status,provider_message_id,last_error`) : null;
    if (n?.status === 'sent') await dbPatch('application_invitations', `id=eq.${enc(ins.row.id)}`, { status: 'sent', sent_at: nowIso(), provider_message_id: n.provider_message_id, last_event_at: nowIso() });
    else if (n?.status === 'failed') await dbPatch('application_invitations', `id=eq.${enc(ins.row.id)}`, { status: 'failed', delivery_error: n.last_error, last_event_at: nowIso() });
    else if (n) await dbPatch('application_invitations', `id=eq.${enc(ins.row.id)}`, { delivery_error: `Email not sent: ${n.status}${n.last_error ? ` (${n.last_error})` : ''}`, last_event_at: nowIso() });
    await appEvent(id, 'owner', 'invitation_created', { actor: caller, detail: { invitation_id: ins.row.id, email_status: n?.status } });
    await audit(caller, 'application', id, 'invitation_created', { invitation_id: ins.row.id });
    const live_mode = (env().SALES_EMAIL_MODE || 'dry_run').toLowerCase() === 'live';
    return res.status(200).json({ ok: true, invitation_id: ins.row.id, email_status: n?.status || 'unknown', expires_days: days, ...(live_mode ? {} : { dev_link: link, note: 'Email mode is not live, so the link is shown here (owner only) instead of being sent.' }) });
  }

  if (op === 'revoke-invite') {
    const rows = await dbPatch('application_invitations', `application_id=eq.${enc(id)}&status=in.(queued,sent,delivered)`, { status: 'revoked', last_event_at: nowIso() });
    await audit(caller, 'application', id, 'invitation_revoked', { count: rows.length });
    return res.status(200).json({ ok: true, revoked: rows.length });
  }
  return bad(res, 400, `Unknown hiring op: ${op}`);
});
