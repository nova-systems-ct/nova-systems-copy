import { SERVICE_SMS_POLICY } from './policy.js';

const form = document.querySelector('#service-form');
const submit = document.querySelector('#submit');
const error = document.querySelector('#error');
const renderedAt = Date.now();
const submissionId = crypto.randomUUID();
let busy = false;
document.querySelector('#disclosure').textContent = SERVICE_SMS_POLICY.text;
submit.textContent = 'Send request';
// Respect the server's short anti-spam window before accepting a fast autofill.
setTimeout(() => { if (!busy) submit.disabled = false; }, 2100);
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  error.hidden = true;
  const fields = new FormData(form);
  busy = true; submit.disabled = true; submit.textContent = 'Saving request…';
  try {
    const response = await fetch('/api/book-meeting', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_type: 'service_sms_request', submission_id: submissionId, rendered_at: renderedAt,
        name: fields.get('name'), business_name: fields.get('business_name'), email: fields.get('email'), phone: fields.get('phone'), message: fields.get('message'),
        website_url_confirm: fields.get('website_url_confirm'), service_sms_consent: document.querySelector('#service-sms').checked,
        service_sms_consent_version: SERVICE_SMS_POLICY.version }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true || result.reference !== submissionId) throw new Error(result.error || 'Your request could not be confirmed. Please try again or email isaac@nova-systems.app.');
    document.querySelector('#result-detail').textContent = result.duplicate
      ? 'This request was already received. Your earlier SMS choice remains unchanged.'
      : result.service_sms_consent
        ? 'Your permission for service texts about this request was recorded. It does not include promotional texts. Reply STOP to end service texts or HELP for support.'
        : 'Your request was recorded without SMS permission. We will use your email to follow up.';
    document.querySelector('#reference').textContent = `Request reference: ${result.reference}`;
    form.hidden = true;
    document.querySelector('#confirmation').hidden = false;
    document.querySelector('#result-title').setAttribute('tabindex', '-1');
    document.querySelector('#result-title').focus();
  } catch (cause) {
    error.textContent = cause.message; error.hidden = false;
  } finally {
    busy = false; submit.disabled = false; submit.textContent = 'Send request';
  }
});
