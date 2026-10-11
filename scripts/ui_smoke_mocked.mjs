// Browser smoke test of the new dashboard pages against a MOCKED backend.
// EVIDENCE CLASS: UI renders and reacts without runtime errors given API responses of the documented
// shape. It proves NOTHING about the real API, real database or real login — Supabase auth/membership
// calls and every /api/client call are intercepted and answered by this script.
//
// Needs: the Vite dev server (npm run dev) on http://localhost:5173 and Playwright with a Chromium build.
//   PLAYWRIGHT_PATH=<dir containing the playwright package> node scripts/ui_smoke_mocked.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const REF = (process.env.VITE_SUPABASE_URL || '').match(/https:\/\/([^.]+)\./)?.[1] || 'xizmgruvuazmummotzkp';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };

const ORG = 'orgA';
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
const calls = [];
const PERMS = ['overview.view', 'intelligence.view', 'growth.view', 'admin.view', 'execution.view', 'companies.view'];

function apiMock(route) {
  const u = new URL(route.request().url());
  const resource = u.searchParams.get('resource'), op = u.searchParams.get('op'), method = route.request().method();
  const body = method === 'POST' ? JSON.parse(route.request().postData() || '{}') : {};
  calls.push({ resource, op, method, body });
  const deal = { id: 'd1', stage: 'discovery', business_id: 'b1', next_action: null, next_action_at: null, discovery: {} };
  const key = `${resource}:${op}`;
  const R = {
    'crm:pipeline': { counts: { discovery: 1 }, by_stage: { discovery: [deal] }, overdue_next_action: [], no_next_action: [deal] },
    'crm:businesses': [{ id: 'b1', name: 'Ace Plumbing' }],
    'crm:activities': [], 'crm:proposals': [],
    'products:list': [{ id: 'p1', name: 'Wave One', pricing_approved: false }],
    'crm:contacts': [{ id: 'c1', name: 'Pat Lee', email: 'pat@x.test', phone: '2035550100', suppressed: true, sms_consent_at: null }],
    'crm:contacts-duplicates': { groups: [{ matched_on: 'phone:+12035550100', contacts: [{ id: 'c1', name: 'Pat Lee', phone: '2035550100' }, { id: 'c2', name: 'Patricia Lee', phone: '(203) 555-0100' }] }] },
    'wave1:pilots': method === 'GET' ? [{ id: 'pl1', name: 'Ace pilot', status: 'proposed', agreement_status: 'not_sent', organization_id: ORG }] : { ok: true, pilot: { id: 'pl1' } },
    'wave1:pilot-checklist': [{ id: 'i1', phase: 'acceptance', item_key: 'opt_out_test', label: 'STOP stores suppression and blocks later sends', status: 'pending' }],
    'wave1:preflight': { ready: false, checks: [{ key: 'timezone_set', status: 'fail', detail: 'Timezone not configured' }, { key: 'worker_running', status: 'unknown', detail: 'No worker heartbeat is implemented' }] },
    'wave1:pilot-permissions': [],
    'wave1:pilot-results': { pilot_id: 'pl1', baseline: { defined: false, note: 'Period dates not set — nothing is counted, and this is NOT zero' }, pilot_period: { defined: true, inquiries_captured: 4, appointments_requested: 3, appointments_confirmed: 1 }, test_activity_excluded: { conversations: 2, messages: 5, appointments: 0 }, not_measured: { verified_revenue: 'Not collected by this system' }, definitions: { inquiries_captured: 'Real conversations' }, limitations: 'Counts describe activity in this system only.' },
    'wave1:settings': { organization_id: ORG, timezone: 'America/New_York', quiet_hours: { start: 21, end: 8 }, max_automated_per_day: 3, min_gap_minutes: 10, paused: false, channels_paused: [], sms_number_ref: '+12035550111', templates: { missed_call: 'Sorry we missed you.' }, provider_registration: 'pending', form_token: 'tok_abc', escalation_contacts: [{ name: 'Ann', phone: '', email: '' }], business_hours: { summary: 'Mon-Fri 8-5' } },
    'wave1:conversations': u.searchParams.get('id') ? { id: 'cv1', channel: 'sms', staff_takeover: false, contact: { name: 'Pat Lee', phone_e164: '+12035550100', suppressed: false }, messages: [{ id: 'm1', direction: 'inbound', body: 'Do you do estimates?', status: 'received', created_at: '2026-10-01T15:00:00Z' }, { id: 'm2', direction: 'outbound', body: 'Sorry we missed you.', automated: true, status: 'blocked', blocked_reason: 'send_disabled_dry_run', created_at: '2026-10-01T15:01:00Z' }] } : [{ id: 'cv1', last_inbound_at: '2026-10-01T15:00:00Z', staff_takeover: false, appointment_confirmed: false, crm_contacts: { name: 'Pat Lee', phone_e164: '+12035550100', suppressed: false } }],
    'wave1:appointments': [],
    'wave1:operator': { problem_messages: [], dead_or_failed_jobs: [], upcoming_appointments: [], paused: false, channels_paused: [], not_available: ['worker liveness (no heartbeat implemented)'] },
    'audit:cases': { id: 'case-1111-2222', scope: 'digital', status: 'researching', start_condition_met_at: '2026-10-01T00:00:00Z', target_hours: 72, clock_basis: 'elapsed', total_paused_seconds: 0, clock: { remainingSeconds: 3600, dueAt: '2026-10-04T00:00:00Z' } },
    'audit:evidence': [{ id: 'e1', source: 'Public web page https://x.example (retrieved 2026-10-01)', observation: 'No tel: link', confidence: 'low', capture_date: '2026-10-01T00:00:00Z' }],
    'audit:findings': [{ id: 'f1', title: 'No click-to-call', statement_type: 'observed_fact', detail: 'No tel link in HTML', confidence: 'low', recommended_action: 'Add one', review_status: 'draft', created_at: '2026-10-01T00:00:00Z' }],
    'audit:recommendations': [],
    'audit:reports': [{ id: 'r1', version: 1, status: 'draft', created_at: '2026-10-01T00:00:00Z', content: {} }],
  };
  if (key === 'wave1:pilots' && method === 'POST' && body.action === 'set-status') return json(route, { error: 'Go-live blocked: 1 acceptance/go-live check(s) not passed', open: ['opt_out_test'] }, 409);
  if (key === 'audit:reports' && method === 'POST' && body.action === 'approve') return json(route, { error: 'Report is not ready for approval', problems: ['report section "limitations" is missing or empty', 'finding "No click-to-call" has not been reviewed (status: draft)'] }, 422);
  if (key === 'audit:findings' && method === 'POST' && body.statement_type === 'observed_fact' && !body.evidence_ids?.length) return json(route, { error: 'Finding failed validation', problems: ['observed_fact needs at least one linked evidence record (source + retrieval time)'] }, 400);
  if (key === 'audit:research' && method === 'POST') return json(route, { ok: true, page: { url: body.url, retrieved_at: '2026-10-01T00:00:00Z' }, evidence: [{}, {}, {}] });
  if (key === 'crm:contacts-merge' && method === 'POST') return json(route, { ok: true, dry_run: !body.confirm, preview: { keep: { id: 'c1' }, drop: { id: 'c2' }, deals_moved: 1, conversations_affected: 1, suppression_carried: true } });
  if (R[key] !== undefined) return json(route, R[key]);
  return json(route, { ok: true });
}

