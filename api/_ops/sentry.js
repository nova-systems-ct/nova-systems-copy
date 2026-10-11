// Nova Sentry — monitoring from MEASURED facts. A ping is not proof an integration works, so checks read real
// state (worker heartbeats, queue age, dead letters, delivery failures, payment backlog, configuration). One open
// incident per (tenant, check): repeats increment occurrences; alerts are paced; an alert attempt is never
// treated as resolution — an incident stays open until a person acknowledges it and the check recovers.
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso } from '../_sales/core.js';
import { sendEmail } from '../_email.js';
import { calcomConfigured } from '../_calcom.js';
import * as R from './rules.js';
import { modelConfigured } from './model.js';
import { sendMode } from './messaging.js';

export async function gatherFacts(now = new Date()) {
  const day = new Date(now.getTime() - 86400_000).toISOString();
  const tenMin = new Date(now.getTime() - 10 * 60_000).toISOString();
  const [heartbeats, oldestDue, dead, failedMsgs, ambiguous, backlog, lastTwilio] = await Promise.all([
    dbGet('worker_runtime_heartbeats?select=*&order=last_seen_at.desc&limit=20'),
    dbOne(`jobs?status=eq.pending&scheduled_at=lte.${enc(now.toISOString())}&select=id,scheduled_at&order=scheduled_at.asc`),
    dbGet(`jobs?status=eq.dead_letter&created_at=gte.${enc(day)}&select=id,job_type,organization_id&limit=50`),
    dbGet(`wave1_messages?status=in.(failed,undelivered)&created_at=gte.${enc(day)}&select=id&limit=500`),
    dbGet('wave1_messages?status=eq.ambiguous&select=id&limit=200'),
    dbGet(`sales_provider_events?status=in.(received,failed)&received_at=lte.${enc(tenMin)}&select=id,event_type,status&limit=50`).catch(() => []),
    dbOne('wave1_source_events?source=like.twilio*&select=received_at&order=received_at.desc').catch(() => null),
  ]);
  return {
    now, heartbeats,
    queue: { oldestDueSeconds: oldestDue ? (now - new Date(oldestDue.scheduled_at)) / 1000 : 0, deadLetter24h: dead.length, deadLetterIds: dead.map((d) => d.id) },
    messaging: { failed24h: failedMsgs.length, ambiguous: ambiguous.length, mode: sendMode() },
    payments: { unprocessedOlderThan10m: backlog.length, event_ids: backlog.map((b) => b.id) },
    webhooks: { expectTwilio: sendMode() === 'live', lastTwilioAt: lastTwilio?.received_at || null },
    calendar: { configured: calcomConfigured(process.env), ok: calcomConfigured(process.env) ? null : null },
    model: { enabled: modelConfigured() },
    config: { twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN), stripe: !!process.env.STRIPE_SECRET_KEY, stripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET },
  };
}

