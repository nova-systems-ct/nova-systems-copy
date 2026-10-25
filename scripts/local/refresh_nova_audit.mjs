// Refreshes the Nova Audit OF NOVA (local staging) with evidence captured on 2026-10-25, through the same audit API the
// dashboard uses (signed in as the owner). It re-checks the existing findings against today's public evidence, adds
// the areas the first pass did not cover (email sending setup, inquiry forms, escalation and handoffs, hosting
// leftovers), sets an auditor's draft priority on each finding, and composes the report as a DRAFT for Isaac. It never
// approves anything, submits no public form, calls nobody, and invents no financial figure (impact stays "unknown").
// Usage: node scripts/local/refresh_nova_audit.mjs docs/evidence/nova-live-audit-2026-10-25.json
import fs from 'node:fs';
import dnsMod from 'node:dns';
const dns = dnsMod.promises; dns.setServers(['8.8.8.8', '1.1.1.1']);
const rd = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = rd('.env.local-staging'); const acct = rd('.env.local-staging-accounts');
const evFile = process.argv[2] || 'docs/evidence/nova-live-audit-2026-10-25.json';
const ev = JSON.parse(fs.readFileSync(evFile, 'utf8'));
const prev = JSON.parse(fs.readFileSync('docs/evidence/nova-live-audit-2026-10-17.json', 'utf8'));
const APP = env.APP_BASE_URL;
const tok = (await (await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: acct.OWNER_EMAIL, password: acct.OWNER_PASSWORD }) })).json()).access_token;
const call = async (resource, op, body, method = 'POST', query = {}) => { const r = await fetch(`${APP}/api/client?${new URLSearchParams({ resource, op, ...query })}`, { method, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => null) }; };
const must = (r, what) => { if (r.status !== 200) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`); return r.body; };
const nova = must(await call('ops', 'businesses', null, 'GET'), 'businesses').businesses.find((b) => b.kind === 'nova_internal').id;
const A = (op, body) => call('audit', op, { organization_id: nova, ...body });

// The audit OF NOVA: the case for the business "Nova Systems (own business)" that carries findings. Selected by business
// name, never "the newest case" — test fixtures (LOCAL TEST …) also have findings and must not be touched.
const cases = must(await call('audit', 'cases', null, 'GET', { organization_id: nova }), 'cases');
const bizList = must(await call('crm', 'businesses', null, 'GET', { organization_id: nova }), 'businesses');
const novaBiz = new Set(bizList.filter((b) => b.name === 'Nova Systems (own business)').map((b) => b.id));
const candidates = cases.filter((c) => novaBiz.has(c.business_id) && (c.audit_findings?.[0]?.count || 0) > 0);
if (candidates.length !== 1) throw new Error(`Expected exactly one Nova audit with findings, found ${candidates.length}; refusing to guess`);
const target = candidates[0];
const caseId = target.id;
const findings = must(await call('audit', 'findings', null, 'GET', { organization_id: nova, case_id: caseId }), 'findings');
const byTitle = Object.fromEntries(findings.map((f) => [f.title, f]));

// ---------------------------------------------------------------- today's evidence
const page = (p, src = ev) => src.pages.find((x) => x.path === p) || {};
const sig = (x) => JSON.stringify({ s: x.http_status, t: x.title, h: x.h1, p: x.phones, f: x.forms, n: x.notFound });
const unchanged = ev.pages.filter((p) => sig(p) === sig(page(p.path, prev))).map((p) => p.path);
const changed = ev.pages.filter((p) => sig(p) !== sig(page(p.path, prev))).map((p) => p.path);
const at = ev.collected_at.slice(0, 16).replace('T', ' ') + ' UTC';
const evidence = async (source, observation, confidence, method) => must(await A('evidence', { case_id: caseId, source, observation, confidence, method, source_quality: 'high', privacy_level: 'client_visible' }), 'evidence').evidence.id;

const eRecheck = await evidence(`Re-check of ${ev.site} in a real browser (captured ${at}; ${evFile})`,
  `Pages ${unchanged.join(', ')} are unchanged since 2026-10-17 (same title, heading, phone numbers and forms).${changed.length ? ` Changed: ${changed.join(', ')}.` : ''} /book shows "${page('/book').h1}" and /demo shows "${page('/demo').h1}". nova-systems.agency is still titled "${(ev.other_sites[0] || {}).title}".`, 'high', 'Real Chromium browser, public pages only, no forms submitted');

const q = async (n, t) => { try { return (await dns.resolve(n, t)).map((x) => (Array.isArray(x) ? x.join('') : x.exchange || JSON.stringify(x))); } catch (e) { return e.code; } };
const dkim = await q('resend._domainkey.nova-systems.app', 'TXT'); const sendMx = await q('send.nova-systems.app', 'MX'); const sendTxt = await q('send.nova-systems.app', 'TXT');
const rootTxt = await q('nova-systems.app', 'TXT'); const rootMx = await q('nova-systems.app', 'MX'); const dmarc = await q('_dmarc.nova-systems.app', 'TXT');
const hasSpf = Array.isArray(rootTxt) && rootTxt.some((x) => x.startsWith('v=spf1'));
const dnsAt = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
const eDns = await evidence(`Public DNS for nova-systems.app via 8.8.8.8 / 1.1.1.1 (queried ${dnsAt})`,
  `Resend DKIM key (resend._domainkey): ${Array.isArray(dkim) ? 'published' : `missing (${dkim})`}. send.nova-systems.app MX: ${Array.isArray(sendMx) ? sendMx.join(', ') : `none (${sendMx})`}; TXT/SPF: ${Array.isArray(sendTxt) ? 'present' : `none (${sendTxt})`}. Root domain SPF: ${hasSpf ? 'present' : 'none'}. DMARC: ${Array.isArray(dmarc) ? 'present' : `none (${dmarc})`}. Incoming mail: ${Array.isArray(rootMx) ? rootMx.join(', ') : rootMx}.`, 'high', 'DNS query (public resolvers)');

const ra = page('/request-audit'); const ct = page('/contact');
const eForms = await evidence(`Live pages ${ev.site}/request-audit, /welcome and /contact (captured ${at})`,
  `/request-audit and /welcome show "${ra.h1}" with one form of ${ra.forms?.[0]?.fields} fields (button "${ra.forms?.[0]?.submit}"). /contact shows a separate ${ct.forms?.[0]?.fields}-field form (button "${ct.forms?.[0]?.submit}"). Neither page offers a time to book.`, 'high', 'Real Chromium browser, field count from the page; no form submitted');

const home = must(await call('ops', 'home', null, 'GET', { organization_id: nova }), 'home');
const esc = home.priorities.some((p) => /escalation contact/i.test(p.title));
const eWork = await evidence(`Nova's own operating workspace (local staging), owner dashboard and Install Systems (read ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`,
  `Escalation contact: ${esc ? 'not named' : 'named'}. Workers registered in the hierarchy: ${home.roster ? home.roster.length : 'n/a'}. Background worker: ${home.integrations.find((i) => i.key === 'worker')?.state}. Email: ${home.integrations.find((i) => i.key === 'email')?.note}.`, 'high', 'System records of Nova\'s workspace');

