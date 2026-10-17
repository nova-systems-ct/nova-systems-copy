// Install Systems — turn a business's audit findings and current configuration into a versioned installation manifest,
// then install it in explicit stages. Idempotent (same configuration → same manifest; re-running skips finished steps),
// resumable (blocked/failed steps run again), concurrency-safe (one run per manifest at a time, via a lease), tenant
// scoped (every query carries organization_id). It never enables outreach, live payments or paid services: those stay
// owner decisions and appear as blocked steps with the exact next action.
import crypto from 'node:crypto';
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso } from '../_sales/core.js';
import * as R from './rules.js';
import * as S from './service.js';

const sha = (v) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const ERR = (status, message) => Object.assign(new Error(message), { status, expose: true });

// What the installation consists of. `required` components must be done before activation.
function components({ prices, depositNeeded }) {
  return [
    { key: 'business_profile', stage: 2, label: 'Time zone and business hours', required: true, action: 'Verify the time zone and opening hours used for availability and quiet hours.', owner_action: 'Set the time zone and business hours in Operations → Settings.' },
    { key: 'services', stage: 2, label: 'Approved services and prices', required: true, action: `Verify approved services (${prices.length} approved).`, owner_action: 'Create and approve at least one service with its price in Operations → Settings → Prices.' },
    { key: 'agreement', stage: 2, label: 'Approved agreement', required: true, action: 'Verify an approved agreement template exists for bookings.', owner_action: 'Create and approve the booking agreement in Operations → Settings → Agreement.' },
    { key: 'escalation', stage: 2, label: 'Human escalation contact', required: true, action: 'Verify a person is named to receive escalations.', owner_action: 'Add an escalation contact (name and phone or email) in Operations → Settings.' },
    { key: 'web_form', stage: 3, label: 'Web inquiry form', required: true, action: 'Issue the web form link if missing (rotatable token).', owner_action: null },
    { key: 'calendar', stage: 3, label: 'Calendar availability', required: true, action: 'Check that the calendar returns real open times for the first approved service.', owner_action: 'Fix business hours, lead time or the calendar connection so open times exist.' },
    { key: 'email', stage: 3, label: 'Email delivery', required: false, action: 'Check the email provider is configured and live sending is approved.', owner_action: 'Approve live email (SALES_EMAIL_MODE=live) and confirm the sending domain; until then email is recorded, not sent.' },
    { key: 'phone_sms', stage: 3, label: 'Phone and text channel', required: false, action: 'Check phone provider credentials, number, public webhook address and texting registration.', owner_action: 'Provide Twilio credentials and number in the hosting environment, complete A2P 10DLC registration, and point the number’s webhooks at the deployed system.' },
    { key: 'payments', stage: 3, label: 'Deposits to the business’s own Stripe account', required: depositNeeded, action: depositNeeded ? 'Check the business’s connected Stripe account (deposits are required by an approved service).' : 'No approved service takes a deposit; payments are not required.', owner_action: 'Connect the business’s Stripe account (Settings → Payments) and add the Connect webhook secret to the hosting environment.' },
    { key: 'monitoring', stage: 4, label: 'Monitoring and background worker', required: true, action: 'Check the worker heartbeat so follow-ups, monitoring and the weekly report run.', owner_action: 'Run the background worker (locally: node scripts/local/staging.mjs worker; hosted: approve a worker host).' },
    { key: 'weekly_report', stage: 4, label: 'Sunday weekly report', required: false, action: 'Enable the Sunday 6 PM America/New_York scoreboard.', owner_action: null },
    { key: 'revive', stage: 4, label: 'Nova Revive follow-up rules', required: false, action: 'Check for an approved recovery campaign (stalled quotes, unfinished bookings).', owner_action: 'Create and approve a Revive campaign in Operations → Campaigns; nothing is sent without approval.' },
    { key: 'demand', stage: 4, label: 'Nova Demand campaign', required: false, action: 'Check for an approved acquisition campaign.', owner_action: 'Prepare a Demand campaign (offer, audience, channels, limits) for approval. No outreach runs until approved.' },
    { key: 'test_journey', stage: 6, label: 'Controlled test: inquiry to quote', required: true, action: 'Send a TEST inquiry through the real web form path and confirm it is saved and quoted from an approved price.', owner_action: 'Fix the blocked items above, then run the installation again.' },
  ];
}

