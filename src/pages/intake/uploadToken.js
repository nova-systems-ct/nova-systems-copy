// One short-lived, server-signed upload token per intake session. Files uploaded with it land under
// a private, random prefix; the submission may only reference files from that same prefix.
const KEY = 'nova_intake_upload_token';

export async function getUploadToken() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (cached?.token && cached.until > Date.now()) return cached.token;
  } catch { /* storage unavailable — fetch a fresh one */ }
  const res = await fetch('/api/business-intake?action=upload-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.upload_token) throw new Error(data.error || 'Uploads are not available right now.');
  try { sessionStorage.setItem(KEY, JSON.stringify({ token: data.upload_token, until: Date.now() + (data.expires_in - 300) * 1000 })); } catch { /* non-fatal */ }
  return data.upload_token;
}

export function currentUploadToken() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null')?.token || null; } catch { return null; }
}
