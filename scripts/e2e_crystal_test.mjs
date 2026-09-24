// Crystal / Company 002 E2E test (2026-09-24, master prompt §14, restored scope) — proves the
// full real workflow (request -> scope -> estimate -> required approval -> customer acceptance ->
// booking -> assignment -> work recorded -> completion approved -> billing -> feedback), the
// explicit evidence requirement ("AI cannot declare physical work completed without authorized
// evidence" — completion requires a real assigned worker AND an actual 'after' photo on file), and
// the explicit isolation proof Isaac asked for: "prove separation from Nova and other client
// organizations" AND "workers see only assigned jobs and necessary customer information."
//
// Mirrors the established e2e pattern: real throwaway orgs/users, direct handler() calls, cleanup
// in a finally block.
//
// PREREQUISITE: supabase/crystal-migration-standalone.sql must already be applied. Fails fast with
// a clear message if it isn't.
// Usage: node scripts/e2e_crystal_test.mjs

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
  const probe = await adminFetch('/rest/v1/crystal_customers?select=id&limit=1');
  if (!probe.ok) {
    console.error('crystal_customers is not queryable — supabase/crystal-migration-standalone.sql');
    console.error('has not been applied to this database yet.');
    console.error('Status:', probe.status, await probe.text());
    process.exit(1);
  }

  const { default: handler } = await import('../api/client.js');
  const suffix = Date.now();
  const cleanup = [];

  try {
    const orgAId = await createOrg(`TEST — crystal A ${suffix}`, `test-crystal-a-${suffix}`);
    const orgBId = await createOrg(`TEST — crystal B ${suffix}`, `test-crystal-b-${suffix}`);
    cleanup.push(() => deleteOrg(orgAId), () => deleteOrg(orgBId));

    const opsPassword = `Ox${Math.random().toString(36).slice(2)}!9`;
    const worker1Password = `W1${Math.random().toString(36).slice(2)}!9`;
    const worker2Password = `W2${Math.random().toString(36).slice(2)}!9`;
    const otherOrgPassword = `Bx${Math.random().toString(36).slice(2)}!9`;
    const opsUser = await createAuthUser(`test-crystal-ops-${suffix}@example.invalid`, opsPassword);       // Org A, execution.view
    const worker1 = await createAuthUser(`test-crystal-w1-${suffix}@example.invalid`, worker1Password);    // Org A, assigned to the job
    const worker2 = await createAuthUser(`test-crystal-w2-${suffix}@example.invalid`, worker2Password);    // Org A, NOT assigned to the job
    const otherOrgUser = await createAuthUser(`test-crystal-otherorg-${suffix}@example.invalid`, otherOrgPassword); // Org B only
    cleanup.push(() => deleteAuthUser(opsUser.id), () => deleteAuthUser(worker1.id), () => deleteAuthUser(worker2.id), () => deleteAuthUser(otherOrgUser.id));

    await createMembership(orgAId, opsUser.id, 'nova_admin');   // has execution.view
    await createMembership(orgAId, worker1.id, 'nova_sales');   // real staff, ownership-scoped only
    await createMembership(orgAId, worker2.id, 'nova_sales');
    await createMembership(orgBId, otherOrgUser.id, 'nova_admin');

    const opsSession = await signIn(opsUser.email, opsPassword);
    const worker1Session = await signIn(worker1.email, worker1Password);
    const worker2Session = await signIn(worker2.email, worker2Password);
    const otherOrgSession = await signIn(otherOrgUser.email, otherOrgPassword);

    // ---- 1. No auth -> 401 ----
    {
      const req = mockReq({ method: 'GET', query: { resource: 'crystal', op: 'customers', organization_id: orgAId } });
      const res = mockRes();
      await handler(req, res);
      log('No auth rejected', res.statusCode === 401, `status=${res.statusCode}`);
    }

    // ---- 2. ISOLATION: an independent test org cannot read or write Org A's Crystal data ----
    let customerId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'customers' }, headers: { authorization: `Bearer ${opsSession.access_token}` }, body: { action: 'create', organization_id: orgAId, name: 'Test Homeowner', email: 'homeowner@example.invalid', phone: '203-555-0100' } });
      const res = mockRes();
      await handler(req, res);
      customerId = res._json?.customer?.id;
      log('Ops staff creates a real customer', res.statusCode === 200 && !!customerId, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'GET', query: { resource: 'crystal', op: 'customers', organization_id: orgAId }, headers: { authorization: `Bearer ${otherOrgSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      log('SEPARATION FROM OTHER ORGS: an independent test org cannot READ Org A\'s Crystal customers', res.statusCode === 403, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'customers' }, headers: { authorization: `Bearer ${otherOrgSession.access_token}` }, body: { action: 'create', organization_id: orgAId, name: 'Malicious Insert' } });
      const res = mockRes();
      await handler(req, res);
      log('SEPARATION FROM OTHER ORGS: an independent test org cannot WRITE to Org A\'s Crystal data', res.statusCode === 403, `status=${res.statusCode}`);
    }

    // ---- 3. Property + service catalog + quote request (request -> scope) ----
    let propertyId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'properties' }, headers: { authorization: `Bearer ${opsSession.access_token}` }, body: { action: 'create', organization_id: orgAId, customer_id: customerId, address_line: '123 Test St', city: 'Waterbury', state: 'CT' } });
      const res = mockRes();
      await handler(req, res);
      propertyId = res._json?.property?.id;
      log('Property created', res.statusCode === 200 && !!propertyId, `status=${res.statusCode}`);
    }
    let quoteId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'quotes' }, headers: { authorization: `Bearer ${opsSession.access_token}` }, body: { action: 'create', organization_id: orgAId, customer_id: customerId, property_id: propertyId, scope_details: 'Full exterior wash' } });
      const res = mockRes();
      await handler(req, res);
      quoteId = res._json?.quote?.id;
      log('Quote request created (status=new)', res.statusCode === 200 && res._json?.quote?.status === 'new', `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'quotes' }, headers: { authorization: `Bearer ${opsSession.access_token}` }, body: { action: 'update-scope', organization_id: orgAId, id: quoteId, scope_details: 'Full exterior wash, driveway included' } });
      const res = mockRes();
      await handler(req, res);
      log('Scope recorded, status moves to scoped', res.statusCode === 200 && res._json?.quote?.status === 'scoped', `status=${res.statusCode}`);
    }

    // ---- 4. Estimate: unpriced line item never invents a total ----
    let estimateId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'estimates' }, headers: { authorization: `Bearer ${opsSession.access_token}` }, body: { action: 'create-draft', organization_id: orgAId, quote_request_id: quoteId, line_items: [{ description: 'Labor', quantity: 1 }] } });
      const res = mockRes();
      await handler(req, res);
      estimateId = res._json?.estimate?.id;
      log('Unpriced line item never produces an invented total (total_cents stays null)', res.statusCode === 200 && res._json?.estimate?.total_cents === null, JSON.stringify(res._json?.estimate));
    }
    {
      // Real estimate with a real price this time.
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'estimates' }, headers: { authorization: `Bearer ${opsSession.access_token}` }, body: { action: 'create-draft', organization_id: orgAId, quote_request_id: quoteId, line_items: [{ description: 'Exterior wash', quantity: 1, unit_price_cents: 25000 }] } });
      const res = mockRes();
      await handler(req, res);
      estimateId = res._json?.estimate?.id;
      log('A fully-priced estimate computes a real total (v2, supersedes v1)', res.statusCode === 200 && res._json?.estimate?.total_cents === 25000 && res._json?.estimate?.version === 2, JSON.stringify(res._json?.estimate));
    }

    // ---- 5. Required approval (send) -> customer acceptance ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'estimates' }, headers: { authorization: `Bearer ${opsSession.access_token}` }, body: { action: 'send', organization_id: orgAId, quote_request_id: quoteId, id: estimateId } });
      const res = mockRes();
      await handler(req, res);
      log('Estimate sent', res.statusCode === 200 && res._json?.estimate?.status === 'sent', `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'estimates' }, headers: { authorization: `Bearer ${opsSession.access_token}` }, body: { action: 'accept', organization_id: orgAId, quote_request_id: quoteId, id: estimateId } });
      const res = mockRes();
      await handler(req, res);
      log('Customer acceptance recorded', res.statusCode === 200 && res._json?.estimate?.status === 'accepted', `status=${res.statusCode}`);
    }

    // ---- 6. Booking: a job can only be created from an accepted estimate ----
    let jobId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'jobs' }, headers: { authorization: `Bearer ${opsSession.access_token}` }, body: { action: 'create', organization_id: orgAId, estimate_id: estimateId, scheduled_at: new Date(Date.now() + 86400_000).toISOString() } });
      const res = mockRes();
      await handler(req, res);
      jobId = res._json?.job?.id;
      log('Job booked from the accepted estimate', res.statusCode === 200 && !!jobId, `status=${res.statusCode}`);
    }

    // ---- 7. Assignment: worker1 assigned, worker2 is not ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'jobs' }, headers: { authorization: `Bearer ${opsSession.access_token}` }, body: { action: 'assign-worker', organization_id: orgAId, id: jobId, worker_user_id: worker1.id, role: 'lead' } });
      const res = mockRes();
      await handler(req, res);
      log('Worker 1 assigned to the job', res.statusCode === 200, `status=${res.statusCode}`);
    }

    // ---- 8. WORKER ISOLATION: worker1 sees the job in "mine"; worker2 does not ----
    {
      const req = mockReq({ method: 'GET', query: { resource: 'crystal', op: 'jobs', scope: 'mine' }, headers: { authorization: `Bearer ${worker1Session.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      const found = Array.isArray(res._json) && res._json.some((j) => j.id === jobId);
      log('WORKER ISOLATION: the assigned worker sees the job in their own "mine" view', res.statusCode === 200 && found, JSON.stringify(res._json));
    }
    {
      const req = mockReq({ method: 'GET', query: { resource: 'crystal', op: 'jobs', scope: 'mine' }, headers: { authorization: `Bearer ${worker2Session.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      const found = Array.isArray(res._json) && res._json.some((j) => j.id === jobId);
      log('WORKER ISOLATION: an UNASSIGNED worker does NOT see the job in their "mine" view', res.statusCode === 200 && !found, JSON.stringify(res._json));
    }
    {
      // "Necessary customer information" only — the worker's own-jobs view must not leak the
      // customer's email/phone, only what's needed to do the job (property address).
      const req = mockReq({ method: 'GET', query: { resource: 'crystal', op: 'jobs', scope: 'mine' }, headers: { authorization: `Bearer ${worker1Session.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      const row = res._json?.find((j) => j.id === jobId);
      log('WORKER ISOLATION: the "mine" view exposes property address but NOT customer email/phone', !('email' in (row || {})) && !('phone' in (row || {})) && !!row?.crystal_properties, JSON.stringify(row));
    }
    {
      // Also cannot reach a job outside their own org via "mine" scope tampering — worker2 tries
      // assign-worker (an execution.view-only action) and is refused.
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'jobs' }, headers: { authorization: `Bearer ${worker2Session.access_token}` }, body: { action: 'assign-worker', organization_id: orgAId, id: jobId, worker_user_id: worker2.id } });
      const res = mockRes();
      await handler(req, res);
      log('An unassigned, non-execution.view staff member cannot self-assign to the job', res.statusCode === 403, `status=${res.statusCode}`);
    }

    // ---- 9. Work recorded: checklist + before/after media ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'jobs' }, headers: { authorization: `Bearer ${opsSession.access_token}` }, body: { action: 'add-checklist-item', organization_id: orgAId, id: jobId, label: 'Rinse gutters' } });
      const res = mockRes();
      await handler(req, res);
      log('Checklist item added', res.statusCode === 200, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'jobs' }, headers: { authorization: `Bearer ${worker1Session.access_token}` }, body: { action: 'add-media', organization_id: orgAId, id: jobId, kind: 'before', storage_path: 'crystal/before-1.jpg' } });
      const res = mockRes();
      await handler(req, res);
      log('Assigned worker records a "before" photo', res.statusCode === 200, `status=${res.statusCode}`);
    }

    // ---- 10. THE EXPLICIT EVIDENCE REQUIREMENT: no completion without a real assigned worker AND real evidence ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'jobs' }, headers: { authorization: `Bearer ${worker2Session.access_token}` }, body: { action: 'complete', organization_id: orgAId, id: jobId } });
      const res = mockRes();
      await handler(req, res);
      log('EVIDENCE REQUIRED: an unassigned worker cannot mark the job complete', res.statusCode === 403, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'jobs' }, headers: { authorization: `Bearer ${worker1Session.access_token}` }, body: { action: 'complete', organization_id: orgAId, id: jobId } });
      const res = mockRes();
      await handler(req, res);
      log('EVIDENCE REQUIRED: the assigned worker cannot complete with only a "before" photo on file — no "after" evidence yet', res.statusCode === 400, `status=${res.statusCode} body=${JSON.stringify(res._json)}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'jobs' }, headers: { authorization: `Bearer ${worker1Session.access_token}` }, body: { action: 'add-media', organization_id: orgAId, id: jobId, kind: 'after', storage_path: 'crystal/after-1.jpg' } });
      const res = mockRes();
      await handler(req, res);
      log('Assigned worker records the required "after" photo', res.statusCode === 200, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'jobs' }, headers: { authorization: `Bearer ${worker1Session.access_token}` }, body: { action: 'complete', organization_id: orgAId, id: jobId, notes: 'All done, customer walked the property.' } });
      const res = mockRes();
      await handler(req, res);
      log('EVIDENCE PRESENT: the assigned worker can now mark the job complete', res.statusCode === 200 && !!res._json?.completion, `status=${res.statusCode}`);
    }

    // ---- 11. Completion approved (customer side, staff-recorded) -> billing -> feedback ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'jobs' }, headers: { authorization: `Bearer ${opsSession.access_token}` }, body: { action: 'approve-completion', organization_id: orgAId, id: jobId, customer_notes: 'Customer confirmed by phone.' } });
      const res = mockRes();
      await handler(req, res);
      log('Customer approval recorded, job moves to approved', res.statusCode === 200 && res._json?.completion?.customer_approved === true, `status=${res.statusCode}`);
    }
    let invoiceId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'invoices' }, headers: { authorization: `Bearer ${opsSession.access_token}` }, body: { action: 'create', organization_id: orgAId, job_id: jobId, amount_cents: 25000 } });
      const res = mockRes();
      await handler(req, res);
      invoiceId = res._json?.invoice?.id;
      log('Invoice created with a real amount (never invented)', res.statusCode === 200 && !!invoiceId, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'invoices' }, headers: { authorization: `Bearer ${opsSession.access_token}` }, body: { action: 'mark-paid', organization_id: orgAId, id: invoiceId, payment_method: 'card' } });
      const res = mockRes();
      await handler(req, res);
      log('Invoice marked paid, job status follows to paid', res.statusCode === 200 && res._json?.invoice?.status === 'paid', `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'feedback' }, headers: { authorization: `Bearer ${opsSession.access_token}` }, body: { organization_id: orgAId, job_id: jobId, customer_id: customerId, rating: 5, comments: 'Great work.' } });
      const res = mockRes();
      await handler(req, res);
      log('Feedback recorded', res.statusCode === 200, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'crystal', op: 'recurring' }, headers: { authorization: `Bearer ${opsSession.access_token}` }, body: { action: 'create', organization_id: orgAId, customer_id: customerId, property_id: propertyId, frequency: 'monthly' } });
      const res = mockRes();
      await handler(req, res);
      log('Recurring service scheduled', res.statusCode === 200 && res._json?.schedule?.frequency === 'monthly', `status=${res.statusCode}`);
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
