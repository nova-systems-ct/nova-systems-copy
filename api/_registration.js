// Business registration: a business asks to join, a Nova administrator approves, and the business
// gets its own organization, a starting service list (never priced), a draft assistant and an
// owner login. Routed from api/client.js as ?resource=register.
//
//   POST op=request   public. Saves the request. Creates no account, sends nothing.
//   GET  op=list      Nova administrators only.
//   POST op=approve   Nova administrators only. Safe to repeat: each step checks what already exists.
//   POST op=decline   Nova administrators only.
import crypto from 'crypto';
import { restDb } from './_journey.js';
import { INDUSTRY_PACKS, applyPack } from './_industryPacks.js';
import { normalizePhone } from './_wave1.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;
const slugify = (name) => (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'business') + '-' + crypto.randomBytes(3).toString('hex');

// Supabase Auth, service role. Looks a login up by email, or emails an invitation.
export function supabaseAuth(origin) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  return {
    async userByEmail(email) {
      const r = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers });
      if (!r.ok) throw new Error('auth_unavailable');
      const j = await r.json(); const users = j.users || (Array.isArray(j) ? j : []);
      return users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null; // the filter is not strict; match exactly
    },
    async invite(email, name) {
      const r = await fetch(`${url}/auth/v1/invite`, { method: 'POST', headers, body: JSON.stringify({ email, data: name ? { full_name: name } : {}, options: { redirectTo: `${origin}/auth/callback` } }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.id) throw new Error('invite_failed');
      return j;
    },
  };
}

// Approves one registration. Every step is a "create if missing", so a retry after a failure
// carries on from where it stopped and never makes a second organization or membership.
export async function approveRegistration(db, auth, reg, { approver }) {
  const steps = [];
  let orgId = reg.organization_id;
  if (!orgId) {
    const org = await db.insert('organizations', { name: reg.business_name, slug: slugify(reg.business_name), kind: 'client', status: 'active' });
    orgId = org.id;
    await db.update('business_registrations', { id: reg.id }, { organization_id: orgId });
    steps.push('organization_created');
  }
  let userId = reg.owner_user_id, access = reg.owner_access;
  if (!userId) {
    const existing = await auth.userByEmail(reg.email);
    if (existing) { userId = existing.id; access = 'existing_login'; }
    else { userId = (await auth.invite(reg.email, reg.contact_name)).id; access = 'invite_emailed'; steps.push('invite_emailed'); }
    await db.update('business_registrations', { id: reg.id }, { owner_user_id: userId, owner_access: access });
  }
  const member = async (uid, role) => {
    if (await one(db, 'organization_members', { organization_id: orgId, staff_user_id: uid })) return false;
    await db.insert('organization_members', { organization_id: orgId, member_type: 'staff', staff_user_id: uid, role, status: 'active' });
    return true;
  };
  if (await member(userId, 'client_owner')) steps.push('owner_added');
  // The Nova administrator who approved it can open this business's desk to set it up with the owner.
  if (approver?.id && approver.id !== userId && await member(approver.id, 'nova_admin')) steps.push('nova_admin_added');
  if (reg.industry_pack && Object.hasOwn(INDUSTRY_PACKS, reg.industry_pack)) {
    const out = await applyPack(db, orgId, reg.industry_pack);
    if (out.added.length) steps.push(`services_added:${out.added.length}`);
  }
  if (!(await one(db, 'business_agents', { organization_id: orgId }))) {
    // A draft only: no phone number, texting and calls off, no spending cap (so nothing can be charged).
    await db.insert('business_agents', { organization_id: orgId, business_name: reg.business_name, agent_name: 'the assistant', industry: reg.industry_pack ? INDUSTRY_PACKS[reg.industry_pack]?.name || null : null, tone: 'friendly', sms_enabled: false, voice_enabled: false, monthly_spend_cap_cents: null, status: 'draft' });
    steps.push('assistant_draft_created');
  }
  await db.update('business_registrations', { id: reg.id }, { status: 'approved', decided_by: approver?.email || approver?.id || null, decided_at: new Date().toISOString() });
  return { organization_id: orgId, owner_access: access, steps };
}

