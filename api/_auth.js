// Server-side authentication for staff-only api/client.js resources.
//
// Real Supabase Auth users are always member_type='staff' (see src/lib/OrgContext.jsx and
// supabase/schema-update.sql's Stage 4 section) — the caller's actual business relationship comes
// from role + an active organization_members row, never a separate identity type. requireStaff()
// verifies the caller's session token against Supabase itself (never trusts a client-supplied user
// id), then — when a permission is given — checks that at least one of the caller's active roles
// carries it, via the same role_permissions -> permissions(key) model the frontend's
// RequirePermission component gates routes on. This exists because moving a call server-side does
// not by itself make it secure: api/client.js's handlers use the Supabase service-role key
// internally (full DB access, bypasses RLS), so without a check here any caller who can reach the
// endpoint directly — not just through the gated dashboard UI — has unrestricted access.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Verifies the bearer token and (optionally) a required permission key. On failure, writes the
// appropriate error response itself and returns null — callers should `if (!user) return;`.
export async function requireStaff(req, res, permission) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Server auth not configured' });
    return null;
  }

  let user;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return null;
    }
    user = await r.json();
  } catch {
    res.status(502).json({ error: 'Auth service unreachable' });
    return null;
  }
  if (!user?.id) {
    res.status(401).json({ error: 'Invalid session' });
    return null;
  }

  // Security repair 2026-09-30 (audit F-23): permissions used to be pooled across EVERY organization
  // a user belonged to, so a role held in a client organization unlocked Nova-wide resources. Now:
  //  - any active membership still passes a bare requireStaff(req, res) (object-level checks in each
  //    handler then decide per organization via has_permission), but
  //  - requireStaff(req, res, permission) is satisfied ONLY by roles held in the Nova Systems
  //    (nova_internal) organization, and caller.roles lists only those Nova roles.
  let memberships;
  try {
    const memberUrl = `${SUPABASE_URL}/rest/v1/organization_members?staff_user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&select=role,organization_id,organizations(kind)`;
    const mRes = await fetch(memberUrl, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!mRes.ok) {
      res.status(502).json({ error: 'Membership lookup failed' });
      return null;
    }
    memberships = await mRes.json();
  } catch {
    res.status(502).json({ error: 'Membership lookup failed' });
    return null;
  }

  if (!memberships.length) {
    res.status(403).json({ error: 'No active organization membership' });
    return null;
  }
  const roles = [...new Set(memberships.filter((m) => m.organizations?.kind === 'nova_internal').map((m) => m.role))];
  const orgIds = [...new Set(memberships.map((m) => m.organization_id))];

  if (!permission) return { id: user.id, email: user.email, roles, orgIds };
  if (!roles.length) {
    res.status(403).json({ error: 'Insufficient permissions' });
    return null;
  }

  try {
    const permUrl = `${SUPABASE_URL}/rest/v1/role_permissions?role=in.(${roles.map(encodeURIComponent).join(',')})&select=role,permissions(key)`;
    const pRes = await fetch(permUrl, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!pRes.ok) {
      res.status(502).json({ error: 'Permission lookup failed' });
      return null;
    }
    const prows = await pRes.json();
    const hasPermission = prows.some((r) => r.permissions?.key === permission);
    if (!hasPermission) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return null;
    }
  } catch {
    res.status(502).json({ error: 'Permission check failed' });
    return null;
  }

  return { id: user.id, email: user.email, roles, orgIds };
}
