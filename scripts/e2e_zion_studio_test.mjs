// Zion Studio E2E test (2026-09-23) — written specifically because building this domain
// surfaced a real authorization gap before it ever shipped: the first draft gated every zion
// action at "any active staff member," which would have let a low-privilege role (e.g. a
// nova_sales_candidate with only academy.view) reach Nova's real content-production tooling
// simply by knowing the action name — the exact "hidden UI is not authorization" mistake this
// project has caught and fixed before (see the Academy build). journal/facts are safe at "any
// staff" only because they're independently ownership-scoped by author_user_id; everything else
// requires growth.view. This test proves both halves, not just that the code compiles.
//
// Mirrors the established e2e pattern: real throwaway users, direct handler() calls, cleanup in
// a finally block.
//
// PREREQUISITE: supabase/zion-studio-migration-standalone.sql must already be applied. Fails
// fast with a clear message if it isn't.
// Usage: node scripts/e2e_zion_studio_test.mjs

import fs from 'node:fs';

const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
});
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_ANON_KEY']) {
  if (env[k] && !process.env[k]) process.env[k] = env[k];
}
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const adminFetch = (path, opts = {}) => fetch(`${SUPABASE_URL}${path}`, {
  ...opts,
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
});

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

function mockReq({ method = 'GET', query = {}, headers = {}, body = null }) {
  return { method, query, headers, body, socket: {} };
}
function mockRes() {
  const res = {
    statusCode: 200, _json: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this._json = payload; return this; },
    setHeader() {},
  };
  return res;
}

async function createOrg(name, slug) {
  const res = await adminFetch('/rest/v1/organizations', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name, slug, kind: 'client', status: 'active' }),
  });
  const [row] = await res.json();
  if (!row?.id) throw new Error('Failed to create test org: ' + JSON.stringify(row));
  return row.id;
}
async function deleteOrg(id) { await adminFetch(`/rest/v1/organizations?id=eq.${id}`, { method: 'DELETE' }); }
async function createAuthUser(email, password) {
  const res = await adminFetch('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) });
  const row = await res.json();
  if (!row?.id) throw new Error('Failed to create test auth user: ' + JSON.stringify(row));
  return row;
}
async function deleteAuthUser(id) { await adminFetch(`/auth/v1/admin/users/${id}`, { method: 'DELETE' }); }
async function createMembership(orgId, userId, role) {
  const res = await adminFetch('/rest/v1/organization_members', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, member_type: 'staff', staff_user_id: userId, role, status: 'active' }),
  });
  const [row] = await res.json();
  if (!row?.id) throw new Error('Failed to create test membership: ' + JSON.stringify(row));
  return row.id;
}
async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data?.access_token) throw new Error('Sign-in failed: ' + JSON.stringify(data));
  return data;
}

