// Nova Harvest — reactivation campaigns over AUTHORIZED imports. Importing never creates consent; unknown
// permission is blocked. A campaign runs only after the owner approves its exact audience, copy, schedule and
// budget; every send re-checks suppression, consent, replies, bookings and pauses at execution time.
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso } from '../_sales/core.js';
import { normalizePhone } from '../_wave1.js';
import * as R from './rules.js';
import { sendSms, sendMode, orgSettings } from './messaging.js';
import { transition, ERR, businessContext } from './service.js';

const PLACEHOLDERS = ['first_name', 'business_name'];
export function validateCampaignCopy(text) {
  const t = String(text || '');
  if (t.length < 20 || t.length > 480) return 'Message must be 20–480 characters';
  if (!/\bSTOP\b/.test(t)) return 'Message must tell recipients how to opt out (include "Reply STOP to opt out")';
  if (!/\{\{\s*business_name\s*\}\}/.test(t)) return 'Message must identify the business ({{business_name}})';
  const unknown = [...t.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]).filter((k) => !PLACEHOLDERS.includes(k));
  if (unknown.length) return `Unknown placeholder: ${unknown.join(', ')}`;
  if (/(guarantee|free money|act now|limited time|winner|\$\d)/i.test(t)) return 'Remove promotional claims or prices from reactivation copy; prices come only from approved rules';
  return null;
}
const render = (t, v) => t.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => v[k] ?? '');

export async function createCampaign({ orgId, name, purpose, message, rows, batchSize = 25, minGap = 30, maxGap = 90, startAt = null, budget = null, actor }) {
  const err = validateCampaignCopy(message); if (err) throw ERR(400, err);
  if (!Array.isArray(rows) || !rows.length || rows.length > 5000) throw ERR(400, 'Provide 1–5000 imported rows');
  const phones = [...new Set(rows.map((r) => normalizePhone(r.phone || r.Phone)).filter(Boolean))];
  const contacts = new Map();
  for (let i = 0; i < phones.length; i += 100) {
    const batch = phones.slice(i, i + 100);
    for (const c of await dbGet(`crm_contacts?organization_id=eq.${enc(orgId)}&phone_e164=in.(${batch.map((p) => `"${p}"`).map(enc).join(',')})&select=id,phone_e164,sms_consent,sms_consent_source,sms_consent_at,suppressed,do_not_contact,merged_into_id`)) if (!c.merged_into_id) contacts.set(c.phone_e164, c);
  }
  const classified = R.classifyImport(rows, { contactsByPhone: contacts, normalizePhone });
  const ins = await dbInsert('ops_campaigns', { organization_id: orgId, name: String(name || 'Reactivation').slice(0, 120), purpose, message_template: message, batch_size: batchSize, min_gap_seconds: minGap, max_gap_seconds: maxGap, start_at: startAt, message_budget: budget, created_by: actor.id });
  const camp = ins.row;
  const recs = classified.filter((c) => c.phone_e164).map((c) => ({ organization_id: orgId, campaign_id: camp.id, contact_id: c.contact_id || null, phone_e164: c.phone_e164, display_name: c.display_name, last_service_date: c.last_service_date, eligibility: c.eligibility, blocked_reason: c.blocked_reason }));
  const firstByPhone = new Map(); for (const r of recs) if (!firstByPhone.has(r.phone_e164)) firstByPhone.set(r.phone_e164, r); // the FIRST row for a number is the record; later rows are its duplicates
  const unique = [...firstByPhone.values()];
  for (let i = 0; i < unique.length; i += 500) await dbInsert('ops_campaign_recipients', unique.slice(i, i + 500));
  await dbInsert('ops_transitions', { organization_id: orgId, entity: 'campaign', entity_id: camp.id, from_state: null, to_state: 'draft', actor_type: 'user', actor_id: actor.id, reason: 'imported for review' });
  return { campaign: camp, preview: summarize(classified) };
}
export function summarize(classified) {
  const by = {}; for (const c of classified) { const k = c.eligibility === 'eligible' ? 'eligible' : c.blocked_reason; by[k] = (by[k] || 0) + 1; }
  return { total_rows: classified.length, eligible: by.eligible || 0, blocked: classified.length - (by.eligible || 0), by_reason: by };
}

