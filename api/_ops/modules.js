// Installable module catalog (owner brief 2026-10-30 §6). Each module is a tested, reusable recipe: what it addresses,
// what it needs, what it is allowed to touch, what it may cost (provider costs named, never invented), and the real
// provisioning steps it performs. Recipes are idempotent: running again finds what already exists and does not duplicate
// workers, links, tasks or settings. External effects (sending, charging, DNS changes on someone else's domain) are never
// performed here; they appear as blocked steps with the exact owner action.
import crypto from 'node:crypto';
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso } from '../_sales/core.js';
import { capabilityByKey } from '../_workerCapabilities.js';
import { checkEmailDns } from '../_researchRun.js';

export const CATALOG_VERSION = 1;
export const CATALOG = [
  { key: 'agents_booking', name: 'Nova Agents: inquiries and booking', core: true, addresses: ['agents_booking'],
    purpose: 'Answers web-form (and, once connected, text) inquiries within your approved services and prices, offers real open times, sends your agreement and confirms the booking; anything unsupported goes to a person.',
    inputs: ['Business hours and time zone', 'At least one approved service with its price', 'An approved booking agreement', 'An escalation contact'],
    permissions: ['Publishes a private web-form link for your site', 'Optional: your Twilio number (texting)', 'Optional: your own Stripe account (deposits go to you, not Nova)'],
    dependencies: [], costs: ['Nova software: per your Nova plan (not priced here)', 'Twilio per-message and number fees, only if texting is connected', 'Stripe processing fees, only if deposits are enabled'],
    workers: ['intake_booking'] },
  { key: 'monitoring_reporting', name: 'Monitoring and weekly report', core: true, addresses: [],
    purpose: 'Checks every 5 minutes for stuck work and failed sends, alerts you, and writes the Sunday weekly scoreboard from real records.',
    inputs: ['A background worker host (locally: the laptop while it is awake)'], permissions: ['Reads this business\'s operational records'], dependencies: [], costs: ['Worker hosting when hosted (provider and price chosen by you)'],
    workers: ['monitoring', 'reporting'] },
  { key: 'followup_revive', name: 'Follow-up and Revive', addresses: [],
    purpose: 'Follows up stalled inquiries, quotes and bookings under approved rules, stopping on reply, booking, opt-out or limit.',
    inputs: ['An approved Revive campaign (rules, audience, wording)'], permissions: ['Sends through your connected channels only after approval'], dependencies: ['agents_booking'], costs: ['Channel fees (Twilio / email provider) when live'],
    workers: ['followup_revive'] },
  { key: 'website_fixes', name: 'Website and listing fixes', addresses: ['website_fixes'],
    purpose: 'Turns the audit\'s website and listing findings into tracked fix tasks, each linked to its finding, so nothing is lost between the report and the work.',
    inputs: ['An audit with website or listing findings'], permissions: ['None outside Nova (changes to your site or listings are made by you or with your login)'], dependencies: [], costs: ['None in Nova; any web developer time is yours to decide'], workers: [] },
  { key: 'email_setup', name: 'Email sending setup', addresses: ['email_setup'],
    purpose: 'Gives the exact DNS records your email needs (SPF, DMARC) and verifies them from public DNS on every run until they are published.',
    inputs: ['Your website domain', 'Access to your domain\'s DNS (you or your web host)'], permissions: ['Reads public DNS only; Nova never changes your DNS'], dependencies: [], costs: ['None in Nova'], workers: [] },
  { key: 'reviews_referrals', name: 'Reviews and referrals', addresses: ['reviews_referrals'],
    purpose: 'Asks satisfied customers for a review or a referral after completed work, with your approved wording and limits.',
    inputs: ['Approved request wording', 'A live sending channel (email or text)'], permissions: ['Messages only customers with a completed job who have not opted out'], dependencies: ['agents_booking'], costs: ['Channel fees when live'], workers: [] },
];
export const moduleByKey = (k) => CATALOG.find((m) => m.key === k) || null;