const leftovers = ['CLIENT_SESSION_SECRET', 'CRON_SECRET', 'VITE_RESEND_TO'].filter((v) => (prev.hosting?.production_variable_names || []).includes(v));
const eHost = await evidence('Production variable names captured 2026-10-17 compared with the current code (searched 2026-10-25)',
  `${leftovers.join(', ')} are set in production but are not read anywhere in the current code. The old site and nova-systems.agency are served by two separate hosting projects.`, 'high', 'Configuration names only (values never read) + code search');

await evidence('Scope note (2026-10-25)', 'Still not tested: how fast and how well a real inquiry is answered, and the live phone line. Both write to production or place a call and need the owner\'s go-ahead with an owner-controlled contact. Hosting configuration (payments, worker, texting settings) was last read on 2026-10-17; the hosting login on this computer has expired, so those three findings rest on the 2026-10-17 capture.', 'high', 'Scope');

// ---------------------------------------------------------------- re-check existing findings, set draft priorities
const PRIORITY = {
  'A ready prospect cannot pick a time on the live site': ['high', [eRecheck, eForms]],
  'The five-minute demo and the booking page are not live': ['high', [eRecheck]],
  'Background work is not running in production': ['medium', []],
  'Automated texting is switched off in production': ['medium', []],
  'Outdated positioning is still public on two domains': ['medium', [eRecheck]],
  'The home page has no click-to-call link': ['low', [eRecheck]],
  'Online payments are not configured in production': ['low', []], // Nova's own audit call is free; payments matter for clients' deposits
};
for (const [title, [priority, add]] of Object.entries(PRIORITY)) {
  const f = byTitle[title]; if (!f) { console.log('not found:', title); continue; }
  must(await A('finding-details', { case_id: caseId, finding_id: f.id, priority, ...(add.length ? { add_evidence_ids: add } : {}) }), `details ${title}`);
  must(await A('findings', { case_id: caseId, action: 'review', id: f.id, review_status: 'reviewed' }), `review ${title}`);
}