export async function approveCampaign({ orgId, campaignId, actor, attestation }) {
  const camp = await dbOne(`ops_campaigns?id=eq.${enc(campaignId)}&organization_id=eq.${enc(orgId)}&select=*`);
  if (!camp) throw ERR(404, 'Campaign not found');
  if (!attestation || String(attestation).trim().length < 20) throw ERR(400, 'Confirm in writing that these recipients gave permission to be contacted for this purpose (20+ characters)');
  const eligible = await dbGet(`ops_campaign_recipients?campaign_id=eq.${enc(camp.id)}&organization_id=eq.${enc(orgId)}&eligibility=eq.eligible&select=id`);
  if (!eligible.length) throw ERR(409, 'No eligible recipients — nothing can be approved');
  const snapshot = { eligible_count: eligible.length, copy_sha256: R.sha256(camp.message_template), schedule: { batch_size: camp.batch_size, min_gap_seconds: camp.min_gap_seconds, max_gap_seconds: camp.max_gap_seconds, start_at: camp.start_at }, budget: camp.message_budget, attestation: String(attestation).slice(0, 500), approved_by: actor.id };
  return transition({ orgId, entity: 'campaign', table: 'ops_campaigns', id: camp.id, from: 'draft', to: 'approved', actor, reason: 'owner approved audience, copy, schedule and budget', evidence: snapshot, patch: { approval_snapshot: snapshot, approved_by: actor.id, approved_at: nowIso() } });
}

export async function startCampaign({ orgId, campaignId, actor, enqueue, rand = Math.random }) {
  const camp = await dbOne(`ops_campaigns?id=eq.${enc(campaignId)}&organization_id=eq.${enc(orgId)}&select=*`);
  if (!camp) throw ERR(404, 'Campaign not found');
  if (camp.status !== 'approved') throw ERR(409, 'Only an approved campaign can start');
  if (R.sha256(camp.message_template) !== camp.approval_snapshot?.copy_sha256) throw ERR(409, 'The message changed after approval — approve again');
  const settings = await orgSettings(orgId);
  if (sendMode() === 'live' && settings.provider_registration !== 'approved') throw ERR(409, 'Messaging registration is not approved with the provider — live campaigns are blocked');
  if (!settings.timezone) throw ERR(409, 'Set the business time zone first');
  const eligible = await dbGet(`ops_campaign_recipients?campaign_id=eq.${enc(camp.id)}&organization_id=eq.${enc(orgId)}&eligibility=eq.eligible&send_status=eq.pending&select=id&order=created_at.asc`);
  const cap = camp.message_budget == null ? eligible.length : Math.min(eligible.length, camp.message_budget);
  const times = R.scheduleSends(cap, { startAt: camp.start_at && new Date(camp.start_at) > new Date() ? camp.start_at : nowIso(), batchSize: camp.batch_size, minGap: camp.min_gap_seconds, maxGap: camp.max_gap_seconds, rand });
  for (let i = 0; i < cap; i++) {
    await dbPatch('ops_campaign_recipients', `id=eq.${enc(eligible[i].id)}&send_status=eq.pending`, { send_status: 'scheduled', scheduled_at: times[i] });
    await enqueue({ job_type: 'ops_campaign_send', organization_id: orgId, payload: { recipient_id: eligible[i].id }, scheduled_at: times[i], idempotency_key: `ops_campaign_send:${eligible[i].id}` });
  }
  const run = await transition({ orgId, entity: 'campaign', table: 'ops_campaigns', id: camp.id, from: 'approved', to: 'running', actor, reason: `scheduled ${cap} message(s)${sendMode() === 'live' ? '' : ' (dry run: no provider send)'}`, evidence: { scheduled: cap, mode: sendMode() } });
  return { campaign: run, scheduled: cap, mode: sendMode() };
}

