// Weekly scoreboard — generated from persisted rows only, stored immutably (versioned, hashed, with the source
// row ids behind every figure), delivered Sunday 18:00 in the business's own time zone.
import { dbGet, dbOne, dbInsert, dbPatch, enc, appBase } from '../_sales/core.js';
import * as R from './rules.js';
import { businessContext } from './service.js';
import { sendSms } from './messaging.js';

const inWin = (col, w) => `${col}=gte.${enc(w.start.toISOString())}&${col}=lt.${enc(w.end.toISOString())}`;

export async function generateWeeklyReport({ orgId, weekEnd, generatedBy = 'worker' }) {
  const c = await businessContext(orgId);
  const tz = c.wave.timezone;
  if (!tz) throw Object.assign(new Error('Business time zone not configured'), { status: 409, expose: true });
  const window = R.weekWindowEndingAt(weekEnd, tz);
  const o = `organization_id=eq.${enc(orgId)}`;
  const [messages, jobs, bookings, agreements, paid, refunded, confirmedT, dead, openJobs, draftCamps, openInc, voiceSessions] = await Promise.all([
    dbGet(`wave1_messages?${o}&${inWin('created_at', window)}&select=id,purpose,status,direction,idempotency_key,is_test&limit=10000`),
    dbGet(`ops_jobs?${o}&${inWin('created_at', window)}&select=id,source_channel,total_cents,is_test,referral_code_used&limit=10000`),
    dbGet(`ops_bookings?${o}&${inWin('confirmed_at', window)}&select=id,status,is_test&limit=10000`),
    dbGet(`ops_agreements?${o}&${inWin('signed_at', window)}&select=id,status,job_id&limit=10000`),
    dbGet(`ops_deposits?${o}&${inWin('paid_at', window)}&select=id,job_id,status,amount_cents,refunded_cents,livemode,paid_at&limit=10000`),
    dbGet(`ops_deposits?${o}&${inWin('refunded_at', window)}&select=id,job_id,status,amount_cents,refunded_cents,livemode&limit=10000`),
    dbGet(`ops_transitions?${o}&entity=eq.job&to_state=eq.confirmed&${inWin('at', window)}&select=entity_id&limit=10000`),
    dbGet(`jobs?${o}&status=eq.dead_letter&${inWin('created_at', window)}&select=id&limit=1000`),
    dbGet(`ops_jobs?${o}&state=in.(escalated,owner_quote_required)&select=id`),
    dbGet(`ops_campaigns?${o}&status=eq.draft&select=id`),
    dbGet(`ops_incidents?${o}&status=eq.open&select=id`),
    dbGet(`voice_call_sessions?${o}&${inWin('started_at', window)}&select=id,cost_cents&limit=10000`),
  ]);
  const confirmedIds = new Set(confirmedT.map((t) => t.entity_id));
  const relevantJobIds = [...new Set([...paid, ...refunded, ...agreements].map((x) => x.job_id).concat([...confirmedIds]))];
  const allJobs = relevantJobIds.length ? await dbGet(`ops_jobs?${o}&id=in.(${relevantJobIds.map(enc).join(',')})&select=id,source_channel,total_cents,is_test,referral_code_used`) : [];
  const allJobsById = Object.fromEntries(allJobs.map((j) => [j.id, j]));
  const jobsWithConfirm = jobs.map((j) => ({ ...j, confirmed_in_window: confirmedIds.has(j.id) }));
  for (const id of confirmedIds) if (!jobs.find((j) => j.id === id) && allJobsById[id]) jobsWithConfirm.push({ ...allJobsById[id], confirmed_in_window: true, created_outside_window: true });
  const deposits = [...new Map([...paid, ...refunded].map((d) => [d.id, d])).values()];
  const sb = R.buildScoreboard({ window, org: { ...c.ops, is_test: !!c.ops.is_test }, rows: { messages, jobs: jobsWithConfirm.filter((j) => !j.created_outside_window || j.confirmed_in_window), bookings, agreements, deposits, allJobsById, deadJobs: dead, openDecisions: [...openJobs, ...draftCamps, ...openInc], voiceSessions } });
  // inquiries are counted for jobs CREATED in the window only
  sb.metrics.inquiries_handled = jobs.filter((j) => c.ops.is_test || !j.is_test).length;
  const content = R.canonical({ window: { start: window.start.toISOString(), end: window.end.toISOString() }, metrics: sb.metrics });
  const prev = await dbOne(`ops_weekly_reports?${o}&week_start=eq.${enc(window.start.toISOString())}&select=version,content_sha256&order=version.desc`);
  if (prev && prev.content_sha256 === R.sha256(content)) return { report: prev, unchanged: true };
  const ins = await dbInsert('ops_weekly_reports', { organization_id: orgId, week_start: window.start.toISOString(), week_end: window.end.toISOString(), timezone: tz, version: (prev?.version || 0) + 1, metrics: sb.metrics, sources: sb.sources, content_sha256: R.sha256(content), generated_by: generatedBy });
  if (ins.conflict) return { report: await dbOne(`ops_weekly_reports?${o}&week_start=eq.${enc(window.start.toISOString())}&select=*&order=version.desc`), unchanged: true };
  return { report: ins.row };
}

