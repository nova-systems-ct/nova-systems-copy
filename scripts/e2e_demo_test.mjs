// Website demo acceptance (five-minute demo) on a real disposable database through the real handlers.
// The visitor's website is served by an in-test stand-in for made-up *.example.test sites (DNS and fetch are patched
// for that suffix ONLY, so the real SSRF checks still run and still refuse 127.0.0.1/internal addresses).
// Twilio/Stripe/Resend are local stand-ins: the test asserts nothing is sent to anyone.
import fs from 'node:fs';
import dns from 'node:dns/promises';
import { startTestEnv } from './testenv/env.mjs';
import { makeCaller } from './testenv/call.mjs';
import { startProviderStandIns, clearProviderEnv, TW_TOKEN, WH_SECRET, PUBLIC_BASE } from './testenv/opsFixture.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };

// ---------------------------------------------------------------- made-up public websites
const SITES = {
  'broken.example.test': { '/': '<html><head><title>TEST Broken Plumbing</title><meta name="viewport" content="width=device-width"></head><body><a href="tel:+12035550123">Call</a><a href="/contact">Contact us</a><a href="/book-now">Book now</a></body></html>', '/contact': null, '/book-now': '<html><body>Booking</body></html>' },
  'good.example.test': { '/': '<html><head><title>TEST Good Dental</title><meta name="viewport" content="width=device-width"></head><body><a href="tel:2035550144">Call</a><form><input type="email" name="email"></form><a href="/contact">Contact</a></body></html>', '/contact': '<html><body>Contact page</body></html>' },
  'phones.example.test': { '/': '<html><head><meta name="viewport" content="x"><script type="application/ld+json">{"@type":"LocalBusiness","name":"TEST","telephone":"(203) 555-0177"}</script></head><body><a href="tel:203-555-0188">Call</a><form></form></body></html>' },
  'slow.example.test': 'timeout',
  'redirect.example.test': { '/': 'REDIRECT:http://127.0.0.1/admin' },
};
const fetches = [];
const realFetch = globalThis.fetch; const realLookup = dns.lookup;
dns.lookup = async (h, o) => (/\.example\.test$/.test(h) ? [{ address: '93.184.216.34', family: 4 }] : realLookup(h, o));
globalThis.fetch = async (input, init = {}) => {
  const u = new URL(typeof input === 'string' ? input : input.url);
  if (!/\.example\.test$/.test(u.hostname)) return realFetch(input, init);
  fetches.push(u.toString());
  const site = SITES[u.hostname];
  if (site === 'timeout') return new Promise((_, rej) => { init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))); });
  const body = site?.[u.pathname];
  if (typeof body === 'string' && body.startsWith('REDIRECT:')) return new Response(null, { status: 302, headers: { location: body.slice(9) } });
  if (body == null) return new Response('<html><body>Not found</body></html>', { status: 404, headers: { 'content-type': 'text/html' } });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
};