export async function handleRegistration(req, res, op, { requireStaff, requireOrgAccess, sanitize, sanitizeEmail, rateLimit, auth }) {
  res.setHeader('Cache-Control', 'no-store');
  const b = req.body || {};
  try {
    const db = restDb();
    if (op === 'request') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      if (!rateLimit(req, res, 5, 60_000)) return;
      if (b.website_url_confirm) return res.status(200).json({ ok: true }); // honeypot: pretend, store nothing
      const business = sanitize(b.business_name, 200), name = sanitize(b.contact_name, 100), email = sanitizeEmail(b.email);
      const phone = b.phone ? normalizePhone(b.phone) : null, pack = sanitize(b.industry_pack, 60);
      if (!business || !name || !email) return res.status(422).json({ error: 'Enter your business name, your name and your email.' });
      if (b.phone && !phone) return res.status(422).json({ error: 'Enter the phone number with area code, or leave it empty.' });
      if (pack && !Object.hasOwn(INDUSTRY_PACKS, pack)) return res.status(422).json({ error: 'Choose a type of business from the list.' });
      if (b.agree !== true) return res.status(422).json({ error: 'Confirm that Nova may contact you about this request.' });
      const open = (await db.select('business_registrations', { email, status: 'pending' })).find((r) => r.business_name.toLowerCase() === business.toLowerCase());
      if (!open) await db.insert('business_registrations', { business_name: business, industry_pack: pack || null, contact_name: name, email, phone, message: sanitize(b.message, 2000) || null, status: 'pending' });
      // Same answer whether or not it was already on file: this page reveals nothing about who has asked.
      return res.status(200).json({ ok: true });
    }

    const caller = await requireStaff(req, res);
    if (!caller) return;
    const nova = await one(db, 'organizations', { kind: 'nova_internal' });
    if (!nova) return res.status(503).json({ error: 'Nova\'s own organization is not set up in this database.' });
    if (!(await requireOrgAccess(req, res, nova.id, 'admin.view'))) return;

    if (req.method === 'GET') {
      const rows = await db.select('business_registrations', {}, { order: 'created_at.desc', limit: 200 });
      return res.status(200).json({ registrations: rows, packs: Object.entries(INDUSTRY_PACKS).map(([key, p]) => ({ key, name: p.name })) });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!rateLimit(req, res, 20, 60_000)) return;
    const id = sanitize(b.registration_id, 100);
    const reg = UUID_RE.test(id) ? await one(db, 'business_registrations', { id }) : null;
    if (!reg) return res.status(404).json({ error: 'Not found' });
    if (op === 'decline') {
      if (reg.status !== 'pending' || reg.organization_id) return res.status(409).json({ error: 'This request has already been acted on.' });
      await db.update('business_registrations', { id: reg.id }, { status: 'declined', decided_by: caller.email || caller.id, decided_at: new Date().toISOString() });
      return res.status(200).json({ ok: true });
    }
    if (op !== 'approve') return res.status(400).json({ error: 'Unknown action' });
    if (reg.status === 'declined') return res.status(409).json({ error: 'This request was declined.' });
    const origin = /^https:\/\/[a-z0-9.-]+$/i.test(req.headers?.origin || '') ? req.headers.origin : 'https://nova-systems.app';
    const out = await approveRegistration(db, auth || supabaseAuth(origin), reg, { approver: caller });
    return res.status(200).json({ ok: true, ...out });
  } catch (err) {
    if (err.expected) return res.status(err.status).json({ error: err.message });
    console.error('[register]', err.message);
    const msg = err.message === 'invite_failed' ? 'The business was created, but the owner\'s invitation email could not be sent. Approve again to retry; nothing will be duplicated.' : 'That could not be completed. Approve again to carry on; nothing will be duplicated.';
    return res.status(502).json({ error: msg });
  }
}
