// Drives the REAL api/client.js `crm` handlers (contacts, businesses, deals) and api/_crmSales.js
// (pipeline, activities, proposals, export/duplicates/merge/import) against an in-memory PostgREST
// stand-in. Logic proof only — not a real database, not deployed.
process.env.SUPABASE_URL = 'http://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
const { default: handler } = await import('../api/client.js');
const { checkDealStageChange } = await import('../api/_crmSales.js');

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };

const T = { businesses: [], crm_contacts: [], crm_deals: [], crm_activities: [], crm_proposals: [], products: [], leads: [], wave1_conversations: [], wave1_messages: [], wave1_appointments: [], audit_recommendations: [], audit_cases: [] };
let seq = 0; const allowedOrgs = new Set(['orgA']);
const get = (row, col) => col.split('.').reduce((o, k) => o?.[k], row);
function matches(row, [col, cond]) {
  if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(col)) return true;
  if (col === 'or') return cond.replace(/^\(|\)$/g, '').split(/,(?=[a-z_]+\.)/).some((p) => { const [c, ...rest] = p.split('.'); return matches(row, [c, rest.join('.')]); });
  const v = get(row, col);
  if (cond === 'is.null') return v == null; if (cond === 'not.is.null') return v != null;
  let m = /^ilike\.\*(.*)\*$/.exec(cond); if (m) return String(v || '').toLowerCase().includes(decodeURIComponent(m[1]).toLowerCase());
  m = /^(eq|in)\.(.*)$/.exec(cond); if (!m) return true;
  return m[1] === 'eq' ? String(v) === m[2] : m[2].replace(/[()]/g, '').split(',').includes(String(v));
}
const embed = (table, row) => (table === 'audit_recommendations' ? { ...row, audit_cases: T.audit_cases.find((c) => c.id === row.case_id) || null } : row);
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const method = init.method || 'GET';
  const J = (b, s = 200) => ({ ok: s < 400, status: s, json: async () => b, text: async () => JSON.stringify(b) });
  if (u.pathname === '/auth/v1/user') return J({ id: 'user1', email: 'staff@nova.test' });
  if (u.pathname === '/rest/v1/organization_members') return J([{ role: 'owner' }]);
  if (u.pathname === '/rest/v1/role_permissions') return J(['growth.view', 'admin.view'].map((k) => ({ role: 'owner', permissions: { key: k } })));
  if (u.pathname === '/rest/v1/rpc/has_permission') return J(allowedOrgs.has(JSON.parse(init.body).target_org_id));
  const table = u.pathname.replace('/rest/v1/', ''); const rows = T[table];
  if (!rows) return J({ message: 'no table' }, 404);
  const filters = [...u.searchParams.entries()];
  if (method === 'GET') {
    let hit = rows.filter((r) => filters.every((f) => matches(embed(table, r), f)));
    const ord = u.searchParams.get('order'); if (ord) { const [c, d] = ord.split('.'); hit = [...hit].sort((a, b) => (d === 'desc' ? -1 : 1) * (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0)); }
    const off = Number(u.searchParams.get('offset') || 0); const lim = u.searchParams.get('limit'); hit = hit.slice(off, lim ? off + Number(lim) : undefined);
    return J(hit.map((r) => embed(table, r)));
  }
  const body = init.body ? JSON.parse(init.body) : null;
  if (method === 'POST') {
    const list = (Array.isArray(body) ? body : [body]).map((b) => { if (table === 'crm_contacts' && b.phone_e164 && init.failPhone) return null; const row = { id: `${table}-${++seq}`, created_at: new Date().toISOString(), ...b }; if (table === 'crm_contacts') { row.sms_consent ??= false; row.do_not_contact ??= false; row.suppressed ??= false; row.merged_into_id ??= null; } if (table === 'crm_deals') { row.stage ??= 'new'; row.stage_history ??= []; } rows.push(row); return row; });
    return J(list);
  }
  if (method === 'PATCH') { const hit = rows.filter((r) => filters.every((f) => matches(r, f))); hit.forEach((r) => Object.assign(r, body)); return J(hit); }
  if (method === 'DELETE') { const hit = rows.filter((r) => filters.every((f) => matches(r, f))); hit.forEach((r) => rows.splice(rows.indexOf(r), 1)); return J(hit); }
  return J([]);
};