// ---------------------------------------------------------------- new findings (areas not covered on 2026-10-17)
const NEW = [
  { title: 'Email from nova-systems.app is not fully set up for sending', priority: 'high', ev: [eDns],
    detail: `Only part of the sending setup is published: the Resend signing key is present, but the bounce (MX) and SPF records for send.nova-systems.app are missing, the root domain has no SPF record and there is no DMARC policy (DNS ${dnsAt}).`,
    impact: 'Confirmation emails, audit report links and follow-ups from Nova may be rejected or filtered as spam; until the domain verifies, Nova keeps every email as a dry run.',
    decision: 'Approve adding the DNS records at the domain registrar, then approve turning on live email.',
    fix: 'Add the two records Resend shows for send.nova-systems.app, an SPF record that includes Google Workspace and Resend, and a DMARC policy (start with p=none); confirm "Verified" in Resend.',
    verify: 'Resend shows the domain verified; a test confirmation to an owner address arrives in the inbox (not spam) with SPF and DKIM pass in its headers.' },
  { title: 'Two separate inquiry forms; the audit request asks 28 questions', priority: 'medium', ev: [eForms],
    detail: `/request-audit and /welcome use a ${ra.forms?.[0]?.fields}-field form; /contact uses a different ${ct.forms?.[0]?.fields}-field form. Neither leads to a time to book.`,
    impact: 'A prospect who is ready to talk must complete a long form and then wait; the effect on completions cannot be measured without form analytics or submission records.',
    decision: 'Approve replacing the long forms with the short booking form.',
    fix: 'Replace both with the short /book form (name, business, email) that continues straight to choosing a time; ask the remaining intake questions after the booking.',
    verify: 'Count form starts, completions and bookings for 30 days after the change against the submission records before it.' },
  { title: 'No one is named for escalations and no workers are registered for handoffs', priority: 'medium', ev: [eWork],
    detail: `In Nova's own workspace the escalation contact is ${esc ? 'not named' : 'named'} and ${home.roster ? home.roster.length : 0} workers are registered in the hierarchy, so an unsupported request or an overdue task has no named person to go to.`,
    impact: 'Requests the workers cannot handle wait without an owner; overdue internal tasks escalate only to the owner account.',
    decision: 'Name the escalation contact and decide which people and agents to register, with their managers.',
    fix: 'Name the escalation contact (Operations → Settings) and register the people and agents who handle work (Workers → Workforce) with their managers.',
    verify: 'A TEST request the workers cannot handle reaches the named person; an unacknowledged TEST task escalates to the right manager.' },
  { title: 'Hosting carries settings and a second project left from the previous build', priority: 'low', ev: [eHost],
    detail: `${leftovers.join(', ')} are set in production but no current code reads them; the old Wave One site still runs as a separate hosting project for nova-systems.agency.`,
    impact: 'Unused secrets widen what could leak without adding any function; a second live project keeps outdated positioning public and adds maintenance.',
    decision: 'Approve removing the unused settings and redirecting or retiring nova-systems.agency.',
    fix: 'After the new build is live: remove the unused variables and redirect nova-systems.agency to nova-systems.app (or retire that project).',
    verify: 'The production variable list matches what the code reads; nova-systems.agency returns a redirect to nova-systems.app.' },
];
const created = [];
for (const n of NEW) {
  if (byTitle[n.title]) { console.log('exists:', n.title); continue; }
  const f = must(await A('findings', { case_id: caseId, title: n.title, detail: n.detail, statement_type: 'observed_fact', confidence: 'high', priority: n.priority, recommended_action: n.fix, evidence_ids: n.ev }), `create ${n.title}`).finding;
  must(await A('finding-details', { case_id: caseId, finding_id: f.id, period_start: '2026-10-25', period_end: '2026-10-25', customer_impact: n.impact, financial_impact_status: 'unknown', limitations: 'Public evidence, DNS and Nova\'s own system records only; no inquiry outcomes or delivery logs were reviewed.', nova_can_implement: 'yes', owner_decision: n.decision, priority: n.priority }), `details ${n.title}`);
  must(await A('recommendations', { case_id: caseId, finding_id: f.id, mechanism: n.fix, effort_range: 'per approved scope', cost_range: 'per approved scope', dependencies: 'Owner approval', uncertainty: 'Financial impact unknown without records', verification_plan: n.verify, priority_rank: 7 + created.length + 1 }), `rec ${n.title}`);
  must(await A('findings', { case_id: caseId, action: 'review', id: f.id, review_status: 'reviewed' }), `review ${n.title}`);
  created.push(n.title);
}

