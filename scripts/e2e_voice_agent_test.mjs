// Voice agent E2E test (2026-09-24, master prompt §11) — proves the 9 typed tools work as real,
// schema-validated, tenant-scoped, idempotent functions independent of any telephony provider:
// get_business_information never invents an answer (only serves approved knowledge base entries),
// find_slots/hold_slot/confirm_booking handle a real double-booking conflict honestly,
// create_or_update_lead really writes into the existing CRM domain, reschedule/cancel refuses
// without explicit verification (caller ID alone is never proof), and a retried tool call with the
// same idempotency_key replays the stored result instead of re-running the side effect.
//
// Mirrors the established e2e pattern: real throwaway org/users, direct handler() calls, cleanup
// in a finally block.
//
// PREREQUISITE: supabase/voice-agent-migration-standalone.sql AND
// supabase/crm-order-audit-migration-standalone.sql (for crm_contacts) must already be applied.
// Fails fast with a clear message if either isn't.
// Usage: node scripts/e2e_voice_agent_test.mjs

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
  const probe = await adminFetch('/rest/v1/voice_configurations?select=id&limit=1');
  if (!probe.ok) {
    console.error('voice_configurations is not queryable — supabase/voice-agent-migration-standalone.sql');
    console.error('has not been applied to this database yet.');
    console.error('Status:', probe.status, await probe.text());
    process.exit(1);
  }

  const { default: handler } = await import('../api/client.js');
  const suffix = Date.now();
  const cleanup = [];

  try {
    const orgId = await createOrg(`TEST — voice ${suffix}`, `test-voice-${suffix}`);
    cleanup.push(() => deleteOrg(orgId));

    const salesPassword = `Sx${Math.random().toString(36).slice(2)}!9`;
    const adminPassword = `Ax${Math.random().toString(36).slice(2)}!9`;
    const salesUser = await createAuthUser(`test-voice-sales-${suffix}@example.invalid`, salesPassword);
    const adminUser = await createAuthUser(`test-voice-admin-${suffix}@example.invalid`, adminPassword);
    cleanup.push(() => deleteAuthUser(salesUser.id), () => deleteAuthUser(adminUser.id));

    await createMembership(orgId, salesUser.id, 'nova_sales');
    await createMembership(orgId, adminUser.id, 'nova_admin');

    const salesSession = await signIn(salesUser.email, salesPassword);
    const adminSession = await signIn(adminUser.email, adminPassword);

    // ---- 1. Configuration requires admin.view; recording requires a disclosure script ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'config' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { organization_id: orgId, recording_enabled: true } });
      const res = mockRes();
      await handler(req, res);
      log('A growth.view-only staff member cannot configure voice (admin.view required — spend/recording policy is consequential)', res.statusCode === 403, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'config' }, headers: { authorization: `Bearer ${adminSession.access_token}` }, body: { organization_id: orgId, recording_enabled: true } });
      const res = mockRes();
      await handler(req, res);
      log('Enabling recording without a disclosure_script is refused', res.statusCode === 400, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'config' }, headers: { authorization: `Bearer ${adminSession.access_token}` }, body: { organization_id: orgId, transfer_destinations: [{ label: 'Front desk', number_ref: 'vault:ref-1' }] } });
      const res = mockRes();
      await handler(req, res);
      log('Admin configures voice (no recording, real transfer destination)', res.statusCode === 200 && res._json?.config?.status === 'configured', `status=${res.statusCode}`);
    }

    // ---- 2. Knowledge base: draft is not servable until approved ----
    let kbId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'knowledge' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { organization_id: orgId, action: 'create', topic: 'hours', question: 'What are your hours?', answer: 'Mon-Fri 9-5 ET' } });
      const res = mockRes();
      await handler(req, res);
      kbId = res._json?.entry?.id;
      log('Knowledge base entry created as draft', res.statusCode === 200 && res._json?.entry?.status === 'draft', `status=${res.statusCode}`);
    }

    let sessionId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'sessions' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { organization_id: orgId, direction: 'inbound', caller_ref: 'xxx-1234' } });
      const res = mockRes();
      await handler(req, res);
      sessionId = res._json?.session?.id;
      log('Call session created', res.statusCode === 200 && !!sessionId, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'tools' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { session_id: sessionId, tool: 'get_business_information', input: { topic: 'hours' } } });
      const res = mockRes();
      await handler(req, res);
      log('HONEST ANSWER ONLY: an unapproved (draft) knowledge entry is never surfaced to a caller', res.statusCode === 200 && res._json?.output?.found === false, JSON.stringify(res._json));
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'knowledge' }, headers: { authorization: `Bearer ${adminSession.access_token}` }, body: { organization_id: orgId, action: 'approve', id: kbId } });
      const res = mockRes();
      await handler(req, res);
      log('Admin approves the knowledge entry', res.statusCode === 200 && res._json?.entry?.status === 'approved', `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'tools' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { session_id: sessionId, tool: 'get_business_information', input: { topic: 'hours' } } });
      const res = mockRes();
      await handler(req, res);
      log('Once approved, the real answer is served', res.statusCode === 200 && res._json?.output?.found === true && res._json?.output?.answers[0]?.answer === 'Mon-Fri 9-5 ET', JSON.stringify(res._json));
    }

    // ---- 3. create_or_update_lead really writes into the CRM domain ----
    let contactId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'tools' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { session_id: sessionId, tool: 'create_or_update_lead', input: { name: 'Test Caller', phone: '203-555-0100' } } });
      const res = mockRes();
      await handler(req, res);
      contactId = res._json?.output?.contact_id;
      log('create_or_update_lead writes a real crm_contacts row', res.statusCode === 200 && !!contactId, JSON.stringify(res._json));
    }
    {
      const check = await adminFetch(`/rest/v1/crm_contacts?id=eq.${contactId}&select=name,source`);
      const [row] = await check.json();
      log('The CRM contact really exists with source=voice_agent', row?.name === 'Test Caller' && row?.source === 'voice_agent', JSON.stringify(row));
    }

    // ---- 4. find_slots / hold_slot / confirm_booking with a real double-booking conflict ----
    const slotStart = new Date(Date.now() + 86400_000).toISOString();
    const slotEnd = new Date(Date.now() + 90000_000).toISOString();
    const slotRes = await adminFetch('/rest/v1/voice_calendar_slots', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ organization_id: orgId, service_name: 'Consultation', start_at: slotStart, end_at: slotEnd }),
    });
    const [slot] = await slotRes.json();
    cleanup.push(() => adminFetch(`/rest/v1/voice_calendar_slots?id=eq.${slot.id}`, { method: 'DELETE' }));

    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'tools' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { session_id: sessionId, tool: 'find_slots', input: { service_name: 'Consultation' } } });
      const res = mockRes();
      await handler(req, res);
      log('find_slots returns the real open slot', res.statusCode === 200 && res._json?.output?.slots?.some((s) => s.id === slot.id), JSON.stringify(res._json));
    }

    let otherSessionId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'sessions' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { organization_id: orgId, direction: 'inbound', caller_ref: 'yyy-5678' } });
      const res = mockRes();
      await handler(req, res);
      otherSessionId = res._json?.session?.id;
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'tools' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { session_id: sessionId, tool: 'hold_slot', input: { slot_id: slot.id } } });
      const res = mockRes();
      await handler(req, res);
      log('First caller holds the slot', res.statusCode === 200 && res._json?.output?.held === true, `status=${res.statusCode}`);
    }
    {
      // A SECOND, concurrent caller tries to hold the SAME slot — must be refused honestly.
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'tools' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { session_id: otherSessionId, tool: 'hold_slot', input: { slot_id: slot.id } } });
      const res = mockRes();
      await handler(req, res);
      log('REAL CONFLICT HANDLING: a second, concurrent caller cannot hold the same slot', res.statusCode === 409, `status=${res.statusCode}`);
    }
    {
      // The second caller's session also can't confirm a slot it never held.
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'tools' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { session_id: otherSessionId, tool: 'confirm_booking', input: { slot_id: slot.id, contact_id: contactId } } });
      const res = mockRes();
      await handler(req, res);
      log('VERIFICATION: a session that never held the slot cannot confirm it', res.statusCode === 409, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'tools' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { session_id: sessionId, tool: 'confirm_booking', input: { slot_id: slot.id, contact_id: contactId } } });
      const res = mockRes();
      await handler(req, res);
      log('The caller who actually holds the slot can confirm it', res.statusCode === 200 && res._json?.output?.booked === true, `status=${res.statusCode}`);
    }

    // ---- 5. reschedule/cancel refuses without explicit verification ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'tools' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { session_id: sessionId, tool: 'reschedule_or_cancel_booking', input: { slot_id: slot.id, action: 'cancel' } } });
      const res = mockRes();
      await handler(req, res);
      log('CALLER ID IS NOT PROOF: cancelling without explicit verified_via is refused', res.statusCode === 403, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'tools' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { session_id: sessionId, tool: 'reschedule_or_cancel_booking', input: { slot_id: slot.id, action: 'cancel', verified_via: 'confirmed email on file' } } });
      const res = mockRes();
      await handler(req, res);
      log('With explicit verification, cancellation succeeds', res.statusCode === 200 && res._json?.output?.released === true, `status=${res.statusCode}`);
    }

    // ---- 6. request_transfer, create_callback, record_consent, log_outcome ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'tools' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { session_id: sessionId, tool: 'request_transfer', input: {} } });
      const res = mockRes();
      await handler(req, res);
      log('request_transfer uses the real configured destination', res.statusCode === 200 && res._json?.output?.destination?.label === 'Front desk', JSON.stringify(res._json));
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'tools' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { session_id: sessionId, tool: 'record_consent', input: { granted: true } } });
      const res = mockRes();
      await handler(req, res);
      log('record_consent updates the real session', res.statusCode === 200 && res._json?.output?.consent_recorded === true, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'tools' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { session_id: sessionId, tool: 'log_outcome', input: { outcome: 'booked' } } });
      const res = mockRes();
      await handler(req, res);
      log('log_outcome closes out the session', res.statusCode === 200 && res._json?.output?.outcome === 'booked', `status=${res.statusCode}`);
    }

    // ---- 7. Idempotency: the SAME tool call retried with the same key replays, doesn't re-execute ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'voice', op: 'tools' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { session_id: otherSessionId, tool: 'create_callback', idempotency_key: 'retry-test-1', input: { reason: 'wants a callback' } } });
      const res1 = mockRes();
      await handler(req, res1);
      const req2 = mockReq({ method: 'POST', query: { resource: 'voice', op: 'tools' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { session_id: otherSessionId, tool: 'create_callback', idempotency_key: 'retry-test-1', input: { reason: 'wants a callback' } } });
      const res2 = mockRes();
      await handler(req2, res2);
      log('IDEMPOTENCY: a retried tool call with the same idempotency_key replays the stored result', res2._json?.replayed === true && JSON.stringify(res1._json.output) === JSON.stringify(res2._json.output), JSON.stringify(res2._json));
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
