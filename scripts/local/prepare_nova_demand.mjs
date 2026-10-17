// Prepares (does not approve, does not contact) Nova's first Demand campaign in LOCAL STAGING from the sourced prospect
// lists in prospects/ (public research 2026-10-13). Each prospect keeps its source and the observation that makes it a
// fit. Channels are phone and in person only: the lists record no email or SMS consent. Owner approval is required
// before any prospect can be approved for contact. Re-runnable: existing campaign and duplicates are reused/refused.
import fs from 'node:fs';
const rd = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = rd('.env.local-staging'); const acct = rd('.env.local-staging-accounts');
const APP = env.APP_BASE_URL;
const tok = (await (await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: acct.OWNER_EMAIL, password: acct.OWNER_PASSWORD }) })).json()).access_token;
const call = async (op, body, method = 'POST', query = {}) => { const r = await fetch(`${APP}/api/client?${new URLSearchParams({ resource: 'ops', op, ...query })}`, { method, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => null) }; };
const nova = (await call('businesses', null, 'GET')).body.businesses.find((b) => b.kind === 'nova_internal').id;

// CSV parser for the simple quoted CSVs in prospects/
const parse = (text) => { const rows = []; let row = [], cell = '', q = false; for (let i = 0; i < text.length; i++) { const ch = text[i]; if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; } else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some((c) => c !== '')) rows.push(row); row = []; cell = ''; } else cell += ch; } if (cell || row.length) { row.push(cell); rows.push(row); } const [h, ...rest] = rows; return rest.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] || '']))); };

const NAME = 'Complimentary Nova Audit — Waterbury service businesses';
let list = (await call('demand', null, 'GET', { organization_id: nova, action: 'list' })).body.campaigns || [];
let camp = list.find((c) => c.name === NAME);
if (!camp) {
  const r = await call('demand', { organization_id: nova, action: 'create', name: NAME, objective: 'Two new paying Nova clients from complimentary audits within 30 days of approval', service_key: 'audit_consultation', offer_text: 'A complimentary Nova Audit scoping call: we look at how your business handles new customers and tell you, with evidence, what is worth fixing. No obligation.', audience: 'Local service businesses in and around Waterbury, CT whose public pages show a specific gap in how customers reach them', area: 'Waterbury, CT', capacity_note: 'Nova can deliver about five audits per week (owner to confirm)', channels: ['phone', 'in_person'], volume_limit: 25 });
  if (r.status !== 200) throw new Error(`create: ${r.status} ${JSON.stringify(r.body)}`);
  camp = r.body.campaign;
}
let added = 0, dup = 0, skipped = 0;
for (const f of ['A_isaac', 'B_salesperson1', 'C_salesperson2', 'D_walkin']) {
  for (const p of parse(fs.readFileSync(`prospects/crm_import_list_${f}.csv`, 'utf8'))) {
    const obs = (/Observation:\s*([^]*)$/i.exec(p.notes || '') || [])[1]?.trim();
    if (!p.business_name || !p.website || !obs) { skipped++; continue; }
    const r = await call('demand', { organization_id: nova, action: 'add-prospect', id: camp.id, business_name: p.business_name, website: p.website, contact_name: p.contact_name || null, contact_route: p.phone ? `Published phone ${p.phone}` : null, source: `${p.website} — ${p.source || 'public research'} (list ${f.split('_')[0]})`, fit_evidence: `${obs} [${p.industry}, ${p.city}, ${p.state}]` });
    if (r.status === 200) added++; else if (r.status === 409) dup++; else skipped++;
  }
}
const d = (await call('demand', null, 'GET', { organization_id: nova, action: 'detail', id: camp.id })).body;
console.log(JSON.stringify({ campaign: camp.name, status: d.campaign.status, code: d.campaign.code, prospects: d.funnel.prospects, added, duplicates: dup, skipped_without_evidence: skipped }));