// SMS summary to the owner's number. Needs a contact record for the owner in this organization with recorded
// consent (set when the owner opts in from Settings) — otherwise recorded as blocked, never "sent".
export async function notifyWeeklyReport({ orgId, reportId }) {
  const rep = await dbOne(`ops_weekly_reports?id=eq.${enc(reportId)}&organization_id=eq.${enc(orgId)}&select=*`);
  if (!rep || rep.notification_status !== 'not_sent') return { skipped: rep?.notification_status || 'not_found' };
  const c = await businessContext(orgId);
  const owner = c.ops.scoreboard_recipient_phone ? await dbOne(`crm_contacts?organization_id=eq.${enc(orgId)}&phone_e164=eq.${enc(c.ops.scoreboard_recipient_phone)}&source=eq.owner_settings&select=*`) : null;
  const done = (s, d) => dbPatch('ops_weekly_reports', `id=eq.${enc(rep.id)}&notification_status=eq.not_sent`, { notification_status: s, notification_detail: d });
  if (!owner) { await done('blocked', 'no opted-in owner number configured'); return { status: 'blocked' }; }
  let conv = await dbOne(`wave1_conversations?organization_id=eq.${enc(orgId)}&contact_id=eq.${enc(owner.id)}&channel=eq.sms&select=id`);
  if (!conv) conv = (await dbInsert('wave1_conversations', { organization_id: orgId, contact_id: owner.id, channel: 'sms' }, { onConflict: 'organization_id,contact_id,channel' })).row || await dbOne(`wave1_conversations?organization_id=eq.${enc(orgId)}&contact_id=eq.${enc(owner.id)}&channel=eq.sms&select=id`);
  const body = R.scoreboardSms(rep.metrics, `${appBase()}/dashboard/ops/reports/${rep.id}`, c.display_name);
  const r = await sendSms({ orgId, conversationId: conv.id, contactId: owner.id, body, purpose: 'weekly_report', idempotencyKey: `weekly:${rep.id}` });
  const status = r.status === 'provider_accepted' ? 'provider_accepted' : r.status === 'dry_run' ? 'dry_run' : r.status === 'failed' ? 'failed' : 'blocked';
  await done(status, r.reason || null);
  return { status, reason: r.reason || null };
}

// Hourly tick: for each business with a time zone, once its Sunday 18:00 has passed, generate that week once.
export async function scoreboardTick({ now = new Date() } = {}) {
  const orgs = await dbGet('ops_business_settings?scoreboard_enabled=eq.true&select=organization_id');
  const out = [];
  for (const { organization_id: orgId } of orgs) {
    const s = await dbOne(`wave1_org_settings?organization_id=eq.${enc(orgId)}&select=timezone`);
    if (!s?.timezone) { out.push({ orgId, skipped: 'no_timezone' }); continue; }
    const end = R.sundayEveningOnOrBefore(now, s.timezone);
    if (!end || now - end > 36 * 3600_000) { out.push({ orgId, skipped: 'not_due' }); continue; }
    const start = R.weekWindowEndingAt(end, s.timezone).start;
    if (await dbOne(`ops_weekly_reports?organization_id=eq.${enc(orgId)}&week_start=eq.${enc(start.toISOString())}&select=id`)) { out.push({ orgId, skipped: 'already_generated' }); continue; }
    const { report } = await generateWeeklyReport({ orgId, weekEnd: end });
    const n = await notifyWeeklyReport({ orgId, reportId: report.id });
    out.push({ orgId, report_id: report.id, notification: n.status });
  }
  return out;
}
