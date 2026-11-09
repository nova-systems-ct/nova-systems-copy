import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import packaged from '@sparticuz/chromium';
import {startHarness} from './testenv/devharness.mjs';
const H=await startHarness({manifest:true,vitePort:5217,apiPort:8817});let browser;
try{
 const org=(await H.env.sql("insert into organizations(name,slug,kind) values('TEST Nova Channels','channels-browser','nova_internal') returning id")).rows[0].id;
 const owner=await H.env.createUser({email:'channel-browser@nova.test',role:'nova_super_admin',orgId:org});
 const other=(await H.env.sql("insert into organizations(name,slug,kind) values('TEST Other Channels','channels-browser-other','client') returning id")).rows[0].id;
 await H.env.sql("insert into organization_members(organization_id,member_type,staff_user_id,role,status) values($1,'staff',$2,'nova_super_admin','active')",[other,owner.id]);
 browser=await chromium.launch({headless:true,executablePath:await packaged.executablePath(),args:packaged.args.filter(x=>!x.startsWith('--single-process'))});
 const page=await browser.newPage({viewport:{width:1366,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${H.base}/dashboard/integrations`);await page.waitForURL(/\/login\?returnTo=/);
 await page.locator('input[type=email]').fill(owner.email);await page.locator('input[type=password]').fill(owner.password);await page.getByRole('button',{name:/sign in/i}).first().click();
 await page.waitForURL(/\/dashboard\/integrations/,{timeout:20000});
 await page.getByRole('heading',{name:'Your connected channels',exact:true}).waitFor({timeout:12000});
 await page.getByRole('button',{name:'Prepare a connection',exact:true}).click();
 await page.getByLabel('Business account ID',{exact:true}).fill('10001');
 await page.getByLabel('Connection label',{exact:true}).fill('TEST Instagram');
 await page.getByLabel('Server secret reference',{exact:true}).fill('NOVA_CHANNEL_TOKEN_INSTAGRAM_TEST');
 await page.getByRole('button',{name:'Save connection draft',exact:true}).click();
 await page.getByText('TEST Instagram',{exact:true}).waitFor({timeout:15000});
 const rows=(await H.env.sql('select * from channel_connections where organization_id=$1',[org])).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].status,'draft');assert.equal(rows[0].outbound_enabled,false);assert.equal(rows[0].token_ref,'NOVA_CHANNEL_TOKEN_INSTAGRAM_TEST');
 await page.reload();await page.getByText('TEST Instagram',{exact:true}).waitFor();
 await page.getByText('TEST Instagram',{exact:true}).click();await page.getByText('Correct connection details',{exact:true}).click();
 await page.getByLabel('Correct server secret reference',{exact:true}).fill('NOVA_CHANNEL_TOKEN_CORRECTED_TEST');await page.getByRole('button',{name:'Save corrected draft',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Draft corrected'}).last().waitFor();
 assert.equal((await H.env.sql('select token_ref from channel_connections where id=$1',[rows[0].id])).rows[0].token_ref,'NOVA_CHANNEL_TOKEN_CORRECTED_TEST');
 await page.getByText('Approved comment replies',{exact:true}).click();await page.getByLabel('Comment keyword',{exact:true}).fill('MENU');await page.getByLabel('Exact private reply',{exact:true}).fill('TEST requested menu link');await page.getByRole('button',{name:'Approve keyword reply',exact:true}).click();await page.getByRole('button',{name:'Pause rule',exact:true}).waitFor();
 // A slow save in business A must not cancel business B's load or alter B's forms/notices.
 let releasePost,releaseOther,postFetched,otherFetched;
 const postReady=new Promise(r=>{postFetched=r}),otherReady=new Promise(r=>{otherFetched=r});
 const postGate=new Promise(r=>{releasePost=r}),otherGate=new Promise(r=>{releaseOther=r});
 await page.route('**/api/integrations?op=channels*',async route=>{
  if(route.request().method()==='POST'){const response=await route.fetch();postFetched();await postGate;return route.fulfill({response});}
  if(new URL(route.request().url()).searchParams.get('organization_id')===other){const response=await route.fetch();otherFetched();await otherGate;return route.fulfill({response});}
  return route.continue();
 });
 await page.getByRole('button',{name:'Prepare a connection',exact:true}).click();
 await page.getByLabel('Business account ID',{exact:true}).fill('10002');await page.getByLabel('Connection label',{exact:true}).fill('TEST Slow A');await page.getByLabel('Server secret reference',{exact:true}).fill('NOVA_CHANNEL_TOKEN_SLOW_TEST');
 await page.getByRole('button',{name:'Save connection draft',exact:true}).click();await postReady;
 await page.getByRole('button',{name:'TEST Nova Channels',exact:true}).click();await page.getByRole('option',{name:'TEST Other Channels',exact:true}).click();await otherReady;
 const oldResponse=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('op=channels'));releasePost();await oldResponse;
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));releaseOther();
 await page.getByRole('button',{name:'Prepare a connection',exact:true}).waitFor();
 await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent==='Prepare a connection');return b&&!b.disabled},{timeout:7000});
 assert.equal(await page.getByText('TEST Slow A',{exact:true}).count(),0);assert.equal(await page.getByRole('status').filter({hasText:'Prepared only'}).count(),0);
 await page.unroute('**/api/integrations?op=channels*');
 await page.getByRole('button',{name:'Coverage and applications',exact:true}).click();
 await page.getByText('Apple Messages for Business',{exact:true}).first().waitFor();
 fs.mkdirSync('../channel-browser-acceptance',{recursive:true});
 for(const [label,width,height] of [['desktop',1366,900],['ipad',820,1180],['phone',390,844]]){
  await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`${label} must fit`);
  await page.screenshot({path:`../channel-browser-acceptance/${label}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS — real browser prepares and reloads a scoped connection without entering secrets, shows Apple/Android application boundaries, and fits desktop/iPad/phone');
}catch(e){console.error(e);process.exitCode=1;}finally{if(browser)await browser.close();await H.stop();}
process.exit(process.exitCode??0);
