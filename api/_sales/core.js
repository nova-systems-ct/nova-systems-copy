// Shared plumbing for the Sales Team platform API modules (api/_sales/*). Files under api/_sales are helpers, not
// Vercel functions (the 12-function cap is unaffected): they are dispatched from api/client.js.
//
// Conventions
//  * Everything talks to the database with the SERVICE ROLE and therefore MUST do its own authorization: every
//    handler starts with requireUser / requirePerm / requireActiveRep and every row lookup is scoped by the caller.
//  * Environment is read at call time (never at import), so tests can point it at the local integration environment.
//  * Nothing here logs secrets, tokens, or full message bodies.
import crypto from 'node:crypto';
import { requireStaff } from '../_auth.js';

export const env = () => process.env;
const cfg = () => ({ url: env().SUPABASE_URL, key: env().SUPABASE_SERVICE_ROLE_KEY });
export const nowIso = () => new Date().toISOString();

// ------------------------------------------------------------------ database
export async function dbFetch(path, { method = 'GET', body, prefer } = {}) {
  const { url, key } = cfg();
  if (!url || !key) throw Object.assign(new Error('Supabase is not configured'), { status: 500 });
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  return fetch(`${url}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
export async function dbGet(path) {
  const r = await dbFetch(path);
  if (!r.ok) throw Object.assign(new Error(`read failed (${r.status}) ${path.split('?')[0]}`), { status: 500, detail: await r.text().catch(() => '') });
  return r.json();
}
export const dbOne = async (path) => (await dbGet(path.includes('limit=') ? path : `${path}${path.includes('?') ? '&' : '?'}limit=1`))[0] || null;
// Insert; returns { row } or { conflict: true } on a unique violation (409) or throws.
export async function dbInsert(table, row, { onConflict } = {}) {
  const r = await dbFetch(onConflict ? `${table}?on_conflict=${onConflict}` : table, { method: 'POST', body: row, prefer: onConflict ? 'return=representation,resolution=ignore-duplicates' : 'return=representation' });
  if (r.status === 409) return { conflict: true, detail: await r.text().catch(() => '') };
  if (!r.ok) throw Object.assign(new Error(`insert failed (${r.status}) ${table}`), { status: 500, detail: await r.text().catch(() => '') });
  const rows = await r.json();
  return Array.isArray(rows) && rows.length ? { row: rows[0], rows } : { conflict: !!onConflict };
}
// Patch rows matching `filter` (a PostgREST query string, ALWAYS including the owning scope); returns updated rows.
export async function dbPatch(table, filter, patch) {
  const r = await dbFetch(`${table}?${filter}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
  if (!r.ok) throw Object.assign(new Error(`update failed (${r.status}) ${table}`), { status: 500, detail: await r.text().catch(() => '') });
  return r.json();
}
export async function dbRpc(fn, args) {
  const r = await dbFetch(`rpc/${fn}`, { method: 'POST', body: args });
  if (!r.ok) throw Object.assign(new Error(`rpc failed (${r.status}) ${fn}`), { status: 500, detail: await r.text().catch(() => '') });
  return r.json();
}
export const enc = encodeURIComponent;
export const inList = (ids) => `(${ids.map((i) => enc(i)).join(',')})`;

let novaOrg = null; let novaOrgAt = 0;
export async function novaOrgId() {
  if (novaOrg && Date.now() - novaOrgAt < 60_000) return novaOrg;
  const o = await dbOne('organizations?kind=eq.nova_internal&select=id');
  if (!o) throw Object.assign(new Error('Nova Systems organization not found'), { status: 500 });
  novaOrg = o.id; novaOrgAt = Date.now(); return novaOrg;
}
export const resetCoreCaches = () => { novaOrg = null; novaOrgAt = 0; };

// ------------------------------------------------------------------ audit trail (append-only in the database)
export async function audit(actor, entityType, entityId, action, detail = {}) {
  try {
    await dbInsert('sales_audit_log', { actor_user_id: actor?.id || null, actor_role: (actor?.roles || [])[0] || actor?.kind || null, entity_type: entityType, entity_id: entityId == null ? null : String(entityId), action, detail });
  } catch (e) { console.error('[sales:audit] FAILED to write audit record:', entityType, action, e.message); throw e; } // an unaudited financial/access change must not proceed silently
}

// ------------------------------------------------------------------ responses
export const bad = (res, code, message, extra = {}) => { res.status(code).json({ error: message, ...extra }); return null; };
export function wrap(fn) {
  return async (req, res, ...rest) => {
    try { return await fn(req, res, ...rest); }
    catch (e) { console.error('[sales:error]', e.message, e.detail ? String(e.detail).slice(0, 300) : ''); return res.status(e.status && e.status < 600 ? e.status : 500).json({ error: e.status === 500 || !e.status ? 'Something went wrong on our side. Nothing was changed if this persists — please try again.' : e.message }); }
  };
}

// ------------------------------------------------------------------ authentication / authorization
// A valid Supabase session, with NO membership requirement (applicants have none).
export async function requireUser(req, res) {
  const h = req.headers?.authorization || ''; const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  const { url, key } = cfg();
  if (!token) return bad(res, 401, 'Please sign in.');
  if (!url || !key) return bad(res, 500, 'Server auth is not configured.');
  let r; try { r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } }); } catch { return bad(res, 502, 'Sign-in service unreachable.'); }
  if (!r.ok) return bad(res, 401, 'Your session is invalid or has expired. Please sign in again.');
  const u = await r.json(); if (!u?.id) return bad(res, 401, 'Invalid session.');
  return { id: u.id, email: (u.email || '').toLowerCase(), name: u.user_metadata?.full_name || null };
}
// A signed-in member holding `permission` (membership must be active). Suspended/inactive members are rejected here.
export async function requirePerm(req, res, permission) {
  const caller = await requireStaff(req, res, permission);
  return caller || null; // requireStaff already wrote the response on failure
}
export const isOwner = (caller) => (caller?.roles || []).includes('nova_super_admin');
// An ACTIVE representative: sales.rep permission AND a sales_reps row with status 'active'. Fails closed.
export async function requireActiveRep(req, res) {
  const caller = await requirePerm(req, res, 'sales.rep'); if (!caller) return null;
  const rep = await dbOne(`sales_reps?user_id=eq.${enc(caller.id)}&select=id,status,manager_user_id,display_name`);
  if (!rep || rep.status !== 'active') return bad(res, 403, 'Your representative account is not active.');
  return { ...caller, rep };
}
// Which representative user ids a caller may see. Owner/admin: everyone (null = unrestricted). Manager: only assigned reps.
export async function visibleRepUserIds(caller) {
  if (isOwner(caller) || (caller.roles || []).includes('nova_admin')) return null;
  const reps = await dbGet(`sales_reps?manager_user_id=eq.${enc(caller.id)}&select=user_id`);
  return reps.map((r) => r.user_id);
}