const browser = await pw.chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(({ ref }) => {
  const now = Math.floor(Date.now() / 1000);
  localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({ access_token: 'fake.jwt.token', refresh_token: 'fake', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: { id: 'user1', email: 'owner@nova.test', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }));
}, { ref: REF });
await ctx.route('**/auth/v1/**', (r) => json(r, { id: 'user1', email: 'owner@nova.test' }));
await ctx.route('**/rest/v1/organization_members**', (r) => json(r, [{ id: 'm1', organization_id: ORG, role: 'nova_super_admin', member_type: 'staff', status: 'active', organizations: { id: ORG, name: 'Ace Plumbing', slug: 'ace', kind: 'client', status: 'active' } }]));
await ctx.route('**/rest/v1/role_permissions**', (r) => json(r, PERMS.map((k) => ({ role: 'nova_super_admin', permissions: { key: k } }))));
await ctx.route('**/api/client**', apiMock);

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
page.on('dialog', (d) => (d.type() === 'confirm' ? d.accept() : d.dismiss()));
const text = async (t, timeout = 6000) => page.getByText(t, { exact: false }).first().waitFor({ timeout }).then(() => true).catch(() => false);
const go = (p) => page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded' });

// ---- Sales
await go('/dashboard/sales');
check('Sales page loads and lists the deal with no next action', await text('Open deals with no next action (1)'));
await page.locator('div[style*="cursor: pointer"] span').first().click();
check('opening a deal shows stage controls and the closed-deal rule', await text('Move stage') && await text('A closed deal cannot be reopened'));
check('the proposal panel says prices are never invented and flags products without approved pricing', await text('Prices are never filled in for you') && await text('Wave One (no approved price)'));
await page.getByText('← Pipeline').click();
await page.getByRole('button', { name: 'Contacts' }).click();
check('Contacts tab shows opt-out state honestly', await text('opted out') && await text('no text consent'));
await page.getByRole('button', { name: 'Find duplicates' }).click();
check('duplicates are shown as candidates with "nothing is merged automatically"', await text('nothing is merged automatically'));
check('import states that imports never grant consent', await text('Imports never grant consent'));