async function auditLink(orgId) {
  // The latest audit of a real business: records named with the TEST / LOCAL TEST / DEMO convention are test fixtures.
  const cases = await dbGet(`audit_cases?organization_id=eq.${enc(orgId)}&select=id,created_at,businesses(name)&order=created_at.desc&limit=25`);
  const c = cases.find((x) => !/^(LOCAL TEST|TEST|DEMO)(\W|$)/.test(x.businesses?.name || '')) || null;
  if (!c) return null;
  const [findings, recs] = await Promise.all([dbGet(`audit_findings?case_id=eq.${enc(c.id)}&select=id,title&order=created_at.asc`), dbGet(`audit_recommendations?case_id=eq.${enc(c.id)}&select=id,finding_id,mechanism,priority_rank&order=priority_rank.asc.nullslast`)]);
  return { case_id: c.id, business: c.businesses?.name || null, findings: findings.map((f) => ({ id: f.id, title: f.title, fix: recs.find((r) => r.finding_id === f.id)?.mechanism || null })) };
}

export async function buildManifest(orgId) {
  const prices = await S.approvedServices(orgId);
  const depositNeeded = prices.some((p) => (p.deposit_cents || 0) > 0);
  const comps = components({ prices, depositNeeded });
  const audit = await auditLink(orgId);
  const manifest = { components: comps.map(({ key, stage, label, required, action, owner_action }) => ({ key, stage, label, required, action, owner_action })), audit };
  return { manifest, sha: sha({ c: manifest.components, a: audit?.findings?.map((f) => [f.id, f.fix]) || [] }) };
}

export async function latestManifest(orgId) {
  const m = await dbOne(`ops_install_manifests?organization_id=eq.${enc(orgId)}&status=neq.superseded&select=*&order=version.desc&limit=1`);
  if (!m) return null;
  const steps = await dbGet(`ops_install_steps?manifest_id=eq.${enc(m.id)}&organization_id=eq.${enc(orgId)}&select=*&order=stage.asc,step_key.asc`);
  return { ...m, steps };
}

// Same configuration → the same manifest (no duplicate); anything changed → a new version, the old one superseded.
export async function prepareManifest(orgId, actor) {
  const { manifest, sha: h } = await buildManifest(orgId);
  const cur = await latestManifest(orgId);
  if (cur && cur.manifest_sha256 === h) return { ...cur, unchanged: true };
  const last = await dbOne(`ops_install_manifests?organization_id=eq.${enc(orgId)}&select=version&order=version.desc&limit=1`);
  const ins = await dbInsert('ops_install_manifests', { organization_id: orgId, version: (last?.version || 0) + 1, manifest, manifest_sha256: h, source_audit_case_id: manifest.audit?.case_id || null, created_by: actor?.id || null });
  if (ins.conflict) return latestManifest(orgId); // a concurrent prepare created it
  if (cur) await dbPatch('ops_install_manifests', `id=eq.${enc(cur.id)}&organization_id=eq.${enc(orgId)}&status=in.(draft,partial,failed,installed)`, { status: 'superseded', updated_at: nowIso() });
  return latestManifest(orgId);
}

