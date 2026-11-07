// Real public form, local API/database. Provider dispatch stays locked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import packaged from '@sparticuz/chromium';
import {startHarness} from './testenv/devharness.mjs';
import {makeCaller} from './testenv/call.mjs';
import {setupTestBusiness,clearProviderEnv} from './testenv/opsFixture.mjs';
clearProviderEnv();process.env.NOVA_SPENDING_LOCK='locked';
const H=await startHarness({manifest:true,vitePort:5228,apiPort:8828});let browser;
try{
 const q=async(s,p)=>(await H.env.sql(s,p)).rows;
 const headquarters=(await q("insert into organizations(name,slug,kind) values('TEST HQ','sms-browser-hq','nova_internal') returning id"))[0].id;
 const owner=await H.env.createUser({email:'sms-browser-owner@nova.test',role:'nova_super_admin',orgId:headquarters});
 const client=makeCaller((await import('../api/client.js')).default);
 const {biz}=await setupTestBusiness({env:H.env,client,ownerToken:owner.token,name:'TEST Nova public form'});
 await q("update organizations set kind='client' where id=$1",[headquarters]);
 await q("update organizations set kind='nova_internal' where id=$1",[biz]);
 await q("update wave1_org_settings set form_token='TEST-nova-browser-form-0123456789' where organization_id=$1",[biz]);
 browser=await chromium.launch({executablePath:await packaged.executablePath(),args:packaged.args,headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${H.base}/book`);
 const checkbox=page.getByRole('checkbox',{name:/Service texts \(optional\)/});
 assert.equal(await checkbox.isChecked(),false);assert.equal(await checkbox.getAttribute('required'),null);
 assert.equal(await page.getByRole('link',{name:'Privacy Policy',exact:true}).count()>0,true);
 assert.equal(await page.getByRole('link',{name:'Terms of Service',exact:true}).count()>0,true);
 fs.mkdirSync('docs/qa/service-sms-consent-2026-11-07',{recursive:true});
 for(const [name,width,height]of [['desktop',1366,900],['ipad',820,1180],['phone',390,844]]){
  await page.setViewportSize({width,height});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`${name} must fit`);
  await page.screenshot({path:`docs/qa/service-sms-consent-2026-11-07/${name}.png`,fullPage:true});
 }
 const fill=async suffix=>{
  await page.getByLabel('Your name',{exact:true}).fill(`TEST Requester ${suffix}`);
  await page.getByLabel('Email',{exact:true}).fill(`sms-browser-${suffix}@example.test`);
  await page.getByLabel('Phone (optional)',{exact:true}).fill(`20355501${suffix}`);
 };
 await fill('81');
 await page.waitForTimeout(2100);
 const post1=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('op=web-inquiry'));
 await page.getByRole('button',{name:'Send request',exact:true}).click();
 const first=await post1;const firstBody=await first.json();assert.equal(first.status(),200,JSON.stringify(firstBody));assert(firstBody.next_url,JSON.stringify(firstBody));
 await page.waitForURL(/\/service\//);
 let person=(await q("select * from crm_contacts where organization_id=$1 and email='sms-browser-81@example.test'",[biz]))[0];
 assert.equal(person.sms_consent,false);
 let conv=(await q('select * from wave1_conversations where contact_id=$1',[person.id]))[0];
 assert.equal(conv.channel,'form');assert.equal(conv.customer_initiated_at,null);
 await page.goto(`${H.base}/book`);await fill('82');await checkbox.check();
 // Form anti-spam requires two seconds of real page residence.
 await page.waitForTimeout(2100);
 const post2=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('op=web-inquiry'));
 await page.getByRole('button',{name:'Send request',exact:true}).click();
 const second=await post2;const secondBody=await second.json();assert.equal(second.status(),200,JSON.stringify(secondBody));assert(secondBody.next_url,JSON.stringify(secondBody));
 await page.waitForURL(/\/service\//);
 person=(await q("select * from crm_contacts where organization_id=$1 and email='sms-browser-82@example.test'",[biz]))[0];
 assert.equal(person.sms_consent,false);
 conv=(await q('select * from wave1_conversations where contact_id=$1',[person.id]))[0];assert.equal(conv.channel,'form');assert(conv.customer_initiated_at);
 const proof=(await q("select payload_summary->'sms_service_opt_in' proof from wave1_source_events where organization_id=$1 and payload_summary->'sms_service_opt_in'->>'phone_e164'='+12035550182'",[biz]))[0].proof;
 assert.equal(proof.granted,true);assert.equal(proof.version,'nova-service-sms-2026-11-07-v2');assert.equal(proof.scope,'service_request_only');assert.match(proof.disclosure,/not a condition of purchase/);
 assert.equal((await q("select count(*)::int n from jobs where job_type='ops_sms_turn'"))[0].n,0);
 assert.equal((await q("select count(*)::int n from wave1_messages where direction='outbound'"))[0].n,0);
 assert.deepEqual(errors,[]);
 console.log('PASS — public checkbox starts unchecked, optional; both requests reach private booking; scoped receipt saved only when selected; no SMS/marketing grant; desktop/iPad/phone fit');
}catch(e){console.error(e);process.exitCode=1;}finally{if(browser)await browser.close();await H.stop();}
process.exit(process.exitCode??0);
