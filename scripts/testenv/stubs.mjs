// Minimal stand-ins for the Supabase services around PostgREST, plus Resend, for the LOCAL integration
// environment only. One HTTP server exposes what the application calls at SUPABASE_URL:
//   /rest/v1/*      → proxied to a REAL PostgREST (real RLS, real constraints)
//   /auth/v1/*      → STAND-IN for GoTrue (users live in the real auth.users table; HS256 JWTs)
//   /storage/v1/*   → STAND-IN for Storage (private buckets: service key or signed URL only; bytes in memory)
//   /resend/emails  → STAND-IN for Resend (records an outbox; failure can be injected)
// These are NOT the real services: passing tests against them proves application logic and database rules, not
// GoTrue, Storage or Resend behaviour.
import http from 'node:http';
import crypto from 'node:crypto';

const b64 = (b) => Buffer.from(b).toString('base64url');
export function signJwt(payload, secret, expSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ iat: now, exp: now + expSeconds, aud: 'authenticated', ...payload }));
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
export function verifyJwt(token, secret) {
  const [h, p, s] = String(token || '').split('.');
  if (!h || !p || !s) return null;
  const expect = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  try { if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expect))) return null; } catch { return null; }
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
const hashPw = (pw) => { const salt = crypto.randomBytes(8).toString('hex'); return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 32).toString('hex')}`; };
const checkPw = (pw, stored) => { const [, salt, h] = String(stored || '').split('$'); return !!h && crypto.timingSafeEqual(Buffer.from(crypto.scryptSync(pw, salt, 32).toString('hex')), Buffer.from(h)); };

export function createStubs({ pool, jwtSecret, postgrestPort, publicBuckets = [] }) {
  const state = { outbox: [], magicLinks: new Map(), objects: new Map(), signed: new Map(), failEmails: false, emailRequests: [], invites: [] };
  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(body)); };
  const readBody = (req) => new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
  const userOut = (u) => ({ id: u.id, email: u.email, user_metadata: u.raw_user_meta_data || {}, app_metadata: u.raw_app_meta_data || {}, email_confirmed_at: u.email_confirmed_at, banned_until: u.banned_until, created_at: u.created_at });
  const roleOf = (req) => { const t = (req.headers.authorization || '').replace(/^Bearer /, ''); const p = verifyJwt(t, jwtSecret); return { token: t, payload: p }; };
  const isService = (req) => roleOf(req).payload?.role === 'service_role';
  const findUserByEmail = async (email) => (await pool.query('select * from auth.users where lower(email) = lower($1)', [email])).rows[0];
  const findUserById = async (id) => (/^[0-9a-f-]{36}$/i.test(id) ? (await pool.query('select * from auth.users where id = $1', [id])).rows[0] : null);

  async function auth(req, res, url, body) {
    const path = url.pathname.replace('/auth/v1', '');
    const j = () => { try { return JSON.parse(body.toString() || '{}'); } catch { return {}; } };
    if (path === '/user' && req.method === 'GET') {
      const { payload } = roleOf(req); if (!payload?.sub) return json(res, 401, { message: 'invalid JWT' });
      const u = await findUserById(payload.sub); if (!u) return json(res, 401, { message: 'user not found' });
      return json(res, 200, userOut(u));
    }
    if (path === '/token' && req.method === 'POST' && url.searchParams.get('grant_type') === 'password') {
      const { email, password } = j(); const u = email && (await findUserByEmail(email));
      if (!u || !checkPw(password, u.encrypted_password)) return json(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      if (u.banned_until && new Date(u.banned_until) > new Date()) return json(res, 400, { error: 'user_banned', error_description: 'User is banned' });
      if (!u.email_confirmed_at) return json(res, 400, { error: 'email_not_confirmed' });
      await pool.query('update auth.users set last_sign_in_at = now() where id = $1', [u.id]);
      return json(res, 200, { access_token: signJwt({ sub: u.id, email: u.email, role: 'authenticated' }, jwtSecret), token_type: 'bearer', expires_in: 3600, refresh_token: crypto.randomBytes(12).toString('hex'), user: userOut(u) });
    }
    if (!isService(req)) return json(res, 401, { message: 'service role required' });
    if (path === '/admin/users' && req.method === 'POST') {
      const b = j(); if (!b.email) return json(res, 422, { message: 'email required' });
      if (await findUserByEmail(b.email)) return json(res, 422, { code: 'email_exists', message: 'A user with this email address has already been registered' });
      const r = await pool.query('insert into auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data) values ($1,$2,$3,$4) returning *', [b.email.toLowerCase(), b.password ? hashPw(b.password) : null, b.email_confirm ? new Date() : null, b.user_metadata || {}]);
      return json(res, 200, userOut(r.rows[0]));
    }
    if (path === '/admin/users' && req.method === 'GET') { const e = url.searchParams.get('email'); const r = e ? await pool.query('select * from auth.users where lower(email)=lower($1)', [e]) : await pool.query('select * from auth.users limit 200'); return json(res, 200, { users: r.rows.map(userOut) }); }
    const m = path.match(/^\/admin\/users\/([^/]+)$/);
    if (m) {
      const u = await findUserById(m[1]); if (!u) return json(res, 404, { message: 'User not found' });
      if (req.method === 'GET') return json(res, 200, userOut(u));
      if (req.method === 'PUT' || req.method === 'PATCH') {
        const b = j(); const sets = []; const vals = [];
        if (b.password) { vals.push(hashPw(b.password)); sets.push(`encrypted_password = $${vals.length}`); }
        if (b.ban_duration) { vals.push(b.ban_duration === 'none' ? null : new Date(Date.now() + 100 * 365 * 86400e3)); sets.push(`banned_until = $${vals.length}`); }
        if (b.user_metadata) { vals.push({ ...u.raw_user_meta_data, ...b.user_metadata }); sets.push(`raw_user_meta_data = $${vals.length}`); }
        if (b.email_confirm) { sets.push('email_confirmed_at = now()'); }
        if (sets.length) await pool.query(`update auth.users set ${sets.join(', ')} where id = '${u.id}'`, vals);
        return json(res, 200, userOut(await findUserById(u.id)));
      }
      if (req.method === 'DELETE') { await pool.query('delete from auth.users where id = $1', [u.id]); return json(res, 200, {}); }
    }
    if (path === '/invite' && req.method === 'POST') {
      const b = j(); let u = await findUserByEmail(b.email);
      if (!u) u = (await pool.query('insert into auth.users (email) values ($1) returning *', [b.email.toLowerCase()])).rows[0];
      state.invites.push({ email: b.email, at: new Date().toISOString() });
      return json(res, 200, userOut(u));
    }
    if (path === '/admin/generate_link' && req.method === 'POST') {
      const b = j(); let u = await findUserByEmail(b.email);
      if (!u) u = (await pool.query('insert into auth.users (email, email_confirmed_at) values ($1, now()) returning *', [b.email.toLowerCase()])).rows[0];
      const token = crypto.randomBytes(16).toString('hex'); state.magicLinks.set(token, { userId: u.id, email: u.email, used: false, exp: Date.now() + 3600e3 });
      return json(res, 200, { action_link: `http://stub.invalid/auth/v1/verify?token=${token}&type=${b.type || 'magiclink'}&redirect_to=${encodeURIComponent(b.redirect_to || '')}`, hashed_token: token, verification_type: b.type || 'magiclink', user: userOut(u) });
    }
    return json(res, 404, { message: `stub auth: no route ${req.method} ${path}` });
  }

  async function storage(req, res, url, body) {
    const path = decodeURIComponent(url.pathname.replace('/storage/v1', ''));
    let m;
    if ((m = path.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === 'POST') {
      if (!isService(req)) return json(res, 401, { message: 'service role required' });
      if (!state.objects.has(`${m[1]}/${m[2]}`)) return json(res, 404, { message: 'Object not found' });
      const exp = Number(JSON.parse(body.toString() || '{}').expiresIn) || 60; const token = crypto.randomBytes(12).toString('hex');
      state.signed.set(token, { key: `${m[1]}/${m[2]}`, exp: Date.now() + exp * 1000 });
      return json(res, 200, { signedURL: `/object/sign/${m[1]}/${encodeURI(m[2])}?token=${token}` });
    }
    if ((m = path.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === 'GET') {
      const t = state.signed.get(url.searchParams.get('token')); if (!t || t.key !== `${m[1]}/${m[2]}` || t.exp < Date.now()) return json(res, 400, { message: 'invalid or expired token' });
      const o = state.objects.get(t.key); res.writeHead(200, { 'Content-Type': o.type }); return res.end(o.data);
    }
    if ((m = path.match(/^\/object\/public\/([^/]+)\/(.+)$/)) && req.method === 'GET') {
      if (!publicBuckets.includes(m[1])) return json(res, 400, { message: 'Bucket not found' });
      const o = state.objects.get(`${m[1]}/${m[2]}`); if (!o) return json(res, 404, { message: 'not found' }); res.writeHead(200, { 'Content-Type': o.type }); return res.end(o.data);
    }
    if ((m = path.match(/^\/object\/([^/]+)\/(.+)$/)) && ['POST', 'PUT'].includes(req.method)) {
      if (!isService(req)) return json(res, 403, { message: 'new row violates row-level security policy' });
      state.objects.set(`${m[1]}/${m[2]}`, { data: body, type: req.headers['content-type'] || 'application/octet-stream' });
      return json(res, 200, { Key: `${m[1]}/${m[2]}` });
    }
    if ((m = path.match(/^\/object\/(?:authenticated\/)?([^/]+)\/(.+)$/)) && req.method === 'GET') return json(res, 400, { message: 'not authorized (stub: private objects are only reachable by signed URL)' });
    return json(res, 404, { message: `stub storage: no route ${req.method} ${path}` });
  }

  async function resend(req, res, url, body) {
    if (url.pathname !== '/resend/emails' || req.method !== 'POST') return json(res, 404, {});
    const key = (req.headers.authorization || '').replace(/^Bearer /, ''); state.emailRequests.push({ key, at: Date.now() });
    if (!key) return json(res, 401, { message: 'missing api key' });
    if (state.failEmails) return json(res, state.failEmails === 'timeout' ? 504 : 422, { message: 'injected failure' });
    const b = JSON.parse(body.toString() || '{}'); const id = `msg_${crypto.randomBytes(6).toString('hex')}`;
    state.outbox.push({ id, to: b.to, from: b.from, subject: b.subject, text: b.text, html: b.html, idempotency: req.headers['idempotency-key'] || null });
    return json(res, 200, { id });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Access-Control-Max-Age': '600' }); return res.end(); }
      const body = await readBody(req);
      if (url.pathname.startsWith('/rest/v1/') || url.pathname === '/rest/v1') {
        const opts = { host: '127.0.0.1', port: postgrestPort, path: url.pathname.replace(/^\/rest\/v1/, '') + url.search, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${postgrestPort}` } };
        const pr = http.request(opts, (r) => { const h = { ...r.headers }; for (const k of Object.keys(h)) if (k.toLowerCase().startsWith('access-control-')) delete h[k]; res.writeHead(r.statusCode, { ...h, 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range, Content-Type' }); r.pipe(res); });
        pr.on('error', (e) => json(res, 502, { message: `postgrest unreachable: ${e.message}` })); pr.end(body); return;
      }
      if (url.pathname.startsWith('/auth/v1/')) return await auth(req, res, url, body);
      if (url.pathname.startsWith('/storage/v1/')) return await storage(req, res, url, body);
      if (url.pathname.startsWith('/resend/')) return await resend(req, res, url, body);
      return json(res, 404, { message: 'stub: unknown path' });
    } catch (e) { console.error('[stub error]', e); return json(res, 500, { message: e.message }); }
  });
  return { server, state, hashPw, consumeMagicLink(link) { const t = new URL(link).searchParams.get('token'); const m = state.magicLinks.get(t); if (!m || m.used || m.exp < Date.now()) return null; m.used = true; return { userId: m.userId, email: m.email, access_token: signJwt({ sub: m.userId, email: m.email, role: 'authenticated' }, jwtSecret) }; } };
}
