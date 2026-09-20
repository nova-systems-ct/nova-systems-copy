import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitizeEmail } from './_sanitize.js';
import { requireStaff } from './_auth.js';

// Staff team management for the Nova-internal organization — the "account invitation" piece real
// login/logout/password-reset already had (see src/pages/Login.jsx, ResetPassword.jsx,
// AuthCallback.jsx) but nothing previously covered: there was no way to get a new teammate INTO
// the system in the first place except an admin manually inserting rows via the Supabase
// dashboard. Uses Supabase Auth's own invite flow (a real email, Supabase's own template/SMTP —
// not something faked here) plus a real organization_members row on the Nova-internal org.
//
//   ?op=list                GET   staff roster for the Nova-internal org
//   ?op=invite               POST  { email, role } — invite a new staff member
//   ?op=update-role          POST  { staff_user_id, role } — change an existing member's role
//   ?op=deactivate           POST  { staff_user_id } — set status='inactive' (soft — never deletes
//                                   the auth user or their history)

const STAFF_ROLES = ['nova_super_admin', 'nova_admin', 'nova_auditor', 'nova_marketing', 'nova_sales', 'nova_developer'];

async function getNovaInternalOrgId(SUPABASE_URL, SUPABASE_KEY) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/organizations?kind=eq.nova_internal&select=id&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0]?.id || null;
}

async function handleList(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const orgId = await getNovaInternalOrgId(SUPABASE_URL, SUPABASE_KEY);
  if (!orgId) return res.status(200).json({ members: [] });

  const mRes = await fetch(`${SUPABASE_URL}/rest/v1/organization_members?organization_id=eq.${orgId}&select=id,staff_user_id,role,status,created_at&order=created_at.asc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!mRes.ok) return res.status(502).json({ error: 'Failed to load team roster' });
  const members = await mRes.json();

  // Emails aren't stored on organization_members (identity lives in auth.users) — resolve each,
  // best-effort. A lookup failure hides that one email rather than failing the whole roster.
  const withEmail = await Promise.all(members.map(async (m) => {
    try {
      const uRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${m.staff_user_id}`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      const user = uRes.ok ? await uRes.json() : null;
      return { ...m, email: user?.email || null, email_confirmed: !!user?.email_confirmed_at };
    } catch {
      return { ...m, email: null, email_confirmed: false };
    }
  }));

  return res.status(200).json({ members: withEmail });
}

async function handleInvite(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const email = sanitizeEmail(req.body?.email || '');
  const role = STAFF_ROLES.includes(req.body?.role) ? req.body.role : '';
  if (!email) return res.status(400).json({ error: 'A valid email is required.' });
  if (!role) return res.status(400).json({ error: `Role must be one of: ${STAFF_ROLES.join(', ')}` });

  const orgId = await getNovaInternalOrgId(SUPABASE_URL, SUPABASE_KEY);
  if (!orgId) return res.status(500).json({ error: 'Nova internal organization not found — has the Stage 4 migration been run?' });

  // Supabase's own invite endpoint: creates the auth user (unconfirmed) and sends a real email via
  // Supabase's configured SMTP/template — clicking it lands on /auth/callback with a session,
  // exactly like the password-recovery flow, where they land on /reset-password to set one.
  const inviteRes = await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      data: {},
      options: { redirectTo: `${req.headers.origin || 'https://nova-systems.app'}/auth/callback` },
    }),
  });

  if (!inviteRes.ok) {
    const errBody = await inviteRes.json().catch(() => ({}));
    const alreadyExists = inviteRes.status === 422 || /already.*registered|already.*exists/i.test(errBody?.msg || errBody?.error_description || '');
    return res.status(inviteRes.status).json({
      error: alreadyExists
        ? 'That email is already a registered user. Use "update role" instead of a new invite.'
        : (errBody?.msg || errBody?.error_description || 'Invite failed.'),
    });
  }

  const invitedUser = await inviteRes.json();
  if (!invitedUser?.id) return res.status(502).json({ error: 'Invite sent but no user id was returned — check Supabase Auth directly.' });

  const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/organization_members`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, member_type: 'staff', staff_user_id: invitedUser.id, role, status: 'active' }),
  });

  if (!memberRes.ok) {
    const errText = await memberRes.text();
    console.error('[team:invite] organization_members insert failed:', memberRes.status, errText);
    return res.status(502).json({ error: 'Invite email was sent, but adding the membership record failed. The user exists in Supabase Auth but has no role yet — add it manually or retry.' });
  }

  return res.status(200).json({ ok: true, email, role, staff_user_id: invitedUser.id });
}

async function handleUpdateRole(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const staffUserId = typeof req.body?.staff_user_id === 'string' ? req.body.staff_user_id : '';
  const role = STAFF_ROLES.includes(req.body?.role) ? req.body.role : '';
  if (!staffUserId || !role) return res.status(400).json({ error: 'staff_user_id and a valid role are required.' });

  const orgId = await getNovaInternalOrgId(SUPABASE_URL, SUPABASE_KEY);
  if (!orgId) return res.status(500).json({ error: 'Nova internal organization not found' });

  const r = await fetch(`${SUPABASE_URL}/rest/v1/organization_members?organization_id=eq.${orgId}&staff_user_id=eq.${staffUserId}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!r.ok) return res.status(502).json({ error: 'Failed to update role' });
  return res.status(200).json({ ok: true });
}

async function handleDeactivate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const staffUserId = typeof req.body?.staff_user_id === 'string' ? req.body.staff_user_id : '';
  if (!staffUserId) return res.status(400).json({ error: 'staff_user_id is required.' });

  const orgId = await getNovaInternalOrgId(SUPABASE_URL, SUPABASE_KEY);
  if (!orgId) return res.status(500).json({ error: 'Nova internal organization not found' });

  // Soft — flips status only. Never deletes the auth user, their history, or any record they
  // created; is_org_member()/has_permission() both filter on status='active', so this alone is
  // enough to cut off access without touching anything else.
  const r = await fetch(`${SUPABASE_URL}/rest/v1/organization_members?organization_id=eq.${orgId}&staff_user_id=eq.${staffUserId}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'inactive' }),
  });
  if (!r.ok) return res.status(502).json({ error: 'Failed to deactivate member' });
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (!(await requireStaff(req, res, 'members.manage'))) return;

  const op = typeof req.query?.op === 'string' ? req.query.op : '';
  if (op === 'list') return handleList(req, res);
  if (op === 'invite') return handleInvite(req, res);
  if (op === 'update-role') return handleUpdateRole(req, res);
  if (op === 'deactivate') return handleDeactivate(req, res);
  return res.status(400).json({ error: `Unknown op: ${op}` });
}