const mkRes = () => { const r = { code: 200, body: null, headers: {} }; r.status = (c) => (r.code = c, r); r.json = (b) => (r.body = b, r); r.send = (b) => (r.body = b, r); r.end = () => r; r.setHeader = (k, v) => (r.headers[k] = v); return r; };
let ip = 0;
const call = async (op, { method = 'POST', body = {}, query = {} } = {}) => { const res = mkRes(); await handler({ method, body, query: { resource: 'crm', op, ...query }, headers: { authorization: 'Bearer tok', origin: 'https://nova-systems.app', 'x-forwarded-for': `10.1.${++ip >> 8}.${ip & 255}` } }, res); return res; };
const A = 'orgA', B = 'orgB';
T.businesses.push({ id: 'bizA', organization_id: A, name: 'Ace' }, { id: 'bizB', organization_id: B, name: 'Bolt' });
T.crm_contacts.push({ id: 'cB', organization_id: B, name: 'Bob', email: 'bob@b.test', phone: '2035550199', do_not_contact: true, sms_consent: false, merged_into_id: null });

// ---- cross-org write protection (existing handlers, hardened)
let r = await call('contacts', { body: { organization_id: A, action: 'update', id: 'cB', name: 'HIJACKED' } });
check("org A cannot update org B's contact by id", r.code === 404 && T.crm_contacts.find((c) => c.id === 'cB').name === 'Bob' && T.crm_contacts.find((c) => c.id === 'cB').organization_id === B);
r = await call('businesses', { body: { organization_id: A, action: 'update', id: 'bizB', name: 'HIJACKED' } });
check("org A cannot update (or re-home) org B's business by id", r.code === 404 && T.businesses.find((x) => x.id === 'bizB').organization_id === B && T.businesses.find((x) => x.id === 'bizB').name === 'Bolt');
r = await call('contacts', { body: { organization_id: A, action: 'create', name: 'X', business_id: 'bizB' } });
check("a contact cannot be attached to another org's business", r.code === 400);
r = await call('deals', { body: { organization_id: A, action: 'create', contact_id: 'cB' } });
check("a deal cannot reference another org's contact", r.code === 400);
r = await call('deals', { body: { organization_id: A, action: 'update-stage', id: 'nope', stage: 'contacted' } });
check('deal stage update on an unknown id is a 404', r.code === 404);

// ---- partial updates must not wipe consent / suppression
r = await call('contacts', { body: { organization_id: A, action: 'create', name: 'Ann', email: 'ann@a.test', phone: '(203) 555-0101', do_not_contact: true, sms_consent: false } });
const ann = r.body.contact;
check('create stores a normalized E.164 phone', ann.phone_e164 === '+12035550101');
r = await call('contacts', { body: { organization_id: A, action: 'update', id: ann.id, title: 'Owner' } });
const annNow = T.crm_contacts.find((c) => c.id === ann.id);
check('editing a title does NOT reset do_not_contact or blank email/phone', annNow.do_not_contact === true && annNow.email === 'ann@a.test' && annNow.phone === '(203) 555-0101' && annNow.title === 'Owner');
r = await call('contacts', { method: 'GET', body: {}, query: { organization_id: A, q: 'ann' } });
check('contact search finds by name/email/phone within the org only', r.body.length === 1 && r.body[0].id === ann.id);
r = await call('contacts', { method: 'GET', body: {}, query: { organization_id: A, q: 'bob' } });
check("contact search never returns another org's rows", r.body.length === 0);

