// Business registration (api/_registration.js): a public request creates nothing but a request;
// approval creates one organization, one owner, a never-priced service list and a draft assistant;
// repeating an approval duplicates nothing. In-memory store; no database or email is contacted.
import crypto from 'node:crypto';
import { handleRegistration } from '../api/_registration.js';

const NOVA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };

function memoryDb() {
  const t = {}; const rows = (n) => (t[n] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : r[k] === v));
  return { t,
    select: async (n, f = {}, { limit = 500 } = {}) => rows(n).filter((r) => hit(r, f)).slice(0, limit).map((r) => ({ ...r })),
    insert: async (n, row) => { const full = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row }; rows(n).push(full); return { ...full }; },
    update: async (n, f, patch) => rows(n).filter((r) => hit(r, f)).map((r) => ({ ...Object.assign(r, patch) })) };
}
const db = memoryDb();
await db.insert('organizations', { id: NOVA, name: 'Nova Systems', kind: 'nova_internal' });
process.env.SUPABASE_URL = 'https://db.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url)), table = u.pathname.replace('/rest/v1/', ''), f = {};
  for (const [k, v] of u.searchParams) if (!['order', 'limit'].includes(k)) f[k] = v === 'is.null' ? null : (v.slice(3) === 'true' ? true : v.slice(3) === 'false' ? false : v.slice(3));
  const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
  if (!init.method) return json(200, await db.select(table, f, { limit: Number(u.searchParams.get('limit')) || 500 }));
  if (init.method === 'POST') return json(201, [await db.insert(table, JSON.parse(init.body))]);
  return json(200, await db.update(table, f, JSON.parse(init.body)));
};

const invites = [];
const users = { 'isaac@example.invalid': { id: 'user-isaac', email: 'isaac@example.invalid' } };
let inviteWorks = true;
const auth = { userByEmail: async (e) => users[e] || null, invite: async (e) => { if (!inviteWorks) throw new Error('invite_failed'); invites.push(e); users[e] = { id: 'user-' + invites.length, email: e }; return users[e]; } };
// who: null = not signed in; { nova: bool } = signed in, with or without Nova administrator rights
const deps = (who) => ({ auth,
  requireStaff: async (_r, res) => { if (!who) res.status(401).json({ error: 'login' }); return who ? { id: who.id || 'admin-1', email: 'admin@example.invalid' } : null; },
  requireOrgAccess: async (_r, res, orgId, perm) => { const ok = who?.nova && orgId === NOVA && perm === 'admin.view'; if (!ok) res.status(403).json({ error: 'no' }); return ok; },
  sanitize: (v, n = 2000) => (typeof v === 'string' ? v.trim().slice(0, n) : ''), sanitizeEmail: (v) => (typeof v === 'string' && /^\S+@\S+\.\S+$/.test(v) ? v.trim().toLowerCase() : ''), rateLimit: () => true });
const call = async (method, op, body, who = null) => { const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(x) { this.body = x; return this; } }; await handleRegistration({ method, query: {}, body, headers: { origin: 'https://nova-systems.app' } }, res, op, deps(who)); return res; };
const ask = { business_name: 'Crystal Clear', contact_name: 'Dana', email: 'Dana@Example.invalid', industry_pack: 'lawn_care', agree: true };

let r = await call('POST', 'request', { ...ask, agree: false });
check('a request without consent to be contacted is refused', r.code === 422 && !db.t.business_registrations);
r = await call('POST', 'request', { ...ask, industry_pack: 'made_up' });
check('an unknown type of business is refused', r.code === 422);
r = await call('POST', 'request', { ...ask, website_url_confirm: 'x' });
check('a filled hidden field stores nothing', r.code === 200 && !db.t.business_registrations);
r = await call('POST', 'request', ask);
check('a valid request is saved as pending', r.code === 200 && db.t.business_registrations.length === 1 && db.t.business_registrations[0].status === 'pending');
check('a request creates no organization, login, membership or email', db.t.organizations.length === 1 && !db.t.organization_members && invites.length === 0);
r = await call('POST', 'request', { ...ask, business_name: 'crystal clear' });
check('asking twice is one request, and the page says the same thing both times', r.code === 200 && db.t.business_registrations.length === 1 && JSON.stringify(r.body) === '{"ok":true}');

