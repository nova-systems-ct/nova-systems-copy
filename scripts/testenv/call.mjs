// Invoke the REAL api/client.js (and other Vercel-style handlers) in-process against the local integration environment.
let ipn = 0;
export function makeCaller(handler) {
  return async function call({ resource, op, method = 'POST', body, query = {}, token, headers = {}, action, ip } = {}) {
    const req = { method, body: body ?? {}, query: { ...(resource ? { resource } : {}), ...(op ? { op } : {}), ...(action ? { action } : {}), ...query }, headers: { origin: 'https://nova-systems.app', 'x-forwarded-for': ip || `10.9.${(++ipn >> 8) & 255}.${ipn & 255}`, ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, socket: { remoteAddress: '127.0.0.1' } };
    const res = { code: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; }, end() { return this; } };
    await handler(req, res);
    return { status: res.code, body: res.body, headers: res.headers };
  };
}