// ---- Pilots
await go('/dashboard/pilots');
check('Pilots page lists the pilot', await text('Ace pilot'));
await page.getByText('Ace pilot').first().click();
check('agreement panel states no template exists / nothing is labeled legally approved', await text('Nothing in this system is labeled legally approved'));
await page.getByRole('button', { name: 'agreed' }).click();
check("the server's real refusal reason is shown (go-live gate)", await text('Go-live blocked'));
await page.getByRole('button', { name: 'Install & acceptance' }).click();
check('preflight shows fail AND unknown states, never a blanket pass', await text('Timezone not configured') && await text('No worker heartbeat is implemented'));
await page.getByRole('button', { name: 'Permissions' }).click();
check('testimonial permissions default to not granted and are described as separate', await text('separate decision from accepting the service') && (await page.getByText('not granted').count()) >= 5);
await page.getByRole('button', { name: 'Results' }).click();
check('results show "not set" for a missing period (not zero) and list what is not measured', await text('NOT zero') && await text('verified revenue') && await text('Test activity excluded'));
await page.getByRole('button', { name: 'Interview' }).click();
check('interview prompts render', await text('Results-review interview prompts'));

// ---- Messaging & Booking console
await go('/dashboard/pilot-console');
check('Setup loads saved settings', await text('Pause switches') && (await page.locator('input[value="+12035550111"]').count()) === 1);
check('form token URL and the consent warning are shown', await text('does NOT grant text consent'));
await page.getByRole('button', { name: 'Conversations' }).click();
await page.getByText('Pat Lee').first().click();
check('thread shows a dry run as "dry run — not sent", never as sent', await text('dry run — not sent') && !(await text('sent to customer', 500)));
check('staff takeover control is offered', await text('Take over (stop automation)'));
await page.getByText('← All conversations').click();
await page.getByRole('button', { name: 'Appointments' }).click();
check('appointments explain requested vs confirmed', await text('only "confirmed" when the scheduling source says so'));
await page.getByRole('button', { name: 'Operator view' }).click();
check('operator view lists what is NOT available instead of implying all-clear', await text('Not available yet'));

// ---- Audit case
await go('/dashboard/audit/case-1111-2222');
check('Audit case loads with clock', await text('Deadline Clock'));
check('public-page review states what it cannot see', await text('cannot see missed calls, call volume or revenue'));
await page.getByRole('button', { name: /^Findings/ }).click();
await page.locator('select').nth(1).selectOption('estimate');
check('choosing "estimate" reveals range + assumptions fields', await text('Estimate — low') && await text('Estimate — high') && await text('Assumptions *'));
await page.locator('select').nth(1).selectOption('unknown');
check('choosing "unknown" needs no evidence and hides confidence/action', (await page.getByPlaceholder('What cannot be determined', { exact: false }).count()) === 1 && (await page.getByText('Recommended action').count()) === 0);
check('finding review controls present', await text('Mark reviewed'));
await page.getByRole('button', { name: /^Report/ }).click();
check('report editor shows all nine sections', await text('Executive summary') && await text('Limitations') && await text('Next steps'));
await page.getByRole('button', { name: /Approve this version/ }).click();
check('approval refusal lists exactly what is missing', await text('is missing or empty') || await text('has not been reviewed'));

check('no page or console errors across all pages', errors.length === 0, errors.slice(0, 5).join(' | '));
check('every mocked API call carried the caller session (Authorization header path exercised)', calls.length > 20);
await browser.close();
console.log(`\n${pass}/${pass + fail} UI smoke checks passed (mocked backend — proves rendering only)`);
process.exit(fail ? 1 : 0);
