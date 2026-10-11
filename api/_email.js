// One Resend call used by the legacy handlers. RESEND_API_URL lets local tests point at the
// stand-in (scripts/testenv/stubs.mjs) instead of the real provider; production leaves it unset.
export const resendBase = () => (process.env.RESEND_API_URL || 'https://api.resend.com').replace(/\/$/, '');
export const NOVA_FROM = 'Nova Systems <noreply@nova-systems.app>';

// Returns { ok, status, id?, skipped? }. Never throws.
export async function sendEmail({ to, subject, text, html, reply_to, attachments, idempotencyKey }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true, status: 0 };
  try {
    const r = await fetch(`${resendBase()}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      body: JSON.stringify({ from: NOVA_FROM, to: Array.isArray(to) ? to : [to], subject, ...(text ? { text } : {}), ...(html ? { html } : {}), ...(reply_to ? { reply_to } : {}), ...(attachments ? { attachments } : {}) }),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, id: j.id || null };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}
