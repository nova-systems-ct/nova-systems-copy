// `ops` resource for api/client.js — Nova Operations HTTP surface.
// PUBLIC (no session): voice-inbound / voice-turn / voice-status (Twilio-signed), customer-* (scoped by a random
//   customer token; only its hash is stored; it expires).
// SIGNED-IN: every operation names an organization_id and is checked with has_permission(org, ops.view|manage|configure)
//   using the caller's own token — the same rule RLS uses. Objects are always re-read with that organization.
import { requireStaff } from '../_auth.js';
import { hasOrgPermission } from '../_orgAccess.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso, authCreateUser, authUserByEmail, appBase } from '../_sales/core.js';
import { sanitize, sanitizeEmail } from '../_sanitize.js';
import { rateLimit } from '../_rateLimit.js';
import { normalizePhone } from '../_wave1.js';
import { createPostgresJobStore } from '../../worker/postgresJobStore.mjs';
import * as R from './rules.js';
import * as S from './service.js';
import * as H from './harvest.js';
import * as M from './sentry.js';
import * as P from './reports.js';
import * as V from './voice.js';
import { sendSms, sendMode, allowlistFrom } from './messaging.js';
import { modelConfigured } from './model.js';

const enqueue = (job) => createPostgresJobStore({ url: process.env.SUPABASE_URL, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY }).enqueue(job);
const send = (res, code, body) => res.status(code).json(body);
const fail = (res, e) => {
  if (e?.expose || (e?.status && e.status < 500)) return send(res, e.status || 400, { error: e.message });
  console.error('[ops:error]', e?.message, e?.detail ? String(e.detail).slice(0, 300) : '');
  return send(res, 500, { error: 'Something went wrong. Nothing was changed unless the screen shows it.' });
};
const fullUrl = (req) => `${(process.env.WAVE1_PUBLIC_BASE || '').replace(/\/$/, '')}/api/client?${new URLSearchParams(req.query).toString()}`;
const xmlOut = (res, out) => { if (out.type === 'text/xml') { res.setHeader('Content-Type', 'text/xml'); return res.status(out.status).send(out.body); } return res.status(out.status).json(out.body); };
const isNovaOwner = (caller) => (caller?.roles || []).includes('nova_super_admin');

async function inOrg(req, res, orgId, perm) {
  const caller = await requireStaff(req, res); if (!caller) return null;
  const id = sanitize(orgId, 60);
  if (!id) { send(res, 400, { error: 'organization_id is required' }); return null; }
  if (!(await hasOrgPermission(req, id, perm))) { send(res, 403, { error: 'You do not have access to this business.' }); return null; }
  return { caller, orgId: id, actor: { type: 'user', id: caller.id } };
}

