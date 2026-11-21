// The private rating link a customer gets after a paid job (api/_reviews.js).
const $ = (id) => document.getElementById(id);
const token = new URLSearchParams(location.search).get('t') || '';
const showError = (t) => { $('error').textContent = t || ''; $('error').hidden = !t; };
let rating = 0;
async function send(op, body = {}) {
  const r = await fetch(`/api/client?resource=journey&op=${op}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token, ...body }) }).catch(() => null);
  if (!r) { showError('No connection. Please try again.'); return null; }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { showError(data.error || 'That did not go through. Please try again.'); return null; }
  return data;
}
function finish(data) {
  $('form').hidden = true; const box = $('done'); box.replaceChildren(); box.hidden = false;
  const p = document.createElement('p'); p.textContent = data.message; box.append(p);
  if (data.review_url) { const a = document.createElement('a'); a.className = 'review'; a.href = data.review_url; a.rel = 'noopener'; a.textContent = 'Leave a review'; box.append(a); }
}
if (!/^[0-9a-f]{48}$/.test(token)) showError('This link is not complete.');
else send('rate-info').then((info) => {
  if (!info) return;
  $('biz').textContent = info.business; document.title = `How did we do? | ${info.business}`;
  if (info.already_rated) { $('q').textContent = 'Thank you'; finish({ message: 'We already have your rating for this job.' }); return; }
  $('what').textContent = `Your ${info.service}: 1 means poor, 5 means excellent.`;
  const stars = document.querySelector('.stars');
  for (let n = 1; n <= 5; n++) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = String(n); b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', `${n} out of 5`);
    b.addEventListener('click', () => { rating = n; stars.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.textContent) === n))); $('send').disabled = false; });
    stars.append(b);
  }
  $('form').hidden = false;
  $('send').addEventListener('click', async () => { $('send').disabled = true; const out = await send('rate-link', { rating, comment: $('comment').value }); if (out) finish(out); else $('send').disabled = false; });
});
