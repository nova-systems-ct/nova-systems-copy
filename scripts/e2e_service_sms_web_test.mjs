import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import packaged from '@sparticuz/chromium';
import {startTestEnv} from './testenv/env.mjs';
import {SERVICE_SMS_POLICY} from '../public/sms-program/policy.js';
import {validateServiceRequest} from '../api/_serviceSmsRequest.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const migration='supabase/migrations/20261108172929_service_sms_intake.sql';
const env=await startTestEnv({migrations:['scripts/testenv/serviceSmsLegacy.sql','scripts/testenv/launchWorkerLegacy.sql',migration,'supabase/migrations/20261109194341_launch_worker_booking.sql'],publicBuckets:[]});
let server,browser;
try {
  assert.deepEqual(env.migrationErrors,[]);
  Object.assign(process.env,env.appEnv,{NOVA_SPENDING_LOCK:'locked'});
  const handler=(await import('../api/book-meeting.js')).default;
  const q=async(sql,args)=>(await env.sql(sql,args)).rows;
  const call=async body=>{
    let status=200,result; const headers={};
    const res={setHeader:(k,v)=>headers[k]=v,status(n){status=n;return this},json(v){result=v;return this},end(){return this}};
    await handler({method:'POST',headers:{'x-forwarded-for':'127.0.0.2'},query:{},body},res);
    return {status,result};
  };
  const body=(suffix,consent=false)=>({request_type:'service_sms_request',submission_id:randomUUID(),rendered_at:Date.now()-5000,name:'TEST '+suffix,business_name:'TEST Nova',email:`test-${suffix}@example.invalid`,phone:'+12035550192',message:'TEST service request',service_sms_consent:consent,service_sms_consent_version:SERVICE_SMS_POLICY.version});
  const plain=body('plain');const a=await call({...plain,sms_consent:true,marketing_consent:true,organization_id:randomUUID()});
  assert.equal(a.status,200);assert.equal(a.result.service_sms_consent,false);assert.equal(a.result.marketing_consent,false);
  let receipt=(await q('select * from nova_service_sms_receipts where request_id=$1',[plain.submission_id]))[0];
  assert.equal(receipt.service_sms_consent,false);assert.equal(receipt.marketing_consent,false);assert.equal(receipt.scope,'service_request_only');
  const service=body('opted',true);const b=await call(service);assert.equal(b.status,200);assert.equal(b.result.service_sms_consent,true);
  receipt=(await q('select * from nova_service_sms_receipts where request_id=$1',[service.submission_id]))[0];
  assert.equal(receipt.disclosure,SERVICE_SMS_POLICY.text);assert.equal(receipt.disclosure_version,SERVICE_SMS_POLICY.version);assert.equal(receipt.source_path,SERVICE_SMS_POLICY.sourcePath);assert.equal(receipt.marketing_consent,false);
  assert(receipt.received_at);assert.equal(receipt.phone_e164,'+12035550192');
  const again=await call({...service,service_sms_consent:false});assert.equal(again.result.duplicate,true);
  assert.equal((await q('select count(*)::int n from intake_requests'))[0].n,2);
  assert.equal((await q('select count(*)::int n from nova_crm_contacts'))[0].n,1,'Same phone must reuse the existing contact');
  assert.equal((await q('select count(*)::int n from nova_crm_activities'))[0].n,2);
  assert.equal((await q('select meeting_date,meeting_time from intake_requests limit 1'))[0].meeting_date,null);
  for(const patch of [{phone:'',service_sms_consent:true},{service_sms_consent_version:'stale'},{submission_id:'invalid'},{submission_id:[service.submission_id]},{website_url_confirm:'bot'},{rendered_at:Date.now()+10000},{email:'invalid'}]) assert(validateServiceRequest({...service,...patch}).error);
  const race=body('race',true);
  const raced=await Promise.all(Array.from({length:3},()=>call(race)));
  assert(raced.every(r=>r.status===200));assert.equal(raced.filter(r=>r.result.duplicate===false).length,1);
  assert.equal((await q('select count(*)::int n from intake_requests where id=$1',[race.submission_id]))[0].n,1);
  const user=await env.createUser({email:'unrelated@example.invalid'});
  for(const token of [null,user.token]){
    assert((await env.rest(token,'rpc/record_nova_service_request',{method:'POST',body:{p_request:{}}})).status>=400);
    const read=await env.rest(token,'nova_service_sms_receipts?select=*');assert(read.status>=400||read.data.length===0);
  }
  const before=(await q('select count(*)::int n from intake_requests'))[0].n;
  await q("create function public.fail_test_activity() returns trigger language plpgsql as $$begin raise exception 'TEST injected activity failure'; end$$; create trigger fail_test_activity before insert on nova_crm_activities for each row execute function public.fail_test_activity();");
  const failed=await call({...body('rollback',true),phone:'+12035550193'});assert.equal(failed.status,502);
  assert.equal((await q('select count(*)::int n from intake_requests'))[0].n,before,'Failure must roll back the request and consent together');
  assert.equal((await q("select count(*)::int n from nova_crm_contacts where email='test-rollback@example.invalid'"))[0].n,0);
  await q('drop trigger fail_test_activity on nova_crm_activities; drop function public.fail_test_activity();');
  console.log('PASS — real PostgreSQL/PostgREST: no implicit SMS or marketing; exact receipt; contact reuse; retries/races; no fake booking; anonymous/client denial; atomic rollback');

  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
  server=http.createServer(async(req,res)=>{
    try{
      const u=new URL(req.url,'http://localhost');
      if(u.pathname==='/api/book-meeting'){
        const chunks=[];for await(const c of req)chunks.push(c);req.body=JSON.parse(Buffer.concat(chunks).toString()||'{}');req.query=Object.fromEntries(u.searchParams);
        const out={setHeader:(k,v)=>res.setHeader(k,v),status(n){res.statusCode=n;return out},json(v){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(v));return out},end(){res.end();return out}};
        return handler(req,out);
      }
      const aliases={'/service-request':'/sms-program/index.html','/service-texts/privacy':'/sms-program/privacy.html','/service-texts/terms':'/sms-program/terms.html'};
      const name=aliases[u.pathname]||u.pathname;
      if(!name.startsWith('/sms-program/')||name.includes('..')){res.statusCode=404;return res.end();}
      const f=path.join(root,'public',name);res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));
    }catch{res.statusCode=500;res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({executablePath:await packaged.executablePath(),args:packaged.args,headless:true});
  const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  fs.mkdirSync('docs/qa/service-sms-regression-2026-11-09',{recursive:true});
  await page.goto(base+'/service-request');const checkbox=page.getByRole('checkbox',{name:/Service texts \(optional\)/});
  assert.equal(await checkbox.isChecked(),false);assert.equal(await checkbox.getAttribute('required'),null);
  assert.equal(await page.locator('#disclosure').innerText(),SERVICE_SMS_POLICY.text);
  assert(fs.readFileSync('public/sms-program/index.html','utf8').includes(SERVICE_SMS_POLICY.text),'The disclosure must also be visible in the server HTML for reviewers without JavaScript');
  await page.waitForFunction(()=>!document.querySelector('#submit').disabled);
  for(const [name,width,height]of [['desktop',1366,1000],['ipad',820,1180],['phone',390,844]]){
    await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`docs/qa/service-sms-regression-2026-11-09/${name}.jpg`,fullPage:true});
  }
  const fill=async suffix=>{await page.getByLabel('Your name',{exact:true}).fill('TEST Browser '+suffix);await page.getByLabel('Business name',{exact:true}).fill('TEST Nova');await page.getByLabel('Email',{exact:true}).fill(`browser-${suffix}@example.invalid`);await page.getByLabel('Phone (optional)',{exact:true}).fill('+12035550194');};
  await fill('no-sms');
  const post=page.waitForResponse(r=>r.url().endsWith('/api/book-meeting')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Send request',exact:true}).click();const saved=await post;assert.equal(saved.status(),200);const payload=await saved.json();assert.equal(payload.service_sms_consent,false);
  await page.getByRole('heading',{name:'Your request is saved.',exact:true}).waitFor();
  await page.screenshot({path:'docs/qa/service-sms-regression-2026-11-09/request-saved.jpg',fullPage:true});
  await page.goto(base+'/service-request?new=1');await fill('sms');await checkbox.check();
  // The real timing guard is retained; policy-page navigation gives the user reading time.
  const policy=await page.context().newPage();await policy.goto(base+'/service-texts/privacy');assert.match(await policy.locator('main').innerText(),/not sold or shared/);await policy.goto(base+'/service-texts/terms');assert.match(await policy.locator('main').innerText(),/not a condition of purchase/);await policy.close();
  await page.getByLabel('What would you like help with?',{exact:true}).fill('TEST Please help connect customer messaging to my systems.');
  await page.waitForFunction(()=>!document.querySelector('#submit').disabled);
  const opted=page.waitForResponse(r=>r.url().endsWith('/api/book-meeting')&&r.request().method()==='POST');await page.getByRole('button',{name:'Send request',exact:true}).click();const granted=await opted;assert.equal(granted.status(),200);assert.equal((await granted.json()).service_sms_consent,true);
  await page.getByRole('heading',{name:'Your request is saved.',exact:true}).waitFor();
  assert.deepEqual(errors,[]);assert.equal(env.stubs.emailRequests.length,0,'The service request must never contact the email provider');assert.equal(env.stubs.outbox.length,0);
  console.log('PASS — browser: public opt-in/policies/confirmation, optional unchecked choice, exact disclosure, both real saves, desktop/iPad/phone; zero provider emails');
} finally {if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));await env.stop();}
