// Marketing automation E2E test (2026-09-24, master prompt §17, restored scope) — proves the real
// content pipeline (idea -> drafted -> fact_checked -> approved, admin.view-gated approval) and
// the explicit honesty requirements: platform adapters never claim a connection that doesn't
// exist, a platform post can only be created for content that actually passed approval, and
// publish_mode is derived from the real adapter state rather than client-asserted. Also proves
// newsletter unsubscribe is real suppression, not a decorative link.
//
// Mirrors the established e2e pattern: real throwaway org/users, direct handler() calls, cleanup
// in a finally block.
//
// PREREQUISITE: supabase/marketing-automation-migration-standalone.sql must already be applied.
// Fails fast with a clear message if it isn't.
// Usage: node scripts/e2e_marketing_automation_test.mjs

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
  // NOTE: marketing_brands itself already exists live in production (real, seeded rows predating
  // this session — see the migration file's own header for how that was discovered). The real
  // signal for whether THIS migration has been applied is one of its NEW columns, not the base
  // table's mere existence.
  const probe = await adminFetch('/rest/v1/marketing_brands?select=approval_policy&limit=1');
  if (!probe.ok) {
    console.error('marketing_brands.approval_policy is not queryable — supabase/marketing-automation-migration-standalone.sql');
    console.error('has not been applied to this database yet.');
    console.error('Status:', probe.status, await probe.text());
    process.exit(1);
  }

  const { default: handler } = await import('../api/client.js');
  const suffix = Date.now();
  const cleanup = [];

  try {
    const orgId = await createOrg(`TEST — marketing-auto ${suffix}`, `test-marketing-auto-${suffix}`);
    cleanup.push(() => deleteOrg(orgId));

    const salesPassword = `Sx${Math.random().toString(36).slice(2)}!9`;
    const adminPassword = `Ax${Math.random().toString(36).slice(2)}!9`;
    const salesUser = await createAuthUser(`test-mktg-sales-${suffix}@example.invalid`, salesPassword);
    const adminUser = await createAuthUser(`test-mktg-admin-${suffix}@example.invalid`, adminPassword);
    cleanup.push(() => deleteAuthUser(salesUser.id), () => deleteAuthUser(adminUser.id));

    await createMembership(orgId, salesUser.id, 'nova_sales');
    await createMembership(orgId, adminUser.id, 'nova_admin');

    const salesSession = await signIn(salesUser.email, salesPassword);
    const adminSession = await signIn(adminUser.email, adminPassword);

    // ---- 1. Adapter honesty: every platform starts not_implemented, no fake connection ----
    {
      const req = mockReq({ method: 'GET', query: { resource: 'marketing', op: 'adapters' }, headers: { authorization: `Bearer ${salesSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      const allNotImplemented = Array.isArray(res._json) && res._json.length === 5 && res._json.every((a) => a.state === 'not_implemented');
      log('ADAPTER HONESTY: all 5 platforms start not_implemented — no fake connection claimed', res.statusCode === 200 && allNotImplemented, JSON.stringify(res._json));
    }

    // ---- 2. Brand creation, unknown approval_policy defaults to draft_only ----
    let brandId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'marketing', op: 'brands' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'create', organization_id: orgId, name: 'Nova', audience: 'Small business owners in CT' } });
      const res = mockRes();
      await handler(req, res);
      brandId = res._json?.brand?.id;
      log('Brand created, defaults to approval_policy=draft_only per the master prompt\'s own rule', res.statusCode === 200 && res._json?.brand?.approval_policy === 'draft_only', JSON.stringify(res._json?.brand));
    }

    // ---- 3. Content pipeline: idea -> drafted -> fact_checked -> approved ----
    let itemId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'marketing', op: 'content' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'create', organization_id: orgId, brand_id: brandId, content_type: 'social_post', title: 'How we cut a client\'s missed calls by half' } });
      const res = mockRes();
      await handler(req, res);
      itemId = res._json?.item?.id;
      log('Content idea created (status=idea)', res.statusCode === 200 && res._json?.item?.status === 'idea', `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'marketing', op: 'content' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'update-draft', organization_id: orgId, id: itemId, body: 'Real draft copy here.' } });
      const res = mockRes();
      await handler(req, res);
      log('Draft written, moves to drafted', res.statusCode === 200 && res._json?.item?.status === 'drafted', `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'marketing', op: 'content' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'fact-check', organization_id: orgId, id: itemId } });
      const res = mockRes();
      await handler(req, res);
      log('Fact-check without any source_notes is refused', res.statusCode === 400, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'marketing', op: 'content' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'fact-check', organization_id: orgId, id: itemId, source_notes: 'Verified against the real order_events timestamps for this client.' } });
      const res = mockRes();
      await handler(req, res);
      log('Fact-check with real source_notes succeeds', res.statusCode === 200 && res._json?.item?.status === 'fact_checked', `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'marketing', op: 'content' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'approve', organization_id: orgId, id: itemId } });
      const res = mockRes();
      await handler(req, res);
      log('A growth.view-only staff member cannot approve content (admin.view is a distinct, higher gate)', res.statusCode === 403, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'marketing', op: 'content' }, headers: { authorization: `Bearer ${adminSession.access_token}` }, body: { action: 'approve', organization_id: orgId, id: itemId } });
      const res = mockRes();
      await handler(req, res);
      log('A staff member WITH admin.view can approve fact-checked content', res.statusCode === 200 && res._json?.item?.status === 'approved', `status=${res.statusCode}`);
    }

    // ---- 4. Platform posts: cannot be created for un-approved content; publish_mode is derived, not asserted ----
    let unapprovedItemId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'marketing', op: 'content' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'create', organization_id: orgId, brand_id: brandId, content_type: 'social_post', title: 'Not yet approved' } });
      const res = mockRes();
      await handler(req, res);
      unapprovedItemId = res._json?.item?.id;
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'marketing', op: 'platform-posts' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'create', content_item_id: unapprovedItemId, platform: 'linkedin' } });
      const res = mockRes();
      await handler(req, res);
      log('A platform post cannot be created for un-approved content', res.statusCode === 400, `status=${res.statusCode}`);
    }
    let platformPostId = null;
    {
      // Caller tries to assert publish_mode='api' directly — must be ignored/overridden by the
      // real (not_implemented) adapter state.
      const req = mockReq({ method: 'POST', query: { resource: 'marketing', op: 'platform-posts' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'create', content_item_id: itemId, platform: 'linkedin', publish_mode: 'api', caption: 'Real caption text.' } });
      const res = mockRes();
      await handler(req, res);
      platformPostId = res._json?.post?.id;
      log('PUBLISH_MODE HONESTY: an unconnected platform is forced to manual_export regardless of what the caller requests', res.statusCode === 200 && res._json?.post?.publish_mode === 'manual_export', JSON.stringify(res._json?.post));
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'marketing', op: 'platform-posts' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'export', id: platformPostId } });
      const res = mockRes();
      await handler(req, res);
      log('Manual export recorded honestly (not claimed as a real publish)', res.statusCode === 200 && res._json?.post?.status === 'exported', `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'marketing', op: 'platform-posts' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'mark-published', id: platformPostId } });
      const res = mockRes();
      await handler(req, res);
      log('A human confirms the manual post actually went out', res.statusCode === 200 && res._json?.post?.status === 'published', `status=${res.statusCode}`);
    }

    // ---- 5. Newsletter suppression is real, not decorative ----
    const testEmail = `test-suppress-${suffix}@example.invalid`;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'newsletter' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'add-subscriber', email: testEmail } });
      const res = mockRes();
      await handler(req, res);
      log('Subscriber added, subscribed=true by default', res.statusCode === 200 && res._json?.subscriber?.subscribed === true, JSON.stringify(res._json));
    }
    {
      // Public — no auth header at all, matching a real unsubscribe-link click.
      const req = mockReq({ method: 'POST', query: { resource: 'newsletter' }, body: { action: 'unsubscribe', email: testEmail } });
      const res = mockRes();
      await handler(req, res);
      log('SUPPRESSION IS REAL: an unauthenticated unsubscribe request succeeds and is not just a UI toggle', res.statusCode === 200 && res._json?.unsubscribed === true, `status=${res.statusCode}`);
    }
    {
      const check = await adminFetch(`/rest/v1/newsletter_subscribers?email=eq.${encodeURIComponent(testEmail)}&select=subscribed,unsubscribed_at`);
      const [row] = await check.json();
      log('The real database row is actually flipped to subscribed=false', row?.subscribed === false && !!row?.unsubscribed_at, JSON.stringify(row));
      cleanup.push(() => adminFetch(`/rest/v1/newsletter_subscribers?email=eq.${encodeURIComponent(testEmail)}`, { method: 'DELETE' }));
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