// ------------------------------------------------------------------------------------------------ checks
async function check(key, orgId, ctx) {
  const env = process.env; const r = ctx.readiness; const it = (k) => r.items.find((i) => i.key === k) || {};
  switch (key) {
    case 'business_profile': return it('timezone_hours').status === 'ready' ? ['done', it('timezone_hours').detail] : ['blocked', 'Time zone or business hours missing'];
    case 'services': return ctx.prices.length ? ['done', `${ctx.prices.length} approved: ${ctx.prices.map((p) => p.name).join(', ')}`] : ['blocked', 'No approved service'];
    case 'agreement': return it('agreement').status !== 'blocked' ? ['done', it('agreement').detail] : ['blocked', 'No approved agreement template'];
    case 'escalation': return it('escalation').status === 'ready' ? ['done', 'Escalation contact set'] : ['blocked', 'No escalation contact'];
    case 'web_form': {
      const w = await dbOne(`wave1_org_settings?organization_id=eq.${enc(orgId)}&select=organization_id,form_token`);
      if (w?.form_token) return ['done', 'Web form link exists'];
      const token = crypto.randomBytes(24).toString('base64url');
      if (w) await dbPatch('wave1_org_settings', `organization_id=eq.${enc(orgId)}&form_token=is.null`, { form_token: token, updated_at: nowIso() });
      else await dbInsert('wave1_org_settings', { organization_id: orgId, form_token: token }, { onConflict: 'organization_id' });
      return ['done', 'Web form link issued'];
    }
    case 'calendar': {
      const first = ctx.prices.find((p) => !p.quote_required);
      if (!first) return ['blocked', 'No bookable approved service'];
      const a = await S.availability(orgId, first.service_key, { limit: 3 });
      return a.ok && a.slots.length ? ['done', `Open times found for ${first.name}`, { first_slot: a.slots[0].start }] : ['blocked', `No open times (${(a.reason || 'calendar full').replace(/_/g, ' ')})`];
    }
    case 'email': return env.RESEND_API_KEY && String(env.SALES_EMAIL_MODE || '').toLowerCase() === 'live' ? ['done', 'Email provider configured; live sending approved'] : ['blocked', env.RESEND_API_KEY ? 'Email provider configured, but sending is dry-run (recorded, not sent)' : 'No email provider key in this environment'];
    case 'phone_sms': { const parts = ['twilio', 'webhooks', 'phone_number', 'sms'].map((k) => it(k)); const bad = parts.filter((p) => p.status !== 'ready'); return bad.length ? ['blocked', bad.map((p) => `${p.label}: ${p.detail}`).join('; ')] : ['done', 'Phone and texting ready']; }
    case 'payments': {
      if (!ctx.depositNeeded) return ['skipped', 'No approved service takes a deposit'];
      const acct = await dbOne(`ops_payment_accounts?organization_id=eq.${enc(orgId)}&select=mode,stripe_account_ref,live_enabled`);
      return acct?.mode === 'client_connected_account' && R.isStripeAccountId(acct.stripe_account_ref) ? ['done', 'Business’s own Stripe account connected (test mode)'] : ['blocked', acct?.mode === 'nova_test_platform' ? 'Nova TEST account only (test businesses)' : 'No connected Stripe account'];
    }
    case 'monitoring': return it('worker').status === 'ready' ? ['done', it('worker').detail] : ['blocked', `Worker ${it('worker').detail || 'not seen'}`];
    case 'weekly_report': {
      const o = await dbOne(`ops_business_settings?organization_id=eq.${enc(orgId)}&select=scoreboard_enabled`);
      if (o && o.scoreboard_enabled === false) await dbPatch('ops_business_settings', `organization_id=eq.${enc(orgId)}`, { scoreboard_enabled: true, updated_at: nowIso() });
      return o ? ['done', 'Sunday 6 PM America/New_York report enabled'] : ['blocked', 'Operations settings missing'];
    }
    case 'revive': { const c = await dbOne(`ops_campaigns?organization_id=eq.${enc(orgId)}&status=in.(approved,running)&select=id,name`); return c ? ['done', `Approved campaign: ${c.name || c.id}`] : ['blocked', 'No approved recovery campaign']; }
    case 'demand': return ['blocked', 'No approved acquisition campaign'];
    case 'test_journey': {
      const reqd = ['business_profile', 'services', 'agreement', 'web_form', 'calendar'];
      if (reqd.some((k) => ctx.results[k] !== 'done')) return ['blocked', 'Earlier required steps are not done'];
      const service = ctx.prices.find((p) => !p.quote_required);
      const contact = (await dbInsert('crm_contacts', { organization_id: orgId, name: 'TEST Installation check', email: `install-check+${Date.now()}@nova.test`, source: 'install_test', is_test: true })).row;
      const conv = (await dbInsert('wave1_conversations', { organization_id: orgId, contact_id: contact.id, channel: 'form', is_test: true, customer_initiated_at: nowIso() })).row;
      const w = await S.startWebInquiry({ orgId, contact, conversation: conv, message: `I would like to book ${service.name}.`, isTest: true });
      const ok = w.outcome === 'quoted';
      // Leave no open test request behind: cancel it, recorded with the reason.
      const j = await dbOne(`ops_jobs?id=eq.${enc(w.job.id)}&organization_id=eq.${enc(orgId)}&select=state`);
      if (j && R.canTransition('job', j.state, 'cancelled')) await S.transition({ orgId, entity: 'job', table: 'ops_jobs', id: w.job.id, field: 'state', from: j.state, to: 'cancelled', actor: { type: 'system', id: 'install-check' }, reason: 'installation test completed' });
      return ok ? ['done', `TEST inquiry saved, qualified and quoted (${service.name}); test request then cancelled`, { job_id: w.job.id }] : ['failed', `TEST inquiry outcome: ${w.outcome}`, { job_id: w.job.id }];
    }
    default: return ['failed', 'Unknown step'];
  }
}

