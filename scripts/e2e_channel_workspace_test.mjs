import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import packaged from '@sparticuz/chromium';
import {startTestEnv} from './testenv/env.mjs';
import {channelConfiguration,createChannelRequest,sendChannelReply} from '../api/_channelProviders.js';
const migration=process.env.CHANNEL_MIGRATION||'supabase/migrations/20261110121400_channel_workspace.sql';
const env=await startTestEnv({migrations:['scripts/testenv/serviceSmsLegacy.sql','scripts/testenv/launchWorkerLegacy.sql','supabase/migrations/20261108172929_service_sms_intake.sql','supabase/migrations/20261109194341_launch_worker_booking.sql','supabase/migrations/20261109195329_launch_worker_owner_cancel.sql','supabase/migrations/20261110021301_local_worker_drafts.sql','supabase/migrations/20261110023037_worker_model_metadata.sql',migration],publicBuckets:[]});
const originalFetch=global.fetch;
let browser,vite;
try{
 assert.deepEqual(env.migrationErrors,[]);
 Object.assign(process.env,env.appEnv,{NOVA_SPENDING_LOCK:'locked',NOVA_BILLABLE_DISPATCH_ENABLED:'false',NOVA_FREE_SOCIAL_SEND_ENABLED:'false'});
 const q=async(sql,args=[])=>(await env.sql(sql,args)).rows;
 const org=(await q("select id from organizations where kind='nova_internal' limit 1"))[0].id;
 const owner=await env.createUser({email:'channel-owner@example.invalid',role:'nova_super_admin',orgId:org});
 const other=await env.createUser({email:'channel-other@example.invalid',role:'nova_admin',orgId:org});
 const otherOrg=(await q("insert into organizations(name,kind)values('TEST unrelated','client') returning id"))[0].id;
 const externalOwner=await env.createUser({email:'channel-external@example.invalid',role:'nova_super_admin',orgId:otherOrg});
 const {handleChannelAdmin,handleChannelWebhook,validMetaSignature}=await import('../api/_channelWorkspace.js');
 const invoke=async(fn,body={},token=owner.token,{method='POST',query={},headers={},raw}={})=>{let status=200,data;const res={setHeader(){},status(n){status=n;return res;},json(v){data=v;return res;},send(v){data=v;return res;},end(){return res;}};await fn({method,body,query,headers:{...(token?{authorization:'Bearer '+token}:{}),...headers}},res,raw);return{status,data};};
 const admin=(body,token=owner.token)=>invoke(handleChannelAdmin,body,token);
 for(const token of [null,other.token,externalOwner.token])assert.equal((await admin({action:'overview'},token)).status,token?403:401);
 const ids=[];for(const channel of ['instagram','tiktok','apple_messages']){const r=await admin({action:'practice',channel});assert.equal(r.status,200);ids.push(r.data.thread_id);}
 assert.equal((await q('select count(*)::int n from nova_channel_threads'))[0].n,3);
 assert.equal((await q('select count(*)::int n from nova_crm_contacts'))[0].n,3);
 assert.equal((await q("select count(*)::int n from nova_tasks where status='pending'"))[0].n,3);
 const thread=ids[0],reply=randomUUID(),body={thread_id:thread,reply_id:reply,body:'TEST Thanks for reaching out. What part of arranging customer appointments needs attention?'};
 assert.equal((await admin({action:'save_draft',...body})).data.state,'draft');assert.equal((await admin({action:'save_draft',...body})).data.duplicate,true);
 assert.equal((await q('select status from nova_tasks where id=(select task_id from nova_channel_threads where id=$1)',[thread]))[0].status,'pending');
 assert.equal((await admin({action:'save_draft',...body,body:'A different message.'})).data.code,'reply_conflict');
 assert.equal((await admin({action:'send_reply',...body})).data.state,'test_recorded');assert.equal((await admin({action:'send_reply',...body})).data.duplicate,true);
 assert.equal((await q("select count(*)::int n from nova_crm_activities where outcome='test_recorded_not_sent'"))[0].n,1);
 assert.equal((await q('select status from nova_tasks where id=(select task_id from nova_channel_threads where id=$1)',[thread]))[0].status,'completed');
 assert.equal((await admin({action:'pause',thread_id:thread})).status,200);
 assert.equal((await admin({action:'send_reply',...body,reply_id:randomUUID()})).data.code,'thread_paused');
 assert.equal((await admin({action:'resume',thread_id:thread})).status,200);
 let calls=0,tiktokReads=0,simulateTimeout=false;
 Object.assign(process.env,{INSTAGRAM_ACCOUNT_ID:'IG-TEST',INSTAGRAM_APP_SECRET:'fixture-only-not-a-real-secret',INSTAGRAM_ACCESS_TOKEN:'fixture-only-token',INSTAGRAM_API_VERSION:'v25.0',INSTAGRAM_VERIFY_TOKEN:'fixture-only-verify',TIKTOK_BUSINESS_ID:'TT-TEST',TIKTOK_MESSAGING_ACCESS_TOKEN:'fixture-only-token'});
 global.fetch=async(url,options={})=>{
  const u=new URL(url);
  if(['127.0.0.1','localhost'].includes(u.hostname))return originalFetch(url,options);
  if(u.hostname==='business-api.tiktok.com'&&options.method!=='POST'){
   tiktokReads++;assert.equal(options.headers['Access-Token'],'fixture-only-token');
   const data=u.pathname.includes('conversation/list')?{conversations:u.searchParams.get('conversation_type')==='SINGLE'?[{conversation_id:'conversation+encoded=='}]:[],has_more:false}:{messages:[{message_id:'TT-IN-1',message_type:'TEXT',timestamp:Date.now(),text:{body:'How do customer bookings work?'},from_user:{id:'customer-tt',role:'PERSONAL_ACCOUNT'},to_user:{id:'TT-TEST',role:'BUSINESS_ACCOUNT'}},{message_id:'TT-OUT-1',message_type:'TEXT',timestamp:Date.now(),text:{body:'Existing external reply'},from_user:{id:'TT-TEST',role:'BUSINESS_ACCOUNT'},to_user:{id:'customer-tt',role:'PERSONAL_ACCOUNT'}}]};
   if(u.pathname.includes('content/list'))assert.equal(u.searchParams.get('conversation_id'),'conversation+encoded==');
   return Response.json({code:0,data});
  }
  if(!['graph.instagram.com','business-api.tiktok.com','gw.messaging.cm.com'].includes(u.hostname))throw Error('Unexpected external network denied by test');
  calls++;if(simulateTimeout)throw Error('TEST network timed out');
  const parsed=JSON.parse(options.body);assert.equal(options.method,'POST');assert(options.signal);
  if(u.hostname==='graph.instagram.com'){assert.equal(parsed.recipient.id,'customer-ig');assert.equal(parsed.message.text,'TEST Reviewed business reply.');return Response.json({message_id:'IG-OUT-'+calls,recipient_id:'customer-ig'});}
  if(u.hostname==='business-api.tiktok.com'){assert.equal(parsed.recipient_type,'CONVERSATION');assert.equal(parsed.text.body,'TEST Reviewed business reply.');return Response.json({code:0,data:{message:{message_id:'TT-OUT-'+calls}}});}
  return Response.json({errorCode:0,messages:[{status:'Accepted',reference:parsed.messages.msg[0].reference,messageErrorCode:0,messageDetails:null}]});
 };
 const event={object:'instagram',entry:[{id:'IG-TEST',messaging:[{sender:{id:'customer-ig'},recipient:{id:'IG-TEST'},timestamp:Date.now(),message:{mid:'IG-IN-1',text:'I would like help collecting customer requests.'}}]}]};
 const raw=Buffer.from(JSON.stringify(event));const signature='sha256='+createHmac('sha256',process.env.INSTAGRAM_APP_SECRET).update(raw).digest('hex');
 assert(validMetaSignature(raw,signature,process.env.INSTAGRAM_APP_SECRET));assert(!validMetaSignature(Buffer.from('tampered'),signature,process.env.INSTAGRAM_APP_SECRET));
 assert.equal((await invoke(handleChannelWebhook,{},null,{query:{channel:'instagram'},raw,headers:{'x-hub-signature-256':'sha256='+'0'.repeat(64)}})).status,403);
 const inbound=()=>invoke(handleChannelWebhook,{},null,{query:{channel:'instagram'},raw,headers:{'x-hub-signature-256':signature}});
 assert.equal((await inbound()).status,200);assert.equal((await inbound()).status,200);
 assert.equal((await q("select count(*)::int n from nova_channel_messages where external_message_id='IG-IN-1'"))[0].n,1);
 const live=(await q("select * from nova_channel_threads where channel='instagram' and not is_test"))[0];
 const send={action:'send_reply',thread_id:live.id,reply_id:randomUUID(),body:'TEST Reviewed business reply.'};
 assert.equal((await admin(send)).status,423);assert.equal(calls,0);assert.equal((await q('select count(*)::int n from nova_channel_messages where id=$1',[send.reply_id]))[0].n,0);
 process.env.NOVA_FREE_SOCIAL_SEND_ENABLED='true';
 assert.equal((await admin(send)).data.state,'accepted');assert.equal(calls,1);assert.equal((await admin(send)).data.duplicate,true);assert.equal(calls,1);
 simulateTimeout=true;const uncertain={...send,reply_id:randomUUID()};assert.equal((await admin(uncertain)).data.state,'unknown');assert.equal(calls,2);assert.equal((await admin(uncertain)).data.state,'unknown');assert.equal(calls,2);
 assert.equal((await admin({...send,reply_id:randomUUID()})).data.code,'reply_unconfirmed');assert.equal(calls,2);simulateTimeout=false;
 const synced=await admin({action:'sync_tiktok'});assert.equal(synced.data.recorded,1);assert.equal((await admin({action:'sync_tiktok'})).data.recorded,0);assert.equal(tiktokReads,6);
 const tt=(await q("select * from nova_channel_threads where channel='tiktok' and not is_test"))[0];
 await q("update nova_channel_threads set last_inbound_at=now()-interval '49 hours' where id=$1",[tt.id]);
 assert.equal((await admin({...send,thread_id:tt.id,reply_id:randomUUID()})).data.code,'reply_window_closed');
 await q('update nova_channel_threads set last_inbound_at=now() where id=$1',[tt.id]);
 for(let n=0;n<10;n++)assert.equal((await admin({...send,thread_id:tt.id,reply_id:randomUUID()})).data.state,'accepted');
 assert.equal((await admin({...send,thread_id:tt.id,reply_id:randomUUID()})).data.code,'reply_limit');
 for(const token of [null,other.token,externalOwner.token]){
  for(const table of ['nova_channel_threads','nova_channel_messages']){const r=await env.rest(token,table+'?select=*');assert(r.status>=400||r.data.length===0);}
  assert((await env.rest(token,'rpc/nova_channel_owner',{method:'POST',body:{p_actor:owner.id,p_action:'overview'}})).status>=400);
  assert((await env.rest(token,'rpc/nova_channel_receive',{method:'POST',body:{p_channel:'instagram'}})).status>=400);
 }
 const configurations=channelConfiguration({});assert(configurations.every(c=>!c.configured&&!c.send_enabled));
 const cmEnv={CM_PRODUCT_TOKEN:'fixture-only-token',APPLE_BUSINESS_ACCOUNT_ID:'APPLE-TEST',NOVA_SPENDING_LOCK:'disabled',NOVA_BILLABLE_DISPATCH_ENABLED:'true'};
 assert.throws(()=>createChannelRequest('apple_messages',{account_id:'APPLE-TEST',external_peer_id:'peer',external_thread_id:'conversation',reply_id:'538cf876-45f8-43dc-8904-a64333b6e9dc'},'hello',{...cmEnv,NOVA_SPENDING_LOCK:'locked'}),/paused/);
 const cm=createChannelRequest('apple_messages',{account_id:'APPLE-TEST',external_peer_id:'peer',external_thread_id:'conversation',reply_id:'538cf876-45f8-43dc-8904-a64333b6e9dc'},'hello',cmEnv);assert.deepEqual(cm.body.messages.msg[0].allowedChannels,['Apple Messages for Business']);assert.equal(cm.body.messages.msg[0].to[0].number,'conversation');
 const cmResult=await sendChannelReply('apple_messages',{account_id:'APPLE-TEST',external_peer_id:'peer',external_thread_id:'conversation',reply_id:'538cf876-45f8-43dc-8904-a64333b6e9dc'},'hello',{env:cmEnv,fetchImpl:global.fetch});assert.equal(cmResult.state,'accepted');
 const appleRaw=Buffer.from(JSON.stringify({channel:'Apple Messages for Business',from:{number:'apple-conversation'},to:{number:'APPLE-TEST'},message:{text:'Help me organize customer appointments.'},timeUtc:new Date().toISOString()}));
 assert.equal((await invoke(handleChannelWebhook,{},null,{query:{channel:'apple_messages'},raw:appleRaw})).status,503);
 Object.assign(process.env,{CM_INBOUND_SECRET:'fixture-only-relay-secret',NOVA_CM_RELAY_VERIFIED:'true',APPLE_BUSINESS_ACCOUNT_ID:'APPLE-TEST'});
 assert.equal((await invoke(handleChannelWebhook,{},null,{query:{channel:'apple_messages'},raw:appleRaw,headers:{authorization:'Bearer incorrect'}})).status,403);
 for(let n=0;n<2;n++)assert.equal((await invoke(handleChannelWebhook,{},null,{query:{channel:'apple_messages'},raw:appleRaw,headers:{authorization:'Bearer fixture-only-relay-secret'}})).status,200);
 assert.equal((await q("select count(*)::int n from nova_channel_threads where channel='apple_messages' and not is_test"))[0].n,1);
 assert.equal((await q("select count(*)::int n from nova_channel_messages m join nova_channel_threads t on t.id=m.thread_id where t.channel='apple_messages' and not t.is_test"))[0].n,1);
 console.log('PASS — real PostgreSQL/PostgREST: owner and tenant isolation, private RLS, all three practice channels, CRM contacts/tasks, reviewed drafts, immutable retries, pause, signed Instagram ingestion, read-only TikTok sync, encoded conversation IDs, reply windows/limits, accepted versus delivered, uncertain-send hold, spending locks; all provider traffic used explicit local fixtures.');
 global.fetch=originalFetch;
 await q("insert into permissions(key)values('overview.view'),('growth.view'),('execution.view') on conflict do nothing;insert into role_permissions(role,permission_id)select 'nova_super_admin',id from permissions where key in ('overview.view','growth.view','execution.view');");
 const {handleLaunchAdmin}=await import('../api/_launchWorker.js');
 const {createServer,transformWithEsbuild}=await import('vite');
 const qaEntry=`import React from 'react';import{createRoot}from'react-dom/client';import App from '/src/App.jsx';import{ supabase }from'/src/lib/supabaseClient.js';import'/src/index.css';const{error}=await supabase.auth.signInWithPassword({email:${JSON.stringify(owner.email)},password:${JSON.stringify(owner.password)}});if(error)throw error;history.replaceState(null,'','/dashboard');createRoot(document.getElementById('root')).render(<App/>);`;
 vite=await createServer({server:{host:'127.0.0.1',port:0},plugins:[{name:'channel-workspace-acceptance-only',resolveId(id){if(id==='/__channel_qa.jsx')return id;},async load(id){if(id==='/__channel_qa.jsx')return(await transformWithEsbuild(qaEntry,id,{loader:'jsx',jsx:'automatic'})).code;},configureServer(s){s.middlewares.use(async(req,res,next)=>{
  if(req.url==='/__channel_qa'){res.setHeader('Content-Type','text/html');return res.end(await s.transformIndexHtml('/__channel_qa','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#090909"><div id="root"></div><script type="module" src="/__channel_qa.jsx"></script></body></html>'));}
   if(req.url?.startsWith('/sms-program/')){const route=new URL(req.url,'http://localhost').pathname;if(route.includes('..')){res.statusCode=404;return res.end();}const file=path.resolve('public'+route);if(fs.existsSync(file)){res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/plain');return res.end(fs.readFileSync(file));}}
   if(process.env.NOVA_CHANNEL_MODEL_ACCEPTANCE==='1'&&req.url?.startsWith('/assets/')){const route=new URL(req.url,'http://localhost').pathname;if(!route.includes('..')){const file=path.resolve('dist'+route);if(fs.existsSync(file)){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync(file));}}}
   if(process.env.NOVA_CHANNEL_MODEL_ACCEPTANCE==='1'&&req.url?.startsWith('/ai-runtime/')){const route=new URL(req.url,'http://localhost').pathname;if(route.includes('..')){res.statusCode=404;return res.end();}const file=path.resolve('dist'+route);if(!fs.existsSync(file)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':'text/javascript');return res.end(fs.readFileSync(file));}
   if(process.env.NOVA_CHANNEL_MODEL_ACCEPTANCE==='1'&&req.url?.startsWith('/__model_assets/')){
    const asset=new URL(req.url,'http://localhost').pathname.slice('/__model_assets/'.length);const prefix='onnx-community/Qwen2.5-0.5B-Instruct/resolve/22942cb7d7ba4cc81bb4673549ca4d4614469b5e/';if(!asset.startsWith(prefix)||asset.includes('..')){res.statusCode=404;return res.end();}
    const file=path.resolve('.testenv/model-runtime/model-cache/onnx-community/Qwen2.5-0.5B-Instruct/22942cb7d7ba4cc81bb4673549ca4d4614469b5e',asset.slice(prefix.length));if(!fs.existsSync(file)){res.statusCode=404;return res.end();}
    res.setHeader('Content-Type',file.endsWith('.json')?'application/json':'application/octet-stream');res.setHeader('Content-Length',fs.statSync(file).size);return req.method==='HEAD'?res.end():fs.createReadStream(file).pipe(res);
   }
  if(req.url?.startsWith('/api/client?resource=')||req.url?.startsWith('/api/integrations?op=launch-check')){
   const u=new URL(req.url,'http://localhost');const chunks=[];for await(const c of req)chunks.push(c);req.body=JSON.parse(Buffer.concat(chunks).toString()||'{}');req.query=Object.fromEntries(u.searchParams);
   const out={setHeader:(k,v)=>res.setHeader(k,v),status(n){res.statusCode=n;return out;},json(v){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(v));return out;},end(){res.end();return out;}};
   if(u.pathname==='/api/integrations')return out.status(200).json({twilio:{credentials_accepted:false,http_status:401},login:{apple_enabled:false,google_enabled:false}});
   if(req.query.resource==='channels')return handleChannelAdmin(req,out);
   if(req.query.resource==='launch')return handleLaunchAdmin(req,out);
  }next();
 });}}]});
 await vite.listen();const base='http://127.0.0.1:'+vite.httpServer.address().port;
 browser=await chromium.launch({headless:true,executablePath:await packaged.executablePath(),args:packaged.args});const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.text().includes('[nova-local-ai]'))console.log(msg.text());});
 fs.mkdirSync('docs/qa/launch-day-2026-11-10',{recursive:true});
 await page.goto(base+'/__channel_qa');await page.getByRole('heading',{name:'Less chasing. More getting it done.',exact:true}).waitFor({timeout:30000});
 for(const [name,width,height]of[['desktop',1440,1000],['ipad',820,1180],['phone',390,844]]){await page.setViewportSize({width,height});await page.evaluate(()=>window.scrollTo(0,0));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await page.locator('.nova-dashboard-sidebar').isVisible(),width>=768);const area=await page.locator('.nova-dashboard-main').boundingBox();assert(area.width>=width-(width>=768?220:10));await page.screenshot({path:'docs/qa/launch-day-2026-11-10/dashboard-'+name+'.jpg',fullPage:true});}
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('link',{name:'Conversations',exact:true}).click();await page.getByRole('heading',{name:'Every conversation. A next step.',exact:true}).waitFor();
 await page.getByLabel('Practice channel',{exact:true}).selectOption('apple_messages');await page.getByRole('button',{name:'Start a practice conversation',exact:true}).click();await page.getByRole('heading',{name:'Practice customer',exact:true}).waitFor();
 await page.getByLabel('Your reply · review before sending',{exact:true}).fill('TEST A reviewed Apple practice reply. Which business workflow should we discuss?');await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByText(/Saved draft · not sent/).waitFor();
 await page.getByRole('button',{name:'Record practice reply',exact:true}).click();await page.getByText(/Practice reply recorded · not sent/).first().waitFor();
 assert.equal((await q("select count(*)::int n from nova_channel_messages where body='TEST A reviewed Apple practice reply. Which business workflow should we discuss?' and state='test_recorded'"))[0].n,1);
 if(process.env.NOVA_CHANNEL_MODEL_ACCEPTANCE==='1'){
  for(const [channel,name]of[['instagram','Mira'],['tiktok','Kai'],['apple_messages','Ellis']]){
   await page.getByLabel('Practice channel',{exact:true}).selectOption(channel);await page.getByRole('button',{name:'Start a practice conversation',exact:true}).click();await page.getByRole('button',{name:'Run '+name,exact:true}).waitFor();
   await page.getByLabel('Record the practice reply when the worker finishes',{exact:true}).check();assert(await page.getByLabel('Record the practice reply when the worker finishes',{exact:true}).isChecked());console.log('Running actual browser Worker for '+name+'…');
   await page.getByRole('button',{name:'Run '+name,exact:true}).click();await Promise.race([page.getByText('Practice reply recorded · not sent',{exact:false}).first().waitFor({timeout:180000}),page.locator('.workspace-alert').waitFor({state:'visible',timeout:180000}).then(async()=>{throw Error(await page.locator('.workspace-alert').innerText());})]);
   assert((await page.locator('.workspace-message.outgoing').count())>0);console.log('PASS — '+name+' generated with actual browser WASM and recorded the private practice response through API to PostgreSQL.');
  }
 }
 for(const [name,width,height]of[['desktop',1440,1000],['phone',390,844]]){await page.setViewportSize({width,height});await page.evaluate(()=>window.scrollTo(0,0));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'docs/qa/launch-day-2026-11-10/conversations-'+name+'.jpg',fullPage:true});}
 assert.deepEqual(errors,[]);console.log('PASS — actual authenticated owner browser: luxury dashboard and conversations at desktop/iPad/phone widths; private practice thread, reviewed draft and recorded response saved through API to PostgreSQL. Provider status in this layout test is an explicit fixture.');
}finally{global.fetch=originalFetch;if(vite)await vite.close();if(browser)await browser.close();
 // Idle local pg clients can receive the server's intentional 57P01 shutdown
 // after pool.end(). Ignore only that shutdown event, after all assertions.
 env.pool.on('error',e=>{if(e.code!=='57P01')throw e;});await env.stop();}