clearProviderEnv();
const prov = await startProviderStandIns();
const env = await startTestEnv({ migrations: JSON.parse(fs.readFileSync('supabase/migration-manifest.json', 'utf8')).order, bootstrap: 'platform', publicBuckets: [] });
Object.assign(process.env, env.appEnv, prov.env, { APP_BASE_URL: 'http://localhost.test', WAVE1_PUBLIC_BASE: PUBLIC_BASE, TWILIO_AUTH_TOKEN: TW_TOKEN, TWILIO_ACCOUNT_SID: 'AC_SIMULATED_LOCAL', WAVE1_SEND_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_local_only', STRIPE_WEBHOOK_SECRET: WH_SECRET, OPS_ALERT_EMAIL: 'alerts@nova.test', DEMO_MAX_PER_IP_PER_DAY: '50' });
const client = makeCaller((await import('../api/client.js')).default);
const one = async (q, p) => (await env.sql(q, p)).rows[0];
const all = async (q, p) => (await env.sql(q, p)).rows;
let ipN = 0;
const demo = (op, body = {}, { method = 'POST', token = null, ip = null, query = {} } = {}) => client({ resource: 'demo', op, method, body, token, query, headers: { 'x-forwarded-for': ip || `198.51.100.${++ipN % 250}` } });
const sid = () => `test-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
const form = (o = {}) => ({ name: 'TEST Visitor', business_name: 'TEST Broken Plumbing', website: 'broken.example.test', email: 'visitor@broken.example.test', concern: 'Calls after hours go nowhere', submission_id: sid(), ...o });
const STEP_KEYS = ['inquiry', 'qualify', 'price', 'availability', 'hold', 'agreement', 'monitor'];
async function runWorkers(token, ip) { let last; for (const k of STEP_KEYS) { last = await demo("step", { token, step: k }, { ip }); if (last.status !== 200 || process.env.DEMO_DEBUG) console.log("step", k, last.status, JSON.stringify(last.body).slice(0, 300)); } return last; }

try {
  for (let i = 0; i < 30 && (await env.rest(env.serviceKey, 'demo_sessions?select=id&limit=0')).status !== 200; i++) await env.reload();
  const nova = (await one("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: nova });
  const rep = await env.createUser({ email: 'rep@nova.test', role: 'nova_sales', orgId: nova });

  // ---------------------------------------------------------------- workspace setup (owner only) + honest unavailability
  let r = await demo('status', {}, { method: 'GET' });
  check('before setup, the site says the worker demo is unavailable (never faked)', r.status === 200 && r.body.workers_available === false);
  r = await client({ resource: 'demo', op: 'setup', method: 'POST', body: {}, token: rep.token });
  const anonSetup = await client({ resource: 'demo', op: 'setup', method: 'POST', body: {} });
  check('only the Nova owner can set up the demo workspace', r.status === 403 && anonSetup.status === 401);
  let s0 = await demo('start', form({ submission_id: sid(), email: 'early@broken.example.test' }));
  r = await demo('step', { token: s0.body.token, step: 'inquiry' });
  check('without the workspace, a worker step reports "not available" instead of pretending', r.status === 409 && r.body.reason === 'not_set_up');
  r = await client({ resource: 'demo', op: 'setup', method: 'POST', body: {}, token: owner.token });
  check('the owner sets up an isolated DEMO workspace (test-marked, owner-approved demo prices and template, test payments only)', r.status === 200 && r.body.ready === true && (await one("select is_test from ops_business_settings where organization_id=(select id from organizations where slug='nova-demo-workspace')")).is_test === true && (await one("select live_enabled from ops_payment_accounts where organization_id=(select id from organizations where slug='nova-demo-workspace')")).live_enabled === false, JSON.stringify(r.body).slice(0, 200));
  const demoOrg = (await one("select id from organizations where slug='nova-demo-workspace'")).id;
  r = await client({ resource: 'demo', op: 'setup', method: 'POST', body: {}, token: owner.token });
  check('setup is re-runnable without duplicating prices or templates', r.status === 200 && (await one("select count(*)::int n from ops_price_rules where organization_id=$1 and status='approved'", [demoOrg])).n === 2);

  // ---------------------------------------------------------------- form validation and abuse controls
  r = await demo('start', { submission_id: sid() });
  check('the form validates every required field and says which', r.status === 400 && ['name', 'business_name', 'email', 'concern'].every((k) => r.body.fields?.[k]));
  r = await demo('start', form({ website: 'ftp://x' }));
  check('a non-web address is refused with a clear message', r.status === 400 && !!r.body.fields?.website);
  r = await demo('start', form({ company_url_confirm: 'bot' }));
  check('a bot filling the hidden field is rejected', r.status === 400);
  const before = (await one('select count(*)::int n from demo_sessions')).n;
  const dupId = sid();
  const [d1, d2] = await Promise.all([demo('start', form({ submission_id: dupId })), demo('start', form({ submission_id: dupId }))]);
  check('a double submit creates exactly one demo session', [d1.status, d2.status].sort().join() === '200,409' && (await one('select count(*)::int n from demo_sessions')).n === before + 1, `${d1.status},${d2.status}`);
  const A = d1.status === 200 ? d1.body : d2.body;
  process.env.DEMO_MAX_PER_IP_PER_DAY = '2';
  const capIp = '203.0.113.9';
  const caps = []; for (let i = 0; i < 3; i++) caps.push((await demo('start', form({ submission_id: sid(), email: `cap${i}@x.example.test` }), { ip: capIp })).status);
  check('a per-visitor daily cap stops repeated demos (provider-cost limit)', caps.join() === '200,200,429', caps.join());
  process.env.DEMO_MAX_PER_IP_PER_DAY = '50';

  // ---------------------------------------------------------------- CRM record
  const lead = await one("select c.email, c.email_consent, c.source, b.name bname, d.stage, d.source dsource from crm_contacts c join businesses b on b.id=c.business_id join crm_deals d on d.contact_id=c.id where c.organization_id=$1 and c.email='visitor@broken.example.test'", [nova]);
  check("the visitor becomes a website-demo lead in Nova's CRM (business, contact, prospect deal); no marketing permission unless ticked", !!lead && lead.source === 'website_demo' && lead.dsource === 'website_demo' && lead.stage === 'prospect' && lead.email_consent === false && lead.bname === 'TEST Broken Plumbing', JSON.stringify(lead));

  // ---------------------------------------------------------------- first half: scan
  const t0 = Date.now();
  r = await demo('scan', { token: A.token });
  const scan = r.body.scan;
  check('a real website scan reports one evidenced observation: the broken contact link, with URL, time, why it matters and what to confirm', r.status === 200 && scan.result === 'issue_found' && /answered HTTP 404/.test(scan.finding.observation) && scan.finding.url === 'https://broken.example.test/contact' && !!scan.finding.checked_at && !!scan.finding.why && !!scan.finding.confirm && !!scan.finding.next, JSON.stringify(scan?.finding));
  check('the scan lists every check it ran and stays within its page budget', scan.checks.length >= 5 && scan.fetches <= 4 && fetches.filter((f) => f.includes('broken.example.test')).length <= 4);
  check('the scan states its limits (no invented losses or response times)', /cannot see calls, texts, response times or results/.test(scan.limitation) && !/\$\d/.test(JSON.stringify(scan)));
  r = await demo('scan', { token: A.token });
  check('scanning again returns the saved result without fetching again', r.body.scan.finished_at === scan.finished_at);

  // ---------------------------------------------------------------- second half: workers
  r = await demo('step', { token: A.token, step: 'hold' });
  check('workers run in order (a later step cannot run first)', r.status === 409);
  const last = await runWorkers(A.token);
  const steps = last.body.steps;
  check('all seven worker steps completed through real backend actions', steps.every((s) => s.status === 'completed'), JSON.stringify(steps.map((s) => `${s.key}:${s.status}`)));
  const sessA = await one('select * from demo_sessions where token_hash is not null and business_name=$1 and demo_job_id is not null order by submitted_at asc limit 1', ['TEST Broken Plumbing']);
  const jobA = await one('select * from ops_jobs where id=$1', [sessA.demo_job_id]);
  const bkA = await one("select * from ops_bookings where job_id=$1", [jobA.id]);
  const agA = await one("select * from ops_agreements where job_id=$1", [jobA.id]);
  check('the records exist: a test-marked job in the DEMO workspace, quoted from the approved demo price, an expiring hold, an agreement from the approved template', jobA.organization_id === demoOrg && jobA.is_test === true && jobA.state === 'awaiting_agreement' && jobA.total_cents === 18000 && bkA.status === 'held' && !!bkA.hold_expires_at && agA.status === 'sent' && /DEMO ONLY/.test(agA.body_rendered));
  check('every action is recorded in the timeline', (await one('select count(*)::int n from ops_transitions where organization_id=$1 and entity_id in ($2,$3,$4)', [demoOrg, jobA.id, bkA.id, agA.id])).n >= 5);
  const stepAgain = await demo('step', { token: A.token, step: 'inquiry' });
  check('repeating a step does not create a second inquiry', stepAgain.status === 200 && (await one('select count(*)::int n from ops_jobs where organization_id=$1 and id=$2', [demoOrg, jobA.id])).n === 1 && (await one("select count(*)::int n from crm_contacts where organization_id=$1 and name like $2", [demoOrg, `DEMO Customer ${sessA.id.slice(0, 4)}%`])).n === 1);
  r = await demo('finish', { token: A.token });
  const elapsed = (Date.now() - t0) / 1000;
  check(`the demo finishes with a saved summary, the finding, worker results and the 48–72-hour audit invitation (scan → summary in ${elapsed.toFixed(1)} s)`, r.status === 200 && r.body.summary?.finding && r.body.summary.workers_completed === 7 && /48–72 hours/.test(r.body.summary.next_step) && r.body.audit_request_url === '/request-audit' && elapsed < 300);
  check('Nova staff are alerted through the controlled path (dry run here: recorded, not sent)', (await one("select status from sales_notifications where kind='demo_completed'")).status === 'dry_run' && (await one('select staff_alert_status from demo_sessions where id=$1', [sessA.id])).staff_alert_status === 'dry_run');
  check('the CRM deal gets a completion note', (await one("select count(*)::int n from crm_activities where deal_id=$1 and body like 'Website demo completed%'", [sessA.nova_deal_id])).n === 1);

  // ---------------------------------------------------------------- other website cases
  const runScan = async (o) => { const s = await demo('start', form({ submission_id: sid(), ...o })); return { s, r: await demo('scan', { token: s.body.token }) }; };
  let x = await runScan({ website: '', email: 'nosite@x.example.test', business_name: 'TEST No Site' });
  check('no website: says nothing was checked and what the full audit would do', x.r.body.scan.result === 'no_website' && /full Nova Audit/.test(x.r.body.scan.limitation));
  x = await runScan({ website: 'good.example.test', email: 'good@x.example.test', business_name: 'TEST Good Dental' });
  check('a healthy site: "no problem was verified", never a manufactured finding', x.r.body.scan.result === 'no_issue_verified' && x.r.body.scan.finding === null && /does not mean there is none/.test(x.r.body.scan.limitation), JSON.stringify(x.r.body.scan.checks?.filter((c) => c.result === 'issue')));
  x = await runScan({ website: 'phones.example.test', email: 'phones@x.example.test', business_name: 'TEST Phones' });
  check('two different phone numbers on one page are reported as an inconsistency to confirm', x.r.body.scan.result === 'issue_found' && /2 different phone numbers/.test(x.r.body.scan.finding.observation));
  const t1 = Date.now(); x = await runScan({ website: 'slow.example.test', email: 'slow@x.example.test', business_name: 'TEST Slow' });
  check('a site that does not answer: reported as unavailable within the time limit, nothing assumed', x.r.body.scan.result === 'unavailable' && /did not answer in time/.test(x.r.body.scan.limitation) && (Date.now() - t1) < 15000);
  const fetchedBefore = fetches.length;
  x = await runScan({ website: 'http://127.0.0.1:8080/admin', email: 'unsafe@x.example.test', business_name: 'TEST Unsafe' });
  check('an internal address is refused and never fetched', x.r.body.scan.result === 'refused' && /private or reserved|Non-standard ports/.test(x.r.body.scan.limitation) && fetches.length === fetchedBefore);
  x = await runScan({ website: 'redirect.example.test', email: 'redir@x.example.test', business_name: 'TEST Redirect' });
  check('a public page that redirects to an internal address is refused at the redirect', ['refused', 'unavailable'].includes(x.r.body.scan.result) && /private or reserved/.test(x.r.body.scan.limitation || ''), JSON.stringify(x.r.body.scan).slice(0, 200));
  x = await runScan({ website: 'nonexistent-host-for-nova-tests.invalid', email: 'dns@x.example.test', business_name: 'TEST DNS' });
  check('an address that does not exist is refused with a reason', ['refused', 'unavailable'].includes(x.r.body.scan.result) && !!x.r.body.scan.limitation);

  // ---------------------------------------------------------------- two visitors at once, isolation
  const [B, C] = await Promise.all([demo('start', form({ submission_id: sid(), email: 'b@x.example.test', business_name: 'TEST B', website: '' }), { ip: '192.0.2.10' }), demo('start', form({ submission_id: sid(), email: 'c@x.example.test', business_name: 'TEST C', website: '' }), { ip: '192.0.2.11' })]);
  const [rb, rc] = await Promise.all([runWorkers(B.body.token, '192.0.2.10'), runWorkers(C.body.token, '192.0.2.11')]);
  const sb = await one("select demo_job_id from demo_sessions where email='b@x.example.test'"); const sc = await one("select demo_job_id from demo_sessions where email='c@x.example.test'");
  const holds = await all("select job_id, start_at, end_at from ops_bookings where job_id in ($1,$2) and status='held'", [sb.demo_job_id, sc.demo_job_id]);
  check('two simultaneous visitors each get their own job and their own non-overlapping hold', rb.body.steps.every((s) => s.status === 'completed') && rc.body.steps.every((s) => s.status === 'completed') && sb.demo_job_id !== sc.demo_job_id && holds.length === 2 && !(new Date(holds[0].start_at) < new Date(holds[1].end_at) && new Date(holds[1].start_at) < new Date(holds[0].end_at)), JSON.stringify(holds));
  r = await demo('session', {}, { method: 'GET', query: { token: B.body.token } });
  check("a visitor's link shows only their own session", r.status === 200 && r.body.business_name === 'TEST B' && !JSON.stringify(r.body).includes('TEST C'));
  r = await demo('session', {}, { method: 'GET', query: { token: 'x'.repeat(32) } });
  check('a guessed session link shows nothing', r.status === 404);
  const anon = await env.rest(null, 'demo_sessions?select=email');
  const signedIn = await env.rest(rep.token, 'demo_sessions?select=email');
  check('demo sessions are not readable from the browser (anonymous or signed-in)', anon.status >= 400 && (signedIn.status >= 400 || (Array.isArray(signedIn.data) && signedIn.data.length === 0)), `${anon.status}/${signedIn.status}`);

  // ---------------------------------------------------------------- nothing sent, nothing charged, nothing counted
  check('no text message was sent to anyone during any demo', prov.twilio.messages.length === 0 && (await one("select count(*)::int n from wave1_messages where direction='outbound' and status in ('provider_accepted','delivered','queued')")).n === 0);
  check('no payment was attempted', prov.stripe.requests.length === 0);
  check('no email left the system (dry run)', env.stubs.outbox.length === 0);
  // ---------------------------------------------------------------- an environment without its database (the 2026-10-16 Preview failure)
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const st = await demo('status', {}, { method: 'GET' });
  const nc = await demo('start', form({ submission_id: sid() }));
  process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  check('without database configuration, the demo answers plainly (503 "We couldn\'t start your demo. Please try again.") instead of a server error, and reports itself unavailable', st.status === 200 && st.body.available === false && nc.status === 503 && nc.body.code === 'not_configured' && nc.body.error === "We couldn't start your demo. Please try again.", JSON.stringify([st.body, nc.status, nc.body]));
  check("demo activity lives only in the test-marked DEMO workspace — none in Nova's own operational records", (await one('select count(*)::int n from ops_jobs where organization_id=$1', [nova])).n === 0 && (await one('select bool_and(is_test) t from ops_jobs where organization_id=$1', [demoOrg])).t === true);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { globalThis.fetch = realFetch; dns.lookup = realLookup; await env.stop(); await prov.stop(); }
console.log(`\n${pass} passed, ${fail} failed — website demo (real handlers + local PostgreSQL; made-up websites served by an in-test stand-in)`);
process.exitCode = fail ? 1 : 0;
// Let Node exit on its own once handles close. Calling process.exit() while fetch keep-alive connections are still
// closing aborts Node 24 on Windows (libuv assertion in src/win/async.c, exit 0xC0000409) and can drop the printed
// result — the cause of the intermittent 'no result line' crashes (reproduced 40/40, fixed 0/40 on 2026-10-17).
// The unref'd timer is only a last resort if something keeps the process alive.
setTimeout(() => process.exit(process.exitCode ?? 0), 10_000).unref();
