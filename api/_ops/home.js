// The owner's home screen, computed from the business's own records. Nothing is estimated: a metric that cannot be
// measured is returned as null with the reason, test records are counted separately from real ones, money booked and
// money collected are separate figures, and "worker activity" is the recorded actions of Nova's workers (system,
// model and provider actors) and of the hierarchy's agents (tasks, handoffs, escalations).
import { dbGet, dbOne, enc } from '../_sales/core.js';
import { readiness } from './index.js';
import { computeCaseClockStatus } from '../_auditClock.js';

const DAY = 86400_000;
const isTestName = (n) => /^(LOCAL TEST|TEST|DEMO)(\W|$)/.test(n || '');
const STAGES = ['intake', 'inputs_pending', 'ready', 'researching', 'evidence_gathered', 'findings_drafted', 'report_draft', 'qa_review', 'approved', 'delivered'];

function zonedDayBounds(now, tz) {
  // midnight-to-midnight of "today" in the business's time zone, as UTC instants
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = asUtc - now.getTime();
  const start = Date.UTC(+parts.year, +parts.month - 1, +parts.day) - offset;
  return [new Date(start), new Date(start + DAY)];
}

export async function ownerHome(orgId, { now = new Date(), callerId = null } = {}) {
  const o = `organization_id=eq.${enc(orgId)}`;
  const since = new Date(now.getTime() - 30 * DAY).toISOString();
  const [org, wave, ready, jobs, bookings, deposits, transitions, incidents, cases, campaigns] = await Promise.all([
    dbOne(`organizations?id=eq.${enc(orgId)}&select=id,name,kind`),
    dbOne(`wave1_org_settings?${o}&select=timezone,escalation_contacts`),
    readiness(orgId),
    dbGet(`ops_jobs?${o}&created_at=gte.${enc(since)}&select=id,state,is_test,total_cents,created_at,crm_contacts(name)&order=created_at.desc&limit=2000`),
    dbGet(`ops_bookings?${o}&start_at=gte.${enc(new Date(now.getTime() - DAY).toISOString())}&start_at=lt.${enc(new Date(now.getTime() + 2 * DAY).toISOString())}&status=in.(held,confirmed)&select=id,start_at,end_at,status,is_test,job_id,crm_contacts(name),ops_jobs(price_snapshot)&order=start_at.asc`),
    dbGet(`ops_deposits?${o}&paid_at=gte.${enc(since)}&select=amount_cents,refunded_cents,status,livemode`),
    dbGet(`ops_transitions?${o}&select=entity,entity_id,from_state,to_state,actor_type,actor_id,reason,at&order=at.desc&limit=40`),
    dbGet(`ops_incidents?${o}&status=in.(open,acknowledged)&select=id,title,severity,last_seen_at&order=last_seen_at.desc&limit=20`),
    dbGet(`audit_cases?${o}&select=id,status,scope,created_at,updated_at,clock_policy_approved_at,start_condition_met_at,target_hours,clock_basis,timezone,paused_at,total_paused_seconds,agreed_extension_hours,businesses(name),audit_findings(count),audit_reports(version,status)&order=updated_at.desc&limit=50`),
    dbGet(`demand_campaigns?${o}&status=in.(draft,pending_approval)&select=id,name,status,code`).catch(() => []),
  ]);
  const tz = wave?.timezone || 'America/New_York';
  // A request is test data when its record is flagged, or its contact follows the TEST naming convention (controlled
  // test visitors submit through the real public form, so the record itself is not flagged).
  for (const j of jobs) j.is_test = !!j.is_test || isTestName(j.crm_contacts?.name);
  for (const b of bookings) b.is_test = !!b.is_test || isTestName(b.crm_contacts?.name);

  // ---------------------------------------------------------------- metrics (30 days; real and test apart)
  const split = (rows, f = () => true) => ({ real: rows.filter((r) => !r.is_test && f(r)).length, test: rows.filter((r) => r.is_test && f(r)).length });
  const booked = jobs.filter((j) => !j.is_test && j.state === 'confirmed');
  const liveDeposits = deposits.filter((d) => ['paid', 'partially_refunded', 'refunded'].includes(d.status) && d.livemode);
  const metrics = {
    window_days: 30,
    inquiries: split(jobs),
    bookings: split(jobs, (j) => j.state === 'confirmed'),
    booked_value_cents: booked.length ? booked.reduce((a, j) => a + (j.total_cents || 0), 0) : 0,
    // Money collected is only what a live payment provider confirmed; Nova's test deposits are not money.
    collected_cents: liveDeposits.length ? liveDeposits.reduce((a, d) => a + d.amount_cents - (d.refunded_cents || 0), 0) : null,
    collected_note: liveDeposits.length ? null : 'No live payments recorded — payments are not connected',
  };
  const series = Array.from({ length: 30 }, (_, i) => {
    const d0 = new Date(now.getTime() - (29 - i) * DAY); const key = d0.toISOString().slice(0, 10);
    const day = jobs.filter((j) => j.created_at.slice(0, 10) === key);
    return { day: key, real: day.filter((j) => !j.is_test).length, test: day.filter((j) => j.is_test).length };
  });

  // ---------------------------------------------------------------- audit queue (real audits; fixtures counted apart)
  const realCases = cases.filter((c) => !isTestName(c.businesses?.name));
  const audits = realCases.slice(0, 8).map((c) => {
    const report = (c.audit_reports || []).sort((a, b) => b.version - a.version)[0] || null;
    const clock = computeCaseClockStatus({ status: c.status, startConditionMetAt: c.start_condition_met_at, targetHours: c.target_hours, clockBasis: c.clock_basis, timezone: c.timezone, pausedAt: c.paused_at, totalPausedSeconds: c.total_paused_seconds, agreedExtensionHours: Number(c.agreed_extension_hours || 0), now });
    return { id: c.id, business: c.businesses?.name || 'Unknown business', scope: c.scope === '360' ? 'Online + in person' : 'Online', status: c.status, stage: Math.max(1, STAGES.indexOf(c.status) + 1), stages: STAGES.length, findings: c.audit_findings?.[0]?.count || 0, report: report ? { version: report.version, status: report.status } : null, clock_policy_approved: !!c.clock_policy_approved_at, due_at: clock.dueAt ? new Date(clock.dueAt).toISOString() : null, clock_bucket: clock.bucket, updated_at: c.updated_at };
  });

  // ---------------------------------------------------------------- hierarchy (Nova's own organization only)
  let roster = null; let hierarchyEvents = []; let myEscalations = [];
  if (org?.kind === 'nova_internal') {
    const [workers, items, events, escal] = await Promise.all([
      dbGet('workers?status=in.(active,restricted,training,onboarding)&select=id,display_name,worker_type,status&order=display_name.asc&limit=30').catch(() => []),
      dbGet('work_items?status=in.(assigned,in_progress,blocked,in_review)&select=id,title,status,worker_id,due_at,ack_due_at,acknowledged_at&limit=500').catch(() => []),
      dbGet('work_item_events?select=work_item_id,from_status,to_status,reason,created_at,work_items(title,worker_id)&order=created_at.desc&limit=20').catch(() => []),
      callerId ? dbGet(`escalations?routed_to_user_id=eq.${enc(callerId)}&status=in.(open,routed)&select=id,reason,created_at&order=created_at.desc&limit=10`).catch(() => []) : [],
    ]);
    const nameOf = Object.fromEntries(workers.map((w) => [w.id, w.display_name]));
    roster = workers.map((w) => {
      const mine = items.filter((i) => i.worker_id === w.id);
      const late = mine.filter((i) => (i.due_at && new Date(i.due_at) < now) || (!i.acknowledged_at && i.ack_due_at && new Date(i.ack_due_at) < now));
      return { id: w.id, name: w.display_name, type: w.worker_type, status: w.status, open_tasks: mine.length, overdue: late.length, current: mine.find((i) => i.status === 'in_progress')?.title || null };
    });
    hierarchyEvents = events.map((e) => ({ at: e.created_at, who: nameOf[e.work_items?.worker_id] || 'Hierarchy', kind: 'task', text: `${e.work_items?.title || 'Task'}: ${e.from_status ? `${e.from_status.replace(/_/g, ' ')} → ` : ''}${e.to_status.replace(/_/g, ' ')}${e.reason ? ` — ${String(e.reason).slice(0, 90)}` : ''}` }));
    myEscalations = escal;
  }

  // ---------------------------------------------------------------- worker activity (recorded, newest first)
  const WORKER = { core_engine: 'Intake worker', system: 'Nova worker' };
  const opsEvents = transitions.filter((t) => t.actor_type !== 'user').map((t) => ({
    at: t.at, kind: t.actor_type, who: t.actor_type === 'provider' ? 'Payment/phone provider' : t.actor_type === 'customer' ? 'Customer' : t.actor_type === 'model' ? 'Language model' : WORKER[t.actor_id] || 'Nova worker',
    text: `${t.entity} ${t.from_state ? `${t.from_state.replace(/_/g, ' ')} → ` : ''}${t.to_state.replace(/_/g, ' ')}${t.reason ? ` — ${String(t.reason).slice(0, 90)}` : ''}`,
  }));
  const activity = [...opsEvents, ...hierarchyEvents].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12);

  // ---------------------------------------------------------------- today's schedule (business time zone)
  const [d0, d1] = zonedDayBounds(now, tz);
  const schedule = bookings.filter((b) => new Date(b.start_at) >= d0 && new Date(b.start_at) < d1).map((b) => ({ id: b.id, job_id: b.job_id, start_at: b.start_at, end_at: b.end_at, status: b.status, is_test: b.is_test, who: b.crm_contacts?.name || 'Customer', what: b.ops_jobs?.price_snapshot?.service_name || 'Appointment' }));

  // ---------------------------------------------------------------- priorities (only real open items)
  const pr = [];
  for (const i of incidents.filter((x) => x.severity === 'critical')) pr.push({ level: 'high', title: i.title, detail: 'Open alert', to: '/dashboard/ops/monitoring' });
  const needPerson = jobs.filter((j) => ['escalated', 'owner_quote_required'].includes(j.state));
  if (needPerson.length) pr.push({ level: 'high', title: `${needPerson.length} customer request${needPerson.length > 1 ? 's' : ''} need${needPerson.length > 1 ? '' : 's'} a person`, detail: needPerson.slice(0, 2).map((j) => j.crm_contacts?.name || 'Customer').join(', '), to: '/dashboard/ops/requests' });
  if (!(wave?.escalation_contacts || []).length) pr.push({ level: 'high', title: 'Name the escalation contact', detail: 'Unsupported requests have nobody to go to', to: '/dashboard/ops/settings' });
  for (const a of audits.filter((x) => x.report && ['draft', 'in_review', 'qa_review'].includes(x.report.status))) pr.push({ level: 'medium', title: `Review the audit report — ${a.business}`, detail: `Version ${a.report.version}, ${a.findings} finding${a.findings === 1 ? '' : 's'}, not approved`, to: `/dashboard/audit/${a.id}?section=report` });
  for (const a of audits.filter((x) => !x.clock_policy_approved && ['intake', 'inputs_pending', 'ready'].includes(x.status) && x.findings > 0)) pr.push({ level: 'medium', title: `Decide the delivery clock — ${a.business}`, detail: 'No approved clock policy; the clock cannot start', to: `/dashboard/audit/${a.id}?section=clock` });
  for (const c of campaigns) pr.push({ level: 'medium', title: `Approve or edit Demand campaign ${c.code}`, detail: `${c.name} — nobody is contacted until you approve`, to: '/dashboard/ops/demand' });
  for (const e of myEscalations) pr.push({ level: 'high', title: 'Escalated to you', detail: String(e.reason).slice(0, 90), to: '/dashboard/my-work' });
  for (const i of incidents.filter((x) => x.severity !== 'critical').slice(0, 3)) pr.push({ level: 'low', title: i.title, detail: 'Open alert', to: '/dashboard/ops/monitoring' });
  const order = { high: 0, medium: 1, low: 2 };
  pr.sort((a, b) => order[a.level] - order[b.level]);

  // ---------------------------------------------------------------- integrations (measured readiness, plain words)
  const it = Object.fromEntries(ready.items.map((i) => [i.key, i]));
  const emailLive = String(process.env.SALES_EMAIL_MODE || '').toLowerCase() === 'live' && !!process.env.RESEND_API_KEY;
  const integrations = [
    { key: 'calendar', name: 'Nova calendar', purpose: 'Availability, holds and bookings', state: 'connected', note: 'Built in; Cal.com sync optional' },
    { key: 'email', name: 'Email (Resend)', purpose: 'Confirmations, report links', state: emailLive ? 'connected' : 'recorded_only', note: emailLive ? 'Live sending on' : 'Recorded, not sent (dry run)' },
    { key: 'sms', name: 'Texting (Twilio)', purpose: 'Replies, missed-call follow-up', state: it.sms?.status === 'ready' ? 'connected' : 'setup_needed', note: it.sms?.detail || '' },
    { key: 'voice', name: 'AI phone receptionist', purpose: 'Answers calls, books, hands off', state: it.voice?.status === 'ready' ? 'connected' : 'setup_needed', note: it.voice?.detail || '' },
    { key: 'payments', name: 'Payments (Stripe)', purpose: 'Deposits to the business’s own account', state: it.payments?.status === 'ready' ? 'connected' : it.payments?.status === 'partial' ? 'test_only' : 'setup_needed', note: it.payments?.detail || '' },
    { key: 'worker', name: 'Background worker', purpose: 'Follow-ups, alerts, reports', state: it.worker?.status === 'ready' ? 'connected' : 'setup_needed', note: it.worker?.detail || '' },
  ];

  return {
    org: { id: org?.id, name: org?.name, kind: org?.kind }, timezone: tz, generated_at: now.toISOString(),
    metrics, series, needs_attention: pr.filter((p) => p.level === 'high').length, priorities: pr.slice(0, 6),
    schedule, activity, roster, audits, audit_fixtures_hidden: cases.length - realCases.length, integrations,
    counts: ready.counts, is_test_business: ready.is_test,
  };
}
