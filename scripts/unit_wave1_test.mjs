// Logic-only tests for api/_wave1.js. These prove RULES, not a working integration: no provider is
// contacted, nothing is sent. The Twilio signature test uses the algorithm's documented shape with
// a fixed fake token — it proves our verifier is self-consistent and rejects tampering, NOT that a
// real Twilio request has been accepted (that needs a deployed webhook URL + a real call/SMS).
import { twilioSignature, verifyTwilioSignature, normalizePhone, classifyInboundKeyword, evaluateSendEligibility, isMissedCallStatus, classifySendOutcome, validateFormSubmission, localHour } from '../api/_wave1.js';

const results = [];
const log = (name, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`); results.push(pass); };

// ---- signature ----
const url = 'https://nova-systems.app/api/client?resource=wave1&op=sms-inbound';
const params = { MessageSid: 'SM1', From: '+12035550100', Body: 'Hello' };
const sig = twilioSignature(url, params, 'test-token');
log('A correctly signed request verifies', verifyTwilioSignature({ url, params, signature: sig, authToken: 'test-token' }));
log('A tampered body is rejected', !verifyTwilioSignature({ url, params: { ...params, Body: 'Hacked' }, signature: sig, authToken: 'test-token' }));
log('A different URL is rejected', !verifyTwilioSignature({ url: url + '&x=1', params, signature: sig, authToken: 'test-token' }));
log('A wrong token is rejected', !verifyTwilioSignature({ url, params, signature: sig, authToken: 'other' }));
log('A missing signature/token is rejected, never treated as valid', !verifyTwilioSignature({ url, params, signature: '', authToken: 'test-token' }) && !verifyTwilioSignature({ url, params, signature: sig, authToken: '' }));

// ---- phone + keywords ----
log('US numbers normalize to E.164', normalizePhone('(203) 555-0100') === '+12035550100' && normalizePhone('1-203-555-0100') === '+12035550100' && normalizePhone('+44 20 7946 0958') === '+442079460958');
log('Garbage numbers normalize to null', normalizePhone('555') === null && normalizePhone('') === null);
log('STOP-class keywords classify as opt_out (case/punctuation-insensitive)', ['stop', ' STOP.', 'Unsubscribe', 'cancel', 'END', 'quit', 'stopall'].every((w) => classifyInboundKeyword(w) === 'opt_out'));
log('START/HELP classify correctly; ordinary text is a message', classifyInboundKeyword('START') === 'opt_in' && classifyInboundKeyword('help') === 'help' && classifyInboundKeyword('please stop by tomorrow') === 'message');

// ---- eligibility ----
const noon = new Date('2026-09-24T16:00:00Z'); // 12:00 in America/New_York (EDT)
const base = {
  now: noon, purpose: 'missed_call',
  contact: { phone_e164: '+12035550100', sms_consent: true, sms_consent_source: 'web_form', sms_consent_at: '2026-09-01T00:00:00Z' },
  org: { timezone: 'America/New_York', paused: false, channels_paused: [] },
  conversation: {},
};
log('A consented contact in business hours is eligible', evaluateSendEligibility(base).allowed === true);
log('A number with NO recorded consent is blocked — "a number exists" is not consent', evaluateSendEligibility({ ...base, contact: { phone_e164: '+12035550100' } }).reason === 'no_recorded_consent');
log('Consent without a source/timestamp is blocked', evaluateSendEligibility({ ...base, contact: { ...base.contact, sms_consent_source: null } }).reason === 'no_recorded_consent');
log('OPT-OUT: a suppressed contact is blocked even with prior consent', evaluateSendEligibility({ ...base, contact: { ...base.contact, suppressed: true } }).reason === 'suppressed_opt_out');
log('Organization pause blocks', evaluateSendEligibility({ ...base, org: { ...base.org, paused: true } }).reason === 'organization_paused');
log('Per-channel pause blocks that channel only', evaluateSendEligibility({ ...base, org: { ...base.org, channels_paused: ['sms'] } }).reason === 'channel_paused' && evaluateSendEligibility({ ...base, org: { ...base.org, channels_paused: ['email'] } }).allowed === true);
log('Staff takeover blocks automation', evaluateSendEligibility({ ...base, conversation: { staff_takeover: true } }).reason === 'staff_takeover');
log('A contact reply stops automated follow-up', evaluateSendEligibility({ ...base, conversation: { contact_replied_since_trigger: true } }).reason === 'contact_replied');
log('A confirmed booking stops missed-call/inquiry follow-up', evaluateSendEligibility({ ...base, conversation: { appointment_confirmed: true } }).reason === 'already_booked');
const night = new Date('2026-09-25T02:30:00Z'); // 22:30 EDT
log('Quiet hours block (timezone-correct)', evaluateSendEligibility({ ...base, now: night }).reason === 'quiet_hours');
log('A direct reply is allowed during quiet hours', evaluateSendEligibility({ ...base, now: night, purpose: 'reply' }).allowed === true);
log('Unknown timezone BLOCKS rather than guessing', evaluateSendEligibility({ ...base, org: { ...base.org, timezone: undefined } }).reason === 'timezone_not_configured');
log('DST: same UTC hour maps to a different local hour in winter (EST) vs summer (EDT)', localHour(new Date('2026-07-01T16:00:00Z'), 'America/New_York') === 12 && localHour(new Date('2026-12-01T16:00:00Z'), 'America/New_York') === 11);
log('Frequency limit blocks', evaluateSendEligibility({ ...base, recentAutomatedCount: 3 }).reason === 'frequency_limit');
log('Minimum gap blocks a rapid second send', evaluateSendEligibility({ ...base, lastAutomatedAt: new Date(noon - 2 * 60_000).toISOString() }).reason === 'min_gap');

// ---- provider outcomes, missed call, forms ----
log('Missed-call statuses detected; completed/in-progress are not', ['no-answer', 'busy', 'failed', 'canceled'].every(isMissedCallStatus) && !isMissedCallStatus('completed') && !isMissedCallStatus('in-progress'));
log('AMBIGUOUS OUTCOME: timeout/5xx is neither success nor failure — must be reconciled before retry', classifySendOutcome({ httpStatus: 503 }) === 'ambiguous_reconcile' && classifySendOutcome({ error: 'timeout' }) === 'ambiguous_reconcile' && classifySendOutcome({ httpStatus: 201 }) === 'provider_accepted' && classifySendOutcome({ httpStatus: 400 }) === 'rejected' && classifySendOutcome({ httpStatus: 429 }) === 'rate_limited_retry');
log('Form: honeypot and too-fast submissions are rejected', validateFormSubmission({ fields: { name: 'A', phone: '2035550100' }, honeypot: 'x' }).reason === 'spam_honeypot' && validateFormSubmission({ fields: { name: 'A', phone: '2035550100' }, renderedAtMs: 1000, submittedAtMs: 1500 }).reason === 'spam_too_fast');
const good = validateFormSubmission({ fields: { name: 'Pat', phone: '(203) 555-0100' }, renderedAtMs: 1000, submittedAtMs: 9000 });
log('Form: providing a phone number does NOT grant SMS consent — only the explicit checkbox does', good.ok && good.contact.sms_consent === false && validateFormSubmission({ fields: { name: 'Pat', phone: '2035550100', sms_consent: true }, renderedAtMs: 1, submittedAtMs: 9000 }).contact.sms_consent === true);
log('Form: requires a name and a phone or email', validateFormSubmission({ fields: { phone: '2035550100' } }).reason === 'name_required' && validateFormSubmission({ fields: { name: 'A' } }).reason === 'phone_or_email_required');

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} logic checks passed (logic only — no provider contacted, nothing sent)`);
process.exit(passed === results.length ? 0 : 1);