const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const TEST_NAME = /^(LOCAL TEST|TEST|DEMO)(\W|$)/;
// The audits of THE business being installed (not the prospects this workspace also audits): the owner's explicit choice
// (ops_business_settings.self_business_id), else businesses whose name contains the workspace's display name. Inside a
// test workspace every audit qualifies. Newest first.
export async function selfAudits(orgId) {
  const [org, ops] = await Promise.all([dbOne(`organizations?id=eq.${enc(orgId)}&select=name`), dbOne(`ops_business_settings?organization_id=eq.${enc(orgId)}&select=display_name,self_business_id`)]);
  const testWs = TEST_NAME.test(org?.name || '');
  const all = await dbGet(`audit_cases?organization_id=eq.${enc(orgId)}&archived_at=is.null&select=id,created_at,status,business_id,intake,businesses(name),audit_findings(count)&order=created_at.desc&limit=50`);
  const nameOf = (x) => x.intake?.name || x.businesses?.name || '';
  const want = normName(ops?.display_name || org?.name);
  const mine = all.filter((x) => (testWs ? true : ops?.self_business_id ? x.business_id === ops.self_business_id : !TEST_NAME.test(nameOf(x)) && want && normName(nameOf(x)).includes(want)));
  return { cases: mine.map((x) => ({ ...x, name: nameOf(x), findings: x.audit_findings?.[0]?.count || 0 })), basis: testWs ? 'test workspace' : ops?.self_business_id ? 'chosen by the owner' : `named like "${ops?.display_name || org?.name}"`, self_business_id: ops?.self_business_id || null,
    candidates: testWs ? [] : [...new Map(all.filter((x) => x.business_id && !TEST_NAME.test(nameOf(x))).map((x) => [x.business_id, { business_id: x.business_id, name: nameOf(x) }])).values()] };
}

// Recommend from the latest audit of this business: modules whose `addresses` match the findings' module keys, plus the core modules.
export async function recommendations(orgId) {
  const self = await selfAudits(orgId);
  let audit = null; let findings = [];
  for (const c of self.cases.filter((x) => x.findings > 0)) {
    const f = await dbGet(`audit_findings?case_id=eq.${enc(c.id)}&review_status=neq.rejected&select=id,title,module_key,review_status,priority`);
    if (f.length) { audit = { case_id: c.id, business: c.name || null, created_at: c.created_at }; findings = f; break; }
  }
  const tasks = await dbGet(`work_items?organization_id=eq.${enc(orgId)}&category=eq.install_fix&select=status`).catch(() => []);
  const state = await dbGet(`ops_installed_modules?organization_id=eq.${enc(orgId)}&select=*`);
  return {
    audit, audit_basis: self.basis, self_business_id: self.self_business_id, business_choices: self.candidates,
    fix_tasks: { total: tasks.length, open: tasks.filter((t) => !['completed', 'cancelled', 'approved'].includes(t.status)).length, completed: tasks.filter((t) => t.status === 'completed').length },
    modules: CATALOG.map((m) => {
      const why = findings.filter((f) => m.addresses.includes(f.module_key));
      const s = state.find((x) => x.module_key === m.key) || null;
      return { ...m, recommended: m.core || why.length > 0, reasons: m.core ? ['Core module for operating the business'] : why.map((f) => f.title), state: s ? { status: s.status, installed_at: s.installed_at, disabled_at: s.disabled_at, disabled_reason: s.disabled_reason, config: s.config } : null };
    }),
  };
}

