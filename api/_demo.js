// Nova website demo — five minutes, two halves.
//   1. A bounded scan of the visitor's own PUBLIC website (existing SSRF-safe fetcher; at most MAX_FETCHES pages) that
//      reports one evidenced observation, or says plainly that nothing was verified.
//   2. Nova Core's real service functions running a short scripted inquiry inside the isolated DEMO workspace
//      (an is_test organization): inquiry → qualification → approved demo price → calendar availability → expiring
//      hold → agreement. Each step is a real backend action, run when the visitor's page asks for it, and recorded.
// Nothing here messages the visitor, calls their business, books a real appointment or takes money. The visitor's
// details go to Nova's own CRM (businesses / crm_contacts / crm_deals) as a website-demo lead.
import crypto from 'node:crypto';
import { requireStaff } from './_auth.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso, appBase, notify } from './_sales/core.js';
import { sanitize, sanitizeEmail } from './_sanitize.js';
import { rateLimit } from './_rateLimit.js';
import { fetchPublicPage, assertPublicHttpUrl } from './_auditResearch.js';
import * as R from './_ops/rules.js';
import * as S from './_ops/service.js';

const send = (res, code, body) => res.status(code).json(body);
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const isOwner = (caller) => (caller?.roles || []).includes('nova_super_admin');
export const DEMO_SLUG = 'nova-demo-workspace';
const MAX_FETCHES = 4;
const LIMITS = () => ({ perIpPerDay: Number(process.env.DEMO_MAX_PER_IP_PER_DAY) || 5, perDay: Number(process.env.DEMO_MAX_PER_DAY) || 300 });
export const CONSENT_TEXT = 'Nova Systems may email me about Nova products and services. I can unsubscribe at any time.';
export const DEMO_INQUIRY = 'Hi, do you have time this week for a full detail on my car?'; // sent by a made-up DEMO customer

// ------------------------------------------------------------------------------------------------ scan (pure + injectable)
const digits = (s) => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
const strip = (s, n = 120) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const CONTACT_LINK = /(contact|book|booking|schedule|appointment|quote|estimate|reserve|get-started|request)/i;
const BOOKING_HOSTS = /(calendly\.com|cal\.com|acuityscheduling\.com|squareup\.com|square\.site|booksy\.com|vagaro\.com|mindbodyonline\.com|meetings\.hubspot\.com|janeapp\.com|simplybook\.(me|it))/i;

export function normalizeWebsite(raw) {
  const t = String(raw || '').trim();
  if (!t) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  try { const u = new URL(withScheme); if (!/^https?:$/.test(u.protocol)) return { error: 'Only http(s) websites can be checked.' }; u.hash = ''; return { url: u.toString() }; } catch { return { error: 'That website address is not valid.' }; }
}