// ------------------------------------------------------------------ tokens & codes
export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomCode(len, prefix = '') { const b = crypto.randomBytes(len); let out = ''; for (let i = 0; i < len; i++) out += CODE_CHARS[b[i] % CODE_CHARS.length]; return prefix + out; }
export const safeEqual = (a, b) => { try { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); } catch { return false; } };
export function canonicalJson(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}

// ------------------------------------------------------------------ Supabase Auth admin helpers
async function authAdmin(path, { method = 'GET', body } = {}) {
  const { url, key } = cfg();
  const r = await fetch(`${url}/auth/v1/${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, json };
}
export async function authUserByEmail(email) {
  const r = await authAdmin(`admin/users?email=${enc(email)}`); if (!r.ok) return null;
  const users = r.json.users || (Array.isArray(r.json) ? r.json : []);
  return users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null; // the admin filter has been observed not to filter strictly
}
export const authCreateUser = (email, { password, name, confirm = true } = {}) => authAdmin('admin/users', { method: 'POST', body: { email, password, email_confirm: confirm, user_metadata: name ? { full_name: name } : {} } });
export const authUpdateUser = (id, patch) => authAdmin(`admin/users/${enc(id)}`, { method: 'PUT', body: patch });
export const authMagicLink = (email, redirectTo) => authAdmin('admin/generate_link', { method: 'POST', body: { type: 'magiclink', email, redirect_to: redirectTo } });

// ------------------------------------------------------------------ private storage
export async function storagePut(bucket, path, buffer, mime) {
  const { url, key } = cfg();
  const r = await fetch(`${url}/storage/v1/object/${bucket}/${path.split('/').map(enc).join('/')}`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': mime, 'x-upsert': 'true' }, body: buffer });
  if (!r.ok) throw Object.assign(new Error(`storage upload failed (${r.status})`), { status: 502, detail: await r.text().catch(() => '') });
  return path;
}
export async function storageSign(bucket, path, seconds = 300) {
  const { url, key } = cfg();
  const r = await fetch(`${url}/storage/v1/object/sign/${bucket}/${path.split('/').map(enc).join('/')}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: seconds }) });
  if (!r.ok) throw Object.assign(new Error(`signed url failed (${r.status})`), { status: 502 });
  const { signedURL } = await r.json(); return `${url}/storage/v1${signedURL}`;
}

