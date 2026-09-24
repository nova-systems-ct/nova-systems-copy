// Marketing content workflow E2E test (2026-09-24, master prompt §17) — proves the real gap this
// closed: previously any growth.view staff member could flip a blog post's `published` column
// straight to true with zero review. Now going live only happens through submit-for-review ->
// approve (admin.view specifically, re-checked on top of the dispatcher's blanket growth.view) ->
// publish-now/schedule, and a direct 'save' can never itself set published=true.
//
// Mirrors the established e2e pattern: a real throwaway org/users, direct handler() calls, cleanup
// in a finally block. blog_posts is NOT organization-scoped (single global site='nova' table), so
// this only needs one org for staff membership, not two.
//
// PREREQUISITE: supabase/marketing-content-workflow-migration-standalone.sql must already be
// applied (adds status/scheduled_at/etc. columns to the existing blog_posts table). Fails fast
// with a clear message if it isn't.
// Usage: node scripts/e2e_marketing_content_workflow_test.mjs

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
  const probe = await adminFetch('/rest/v1/blog_posts?select=status&limit=1');
  if (!probe.ok) {
    console.error('blog_posts.status is not queryable — supabase/marketing-content-workflow-migration-standalone.sql');
    console.error('has not been applied to this database yet.');
    console.error('Status:', probe.status, await probe.text());
    process.exit(1);
  }

  const { default: handler } = await import('../api/client.js');
  const suffix = Date.now();
  const cleanup = [];

  try {
    const orgId = await createOrg(`TEST — marketing ${suffix}`, `test-marketing-${suffix}`);
    cleanup.push(() => deleteOrg(orgId));

    const salesPassword = `Sx${Math.random().toString(36).slice(2)}!9`;
    const adminPassword = `Ax${Math.random().toString(36).slice(2)}!9`;
    const salesUser = await createAuthUser(`test-marketing-sales-${suffix}@example.invalid`, salesPassword);
    const adminUser = await createAuthUser(`test-marketing-admin-${suffix}@example.invalid`, adminPassword);
    cleanup.push(() => deleteAuthUser(salesUser.id), () => deleteAuthUser(adminUser.id));

    await createMembership(orgId, salesUser.id, 'nova_sales');
    await createMembership(orgId, adminUser.id, 'nova_admin');

    const salesSession = await signIn(salesUser.email, salesPassword);
    const adminSession = await signIn(adminUser.email, adminPassword);

    let postId = null;
    // ---- 1. Create a draft post ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'blog', op: 'admin' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'save', title: `Test post ${suffix}`, content: 'Real body content.', excerpt: 'A real excerpt.' } });
      const res = mockRes();
      await handler(req, res);
      postId = res._json?.post?.id;
      log('growth.view staff creates a draft post', res.statusCode === 200 && !!postId && res._json?.post?.status === 'draft', `status=${res.statusCode}`);
    }
    cleanup.push(() => adminFetch(`/rest/v1/blog_posts?id=eq.${postId}`, { method: 'DELETE' }));

    // ---- 2. THE REAL GAP THIS CLOSED: 'save' can never itself publish, even with published:true in the body ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'blog', op: 'admin' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'save', id: postId, title: `Test post ${suffix}`, content: 'Edited.', published: true, status: 'published' } });
      const res = mockRes();
      await handler(req, res);
      const check = await adminFetch(`/rest/v1/blog_posts?id=eq.${postId}&select=published,status`);
      const [row] = await check.json();
      log('Sending published:true/status:published in a plain save is silently ignored — post is still unpublished', res.statusCode === 200 && row.published === false && row.status === 'draft', JSON.stringify(row));
    }

    // ---- 3. Submit for review ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'blog', op: 'admin' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'submit-for-review', id: postId } });
      const res = mockRes();
      await handler(req, res);
      log('Submitting for review moves draft -> in_review', res.statusCode === 200 && res._json?.post?.status === 'in_review', `status=${res.statusCode}`);
    }

    // ---- 4. A growth.view-only staff member cannot approve ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'blog', op: 'admin' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'approve', id: postId } });
      const res = mockRes();
      await handler(req, res);
      log('A growth.view-only staff member cannot approve content (admin.view is a distinct, higher gate)', res.statusCode === 403, `status=${res.statusCode}`);
    }

    // ---- 5. It appears in the aggregated Approval Inbox ----
    {
      const req = mockReq({ method: 'GET', query: { resource: 'approvals' }, headers: { authorization: `Bearer ${adminSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      const found = Array.isArray(res._json) && res._json.some((i) => i.item_id === postId && i.item_type === 'content');
      log('The in-review post appears in the aggregated Approval Inbox', res.statusCode === 200 && found, `status=${res.statusCode}`);
    }

    // ---- 6. request-changes (admin.view) requires notes, sends it back to draft ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'blog', op: 'admin' }, headers: { authorization: `Bearer ${adminSession.access_token}` }, body: { action: 'request-changes', id: postId } });
      const res = mockRes();
      await handler(req, res);
      log('Requesting changes without notes is refused', res.statusCode === 400, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'blog', op: 'admin' }, headers: { authorization: `Bearer ${adminSession.access_token}` }, body: { action: 'request-changes', id: postId, notes: 'Fix the headline.' } });
      const res = mockRes();
      await handler(req, res);
      log('Requesting changes with notes sends the post back to draft', res.statusCode === 200 && res._json?.post?.status === 'draft', `status=${res.statusCode}`);
    }

    // ---- 7. Resubmit, approve, and confirm still not live ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'blog', op: 'admin' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'submit-for-review', id: postId } });
      const res = mockRes();
      await handler(req, res);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'blog', op: 'admin' }, headers: { authorization: `Bearer ${adminSession.access_token}` }, body: { action: 'approve', id: postId } });
      const res = mockRes();
      await handler(req, res);
      log('A staff member WITH admin.view can approve', res.statusCode === 200 && res._json?.post?.status === 'approved', `status=${res.statusCode}`);
    }
    {
      const check = await adminFetch(`/rest/v1/blog_posts?id=eq.${postId}&select=published`);
      const [row] = await check.json();
      log('Approval alone does not publish — still requires an explicit publish-now', row.published === false, JSON.stringify(row));
    }

    // ---- 8. Scheduling requires a real future date ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'blog', op: 'admin' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'schedule', id: postId, scheduled_at: '2020-01-01T00:00:00Z' } });
      const res = mockRes();
      await handler(req, res);
      log('Scheduling for a past date is refused', res.statusCode === 400, `status=${res.statusCode}`);
    }

    // ---- 9. publish-now actually goes live ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'blog', op: 'admin' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'publish-now', id: postId } });
      const res = mockRes();
      await handler(req, res);
      log('publish-now sets published=true and status=published (ordinary growth.view staff can trigger it once approved)', res.statusCode === 200 && res._json?.post?.published === true && res._json?.post?.status === 'published', `status=${res.statusCode}`);
    }
    {
      const publicCheck = await adminFetch(`/rest/v1/blog_posts?id=eq.${postId}&select=slug`);
      const [row] = await publicCheck.json();
      const req = mockReq({ method: 'GET', query: { resource: 'blog', op: 'posts', slug: row.slug } });
      const res = mockRes();
      await handler(req, res);
      log('The published post is now readable through the real public endpoint', res.statusCode === 200 && res._json?.id === postId, `status=${res.statusCode}`);
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