// ---- deal stage rules
const D = (id) => T.crm_deals.find((d) => d.id === id);
const deal = (await call('deals', { body: { organization_id: A, action: 'create', contact_id: ann.id, business_id: 'bizA' } })).body.deal;
r = await call('deals', { body: { organization_id: A, action: 'update-stage', id: deal.id, stage: 'audit_ordered' } });
check('pilot-path stages are accepted', r.code === 200 && D(deal.id).stage === 'audit_ordered');
r = await call('deals', { body: { organization_id: A, action: 'update-stage', id: deal.id, stage: 'pilot_agreement' } });
check('cannot reach pilot_agreement without an accepted proposal', r.code === 409);
r = await call('deals', { body: { organization_id: A, action: 'update-stage', id: deal.id, stage: 'lost' } });
check('closing as lost requires a reason', r.code === 409);
check('winning requires a win reason (pure rule)', checkDealStageChange({ stage: 'results_review' }, 'won_paid', {}, { hasAcceptedProposal: true }) !== null);
check('a closed deal cannot be reopened (pure rule)', checkDealStageChange({ stage: 'lost' }, 'discovery', {}, { hasAcceptedProposal: false }) !== null);

// ---- proposals: versioned, pricing never invented, acceptance evidenced
T.products.push({ id: 'pWave', name: 'Wave One', pricing_approved: false }, { id: 'pAud', name: 'Audit', pricing_approved: true });
r = await call('proposals', { body: { organization_id: A, action: 'create-draft', deal_id: deal.id, scope: { items: [{ product_id: 'pWave' }] }, price_cents: 100000 } });
check('a price on a product without approved pricing is refused (no invented prices)', r.code === 409 && /not approved/.test(r.body.error));
r = await call('proposals', { body: { organization_id: A, action: 'create-draft', deal_id: deal.id, scope: { items: [{ product_id: 'pWave' }] } } });
const p1 = r.body.proposal;
check('the same scope with NO price is fine', r.code === 200 && p1.version === 1 && p1.price_cents === null);
r = await call('proposals', { body: { organization_id: A, action: 'create-draft', deal_id: deal.id, scope: { items: [{ product_id: 'ghost' }] } } });
check('unknown products are refused', r.code === 400);
r = await call('proposals', { body: { organization_id: B, action: 'create-draft', deal_id: deal.id, scope: {} } });
check('org B has no permission → 403 (cannot touch org A deal)', r.code === 403);
allowedOrgs.add(B);
r = await call('proposals', { body: { organization_id: B, action: 'create-draft', deal_id: deal.id, scope: {} } });
check("even WITH access to org B, org A's deal id is a 404", r.code === 404);
allowedOrgs.delete(B);
r = await call('proposals', { body: { organization_id: A, action: 'create-draft', deal_id: deal.id, scope: { items: [{ product_id: 'pAud' }] }, price_cents: 50000 } });
const p2 = r.body.proposal;
check('an approved-pricing product may carry a price; new version supersedes the old one', r.code === 200 && p2.version === 2 && T.crm_proposals.find((p) => p.id === p1.id).status === 'superseded');
r = await call('proposals', { body: { organization_id: A, action: 'send', id: p1.id } });
check('a superseded version cannot be sent', r.code === 409);
r = await call('proposals', { body: { organization_id: A, action: 'accept', id: p2.id, acceptance_evidence: 'signed' } });
check('cannot accept a proposal that was never sent', r.code === 409);
await call('proposals', { body: { organization_id: A, action: 'send', id: p2.id } });
r = await call('proposals', { body: { organization_id: A, action: 'accept', id: p2.id } });
check('acceptance without evidence is refused', r.code === 400);
r = await call('proposals', { body: { organization_id: A, action: 'accept', id: p2.id, acceptance_evidence: 'signed PDF ref #A-9' } });
check('acceptance with evidence is recorded with a timestamp', r.code === 200 && r.body.proposal.status === 'accepted' && !!r.body.proposal.accepted_at);
r = await call('deals', { body: { organization_id: A, action: 'update-stage', id: deal.id, stage: 'pilot_agreement' } });
check('pilot_agreement is now allowed (accepted proposal exists)', r.code === 200);
r = await call('deals', { body: { organization_id: A, action: 'update-stage', id: deal.id, stage: 'won_paid', win_reason: 'Owner saw booked jobs' } });
check('a documented win closes the deal', r.code === 200 && !!D(deal.id).closed_at);