export async function selectModule(orgId, key, selected, actor) {
  const m = moduleByKey(key); if (!m) throw Object.assign(new Error('Unknown module'), { status: 422 });
  const cur = await dbOne(`ops_installed_modules?organization_id=eq.${enc(orgId)}&module_key=eq.${enc(key)}&select=*`);
  if (selected) {
    if (cur) return cur;
    return (await dbInsert('ops_installed_modules', { organization_id: orgId, module_key: key, status: 'selected', catalog_version: CATALOG_VERSION, selected_by: actor?.id || null }, { onConflict: 'organization_id,module_key' })).row || dbOne(`ops_installed_modules?organization_id=eq.${enc(orgId)}&module_key=eq.${enc(key)}&select=*`);
  }
  if (!cur) return null;
  if (['installed', 'blocked', 'failed', 'disabled'].includes(cur.status)) throw Object.assign(new Error('This module has been installed. Disable it instead of removing it, so its records stay intact.'), { status: 409 });
  await fetch(`${process.env.SUPABASE_URL}/rest/v1/ops_installed_modules?id=eq.${enc(cur.id)}&status=eq.selected`, { method: 'DELETE', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
  return null;
}

// Disable keeps every record and the configuration; it stops the module acting (workers paused if no other business
// still uses them is NOT assumed: platform workers stay as they are, and the business-level gate stops this business).
export async function setModuleEnabled(orgId, key, enabled, actor, reason) {
  const cur = await dbOne(`ops_installed_modules?organization_id=eq.${enc(orgId)}&module_key=eq.${enc(key)}&select=*`);
  if (!cur) throw Object.assign(new Error('That module is not installed for this business.'), { status: 404 });
  if (!enabled && String(reason || '').trim().length < 5) throw Object.assign(new Error('Record why the module is being turned off.'), { status: 422 });
  const patch = enabled ? { status: cur.installed_at ? 'installed' : 'selected', disabled_at: null, disabled_by: null, disabled_reason: null, updated_at: nowIso() } : { status: 'disabled', disabled_at: nowIso(), disabled_by: actor?.id || null, disabled_reason: String(reason).slice(0, 300), updated_at: nowIso() };
  const [row] = await dbPatch('ops_installed_modules', `id=eq.${enc(cur.id)}`, patch);
  await dbInsert('ops_transitions', { organization_id: orgId, entity: 'settings', entity_id: cur.id, from_state: cur.status, to_state: row.status, actor_type: 'user', actor_id: actor?.id ? String(actor.id) : null, reason: enabled ? `module ${key} turned back on` : `module ${key} turned off: ${reason}`, evidence: { module: key } });
  return row;
}

async function ensureWorker(capKey, actor) {
  const cap = capabilityByKey(capKey); if (!cap) return ['failed', `Unknown capability ${capKey}`];
  const w = await dbOne(`workers?capability_key=eq.${enc(capKey)}&status=neq.inactive&select=id,status`);
  if (w) return [w.status === 'active' ? 'done' : 'blocked', w.status === 'active' ? `${cap.name} is registered and active` : `${cap.name} is registered but ${w.status}; resume it on the Workers page`, { worker_id: w.id }];
  if (!actor?.id) return ['blocked', `${cap.name} is not registered`];
  const ins = await dbInsert('workers', { worker_type: 'service_account', display_name: cap.name, status: 'active', capability_key: cap.key, mission: cap.does.slice(0, 1000), responsibilities: `Runs: ${cap.job_types.join(', ') || cap.on_demand}. Code: ${cap.code}`.slice(0, 2000), approved_tools: cap.job_types, created_by: actor.id });
  const row = ins.row || await dbOne(`workers?capability_key=eq.${enc(capKey)}&status=neq.inactive&select=id,status`);
  if (ins.row) await dbInsert('worker_status_events', { worker_id: row.id, from_status: null, to_status: 'active', changed_by: actor.id, reason: `Registered by Install Systems for capability ${cap.key}` });
  return ['done', `${cap.name} registered and active`, { worker_id: row?.id }];
}

// One module's recipe. ctx: { results (component results), actor, latestAuditCaseId }
export async function provisionModule(orgId, key, ctx) {
  const m = moduleByKey(key); const out = [];
  // `outcome` states exactly what happened: a created task is "task created", a DNS read is "checked"; nothing here
  // claims a problem is resolved unless the action and its verification both happened.
  const step = (sub, label, [status, detail, evidence = {}], owner_action = null, outcome = null) => out.push({ step_key: `module:${key}:${sub}`, label: `${m.name}: ${label}`, status, detail, evidence: { ...evidence, outcome: outcome?.[status] || outcome?.default || null }, owner_action: status === 'done' || status === 'skipped' ? null : owner_action });
  for (const d of m.dependencies) {
    const dep = await dbOne(`ops_installed_modules?organization_id=eq.${enc(orgId)}&module_key=eq.${enc(d)}&select=status`);
    if (!dep || !['installed', 'selected', 'installing'].includes(dep.status)) { step('dependency', `needs ${moduleByKey(d).name}`, ['blocked', `${moduleByKey(d).name} must be selected first`], `Select ${moduleByKey(d).name} as well.`); return out; }
  }
  for (const w of m.workers) step(`worker:${w}`, `worker ${capabilityByKey(w)?.name || w}`, await ensureWorker(w, ctx.actor), 'Register or resume it on the Workers page.', { done: 'registered, active', blocked: 'registered, not active' });
  if (key === 'agents_booking') {
    const ok = ['business_profile', 'services', 'agreement', 'escalation', 'web_form', 'calendar'].filter((k) => ctx.results[k] !== 'done');
    step('inputs', 'business inputs and web form', ok.length ? ['blocked', `Not ready: ${ok.join(', ').replace(/_/g, ' ')}`] : ['done', 'Hours, services, agreement, escalation contact, web form and calendar are ready'], 'Finish the blocked items in the installation list above.', { done: 'verified', blocked: 'waiting on inputs' });
    step('acceptance', 'acceptance test', ctx.results.test_journey === 'done' ? ['done', 'TEST inquiry was saved, qualified and quoted end to end'] : ['blocked', 'The controlled test inquiry has not passed yet'], 'Fix the blocked inputs, then run Install Systems again.', { done: 'test passed', blocked: 'not yet tested' });
  }
  if (key === 'monitoring_reporting') {
    step('heartbeat', 'background worker heartbeat', ctx.results.monitoring === 'done' ? ['done', 'Worker heartbeat is current'] : ['blocked', 'No recent worker heartbeat'], 'Run the background worker (locally: node scripts/local/staging.mjs worker).', { done: 'verified', blocked: 'not running' });
    step('weekly_report', 'weekly report', ctx.results.weekly_report === 'done' ? ['done', 'Sunday weekly report enabled'] : ['blocked', 'Weekly report not enabled'], null, { done: 'enabled', blocked: 'not enabled' });
  }
  if (key === 'followup_revive') step('campaign', 'approved campaign', ctx.results.revive === 'done' ? ['done', 'An approved Revive campaign exists'] : ['blocked', 'No approved Revive campaign; nothing is sent until you approve one'], 'Create and approve a Revive campaign in Operations → Revive campaigns.', { done: 'approved campaign found', blocked: 'awaiting your approval' });
  if (key === 'website_fixes') {
    const caseId = ctx.latestAuditCaseId;
    const fx = caseId ? await dbGet(`audit_findings?case_id=eq.${enc(caseId)}&module_key=eq.website_fixes&review_status=neq.rejected&select=id,title,recommended_action,review_status,priority`) : [];
    if (!fx.length) step('tasks', 'fix tasks', ['skipped', 'The latest audit has no website or listing findings'], null, { default: 'nothing to fix' });
    else {
      let created = 0;
      for (const f of fx) {
        const ins = await dbInsert('work_items', { title: f.title.slice(0, 300), description: `${f.recommended_action || ''}${f.review_status !== 'reviewed' ? '\n(From a proposed finding: confirm it before doing the work.)' : ''}`.trim(), category: 'install_fix', status: 'draft', created_by: ctx.actor?.id, source_ref: `finding:${f.id}`, organization_id: orgId });
        if (ins.row) created++;
      }
      const open = (await dbGet(`work_items?organization_id=eq.${enc(orgId)}&category=eq.install_fix&select=status`)).filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length;
      step('tasks', 'fix tasks', ['done', `${fx.length} fix task(s) tracked (${created} new this run, ${open} still open). Creating a task does not fix the problem; each fix is done on the website or listing and then checked again.`, { findings: fx.map((f) => f.id), open }], null, { done: `tasks created (${open} open)` });
    }
  }
  if (key === 'email_setup') {
    const c = ctx.latestAuditCaseId ? await dbOne(`audit_cases?id=eq.${enc(ctx.latestAuditCaseId)}&select=intake`) : null;
    let host = null; try { host = new URL(c?.intake?.website).hostname.replace(/^www\./, ''); } catch { /* no website */ }
    if (!host) step('dns', 'SPF and DMARC records', ['blocked', 'No website domain on the latest audit'], 'Add the website to the audit\'s business details.', { default: 'not checked' });
    else {
      const checks = await checkEmailDns(host);
      const spf = checks.find((x) => x.key === 'dns_spf'); const dmarc = checks.find((x) => x.key === 'dns_dmarc');
      if (!spf && !dmarc) step('dns', 'SPF and DMARC records', ['skipped', `${host} does not receive email at its own domain (no MX records), so these records are not needed`], null, { default: 'checked: not needed' });
      else {
        const missing = [spf?.result === 'issue' && `SPF: a TXT record on ${host} starting "v=spf1", listing each service that sends your email (for example your email host's include) and ending "~all"`, dmarc?.result === 'issue' && `DMARC: a TXT record on _dmarc.${host} with "v=DMARC1; p=none; rua=mailto:<an address you read>"`].filter(Boolean);
        step('dns', 'SPF and DMARC records', missing.length ? ['blocked', `Checked public DNS ${nowIso()}: missing ${missing.length} record(s)`, { records: missing }] : ['done', `Both records are published for ${host} (checked public DNS)`], missing.length ? `Ask whoever manages ${host}'s DNS to add: ${missing.join(' AND ')}. Nova re-checks on every run.` : null, { done: 'checked: records published', blocked: 'checked: records missing' });
      }
    }
  }
  if (key === 'reviews_referrals') step('channel', 'approved wording and live channel', ['blocked', 'Needs approved request wording and a live email or text channel'], 'Approve the review-request wording and connect a live channel; nothing is sent before both.', { default: 'awaiting approval and a live channel' });
  return out;
}

export const sha8 = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 8);