export async function runInstall(orgId, manifestId, actor, readinessFn) {
  const m = await dbOne(`ops_install_manifests?id=eq.${enc(manifestId)}&organization_id=eq.${enc(orgId)}&select=*`);
  if (!m) throw ERR(404, 'Installation plan not found');
  if (['superseded', 'activated'].includes(m.status)) throw ERR(409, m.status === 'activated' ? 'This plan is already activated. Prepare a new plan to change it.' : 'This plan was replaced by a newer one. Open the latest plan.');
  const lock = crypto.randomBytes(8).toString('hex');
  const got = await dbPatch('ops_install_manifests', `id=eq.${enc(m.id)}&organization_id=eq.${enc(orgId)}&or=(lock_token.is.null,lock_expires_at.lt.${enc(nowIso())})`, { lock_token: lock, lock_expires_at: new Date(Date.now() + 5 * 60_000).toISOString(), status: 'installing', updated_at: nowIso() });
  if (!got.length) throw ERR(409, 'An installation run is already in progress for this plan.');
  try {
    const existing = await dbGet(`ops_install_steps?manifest_id=eq.${enc(m.id)}&select=step_key,status,attempts`);
    const prices = await S.approvedServices(orgId);
    const ctx = { prices, depositNeeded: prices.some((p) => (p.deposit_cents || 0) > 0), readiness: await readinessFn(orgId), results: {} };
    for (const comp of [...m.manifest.components].sort((a, b) => a.stage - b.stage)) {
      const prev = existing.find((e) => e.step_key === comp.key);
      if (prev && ['done', 'skipped'].includes(prev.status) && comp.key !== 'test_journey') { ctx.results[comp.key] = prev.status; continue; } // finished steps are not repeated
      const started = nowIso();
      let status, detail, evidence = {};
      try { [status, detail, evidence = {}] = await check(comp.key, orgId, ctx); } catch (e) { status = 'failed'; detail = String(e.message).slice(0, 300); }
      ctx.results[comp.key] = status;
      const row = { manifest_id: m.id, organization_id: orgId, stage: comp.stage, step_key: comp.key, label: comp.label, status, detail, evidence, owner_action: status === 'blocked' || status === 'failed' ? comp.owner_action : null, attempts: (prev?.attempts || 0) + 1, started_at: started, finished_at: nowIso() };
      if (prev) await dbPatch('ops_install_steps', `manifest_id=eq.${enc(m.id)}&step_key=eq.${enc(comp.key)}`, row);
      else { const ins = await dbInsert('ops_install_steps', row, { onConflict: 'manifest_id,step_key' }); if (ins.conflict) await dbPatch('ops_install_steps', `manifest_id=eq.${enc(m.id)}&step_key=eq.${enc(comp.key)}`, row); }
    }
    const steps = await dbGet(`ops_install_steps?manifest_id=eq.${enc(m.id)}&select=step_key,status`);
    const reqKeys = m.manifest.components.filter((c) => c.required).map((c) => c.key);
    const reqDone = reqKeys.every((k) => ['done', 'skipped'].includes(steps.find((s) => s.step_key === k)?.status));
    const anyFailed = steps.some((s) => s.status === 'failed');
    const status = anyFailed ? 'failed' : reqDone ? 'installed' : 'partial';
    await dbPatch('ops_install_manifests', `id=eq.${enc(m.id)}&lock_token=eq.${enc(lock)}`, { status, lock_token: null, lock_expires_at: null, updated_at: nowIso() });
    await dbInsert('ops_transitions', { organization_id: orgId, entity: 'settings', entity_id: m.id, from_state: m.status, to_state: status, actor_type: actor?.type || 'user', actor_id: actor?.id ? String(actor.id) : null, reason: `installation plan v${m.version} run`, evidence: { steps: steps.length } });
    return latestManifest(orgId);
  } catch (e) {
    await dbPatch('ops_install_manifests', `id=eq.${enc(m.id)}&lock_token=eq.${enc(lock)}`, { status: 'failed', lock_token: null, lock_expires_at: null, updated_at: nowIso() }).catch(() => null);
    throw e;
  }
}

// Activation is an explicit owner decision, only when every required component is done. It records go-live approval; it
// does not enable outreach, live payments or any paid service.
export async function activate(orgId, manifestId, actor) {
  const m = await dbOne(`ops_install_manifests?id=eq.${enc(manifestId)}&organization_id=eq.${enc(orgId)}&select=*`);
  if (!m) throw ERR(404, 'Installation plan not found');
  if (m.status !== 'installed') throw ERR(409, 'Activate after the installation run shows every required component done.');
  const [row] = await dbPatch('ops_install_manifests', `id=eq.${enc(m.id)}&organization_id=eq.${enc(orgId)}&status=eq.installed`, { status: 'activated', activated_by: actor.id, activated_at: nowIso(), updated_at: nowIso() });
  if (!row) throw ERR(409, 'The plan changed meanwhile; reload.');
  await dbPatch('ops_business_settings', `organization_id=eq.${enc(orgId)}`, { go_live_approved_at: nowIso(), updated_at: nowIso() });
  await dbInsert('ops_transitions', { organization_id: orgId, entity: 'settings', entity_id: m.id, from_state: 'installed', to_state: 'activated', actor_type: 'user', actor_id: String(actor.id), reason: `installation plan v${m.version} activated by owner`, evidence: {} });
  return latestManifest(orgId);
}