// ------------------------------------------------------------------ mail + notifications
// SALES_EMAIL_MODE: 'dry_run' (default — recorded, NOT sent) | 'live'. In live mode SALES_EMAIL_ALLOWLIST (comma-separated
// addresses or @domains) restricts recipients so development never emails a real person by accident.
export function emailPolicy(to) {
  const mode = (env().SALES_EMAIL_MODE || 'dry_run').toLowerCase();
  if (mode !== 'live') return { send: false, status: 'dry_run', reason: 'SALES_EMAIL_MODE is not "live"' };
  const allow = (env().SALES_EMAIL_ALLOWLIST || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length && !allow.some((a) => (a.startsWith('@') ? to.toLowerCase().endsWith(a) : to.toLowerCase() === a))) return { send: false, status: 'blocked', reason: 'recipient is not on SALES_EMAIL_ALLOWLIST' };
  if (!env().RESEND_API_KEY) return { send: false, status: 'failed', reason: 'RESEND_API_KEY is not configured' };
  return { send: true };
}
export const appBase = () => (env().APP_BASE_URL || 'https://nova-systems.app').replace(/\/$/, '');
async function sendEmailNow({ to, subject, text, idempotencyKey }) {
  const base = (env().RESEND_API_URL || 'https://api.resend.com').replace(/\/$/, '');
  const from = env().SALES_FROM_EMAIL || 'Nova Systems <noreply@nova-systems.app>';
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const r = await fetch(`${base}/emails`, { method: 'POST', signal: ctrl.signal, headers: { Authorization: `Bearer ${env().RESEND_API_KEY}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) }, body: JSON.stringify({ from, to: [to], subject, text }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, id: j.id || null };
    return { ok: false, error: `provider ${r.status}: ${String(j.message || '').slice(0, 120)}` };
  } catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'provider timeout (outcome unknown)' : e.message }; } finally { clearTimeout(t); }
}
// Deliver one email notification row. Honest states: dry_run / blocked / failed / sent (provider accepted). 'sent' is NOT 'delivered'.
export async function deliverEmailRow(row) {
  const pol = emailPolicy(row.email);
  if (!pol.send) { await dbPatch('sales_notifications', `id=eq.${enc(row.id)}`, { status: pol.status, last_error: pol.reason, attempts: (row.attempts || 0) + 1 }); return pol.status; }
  const r = await sendEmailNow({ to: row.email, subject: row.subject, text: row.body, idempotencyKey: row.idempotency_key || row.id });
  await dbPatch('sales_notifications', `id=eq.${enc(row.id)}`, r.ok ? { status: 'sent', sent_at: nowIso(), provider_message_id: r.id, last_error: null, attempts: (row.attempts || 0) + 1 } : { status: 'failed', last_error: r.error, attempts: (row.attempts || 0) + 1 });
  return r.ok ? 'sent' : 'failed';
}
// Create notification(s). channels: ['in_app'] and/or ['email']. Idempotent per (idempotencyKey + channel).
export async function notify({ userId = null, email = null, kind, subject, body, link = null, channels = ['in_app', 'email'], idempotencyKey = null }) {
  const out = [];
  for (const channel of channels) {
    if (channel === 'email' && !email) continue;
    if (channel === 'in_app' && !userId) continue;
    const key = idempotencyKey ? `${idempotencyKey}:${channel}` : null;
    const ins = await dbInsert('sales_notifications', { user_id: userId, email: channel === 'email' ? email : null, channel, kind, subject, body, link, status: channel === 'in_app' ? 'sent' : 'queued', sent_at: channel === 'in_app' ? nowIso() : null, idempotency_key: key }, { onConflict: key ? 'idempotency_key' : undefined });
    if (ins.conflict || !ins.row) continue;
    if (channel === 'email') { try { await deliverEmailRow(ins.row); } catch (e) { console.error('[sales:notify] email delivery attempt failed (will be retried by the worker):', e.message); } }
    out.push(ins.row.id);
  }
  return out;
}

// ------------------------------------------------------------------ people lookups
const userCache = new Map();
export async function authUserById(id) {
  const hit = userCache.get(id); if (hit && Date.now() - hit.at < 30_000) return hit.u;
  const { url, key } = cfg();
  const r = await fetch(`${url}/auth/v1/admin/users/${enc(id)}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const u = r.ok ? await r.json() : null; userCache.set(id, { at: Date.now(), u }); return u;
}
export const resetUserCache = () => userCache.clear();
export async function displayNameOf(id) { const u = await authUserById(id); return u?.user_metadata?.full_name || u?.email || 'Unknown user'; }
// Active members of the Nova organization holding any of `roles` → [{id, email}]
export async function usersWithRoles(roles) {
  const rows = await dbGet(`organization_members?role=in.${inList(roles)}&status=eq.active&select=staff_user_id`);
  const out = []; for (const r of rows) { const u = await authUserById(r.staff_user_id); if (u?.email) out.push({ id: r.staff_user_id, email: u.email.toLowerCase() }); }
  return out;
}
// Does this user (via an ACTIVE membership) hold `permission`? Server-side check for assigning work to people.
export async function userHasPerm(userId, permission) {
  const m = await dbGet(`organization_members?staff_user_id=eq.${enc(userId)}&status=eq.active&select=role`);
  if (!m.length) return false;
  const rp = await dbGet(`role_permissions?role=in.${inList([...new Set(m.map((x) => x.role))])}&select=permissions(key)`);
  return rp.some((r) => r.permissions?.key === permission);
}
export async function notifyOwners({ kind, subject, body, link, idempotencyKey, channels = ['in_app', 'email'] }) {
  const owners = await usersWithRoles(['nova_super_admin']);
  for (const o of owners) await notify({ userId: o.id, email: o.email, kind, subject, body, link, channels, idempotencyKey: idempotencyKey ? `${idempotencyKey}:${o.id}` : null });
}
