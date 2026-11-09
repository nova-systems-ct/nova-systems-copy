import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import packaged from '@sparticuz/chromium';
import { startTestEnv } from './testenv/env.mjs';
import { fromEasternTime, formatEasternTime } from '../src/lib/novaBookingTime.js';
import { SERVICE_SMS_POLICY } from '../public/sms-program/policy.js';

assert.equal(fromEasternTime('2026-11-10T09:00'), '2026-11-10T14:00:00.000Z');
assert.equal(fromEasternTime('2027-06-10T09:00'), '2027-06-10T13:00:00.000Z');
assert.throws(() => fromEasternTime('2027-03-14T02:30'));
assert.throws(() => fromEasternTime('2027-11-07T01:30'));
const migration = process.env.LAUNCH_MIGRATION || 'supabase/migrations/20261109194341_launch_worker_booking.sql';
const env = await startTestEnv({ migrations: ['scripts/testenv/serviceSmsLegacy.sql', 'scripts/testenv/launchWorkerLegacy.sql', 'supabase/migrations/20261108172929_service_sms_intake.sql', migration], publicBuckets: [] });
let server, browser, vite;
try {
  assert.deepEqual(env.migrationErrors, []);
  Object.assign(process.env, env.appEnv, { NOVA_SPENDING_LOCK: 'locked' });
  const { handleLaunchPublic, handleLaunchAdmin } = await import('../api/_launchWorker.js');
  const handler = (await import('../api/book-meeting.js')).default;
  const q = async (sql, params = []) => (await env.sql(sql, params)).rows;
  const org = (await q("select id from organizations where kind='nova_internal' limit 1"))[0].id;
  const owner = await env.createUser({ email: 'launch-owner@example.invalid', role: 'nova_super_admin', orgId: org });
  const outsider = await env.createUser({ email: 'launch-outsider@example.invalid', role: 'nova_admin', orgId: org });
  const request = (tag, slot = null) => ({ request_type: 'launch_worker_request', submission_id: randomUUID(), management_token: randomBytes(32).toString('hex'), rendered_at: Date.now() - 5000,
    name: 'TEST ' + tag, business_name: 'TEST Nova', email: tag + '@example.invalid', phone: '+12035550191', message: 'TEST Help organize customer bookings.',
    service_key: 'booking', slot_id: slot, test_mode: true, service_sms_consent: false, service_sms_consent_version: SERVICE_SMS_POLICY.version });
  const call = async (fn, body, token = null, method = 'POST', query = {}) => {
    let status = 200, result;
    const res = { setHeader() {}, status(n) { status = n; return res; }, json(b) { result = b; return res; }, end() { return res; } };
    await fn({ method, body, query, headers: token ? { authorization: 'Bearer ' + token } : {} }, res);
    return { status, result };
  };
  const admin = (body, token = owner.token, method = 'POST') => call(handleLaunchAdmin, body, token, method);
  const invoke = b => call(handleLaunchPublic, b);
  const future = (hours = 48) => new Date(Date.now() + hours * 3600000).toISOString();
  const add = async (hours, test = true) => {
    const r = await admin({ action: 'add_slot', starts_at: future(hours), ends_at: future(hours + 0.5), is_test: test });
    assert.equal(r.status, 200, JSON.stringify(r)); return r.result.slot_id;
  };
  assert.equal((await admin({}, null, 'GET')).status, 401);
  assert.equal((await admin({}, outsider.token, 'GET')).status, 403, 'An admin permission alone is not Nova owner authority');
  const slot = await add(48), publicSlot = await add(50, false);
  assert.equal((await admin({ action: 'add_slot', starts_at: future(48.1), ends_at: future(48.6), is_test: true })).result.code, 'slot_overlap');
  const liveList = await call(handleLaunchPublic, null, null, 'GET', { action: 'availability' });
  assert(liveList.result.slots.some(s => s.id === publicSlot)); assert(!liveList.result.slots.some(s => s.id === slot));
  const crossing = await invoke(request('cross-test-live', publicSlot)); assert.equal(crossing.result.code, 'slot_unavailable');
  const before = (await q('select count(*)::int n from intake_requests'))[0].n;
  const raceA = request('race-a', slot), raceB = request('race-b', slot);
  const race = await Promise.all([invoke(raceA), invoke(raceB)]);
  assert.equal(race.filter(r => r.status === 200).length, 1); assert.equal(race.filter(r => r.result.code === 'slot_unavailable').length, 1);
  assert.equal((await q('select count(*)::int n from intake_requests'))[0].n, before + 1, 'Losing a slot creates no orphan request');
  const winner = race[0].status === 200 ? raceA : raceB;
  const booked = race.find(r => r.status === 200).result;
  assert.equal(booked.state, 'booked'); assert.equal(booked.marketing_consent, false); assert.equal(booked.service_sms_consent, false);
  const dup = await invoke({ ...winner, service_sms_consent: true }); assert.equal(dup.result.duplicate, true); assert.equal(dup.result.service_sms_consent, false);
  const tampered = await invoke({ ...winner, management_token: randomBytes(32).toString('hex') }); assert.equal(tampered.result.code, 'request_conflict');
  assert.equal((await q('select count(*)::int n from nova_book_meetings'))[0].n, 1);
  assert.equal((await q('select count(*)::int n from nova_tasks'))[0].n, 1);
  assert.equal((await q('select state,management_hash,steps,is_test from nova_worker_runs where request_id=$1', [winner.submission_id]))[0].steps.length, 5);
  assert.equal((await admin({ action: 'withdraw_slot', id: slot })).result.code, 'slot_not_available');
  const cancel = { request_type: 'launch_cancel', submission_id: winner.submission_id, management_token: winner.management_token };
  assert.equal((await invoke({ ...cancel, management_token: randomBytes(32).toString('hex') })).status, 404);
  assert.equal((await invoke(cancel)).result.state, 'cancelled'); assert.equal((await invoke(cancel)).result.duplicate, true);
  assert.equal((await q('select status,request_id from nova_booking_slots where id=$1', [slot]))[0].status, 'available');
  assert.equal((await q('select status from nova_book_meetings limit 1'))[0].status, 'cancelled');
  const plain = request('no-appointment'); const p = await invoke(plain); assert.equal(p.result.state, 'request_ready'); assert.equal(p.result.booking, null);
  const exact = (await q('select * from nova_service_sms_receipts where request_id=$1', [plain.submission_id]))[0];
  assert.equal(exact.disclosure, SERVICE_SMS_POLICY.text); assert.equal(exact.is_test, true); assert.equal(exact.marketing_consent, false);
  assert.equal((await q('select meeting_date from intake_requests where id=$1', [plain.submission_id]))[0].meeting_date, null);
  const optin = request('service-sms'); optin.service_sms_consent = true; assert.equal((await invoke(optin)).result.service_sms_consent, true);
  const noPhone = request('no-phone', slot); noPhone.phone = ''; assert.equal((await invoke(noPhone)).result.code, 'phone_required');
  assert.equal((await invoke({ ...request('bad-test'), email: 'real-person@example.com' })).status, 422);
  const rollSlot = await add(52); const roll = request('rollback-worker', rollSlot); roll.phone = '+12035550198';
  await q("create function public.fail_launch_task() returns trigger language plpgsql as $$begin raise exception 'TEST injected task failure'; end$$; create trigger fail_launch_task before insert on nova_tasks for each row execute function public.fail_launch_task();");
  assert.equal((await invoke(roll)).status, 502);
  assert.equal((await q('select count(*)::int n from intake_requests where id=$1', [roll.submission_id]))[0].n, 0);
  assert.equal((await q('select count(*)::int n from nova_crm_contacts where email=$1', [roll.email]))[0].n, 0);
  assert.equal((await q('select status from nova_booking_slots where id=$1', [rollSlot]))[0].status, 'available');
  await q('drop trigger fail_launch_task on nova_tasks; drop function public.fail_launch_task();');
  for (const token of [null, outsider.token]) {
    for (const table of ['nova_booking_slots', 'nova_worker_runs']) {
      const r = await env.rest(token, table + '?select=*'); assert(r.status >= 400 || r.data.length === 0);
    }
    assert((await env.rest(token, 'rpc/nova_launch_owner', { method: 'POST', body: { p_actor: owner.id, p_action: 'overview' } })).status >= 400);
    assert((await env.rest(token, 'rpc/nova_launch_request', { method: 'POST', body: { p_request: {}, p_management_hash: 'a'.repeat(64), p_service: 'booking' } })).status >= 400);
  }
  console.log('PASS — actual PostgreSQL/PostgREST: owner-only scheduling, no overlaps/double bookings, idempotency, token binding, test/live separation, cancellation, private ledger and complete rollback');
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
  server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/book-meeting') {
        const chunks = []; for await (const c of req) chunks.push(c);
        req.body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); req.query = Object.fromEntries(url.searchParams);
        const out = { setHeader: (k, v) => res.setHeader(k, v), status(n) { res.statusCode = n; return out; }, json(v) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(v)); return out; }, end() { res.end(); return out; } };
        return handler(req, out);
      }
      const route = { '/service-request': '/sms-program/index.html', '/service-texts/privacy': '/sms-program/privacy.html', '/service-texts/terms': '/sms-program/terms.html' }[url.pathname] || url.pathname;
      if (!route.startsWith('/sms-program/') || route.includes('..')) { res.statusCode = 404; return res.end(); }
      const file = path.resolve('public' + route); res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
    } catch { res.statusCode = 500; res.end('Test server error'); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: await packaged.executablePath(), args: packaged.args, headless: true });
  const context = await browser.newContext(); const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  fs.mkdirSync('docs/qa/launch-worker-2026-11-09', { recursive: true });
  await page.goto(base + '/service-request?test=1'); await page.getByText('Choose one of Nova’s published times.', { exact: true }).waitFor(); await page.waitForFunction(() => !document.getElementById('submit').disabled);
  assert.equal(await page.getByRole('checkbox', { name: /Service texts \(optional\)/ }).isChecked(), false);
  for (const [name, width, height] of [['desktop', 1366, 1000], ['ipad', 820, 1180], ['phone', 390, 844]]) {
    await page.setViewportSize({ width, height }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `docs/qa/launch-worker-2026-11-09/${name}.jpg`, fullPage: true });
  }
  await page.setViewportSize({ width: 1366, height: 1000 });
  await page.getByLabel('Your name', { exact: true }).fill('TEST Browser'); await page.getByLabel('Business name', { exact: true }).fill('TEST Nova');
  await page.getByLabel('Email', { exact: true }).fill('browser-booking@example.invalid'); await page.getByLabel('Phone (optional)', { exact: true }).fill('+12035550195');
  await page.locator('#slot-options input').first().check();
  await page.waitForFunction(() => !document.getElementById('submit').disabled); await page.getByRole('button', { name: 'Send request', exact: true }).click();
  await page.getByRole('heading', { name: 'Your call is booked.', exact: true }).waitFor();
  const refText = await page.locator('#reference').innerText(); const browserId = refText.split(': ').at(-1);
  assert.equal((await q('select state from nova_worker_runs where request_id=$1', [browserId]))[0].state, 'booked');
  assert.equal(await page.locator('#worker-steps li').count(), 5);
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Add to calendar', exact: true }).click();
  const calendar = await downloaded; const text = fs.readFileSync(await calendar.path(), 'utf8'); assert.match(text, /BEGIN:VCALENDAR/); assert.match(text, /METHOD:PUBLISH/); assert(text.includes(browserId));
  await page.screenshot({ path: 'docs/qa/launch-worker-2026-11-09/booking-completed.jpg', fullPage: true });
  await page.reload(); await page.getByRole('heading', { name: 'Your call is booked.', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Cancel this appointment', exact: true }).click(); await page.getByRole('heading', { name: 'Your request is cancelled.', exact: true }).waitFor();
  assert.equal((await q('select state from nova_worker_runs where request_id=$1', [browserId]))[0].state, 'cancelled');
  assert.equal(env.stubs.outbox.length, 0); assert.equal(env.stubs.emailRequests.length, 0); assert.deepEqual(errors, []);
  // Render the real owner component using an actual local Auth session and the same API/DB.
  const { createServer, transformWithEsbuild } = await import('vite');
  const qaEntry = `import React from 'react'; import {createRoot} from 'react-dom/client'; import LaunchDesk from '/src/components/LaunchDesk.jsx'; import {supabase} from '/src/lib/supabaseClient.js'; import '/src/index.css';
    const {error}=await supabase.auth.signInWithPassword({email:${JSON.stringify(owner.email)},password:${JSON.stringify(owner.password)}}); if(error) throw error;
    createRoot(document.getElementById('root')).render(<main style={{maxWidth:1150,margin:'auto',padding:24,background:'#090909'}}><LaunchDesk/></main>);`;
  vite = await createServer({ server: { host: '127.0.0.1', port: 0 }, plugins: [{ name:'nova-launch-acceptance-only',
    resolveId(id) { if(id==='/__launch_owner.jsx') return id; },
    async load(id) { if(id==='/__launch_owner.jsx') return (await transformWithEsbuild(qaEntry,id,{loader:'jsx',jsx:'automatic'})).code; },
    configureServer(s) { s.middlewares.use(async(req,res,next)=>{
      if(req.url==='/__launch_owner') {res.setHeader('Content-Type','text/html'); return res.end(await s.transformIndexHtml('/__launch_owner','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#090909"><div id="root"></div><script type="module" src="/__launch_owner.jsx"></script></body></html>'));}
      if(req.url?.startsWith('/api/client?resource=launch')) { const chunks=[];for await(const c of req)chunks.push(c);req.body=JSON.parse(Buffer.concat(chunks).toString()||'{}');req.query={resource:'launch'};
        const out={setHeader:(k,v)=>res.setHeader(k,v),status(n){res.statusCode=n;return out},json(v){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(v));return out},end(){res.end();return out}}; return handleLaunchAdmin(req,out); }
      next();
    }); }
  }] });
  await vite.listen(); const viteBase=`http://127.0.0.1:${vite.httpServer.address().port}`;
  const ownerPage=await context.newPage();ownerPage.on('pageerror',e=>errors.push(e.message));
  await ownerPage.goto(viteBase+'/__launch_owner');await ownerPage.getByRole('heading',{name:'Publish your available times',exact:true}).waitFor();
  await ownerPage.getByLabel('Show test records',{exact:true}).check(); await ownerPage.getByText('browser-booking@example.invalid',{exact:true}).waitFor();
  const ownerDay=new Date(Date.now()+96*3600000).toISOString().slice(0,10); const ownerStart=fromEasternTime(ownerDay+'T09:00'); const ownerLabel=formatEasternTime(ownerStart);
  await ownerPage.getByLabel('Start · Eastern time',{exact:true}).fill(ownerDay+'T09:00'); await ownerPage.getByLabel('End · Eastern time',{exact:true}).fill(ownerDay+'T09:30');await ownerPage.getByLabel('Test appointment only',{exact:true}).check();
  await ownerPage.getByRole('button',{name:'Add test time',exact:true}).click();
  await ownerPage.getByText(ownerLabel,{exact:true}).waitFor();
  assert.equal((await q('select starts_at from nova_booking_slots where starts_at=$1',[ownerStart]))[0].starts_at.toISOString(),ownerStart);
  for(const [name,width,height] of [['desktop',1366,1000],['phone',390,844]]){await ownerPage.setViewportSize({width,height});assert(await ownerPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await ownerPage.screenshot({path:`docs/qa/launch-worker-2026-11-09/owner-${name}.jpg`,fullPage:true});}
  const row=ownerPage.locator('.launch-slot').filter({hasText:ownerLabel});await row.getByRole('button',{name:'Withdraw',exact:true}).click();await row.waitFor({state:'detached'});
  await ownerPage.goto(viteBase+'/');await ownerPage.getByRole('heading',{name:'Less chasing. More getting it done.',exact:true}).waitFor();
  for(const [name,width,height] of [['desktop',1366,900],['ipad',820,1180],['phone',390,844]]){await ownerPage.setViewportSize({width,height});assert(await ownerPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await ownerPage.screenshot({path:`docs/qa/launch-worker-2026-11-09/home-${name}.jpg`,fullPage:true});}
  await ownerPage.getByRole('button',{name:'Open Nova assistant',exact:true}).click(); await ownerPage.getByRole('heading',{name:'What needs attention?',exact:true}).waitFor(); assert.equal(await ownerPage.locator('#nova-assistant-panel a').getAttribute('href'),'/service-request'); await ownerPage.getByRole('button',{name:'Close assistant',exact:true}).click();
  await ownerPage.getByRole('button',{name:'Open menu',exact:true}).click();await ownerPage.getByRole('link',{name:'How it works',exact:true}).first().click();assert.equal(new URL(ownerPage.url()).hash,'#workflow');
  assert.deepEqual(errors,[]); console.log('PASS — real owner browser session: publish Eastern appointment, verified UTC database time, inspect test receipts, withdraw available time; owner/home desktop and phone layout, working mobile navigation');
  console.log('PASS — real browser → API → database: appointment reserved, five action receipts, calendar download, reload recovery, customer cancellation; desktop/iPad/phone fit; no outbound messages, paid AI, payments or browser errors');
} finally { if(vite) await vite.close(); if (browser) await browser.close(); if (server) await new Promise(r => server.close(r)); await env.stop(); }