// ---------------------------------------------------------------- compose draft v-next (never approved here)
const all = must(await call('audit', 'findings', null, 'GET', { organization_id: nova, case_id: caseId }), 'findings');
const count = (p) => all.filter((f) => f.priority === p && f.review_status === 'reviewed').length;
const comp = must(await A('compose', { case_id: caseId,
  executive_summary: `Re-checked ${at}: Nova's live site still explains Nova but does not let a prospect act. There is no way to pick a time, the demo and booking pages are not deployed, and the audit request is a ${ra.forms?.[0]?.fields}-question form. Email from nova-systems.app is not fully set up for sending, so confirmations and report links cannot yet be delivered reliably. Production also has no payment configuration, no background worker and texting switched off (last read 2026-10-17). ${all.length} findings: ${count('high')} high, ${count('medium')} medium and ${count('low')} low priority. None carries a financial figure: public evidence cannot establish lost revenue, and no inquiry or sales records were reviewed.`,
  limitations: 'Public pages, public DNS and Nova\'s own system records only. Not tested: the reply to a real inquiry and the live phone line (need the owner\'s go-ahead). Hosting configuration last read 2026-10-17. Priorities are the auditor\'s draft for the owner to confirm.',
  next_steps: 'Decide the delivery-clock policy; confirm or change the draft priorities; approve this version; then: email DNS records, deploy the verified /book path, name the escalation contact.' }), 'compose');
console.log(JSON.stringify({ case_id: caseId, unchanged_pages: unchanged.length, changed_pages: changed, new_findings: created, total_findings: all.length, priorities: { high: count('high'), medium: count('medium'), low: count('low') }, report: `draft v${comp.report.version}` }));
