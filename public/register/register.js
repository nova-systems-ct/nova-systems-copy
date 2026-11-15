const form = document.getElementById('reg'), err = document.getElementById('error'), send = document.getElementById('send');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  err.hidden = true; send.disabled = true;
  const f = new FormData(form), body = Object.fromEntries(f.entries());
  body.agree = form.agree.checked;
  try {
    const r = await fetch('/api/client?resource=register&op=request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Your registration could not be sent. Please try again.');
    form.hidden = true; document.getElementById('done').hidden = false;
  } catch (x) {
    err.textContent = x.message === 'Failed to fetch' ? 'Your registration could not be sent. Check your connection and try again.' : x.message;
    err.hidden = false; send.disabled = false;
  }
});