const id = db.t.business_registrations[0].id;
r = await call('GET', 'list', undefined, null);
check('the list needs a login', r.code === 401);
r = await call('GET', 'list', undefined, { nova: false });
check('a signed-in client cannot see other businesses\' requests', r.code === 403);
r = await call('POST', 'approve', { registration_id: id }, { nova: false });
check('a signed-in client cannot approve a business', r.code === 403 && db.t.organizations.length === 1);
r = await call('GET', 'list', undefined, { nova: true });
check('a Nova administrator sees the requests', r.code === 200 && r.body.registrations.length === 1);

inviteWorks = false;
r = await call('POST', 'approve', { registration_id: id }, { nova: true });
check('if the invitation email fails, the approval reports it and stays unfinished', r.code === 502 && /invitation/.test(r.body.error) && db.t.business_registrations[0].status === 'pending');
inviteWorks = true;
r = await call('POST', 'approve', { registration_id: id }, { nova: true });
const orgs = db.t.organizations.filter((o) => o.kind === 'client');
check('retrying finishes it with exactly one organization', r.code === 200 && orgs.length === 1 && orgs[0].name === 'Crystal Clear' && db.t.business_registrations[0].status === 'approved');
const members = db.t.organization_members.filter((m) => m.organization_id === orgs[0].id);
check('the owner is invited once and made owner of only their business', invites.length === 1 && invites[0] === 'dana@example.invalid' && members.filter((m) => m.role === 'client_owner').length === 1 && !db.t.organization_members.some((m) => m.organization_id === NOVA));
check('the approving Nova administrator can open that business', members.some((m) => m.staff_user_id === 'admin-1' && m.role === 'nova_admin'));
const svcs = db.t.business_services.filter((s) => s.organization_id === orgs[0].id);
check('the starting services have no price and nothing approved', svcs.length > 0 && svcs.every((s) => s.price_cents === null && s.price_approved === false && !s.terms_approved));
const agent = db.t.business_agents.find((a) => a.organization_id === orgs[0].id);
check('the assistant is a draft that cannot text, call or spend', agent.status === 'draft' && agent.sms_enabled === false && agent.voice_enabled === false && agent.monthly_spend_cap_cents === null && !agent.phone_number);
const before = JSON.stringify([db.t.organizations.length, db.t.organization_members.length, db.t.business_services.length, db.t.business_agents.length, invites.length]);
r = await call('POST', 'approve', { registration_id: id }, { nova: true });
check('approving again duplicates nothing', r.code === 200 && before === JSON.stringify([db.t.organizations.length, db.t.organization_members.length, db.t.business_services.length, db.t.business_agents.length, invites.length]));

await call('POST', 'request', { business_name: 'Flare', contact_name: 'Isaac', email: 'isaac@example.invalid', agree: true });
const flare = db.t.business_registrations.find((x) => x.business_name === 'Flare');
r = await call('POST', 'approve', { registration_id: flare.id }, { nova: true, id: 'user-isaac' });
check('someone who already has a login is added without a new invitation', r.code === 200 && r.body.owner_access === 'existing_login' && invites.length === 1);
const flareOrg = db.t.organizations.find((o) => o.name === 'Flare');
check('an approver who is also the owner gets one membership, as owner', db.t.organization_members.filter((m) => m.organization_id === flareOrg.id).length === 1 && db.t.organization_members.find((m) => m.organization_id === flareOrg.id).role === 'client_owner');

await call('POST', 'request', { business_name: 'Spam Co', contact_name: 'X', email: 'x@example.invalid', agree: true });
const spam = db.t.business_registrations.find((x) => x.business_name === 'Spam Co');
r = await call('POST', 'decline', { registration_id: spam.id }, { nova: true });
check('a request can be declined', r.code === 200 && spam.status === 'declined');
r = await call('POST', 'approve', { registration_id: spam.id }, { nova: true });
check('a declined request cannot be approved afterwards', r.code === 409 && !db.t.organizations.some((o) => o.name === 'Spam Co'));
r = await call('POST', 'decline', { registration_id: id }, { nova: true });
check('an approved business cannot be declined', r.code === 409);

{
  const { readFileSync } = await import('node:fs');
  const { INDUSTRY_PACKS } = await import('../api/_industryPacks.js');
  const html = readFileSync(new URL('../public/register/index.html', import.meta.url), 'utf8');
  const offered = [...html.matchAll(/<option value="([a-z_]+)">/g)].map((m) => m[1]).sort();
  check('the public page offers exactly the trades the server accepts', JSON.stringify(offered) === JSON.stringify(Object.keys(INDUSTRY_PACKS).sort()));
}
console.log(`\n${pass}/${pass + fail} registration checks passed (in-memory store — no database or email contacted)`);
process.exit(fail ? 1 : 0);
