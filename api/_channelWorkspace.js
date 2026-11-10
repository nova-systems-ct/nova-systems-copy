import { createHmac, createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { requireStaff } from './_auth.js';
import { rateLimit } from './_rateLimit.js';
import { launchRpc } from './_launchWorker.js';
import { channelConfiguration, createChannelRequest, sendChannelReply } from './_channelProviders.js';
import {runtimeProviderEnv} from './_providerVault.js';
import {scheduleInboundSalesWorker,requireCostBudget} from './_autonomousSales.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHANNELS=['instagram','tiktok','apple_messages','sms','whatsapp'];
const ERRORS={reply_unconfirmed:'Verify the previous provider result before sending another reply.',owner_required:'Only the Nova account owner can use this workspace.',thread_not_found:'This conversation is unavailable.',reply_conflict:'This reply reference was already used for different text.',reply_window_closed:'The reply window has closed. Wait for a new customer message.',reply_limit:'Wait for a customer response before sending another message.',thread_paused:'This conversation is paused or opted out.',invalid_message:'Review a message of 1 to 2,000 characters.'};
function answer(res,data){return res.status(data.ok?200:data.code==='owner_required'?403:409).json(data.ok?data:{...data,error:ERRORS[data.code]||'This action could not be completed.'});}
async function owner(caller,action='overview',payload={}){return launchRpc('nova_channel_owner',{p_actor:caller.id,p_action:action,p_payload:payload});}

export async function handleChannelAdmin(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed.'});
 const caller=await requireStaff(req,res,'admin.view');if(!caller)return;
 if(!rateLimit(req,res,40,60000))return;
 const b=req.body||{},action=req.method==='GET'?'overview':b.action;
 try{
  const access=await owner(caller);if(!access.ok)return answer(res,access);
  const env=await runtimeProviderEnv();
  if(action==='overview')return answer(res,{...access,channels:channelConfiguration(env),spending_locked:!channelConfiguration(env).some(c=>c.send_enabled)});
  if(action==='practice'){
   if(!CHANNELS.includes(b.channel))return res.status(422).json({error:'Choose a supported practice channel.'});
   const data=await launchRpc('nova_channel_receive',{p_channel:b.channel,p_account:'TEST-NOVA',p_peer:'TEST-'+randomUUID(),p_thread:randomUUID(),p_external_message:'TEST-'+randomUUID(),p_text:'TEST I run a local service business. I miss customer inquiries while working and want a simpler way to arrange appointments.',p_received_at:new Date().toISOString(),p_test:true});
   return answer(res,data);
  }
  if(action==='sync_tiktok')return answer(res,await syncTikTok(env));
  if(!UUID.test(b.thread_id||''))return res.status(422).json({error:'Choose a conversation.'});
  if(['pause','resume','archive'].includes(action))return answer(res,await owner(caller,action,{thread_id:b.thread_id}));
  if(!['save_draft','send_reply'].includes(action)||!UUID.test(b.reply_id||'')||typeof b.body!=='string'||!b.body.trim()||b.body.length>2000)return res.status(422).json({error:'Review the message before saving or sending.'});
  const thread=access.threads.find(t=>t.id===b.thread_id);if(!thread)return answer(res,{ok:false,code:'thread_not_found'});
  const dispatchThread={...thread,reply_id:b.reply_id};
  if(action==='send_reply'&&!thread.is_test){createChannelRequest(thread.channel,dispatchThread,b.body.trim(),env);if(['sms','whatsapp','apple_messages'].includes(thread.channel))await requireCostBudget(thread.channel,'manual-reply:'+b.reply_id,env);}
  const data=await owner(caller,action,{thread_id:b.thread_id,reply_id:b.reply_id,body:b.body.trim(),agent_key:thread.channel});
  if(!data.ok||!data.dispatch)return answer(res,data);
  const result=await sendChannelReply(thread.channel,dispatchThread,b.body.trim(),{env});
  const saved=await launchRpc('nova_channel_finish',{p_reply:b.reply_id,p_state:result.state,p_provider_id:result.provider_id||null,p_error:result.error_code||null});
  return answer(res,saved);
 }catch(e){const known=['connection_required','dispatch_paused','budget_required'].includes(e.code);return res.status(known?423:502).json({ok:false,error:known?e.message:'Nova could not confirm this action. Refresh before retrying; uncertain sends are not automatically repeated.'});}
}

export function validMetaSignature(raw,signature,secret){
 if(!secret||typeof signature!=='string'||!/^sha256=[0-9a-f]{64}$/.test(signature))return false;
 const expected=createHmac('sha256',secret).update(raw).digest();
 return timingSafeEqual(expected,Buffer.from(signature.slice(7),'hex'));
}
export async function handleChannelWebhook(req,res,raw){
 const channel=req.query?.channel;
 if(channel==='apple_messages')return handleAppleRelay(req,res,raw);
 if(channel!=='instagram')return res.status(503).json({error:'Use provider-authorized inbox synchronization for this channel.'});
 const env=await runtimeProviderEnv();
 if(req.method==='GET'){
  if(env.INSTAGRAM_VERIFY_TOKEN&&req.query['hub.mode']==='subscribe'&&req.query['hub.verify_token']===env.INSTAGRAM_VERIFY_TOKEN)return res.status(200).send(String(req.query['hub.challenge']||'').slice(0,300));
  return res.status(403).json({error:'Verification failed.'});
 }
 if(req.method!=='POST')return res.status(405).end();
 if(!env.INSTAGRAM_APP_SECRET||!env.INSTAGRAM_ACCOUNT_ID)return res.status(503).json({error:'Business messaging is not configured.'});
 if(!validMetaSignature(raw,req.headers['x-hub-signature-256'],env.INSTAGRAM_APP_SECRET))return res.status(403).json({error:'Invalid signature.'});
 let event;try{event=JSON.parse(raw.toString('utf8'));}catch{return res.status(400).json({error:'Invalid JSON.'});}
 if(event.object!=='instagram')return res.status(400).json({error:'Wrong channel.'});
 try{
  let received=0;
  for(const entry of (event.entry||[]).slice(0,50)){
   if(String(entry.id)!==env.INSTAGRAM_ACCOUNT_ID)continue;
   for(const msg of (entry.messaging||[]).slice(0,50)){
    if(msg.message?.is_echo||!msg.message?.mid||typeof msg.message?.text!=='string'||String(msg.recipient?.id)!==env.INSTAGRAM_ACCOUNT_ID||!msg.sender?.id)continue;
    const data=await launchRpc('nova_channel_receive',{p_channel:'instagram',p_account:env.INSTAGRAM_ACCOUNT_ID,p_peer:String(msg.sender.id),p_thread:String(msg.sender.id),p_external_message:msg.message.mid,p_text:msg.message.text.slice(0,6000),p_received_at:new Date(Number(msg.timestamp)).toISOString(),p_test:false});
    if(!data.ok)throw Error('Inbound message not persisted');if(!data.duplicate)await scheduleInboundSalesWorker(data.thread_id);received++;
   }
   for(const change of (entry.changes||[]).slice(0,50)){
    const c=change.value,t=Number(c?.timestamp||entry.time);
    if(change.field!=='comments'||!c?.id||!c.from?.id||typeof c.text!=='string'||c.media?.media_product_type==='LIVE'||!Number.isFinite(t)||t<=0)continue;
    const d=await launchRpc('nova_channel_receive',{p_channel:'instagram',p_account:env.INSTAGRAM_ACCOUNT_ID,p_peer:String(c.from.id),p_thread:'comment:'+String(c.id),p_external_message:'ig-comment:'+String(c.id),p_text:c.text.slice(0,6000),p_received_at:new Date(t>1e12?t:t*1000).toISOString(),p_test:false});
    if(!d.ok)throw Error('Comment not persisted');if(!d.duplicate)await scheduleInboundSalesWorker(d.thread_id);received++;
   }
  }
  return res.status(200).json({received:true,recorded:received});
 }catch{return res.status(500).json({error:'Message storage could not be confirmed; retry later.'});}
}

// CM's public MO schema has no documented cryptographic signature. This boundary
// therefore requires an authenticated, operator-verified MSP relay; never infer
// authenticity from JSON fields or accept a credential in the URL.
async function handleAppleRelay(req,res,raw){
 if(req.method!=='POST')return res.status(405).end();
 const env=await runtimeProviderEnv(),secret=env.CM_INBOUND_SECRET;
 if(!secret||env.NOVA_CM_RELAY_VERIFIED!=='true'||!env.APPLE_BUSINESS_ACCOUNT_ID)return res.status(503).json({error:'An authenticated Apple messaging relay is not configured.'});
 const given=String(req.headers.authorization||''),expected='Bearer '+secret;
 if(!timingSafeEqual(createHash('sha256').update(given).digest(),createHash('sha256').update(expected).digest()))return res.status(403).json({error:'Invalid relay authorization.'});
 let event;try{event=JSON.parse(raw.toString('utf8'));}catch{return res.status(400).json({error:'Invalid JSON.'});}
 if(event.channel!=='Apple Messages for Business'||String(event.to?.number)!==env.APPLE_BUSINESS_ACCOUNT_ID)return res.status(400).json({error:'Wrong business channel.'});
 if(typeof event.message?.text!=='string'||!event.message.text.trim())return res.status(200).json({received:true,unsupported_media:true});
 if(!event.from?.number||typeof event.timeUtc!=='string')return res.status(400).json({error:'Missing message identity.'});
 const time=event.timeUtc.match(/(?:Z|[+-]\d\d:\d\d)$/)?event.timeUtc:event.timeUtc+'Z';
 if(!Number.isFinite(Date.parse(time)))return res.status(400).json({error:'Invalid message timestamp.'});
 const id='cm:'+createHash('sha256').update(JSON.stringify([event.to.number,event.from.number,time,event.message.text])).digest('hex');
 try{const result=await launchRpc('nova_channel_receive',{p_channel:'apple_messages',p_account:env.APPLE_BUSINESS_ACCOUNT_ID,p_peer:String(event.from.number),p_thread:String(event.from.number),p_external_message:id,p_text:event.message.text.slice(0,6000),p_received_at:new Date(time).toISOString(),p_test:false});if(!result.ok)throw Error('Storage failed');if(!result.duplicate)await scheduleInboundSalesWorker(result.thread_id);return res.status(200).json({received:true});}
 catch{return res.status(500).json({error:'Message storage could not be confirmed; retry later.'});}
}

async function tikTokGet(path,params,env){
 const url=new URL('https://business-api.tiktok.com/open_api/v1.3/'+path);
 Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,String(v)));
 const r=await fetch(url,{headers:{'Access-Token':env.TIKTOK_MESSAGING_ACCESS_TOKEN},signal:AbortSignal.timeout(15000),redirect:'error'});
 const d=await r.json();if(!r.ok||d.code!==0)throw Error('TikTok rejected inbox access.');return d.data;
}
async function syncTikTok(env){
 if(!channelConfiguration(env).find(c=>c.key==='tiktok').configured)throw Object.assign(Error('Authorize the TikTok Business Messaging account first.'),{code:'connection_required'});
 // Bounded read-only synchronization. No paid inference, outbound messages or advertising call.
 let recorded=0;const business=env.TIKTOK_BUSINESS_ID;
 for(const kind of ['STRANGER','SINGLE']){
  const data=await tikTokGet('business/message/conversation/list/',{business_id:business,conversation_type:kind,limit:10},env);
  for(const conversation of (data.conversations||[]).slice(0,10)){
   const messages=await tikTokGet('business/message/content/list/',{business_id:business,conversation_id:conversation.conversation_id},env);
   for(const msg of (messages.messages||[]).slice(0,100).sort((a,b)=>Number(a.timestamp)-Number(b.timestamp))){
    if(msg.message_type!=='TEXT'||!msg.from_user?.id||String(msg.from_user.id)===business||String(msg.to_user?.id)!==business||!msg.message_id||typeof msg.text?.body!=='string')continue;
    const received=await launchRpc('nova_channel_receive',{p_channel:'tiktok',p_account:business,p_peer:String(msg.from_user.id),p_thread:conversation.conversation_id,p_external_message:msg.message_id,p_text:msg.text.body.slice(0,6000),p_received_at:new Date(Number(msg.timestamp)).toISOString(),p_test:false});
    if(!received.ok)throw Error('Message storage not confirmed');if(!received.duplicate){recorded++;await scheduleInboundSalesWorker(received.thread_id);}
   }
  }
 }
 return {ok:true,recorded,limited_sync:true};
}