export async function handleOps(req, res, op) {
  const b = req.body || {}; const q = req.query || {};
  try {
    // ------------------------------------------------------------------ public: Twilio voice (signed)
    if (op === 'voice-inbound' || op === 'voice-turn' || op === 'voice-status') {
      const args = { url: fullUrl(req), params: req.body || {}, signature: req.headers['x-twilio-signature'] };
      if (op === 'voice-inbound') {
        const { handleVoiceInbound } = await import('../_wave1Handlers.js');
        const { createPostgrestRepo } = await import('../_wave1Repo.js');
        const fallback = async () => handleVoiceInbound(args, createPostgrestRepo({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY }), process.env);
        return xmlOut(res, await V.handleVoiceAiInbound(args, process.env, fallback));
      }
      return xmlOut(res, op === 'voice-turn' ? await V.handleVoiceAiTurn(args, process.env) : await V.handleVoiceAiStatus(args, process.env));
    }
    // ------------------------------------------------------------------ public: customer link (token-scoped)
    if (op.startsWith('customer-')) {
      if (!rateLimit(req, res, 30, 60_000)) return;
      const token = sanitize(q.token || b.token, 80);
      if (op === 'customer-view' && req.method === 'GET') return send(res, 200, await S.customerView(token));
      if (op === 'customer-sign' && req.method === 'POST') return send(res, 200, await S.customerSign({ token, signerName: b.signer_name, consent: b.consent === true, contentSha256: sanitize(b.content_sha256, 80), ip: String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress, userAgent: req.headers['user-agent'] }));
      if (op === 'customer-deposit' && req.method === 'POST') return send(res, 200, await S.customerDepositCheckout(token));
      if (op === 'customer-agreement-pdf' && req.method === 'GET') return send(res, 200, await S.customerAgreementPdf(token));
      return send(res, 400, { error: 'Unknown customer action' });
    }

    // ------------------------------------------------------------------ signed-in
    if (op === 'businesses') {
      const caller = await requireStaff(req, res); if (!caller) return;
      if (req.method === 'GET') {
        const mem = await dbGet(`organization_members?staff_user_id=eq.${enc(caller.id)}&status=eq.active&select=organization_id,role,organizations(id,name,kind)`);
        const out = [];
        for (const m of mem) if (m.organizations && (await hasOrgPermission(req, m.organization_id, 'ops.view'))) out.push({ id: m.organization_id, name: m.organizations.name, kind: m.organizations.kind, role: m.role, can_manage: await hasOrgPermission(req, m.organization_id, 'ops.manage'), can_configure: await hasOrgPermission(req, m.organization_id, 'ops.configure') });
        const settings = out.length ? await dbGet(`ops_business_settings?organization_id=in.(${out.map((o) => enc(o.id)).join(',')})&select=organization_id,display_name,industry,is_test,go_live_approved_at`) : [];
        return send(res, 200, { businesses: out.map((o) => ({ ...o, settings: settings.find((s) => s.organization_id === o.id) || null })), nova_owner: isNovaOwner(caller) });
      }
      // create a client business: Nova owner only; the creator becomes an explicit member so access is auditable
      if (!isNovaOwner(caller)) return send(res, 403, { error: 'Only the Nova owner can add a client business.' });
      const name = sanitize(b.name, 120); if (!name || name.length < 2) return send(res, 400, { error: 'Business name is required' });
      const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`;
      const org = (await dbInsert('organizations', { name, slug, kind: 'client', status: 'active' })).row;
      await dbInsert('organization_members', { organization_id: org.id, member_type: 'staff', staff_user_id: caller.id, role: 'nova_super_admin', status: 'active' });
      await dbInsert('ops_business_settings', { organization_id: org.id, display_name: name, industry: sanitize(b.industry, 80) || null, is_test: b.is_test === true });
      await dbInsert('wave1_org_settings', { organization_id: org.id, timezone: null }, { onConflict: 'organization_id' });
      await dbInsert('ops_transitions', { organization_id: org.id, entity: 'settings', entity_id: org.id, to_state: 'created', actor_type: 'user', actor_id: caller.id, reason: b.is_test === true ? 'test business created' : 'business created' });
      return send(res, 200, { business: { id: org.id, name } });
    }
    const orgParam = req.method === 'GET' ? q.organization_id : b.organization_id;

    if (op === 'invite-owner') {
      const s = await inOrg(req, res, orgParam, 'ops.configure'); if (!s) return;
      const email = sanitizeEmail(b.email); if (!email) return send(res, 400, { error: 'A valid email is required' });
      const role = ['client_owner', 'client_employee'].includes(b.role) ? b.role : 'client_owner';
      if (role === 'client_owner' && !isNovaOwner(s.caller)) return send(res, 403, { error: 'Only the Nova owner can add a business owner.' });
      let user = await authUserByEmail(email);
      if (!user) { const r = await authCreateUser(email, { name: sanitize(b.name, 120) || null, confirm: false }); user = r?.json || r; }
      if (!user?.id) return send(res, 502, { error: 'Could not create the account' });
      const existing = await dbOne(`organization_members?organization_id=eq.${enc(s.orgId)}&staff_user_id=eq.${enc(user.id)}&select=id,role`);
      if (!existing) await dbInsert('organization_members', { organization_id: s.orgId, member_type: 'staff', staff_user_id: user.id, role, status: 'active' });
      await dbInsert('ops_transitions', { organization_id: s.orgId, entity: 'settings', entity_id: s.orgId, to_state: 'member_added', actor_type: 'user', actor_id: s.caller.id, reason: `${role} ${email}` });
      // The account sets its password through the normal recovery flow (/reset-password). No email is sent from here.
      return send(res, 200, { ok: true, user_id: user.id, role, next_step: `Ask ${email} to open ${appBase()}/login and choose "Forgot password" to set a password. Nothing was emailed.` });
    }

    if (op === 'overview' || op === 'readiness') {
      const s = await inOrg(req, res, orgParam, 'ops.view'); if (!s) return;
      return send(res, 200, await readiness(s.orgId));
    }

    if (op === 'settings') {
      const s = await inOrg(req, res, orgParam, req.method === 'GET' ? 'ops.view' : 'ops.configure'); if (!s) return;
      if (req.method === 'GET') {
        const [ops, wave, voice] = await Promise.all([dbOne(`ops_business_settings?organization_id=eq.${enc(s.orgId)}&select=*`), dbOne(`wave1_org_settings?organization_id=eq.${enc(s.orgId)}&select=timezone,quiet_hours,business_hours,escalation_contacts,paused,channels_paused,provider_registration,sms_number_ref,max_automated_per_day,min_gap_minutes`), dbOne(`voice_configurations?organization_id=eq.${enc(s.orgId)}&select=status,disclosure_script,transcript_retention_days,recording_enabled`)]);
        return send(res, 200, { ops, wave, voice });
      }
      const opsPatch = {}; const wavePatch = {};
      for (const k of ['display_name', 'industry', 'service_area', 'review_url', 'attribution_method']) if (k in b) opsPatch[k] = sanitize(b[k], 400) || null;
      if ('review_url' in b && opsPatch.review_url && !/^https:\/\/[^\s]+$/.test(opsPatch.review_url)) return send(res, 400, { error: 'Review link must be an https:// URL' });
      for (const k of ['slot_interval_minutes', 'hold_minutes', 'lead_time_hours', 'booking_horizon_days', 'nova_fee_cents_monthly', 'labor_minutes_per_inquiry']) if (k in b) opsPatch[k] = b[k] === null || b[k] === '' ? null : Math.round(Number(b[k]));
      for (const k of ['scoreboard_enabled', 'labor_baseline_approved', 'ai_extraction_enabled']) if (k in b) opsPatch[k] = b[k] === true;
      if ('referral_terms' in b) { opsPatch.referral_terms = sanitize(b.referral_terms, 600) || null; opsPatch.referral_terms_status = opsPatch.referral_terms ? 'draft' : 'none'; }
      if (b.approve_referral_terms === true) opsPatch.referral_terms_status = 'approved';
      if ('timezone' in b) { try { new Intl.DateTimeFormat('en-US', { timeZone: b.timezone }); wavePatch.timezone = b.timezone; } catch { return send(res, 400, { error: 'Unknown time zone' }); } }
      if ('business_hours' in b) {
        const ok = b.business_hours && typeof b.business_hours === 'object' && Object.entries(b.business_hours).every(([d, w]) => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(d) && Array.isArray(w) && w.every((x) => /^\d{2}:\d{2}$/.test(x.start) && /^\d{2}:\d{2}$/.test(x.end) && x.start < x.end));
        if (!ok) return send(res, 400, { error: 'Business hours must be {mon:[{start:"08:00",end:"17:00"}],...}' });
        wavePatch.business_hours = b.business_hours;
      }
      if ('escalation_phone' in b) { const p = normalizePhone(b.escalation_phone); if (b.escalation_phone && !p) return send(res, 400, { error: 'Invalid escalation phone' }); wavePatch.escalation_contacts = p ? [{ label: 'Owner', phone: p }] : []; }
      if ('paused' in b) wavePatch.paused = b.paused === true;
      if ('scoreboard_phone' in b) {
        const p = normalizePhone(b.scoreboard_phone);
        if (b.scoreboard_phone && (!p || b.scoreboard_sms_consent !== true)) return send(res, 400, { error: 'Enter a valid number and confirm the owner agreed to receive the weekly report by text' });
        opsPatch.scoreboard_recipient_phone = p || null;
        if (p) {
          // one contact per number per business: reuse it if the owner already exists as a contact (e.g. they called in)
          let c = await dbOne(`crm_contacts?organization_id=eq.${enc(s.orgId)}&phone_e164=eq.${enc(p)}&merged_into_id=is.null&select=id`);
          if (!c) { const ins = await dbInsert('crm_contacts', { organization_id: s.orgId, name: 'Owner (weekly report)', phone: p, phone_e164: p, source: 'owner_settings' }); c = ins.row || await dbOne(`crm_contacts?organization_id=eq.${enc(s.orgId)}&phone_e164=eq.${enc(p)}&select=id`); }
          await dbPatch('crm_contacts', `id=eq.${enc(c.id)}&organization_id=eq.${enc(s.orgId)}`, { sms_consent: true, sms_consent_source: 'owner_settings_opt_in', sms_consent_at: nowIso(), marketing_consent_scope: 'weekly operations report only' });
        }
      }
      if (b.missed_call_policy === 'owner_attested_single_reply') {
        if (!isNovaOwner(s.caller) && !(await hasOrgPermission(req, s.orgId, 'ops.configure'))) return send(res, 403, { error: 'Not allowed' });
        if (!b.attestation || String(b.attestation).length < 30) return send(res, 400, { error: 'Record the owner attestation for this policy (30+ characters). It is flagged for legal review.' });
        opsPatch.missed_call_policy = 'owner_attested_single_reply'; opsPatch.missed_call_policy_attestation = { by: s.caller.id, at: nowIso(), text: String(b.attestation).slice(0, 600), legal_review: 'required' };
      } else if (b.missed_call_policy === 'recorded_consent_only') { opsPatch.missed_call_policy = 'recorded_consent_only'; opsPatch.missed_call_policy_attestation = null; }
      if (Object.keys(opsPatch).length) { await dbInsert('ops_business_settings', { organization_id: s.orgId }, { onConflict: 'organization_id' }); await dbPatch('ops_business_settings', `organization_id=eq.${enc(s.orgId)}`, { ...opsPatch, updated_at: nowIso() }); }
      if (Object.keys(wavePatch).length) { await dbInsert('wave1_org_settings', { organization_id: s.orgId }, { onConflict: 'organization_id' }); await dbPatch('wave1_org_settings', `organization_id=eq.${enc(s.orgId)}`, { ...wavePatch, updated_at: nowIso() }); }
      await dbInsert('ops_transitions', { organization_id: s.orgId, entity: 'settings', entity_id: s.orgId, to_state: 'updated', actor_type: 'user', actor_id: s.caller.id, reason: `changed: ${[...Object.keys(opsPatch), ...Object.keys(wavePatch)].join(', ')}` });
      return send(res, 200, { ok: true });
    }

    if (op === 'prices' || op === 'templates') {
      const table = op === 'prices' ? 'ops_price_rules' : 'ops_agreement_templates';
      const keyCol = op === 'prices' ? 'service_key' : 'template_key';
      const entity = op === 'prices' ? 'price_rule' : 'template';
      if (req.method === 'GET') { const s = await inOrg(req, res, orgParam, 'ops.view'); if (!s) return; return send(res, 200, await dbGet(`${table}?organization_id=eq.${enc(s.orgId)}&select=*&order=${keyCol}.asc,version.desc`)); }
      const s = await inOrg(req, res, orgParam, 'ops.configure'); if (!s) return;
      const action = sanitize(b.action, 20);
      if (action === 'create') {
        const key = sanitize(b[keyCol], 40).toLowerCase();
        const last = await dbOne(`${table}?organization_id=eq.${enc(s.orgId)}&${keyCol}=eq.${enc(key)}&select=version&order=version.desc`);
        const row = op === 'prices'
          ? { service_key: key, name: sanitize(b.name, 120), description: sanitize(b.description, 600) || null, duration_minutes: Math.round(Number(b.duration_minutes)), buffer_minutes: Math.round(Number(b.buffer_minutes || 0)), price_cents: b.quote_required === true ? null : Math.round(Number(b.price_cents)), deposit_cents: Math.round(Number(b.deposit_cents || 0)), tax_bps: Math.round(Number(b.tax_bps || 0)), currency: 'usd', options: Array.isArray(b.options) ? b.options.slice(0, 10).map((o) => ({ key: sanitize(o.key, 40), name: sanitize(o.name, 80), price_cents: Math.round(Number(o.price_cents)) })) : [], quote_required: b.quote_required === true }
          : { template_key: key, title: sanitize(b.title, 160), body: String(b.body || '').slice(0, 20000) };
        if (op === 'templates') { const chk = R.renderAgreement(row.body, Object.fromEntries(R.AGREEMENT_FIELDS.map((f) => [f, 'x']))); if (!chk.ok) return send(res, 400, { error: `Template problem: ${chk.reason} ${chk.fields?.join(', ') || ''}` }); }
        const ins = await dbInsert(table, { organization_id: s.orgId, ...row, version: (last?.version || 0) + 1, status: 'draft', created_by: s.caller.id });
        if (ins.conflict) return send(res, 409, { error: 'That version already exists' });
        await dbInsert('ops_transitions', { organization_id: s.orgId, entity, entity_id: ins.row.id, to_state: 'draft', actor_type: 'user', actor_id: s.caller.id, reason: 'draft created', version: String(ins.row.version) });
        return send(res, 200, { ok: true, row: ins.row });
      }
      const id = sanitize(b.id, 60);
      const row = await dbOne(`${table}?id=eq.${enc(id)}&organization_id=eq.${enc(s.orgId)}&select=*`);
      if (!row) return send(res, 404, { error: 'Not found' });
      if (action === 'approve') {
        if (row.status !== 'draft') return send(res, 409, { error: `It is ${row.status}` });
        if (op === 'templates' && b.acknowledge_not_legal_advice !== true) return send(res, 400, { error: 'Confirm you understand this approval is a business approval, not a legal review.' });
        const cur = await dbOne(`${table}?organization_id=eq.${enc(s.orgId)}&${keyCol}=eq.${enc(row[keyCol])}&status=eq.approved&select=id`);
        if (cur) await S.transition({ orgId: s.orgId, entity, table, id: cur.id, from: 'approved', to: 'retired', actor: s.actor, reason: `replaced by v${row.version}` }).catch(() => null);
        const out = await dbPatch(table, `id=eq.${enc(row.id)}&organization_id=eq.${enc(s.orgId)}&status=eq.draft`, { status: 'approved', approved_by: s.caller.id, approved_at: nowIso() });
        await dbInsert('ops_transitions', { organization_id: s.orgId, entity, entity_id: row.id, from_state: 'draft', to_state: 'approved', actor_type: 'user', actor_id: s.caller.id, reason: op === 'templates' ? 'business approval (not a legal review)' : 'price approved', version: String(row.version) });
        return send(res, 200, { ok: true, row: out[0] });
      }
      if (action === 'retire') {
        const out = await dbPatch(table, `id=eq.${enc(row.id)}&organization_id=eq.${enc(s.orgId)}&status=neq.retired`, { status: 'retired' });
        await dbInsert('ops_transitions', { organization_id: s.orgId, entity, entity_id: row.id, from_state: row.status, to_state: 'retired', actor_type: 'user', actor_id: s.caller.id, reason: 'retired' });
        return send(res, 200, { ok: true, row: out[0] });
      }
      return send(res, 400, { error: 'Unknown action' });
    }

    if (op === 'payment-account') {
      const s = await inOrg(req, res, orgParam, req.method === 'GET' ? 'ops.view' : 'ops.configure'); if (!s) return;
      if (req.method === 'GET') return send(res, 200, (await dbOne(`ops_payment_accounts?organization_id=eq.${enc(s.orgId)}&select=*`)) || { mode: 'not_configured' });
      const mode = ['not_configured', 'nova_test_platform', 'client_connected_account'].includes(b.mode) ? b.mode : null;
      if (!mode) return send(res, 400, { error: 'Unknown mode' });
      if (mode === 'nova_test_platform' && !isNovaOwner(s.caller)) return send(res, 403, { error: 'Only the Nova owner can enable test-mode deposits on Nova\'s own Stripe test account.' });
      if (mode === 'nova_test_platform' && !(await dbOne(`ops_business_settings?organization_id=eq.${enc(s.orgId)}&is_test=eq.true&select=organization_id`))) return send(res, 409, { error: 'Test-mode deposits on Nova\'s account are only for Nova-owned TEST businesses. A real business needs its own payment account arrangement.' });
      const row = { organization_id: s.orgId, mode, stripe_account_ref: mode === 'client_connected_account' ? sanitize(b.stripe_account_ref, 60) || null : null, funds_recipient: mode === 'nova_test_platform' ? 'Nova Systems Stripe TEST mode — no real money moves' : mode === 'client_connected_account' ? 'The business\'s own Stripe account (connection not yet built)' : null, live_enabled: false, approved_by: s.caller.id, approved_at: nowIso(), updated_at: nowIso() };
      await dbInsert('ops_payment_accounts', row, { onConflict: 'organization_id' }); await dbPatch('ops_payment_accounts', `organization_id=eq.${enc(s.orgId)}`, row);
      await dbInsert('ops_transitions', { organization_id: s.orgId, entity: 'payment_account', entity_id: s.orgId, to_state: mode, actor_type: 'user', actor_id: s.caller.id, reason: row.funds_recipient || 'deposits disabled' });
      return send(res, 200, { ok: true, account: row });
    }

    if (op === 'voice-settings') {
      const s = await inOrg(req, res, orgParam, 'ops.configure'); if (!s) return;
      const status = ['not_configured', 'configured', 'active', 'paused'].includes(b.status) ? b.status : 'configured';
      const disclosure = sanitize(b.disclosure_script, 400);
      if (status === 'active' && (!disclosure || !/automated|virtual|AI/i.test(disclosure))) return send(res, 400, { error: 'An active voice assistant must open with a disclosure that the caller is speaking with an automated assistant.' });
      if (b.recording_enabled === true) return send(res, 400, { error: 'Call recording is not enabled in this version (consent process not approved).' });
      const row = { organization_id: s.orgId, status, disclosure_script: disclosure || null, transcript_retention_days: b.transcript_retention_days ? Math.min(90, Math.max(1, Math.round(Number(b.transcript_retention_days)))) : null, recording_enabled: false, updated_at: nowIso() };
      await dbInsert('voice_configurations', row, { onConflict: 'organization_id' }); await dbPatch('voice_configurations', `organization_id=eq.${enc(s.orgId)}`, row);
      await dbInsert('ops_transitions', { organization_id: s.orgId, entity: 'voice', entity_id: s.orgId, to_state: status, actor_type: 'user', actor_id: s.caller.id, reason: 'voice assistant settings' });
      return send(res, 200, { ok: true, voice: row });
    }

    if (op === 'availability') {
      const s = await inOrg(req, res, orgParam, 'ops.view'); if (!s) return;
      return send(res, 200, await S.availability(s.orgId, sanitize(q.service_key, 40), { limit: Math.min(12, Number(q.limit) || 6) }));
    }

    if (op === 'jobs') {
      const s = await inOrg(req, res, orgParam, 'ops.view'); if (!s) return;
      const filters = []; if (q.state) filters.push(`state=eq.${enc(q.state)}`); if (q.fulfillment) filters.push(`fulfillment_status=eq.${enc(q.fulfillment)}`);
      const rows = await dbGet(`ops_jobs?organization_id=eq.${enc(s.orgId)}${filters.length ? `&${filters.join('&')}` : ''}&select=id,state,fulfillment_status,source_channel,total_cents,deposit_cents,currency,price_snapshot,escalation_reason,is_test,created_at,updated_at,contact_id,crm_contacts(name,phone_e164)&order=updated_at.desc&limit=200`);
      return send(res, 200, rows);
    }
    if (op === 'job') {
      const s = await inOrg(req, res, orgParam, 'ops.view'); if (!s) return;
      const id = sanitize(q.id, 60);
      const job = await dbOne(`ops_jobs?id=eq.${enc(id)}&organization_id=eq.${enc(s.orgId)}&select=*`);
      if (!job) return send(res, 404, { error: 'Not found' });
      const o = `organization_id=eq.${enc(s.orgId)}`;
      const [contact, messages, bookings, agreements, deposits, transitions, followups, conv] = await Promise.all([
        dbOne(`crm_contacts?id=eq.${enc(job.contact_id)}&${o}&select=id,name,phone_e164,email,sms_consent,sms_consent_source,sms_consent_at,suppressed,do_not_contact,is_test`),
        job.conversation_id ? dbGet(`wave1_messages?conversation_id=eq.${enc(job.conversation_id)}&${o}&select=id,direction,body,status,blocked_reason,purpose,automated,created_at,submitted_at,delivered_at&order=created_at.asc&limit=200`) : [],
        dbGet(`ops_bookings?job_id=eq.${enc(job.id)}&${o}&select=*&order=created_at.desc`),
        dbGet(`ops_agreements?job_id=eq.${enc(job.id)}&${o}&select=id,title,status,content_sha256,template_version,signer_name,signed_at,expires_at,created_at,signed_pdf_path&order=created_at.desc`),
        dbGet(`ops_deposits?job_id=eq.${enc(job.id)}&${o}&select=id,amount_cents,currency,status,livemode,paid_at,refunded_cents,provider_event_id,created_at&order=created_at.desc`),
        dbGet(`ops_transitions?entity_id=in.(${[job.id].map(enc).join(',')})&${o}&select=*&order=at.asc&limit=300`),
        dbGet(`ops_followups?job_id=eq.${enc(job.id)}&${o}&select=*`),
        job.conversation_id ? dbOne(`wave1_conversations?id=eq.${enc(job.conversation_id)}&${o}&select=id,channel,staff_takeover,engine_state,customer_initiated_at`) : null,
      ]);
      const related = [...bookings, ...agreements, ...deposits].map((x) => x.id);
      const more = related.length ? await dbGet(`ops_transitions?entity_id=in.(${related.map(enc).join(',')})&${o}&select=*&order=at.asc&limit=300`) : [];
      return send(res, 200, { job, contact, conversation: conv, messages, bookings, agreements, deposits, followups, transitions: [...transitions, ...more].sort((a, z) => (a.at < z.at ? -1 : 1)) });
    }

    if (op === 'job-action') {
      const action = sanitize(b.action, 30);
      const s = await inOrg(req, res, orgParam, ['owner-quote'].includes(action) ? 'ops.configure' : 'ops.manage'); if (!s) return;
      if (action === 'create') {
        const phone = normalizePhone(b.phone); const name = sanitize(b.name, 120) || 'Customer';
        if (!phone) return send(res, 400, { error: 'A valid phone number is required' });
        let contact = await dbOne(`crm_contacts?organization_id=eq.${enc(s.orgId)}&phone_e164=eq.${enc(phone)}&merged_into_id=is.null&select=*`);
        if (!contact) contact = (await dbInsert('crm_contacts', { organization_id: s.orgId, name, phone, phone_e164: phone, source: 'staff_entry', is_test: b.is_test === true })).row;
        let conv = await dbOne(`wave1_conversations?organization_id=eq.${enc(s.orgId)}&contact_id=eq.${enc(contact.id)}&channel=eq.sms&select=*`);
        if (!conv) conv = (await dbInsert('wave1_conversations', { organization_id: s.orgId, contact_id: contact.id, channel: 'sms', is_test: b.is_test === true, customer_initiated_at: b.customer_requested === true ? nowIso() : null }, { onConflict: 'organization_id,contact_id,channel' })).row || await dbOne(`wave1_conversations?organization_id=eq.${enc(s.orgId)}&contact_id=eq.${enc(contact.id)}&channel=eq.sms&select=*`);
        const job = await S.openJobForConversation({ orgId: s.orgId, contact, conversation: conv, channel: 'staff', isTest: b.is_test === true });
        return send(res, 200, { ok: true, job });
      }
      const job = await dbOne(`ops_jobs?id=eq.${enc(sanitize(b.job_id, 60))}&organization_id=eq.${enc(s.orgId)}&select=*`);
      if (!job) return send(res, 404, { error: 'Job not found' });
      if (action === 'quote') return send(res, 200, await S.quoteJob({ orgId: s.orgId, job, serviceKey: sanitize(b.service_key, 40), optionKeys: Array.isArray(b.options) ? b.options.map((x) => sanitize(x, 40)) : [], actor: s.actor }));
      if (action === 'owner-quote') return send(res, 200, { job: await S.ownerQuote({ orgId: s.orgId, job, totalCents: Number(b.total_cents), depositCents: Number(b.deposit_cents), durationMinutes: Number(b.duration_minutes) || null, reason: b.reason, actor: s.actor }) });
      if (action === 'hold' && (isNaN(new Date(sanitize(b.start, 40))) || new Date(sanitize(b.start, 40)) < new Date())) return send(res, 400, { error: 'Choose a valid future start time' });
      if (action === 'hold') { const r = await S.holdSlot({ orgId: s.orgId, job, slot: { start: sanitize(b.start, 40) }, actor: s.actor }); return send(res, r.ok ? 200 : 409, r.ok ? r : { error: 'That time is no longer available', reason: r.reason }); }
      if (action === 'send-agreement') {
        const bk = await dbOne(`ops_bookings?organization_id=eq.${enc(s.orgId)}&job_id=eq.${enc(job.id)}&status=eq.held&select=*&order=created_at.desc`);
        const r = await S.sendAgreement({ orgId: s.orgId, job, booking: bk, actor: s.actor });
        if (!r.ok) return send(res, 409, { error: `Cannot send: ${r.reason}`, fields: r.fields });
        let delivery = null;
        if (job.conversation_id && b.text_link === true) delivery = await sendSms({ orgId: s.orgId, conversationId: job.conversation_id, contactId: job.contact_id, body: `Review and sign your agreement${job.deposit_cents ? ' and pay the deposit' : ''}: ${r.link}`, purpose: 'booking_link', idempotencyKey: `staff-link:${r.agreement.id}`, sentBy: s.caller.id, isTest: !!job.is_test });
        return send(res, 200, { ok: true, agreement_id: r.agreement.id, link: r.link, delivery: delivery ? { status: delivery.status, reason: delivery.reason || null } : null });
      }
      if (action === 'escalate' || action === 'resume') {
        if (job.conversation_id) await dbPatch('wave1_conversations', `id=eq.${enc(job.conversation_id)}&organization_id=eq.${enc(s.orgId)}`, action === 'escalate' ? { staff_takeover: true, takeover_by: s.caller.id } : { staff_takeover: false, takeover_by: null, engine_state: 'awaiting_service', engine_context: {} });
        if (action === 'escalate' && R.canTransition('job', job.state, 'escalated')) await S.transition({ orgId: s.orgId, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from: job.state, to: 'escalated', actor: s.actor, reason: 'staff takeover' });
        if (action === 'resume' && job.state === 'escalated') await S.transition({ orgId: s.orgId, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from: 'escalated', to: 'qualifying', actor: s.actor, reason: 'automation resumed by staff' });
        return send(res, 200, { ok: true });
      }
      if (action === 'cancel' || action === 'lost') {
        const to = action === 'cancel' ? 'cancelled' : 'lost';
        const reason = sanitize(b.reason, 300); if (!reason) return send(res, 400, { error: 'A reason is required' });
        const j = await S.transition({ orgId: s.orgId, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from: job.state, to, actor: s.actor, reason, patch: action === 'lost' ? { lost_reason: reason } : {} });
        const calendar = [];
        for (const bk of await dbGet(`ops_bookings?organization_id=eq.${enc(s.orgId)}&job_id=eq.${enc(job.id)}&status=in.(held,confirmed)&select=id,status,provider,provider_booking_id`)) {
          await S.transition({ orgId: s.orgId, entity: 'booking', table: 'ops_bookings', id: bk.id, from: bk.status, to: 'cancelled', actor: s.actor, reason, patch: { cancelled_at: nowIso(), cancel_reason: reason } });
          calendar.push({ booking_id: bk.id, ...(await S.cancelProviderBooking({ orgId: s.orgId, booking: bk, reason })) });
        }
        if (job.fulfillment_status !== 'not_ready' && R.canTransition('fulfillment', job.fulfillment_status, 'cancelled')) await S.transition({ orgId: s.orgId, entity: 'fulfillment', table: 'ops_jobs', id: job.id, field: 'fulfillment_status', from: job.fulfillment_status, to: 'cancelled', actor: s.actor, reason });
        const paid = await dbOne(`ops_deposits?organization_id=eq.${enc(s.orgId)}&job_id=eq.${enc(job.id)}&status=eq.paid&select=id`);
        return send(res, 200, { ok: true, job: j, calendar, note: paid ? 'A paid deposit exists. Refunds are issued in Stripe; the refund event updates this record.' : null });
      }
      if (action === 'reschedule') { const r = await S.rescheduleJob({ orgId: s.orgId, job, start: sanitize(b.start, 40), reason: sanitize(b.reason, 300), actor: s.actor, notifyCustomer: b.notify_customer === true }); return send(res, r.ok ? 200 : 409, r.ok ? r : { error: r.reason === 'slot_taken' ? 'That time is no longer available' : r.reason === 'overlaps_current_booking' ? r.detail : `The calendar did not accept the move (${r.reason})`, reason: r.reason, detail: r.detail || null }); }
      if (action === 'start') return send(res, 200, { job: await S.transition({ orgId: s.orgId, entity: 'fulfillment', table: 'ops_jobs', id: job.id, field: 'fulfillment_status', from: job.fulfillment_status, to: 'in_progress', actor: s.actor, reason: 'work started' }) });
      if (action === 'complete' || action === 'no_show') return send(res, 200, { job: await S.completeJob({ orgId: s.orgId, jobId: job.id, actor: s.actor, notes: sanitize(b.notes, 2000), outcome: action === 'complete' ? 'completed' : 'no_show', enqueue }) });
      if (action === 'apply-referral') return send(res, 200, { referral: await S.applyReferralCode({ orgId: s.orgId, jobId: job.id, code: b.code, actor: s.actor }) });
      return send(res, 400, { error: 'Unknown action' });
    }

    if (op === 'conversation-reply') {
      const s = await inOrg(req, res, orgParam, 'ops.manage'); if (!s) return;
      const conv = await dbOne(`wave1_conversations?id=eq.${enc(sanitize(b.conversation_id, 60))}&organization_id=eq.${enc(s.orgId)}&select=*`);
      if (!conv) return send(res, 404, { error: 'Conversation not found' });
      const text = String(b.body || '').trim().slice(0, 640); if (!text) return send(res, 400, { error: 'Message is empty' });
      if (!conv.staff_takeover) await dbPatch('wave1_conversations', `id=eq.${enc(conv.id)}&organization_id=eq.${enc(s.orgId)}`, { staff_takeover: true, takeover_by: s.caller.id });
      const r = await sendSms({ orgId: s.orgId, conversationId: conv.id, contactId: conv.contact_id, body: text, purpose: 'staff_reply', idempotencyKey: `staff:${sanitize(b.client_id, 60) || nowIso()}`, sentBy: s.caller.id, isTest: !!conv.is_test });
      return send(res, 200, { status: r.status, reason: r.reason || null, automation_paused: true });
    }

    if (op === 'conversation') {
      const s = await inOrg(req, res, orgParam, 'ops.view'); if (!s) return;
      const o = `organization_id=eq.${enc(s.orgId)}`;
      const conv = await dbOne(`wave1_conversations?id=eq.${enc(sanitize(q.id, 60))}&${o}&select=id,channel,status,staff_takeover,engine_state,customer_initiated_at,is_test,contact_id,crm_contacts(name,phone_e164,suppressed,sms_consent)`);
      if (!conv) return send(res, 404, { error: 'Not found' });
      const [messages, job] = await Promise.all([
        dbGet(`wave1_messages?conversation_id=eq.${enc(conv.id)}&${o}&select=id,direction,body,status,blocked_reason,purpose,automated,created_at,submitted_at&order=created_at.asc&limit=300`),
        dbOne(`ops_jobs?conversation_id=eq.${enc(conv.id)}&${o}&select=id,state,fulfillment_status&order=created_at.desc`),
      ]);
      return send(res, 200, { conversation: conv, messages, job });
    }

    if (op === 'conversations') {
      const s = await inOrg(req, res, orgParam, 'ops.view'); if (!s) return;
      return send(res, 200, await dbGet(`wave1_conversations?organization_id=eq.${enc(s.orgId)}&select=id,channel,status,staff_takeover,engine_state,last_inbound_at,last_outbound_at,is_test,contact_id,crm_contacts(name,phone_e164,suppressed)&order=last_inbound_at.desc.nullslast&limit=100`));
    }

    if (op === 'campaigns' || op === 'campaign') {
      if (req.method === 'GET') {
        const s = await inOrg(req, res, orgParam, 'ops.view'); if (!s) return;
        if (op === 'campaign') {
          const camp = await dbOne(`ops_campaigns?id=eq.${enc(sanitize(q.id, 60))}&organization_id=eq.${enc(s.orgId)}&select=*`);
          if (!camp) return send(res, 404, { error: 'Not found' });
          const recs = await dbGet(`ops_campaign_recipients?campaign_id=eq.${enc(camp.id)}&organization_id=eq.${enc(s.orgId)}&select=id,display_name,phone_e164,last_service_date,eligibility,blocked_reason,send_status,stop_reason,scheduled_at&order=created_at.asc&limit=5000`);
          return send(res, 200, { campaign: camp, recipients: recs.map((r) => ({ ...r, phone_e164: r.phone_e164 ? `…${r.phone_e164.slice(-4)}` : null })), preview: H.summarize(recs.map((r) => ({ eligibility: r.eligibility, blocked_reason: r.blocked_reason }))) });
        }
        return send(res, 200, await dbGet(`ops_campaigns?organization_id=eq.${enc(s.orgId)}&select=id,name,purpose,status,sent_count,message_budget,approved_at,created_at&order=created_at.desc`));
      }
      const action = sanitize(b.action, 20);
      const s = await inOrg(req, res, orgParam, ['approve', 'start', 'resume'].includes(action) ? 'ops.configure' : 'ops.manage'); if (!s) return;
      if (action === 'create') return send(res, 200, await H.createCampaign({ orgId: s.orgId, name: b.name, purpose: ['past_customer_reactivation', 'dormant_quote_followup'].includes(b.purpose) ? b.purpose : 'past_customer_reactivation', message: String(b.message || ''), rows: b.rows, batchSize: Number(b.batch_size) || 25, minGap: Number(b.min_gap_seconds) || 30, maxGap: Number(b.max_gap_seconds) || 90, startAt: b.start_at || null, budget: b.message_budget == null || b.message_budget === '' ? null : Number(b.message_budget), actor: s.caller }));
      const id = sanitize(b.campaign_id, 60);
      if (action === 'approve') return send(res, 200, { campaign: await H.approveCampaign({ orgId: s.orgId, campaignId: id, actor: s.caller, attestation: b.attestation }) });
      if (action === 'start') return send(res, 200, await H.startCampaign({ orgId: s.orgId, campaignId: id, actor: s.caller, enqueue }));
      const camp = await dbOne(`ops_campaigns?id=eq.${enc(id)}&organization_id=eq.${enc(s.orgId)}&select=*`);
      if (!camp) return send(res, 404, { error: 'Not found' });
      const map = { pause: 'paused', resume: 'running', cancel: 'cancelled' };
      if (!map[action]) return send(res, 400, { error: 'Unknown action' });
      const c2 = await S.transition({ orgId: s.orgId, entity: 'campaign', table: 'ops_campaigns', id: camp.id, from: camp.status, to: map[action], actor: s.actor, reason: sanitize(b.reason, 200) || action });
      if (action === 'cancel') await dbPatch('ops_campaign_recipients', `campaign_id=eq.${enc(camp.id)}&organization_id=eq.${enc(s.orgId)}&send_status=in.(pending,scheduled)`, { send_status: 'cancelled', stop_reason: 'campaign_cancelled' });
      if (action === 'resume') for (const r of await dbGet(`ops_campaign_recipients?campaign_id=eq.${enc(camp.id)}&send_status=eq.scheduled&select=id`)) await enqueue({ job_type: 'ops_campaign_send', organization_id: s.orgId, payload: { recipient_id: r.id }, idempotency_key: `ops_campaign_send:${r.id}:resume:${Date.now()}` });
      return send(res, 200, { campaign: c2 });
    }

    if (op === 'incidents') {
      const caller = await requireStaff(req, res); if (!caller) return;
      const orgId = sanitize(orgParam, 60);
      const nova = (caller.roles || []).some((r) => ['nova_super_admin', 'nova_admin'].includes(r));
      if (req.method === 'GET') {
        if (orgId) { if (!(await hasOrgPermission(req, orgId, 'ops.view'))) return send(res, 403, { error: 'No access' }); return send(res, 200, await dbGet(`ops_incidents?organization_id=eq.${enc(orgId)}&select=*&order=first_seen_at.desc&limit=100`)); }
        if (!nova) return send(res, 403, { error: 'Platform incidents are visible to Nova staff only' });
        return send(res, 200, await dbGet('ops_incidents?organization_id=is.null&select=*&order=first_seen_at.desc&limit=100'));
      }
      const inc = await dbOne(`ops_incidents?id=eq.${enc(sanitize(b.incident_id, 60))}&select=id,organization_id`);
      if (!inc) return send(res, 404, { error: 'Not found' });
      if (inc.organization_id ? !(await hasOrgPermission(req, inc.organization_id, 'ops.manage')) : !nova) return send(res, 403, { error: 'No access' });
      if (b.action === 'acknowledge') return send(res, 200, await M.acknowledgeIncident({ incidentId: inc.id, actor: caller, note: b.note }));
      if (b.action === 'resolve') return send(res, 200, await M.resolveIncident({ incidentId: inc.id, actor: caller, resolution: b.resolution }));
      return send(res, 400, { error: 'Unknown action' });
    }

    if (op === 'health') {
      const caller = await requireStaff(req, res); if (!caller) return;
      if (!(caller.roles || []).some((r) => ['nova_super_admin', 'nova_admin'].includes(r))) return send(res, 403, { error: 'Nova staff only' });
      if (req.method === 'POST') return send(res, 200, await M.runSentry());
      const latest = await dbGet('ops_health_checks?organization_id=is.null&select=check_key,status,detail,checked_at&order=checked_at.desc&limit=200');
      const by = {}; for (const r of latest) if (!by[r.check_key]) by[r.check_key] = r;
      const hb = await dbGet('worker_runtime_heartbeats?select=worker_id,host,started_at,last_seen_at,jobs_processed,last_job_type,stopped_at&order=last_seen_at.desc&limit=10');
      return send(res, 200, { checks: Object.values(by), heartbeats: hb, send_mode: sendMode(), allowlist_active: !!allowlistFrom() });
    }

    if (op === 'reports' || op === 'report') {
      const s = await inOrg(req, res, orgParam, req.method === 'GET' ? 'ops.view' : 'ops.manage'); if (!s) return;
      if (req.method === 'GET') {
        if (op === 'report') { const r = await dbOne(`ops_weekly_reports?id=eq.${enc(sanitize(q.id, 60))}&organization_id=eq.${enc(s.orgId)}&select=*`); return r ? send(res, 200, r) : send(res, 404, { error: 'Not found' }); }
        return send(res, 200, await dbGet(`ops_weekly_reports?organization_id=eq.${enc(s.orgId)}&select=id,week_start,week_end,timezone,version,content_sha256,notification_status,generated_at,metrics&order=week_start.desc,version.desc&limit=52`));
      }
      const tz = (await dbOne(`wave1_org_settings?organization_id=eq.${enc(s.orgId)}&select=timezone`))?.timezone;
      if (!tz) return send(res, 409, { error: 'Set the business time zone first' });
      const end = R.sundayEveningOnOrBefore(new Date(), tz);
      return send(res, 200, await P.generateWeeklyReport({ orgId: s.orgId, weekEnd: end, generatedBy: `user:${s.caller.id}` }));
    }

    if (op === 'transitions') {
      const s = await inOrg(req, res, orgParam, 'ops.view'); if (!s) return;
      return send(res, 200, await dbGet(`ops_transitions?organization_id=eq.${enc(s.orgId)}&select=*&order=at.desc&limit=200`));
    }

    return send(res, 400, { error: `Unknown ops action: ${op}` });
  } catch (e) { return fail(res, e); }
}

// Capability readiness for one business — measured, not asserted.
export async function readiness(orgId) {
  const o = `organization_id=eq.${enc(orgId)}`;
  const [ops, wave, prices, templates, pay, voice, counts, incidents, report] = await Promise.all([
    dbOne(`ops_business_settings?${o}&select=*`), dbOne(`wave1_org_settings?${o}&select=*`),
    dbGet(`ops_price_rules?${o}&status=eq.approved&select=id`), dbGet(`ops_agreement_templates?${o}&status=eq.approved&select=id,legal_review`),
    dbOne(`ops_payment_accounts?${o}&select=mode,live_enabled`), dbOne(`voice_configurations?${o}&select=status,disclosure_script`),
    dbGet(`ops_jobs?${o}&select=state,fulfillment_status`), dbGet(`ops_incidents?${o}&status=eq.open&select=id`),
    dbOne(`ops_weekly_reports?${o}&select=id,week_start,generated_at&order=week_start.desc`),
  ]);
  const env = process.env; const hb = await dbOne('worker_runtime_heartbeats?select=last_seen_at,stopped_at&order=last_seen_at.desc');
  const workerLive = hb && !hb.stopped_at && Date.now() - new Date(hb.last_seen_at) < 120_000;
  const item = (key, label, ok, detail) => ({ key, label, status: ok === true ? 'ready' : ok === 'partial' ? 'partial' : 'blocked', detail });
  const items = [
    item('timezone_hours', 'Time zone and business hours', !!wave?.timezone && wave?.business_hours && Object.keys(wave.business_hours).length > 0, wave?.timezone || 'not set'),
    item('prices', 'Approved prices', prices.length > 0, `${prices.length} approved`),
    item('agreement', 'Approved agreement template', templates.length > 0 ? (templates.some((t) => t.legal_review === 'attorney_reviewed') ? true : 'partial') : false, templates.length ? (templates.some((t) => t.legal_review === 'attorney_reviewed') ? 'attorney reviewed' : 'business-approved; not legally reviewed') : 'none approved'),
    item('payments', 'Deposits', pay?.mode === 'nova_test_platform' ? 'partial' : false, pay?.mode === 'nova_test_platform' ? 'TEST mode only (Nova test account)' : pay?.mode === 'client_connected_account' ? 'business account connection not built' : 'not configured'),
    item('stripe_webhook', 'Payment confirmation webhook', !!env.STRIPE_WEBHOOK_SECRET && !!env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET ? 'configured' : 'missing STRIPE_WEBHOOK_SECRET'),
    item('sms', 'Text messaging', sendMode() === 'live' && wave?.provider_registration === 'approved' && !!wave?.sms_number_ref ? true : false, `${sendMode()}; registration ${wave?.provider_registration || 'unknown'}; number ${wave?.sms_number_ref ? 'assigned' : 'none'}`),
    item('voice', 'AI voice receptionist', voice?.status === 'active' && !!voice?.disclosure_script && sendMode() === 'live' ? true : false, voice ? `${voice.status}${voice.disclosure_script ? '' : '; no disclosure script'}` : 'not configured'),
    item('escalation', 'Human escalation contact', (wave?.escalation_contacts || []).length > 0, (wave?.escalation_contacts || []).length ? 'set' : 'none'),
    item('worker', 'Background worker', !!workerLive, hb ? `last seen ${hb.last_seen_at}` : 'never seen'),
    item('reviews', 'Review link', !!ops?.review_url, ops?.review_url ? 'set' : 'none'),
    item('referrals', 'Referral terms', ops?.referral_terms_status === 'approved', ops?.referral_terms_status || 'none'),
    item('model', 'Language model (optional)', modelConfigured() && ops?.ai_extraction_enabled ? true : 'partial', modelConfigured() ? (ops?.ai_extraction_enabled ? 'enabled' : 'available, off for this business') : 'not configured — deterministic only'),
  ];
  const tally = (f) => counts.filter(f).length;
  return {
    is_test: !!ops?.is_test, items,
    counts: { open_requests: tally((j) => !['confirmed', 'lost', 'cancelled'].includes(j.state)), needs_person: tally((j) => ['escalated', 'owner_quote_required'].includes(j.state)), ready_for_work: tally((j) => j.fulfillment_status === 'ready' || j.fulfillment_status === 'in_progress'), completed: tally((j) => j.fulfillment_status === 'completed') },
    open_incidents: incidents.length, latest_report: report || null,
  };
}
