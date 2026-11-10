import { SERVICE_SMS_POLICY } from './policy.js';

const $ = id => document.getElementById(id);
const form = $('service-form');
const testMode = new URLSearchParams(location.search).get('test') === '1';
const sessionKey = testMode ? 'nova_launch_test_receipt' : 'nova_launch_receipt';
const renderedAt = Date.now();
const reference = crypto.randomUUID();
const managementToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
const formatTime = value => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value));
let busy = false;
let receipt = null;
$('disclosure').textContent = SERVICE_SMS_POLICY.text;
$('test-banner').hidden = !testMode;
setTimeout(() => { if (!busy) { $('submit').disabled = false; $('submit').textContent = 'Send request'; } }, 2100);

function persist() { try { sessionStorage.setItem(sessionKey, JSON.stringify(receipt)); } catch { /* Receipt remains available in this page. */ } }
function showReceipt(saved) {
  receipt = saved;
  form.hidden = true;
  const helper=$('local-ai-helper');if(helper)helper.hidden=true;
  window.dispatchEvent(new Event('nova-request-saved'));
  $('confirmation').hidden = false;
  const booked = saved.state === 'booked' && saved.booking;
  const cancelled = saved.state === 'cancelled';
  $('result-title').textContent = cancelled ? 'Your request is cancelled.' : booked ? 'Your call is booked.' : 'Your request is saved.';
  $('booking-detail').textContent = booked ? formatTime(saved.booking.starts_at) : '';
  $('booking-detail').hidden = !booked;
  $('result-detail').textContent = cancelled ? 'Your request and follow-up task are cancelled. Any reserved appointment time has been released.'
    : booked ? 'Your selected time is reserved in Nova’s calendar. Nova will call the phone number you provided.'
      : 'Nova has your service request and a follow-up task. An appointment has not been booked; the team will arrange a time with you.';
  $('result-consent').textContent = saved.service_sms_consent ? 'Your optional permission for service texts was recorded. It does not include marketing. Reply STOP to end service texts or HELP for support.' : 'Your request was recorded without SMS permission.';
  $('worker-steps').replaceChildren();
  for (const step of saved.steps || []) {
    const item = document.createElement('li');
    item.textContent = step.label;
    if (step.status !== 'completed') item.className = 'pending';
    $('worker-steps').append(item);
  }
  $('reference').textContent = `Request reference: ${saved.reference}`;
  $('download-calendar').hidden = !booked;
  $('cancel-request').hidden = cancelled;
  $('cancel-request').textContent = booked ? 'Cancel this appointment' : 'Cancel this request';
  const again = document.querySelector('.secondary-link');
  again.href = testMode ? '/service-request?test=1&new=1' : '/service-request?new=1';
  $('result-title').tabIndex = -1;
  $('result-title').focus();
}
async function availability() {
  try {
    const r = await fetch(`/api/book-meeting?action=availability${testMode ? '&test=1' : ''}`, { cache: 'no-store' });
    const data = await r.json();
    if (!r.ok || data.ok !== true || !Array.isArray(data.slots)) throw new Error();
    $('slot-options').replaceChildren();
    for (const slot of data.slots) {
      const label = document.createElement('label'); label.className = 'slot-choice';
      const input = document.createElement('input'); input.type = 'radio'; input.name = 'slot_id'; input.value = slot.id;
      const text = document.createElement('span'); text.textContent = formatTime(slot.starts_at);
      const duration = document.createElement('small'); duration.textContent = `${Math.round((Date.parse(slot.ends_at) - Date.parse(slot.starts_at)) / 60000)}-minute phone appointment`;
      text.append(duration); label.append(input, text); $('slot-options').append(label);
    }
    $('availability-status').textContent = data.slots.length ? 'Choose one of Nova’s published times.' : 'No open times are published right now. Send your request and Nova will arrange a time.';
  } catch { $('availability-status').textContent = 'Available times could not be loaded. You can still send your request without an appointment.'; }
}
form.addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  $('error').hidden = true;
  const fields = new FormData(form);
  const slot = fields.get('slot_id') || null;
  if (slot && !String(fields.get('phone') || '').trim()) {
    $('error').textContent = 'Enter a phone number for your phone appointment, or choose “Arrange a time with Nova”.'; $('error').hidden = false; $('phone').focus(); return;
  }
  busy = true; $('submit').disabled = true; $('submit').textContent = slot ? 'Reserving your time…' : 'Completing your request…';
  try {
    const r = await fetch('/api/book-meeting', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_type: 'launch_worker_request', submission_id: reference, management_token: managementToken,
        rendered_at: renderedAt, name: fields.get('name'), business_name: fields.get('business_name'), email: fields.get('email'),
        phone: fields.get('phone'), message: fields.get('message'), service_key: fields.get('service_key'), slot_id: slot, test_mode: testMode,
        website_url_confirm: fields.get('website_url_confirm'), service_sms_consent: $('service-sms').checked, service_sms_consent_version: SERVICE_SMS_POLICY.version }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.ok !== true || data.reference !== reference) {
      if (data.code === 'slot_unavailable') { await availability(); form.querySelector('input[name="slot_id"][value=""]').checked = true; }
      throw new Error(data.error || 'Your request could not be confirmed. Please retry or email isaac@nova-systems.app.');
    }
    showReceipt({ ...data, management_token: managementToken }); persist();
  } catch (e) { $('error').textContent = e.message; $('error').hidden = false; }
  finally { busy = false; $('submit').disabled = false; $('submit').textContent = 'Send request'; }
});
$('cancel-request').addEventListener('click', async () => {
  if (!receipt || busy) return;
  busy = true; $('cancel-request').disabled = true; $('manage-error').hidden = true;
  try {
    const r = await fetch('/api/book-meeting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_type: 'launch_cancel', submission_id: receipt.reference, management_token: receipt.management_token }) });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Cancellation could not be confirmed. Please try again.');
    const steps = [...(receipt.steps || []), { label: 'Request cancelled and appointment released', status: 'completed' }];
    showReceipt({ ...receipt, state: 'cancelled', booking: null, steps }); persist();
  } catch (e) { $('manage-error').textContent = e.message; $('manage-error').hidden = false; }
  finally { busy = false; $('cancel-request').disabled = false; }
});
$('download-calendar').addEventListener('click', () => {
  if (receipt?.state !== 'booked' || !receipt.booking) return;
  const stamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nova Systems//Booking//EN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${receipt.reference}@nova-systems.app`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(receipt.booking.starts_at)}`, `DTEND:${stamp(receipt.booking.ends_at)}`,
    `SUMMARY:${testMode ? 'TEST — ' : ''}Nova Systems introduction`, 'LOCATION:Phone appointment', `DESCRIPTION:Nova will call the number provided. Reference ${receipt.reference}.`, 'END:VEVENT', 'END:VCALENDAR', ''];
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `nova-appointment-${receipt.reference}.ics`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
try {
  if (new URLSearchParams(location.search).get('new') === '1') {
    sessionStorage.removeItem(sessionKey);
    const clean = new URL(location.href); clean.searchParams.delete('new'); history.replaceState(null, '', clean);
  }
  const previous = JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
  if (previous?.reference && previous.management_token && Array.isArray(previous.steps)) showReceipt(previous);
} catch { /* Private browsing may disable session storage. */ }
if (!receipt) availability();
