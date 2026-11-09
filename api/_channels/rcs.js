// Google RCS for Business: authenticated Pub/Sub callbacks and the documented RBM text-message endpoint.
// Service-account credentials stay in server secrets. No provider request is made by parsing or normalization.
import crypto from 'node:crypto';
const id = value => typeof value === 'string' && /^[A-Za-z0-9._@-]{1,128}$/.test(value);
const phone = value => typeof value === 'string' && /^\+[1-9]\d{7,14}$/.test(value);
const same = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y); };
export function verifyRcsEnvelope(envelope, signature, clientToken) {
  try {
    const encoded = envelope?.message?.data;
    if (!clientToken || typeof encoded !== 'string' || encoded.length > 300000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
    const bytes = Buffer.from(encoded, 'base64');
    if (!same(signature, crypto.createHmac('sha512', clientToken).update(bytes).digest('base64'))) return null;
    return JSON.parse(bytes.toString('utf8'));
  } catch { return null; }
}
export function normalizeRcsEvent(event) {
  const preference={UNSUBSCRIBE:'STOP',SUBSCRIBE:'START'}[event?.eventType];
  if(event?.eventType&&!preference)return null;
  const eventId=preference?event?.eventId:event?.messageId;
  if (!id(event?.agentId) || !phone(event?.senderPhoneNumber) || typeof eventId !== 'string' || !eventId || eventId.length > 256 || !Number.isFinite(Date.parse(event.sendTime))) return null;
  const text = preference || (typeof event.text === 'string' ? event.text : null);
  if (text && text.length > 4000) throw Object.assign(Error('Message exceeds supported length'), { status: 413 });
  return { provider: 'android_rcs', account_id: event.agentId, sender_id: event.senderPhoneNumber, event_id: eventId, kind: text ? 'message' : 'unsupported', text: text || '[Unsupported RCS content: needs a person]', at: event.sendTime };
}
export function rcsMessageRequest({ agentId, recipientId, messageId, body, accessToken }) {
  if (!id(agentId) || !phone(recipientId) || !/^[0-9a-f-]{36}$/i.test(messageId || '') || typeof body !== 'string' || !body.trim() || Buffer.byteLength(body) > 3072 || !accessToken) throw Error('Invalid RCS message configuration');
  const url = new URL(`https://rcsbusinessmessaging.googleapis.com/v1/phones/${encodeURIComponent(recipientId)}/agentMessages`);
  url.searchParams.set('agentId', agentId); url.searchParams.set('messageId', messageId);
  return { url: url.href, method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: { contentMessage: { text: body }, messageTrafficType: 'SERVICEREQUEST', ttl: '3600s' } };
}
const tokenCache = new Map();
export async function rcsAccessToken(secret, { scope = 'rcsbusinessmessaging', fetchImpl = fetch, now = Date.now() } = {}) {
  if (!['rcsbusinessmessaging', 'businesscommunications'].includes(scope)) throw Error('Unsupported Google scope');
  let credentials; try { credentials = JSON.parse(secret); } catch { throw Error('Store a scoped Google service-account JSON key in the server secret'); }
  if (!/^[\w.+-]+@[\w.-]+\.iam\.gserviceaccount\.com$/.test(credentials.client_email || '') || !credentials.private_key) throw Error('Invalid Google service-account configuration');
  const cacheKey = crypto.createHash('sha256').update(secret + scope).digest('hex');
  const cached = tokenCache.get(cacheKey); if (cached && cached.until > now + 120000) return cached.token;
  const iat = Math.floor(now / 1000);
  const encoded = [{ alg: 'RS256', typ: 'JWT' }, { iss: credentials.client_email, scope: `https://www.googleapis.com/auth/${scope}`, aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }].map(x => Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
  const key = crypto.createPrivateKey(credentials.private_key); if (key.asymmetricKeyType !== 'rsa') throw Error('Google signing requires an RSA service-account key');
  const assertion = `${encoded}.${crypto.sign('RSA-SHA256', Buffer.from(encoded), key).toString('base64url')}`;
  const response = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }), redirect: 'error', signal: AbortSignal.timeout(8000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.access_token !== 'string' || !Number.isFinite(Number(data.expires_in))) throw Error('Google did not authorize the requested RCS service-account scope');
  if (tokenCache.size >= 100) tokenCache.clear();
  tokenCache.set(cacheKey, { token: data.access_token, until: now + Math.min(3600, Math.max(0, Number(data.expires_in))) * 1000 });
  return data.access_token;
}
export async function verifyRcsAccount(connection, secret, { fetchImpl = fetch } = {}) {
  const brand = connection.transport_config?.brand_id;
  if (!id(brand) || !id(connection.provider_account_id)) throw Error('Set the Google brand ID and agent ID first');
  const resource = `brands/${brand}/agents/${connection.provider_account_id}`;
  const token = await rcsAccessToken(secret, { scope: 'businesscommunications', fetchImpl });
  const response = await fetchImpl(`https://businesscommunications.googleapis.com/v1/${resource}`, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(8000) });
  const data = await response.json().catch(() => ({}));
  return response.ok && data.name === resource;
}
