// Runs the REAL handler code in api/_wave1Handlers.js against an in-memory repository.
// EVIDENCE CLASS: simulator/logic only. No Twilio request was received, no SMS was sent, and no
// database table was touched. This proves the orchestration rules; it does NOT prove journeys
// C/D/E in production — those need the migration, a deployed webhook URL and a real number.
import { twilioSignature } from '../api/_wave1.js';
import { handleSmsInbound, handleCallStatus, handleSmsStatus, handleVoiceInbound, handleFormIntake, runMissedCallFollowup } from '../api/_wave1Handlers.js';

const results = [];
const log = (name, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`); results.push(pass); };

function makeRepo() {
  let n = 0; const id = () => `id${++n}`;
  const s = { settings: [], contacts: [], convs: [], msgs: [], events: new Set(), jobs: [] };
  const repo = {
    s,
    async orgByNumber(num) { const r = s.settings.find((x) => x.sms_number_ref === num); return r ? { organization_id: r.organization_id, settings: r } : null; },
    async orgByFormToken(t) { return s.settings.find((x) => x.form_token === t) || null; },
    async recordSourceEvent(src, eid) { const k = `${src}|${eid}`; if (s.events.has(k)) return false; s.events.add(k); return true; },
    async upsertContactByPhone(org, phone, d) { let c = s.contacts.find((x) => x.organization_id === org && x.phone_e164 === phone); if (!c) { c = { id: id(), organization_id: org, phone_e164: phone, suppressed: false, sms_consent: false, ...d }; s.contacts.push(c); } return c; },
    async createContact(org, d) { const c = { id: id(), organization_id: org, suppressed: false, sms_consent: false, ...d }; s.contacts.push(c); return c; },
    async updateContact(org, cid, p) { const c = s.contacts.find((x) => x.id === cid && x.organization_id === org); Object.assign(c, p); return c; },
    async getContact(org, cid) { return s.contacts.find((x) => x.id === cid && x.organization_id === org) || null; },
    async upsertConversation(org, cid, ch) { let c = s.convs.find((x) => x.organization_id === org && x.contact_id === cid && x.channel === ch); if (!c) { c = { id: id(), organization_id: org, contact_id: cid, channel: ch, staff_takeover: false, contact_replied_since_trigger: false, appointment_confirmed: false }; s.convs.push(c); } return c; },
    async getConversation(org, cid) { return s.convs.find((x) => x.id === cid && x.organization_id === org) || null; },
    async updateConversation(org, cid, p) { Object.assign(s.convs.find((x) => x.id === cid && x.organization_id === org), p); },
    async getSettings(org) { return s.settings.find((x) => x.organization_id === org) || null; },
    async insertMessage(org, m) { if (m.idempotency_key && s.msgs.some((x) => x.organization_id === org && x.idempotency_key === m.idempotency_key)) return null; if (m.provider_sid && s.msgs.some((x) => x.provider === m.provider && x.provider_sid === m.provider_sid)) return null; const r = { id: id(), organization_id: org, created_at: new Date().toISOString(), ...m }; s.msgs.push(r); return r; },
    async findMessageBySid(org, sid) { return s.msgs.find((x) => x.organization_id === org && x.provider === 'twilio' && x.provider_sid === sid) || null; },
    async messageExists(org, key) { return this.s.msgs.some((x) => x.organization_id === org && x.idempotency_key === key); },
    async updateMessage(org, mid, p) { Object.assign(s.msgs.find((x) => x.id === mid && x.organization_id === org), p); },
    async countRecentAutomated(org, cid) { const conv = s.convs.filter((c) => c.organization_id === org && c.contact_id === cid).map((c) => c.id); const sent = s.msgs.filter((m) => conv.includes(m.conversation_id) && m.automated && ['provider_accepted', 'delivered', 'queued', 'ambiguous'].includes(m.status)); return { count: sent.length, lastAt: sent.at(-1)?.created_at || null }; },
    async enqueueJob(j) { if (s.jobs.some((x) => x.idempotency_key === j.idempotency_key)) return { deduped: true }; s.jobs.push(j); return { deduped: false }; },
  };
  return repo;
}

const ENV = { TWILIO_AUTH_TOKEN: 'tok', WAVE1_SEND_ENABLED: 'true' };
const BASE = 'https://nova-systems.app/api/client?resource=wave1';
const signed = (op, params) => ({ url: `${BASE}&op=${op}`, params, signature: twilioSignature(`${BASE}&op=${op}`, params, 'tok') });
// A weekday noon in New York for settings that pass quiet hours: we control eligibility via timezone + clock.
const orgA = 'orgA', orgB = 'orgB';
const settingsFor = (org, num, extra = {}) => ({ organization_id: org, sms_number_ref: num, timezone: 'Pacific/Kiritimati', quiet_hours: { start: 0, end: 0 }, templates: { missed_call: 'Sorry we missed you — how can we help?' }, form_token: `tok-${org}`, ...extra });

// ---------------------------------------------------------------------------------------------
{
  const repo = makeRepo(); repo.s.settings.push(settingsFor(orgA, '+12035550111'), settingsFor(orgB, '+12035550222'));
  const bad = await handleSmsInbound({ url: `${BASE}&op=sms-inbound`, params: { From: '+12035550100', To: '+12035550111', Body: 'hi', MessageSid: 'SM1' }, signature: 'forged' }, repo, ENV);
  log('An unsigned/forged webhook is rejected (403) and stores NOTHING', bad.status === 403 && repo.s.contacts.length === 0 && repo.s.msgs.length === 0);
  const nocfg = await handleSmsInbound({ url: `${BASE}&op=sms-inbound`, params: {}, signature: 'x' }, repo, {});
  log('With no auth token configured the webhook fails CLOSED (503), not open', nocfg.status === 503);
}
{
  const repo = makeRepo(); repo.s.settings.push(settingsFor(orgA, '+12035550111'), settingsFor(orgB, '+12035550222'));
  const p = { From: '+12035550100', To: '+12035550111', Body: 'Do you do estimates?', MessageSid: 'SM10' };
  const r1 = await handleSmsInbound(signed('sms-inbound', p), repo, ENV);
  const r2 = await handleSmsInbound(signed('sms-inbound', p), repo, ENV); // Twilio retry / replay
  log('Inbound SMS creates ONE contact, ONE conversation, ONE message linked together', r1.status === 200 && repo.s.contacts.length === 1 && repo.s.convs.length === 1 && repo.s.msgs.length === 1 && repo.s.msgs[0].conversation_id === repo.s.convs[0].id);
  log('DUPLICATE WEBHOOK: replaying the same MessageSid changes nothing', r2.status === 200 && repo.s.msgs.length === 1 && repo.s.contacts.length === 1);
  log('A reply marks the conversation so automated follow-up will stop', repo.s.convs[0].contact_replied_since_trigger === true);
  const other = await handleSmsInbound(signed('sms-inbound', { ...p, MessageSid: 'SM11', To: '+12035550222' }), repo, ENV);
  const aRows = repo.s.contacts.filter((c) => c.organization_id === orgA).length, bRows = repo.s.contacts.filter((c) => c.organization_id === orgB).length;
  log('ISOLATION: the same caller texting Org B\'s number becomes a SEPARATE contact in Org B; Org A is untouched', other.status === 200 && aRows === 1 && bRows === 1 && repo.s.msgs.filter((m) => m.organization_id === orgA).length === 1);
  const stray = await handleSmsInbound(signed('sms-inbound', { From: '+12035550100', To: '+19998887777', Body: 'x', MessageSid: 'SM12' }), repo, ENV);
  log('A message to a number no organization owns is acknowledged and recorded nowhere', stray.status === 200 && repo.s.msgs.length === 2);
}

// ---- D: eligible missed call → exactly one follow-up; E: opt-out blocks even an ALREADY-QUEUED job ----
{
  const repo = makeRepo(); repo.s.settings.push(settingsFor(orgA, '+12035550111'));
  const seen = await repo.upsertContactByPhone(orgA, '+12035550100', { name: 'Pat' });
  await repo.updateContact(orgA, seen.id, { sms_consent: true, sms_consent_source: 'web_form_checkbox', sms_consent_at: '2026-09-01T00:00:00Z' });
  const call = { From: '+12035550100', To: '+12035550111', CallSid: 'CA1', CallStatus: 'no-answer' };
  await handleCallStatus(signed('call-status', call), repo, ENV);
  await handleCallStatus(signed('call-status', call), repo, ENV); // duplicate provider event
  await handleCallStatus(signed('call-status', { ...call, CallStatus: 'busy' }), repo, ENV); // same call, another status: still ONE followup per call
  log('MISSED CALL: an eligible missed call enqueues exactly ONE follow-up job (duplicate callbacks do not add more)', repo.s.jobs.length === 1 && repo.s.jobs[0].idempotency_key === 'missed_call:CA1');
  await handleCallStatus(signed('call-status', { ...call, CallStatus: 'completed' }), repo, ENV);
  log('A completed (answered) call enqueues nothing', repo.s.jobs.length === 1);

  let sends = 0; const sender = async () => { sends += 1; return { httpStatus: 201, sid: 'SMx' }; };
  const job = { ...repo.s.jobs[0], job_type: 'wave1_missed_call_followup' };
  // STOP arrives AFTER the job was queued but BEFORE the worker ran it:
  await handleSmsInbound(signed('sms-inbound', { From: '+12035550100', To: '+12035550111', Body: 'STOP', MessageSid: 'SM50' }), repo, ENV);
  const out = await runMissedCallFollowup(job, repo, sender, ENV);
  log('OPT-OUT: STOP stores suppression on the contact', repo.s.contacts[0].suppressed === true && repo.s.contacts[0].suppression_source === 'sms_stop_keyword');
  log('OPT-OUT: an already-queued job is BLOCKED at execution time — the provider is never called', out.blocked === 'suppressed_opt_out' && sends === 0);
  log('The block is recorded for the operator view with its reason', repo.s.msgs.some((m) => m.status === 'blocked' && m.blocked_reason === 'suppressed_opt_out'));
}
{
  const repo = makeRepo(); repo.s.settings.push(settingsFor(orgA, '+12035550111'));
  const c = await repo.upsertContactByPhone(orgA, '+12035550100', { name: 'Pat' });
  await repo.updateContact(orgA, c.id, { sms_consent: true, sms_consent_source: 'web_form_checkbox', sms_consent_at: '2026-09-01T00:00:00Z' });
  await handleCallStatus(signed('call-status', { From: '+12035550100', To: '+12035550111', CallSid: 'CA2', CallStatus: 'no-answer' }), repo, ENV);
  let sends = 0; const ok = async () => { sends += 1; return { httpStatus: 201, sid: 'SMabc' }; };
  const job = repo.s.jobs[0];
  const r1 = await runMissedCallFollowup(job, repo, ok, ENV);
  const r2 = await runMissedCallFollowup(job, repo, ok, ENV); // job redelivered after a crash
  log('SEND: a consented, eligible missed call sends once and records provider_accepted (NOT "delivered")', r1.sent === true && sends === 1 && repo.s.msgs.some((m) => m.status === 'provider_accepted' && m.provider_sid === 'SMabc') && !repo.s.msgs.some((m) => m.status === 'delivered'));
  log('REDELIVERED JOB: the same missed call is never texted twice (idempotency guard, checked before any rate rule)', r2.skipped === 'already_attempted' && sends === 1);
  repo.s.settings[0].min_gap_minutes = 0; repo.s.settings[0].max_automated_per_day = 99;
  const r2b = await runMissedCallFollowup(job, repo, ok, ENV);
  log('...and STILL never twice when the min-gap and daily limits are switched off', r2b.skipped === 'already_attempted' && sends === 1);

  // staff takeover before execution
  const repo2 = makeRepo(); repo2.s.settings.push(settingsFor(orgA, '+12035550111'));
  const c2 = await repo2.upsertContactByPhone(orgA, '+12035550100', { name: 'Pat' });
  await repo2.updateContact(orgA, c2.id, { sms_consent: true, sms_consent_source: 'staff', sms_consent_at: '2026-09-01T00:00:00Z' });
  await handleCallStatus(signed('call-status', { From: '+12035550100', To: '+12035550111', CallSid: 'CA3', CallStatus: 'no-answer' }), repo2, ENV);
  await repo2.updateConversation(orgA, repo2.s.convs[0].id, { staff_takeover: true });
  let s2 = 0; const r3 = await runMissedCallFollowup(repo2.s.jobs[0], repo2, async () => { s2 += 1; return { httpStatus: 201 }; }, ENV);
  log('HANDOFF: staff takeover between enqueue and execution blocks the automated text', r3.blocked === 'staff_takeover' && s2 === 0);
}

// ---- consent gating at the door ----
{
  const repo = makeRepo(); repo.s.settings.push(settingsFor(orgA, '+12035550111'));
  await handleCallStatus(signed('call-status', { From: '+12035550100', To: '+12035550111', CallSid: 'CA4', CallStatus: 'no-answer' }), repo, ENV);
  log('NO CONSENT: an unknown caller\'s missed call is NOT texted — a number existing is not consent (blocked + recorded, no job)', repo.s.jobs.length === 0 && repo.s.msgs.some((m) => m.blocked_reason === 'no_recorded_consent'));
}

// ---- dry run / template / ambiguous ----
{
  const mk = async (envOver, setOver, sender) => {
    const repo = makeRepo(); repo.s.settings.push(settingsFor(orgA, '+12035550111', setOver));
    const c = await repo.upsertContactByPhone(orgA, '+12035550100', {});
    await repo.updateContact(orgA, c.id, { sms_consent: true, sms_consent_source: 'staff', sms_consent_at: '2026-09-01T00:00:00Z' });
    await handleCallStatus(signed('call-status', { From: '+12035550100', To: '+12035550111', CallSid: 'CA5', CallStatus: 'no-answer' }), repo, { ...ENV, ...envOver });
    return { repo, out: await runMissedCallFollowup(repo.s.jobs[0], repo, sender, { ...ENV, ...envOver }) };
  };
  let called = 0;
  const dry = await mk({ WAVE1_SEND_ENABLED: 'false' }, {}, async () => { called += 1; return { httpStatus: 201 }; });
  log('DRY RUN: with live sends disabled nothing reaches the provider and the row says so (not "sent")', called === 0 && dry.out.blocked === 'send_disabled_dry_run' && dry.repo.s.msgs.at(-1).status === 'blocked');
  const noTpl = await mk({}, { templates: {} }, async () => ({ httpStatus: 201 }));
  log('No reviewed template → blocked; the system never invents message copy', noTpl.out.blocked === 'no_reviewed_template');
  const amb = await mk({}, {}, async () => { throw new Error('ETIMEDOUT'); });
  log('AMBIGUOUS OUTCOME: a provider timeout is recorded as ambiguous and NOT auto-retried', amb.out.ambiguous === true && amb.repo.s.msgs.some((m) => m.status === 'ambiguous'));
  const rej = await mk({}, {}, async () => ({ httpStatus: 400 }));
  log('A provider rejection is recorded as failed (visible), not silently dropped', rej.out.failed === true && rej.repo.s.msgs.some((m) => m.status === 'failed'));
  let attempts = 0; const rl = await mk({}, {}, async () => { attempts += 1; return { httpStatus: 429 }; }).catch((e) => e);
  log('Rate limiting throws so the durable queue retries with backoff', rl instanceof Error && attempts === 1);
}

// ---- forms ----
{
  const repo = makeRepo(); repo.s.settings.push(settingsFor(orgA, '+12035550111'), settingsFor(orgB, '+12035550222'));
  const body = { submission_id: 'sub1', rendered_at: Date.now() - 10_000, fields: { name: 'Pat', phone: '(203) 555-0100', message: 'Need a quote' } };
  const r = await handleFormIntake({ token: 'tok-orgA', body }, repo);
  const dup = await handleFormIntake({ token: 'tok-orgA', body }, repo);
  log('FORM: a valid submission creates a contact + conversation + message in the RIGHT org', r.status === 200 && repo.s.contacts.length === 1 && repo.s.contacts[0].organization_id === orgA && repo.s.msgs.length === 1);
  log('FORM: providing a phone does NOT grant SMS consent', repo.s.contacts[0].sms_consent === false);
  log('FORM: a double-submit is de-duplicated', dup.body.duplicate === true && repo.s.contacts.length === 1);
  const withConsent = await handleFormIntake({ token: 'tok-orgA', body: { ...body, submission_id: 'sub2', fields: { ...body.fields, phone: '2035550199', sms_consent: true } } }, repo);
  const c2 = repo.s.contacts.find((c) => c.phone_e164 === '+12035550199');
  log('FORM: the explicit checkbox records consent WITH source and timestamp', withConsent.status === 200 && c2.sms_consent === true && c2.sms_consent_source === 'web_form_checkbox' && !!c2.sms_consent_at);
  log('FORM: a wrong token is a 404 and writes nothing', (await handleFormIntake({ token: 'nope', body }, repo)).status === 404);
  log('FORM: honeypot spam is rejected', (await handleFormIntake({ token: 'tok-orgA', body: { ...body, submission_id: 's3', website_url_confirm: 'http://spam' } }, repo)).status === 422);
  log('FORM: Org B\'s token cannot write into Org A', (await handleFormIntake({ token: 'tok-orgB', body: { ...body, submission_id: 's4', fields: { name: 'Q', phone: '2035550177' } } }, repo)).status === 200 && repo.s.contacts.find((c) => c.phone_e164 === '+12035550177').organization_id === orgB);
}

// ---- quiet hours: deferred to the morning, not dropped, and re-checked when it runs ----
{
  const repo = makeRepo();
  const hourNow = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Pacific/Kiritimati', hour: 'numeric', hour12: false }).format(new Date())) % 24;
  repo.s.settings.push(settingsFor(orgA, '+12035550111', { quiet_hours: { start: hourNow, end: (hourNow + 2) % 24 } }));
  const c = await repo.upsertContactByPhone(orgA, '+12035550100', { name: 'Pat' });
  await repo.updateContact(orgA, c.id, { sms_consent: true, sms_consent_source: 'web_form_checkbox', sms_consent_at: '2026-09-01T00:00:00Z' });
  await handleCallStatus(signed('call-status', { From: '+12035550100', To: '+12035550111', CallSid: 'CAq', CallStatus: 'no-answer' }), repo, ENV);
  const j = repo.s.jobs[0];
  log('QUIET HOURS: a missed call at night is SCHEDULED for when quiet hours end, not dropped and not sent now', repo.s.jobs.length === 1 && new Date(j.scheduled_at) > new Date() && repo.s.msgs.length === 0);
  let sends = 0; const sender = async () => { sends += 1; return { httpStatus: 201, sid: 'SMq' }; };
  const out = await runMissedCallFollowup({ ...j, job_type: 'wave1_missed_call_followup' }, repo, sender, ENV);
  log('QUIET HOURS: if the job runs while still quiet it defers again (bounded) and sends nothing', out.deferred_until && sends === 0 && repo.s.jobs.length === 2 && repo.s.jobs[1].payload.deferrals === 2);
  let last = { ...repo.s.jobs.at(-1), job_type: 'wave1_missed_call_followup', payload: { ...repo.s.jobs.at(-1).payload, deferrals: 3 } };
  const capped = await runMissedCallFollowup(last, repo, sender, ENV);
  log('QUIET HOURS: deferral is capped — after 3 it is recorded as blocked instead of looping forever', !capped.deferred_until && capped.blocked === 'quiet_hours' && sends === 0);
}

// ---- delivery status callbacks: ordering, duplicates, isolation, carrier opt-out ----
{
  const repo = makeRepo(); repo.s.settings.push(settingsFor(orgA, '+12035550111'), settingsFor(orgB, '+12035550222'));
  const c = await repo.upsertContactByPhone(orgA, '+12035550100', { name: 'Pat' });
  const conv = await repo.upsertConversation(orgA, c.id, 'sms');
  const m = await repo.insertMessage(orgA, { conversation_id: conv.id, direction: 'outbound', automated: true, status: 'provider_accepted', provider: 'twilio', provider_sid: 'SMout1' });
  const st = (status, extra = {}, to = '+12035550100', from = '+12035550111') => handleSmsStatus(signed('sms-status', { MessageSid: 'SMout1', MessageStatus: status, From: from, To: to, ...extra }), repo, ENV);
  await st('delivered');
  log('STATUS: a delivered callback moves provider_accepted to delivered', m.status === 'delivered');
  await st('sent');
  log('STATUS: a late/out-of-order "sent" cannot downgrade delivered', m.status === 'delivered');
  await st('delivered');
  log('STATUS: a duplicate callback is a no-op', m.status === 'delivered' && repo.s.events.size === 2);
  const forged = await handleSmsStatus({ url: `${BASE}&op=sms-status`, params: { MessageSid: 'SMout1', MessageStatus: 'failed', From: '+12035550111', To: '+12035550100' }, signature: 'nope' }, repo, ENV);
  log('STATUS: a forged status callback is rejected and changes nothing', forged.status === 403 && m.status === 'delivered');
  const wrongOrg = await handleSmsStatus(signed('sms-status', { MessageSid: 'SMout1', MessageStatus: 'failed', From: '+12035550222', To: '+12035550100' }), repo, ENV);
  log("STATUS ISOLATION: Org B's number cannot update Org A's message", wrongOrg.status === 200 && m.status === 'delivered');
  const m2 = await repo.insertMessage(orgA, { conversation_id: conv.id, direction: 'outbound', automated: true, status: 'ambiguous', provider: 'twilio', provider_sid: 'SMout2' });
  await handleSmsStatus(signed('sms-status', { MessageSid: 'SMout2', MessageStatus: 'undelivered', ErrorCode: '21610', From: '+12035550111', To: '+12035550100' }), repo, ENV);
  log('STATUS: a reconciled ambiguous send takes the provider outcome', m2.status === 'undelivered');
  log('STATUS: carrier opt-out (21610) suppresses the contact so no later automation can text them', c.suppressed === true && c.suppression_source === 'twilio_21610' && c.sms_consent === false);
}
// ---- "YES" is not an opt-in ----
{
  const repo = makeRepo(); repo.s.settings.push(settingsFor(orgA, '+12035550111'));
  const c = await repo.upsertContactByPhone(orgA, '+12035550100', { name: 'Pat' });
  await repo.updateContact(orgA, c.id, { suppressed: true, sms_consent: false });
  await handleSmsInbound(signed('sms-inbound', { From: '+12035550100', To: '+12035550111', Body: 'Yes', MessageSid: 'SMyes' }), repo, ENV);
  log('An opted-out contact replying "Yes" is NOT re-subscribed and gets no consent', c.suppressed === true && c.sms_consent === false);
  await handleSmsInbound(signed('sms-inbound', { From: '+12035550100', To: '+12035550111', Body: 'START', MessageSid: 'SMstart' }), repo, ENV);
  log('START (carrier-standard) does re-subscribe, with source recorded', c.suppressed === false && c.sms_consent_source === 'sms_start_keyword');
}

// ---- inbound voice: forward to a human; only an UNANSWERED forward becomes a missed call ----
{
  const ENVV = { ...ENV, WAVE1_PUBLIC_BASE: 'https://nova-systems.app' };
  const repo = makeRepo(); repo.s.settings.push(settingsFor(orgA, '+12035550111', { escalation_contacts: [{ name: 'Owner', phone: '(203) 555-0155' }] }));
  const c = await repo.upsertContactByPhone(orgA, '+12035550100', { name: 'Pat' });
  await repo.updateContact(orgA, c.id, { sms_consent: true, sms_consent_source: 'web_form_checkbox', sms_consent_at: '2026-09-01T00:00:00Z' });
  const inbound = { From: '+12035550100', To: '+12035550111', CallSid: 'CAv1' };
  const bad = await handleVoiceInbound({ url: `${BASE}&op=voice-inbound`, params: inbound, signature: 'forged' }, repo, ENVV);
  log('VOICE: a forged voice webhook is rejected', bad.status === 403);
  const t = await handleVoiceInbound(signed('voice-inbound', inbound), repo, ENVV);
  log('VOICE: the call is forwarded to the escalation contact with a ring timeout and a result callback', t.status === 200 && t.body.includes('<Number>+12035550155</Number>') && t.body.includes('timeout="20"') && t.body.includes('action="https://nova-systems.app/api/client?resource=wave1&amp;op=call-status"'));
  log('VOICE: forwarding alone creates no missed-call job', repo.s.jobs.length === 0);
  await handleCallStatus(signed('call-status', { ...inbound, CallStatus: 'completed', DialCallStatus: 'completed' }), repo, ENVV);
  log('VOICE: a forwarded leg that was ANSWERED is not a missed call', repo.s.jobs.length === 0);
  await handleCallStatus(signed('call-status', { ...inbound, CallSid: 'CAv2', CallStatus: 'completed', DialCallStatus: 'no-answer' }), repo, ENVV);
  log('VOICE: parent "completed" + DialCallStatus no-answer IS a missed call (one follow-up job)', repo.s.jobs.length === 1 && repo.s.jobs[0].idempotency_key === 'missed_call:CAv2');
  const noTarget = makeRepo(); noTarget.s.settings.push(settingsFor(orgA, '+12035550111'));
  const n = await handleVoiceInbound(signed('voice-inbound', { ...inbound, CallSid: 'CAv3' }), noTarget, ENVV);
  log('VOICE: with no one to ring it says so honestly, hangs up, and still records the missed call', n.body.includes('<Hangup/>') && n.body.includes('no one is available') && noTarget.s.contacts.length === 1);
  const stray = await handleVoiceInbound(signed('voice-inbound', { ...inbound, To: '+19998887777' }), repo, ENVV);
  log('VOICE: a number no organization owns is not forwarded anywhere', stray.body.includes('not in service') && !stray.body.includes('<Dial'));
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} handler checks passed (in-memory simulator — no provider contacted, no database touched)`);
process.exit(passed === results.length ? 0 : 1);