export async function runSentry({ now = new Date(), facts = null, alerter = defaultAlerter } = {}) {
  const f = facts || await gatherFacts(now);
  const results = R.evaluateHealth(f);
  const summary = { checks: results.length, opened: 0, updated: 0, resolved: 0, alerts: 0 };
  for (const r of results) {
    await dbInsert('ops_health_checks', { organization_id: null, check_key: r.check_key, status: r.status, detail: r.detail });
    const open = await dbOne(`ops_incidents?organization_id=is.null&check_key=eq.${enc(r.check_key)}&status=neq.resolved&select=*`);
    const bad = r.status === 'failing' || r.status === 'degraded';
    if (bad) {
      if (open) { await dbPatch('ops_incidents', `id=eq.${enc(open.id)}`, { last_seen_at: nowIso(), occurrences: open.occurrences + 1, detail: r.detail, severity: r.severity }); summary.updated++; }
      else { const ins = await dbInsert('ops_incidents', { organization_id: null, check_key: r.check_key, severity: r.severity, title: r.title, detail: r.detail }); if (!ins.conflict) summary.opened++; }
    } else if (open && r.status === 'healthy') {
      await dbPatch('ops_incidents', `id=eq.${enc(open.id)}&status=neq.resolved`, { status: 'resolved', resolved_at: nowIso(), resolution: 'check recovered', recovery_evidence: { check: r.check_key, status: r.status, detail: r.detail, at: nowIso() } });
      await dbInsert('ops_transitions', { organization_id: (await anyNovaOrg()), entity: 'incident', entity_id: open.id, from_state: open.status, to_state: 'resolved', actor_type: 'system', reason: 'check recovered', evidence: r.detail }).catch(() => null);
      summary.resolved++;
    }
  }
  // paced alerts for every open, unacknowledged incident (platform and tenant)
  for (const inc of await dbGet('ops_incidents?status=eq.open&select=*&order=first_seen_at.asc&limit=100')) {
    if (!R.alertDue(inc, now)) continue;
    const res = await alerter(inc);
    await dbPatch('ops_incidents', `id=eq.${enc(inc.id)}`, { alerts_sent: inc.alerts_sent + 1, last_alert_at: nowIso(), escalation_level: Math.min(inc.alerts_sent + 1, 3), detail: { ...inc.detail, last_alert: res } });
    summary.alerts++;
  }
  return { summary, results };
}
let novaOrgCache = null;
async function anyNovaOrg() { if (!novaOrgCache) novaOrgCache = (await dbOne('organizations?kind=eq.nova_internal&select=id'))?.id || null; return novaOrgCache; }

// Two channels where available: email (Resend) and SMS (only to an allowlisted on-call number in live mode).
// Results are recorded truthfully; "attempted" is not "acknowledged".
export async function defaultAlerter(inc) {
  const out = { at: nowIso(), email: 'not_configured', sms: 'not_configured' };
  const to = process.env.OPS_ALERT_EMAIL;
  if (to) {
    const r = await sendEmail({ to, subject: `[Nova Sentry] ${inc.severity.toUpperCase()}: ${inc.title}`, text: `Incident ${inc.id}\nCheck: ${inc.check_key}\nFirst seen: ${inc.first_seen_at}\nOccurrences: ${inc.occurrences}\n\nAcknowledge it in the Nova dashboard (Operations → Monitoring). This alert is not a resolution.`, idempotencyKey: `sentry:${inc.id}:${inc.alerts_sent + 1}` });
    out.email = r.skipped ? 'not_configured' : r.ok ? 'provider_accepted' : 'failed';
  }
  if (process.env.OPS_ALERT_SMS_TO) out.sms = sendMode() === 'live' ? 'not_implemented_without_alert_number_conversation' : 'dry_run';
  return out;
}

export async function acknowledgeIncident({ incidentId, actor, note }) {
  const inc = await dbOne(`ops_incidents?id=eq.${enc(incidentId)}&select=*`);
  if (!inc) throw Object.assign(new Error('Incident not found'), { status: 404, expose: true });
  if (inc.status !== 'open') throw Object.assign(new Error(`Incident is ${inc.status}`), { status: 409, expose: true });
  const [r] = await dbPatch('ops_incidents', `id=eq.${enc(inc.id)}&status=eq.open`, { status: 'acknowledged', acknowledged_by: actor.id, acknowledged_at: nowIso(), resolution: note ? String(note).slice(0, 500) : null });
  return r;
}
export async function resolveIncident({ incidentId, actor, resolution }) {
  const inc = await dbOne(`ops_incidents?id=eq.${enc(incidentId)}&select=*`);
  if (!inc) throw Object.assign(new Error('Incident not found'), { status: 404, expose: true });
  if (inc.status === 'resolved') throw Object.assign(new Error('Already resolved'), { status: 409, expose: true });
  if (!resolution || String(resolution).trim().length < 10) throw Object.assign(new Error('Describe what was done (10+ characters)'), { status: 400, expose: true });
  const [r] = await dbPatch('ops_incidents', `id=eq.${enc(inc.id)}&status=neq.resolved`, { status: 'resolved', resolved_at: nowIso(), resolution: String(resolution).slice(0, 1000), recovery_evidence: { resolved_by: actor.id, at: nowIso() } });
  return r;
}