// Returns {result: 'issue_found'|'no_issue_verified'|'no_website'|'refused'|'unavailable', checks[], finding, limitation}
export async function runQuickScan(website, { fetchImpl = fetch, lookup, now = () => new Date(), timeoutMs = 6000 } = {}) {
  const started_at = now().toISOString(); const checks = []; let fetches = 0;
  const done = (result, extra = {}) => ({ result, checks, finding: null, limitation: null, started_at, finished_at: now().toISOString(), fetches, ...extra });
  if (!website) return done('no_website', { limitation: 'No website was given, so nothing public was checked. The full Nova Audit reviews your phone, text, form, booking and follow-up paths directly, with your permission.' });
  const n = normalizeWebsite(website); if (n.error) return done('refused', { limitation: n.error });
  try { await assertPublicHttpUrl(n.url, lookup); } catch (e) { return done('refused', { limitation: `This address was not checked: ${e.message}. Nova only reviews public websites.` }); }
  let home;
  try { fetches++; home = await fetchPublicPage(n.url, { fetchImpl, lookup, timeoutMs, now }); }
  catch (e) { return done('unavailable', { limitation: `The website could not be reached from Nova (${/abort/i.test(e.name || e.message) ? 'it did not answer in time' : e.message}). Nothing was assumed about it.`, checks: [{ key: 'home', label: 'Home page loads', url: n.url, checked_at: now().toISOString(), result: 'unknown', observation: 'The page could not be fetched.' }] }); }
  const at = home.retrievedAt;
  const add = (c) => checks.push({ checked_at: at, ...c });
  add({ key: 'home', label: 'Home page loads', url: home.finalUrl, result: home.status >= 400 ? 'issue' : 'ok', observation: `The page answered with HTTP ${home.status}.`, ...(home.status >= 400 ? { why: 'Visitors who reach this address see an error instead of the business.', confirm: 'Whether this is the address customers actually use.', next: 'Fix the page or redirect it to the working site.', strength: 90 } : {}) });
  const html = home.html || '';
  if (!html) return done('no_issue_verified', { limitation: home.note || 'The address did not return a web page that could be read.' });
  add({ key: 'https', label: 'Served securely (HTTPS)', url: home.finalUrl, result: /^https:/i.test(home.finalUrl) ? 'ok' : 'issue', observation: /^https:/i.test(home.finalUrl) ? 'The page was served over HTTPS.' : 'The page was served over plain HTTP.', ...(/^https:/i.test(home.finalUrl) ? {} : { why: 'Browsers label HTTP pages "Not secure", which can put people off filling in a form.', confirm: 'Whether an HTTPS version exists and is the default.', next: 'Serve the site over HTTPS and redirect HTTP to it.', strength: 40 }) });
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  add({ key: 'mobile', label: 'Set up for phones', url: home.finalUrl, result: viewport ? 'ok' : 'issue', observation: viewport ? 'A mobile viewport tag is present.' : 'No mobile viewport tag was found in the page HTML.', ...(viewport ? {} : { why: 'Without it, many phones show the desktop page zoomed out, which makes buttons and forms hard to use.', confirm: 'How the page looks on a phone.', next: 'Add a mobile viewport and check the inquiry path on a phone.', strength: 20 }) });
  // Phone consistency: click-to-call links and the number the site declares in its structured data.
  const tels = [...new Set([...html.matchAll(/href=["']tel:([^"']{7,30})["']/gi)].map((m) => digits(decodeURIComponent(m[1]))).filter((d) => d.length === 10))];
  const ldTels = [...new Set([...html.matchAll(/"telephone"\s*:\s*"([^"]{7,30})"/gi)].map((m) => digits(m[1])).filter((d) => d.length === 10))];
  const allTels = [...new Set([...tels, ...ldTels])];
  const fmt = (d) => `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (allTels.length) add({ key: 'phones', label: 'One consistent phone number', url: home.finalUrl, result: allTels.length > 1 ? 'issue' : 'ok', observation: allTels.length > 1 ? `The page lists ${allTels.length} different phone numbers: ${allTels.map(fmt).join(', ')}.` : `One phone number is used: ${fmt(allTels[0])}.`, ...(allTels.length > 1 ? { why: 'Customers may call a number nobody answers, or a listing may disagree with the site.', confirm: 'Which number is answered, and whether the others are intentional (e.g. separate locations).', next: 'Use one answered number everywhere, or label each number clearly.', strength: 60 } : {}) });
  // Inquiry paths on the home page.
  const hasForm = /<form\b/i.test(html); const hasMail = /href=["']mailto:/i.test(html); const hasBookingTool = BOOKING_HOSTS.test(html);
  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: m[1], text: strip(m[2], 60) }));
  const candidates = [];
  for (const a of anchors) {
    let u; try { u = new URL(a.href, home.finalUrl); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const same = u.hostname.replace(/^www\./, '') === new URL(home.finalUrl).hostname.replace(/^www\./, '');
    if ((same && (CONTACT_LINK.test(u.pathname) || CONTACT_LINK.test(a.text))) || BOOKING_HOSTS.test(u.hostname)) { u.hash = ''; if (!candidates.some((c) => c.url === u.toString()) && u.toString() !== home.finalUrl) candidates.push({ url: u.toString(), text: a.text || u.pathname }); }
  }
  add({ key: 'inquiry_path', label: 'A visible way to get in touch', url: home.finalUrl, result: (tels.length || hasForm || hasMail || hasBookingTool || candidates.length) ? 'ok' : 'issue', observation: (tels.length || hasForm || hasMail || hasBookingTool || candidates.length) ? `Found on the home page: ${[tels.length && 'click-to-call link', hasForm && 'a form', hasMail && 'an email link', hasBookingTool && 'an online-booking tool', candidates.length && `${candidates.length} contact/booking link(s)`].filter(Boolean).join(', ')}.` : 'No click-to-call link, form, email link, booking tool or contact link was found in the home page HTML.', ...((tels.length || hasForm || hasMail || hasBookingTool || candidates.length) ? {} : { why: 'A visitor ready to buy may not find how to reach the business.', confirm: 'The site may load its contact options with scripts this quick check does not run.', next: 'Make one clear contact or booking option visible on the home page.', strength: 50 }) });
  // Follow up to (MAX_FETCHES - 1) contact/booking links and check that they work.
  for (const c of candidates.slice(0, MAX_FETCHES - 1)) {
    let r; try { fetches++; r = await fetchPublicPage(c.url, { fetchImpl, lookup, timeoutMs, now }); } catch (e) { add({ key: 'link', label: `"${c.text}" link works`, url: c.url, checked_at: now().toISOString(), result: 'unknown', observation: `The link could not be checked (${e.message}).` }); continue; }
    const broken = r.status >= 400;
    add({ key: 'link', label: `"${c.text}" link works`, url: c.url, checked_at: r.retrievedAt, result: broken ? 'issue' : 'ok', observation: broken ? `The "${c.text}" link on the home page leads to a page that answered HTTP ${r.status}.` : `The "${c.text}" link opened a page (HTTP ${r.status}).`, ...(broken ? { why: 'People who try to contact or book through this link reach an error instead.', confirm: 'Whether the link is still used, and where it should go.', next: 'Fix or replace the link, then test the full contact path.', strength: 100 } : {}) });
  }
  const issues = checks.filter((c) => c.result === 'issue').sort((a, b) => (b.strength || 0) - (a.strength || 0));
  const { strength: _s, ...finding } = issues[0] || {};
  return done(issues.length ? 'issue_found' : 'no_issue_verified', { finding: issues.length ? finding : null, limitation: issues.length ? 'This quick scan read up to four public pages. It cannot see calls, texts, response times or results — the full Nova Audit checks those with your permission.' : 'No problem was verified on the pages checked. That does not mean there is none: this scan read up to four public pages and cannot see calls, texts, response times or results.' });
}

// ------------------------------------------------------------------------------------------------ demo workspace
export async function demoWorkspace() {
  const org = await dbOne(`organizations?slug=eq.${DEMO_SLUG}&select=id,name`);
  if (!org) return { ready: false, reason: 'not_set_up' };
  const [ops, prices, tpl] = await Promise.all([
    dbOne(`ops_business_settings?organization_id=eq.${enc(org.id)}&select=is_test`),
    S.approvedServices(org.id),
    dbOne(`ops_agreement_templates?organization_id=eq.${enc(org.id)}&status=eq.approved&select=id`),
  ]);
  if (!ops?.is_test) return { ready: false, reason: 'workspace_not_marked_test', org };
  if (!prices.length || !tpl) return { ready: false, reason: 'demo_terms_not_approved', org };
  return { ready: true, org, services: prices };
}

// Owner-only: creates the DEMO workspace with clearly labelled demo prices and a demo agreement, approved by the owner.
async function setupWorkspace(caller) {
  let org = await dbOne(`organizations?slug=eq.${DEMO_SLUG}&select=id,name`);
  if (!org) {
    org = (await dbInsert('organizations', { name: 'DEMO — Nova Demo Workspace', slug: DEMO_SLUG, kind: 'client', status: 'active' })).row;
    await dbInsert('organization_members', { organization_id: org.id, member_type: 'staff', staff_user_id: caller.id, role: 'nova_super_admin', status: 'active' });
  }
  await dbInsert('ops_business_settings', { organization_id: org.id, display_name: 'DEMO Shine Detailing (made-up business)', industry: 'Mobile auto detailing (DEMO)', is_test: true, hold_minutes: 15, lead_time_hours: 2, slot_interval_minutes: 30, booking_horizon_days: 14, scoreboard_enabled: false }, { onConflict: 'organization_id' });
  await dbPatch('ops_business_settings', `organization_id=eq.${enc(org.id)}`, { is_test: true });
  const hours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((d) => [d, [{ start: '08:00', end: '18:00' }]]));
  const wave = await dbOne(`wave1_org_settings?organization_id=eq.${enc(org.id)}&select=organization_id`);
  if (wave) await dbPatch('wave1_org_settings', `organization_id=eq.${enc(org.id)}`, { timezone: 'America/New_York', business_hours: hours, paused: true });
  else await dbInsert('wave1_org_settings', { organization_id: org.id, timezone: 'America/New_York', business_hours: hours, paused: true }); // paused: the demo never sends texts
  const at = nowIso();
  for (const p of [{ service_key: 'full_detail', name: 'Full detail (DEMO price)', duration_minutes: 60, price_cents: 18000, deposit_cents: 5000 }, { service_key: 'interior_only', name: 'Interior cleaning (DEMO price)', duration_minutes: 30, price_cents: 9000, deposit_cents: 2500 }]) {
    if (!(await dbOne(`ops_price_rules?organization_id=eq.${enc(org.id)}&service_key=eq.${p.service_key}&status=eq.approved&select=id`))) await dbInsert('ops_price_rules', { organization_id: org.id, ...p, description: 'Made-up price used only in the website demo.', status: 'approved', created_by: caller.id, approved_by: caller.id, approved_at: at });
  }
  if (!(await dbOne(`ops_agreement_templates?organization_id=eq.${enc(org.id)}&template_key=eq.service_agreement&status=eq.approved&select=id`))) await dbInsert('ops_agreement_templates', { organization_id: org.id, template_key: 'service_agreement', title: 'DEMO Service Agreement', body: 'DEMO ONLY — this is not a real agreement.\n\nService agreement between {{business_name}} and {{customer_name}}.\n\nService: {{service_name}}. Price: {{price}}. Deposit: {{deposit}}.\n\nAppointment: {{appointment}}.', status: 'approved', created_by: caller.id, approved_by: caller.id, approved_at: at });
  await dbInsert('ops_payment_accounts', { organization_id: org.id, mode: 'nova_test_platform', funds_recipient: 'Nova Systems TEST account — demo only, no real money', live_enabled: false }, { onConflict: 'organization_id' });
  return demoWorkspace();
}

// ------------------------------------------------------------------------------------------------ CRM (Nova's own org)
async function recordLead(sess) {
  const nova = await dbOne('organizations?kind=eq.nova_internal&select=id&order=created_at.asc&limit=1');
  if (!nova) return { linked: false };
  const o = `organization_id=eq.${enc(nova.id)}`;
  let contact = await dbOne(`crm_contacts?${o}&email=eq.${enc(sess.email)}&merged_into_id=is.null&select=id,business_id,email_consent`);
  let business = contact?.business_id ? await dbOne(`businesses?id=eq.${enc(contact.business_id)}&${o}&select=id`) : null;
  if (!business) business = (await dbGet(`businesses?${o}&name=ilike.${enc(sess.business_name)}&select=id&limit=1`))[0] || null;
  if (!business) business = (await dbInsert('businesses', { organization_id: nova.id, name: sess.business_name, website: sess.website, notes: 'Created from the website demo (visitor-entered; unverified).' })).row;
  if (!contact) contact = (await dbInsert('crm_contacts', { organization_id: nova.id, business_id: business.id, name: sess.name, email: sess.email, email_consent: !!sess.marketing_consent, source: 'website_demo' })).row;
  else if (sess.marketing_consent && !contact.email_consent) await dbPatch('crm_contacts', `id=eq.${enc(contact.id)}&${o}`, { email_consent: true, updated_at: nowIso() });
  let deal = await dbOne(`crm_deals?${o}&contact_id=eq.${enc(contact.id)}&source=eq.website_demo&closed_at=is.null&select=id`);
  if (!deal) deal = (await dbInsert('crm_deals', { organization_id: nova.id, business_id: business.id, contact_id: contact.id, pipeline: 'nova_sales', stage: 'prospect', source: 'website_demo', next_action: 'Follow up on the website demo and offer the full Nova Audit', next_action_at: new Date(Date.now() + 86400_000).toISOString() })).row;
  await dbInsert('crm_activities', { organization_id: nova.id, deal_id: deal.id, contact_id: contact.id, kind: 'note', body: `Website demo started. Concern: ${sess.concern}. Website: ${sess.website || 'none given'}. Marketing email permission: ${sess.marketing_consent ? 'yes' : 'no'}.` });
  return { linked: true, org: nova.id, business_id: business.id, contact_id: contact.id, deal_id: deal.id };
}

// ------------------------------------------------------------------------------------------------ worker steps
export const STEPS = [
  { key: 'inquiry', label: 'Inquiry received' },
  { key: 'qualify', label: 'Inquiry qualified' },
  { key: 'price', label: 'Approved price applied' },
  { key: 'availability', label: 'Calendar checked' },
  { key: 'hold', label: 'Appointment held (demo calendar)' },
  { key: 'agreement', label: 'Agreement prepared' },
  { key: 'monitor', label: 'Every action recorded' },
];
const actor = { type: 'system', id: 'website-demo' };

async function runStep(sess, key, ws) {
  const orgId = ws.org.id; const steps = sess.worker_steps || [];
  const job = sess.demo_job_id ? await dbOne(`ops_jobs?id=eq.${enc(sess.demo_job_id)}&organization_id=eq.${enc(orgId)}&select=*`) : null;
  if (key === 'inquiry') {
    const contact = (await dbInsert('crm_contacts', { organization_id: orgId, name: `DEMO Customer ${sess.id.slice(0, 4)}`, source: 'website_demo', is_test: true })).row;
    const conv = (await dbInsert('wave1_conversations', { organization_id: orgId, contact_id: contact.id, channel: 'form', is_test: true, customer_initiated_at: nowIso() })).row;
    const j = await S.openJobForConversation({ orgId, contact, conversation: conv, channel: 'form', isTest: true });
    await dbPatch('demo_sessions', `id=eq.${enc(sess.id)}`, { demo_job_id: j.id, demo_org_id: orgId });
    return { record_id: j.id, detail: `A web-form inquiry arrived from a made-up DEMO customer: "${DEMO_INQUIRY}"` };
  }
  if (!job) throw Object.assign(new Error('The demo inquiry was not created'), { status: 409 });
  if (key === 'qualify') {
    const m = R.matchService(DEMO_INQUIRY, ws.services);
    if (!m) return { status: 'awaiting_action', detail: 'The request did not match one approved service, so the worker would hand it to a person instead of guessing.' };
    await dbPatch('ops_jobs', `id=eq.${enc(job.id)}&organization_id=eq.${enc(orgId)}`, { qualification: { ...job.qualification, service_key: m.service_key, method: m.method, confidence: m.confidence } });
    return { record_id: job.id, detail: `Matched the request to the approved service "${ws.services.find((s) => s.service_key === m.service_key).name}" (${m.method === 'keyword' ? 'by the words in the message' : m.method}).` };
  }
  if (key === 'price') {
    const r = await S.quoteJob({ orgId, job, serviceKey: job.qualification?.service_key, actor });
    return { record_id: job.id, detail: `Quoted only from the business's approved price list: ${R.formatMoney(r.quote.total_cents, r.quote.currency)} with a ${R.formatMoney(r.quote.deposit_cents, r.quote.currency)} deposit (made-up demo prices).` };
  }
  if (key === 'availability') {
    const a = await S.availability(orgId, job.qualification?.service_key, { limit: 3 });
    if (!a.ok || !a.slots.length) return { status: 'failed', detail: `No open time could be found (${(a.reason || 'calendar full').replace(/_/g, ' ')}).` };
    return { detail: `Found open times in the demo calendar: ${a.slots.map((s) => R.formatSlot(s.start, 'America/New_York')).join('; ')}.`, slots: a.slots.map((s) => s.start) };
  }
  if (key === 'hold') {
    const prev = steps.find((s) => s.key === 'availability');
    const a = await S.availability(orgId, job.qualification?.service_key, { limit: 6 });
    const tries = [...new Set([...(prev?.slots || []), ...a.slots.map((s) => s.start)])].slice(0, 6);
    for (const start of tries) {
      if (new Date(start) < new Date()) continue;
      const r = await S.holdSlot({ orgId, job, slot: { start }, actor });
      if (r.ok) return { record_id: r.booking.id, detail: `Held ${R.formatSlot(r.booking.start_at, 'America/New_York')} in the demo calendar. The hold expires on its own after ${15} minutes; no real appointment exists.${tries.indexOf(start) > 0 ? ' (The first time was taken by another visitor a moment earlier, so the worker took the next one — double booking is blocked by the database.)' : ''}` };
    }
    return { status: 'failed', detail: 'Every offered time was taken before it could be held. Nothing was double-booked.' };
  }
  if (key === 'agreement') {
    const fresh = await dbOne(`ops_jobs?id=eq.${enc(job.id)}&organization_id=eq.${enc(orgId)}&select=*`);
    const bk = await dbOne(`ops_bookings?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=eq.held&select=*&order=created_at.desc`);
    const r = await S.sendAgreement({ orgId, job: fresh, booking: bk, actor });
    if (!r.ok) return { status: 'failed', detail: `The agreement could not be prepared (${String(r.reason).replace(/_/g, ' ')}).` };
    return { record_id: r.agreement.id, detail: 'Prepared the agreement from the business\'s approved template, with the price and time filled in. The customer would sign it on their phone and pay the deposit through Stripe in test mode.', customer_link: r.link };
  }
  if (key === 'monitor') {
    const rows = await dbGet(`ops_transitions?organization_id=eq.${enc(orgId)}&entity_id=in.(${[job.id, ...steps.map((s) => s.record_id).filter(Boolean)].map(enc).join(',')})&select=entity,from_state,to_state,at&order=at.asc&limit=50`);
    const open = await dbGet(`ops_incidents?organization_id=eq.${enc(orgId)}&status=eq.open&select=id`);
    return { detail: `${rows.length} changes were recorded with who made them and why. Nova Sentry would raise an alert if a step failed or got stuck; open alerts in this demo workspace: ${open.length}.`, timeline: rows.map((t) => `${t.entity}: ${t.from_state || '—'} → ${t.to_state}`) };
  }
  throw Object.assign(new Error('Unknown step'), { status: 400 });
}

// ------------------------------------------------------------------------------------------------ public view of a session
function view(sess, ws) {
  return {
    status: sess.status, business_name: sess.business_name, website: sess.website, concern: sess.concern, submitted_at: sess.submitted_at,
    scan: sess.scan, steps: STEPS.map((d) => ({ ...d, ...((sess.worker_steps || []).find((s) => s.key === d.key) || { status: 'pending' }) })).map(({ slots: _x, ...s }) => s),
    workspace_ready: ws ? ws.ready : undefined, summary: sess.summary, completed_at: sess.completed_at,
    timings: { scan_seconds: sess.scan_finished_at ? (new Date(sess.scan_finished_at) - new Date(sess.submitted_at)) / 1000 : null, total_seconds: sess.completed_at ? (new Date(sess.completed_at) - new Date(sess.submitted_at)) / 1000 : null },
    audit_request_url: '/request-audit', expires_at: sess.expires_at,
  };
}
async function sessionByToken(req) {
  const t = sanitize(req.query?.token || req.body?.token, 100);
  if (!t || t.length < 20) return null;
  const s = await dbOne(`demo_sessions?token_hash=eq.${enc(sha(t))}&select=*`);
  return s && new Date(s.expires_at) > new Date() ? s : null;
}

export async function handleDemo(req, res, op) {
  const b = req.body || {};
  try {
    if (op === 'setup') {
      const caller = await requireStaff(req, res); if (!caller) return;
      if (!isOwner(caller)) return send(res, 403, { error: 'Only the Nova owner can set up the demo workspace.' });
      return send(res, 200, await setupWorkspace(caller));
    }
    if (op === 'status') { if (!rateLimit(req, res, 30, 60_000)) return; const ws = await demoWorkspace(); return send(res, 200, { workers_available: ws.ready }); }

    if (op === 'start') {
      if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
      if (!rateLimit(req, res, 5, 10 * 60_000)) return;
      if (b.company_url_confirm) return send(res, 400, { error: 'Submission rejected.' }); // honeypot field, hidden from people
      const name = sanitize(b.name, 120); const business_name = sanitize(b.business_name, 160); const email = sanitizeEmail(b.email); const concern = sanitize(b.concern, 600);
      const submission_id = sanitize(b.submission_id, 64);
      const errors = {};
      if (!name || name.length < 2) errors.name = 'Please enter your name.';
      if (!business_name || business_name.length < 2) errors.business_name = 'Please enter the business name.';
      if (!email) errors.email = 'Please enter a valid email address.';
      if (!concern || concern.length < 5) errors.concern = 'Please describe the main concern in a few words.';
      if (!/^[A-Za-z0-9-]{16,64}$/.test(submission_id || '')) errors.form = 'Please reload the page and try again.';
      let website = null;
      if (b.website && String(b.website).trim()) { const n = normalizeWebsite(b.website); if (n.error) errors.website = n.error; else website = n.url; }
      if (Object.keys(errors).length) return send(res, 400, { error: 'Please check the highlighted fields.', fields: errors });
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
      const ip_hash = sha(`${ip}|${process.env.DEMO_IP_SALT || 'nova-demo'}`);
      const since = new Date(Date.now() - 86400_000).toISOString(); const L = LIMITS();
      const [mine, all] = await Promise.all([dbGet(`demo_sessions?ip_hash=eq.${ip_hash}&submitted_at=gte.${enc(since)}&select=id`), dbGet(`demo_sessions?submitted_at=gte.${enc(since)}&select=id&limit=${L.perDay + 1}`)]);
      if (mine.length >= L.perIpPerDay) return send(res, 429, { error: 'You have reached today\'s demo limit. Request the full Nova Audit instead, or try again tomorrow.' });
      if (all.length >= L.perDay) return send(res, 503, { error: 'The demo is at today\'s capacity. Please request the full Nova Audit and Nova will contact you.' });
      const token = crypto.randomBytes(24).toString('base64url');
      const ins = await dbInsert('demo_sessions', { token_hash: sha(token), submission_id, ip_hash, name, business_name, website, email, concern, marketing_consent: b.marketing_consent === true, consent_text: b.marketing_consent === true ? CONSENT_TEXT : null });
      if (ins.conflict) return send(res, 409, { error: 'This form was already submitted. Your demo is running in the first window.' });
      const sess = ins.row;
      let crm = { linked: false };
      try { crm = await recordLead(sess); if (crm.linked) await dbPatch('demo_sessions', `id=eq.${enc(sess.id)}`, { nova_business_id: crm.business_id, nova_contact_id: crm.contact_id, nova_deal_id: crm.deal_id }); }
      catch (e) { console.error('[demo] CRM record failed:', e.message); }
      return send(res, 200, { token, session: view({ ...sess }, null), crm_recorded: crm.linked });
    }

    // Everything below needs the visitor's own session token.
    const sess = await sessionByToken(req);
    if (!sess) { if (!rateLimit(req, res, 20, 60_000)) return; return send(res, 404, { error: 'This demo session was not found or has expired.' }); }
    if (!rateLimit(req, res, 60, 60_000)) return;

    if (op === 'session') return send(res, 200, view(sess, await demoWorkspace()));

    if (op === 'scan') {
      if (sess.scan) return send(res, 200, view(sess, null));
      await dbPatch('demo_sessions', `id=eq.${enc(sess.id)}&scan=is.null`, { status: 'scanning' });
      const scan = await runQuickScan(sess.website);
      const rows = await dbPatch('demo_sessions', `id=eq.${enc(sess.id)}&scan=is.null`, { scan, status: 'scanned', scan_finished_at: nowIso() });
      const fresh = rows[0] || await dbOne(`demo_sessions?id=eq.${enc(sess.id)}&select=*`);
      return send(res, 200, view(fresh, null));
    }

    if (op === 'step') {
      const key = sanitize(b.step, 30); const idx = STEPS.findIndex((s) => s.key === key);
      if (idx < 0) return send(res, 400, { error: 'Unknown step' });
      const steps = sess.worker_steps || [];
      const existing = steps.find((s) => s.key === key);
      if (existing && existing.status !== 'failed') return send(res, 200, view(sess, null)); // idempotent: never runs twice
      if (idx > 0) { const prev = steps.find((s) => s.key === STEPS[idx - 1].key); if (!prev || prev.status !== 'completed') return send(res, 409, { error: 'Run the previous step first.' }); }
      const ws = await demoWorkspace();
      if (!ws.ready) return send(res, 409, { error: 'The worker demo is not available right now.', reason: ws.reason });
      const started_at = nowIso();
      let out;
      try { out = await runStep(sess, key, ws); } catch (e) { console.error('[demo] step failed', key, e.message, e.detail ? String(e.detail).slice(0, 200) : ''); out = { status: 'failed', detail: 'This step failed. Nothing was faked: the failure is shown as it happened.' }; }
      const row = { key, label: STEPS[idx].label, status: out.status || 'completed', started_at, finished_at: nowIso(), detail: out.detail, record_id: out.record_id || null, ...(out.slots ? { slots: out.slots } : {}), ...(out.timeline ? { timeline: out.timeline } : {}), ...(out.customer_link ? { customer_link: out.customer_link } : {}) };
      const latest = (await dbOne(`demo_sessions?id=eq.${enc(sess.id)}&select=worker_steps`)).worker_steps || [];
      const nextSteps = [...latest.filter((s) => s.key !== key), row];
      const lastStep = key === STEPS.at(-1).key && row.status === 'completed';
      const patch = { worker_steps: nextSteps, status: lastStep ? 'workers_running' : 'workers_running', ...(lastStep ? { workers_finished_at: nowIso() } : {}) };
      const [upd] = await dbPatch('demo_sessions', `id=eq.${enc(sess.id)}`, patch);
      return send(res, 200, view(upd, null));
    }

    if (op === 'finish') {
      if (sess.completed_at) return send(res, 200, view(sess, null));
      const steps = sess.worker_steps || [];
      const summary = {
        business_name: sess.business_name, website: sess.website, concern: sess.concern,
        scan_result: sess.scan?.result || 'not_run', finding: sess.scan?.finding || null, limitation: sess.scan?.limitation || null,
        checks_run: (sess.scan?.checks || []).map((c) => ({ label: c.label, result: c.result, url: c.url, checked_at: c.checked_at })),
        workers: steps.map((s) => ({ label: s.label, status: s.status })), workers_completed: steps.filter((s) => s.status === 'completed').length, workers_total: STEPS.length,
        next_step: 'Request the full Nova Audit: Nova reviews your phone, text, form, booking, payment and follow-up paths with your permission and delivers a written report within 48–72 hours of confirming scope, access and inputs.',
        demo_note: 'The worker half ran in Nova\'s DEMO workspace with a made-up customer and made-up prices. Nothing was sent to anyone, no real appointment exists, and no money moved.',
      };
      let alert = 'not_configured';
      const staff = process.env.OPS_ALERT_EMAIL || process.env.ISAAC_ALERT_EMAIL;
      if (staff) {
        try { await notify({ email: staff, kind: 'demo_completed', subject: `Website demo completed: ${sess.business_name}`, body: `${sess.name} (${sess.email}) completed the website demo.\nBusiness: ${sess.business_name}\nWebsite: ${sess.website || 'none'}\nConcern: ${sess.concern}\nScan: ${summary.scan_result}${summary.finding ? ` — ${summary.finding.observation}` : ''}\nMarketing email permission: ${sess.marketing_consent ? 'yes' : 'no'}`, channels: ['email'], idempotencyKey: `demo-done:${sess.id}` });
          const n = await dbOne(`sales_notifications?idempotency_key=eq.${enc(`demo-done:${sess.id}:email`)}&select=status`); alert = n?.status || 'failed'; }
        catch (e) { alert = 'failed'; console.error('[demo] staff alert failed', e.message); }
      }
      const [upd] = await dbPatch('demo_sessions', `id=eq.${enc(sess.id)}&completed_at=is.null`, { summary, status: 'completed', completed_at: nowIso(), staff_alert_status: alert });
      const final = upd || await dbOne(`demo_sessions?id=eq.${enc(sess.id)}&select=*`);
      if (sess.nova_deal_id) {
        const nova = await dbOne('organizations?kind=eq.nova_internal&select=id&order=created_at.asc&limit=1');
        if (nova) await dbInsert('crm_activities', { organization_id: nova.id, deal_id: sess.nova_deal_id, contact_id: sess.nova_contact_id, kind: 'note', body: `Website demo completed in ${Math.round((new Date(final.completed_at) - new Date(sess.submitted_at)) / 1000)} s. Scan: ${summary.scan_result}${summary.finding ? ` — ${summary.finding.observation}` : ''}. Workers: ${summary.workers_completed}/${summary.workers_total}.` }).catch(() => null);
      }
      return send(res, 200, view(final, null));
    }
    return send(res, 400, { error: 'Unknown demo op' });
  } catch (e) {
    if (e.status && e.status < 500) return send(res, e.status, { error: e.message });
    console.error('[demo]', e.message, e.detail ? String(e.detail).slice(0, 300) : '');
    return send(res, 500, { error: 'Something went wrong. Nothing was faked; please try again.' });
  }
}
