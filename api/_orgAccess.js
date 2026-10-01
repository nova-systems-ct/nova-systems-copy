// Object-level authorization shared by every api/*.js handler that uses the service-role key.
//
// hasOrgPermission() asks the database's own has_permission(org, key) function WITH THE CALLER'S
// TOKEN (not the service role), so it answers "does this person hold this permission in THIS
// organization" — the same rule RLS uses. Handlers must call it with the organization that OWNS the
// target row (look the row up first), never only with an organization id the caller supplied.

const env = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });

export function callerToken(req) {
  const h = req.headers?.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

export async function hasOrgPermission(req, orgId, permission) {
  const { url, key } = env();
  const token = callerToken(req);
  if (!orgId || !token || !url || !key) return false;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/has_permission`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_org_id: orgId, permission_key: permission }),
    });
    return r.ok && (await r.json()) === true;
  } catch {
    return false;
  }
}

// Writes the error response itself; returns true only when allowed.
export async function requireOrgAccess(req, res, orgId, permission) {
  if (!orgId) { res.status(400).json({ error: 'organization_id is required' }); return false; }
  const { url, key } = env();
  if (!url || !key) { res.status(500).json({ error: 'Server auth not configured' }); return false; }
  const ok = await hasOrgPermission(req, orgId, permission);
  if (!ok) { res.status(403).json({ error: 'Insufficient permissions for this organization' }); return false; }
  return true;
}

let novaOrgCache = null; let novaOrgAt = 0;
export async function novaInternalOrgId() {
  if (novaOrgCache && Date.now() - novaOrgAt < 60_000) return novaOrgCache;
  const { url, key } = env();
  if (!url || !key) return null;
  const r = await fetch(`${url}/rest/v1/organizations?kind=eq.nova_internal&select=id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const id = r.ok ? ((await r.json())[0]?.id || null) : null;
  if (id) { novaOrgCache = id; novaOrgAt = Date.now(); }
  return id;
}
export const resetOrgAccessCache = () => { novaOrgCache = null; novaOrgAt = 0; };

// For Nova-internal (platform) resources: the caller must hold `permission` in the Nova Systems
// organization itself — a role held in some other (client) organization never counts.
export async function requireNovaAccess(req, res, permission) {
  const orgId = await novaInternalOrgId();
  if (!orgId) { res.status(500).json({ error: 'Nova organization not found' }); return false; }
  return requireOrgAccess(req, res, orgId, permission);
}

// Loads one row by id with the service role and returns it only if the CALLER holds `permission`
// in the organization that owns it. Responds 404 (not 403) when missing or not permitted, so ids of
// other organizations' rows are not confirmed to exist.
export async function loadOwnedRow(req, res, table, id, permission, select = '*') {
  const { url, key } = env();
  if (!id) { res.status(400).json({ error: 'id is required' }); return null; }
  const r = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=${select}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const row = r.ok ? (await r.json())[0] : null;
  if (!row || !row.organization_id || !(await hasOrgPermission(req, row.organization_id, permission))) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  return row;
}
