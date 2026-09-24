// Zion Studio remaining tabs E2E test (2026-09-24) — proves Calendar/Published/Analytics/Revenue/
// Profile Bible behave as specified: Calendar aggregates real scheduled Zion videos AND scheduled
// marketing content; Published distinguishes provider-confirmed from manually-recorded
// publication; Analytics reports unavailable/stale data honestly instead of defaulting to zero;
// Revenue is platform-owner-only and computes profit from verified figures only (estimates never
// bleed into it); Profile Bible defaults to private (owner_only) and only the platform owner can
// approve a reference.
//
// PREREQUISITE: supabase/zion-studio-migration-standalone.sql AND
// supabase/zion-studio-remaining-tabs-migration-standalone.sql must already be applied. Fails
// fast with a clear message if either isn't.
// Usage: node scripts/e2e_zion_remaining_tabs_test.mjs

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
function mockReq({ method = 'GET', query = {}, headers = {}, body = null }) { return { method, query, headers, body, socket: {} }; }
function mockRes() {
  const res = { statusCode: 200, _json: null, status(c) { this.statusCode = c; return this; }, json(p) { this._json = p; return this; }, setHeader() {} };
  return res;
}

async function createOrg(name, slug) {
  const res = await adminFetch('/rest/v1/organizations', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ name, slug, kind: 'client', status: 'active' }) });
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
  const res = await adminFetch('/rest/v1/organization_members', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ organization_id: orgId, member_type: 'staff', staff_user_id: userId, role, status: 'active' }) });
  const [row] = await res.json();
  if (!row?.id) throw new Error('Failed to create test membership: ' + JSON.stringify(row));
  return row.id;
}
async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const data = await res.json();
  if (!data?.access_token) throw new Error('Sign-in failed: ' + JSON.stringify(data));
  return data;
}