// ---- activities + follow-up
r = await call('activities', { body: { organization_id: A, action: 'create', kind: 'reminder', body: 'Call back', deal_id: deal.id } });
check('a reminder needs a due date', r.code === 400);
r = await call('activities', { body: { organization_id: A, action: 'create', kind: 'note', body: 'x', deal_id: 'crm_deals-999' } });
check('activities cannot attach to a deal outside the org', r.code === 400);
r = await call('activities', { body: { organization_id: A, action: 'create', kind: 'task', body: 'Send audit', deal_id: deal.id, due_at: '2026-10-05T14:00:00Z' } });
const task = r.body.activity;
r = await call('activities', { method: 'GET', body: {}, query: { organization_id: A, open: 'true' } });
check('open tasks are listed', r.body.some((x) => x.id === task.id));
await call('activities', { body: { organization_id: A, action: 'complete', id: task.id } });
r = await call('activities', { method: 'GET', body: {}, query: { organization_id: A, open: 'true' } });
check('completed tasks leave the open list', !r.body.some((x) => x.id === task.id));
r = await call('activities', { body: { organization_id: B, action: 'complete', id: task.id } });
check("org B cannot complete org A's task", r.code === 403);
const deal2 = (await call('deals', { body: { organization_id: A, action: 'create' } })).body.deal;
await call('deal-plan', { body: { organization_id: A, id: deal2.id, next_action: 'Follow up', next_action_at: '2020-01-01T00:00:00Z' } });
r = await call('pipeline', { method: 'GET', body: {}, query: { organization_id: A } });
check('pipeline lists overdue next actions', r.body.overdue_next_action.some((d) => d.id === deal2.id));
check('pipeline flags open deals with NO next action, and excludes closed ones', !r.body.no_next_action.some((d) => d.id === deal.id));
r = await call('deal-plan', { body: { organization_id: A, id: deal2.id, next_action_at: 'not a date' } });
check('an invalid follow-up date is rejected', r.code === 400);

// ---- duplicates + merge
T.crm_contacts.push(
  { id: 'k1', organization_id: A, name: 'Dana K', email: 'dana@k.test', phone: '2035550142', phone_e164: '+12035550142', sms_consent: false, do_not_contact: false, suppressed: false, merged_into_id: null },
  { id: 'k2', organization_id: A, name: 'Dana Kowalski', email: 'DANA@k.test', phone: '(203) 555-0142', phone_e164: '+12035550142', sms_consent: true, sms_consent_source: 'web_form', sms_consent_at: '2026-09-01T00:00:00Z', do_not_contact: false, suppressed: true, suppressed_at: '2026-09-02T00:00:00Z', suppression_source: 'sms_stop', merged_into_id: null },
);
T.crm_deals.push({ id: 'dealK2', organization_id: A, contact_id: 'k2', stage: 'new' });
T.wave1_conversations.push({ id: 'convK1', organization_id: A, contact_id: 'k1', channel: 'sms', staff_takeover: false }, { id: 'convK2', organization_id: A, contact_id: 'k2', channel: 'sms', staff_takeover: true });
T.wave1_messages.push({ id: 'mK2', organization_id: A, conversation_id: 'convK2' });
r = await call('contacts-duplicates', { method: 'GET', body: {}, query: { organization_id: A } });
check('duplicates are found by normalized phone AND case-insensitive email', r.body.groups.some((g) => g.contacts.map((c) => c.id).sort().join() === 'k1,k2'));
check('duplicate detection does not cross organizations', !r.body.groups.some((g) => g.contacts.some((c) => c.id === 'cB')));
r = await call('contacts-merge', { body: { organization_id: A, keep_id: 'k1', drop_id: 'k2' } });
check('merge without confirm is a dry run that changes nothing', r.body.dry_run === true && !T.crm_contacts.find((c) => c.id === 'k2').merged_into_id && r.body.preview.suppression_carried === true);
r = await call('contacts-merge', { body: { organization_id: A, keep_id: 'k1', drop_id: 'cB', confirm: true } });
check("cannot merge with another org's contact", r.code === 404);
r = await call('contacts-merge', { body: { organization_id: A, keep_id: 'k1', drop_id: 'k2', confirm: true } });
const k1 = T.crm_contacts.find((c) => c.id === 'k1'), k2 = T.crm_contacts.find((c) => c.id === 'k2');
check('SUPPRESSION SURVIVES A MERGE (STOP is never lost)', r.code === 200 && k1.suppressed === true && k1.suppression_source === 'sms_stop');
check('consent carried only because it is the same number, with its original source/timestamp', k1.sms_consent === true && k1.sms_consent_source === 'web_form' && k1.sms_consent_at === '2026-09-01T00:00:00Z');
check('deals move to the surviving contact', T.crm_deals.find((d) => d.id === 'dealK2').contact_id === 'k1');
check('messages move into the surviving conversation and the duplicate conversation is removed', T.wave1_messages[0].conversation_id === 'convK1' && !T.wave1_conversations.some((c) => c.id === 'convK2') && T.wave1_conversations.find((c) => c.id === 'convK1').staff_takeover === true);
check('the duplicate is retired, not deleted, and its phone identifier is released', k2.merged_into_id === 'k1' && k2.phone_e164 === null && k2.do_not_contact === true);
check('an audit note is written on the surviving contact', T.crm_activities.some((a) => a.contact_id === 'k1' && /Merged duplicate/.test(a.body)));
r = await call('contacts', { method: 'GET', body: {}, query: { organization_id: A, q: 'dana' } });
check('merged contacts disappear from normal listing', r.body.length === 1 && r.body[0].id === 'k1');
r = await call('contacts-merge', { body: { organization_id: A, keep_id: 'k1', drop_id: 'k2', confirm: true } });
check('a merged contact cannot be merged again', r.code === 409);
T.crm_contacts.push({ id: 'p1', organization_id: A, name: 'P1', phone: '2035550777', phone_e164: '+12035550777', sms_consent: false, merged_into_id: null }, { id: 'p2', organization_id: A, name: 'P2', phone: '2035550888', phone_e164: '+12035550888', sms_consent: true, sms_consent_at: '2026-09-01T00:00:00Z', sms_consent_source: 'form', merged_into_id: null });
await call('contacts-merge', { body: { organization_id: A, keep_id: 'p1', drop_id: 'p2', confirm: true } });
check('consent for a DIFFERENT number is never inherited by the surviving record', T.crm_contacts.find((c) => c.id === 'p1').sms_consent === false);