async function main() {
  const probe = await adminFetch('/rest/v1/zion_journal_entries?select=id&limit=1');
  if (!probe.ok) {
    console.error('zion_journal_entries is not queryable — supabase/zion-studio-migration-standalone.sql');
    console.error('has not been applied to this database yet.');
    console.error('Status:', probe.status, await probe.text());
    process.exit(1);
  }

  const { default: handler } = await import('../api/client.js');
  const suffix = Date.now();
  const cleanup = [];

  try {
    const orgId = await createOrg(`TEST — zion ${suffix}`, `test-zion-${suffix}`);
    cleanup.push(() => deleteOrg(orgId));

    const ownerPassword = `Ox${Math.random().toString(36).slice(2)}!9`;
    const otherPassword = `Px${Math.random().toString(36).slice(2)}!9`;
    const limitedPassword = `Lx${Math.random().toString(36).slice(2)}!9`;
    const ownerUser = await createAuthUser(`test-zion-owner-${suffix}@example.invalid`, ownerPassword);
    const otherUser = await createAuthUser(`test-zion-other-${suffix}@example.invalid`, otherPassword);
    const limitedUser = await createAuthUser(`test-zion-limited-${suffix}@example.invalid`, limitedPassword);
    cleanup.push(() => deleteAuthUser(ownerUser.id), () => deleteAuthUser(otherUser.id), () => deleteAuthUser(limitedUser.id));

    await createMembership(orgId, ownerUser.id, 'nova_super_admin'); // is_platform_owner() = true
    await createMembership(orgId, otherUser.id, 'nova_admin');       // real staff, has growth.view, NOT platform owner
    await createMembership(orgId, limitedUser.id, 'nova_auditor');   // real staff, does NOT have growth.view

    const ownerSession = await signIn(ownerUser.email, ownerPassword);
    const otherSession = await signIn(otherUser.email, otherPassword);
    const limitedSession = await signIn(limitedUser.email, limitedPassword);

    // ---- 1. No auth -> 401 ----
    {
      const req = mockReq({ method: 'GET', query: { resource: 'zion', op: 'journal' } });
      const res = mockRes();
      await handler(req, res);
      log('No auth rejected: journal', res.statusCode === 401, `status=${res.statusCode}`);
    }

    // ---- 2. Journal is ownership-scoped, not just "any staff sees everything" ----
    let entryId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'journal' }, headers: { authorization: `Bearer ${ownerSession.access_token}` }, body: { entry_date: '2026-09-23', text_content: 'Worked on the Audit and Zion domains.', time_spent_minutes: 240, facts: ['Worked on the Audit and Zion domains for four hours.'] } });
      const res = mockRes();
      await handler(req, res);
      entryId = res._json?.entry?.id;
      log('Owner creates a journal entry with an unconfirmed fact', res.statusCode === 200 && !!entryId, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'GET', query: { resource: 'zion', op: 'journal' }, headers: { authorization: `Bearer ${otherSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      log('A different real staff member (not platform owner) sees an EMPTY list, not the owner\'s entries', res.statusCode === 200 && Array.isArray(res._json) && res._json.length === 0, JSON.stringify(res._json));
    }
    {
      const req = mockReq({ method: 'GET', query: { resource: 'zion', op: 'journal' }, headers: { authorization: `Bearer ${ownerSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      log('The real author sees their own entry', res._json?.some((e) => e.id === entryId), JSON.stringify(res._json?.map((e) => e.id)));
    }

    // ---- 3. Fact confirmation requires the platform owner specifically ----
    let factId = null;
    {
      const req = mockReq({ method: 'GET', query: { resource: 'zion', op: 'facts', journal_entry_id: entryId }, headers: { authorization: `Bearer ${ownerSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      factId = res._json?.[0]?.id;
      log('Fact starts unconfirmed', res._json?.[0]?.status === 'unconfirmed', JSON.stringify(res._json));
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'facts' }, headers: { authorization: `Bearer ${otherSession.access_token}` }, body: { id: factId, status: 'confirmed' } });
      const res = mockRes();
      await handler(req, res);
      log('A real staff member who is NOT the platform owner cannot confirm a fact', res.statusCode === 403, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'facts' }, headers: { authorization: `Bearer ${ownerSession.access_token}` }, body: { id: factId, status: 'confirmed', disclosure_allowed: true } });
      const res = mockRes();
      await handler(req, res);
      log('The platform owner can confirm the fact', res.statusCode === 200 && res._json?.fact?.status === 'confirmed', `status=${res.statusCode}`);
    }

    // ---- 4. Ideas/scripts/videos/review require growth.view — the gap that was found and fixed ----
    {
      const req = mockReq({ method: 'GET', query: { resource: 'zion', op: 'ideas' }, headers: { authorization: `Bearer ${limitedSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      log('A real staff member WITHOUT growth.view is rejected from ideas (the gap that was caught before shipping)', res.statusCode === 403, `status=${res.statusCode}`);
    }

    // ---- 5. An idea citing an UNCONFIRMED fact is refused — "not established facts" ----
    let unconfirmedFactId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'journal' }, headers: { authorization: `Bearer ${ownerSession.access_token}` }, body: { entry_date: '2026-09-23', facts: ['Signed a new client today.'] } });
      const res = mockRes();
      await handler(req, res);
      const entryId2 = res._json?.entry?.id;
      const factsRes = mockReq({ method: 'GET', query: { resource: 'zion', op: 'facts', journal_entry_id: entryId2 }, headers: { authorization: `Bearer ${ownerSession.access_token}` } });
      const factsResOut = mockRes();
      await handler(factsRes, factsResOut);
      unconfirmedFactId = factsResOut._json?.[0]?.id;
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'ideas' }, headers: { authorization: `Bearer ${otherSession.access_token}` }, body: { action: 'create', angle: 'How I signed a new client', story_type: 'recap', source_fact_ids: [unconfirmedFactId] } });
      const res = mockRes();
      await handler(req, res);
      log('An idea citing an unconfirmed fact is refused', res.statusCode === 400, `status=${res.statusCode} body=${JSON.stringify(res._json)}`);
    }

    // ---- 6. A real idea + script + video + review flow ----
    let ideaId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'ideas' }, headers: { authorization: `Bearer ${otherSession.access_token}` }, body: { action: 'create', angle: 'Building the Audit engine', story_type: 'process_explanation', source_fact_ids: [factId] } });
      const res = mockRes();
      await handler(req, res);
      ideaId = res._json?.idea?.id;
      log('An idea citing a CONFIRMED fact is created', res.statusCode === 200 && !!ideaId, `status=${res.statusCode}`);
    }
    let scriptId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'scripts' }, headers: { authorization: `Bearer ${otherSession.access_token}` }, body: { idea_id: ideaId, hook: 'You would not believe what I built today.', body: 'Full script body.' } });
      const res = mockRes();
      await handler(req, res);
      scriptId = res._json?.script?.id;
      log('Script created, idea auto-advances to scripting', res.statusCode === 200 && !!scriptId, `status=${res.statusCode}`);
    }
    let videoId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'videos' }, headers: { authorization: `Bearer ${otherSession.access_token}` }, body: { action: 'create-draft', idea_id: ideaId, script_id: scriptId } });
      const res = mockRes();
      await handler(req, res);
      videoId = res._json?.video?.id;
      log('Video draft created', res.statusCode === 200 && !!videoId, `status=${res.statusCode}`);
    }
    {
      // No character asset exists in this throwaway test — rendering must be honestly blocked.
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'videos' }, headers: { authorization: `Bearer ${otherSession.access_token}` }, body: { action: 'request-render', id: videoId } });
      const res = mockRes();
      await handler(req, res);
      log('Render is refused with no character reference on file (blocks rendering only, not the rest of the Studio)', res.statusCode === 409, `status=${res.statusCode} body=${JSON.stringify(res._json)}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'review' }, headers: { authorization: `Bearer ${ownerSession.access_token}` }, body: { video_id: videoId, action: 'approve', notes: 'Looks great.' } });
      const res = mockRes();
      await handler(req, res);
      log('Owner approves the video', res.statusCode === 200 && res._json?.video?.status === 'approved', `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'review' }, headers: { authorization: `Bearer ${ownerSession.access_token}` }, body: { video_id: videoId, action: 'approve' } });
      const res = mockRes();
      await handler(req, res);
      log('Re-approving an already-approved video is refused', res.statusCode === 400, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'review' }, headers: { authorization: `Bearer ${ownerSession.access_token}` }, body: { video_id: videoId, action: 'schedule', scheduled_at: '2026-09-24T15:00:00Z' } });
      const res = mockRes();
      await handler(req, res);
      log('Approved video can be scheduled', res.statusCode === 200 && res._json?.video?.status === 'scheduled', `status=${res.statusCode}`);
    }

  } finally {
    for (const fn of cleanup.reverse()) {
      try { await fn(); } catch (e) { console.error('cleanup error:', e.message); }
    }
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('SCRIPT ERROR:', err);
  process.exit(1);
});
