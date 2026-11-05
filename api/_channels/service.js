import crypto from 'node:crypto';
import {dbOne,dbPatch,dbRpc,enc} from '../_sales/core.js';
import {verifyMetaSignature,normalizeMetaEvents} from './meta.js';
import {handleInboundTurn} from '../_ops/service.js';
import {channelPauseState} from './stops.js';
import {sendApprovedComment,sendChannelMessage} from './delivery.js';
import {withChannelTurn} from './turnContext.js';
export async function rawChannelBody(req){
 const parts=[];let bytes=0;
 for await(const chunk of req){const b=Buffer.from(chunk);bytes+=b.length;if(bytes>256000)throw Object.assign(Error('Payload too large'),{status:413});parts.push(b);}
 return Buffer.concat(parts);
}
export async function handleChannelWebhook(req,res){
 if(req.method==='GET'){
  const q=req.query||{},token=process.env.NOVA_META_VERIFY_TOKEN;
  const supplied=String(q['hub.verify_token']||'');
  if(token&&q['hub.mode']==='subscribe'&&supplied.length===token.length&&crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(token))&&/^\d{1,100}$/.test(String(q['hub.challenge']||'')))return res.status(200).send(String(q['hub.challenge']));
  return res.status(403).json({error:'Webhook verification refused'});
 }
 if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 try{
  const raw=await rawChannelBody(req);
  if(!verifyMetaSignature(raw,req.headers?.['x-hub-signature-256'],process.env.NOVA_META_APP_SECRET))return res.status(403).json({error:'Invalid webhook signature'});
  let payload;try{payload=JSON.parse(raw.toString('utf8'));}catch{return res.status(400).json({error:'Invalid JSON'});}
  const events=normalizeMetaEvents(payload);let accepted=0;
  for(const event of events){await dbRpc('nova_channel_ingest',{p_event:event});accepted++;}
  return res.status(200).json({received:true,events:accepted});
 }catch(e){return res.status(e.status===413?413:503).json({error:e.status===413?'Webhook batch too large':'Channel receipt could not be saved; delivery may be retried'});}
}
export async function runChannelTurn(job){
 const orgId=job.organization_id,conversationId=job.payload?.conversation_id;
 const token=crypto.randomUUID();
 const ev=await dbOne(`channel_events?organization_id=eq.${enc(orgId)}&conversation_id=eq.${enc(conversationId)}&message_id=eq.${enc(job.payload?.message_id)}&select=id,status`);
 if(!ev||ev.status!=='queued')return {skipped:'already_processed_or_unavailable'};
 const thread=await dbOne(`channel_threads?organization_id=eq.${enc(orgId)}&conversation_id=eq.${enc(conversationId)}&select=connection_id`);
 const connection=thread&&await dbOne(`channel_connections?id=eq.${enc(thread.connection_id)}&organization_id=eq.${enc(orgId)}&select=status,automation_enabled`);
 if(!connection||connection.status!=='enabled'||!connection.automation_enabled)return {paused:true,reason:'connection_automation_paused'};
 const [settings,conversation]=await Promise.all([dbOne(`wave1_org_settings?organization_id=eq.${enc(orgId)}&select=paused,channels_paused`),dbOne(`wave1_conversations?id=eq.${enc(conversationId)}&organization_id=eq.${enc(orgId)}&select=staff_takeover,channel`)]);
 if(settings?.paused||conversation?.staff_takeover||settings?.channels_paused?.includes(conversation?.channel)||process.env.OPS_KILL_SWITCH==='true')return {paused:true,reason:'business_or_conversation_paused'};
 const paused=await channelPauseState(orgId);if(paused.paused)return paused;
 if(!job.id||!job.leased_by)return {skipped:'live_job_lease_required'};
 const locked=await dbRpc('nova_channel_lock',{p_org:orgId,p_conversation:conversationId,p_token:token,p_release:false,p_message:job.payload?.message_id,p_job:job.id,p_worker:job.leased_by});
 if(!locked){const live=await dbOne(`channel_events?id=eq.${enc(ev.id)}&organization_id=eq.${enc(orgId)}&select=status`);return live?.status==='queued'?{deferred:true,reason:'waiting_for_earlier_turn_or_live_lease'}:{skipped:'late_event_requires_review'};}
 const lease={orgId,conversationId,token,valid:true};let renewing=false,finished=false;
 const renew=setInterval(async()=>{if(renewing||finished)return;renewing=true;try{if(!await dbRpc('nova_channel_renew',{p_org:orgId,p_conversation:conversationId,p_token:token}))lease.valid=false;}catch{lease.valid=false;}finally{renewing=false;}},20000);
 try{
  const result=await withChannelTurn(lease,async()=>{
   const mode=await dbRpc('nova_channel_begin_turn',{p_org:orgId,p_conversation:conversationId,p_message:job.payload.message_id,p_token:token});
   if(mode==='uncertain'||mode==='unavailable')return {needs_review:true,reason:'incomplete_turn_requires_review'};
   if(mode==='resume'){
    const saved=await dbOne(`channel_turn_results?organization_id=eq.${enc(orgId)}&conversation_id=eq.${enc(conversationId)}&message_id=eq.${enc(job.payload.message_id)}&select=*`);
    const send=saved.reply?await sendChannelMessage({orgId,conversationId,contactId:saved.contact_id,body:saved.reply,purpose:saved.purpose,idempotencyKey:`turn:${job.payload.message_id}`,isTest:saved.is_test}):null;
    return {...saved.result,reply_status:send?.status||'no_reply',reply_reason:send?.reason||null,...(send?.paused?{paused:true,reason:send.reason}:{})};
   }
   return handleInboundTurn({orgId,conversationId,messageId:job.payload?.message_id});
  });
  if(result.needs_review)return result;
  if(result.paused)return result;
  if(['organization_paused','staff_takeover'].includes(result.skipped)){
   await withChannelTurn(lease,()=>dbPatch('channel_events',`id=eq.${enc(ev.id)}&organization_id=eq.${enc(orgId)}&status=eq.queued&execution_token=eq.${enc(token)}`,{execution_started_at:null,execution_token:null}));
   return {...result,paused:true};
  }
  if(!lease.valid)throw Error('Conversation lease lost; reconcile before retry');
  finished=true;
  if(!await dbRpc('nova_channel_finish',{p_org:orgId,p_conversation:conversationId,p_message:job.payload?.message_id,p_token:token}))throw Error('Conversation lease was lost before completion');
  return result;
 }finally{finished=true;clearInterval(renew);await dbRpc('nova_channel_lock',{p_org:orgId,p_conversation:conversationId,p_token:token,p_release:true,p_message:null,p_job:null,p_worker:null});}
}
export const CHANNEL_HANDLERS={channel_conversation_turn:runChannelTurn,channel_comment_reply:sendApprovedComment};
