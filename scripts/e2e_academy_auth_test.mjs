// Nova Sales Academy E2E test (2026-09-23) — verifies api/academy.js's auth gating AND the real
// quiz-grading/certificate-eligibility logic against the live database. Mirrors this repo's
// established e2e_api_client_auth_test.mjs pattern: real throwaway org + Supabase Auth users,
// direct handler() calls with a mocked req/res, cleaned up in a finally block. Safe to re-run.
//
// Specifically checks the gap found and fixed during this feature's build: self-service actions
// must require the `academy.view` permission itself, not just "any active staff member" — a
// client-org role with no academy.view must be rejected here even though it never sees the
// Academy link in the dashboard nav (hidden UI is not authorization).
//
// PREREQUISITE: supabase/schema-update.sql's "Nova Sales Academy" section (academy_programs,
// academy_lessons, academy_quiz_questions, academy_enrollments, academy_quiz_attempts,
// academy_certificates, plus the academy.view permission) must already be applied, including
// its seed content. If it isn't, this fails fast with a clear message rather than silently
// no-op'ing — same discipline as every other schema-dependent test in this project.
// Usage: node scripts/e2e_academy_auth_test.mjs

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
  return pass;
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
  // Fail fast, clearly, if the migration hasn't been applied yet — do not silently no-op.
  const probe = await adminFetch('/rest/v1/academy_programs?select=id&limit=1');
  if (!probe.ok) {
    console.error('academy_programs is not queryable — the Nova Sales Academy migration section');
    console.error('of supabase/schema-update.sql has not been applied to this database yet.');
    console.error('Status:', probe.status, await probe.text());
    process.exit(1);
  }

  const { default: handler } = await import('../api/academy.js');
  const suffix = Date.now();
  const cleanup = [];

  try {
    const orgId = await createOrg(`TEST — academy auth ${suffix}`, `test-academy-auth-${suffix}`);
    cleanup.push(() => deleteOrg(orgId));

    const salesPassword = `Sx${Math.random().toString(36).slice(2)}!9`;
    const adminPassword = `Ax${Math.random().toString(36).slice(2)}!9`;
    const clientPassword = `Cx${Math.random().toString(36).slice(2)}!9`;
    const salesUser = await createAuthUser(`test-academy-sales-${suffix}@example.invalid`, salesPassword);
    const adminUser = await createAuthUser(`test-academy-admin-${suffix}@example.invalid`, adminPassword);
    const clientUser = await createAuthUser(`test-academy-client-${suffix}@example.invalid`, clientPassword);
    cleanup.push(() => deleteAuthUser(salesUser.id), () => deleteAuthUser(adminUser.id), () => deleteAuthUser(clientUser.id));

    await createMembership(orgId, salesUser.id, 'nova_sales');   // has academy.view
    await createMembership(orgId, adminUser.id, 'nova_admin');   // has admin.view (+ everything)
    await createMembership(orgId, clientUser.id, 'client_owner'); // has NEITHER academy.view nor admin.view

    const salesSession = await signIn(salesUser.email, salesPassword);
    const adminSession = await signIn(adminUser.email, adminPassword);
    const clientSession = await signIn(clientUser.email, clientPassword);

    // ---- 1. No Authorization header -> 401 on every protected action ----
    for (const action of ['programs', 'my-enrollments', 'enroll', 'submit-quiz', 'admin-overview']) {
      const req = mockReq({ method: action === 'enroll' || action === 'submit-quiz' ? 'POST' : 'GET', query: { action }, body: {} });
      const res = mockRes();
      await handler(req, res);
      log(`No auth rejected: ${action}`, res.statusCode === 401, `status=${res.statusCode}`);
    }

    // ---- 2. client_owner (no academy.view) is rejected for self-service actions — proves the
    //         fix: hidden-from-nav is not the same as actually blocked server-side ----
    {
      const req = mockReq({ method: 'GET', query: { action: 'programs' }, headers: { authorization: `Bearer ${clientSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      log('client_owner (no academy.view) rejected: programs', res.statusCode === 403, `status=${res.statusCode} body=${JSON.stringify(res._json)}`);
    }

    // ---- 3. nova_sales (has academy.view) passes the gate ----
    {
      const req = mockReq({ method: 'GET', query: { action: 'programs' }, headers: { authorization: `Bearer ${salesSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      log('nova_sales (academy.view) passes: programs', res.statusCode === 200, `status=${res.statusCode}`);
      log('programs list is non-empty (seed content present)', Array.isArray(res._json) && res._json.length === 10, `count=${res._json?.length}`);
    }

    // ---- 4. nova_sales (no admin.view) rejected for admin-only actions ----
    for (const action of ['admin-overview']) {
      const req = mockReq({ method: 'GET', query: { action }, headers: { authorization: `Bearer ${salesSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      log(`nova_sales (no admin.view) rejected: ${action}`, res.statusCode === 403, `status=${res.statusCode}`);
    }

    // ---- 5. Full functional flow: enroll -> pass a non-practical, non-critical program's quiz
    //         -> program completes -> certificate can be issued -> verification works ----
    const fundProgRes = await adminFetch("/rest/v1/academy_programs?slug=eq.nova-fundamentals&select=id,requires_practical&limit=1");
    const [fundamentals] = await fundProgRes.json();
    if (!fundamentals) throw new Error('nova-fundamentals program not found — seed content missing');

    const fundQRes = await adminFetch(`/rest/v1/academy_quiz_questions?program_id=eq.${fundamentals.id}&select=order_index,correct_index`);
    const fundQuestions = await fundQRes.json();
    const allCorrectAnswers = fundQuestions.map((q) => ({ question_order: q.order_index, choice_index: q.correct_index }));

    {
      const req = mockReq({ method: 'POST', query: { action: 'submit-quiz' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { program_id: fundamentals.id, answers: allCorrectAnswers } });
      const res = mockRes();
      await handler(req, res);
      log('All-correct quiz submission scores 100', res._json?.score === 100, `score=${res._json?.score}`);
      log('Non-practical program completes on a passing score', res._json?.enrollment?.status === 'completed', `status=${res._json?.enrollment?.status}`);
    }

    let issuedCertCode = null;
    {
      const req = mockReq({ method: 'POST', query: { action: 'issue-certificate' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { program_id: fundamentals.id } });
      const res = mockRes();
      await handler(req, res);
      log('Certificate issued for a completed program', res.statusCode === 200 && !!res._json?.certificate?.verification_code, `status=${res.statusCode}`);
      issuedCertCode = res._json?.certificate?.verification_code;
    }

    if (issuedCertCode) {
      const req = mockReq({ method: 'GET', query: { action: 'verify-certificate', code: issuedCertCode } });
      const res = mockRes();
      await handler(req, res);
      log('Issued certificate verifies as valid (public, no auth)', res._json?.valid === true, JSON.stringify(res._json));
    } else {
      log('Issued certificate verifies as valid (public, no auth)', false, 'no cert code to test');
    }

    // ---- 6. Certificate cannot be issued for a program that isn't actually completed ----
    const prospProgRes = await adminFetch("/rest/v1/academy_programs?slug=eq.prospecting-and-qualification&select=id&limit=1");
    const [prospecting] = await prospProgRes.json();
    if (prospecting) {
      const req = mockReq({ method: 'POST', query: { action: 'issue-certificate' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { program_id: prospecting.id } });
      const res = mockRes();
      await handler(req, res);
      log('Certificate refused for a not-completed program', res.statusCode === 403, `status=${res.statusCode} body=${JSON.stringify(res._json)}`);
    }

    // ---- 7. Critical-compliance miss forces manual review regardless of overall score ----
    const ethicsProgRes = await adminFetch("/rest/v1/academy_programs?slug=eq.ethics-commission-final-assessment&select=id&limit=1");
    const [ethics] = await ethicsProgRes.json();
    if (ethics) {
      const ethicsQRes = await adminFetch(`/rest/v1/academy_quiz_questions?program_id=eq.${ethics.id}&select=order_index,correct_index,critical`);
      const ethicsQuestions = await ethicsQRes.json();
      // Answer everything correctly EXCEPT deliberately miss the first critical question.
      let missedOneCritical = false;
      const answers = ethicsQuestions.map((q) => {
        if (q.critical && !missedOneCritical) {
          missedOneCritical = true;
          return { question_order: q.order_index, choice_index: (q.correct_index + 1) % 4 };
        }
        return { question_order: q.order_index, choice_index: q.correct_index };
      });

      const req = mockReq({ method: 'POST', query: { action: 'submit-quiz' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { program_id: ethics.id, answers } });
      const res = mockRes();
      await handler(req, res);
      log('Missing a critical question flags critical_failed', res._json?.critical_failed === true, JSON.stringify({ score: res._json?.score, critical_failed: res._json?.critical_failed }));
      log('Critical miss forces awaiting_practical_review regardless of score', res._json?.enrollment?.status === 'awaiting_practical_review', `status=${res._json?.enrollment?.status}`);

      // ---- 8. Admin can approve the practical review, completing the program ----
      const enrollmentId = res._json?.enrollment?.id;
      if (enrollmentId) {
        const reviewReq = mockReq({ method: 'POST', query: { action: 'practical-review' }, headers: { authorization: `Bearer ${adminSession.access_token}` }, body: { enrollment_id: enrollmentId, approved: true, notes: 'e2e test approval' } });
        const reviewRes = mockRes();
        await handler(reviewReq, reviewRes);
        log('Admin approval completes a reviewed enrollment', reviewRes._json?.enrollment?.status === 'completed', `status=${reviewRes._json?.enrollment?.status}`);

        // nova_sales (no admin.view) must NOT be able to self-approve their own practical review.
        const selfApproveReq = mockReq({ method: 'POST', query: { action: 'practical-review' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { enrollment_id: enrollmentId, approved: true } });
        const selfApproveRes = mockRes();
        await handler(selfApproveReq, selfApproveRes);
        log('nova_sales cannot self-approve their own practical review', selfApproveRes.statusCode === 403, `status=${selfApproveRes.statusCode}`);
      } else {
        log('Admin approval completes a reviewed enrollment', false, 'no enrollment id returned');
        log('nova_sales cannot self-approve their own practical review', false, 'no enrollment id returned');
      }
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