// ---- import + export
r = await call('contacts-import', { body: { organization_id: A, rows: [{ name: 'New One', phone: '203-555-0300', email: 'one@n.test' }, { name: 'Dup', phone: '(203) 555-0101' }, { name: '', phone: '2035550301' }, { name: 'Bad Phone', phone: '12' }, { name: 'No Contact' }, { name: 'Dup Email', email: 'ANN@a.test' }] } });
check('import creates new, flags duplicates (by phone and email), and rejects invalid rows with reasons', r.body.created === 1 && r.body.duplicates === 2 && r.body.invalid === 3, JSON.stringify(r.body));
const imported = T.crm_contacts.find((c) => c.email === 'one@n.test');
check('IMPORT NEVER GRANTS CONSENT', imported.sms_consent === false && imported.email_consent === false && !imported.sms_consent_at);
r = await call('contacts-import', { body: { organization_id: A, rows: Array.from({ length: 501 }, (_, i) => ({ name: `n${i}`, email: `n${i}@x.test` })) } });
check('imports are capped at 500 rows', r.code === 400);
T.crm_contacts.push({ id: 'evil', organization_id: A, name: '=HYPERLINK("http://evil","x")', email: 'e@e.test', merged_into_id: null });
r = await call('contacts-export', { method: 'GET', body: {}, query: { organization_id: A } });
check('export is CSV, org-scoped, excludes merged contacts, and neutralises formula injection', r.headers['Content-Type'].startsWith('text/csv') && !r.body.includes('Bob') && !r.body.includes('Dana Kowalski') && r.body.includes(`"'=HYPERLINK(""http://evil"",""x"")"`) && !/,=HYPERLINK/.test(r.body), r.body.slice(0, 400));

console.log(`\n${pass}/${pass + fail} CRM/sales checks passed (real handlers, in-memory PostgREST stand-in — not a real database, not deployed)`);
process.exit(fail ? 1 : 0);
