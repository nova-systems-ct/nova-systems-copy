// The customer's side of the journey (api/_journey.js). One page: it shows whatever step the
// agents are waiting on and sends the customer's answer back. The private link token lives only
// in this browser tab's session storage.
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const org = params.get('org') || '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key = `nova_journey_${org}`;
let session = null;
let busy = false;

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
const showError = (text) => { $('error').textContent = text; $('error').hidden = !text; };
const dollars = (cents) => `$${(cents / 100).toFixed(2)}`;
const when = (iso) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso));

async function send(op, body) {
  if (busy) return null;
  busy = true; showError(''); document.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  try {
    const r = await fetch(`/api/client?resource=journey&op=${op}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(session || {}), ...body }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { showError(data.error || 'That did not go through. Please try again.'); return null; }
    return data;
  } catch { showError('The connection dropped. Check your internet and try again.'); return null; }
  finally { busy = false; document.querySelectorAll('button').forEach((b) => { b.disabled = false; }); }
}
const act = async (op, body) => { const data = await send(op, body); if (data?.next) render(data.next); };

function render(next) {
  $('start').hidden = true;
  const box = $('step'); box.replaceChildren(); box.hidden = false;
  box.append(el('p', next.message));
  const choice = (label, small, onClick) => { const b = el('button', label, 'choice'); b.type = 'button'; if (small) b.append(el('small', small)); b.addEventListener('click', onClick); box.append(b); };
  if (next.reason === 'choose_service') for (const o of next.options) choice(o.name, o.description, () => act('choose-service', { service_id: o.service_id }));
  if (next.reason === 'accept_quote') {
    box.append(el('pre', next.quote.text));
    const label = el('label', 'Type your full name to accept this quote'); label.htmlFor = 'typed';
    const input = el('input'); input.id = 'typed'; input.maxLength = 120; input.autocomplete = 'name';
    const go = el('button', `Accept ${dollars(next.quote.total_cents)}`); go.type = 'button';
    go.addEventListener('click', () => (input.value.trim().length < 2 ? showError('Type your full name to accept.') : act('accept', { quote_id: next.quote.id, typed_name: input.value })));
    box.append(label, input, go);
  }
  if (next.invoice) box.append(el('pre', next.invoice.text), el('p', 'No payment is taken on this page.', 'note'));
  if (next.reason === 'choose_time') for (const o of next.options) choice(when(o.start_at), null, () => act('choose-time', { slot_id: o.slot_id }));
  if (!['closed', 'cancelled'].includes(next.stage)) {
    const again = el('button', 'Check for updates', 'quiet'); again.type = 'button'; again.addEventListener('click', () => act('status', {})); box.append(again);
    if (['inquiry', 'qualified', 'quoted', 'scheduling', 'scheduled'].includes(next.stage)) { const c = el('button', 'Cancel my request', 'quiet'); c.type = 'button'; c.style.marginLeft = '8px'; c.addEventListener('click', () => act('cancel', {})); box.append(c); }
  } else { try { sessionStorage.removeItem(key); } catch { /* storage unavailable */ } }
}

if (!UUID.test(org)) {
  showError('This link is missing the business it belongs to. Ask the business for their link.');
} else {
  try { session = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { session = null; }
  if (params.get('code')) $('offer').value = params.get('code').slice(0, 40);
  const submission = crypto.randomUUID();
  $('start').addEventListener('submit', async (event) => {
    event.preventDefault();
    const f = new FormData($('start'));
    if (!String(f.get('email')).trim() && !String(f.get('phone')).trim()) return showError('Enter an email or a phone number.');
    const data = await send('start', { organization_id: org, submission_id: submission, name: f.get('name'), email: f.get('email'), phone: f.get('phone'), message: f.get('message'), offer_code: f.get('offer_code'), website_url_confirm: f.get('website_url_confirm') });
    if (!data) return;
    if (data.token) { session = { journey_id: data.journey_id, token: data.token }; try { sessionStorage.setItem(key, JSON.stringify(session)); } catch { /* storage unavailable */ } }
    if (data.next) render(data.next);
  });
  if (session?.journey_id && session.token) act('status', {}).then(() => { if ($('step').hidden) { session = null; $('start').hidden = false; } });
  else $('start').hidden = false;
}
