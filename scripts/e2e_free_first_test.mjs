// Full local app/DB/queue acceptance. Auth is a local stand-in; no real provider, account or customer is contacted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startHarness } from './testenv/devharness.mjs';
import { makeCaller } from './testenv/call.mjs';
import { createPostgresJobStore } from '../worker/postgresJobStore.mjs';
import { chromium } from 'playwright';
import packaged from '@sparticuz/chromium';
const H = await startHarness({ manifest: true, vitePort: 5207, apiPort: 8807 });
const { env, base } = H;
Object.assign(process.env, { NOVA_SPENDING_LOCK: 'locked', NOVA_ROLE_MODEL: 'off' });
const { runRoleTask, ROLES } = await import('../api/_hierarchy/roles.js');
const { runExecutiveJob } = await import('../api/_executiveQueueTick.js');
const { seedRecurring } = await import('../worker/index.mjs');
const sql = async (query,args) => (await env.sql(query,args)).rows;
const one = async (query,args) => (await sql(query,args))[0];
const api = makeCaller((await import('../api/client.js')).default);
const notify = makeCaller((await import('../api/notify.js')).default);
const store = createPostgresJobStore({url:env.base,serviceKey:env.serviceKey});
const ctx = {mode:'postgres',url:env.base,serviceKey:env.serviceKey,store};
const shots = path.resolve(process.env.NOVA_TEST_SHOTS_DIR || '../free-first-acceptance'); fs.mkdirSync(shots,{recursive:true});
let browser;
try {
  assert.deepEqual(env.migrationErrors,[], 'Strict clean install must have no migration errors');
  const org = (await one("INSERT INTO organizations(name,slug,kind) VALUES('Nova Systems TEST','nova-free-first','nova_internal') RETURNING id")).id;
  const other = (await one("INSERT INTO organizations(name,slug,kind) VALUES('Other TEST','other-free-first','client') RETURNING id")).id;
  const owner = await env.createUser({email:'owner@nova.test',role:'nova_super_admin',orgId:org});
  const outsider = await env.createUser({email:'client@other.test',role:'client_owner',orgId:other});
  const roleCall = (op,body={}) => api({resource:'roles',op,token:owner.token,body:{organization_id:org,...body}});
  for(const role of Object.keys(ROLES)) {
    const r = await api({resource:'hierarchy',op:'register-capability',token:owner.token,body:{capability_key:role}});
    assert.equal(r.status,200,JSON.stringify(r.body));
  }
  // Shared roles must still honor a target company's stop switch.
  const entity = (await one("INSERT INTO portfolio_entities(key,name,entity_type,status,organization_id) VALUES('free-first-test','TEST Company','owned_company','active',$1) RETURNING id",[org])).id;
  const stop = (await one("INSERT INTO kill_switches(scope_type,scope_id,engaged,reason,engaged_by) VALUES('portfolio_entity',$1,true,'Isolated stop test',$2) RETURNING id",[entity,owner.id])).id;
  const paused = await runRoleTask('cfo',{orgId:org,jobId:'not-a-job'}); assert.equal(paused.paused,true);
  assert.equal(Number((await one('SELECT count(*) FROM work_items')).count),0,'Paused execution must create no task');
  await env.sql('UPDATE kill_switches SET engaged=false WHERE id=$1',[stop]);
  const wrong = (await one("INSERT INTO work_items(organization_id,role_key,category,title,status,created_by) VALUES($1,'cmo','role:cmo','Wrong-role task','assigned',$2) RETURNING id",[org,owner.id])).id;
  await assert.rejects(()=>runRoleTask('cfo',{orgId:org,workItemId:wrong}),/does not belong/);
  const cfoWorker = await one("SELECT id FROM workers WHERE capability_key='cfo'");
  const crossDep = (await one("INSERT INTO work_items(organization_id,title,status,created_by) VALUES($1,'Other business prerequisite','completed',$2) RETURNING id",[other,owner.id])).id;
  const blocked = (await one("INSERT INTO work_items(organization_id,role_key,category,title,status,worker_id,depends_on,created_by) VALUES($1,'cfo','role:cfo','CFO waits for scoped prerequisite','assigned',$2,ARRAY[$3::uuid],$4) RETURNING id",[org,cfoWorker.id,crossDep,owner.id])).id;
  assert.equal((await runRoleTask('cfo',{orgId:org,workItemId:blocked})).status,'blocked','An out-of-business prerequisite must not satisfy the dependency');
  console.log('PASS — real DB clean install, registration, company stop control, role identity and prerequisite isolation');

  // The public demo endpoint uses the real inbox table (demo_requests never existed on staging).
  let r = await notify({action:'book-demo',body:{name:'TEST Visitor',business:'TEST Bakery',email:'visitor@example.test',phone:'2035550110',challenge:'Orders get lost',time:'Friday afternoon'}});
  assert.equal(r.status,200,JSON.stringify(r.body));
  const saved = await one("SELECT * FROM contact_submissions WHERE company='TEST Bakery'"); assert.equal(saved.organization_id,org); assert.match(saved.message,/Friday afternoon/);
  assert.equal(env.stubs.outbox.length,0,'Spending lock must prevent actual provider delivery');
  assert(Number((await one("SELECT count(*) FROM sales_notifications WHERE kind='public_lead' AND channel='in_app'")).count)>0);
  r = await api({resource:'roles',op:'overview',method:'GET',token:owner.token,query:{organization_id:org}}); assert.equal(r.status,200,JSON.stringify(r.body)); assert(r.body.incoming.some(x=>x.id===saved.id));
  const denied = await api({resource:'roles',op:'overview',method:'GET',token:outsider.token,query:{organization_id:org}}); assert.equal(denied.status,403);
  r = await roleCall('review-public-lead',{id:saved.id,status:'read'}); assert.equal(r.status,200);
  // Each job is claimed, executes the real role handler, persists its output and completes in the real queue.
  for(const role of Object.keys(ROLES)) {
    r = await roleCall('run-now',{role}); assert.equal(r.status,200,JSON.stringify(r.body));
    const job = await store.claimNext({workerId:'free-first-test',jobTypes:[ROLES[role].job_type]}); assert(job);
    const result = await runExecutiveJob(job,{enqueue:row=>store.enqueue(row)}); await store.complete(job.id,result);
    assert.equal(result.status,'in_review');
    const task = await one('SELECT * FROM work_items WHERE job_id=$1',[job.id]);
    const output = await one('SELECT content FROM work_item_outputs WHERE work_item_id=$1',[task.id]);
    assert(output.content.playbook_version); assert.equal(output.content.reasoning.status,'disabled');
    const replay = await runRoleTask(role,{orgId:org,jobId:job.id}); assert.equal(replay.work_item_id,task.id);
    assert.equal(Number((await one('SELECT count(*) FROM work_item_outputs WHERE work_item_id=$1',[task.id])).count),1,'Redelivery must not duplicate output');
    if(role==='cfo') { assert.equal(output.content.available_cents,null); assert(output.content.capability_report.items.some(x=>x.key==='phone_sms')); }
  }
  assert.equal((await roleCall('run-now',{role:'cfo'})).status,200,'A pending manual job is separate from a recurring schedule');
  await seedRecurring(ctx);
  assert.equal(Number((await one("SELECT count(DISTINCT job_type) FROM jobs WHERE job_type LIKE 'role_%' AND status='pending' AND payload->>'recurring'='true'")).count),Object.keys(ROLES).length,'A manual one-shot must not suppress a role’s initial recurring schedule');
  const before = Number((await one("SELECT count(*) FROM jobs WHERE job_type LIKE 'role_%' AND status='pending'")).count);
  const realNow = Date.now; Date.now = () => realNow()+2*3600000;
  try { await seedRecurring(ctx); } finally { Date.now=realNow; }
  assert.equal(Number((await one("SELECT count(*) FROM jobs WHERE job_type LIKE 'role_%' AND status='pending'")).count),before,'Restart in another slot must preserve one schedule chain');
  console.log('PASS — saved public requests reach the scoped owner inbox and each real executive queue handler saves one reviewed result');

  // Real browser, real API and real local database, with native packaged Chromium (no account cookies).
  browser = await chromium.launch({headless:true,executablePath:await packaged.executablePath(),args:packaged.args.filter(x=>!x.startsWith('--single-process'))});
  const page = await browser.newPage({viewport:{width:1366,height:1000}}); const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(`${base}/`);
  await page.screenshot({path:path.join(shots,'homepage-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(shots,'homepage-phone.png'),fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),'Public homepage must fit a phone');
  await page.setViewportSize({width:1366,height:1000});
  await page.getByRole('button',{name:'Open chat',exact:true}).click();
  for(const answer of ['TEST Chat Visitor','TEST Machine Shop','Missed quote requests','Tuesday','chat@example.test']) {
    await page.getByRole('textbox',{name:'Your reply',exact:true}).fill(answer); await page.getByRole('button',{name:'Send reply',exact:true}).click();
  }
  await page.getByText(/request is saved/i).first().waitFor({timeout:15000});
  const chat = await one("SELECT * FROM contact_submissions WHERE company='TEST Machine Shop'"); assert.match(chat.message,/Missed quote requests/); assert.match(chat.message,/Tuesday/); assert.equal(chat.email,'chat@example.test');
  await page.getByRole('button',{name:'Close Nova assistant'}).click();
  await page.goto(`${base}/dashboard/command/workforce?view=executive`); await page.waitForURL(/\/login\?returnTo=/);
  await page.locator('input[type=email]').fill(owner.email); await page.locator('input[type=password]').fill(owner.password); await page.getByRole('button',{name:/sign in/i}).first().click();
  await page.waitForURL(/\/dashboard\/command\/workforce\?view=executive/,{timeout:20000});
  await page.getByText('CFO · Costs, free alternatives and launch prerequisites',{exact:true}).click();
  await page.getByText('TEST Machine Shop',{exact:true}).first().waitFor({timeout:15000});
  await page.screenshot({path:path.join(shots,'executive-desk-desktop.png'),fullPage:true});
  for(const [name,width,height] of [['ipad-portrait',820,1180],['ipad-landscape',1180,820],['phone',390,844]]) {
    await page.setViewportSize({width,height});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),`${name} must not overflow horizontally`);
    if(width<1024)assert.equal(await page.locator('aside').first().isVisible(),false,`${name} needs a collapsed sidebar, not a squeezed desktop layout`);
    await page.screenshot({path:path.join(shots,`executive-desk-${name}.png`),fullPage:true});
  }
  assert.deepEqual(pageErrors,[]);
  console.log('PASS — actual chat-to-owner-inbox, preserved login destination, CFO report, desktop/iPad/phone layout and no browser errors');
} catch(e) { console.error(e); process.exitCode=1; }
finally { if(browser)await browser.close();await H.stop(); }
process.exit(process.exitCode??0);