// Executed by the worker for one recipient. Every stop condition is re-read live.
export async function sendCampaignMessage({ orgId, recipientId, now = new Date(), enqueue }) {
  const rec = await dbOne(`ops_campaign_recipients?id=eq.${enc(recipientId)}&organization_id=eq.${enc(orgId)}&select=*`);
  if (!rec || rec.send_status !== 'scheduled') return { skipped: rec ? rec.send_status : 'not_found' };
  const camp = await dbOne(`ops_campaigns?id=eq.${enc(rec.campaign_id)}&organization_id=eq.${enc(orgId)}&select=*`);
  const stop = async (send_status, stop_reason) => { await dbPatch('ops_campaign_recipients', `id=eq.${enc(rec.id)}&send_status=eq.scheduled`, { send_status, stop_reason }); return { status: send_status, reason: stop_reason }; };
  if (!camp || camp.status === 'cancelled') return stop('cancelled', 'campaign_cancelled');
  if (camp.status === 'paused') return { deferred: 'campaign_paused' }; // stays scheduled; resume re-enqueues
  if (camp.status !== 'running') return stop('stopped', `campaign_${camp.status}`);
  if (camp.message_budget != null && camp.sent_count >= camp.message_budget) return stop('stopped', 'budget_exhausted');
  const contact = rec.contact_id ? await dbOne(`crm_contacts?id=eq.${enc(rec.contact_id)}&organization_id=eq.${enc(orgId)}&select=*`) : null;
  if (!contact) return stop('blocked_at_send', 'no_contact');
  if (contact.suppressed) return stop('stopped', 'opted_out');
  const started = (await dbOne(`ops_transitions?entity=eq.campaign&entity_id=eq.${enc(camp.id)}&to_state=eq.running&select=at&order=at.asc`))?.at || camp.updated_at;
  const conv = await dbOne(`wave1_conversations?organization_id=eq.${enc(orgId)}&contact_id=eq.${enc(contact.id)}&channel=eq.sms&select=*`);
  if (conv?.last_inbound_at && new Date(conv.last_inbound_at) > new Date(started)) return stop('stopped', 'replied');
  if (await dbOne(`ops_jobs?organization_id=eq.${enc(orgId)}&contact_id=eq.${enc(contact.id)}&state=eq.confirmed&created_at=gte.${enc(started)}&select=id`)) return stop('stopped', 'booked');
  if (await dbOne(`ops_jobs?organization_id=eq.${enc(orgId)}&contact_id=eq.${enc(contact.id)}&state=in.(new,qualifying,owner_quote_required,quoted,booking,awaiting_agreement,awaiting_deposit,escalated)&select=id`)) return stop('stopped', 'active_request');
  const c = await businessContext(orgId);
  const convId = conv?.id || (await dbInsert('wave1_conversations', { organization_id: orgId, contact_id: contact.id, channel: 'sms' }, { onConflict: 'organization_id,contact_id,channel' })).row?.id
    || (await dbOne(`wave1_conversations?organization_id=eq.${enc(orgId)}&contact_id=eq.${enc(contact.id)}&channel=eq.sms&select=id`))?.id;
  const body = render(camp.message_template, { first_name: (rec.display_name || '').split(' ')[0] || 'there', business_name: c.display_name });
  const r = await sendSms({ orgId, conversationId: convId, contactId: contact.id, body, purpose: 'campaign', idempotencyKey: `campaign:${rec.id}`, isTest: !!contact.is_test, now });
  if (r.status === 'blocked' && ['min_gap', 'frequency_limit'].includes(r.reason) && enqueue) {
    const at = new Date(now.getTime() + (r.reason === 'min_gap' ? 11 * 60_000 : 24 * 3600_000)).toISOString();
    await dbPatch('ops_campaign_recipients', `id=eq.${enc(rec.id)}`, { scheduled_at: at });
    await enqueue({ job_type: 'ops_campaign_send', organization_id: orgId, payload: { recipient_id: rec.id, deferred: true }, scheduled_at: at, idempotency_key: `ops_campaign_send:${rec.id}:deferred:${at}` });
    return { deferred: at, reason: r.reason };
  }
  if (r.status === 'blocked' && r.reason === 'quiet_hours' && r.retryAt && enqueue) {
    await dbPatch('ops_campaign_recipients', `id=eq.${enc(rec.id)}`, { scheduled_at: r.retryAt });
    await enqueue({ job_type: 'ops_campaign_send', organization_id: orgId, payload: { recipient_id: rec.id, deferred: true }, scheduled_at: r.retryAt, idempotency_key: `ops_campaign_send:${rec.id}:deferred:${r.retryAt}` });
    return { deferred: r.retryAt };
  }
  const map = { provider_accepted: 'provider_accepted', dry_run: 'dry_run', failed: 'failed', duplicate: 'provider_accepted' };
  const send_status = map[r.status] || 'blocked_at_send';
  await dbPatch('ops_campaign_recipients', `id=eq.${enc(rec.id)}&send_status=eq.scheduled`, { send_status, stop_reason: send_status === 'blocked_at_send' ? r.reason : null, message_id: r.message?.id || null });
  if (['provider_accepted', 'dry_run'].includes(send_status)) await dbPatch('ops_campaigns', `id=eq.${enc(camp.id)}`, { sent_count: camp.sent_count + 1 });
  const left = await dbOne(`ops_campaign_recipients?campaign_id=eq.${enc(camp.id)}&send_status=eq.scheduled&select=id`);
  if (!left) await transition({ orgId, entity: 'campaign', table: 'ops_campaigns', id: camp.id, from: 'running', to: 'completed', actor: { type: 'system' }, reason: 'all scheduled recipients processed' }).catch(() => null);
  return { status: send_status, reason: r.reason || null };
}

// STOP (or a carrier opt-out) cancels everything already queued for that contact — not just future sends.
export async function cancelQueuedForContact({ orgId, contactId, reason = 'opted_out' }) {
  const recs = await dbPatch('ops_campaign_recipients', `organization_id=eq.${enc(orgId)}&contact_id=eq.${enc(contactId)}&send_status=eq.scheduled`, { send_status: 'stopped', stop_reason: reason });
  const fups = await dbPatch('ops_followups', `organization_id=eq.${enc(orgId)}&contact_id=eq.${enc(contactId)}&status=eq.scheduled`, { status: 'cancelled', blocked_reason: reason });
  return { campaign_messages_cancelled: recs.length, followups_cancelled: fups.length };
}
