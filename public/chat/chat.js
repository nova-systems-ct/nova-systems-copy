// Website chat (api/_webChat.js), shown in a frame on the business's website. The visitor's key is a
// random value kept in this browser only; the server stores just its hash.
const $ = (id) => document.getElementById(id);
const slug = (new URLSearchParams(location.search).get('b') || '').toLowerCase();
const storeKey = `nova_chat_${slug}`;
let key = null, busy = false, lastId = '', pending = null, polls = 0, timer = null;

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
const note = (text) => { $('log').append(el('p', text, 'note')); $('log').scrollTop = $('log').scrollHeight; };

function loadKey() {
  try { key = localStorage.getItem(storeKey); } catch { key = null; }
  if (/^[0-9a-f]{64}$/.test(key || '')) return;
  const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
  key = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  try { localStorage.setItem(storeKey, key); } catch { /* storage blocked: this conversation lasts until the page closes */ }
}

async function api(op, body = {}) {
  const r = await fetch(`/api/client?resource=journey&op=${op}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ b: slug, k: key, ...body }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

let greeting = '';
function render(messages) {
  const newest = messages.length ? messages[messages.length - 1].id : '';
  if (newest && newest === lastId) return;
  lastId = newest;
  const log = $('log'); log.replaceChildren();
  if (greeting) { const g = el('div', null, 'msg them'); g.append(el('span', 'Assistant', 'who'), document.createTextNode(greeting)); log.append(g); }
  for (const m of messages) {
    const b = el('div', null, `msg ${m.from === 'you' ? 'you' : 'them'}`);
    if (m.from !== 'you') b.append(el('span', m.from === 'team' ? 'Team' : 'Assistant', 'who'));
    b.append(document.createTextNode(m.text));
    log.append(b);
  }
  log.scrollTop = log.scrollHeight;
}
async function refresh() { try { render((await api('chat-history')).messages || []); } catch { /* try again on the next check */ } }

// While the chat is open, check now and then for a reply from the team (for up to 30 minutes).
function poll() {
  clearTimeout(timer);
  if (polls++ > 225) return;
  timer = setTimeout(async () => { if (!document.hidden) await refresh(); poll(); }, 8000);
}

async function send(text) {
  if (busy) return;
  busy = true; $('send').disabled = true;
  pending = pending && pending.text === text ? pending : { id: crypto.randomUUID(), text }; // a retry reuses the id, so it is not answered twice
  try {
    const out = await api('chat', { id: pending.id, text });
    pending = null; $('text').value = '';
    await refresh();
    if (out.passed_to_team) note('Thanks. A team member will reply here.');
    polls = 0; poll();
  } catch (err) { note(err.message); }
  finally { busy = false; $('send').disabled = false; $('text').focus(); }
}

if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) note('This chat link is not valid.');
else {
  api('chat-open').then((d) => {
    $('name').textContent = d.business?.name || 'Chat';
    document.title = `Chat | ${d.business?.name || ''}`;
    if (!d.open) return note('Chat is not available right now. Please call or use the request form on the website.');
    greeting = d.greeting || '';
    loadKey();
    render([]); refresh(); poll();
    $('form').hidden = false;
    $('form').addEventListener('submit', (e) => { e.preventDefault(); const t = $('text').value.trim(); if (t) send(t); });
    $('text').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('form').requestSubmit(); } });
  }).catch((err) => note(err.message));
}