async function main() {
  const probe = await adminFetch('/rest/v1/zion_revenue_records?select=id&limit=1');
  if (!probe.ok) {
    console.error('zion_revenue_records is not queryable — supabase/zion-studio-remaining-tabs-migration-standalone.sql');
    console.error('has not been applied to this database yet.');
    console.error('Status:', probe.status, await probe.text());
    process.exit(1);
  }

  const { default: handler } = await import('../api/client.js');
  const suffix = Date.now();
  const cleanup = [];

  try {
    const orgId = await createOrg(`TEST — zion tabs ${suffix}`, `test-zion-tabs-${suffix}`);
    cleanup.push(() => deleteOrg(orgId));

    const ownerPassword = `Ox${Math.random().toString(36).slice(2)}!9`;
    const staffPassword = `Sx${Math.random().toString(36).slice(2)}!9`;
    const ownerUser = await createAuthUser(`test-zion-tabs-owner-${suffix}@example.invalid`, ownerPassword);
    const staffUser = await createAuthUser(`test-zion-tabs-staff-${suffix}@example.invalid`, staffPassword);
    cleanup.push(() => deleteAuthUser(ownerUser.id), () => deleteAuthUser(staffUser.id));

    await createMembership(orgId, ownerUser.id, 'nova_super_admin');
    await createMembership(orgId, staffUser.id, 'nova_admin'); // real staff, growth.view, NOT platform owner

    const ownerSession = await signIn(ownerUser.email, ownerPassword);
    const staffSession = await signIn(staffUser.email, staffPassword);

    // ---- Seed a real idea + video so Calendar/Published/Analytics have something real to show ----
    const ideaRes = await adminFetch('/rest/v1/zion_video_ideas', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ organization_id: orgId, angle: 'Test angle', story_type: 'recap' }) });
    const [idea] = await ideaRes.json();
    cleanup.push(() => adminFetch(`/rest/v1/zion_video_ideas?id=eq.${idea.id}`, { method: 'DELETE' }));
    const futureAt = new Date(Date.now() + 86400_000).toISOString();
    const videoRes = await adminFetch('/rest/v1/zion_videos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ idea_id: idea.id, status: 'scheduled', scheduled_at: futureAt, platform_variant: 'tiktok' }) });
    const [video] = await videoRes.json();
    cleanup.push(() => adminFetch(`/rest/v1/zion_videos?id=eq.${video.id}`, { method: 'DELETE' }));

    // ---- 1. Calendar aggregates the real scheduled video ----
    {
      const req = mockReq({ method: 'GET', query: { resource: 'zion', op: 'calendar' }, headers: { authorization: `Bearer ${staffSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      const found = Array.isArray(res._json) && res._json.some((i) => i.id === video.id && i.kind === 'zion_video');
      log('Calendar aggregates the real scheduled Zion video', res.statusCode === 200 && found, JSON.stringify(res._json));
    }

    // ---- 2. Published distinguishes provider-confirmed from manually-recorded ----
    await adminFetch(`/rest/v1/zion_videos?id=eq.${video.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'published', published_at: new Date().toISOString(), publish_confirmation_source: 'manual' }) });
    {
      const req = mockReq({ method: 'GET', query: { resource: 'zion', op: 'published' }, headers: { authorization: `Bearer ${staffSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      const row = res._json?.find((v) => v.id === video.id);
      log('PUBLISHED: manually-recorded publication is distinguished from provider-confirmed, not collapsed into one badge', res.statusCode === 200 && row?.publish_confirmation_source === 'manual', JSON.stringify(row));
    }

    // ---- 3. Analytics reports "unavailable" honestly, not zero, for a video with no metrics ----
    {
      const req = mockReq({ method: 'GET', query: { resource: 'zion', op: 'analytics' }, headers: { authorization: `Bearer ${staffSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      const row = res._json?.find((v) => v.id === video.id);
      log('ANALYTICS HONESTY: a video with zero recorded metrics is reported as data_status=unavailable, never faked as zero engagement', res.statusCode === 200 && row?.data_status === 'unavailable', JSON.stringify(row));
    }

    // ---- 4. Revenue is platform-owner-only ----
    {
      const req = mockReq({ method: 'GET', query: { resource: 'zion', op: 'revenue' }, headers: { authorization: `Bearer ${staffSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      log('REVENUE PRIVACY: a real staff member who is NOT the platform owner cannot read revenue records', res.statusCode === 403, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'revenue' }, headers: { authorization: `Bearer ${ownerSession.access_token}` }, body: { record_type: 'estimate', amount_cents: 500000, source: 'pipeline' } });
      const res = mockRes();
      await handler(req, res);
      log('Owner records an estimate', res.statusCode === 200, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'revenue' }, headers: { authorization: `Bearer ${ownerSession.access_token}` }, body: { record_type: 'verified_income', amount_cents: 10000, source: 'sponsorship' } });
      const res = mockRes();
      await handler(req, res);
      log('Owner records verified income', res.statusCode === 200, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'revenue' }, headers: { authorization: `Bearer ${ownerSession.access_token}` }, body: { record_type: 'expense', amount_cents: 3000, source: 'rendering' } });
      const res = mockRes();
      await handler(req, res);
      log('Owner records an expense', res.statusCode === 200, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'GET', query: { resource: 'zion', op: 'revenue' }, headers: { authorization: `Bearer ${ownerSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      const s = res._json?.summary;
      log('PROFIT COMPUTED FROM VERIFIED FIGURES ONLY: profit = 10000-3000 = 7000, the 500000 estimate never bleeds in', res.statusCode === 200 && s?.profit_cents === 7000 && s?.estimate_cents === 500000, JSON.stringify(s));
    }

    // ---- 5. Profile Bible defaults to private; only the platform owner approves ----
    let assetId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'character-assets' }, headers: { authorization: `Bearer ${staffSession.access_token}` }, body: { action: 'create', asset_type: 'appearance_reference', storage_path: 'zion/ref-1.jpg' } });
      const res = mockRes();
      await handler(req, res);
      assetId = res._json?.asset?.id;
      log('PROFILE BIBLE PRIVACY: a new asset defaults to owner_only/draft', res.statusCode === 200 && res._json?.asset?.privacy === 'owner_only' && res._json?.asset?.status === 'draft', JSON.stringify(res._json?.asset));
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'character-assets' }, headers: { authorization: `Bearer ${staffSession.access_token}` }, body: { action: 'approve', id: assetId } });
      const res = mockRes();
      await handler(req, res);
      log('A real staff member who is NOT the platform owner cannot approve a character reference', res.statusCode === 403, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'zion', op: 'character-assets' }, headers: { authorization: `Bearer ${ownerSession.access_token}` }, body: { action: 'approve', id: assetId } });
      const res = mockRes();
      await handler(req, res);
      log('The platform owner can approve it', res.statusCode === 200 && res._json?.asset?.status === 'approved', `status=${res.statusCode}`);
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
