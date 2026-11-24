// A worker's phone page (api/_team.js). The private link token in the address is the worker's
// only key; it is sent with every request and never stored by this page.
const $ = (id) => document.getElementById(id);
const token = new URLSearchParams(location.search).get('t') || '';
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
const showError = (text) => { $('error').textContent = text || ''; $('error').hidden = !text; };
const when = (iso) => (iso ? new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : 'Time not set yet');
const phone = (p) => (/^\+1\d{10}$/.test(p) ? `(${p.slice(2, 5)}) ${p.slice(5, 8)}-${p.slice(8)}` : p);
let busy = false;

// A phone photo made small enough to send (about 1600 pixels on the long side, JPEG).
async function shrink(file) {
  try {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.82, 0.7, 0.55]) { const url = c.toDataURL('image/jpeg', q); if (url.length * 0.75 < 2_400_000) return url; }
    return null;
  } catch { return null; }
}

async function send(op, body = {}) {
  if (busy) return null;
  busy = true; showError(''); document.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  try {
    const r = await fetch(`/api/client?resource=journey&op=${op}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token, ...body }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { showError(data.error || 'That did not go through. Try again.'); return null; }
    return data;
  } catch { showError('No connection. Check your signal and try again.'); return null; }
  finally { busy = false; document.querySelectorAll('button').forEach((b) => { b.disabled = false; }); }
}

function render(data) {
  $('who').textContent = `Hello, ${data.worker.name.split(' ')[0]}`;
  const box = $('jobs'); box.replaceChildren();
  if (!data.jobs.length) { box.append(el('p', 'No jobs assigned to you right now.', 'note')); return; }
  for (const job of data.jobs) {
    const card = el('article', null, `job${job.status === 'done' ? ' done' : ''}`);
    card.append(el('h2', job.service), el('p', when(job.start_at), 'when'));
    const who = el('p'); who.append(`${job.customer}`);
    if (job.customer_phone) { const a = el('a', phone(job.customer_phone)); a.href = `tel:${job.customer_phone}`; who.append(' · ', a); }
    card.append(who);
    if (job.address) { const p = el('p'); const a = el('a', job.address); a.href = `https://maps.apple.com/?q=${encodeURIComponent(job.address)}`; a.rel = 'noopener'; p.append(a); card.append(p); }
    if (job.request) card.append(el('p', `“${job.request}”`, 'muted'));
    // Before and after photos go to the business privately; at most 12 a job.
    const photos = el('div', null, 'photos');
    for (const kind of ['before', 'after']) {
      const pick = el('label', kind === 'before' ? 'Before photo' : 'After photo', 'photo-btn');
      const input = el('input'); input.type = 'file'; input.accept = 'image/*'; input.setAttribute('capture', 'environment'); input.hidden = true;
      input.addEventListener('change', async () => {
        const file = input.files && input.files[0]; input.value = '';
        if (!file) return;
        const image = await shrink(file);
        if (!image) return showError('That photo could not be read. Try another one.');
        const out = await send('crew-photo', { assignment_id: job.assignment_id, kind, image });
        if (out) render(out);
      });
      pick.append(input); photos.append(pick);
    }
    photos.append(el('span', `${job.photos || 0} photo${job.photos === 1 ? '' : 's'} saved`, 'muted'));
    card.append(photos);
    if (job.status === 'done') card.append(el('span', 'Done', 'badge'));
    else if (job.can_mark_done) {
      const id = `note-${job.assignment_id}`;
      const label = el('label', 'What you did (a sentence or two)'); label.htmlFor = id;
      const note = el('textarea'); note.id = id; note.maxLength = 2000;
      const done = el('button', 'Done'); done.type = 'button';
      done.addEventListener('click', async () => {
        if (note.value.trim().length < 10) return showError('Write a sentence about what you did before pressing Done.');
        const out = await send('crew-done', { assignment_id: job.assignment_id, note: note.value });
        if (out) render(out);
      });
      card.append(label, note, done);
    } else card.append(el('p', 'You can mark this done once it is booked for a time.', 'note'));
    box.append(card);
  }
}

async function load() { const data = await send('crew-jobs'); if (data) render(data); }
$('refresh').addEventListener('click', load);
if (!/^[0-9a-f]{64}$/.test(token)) showError('This link is not complete. Ask the business to send it again.');
else load();
