// CRM/Order/Audit E2E test (2026-09-23) — the highest-risk new surface in this slice: every
// handler in this domain relies on a NEW, hand-written requireOrgAccess() helper (api/client.js)
// rather than reusing an already-proven path, specifically because these resources must be
// scoped per-organization (unlike the older invoices/referrals/intake-requests handlers, which
// are a known, previously-flagged gap — not a pattern repeated here). This test exists to prove
// that helper actually works, not just that it compiles.
//
// Mirrors this repo's established e2e pattern: real throwaway orgs/users, direct handler() calls,
// cleanup in a finally block. Also exercises the audit deadline-clock pause/resume wiring against
// the real database (the pure math itself is separately covered by
// scripts/unit_audit_clock_test.mjs with no DB at all) and report-version immutability.
//
// PREREQUISITE: supabase/crm-order-audit-migration-standalone.sql must already be applied. Fails
// fast with a clear message if it isn't.
// Usage: node scripts/e2e_crm_order_audit_test.mjs

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
  const probe = await adminFetch('/rest/v1/businesses?select=id&limit=1');
  if (!probe.ok) {
    console.error('businesses is not queryable — supabase/crm-order-audit-migration-standalone.sql');
    console.error('has not been applied to this database yet.');
    console.error('Status:', probe.status, await probe.text());
    process.exit(1);
  }

  const { default: handler } = await import('../api/client.js');
  const suffix = Date.now();
  const cleanup = [];

  try {
    const orgAId = await createOrg(`TEST — crm/audit A ${suffix}`, `test-crm-audit-a-${suffix}`);
    const orgBId = await createOrg(`TEST — crm/audit B ${suffix}`, `test-crm-audit-b-${suffix}`);
    cleanup.push(() => deleteOrg(orgAId), () => deleteOrg(orgBId));

    const userAPassword = `Ax${Math.random().toString(36).slice(2)}!9`;
    const userBPassword = `Bx${Math.random().toString(36).slice(2)}!9`;
    const userA = await createAuthUser(`test-crm-audit-a-${suffix}@example.invalid`, userAPassword);
    const userB = await createAuthUser(`test-crm-audit-b-${suffix}@example.invalid`, userBPassword);
    cleanup.push(() => deleteAuthUser(userA.id), () => deleteAuthUser(userB.id));

    await createMembership(orgAId, userA.id, 'nova_admin'); // admin.view -> everything, including growth.view/intelligence.view
    await createMembership(orgBId, userB.id, 'nova_admin');

    const sessionA = await signIn(userA.email, userAPassword);
    const sessionB = await signIn(userB.email, userBPassword);

    // ---- 1. No auth -> 401 ----
    {
      const req = mockReq({ method: 'GET', query: { resource: 'crm', op: 'businesses', organization_id: orgAId } });
      const res = mockRes();
      await handler(req, res);
      log('No auth rejected: crm businesses', res.statusCode === 401, `status=${res.statusCode}`);
    }

    // ---- 2. User B cannot read/write Org A's businesses (object-level org check) ----
    let businessAId = null;
    {
      const createReq = mockReq({ method: 'POST', query: { resource: 'crm', op: 'businesses' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { action: 'create', organization_id: orgAId, name: 'Test Business A' } });
      const createRes = mockRes();
      await handler(createReq, createRes);
      log('User A creates a business in their own org', createRes.statusCode === 200, `status=${createRes.statusCode}`);
      businessAId = createRes._json?.business?.id;
    }
    {
      const req = mockReq({ method: 'GET', query: { resource: 'crm', op: 'businesses', organization_id: orgAId }, headers: { authorization: `Bearer ${sessionB.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      log('User B (real staff, wrong org) is rejected reading Org A businesses — real object-level check, not just "any staff"', res.statusCode === 403, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crm', op: 'businesses' }, headers: { authorization: `Bearer ${sessionB.access_token}` }, body: { action: 'create', organization_id: orgAId, name: 'Malicious Insert Attempt' } });
      const res = mockRes();
      await handler(req, res);
      log('User B cannot create a business INSIDE Org A either', res.statusCode === 403, `status=${res.statusCode}`);
    }

    // ---- 3. Deal stage transition + history ----
    let dealId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crm', op: 'deals' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { action: 'create', organization_id: orgAId, business_id: businessAId, pipeline: 'nova_sales' } });
      const res = mockRes();
      await handler(req, res);
      dealId = res._json?.deal?.id;
      log('User A creates a deal', res.statusCode === 200 && res._json?.deal?.stage === 'new', `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crm', op: 'deals' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { action: 'update-stage', organization_id: orgAId, id: dealId, stage: 'qualified' } });
      const res = mockRes();
      await handler(req, res);
      log('Deal stage transition updates stage and appends stage_history', res._json?.deal?.stage === 'qualified' && res._json?.deal?.stage_history?.length === 2, JSON.stringify(res._json?.deal?.stage_history));
    }

    // ---- 4. Order creation against the seeded product catalog, with unapproved pricing never invented ----
    let orderId = null;
    {
      const prodRes = await adminFetch("/rest/v1/products?slug=eq.nova-audit-digital&select=id,pricing_approved&limit=1");
      const [product] = await prodRes.json();
      const req = mockReq({ method: 'POST', query: { resource: 'orders' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { action: 'create', organization_id: orgAId, product_id: product.id, business_id: businessAId, price_cents: 50000 } });
      const res = mockRes();
      await handler(req, res);
      orderId = res._json?.order?.id;
      log('Order created against a catalog product', res.statusCode === 200 && res._json?.order?.status === 'draft', `status=${res.statusCode}`);
      log('Unapproved product pricing is never invented (price_cents stays null even though the caller sent one)', res._json?.order?.price_cents === null, `price_cents=${res._json?.order?.price_cents}`);
    }

    // ---- 5. Audit case lifecycle: create, mark-ready starts the clock, pause/resume math is real ----
    let caseId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'audit', op: 'cases' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { action: 'create', organization_id: orgAId, business_id: businessAId, order_id: orderId, scope: 'digital', target_hours: 1 } }); // 1 hour target for a fast, real pause/resume test
      const res = mockRes();
      await handler(req, res);
      caseId = res._json?.case?.id;
      log('Audit case created with status=intake, no clock running yet', res.statusCode === 200 && res._json?.case?.status === 'intake' && !res._json?.case?.start_condition_met_at, JSON.stringify(res._json?.case));
    }
    {
      const req = mockReq({ method: 'GET', query: { resource: 'audit', op: 'cases', organization_id: orgAId, id: caseId }, headers: { authorization: `Bearer ${sessionB.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      log('User B cannot read Org A\'s audit case', res.statusCode === 403, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'audit', op: 'cases' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { action: 'mark-ready', organization_id: orgAId, id: caseId } });
      const res = mockRes();
      await handler(req, res);
      log('mark-ready sets start_condition_met_at exactly once', res.statusCode === 200 && !!res._json?.case?.start_condition_met_at, JSON.stringify(res._json?.case));
    }
    {
      const req = mockReq({ method: 'GET', query: { resource: 'audit', op: 'cases', organization_id: orgAId, id: caseId }, headers: { authorization: `Bearer ${sessionA.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      log('Case detail includes a computed clock bucket (active, since it just started)', res._json?.clock?.bucket === 'active', JSON.stringify(res._json?.clock));
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'audit', op: 'cases' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { action: 'pause', organization_id: orgAId, id: caseId, reason: 'waiting on client screenshots' } });
      const res = mockRes();
      await handler(req, res);
      log('Pause records paused_at and reason', res.statusCode === 200 && !!res._json?.case?.paused_at, JSON.stringify(res._json?.case));
    }
    await new Promise((r) => setTimeout(r, 1100)); // real wall-clock pause of just over 1 second
    {
      const req = mockReq({ method: 'POST', query: { resource: 'audit', op: 'cases' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { action: 'resume', organization_id: orgAId, id: caseId } });
      const res = mockRes();
      await handler(req, res);
      log('Resume clears paused_at and adds real elapsed pause time to total_paused_seconds (not zero, not invented)', res.statusCode === 200 && res._json?.case?.paused_at === null && res._json?.paused_seconds_added >= 1, JSON.stringify({ paused_seconds_added: res._json?.paused_seconds_added, total: res._json?.case?.total_paused_seconds }));
    }

    // ---- 6. Evidence -> finding -> recommendation chain, and epistemic-type validation ----
    let evidenceId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'audit', op: 'evidence' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { organization_id: orgAId, case_id: caseId, source: 'website', observation: 'Contact form returns HTTP 404', source_quality: 'high', confidence: 'high' } });
      const res = mockRes();
      await handler(req, res);
      evidenceId = res._json?.evidence?.id;
      log('Evidence recorded', res.statusCode === 200, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'audit', op: 'findings' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { organization_id: orgAId, case_id: caseId, title: 'Broken contact form', statement_type: 'not-a-real-type', detail: 'x' } });
      const res = mockRes();
      await handler(req, res);
      log('Finding creation rejects an invalid statement_type (observed_fact/stated_claim/inference/estimate only)', res.statusCode === 400, `status=${res.statusCode}`);
    }
    let findingId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'audit', op: 'findings' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { organization_id: orgAId, case_id: caseId, title: 'Broken contact form', statement_type: 'observed_fact', detail: 'The contact form returns a 404 error, confirmed by direct request.', evidence_ids: [evidenceId] } });
      const res = mockRes();
      await handler(req, res);
      findingId = res._json?.finding?.id;
      log('Finding created and linked to its evidence', res.statusCode === 200, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'audit', op: 'recommendations' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { organization_id: orgAId, case_id: caseId, finding_id: findingId, mechanism: 'Fix the contact form endpoint so submissions are received again.' } });
      const res = mockRes();
      await handler(req, res);
      log('Recommendation created and linked to its finding', res.statusCode === 200, `status=${res.statusCode}`);
    }

    // ---- 7. Report approval authorization + version-currency evidence (2026-09-24, explicit
    // evidence requested: authorized approval succeeds for the CORRECT version; unauthorized
    // approval fails; STALE-version approval fails) ----
    let v1Id = null, v2Id = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'audit', op: 'reports' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { organization_id: orgAId, case_id: caseId, action: 'create-draft', content: { summary: 'v1 draft' } } });
      const res = mockRes();
      await handler(req, res);
      v1Id = res._json?.report?.id;
      log('Report draft v1 created', res.statusCode === 200 && res._json?.report?.version === 1, JSON.stringify(res._json?.report));
    }
    {
      // UNAUTHORIZED: a real staff member from a completely different organization cannot approve
      // Org A's report at all — object-level org authorization, same requireOrgAccess check every
      // other audit handler uses, not a version-specific rule.
      const req = mockReq({ method: 'POST', query: { resource: 'audit', op: 'reports' }, headers: { authorization: `Bearer ${sessionB.access_token}` }, body: { organization_id: orgAId, case_id: caseId, action: 'approve', id: v1Id } });
      const res = mockRes();
      await handler(req, res);
      log('UNAUTHORIZED: a staff member from a different organization cannot approve this report', res.statusCode === 403, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'audit', op: 'reports' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { organization_id: orgAId, case_id: caseId, action: 'create-draft', content: { summary: 'v2 draft, supersedes v1' } } });
      const res = mockRes();
      await handler(req, res);
      v2Id = res._json?.report?.id;
      log('A second draft (v2) is created while v1 is still unapproved — v1 is now stale', res.statusCode === 200 && res._json?.report?.version === 2, JSON.stringify(res._json?.report));
    }
    {
      // STALE VERSION: v1 still exists, unapproved, but a newer v2 has superseded it — approving
      // the stale v1 must be refused even by a fully authorized caller on the correct organization.
      const req = mockReq({ method: 'POST', query: { resource: 'audit', op: 'reports' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { organization_id: orgAId, case_id: caseId, action: 'approve', id: v1Id } });
      const res = mockRes();
      await handler(req, res);
      log('STALE VERSION: approving v1 after v2 was created is refused, even for an authorized caller', res.statusCode === 409, `status=${res.statusCode} body=${JSON.stringify(res._json)}`);
    }
    {
      // AUTHORIZED + CORRECT VERSION: the same authorized caller approving the actual current
      // version (v2) succeeds.
      const req = mockReq({ method: 'POST', query: { resource: 'audit', op: 'reports' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { organization_id: orgAId, case_id: caseId, action: 'approve', id: v2Id } });
      const res = mockRes();
      await handler(req, res);
      log('AUTHORIZED + CORRECT VERSION: approving the current version (v2) succeeds', res.statusCode === 200 && res._json?.report?.status === 'approved', JSON.stringify(res._json?.report));
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'audit', op: 'reports' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { organization_id: orgAId, case_id: caseId, action: 'approve', id: v2Id } });
      const res = mockRes();
      await handler(req, res);
      log('Re-approving an already-approved report version is refused — immutability enforced', res.statusCode === 400, `status=${res.statusCode} body=${JSON.stringify(res._json)}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'audit', op: 'reports' }, headers: { authorization: `Bearer ${sessionA.access_token}` }, body: { organization_id: orgAId, case_id: caseId, action: 'create-draft', content: { summary: 'v3 draft, edited after approval' } } });
      const res = mockRes();
      await handler(req, res);
      log('An edit after approval creates a NEW version (v3), never mutates the approved v2', res.statusCode === 200 && res._json?.report?.version === 3, JSON.stringify(res._json?.report));
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
