import {tiktokMessageRequest} from './tiktokMessages.js';
import {dbOne,dbGet,dbInsert,dbPatch,dbRpc,enc,nowIso} from '../_sales/core.js';
import {channelSendDecision} from './policy.js';
import {graphMessageRequest} from './meta.js';
import {currentChannelTurn} from './turnContext.js';
import {channelPauseState} from './stops.js';
import {CHANNEL_PROVIDERS} from './providers.js';
import {appleMessageRequest} from './appleMessages.js';
import {rcsAccessToken,rcsMessageRequest} from './rcs.js';
export {CHANNEL_PROVIDERS};
export const channelCredentialsAssigned=c=>!!c?.credentials_assigned_by&&!!c?.credentials_assigned_at;
export function channelToken(connection,env=process.env){return channelCredentialsAssigned(connection)&&/^NOVA_CHANNEL_TOKEN_[A-Z0-9_]{1,80}$/.test(connection?.token_ref||'')?env[connection.token_ref]:null;}
let fetchOverride=null;
export const setChannelFetchForTests=fn=>{fetchOverride=fn;};
export async function submitProviderMessage(connection,{recipientId,commentId,body,messageId},env=process.env){
 let request;
 try{request=connection.provider==='tiktok'?tiktokMessageRequest({baseUrl:connection.transport_config?.api_base,accountId:connection.provider_account_id,recipientId,body,messageId,token:channelToken(connection,env),region:connection.transport_config?.account_region}):connection.provider==='apple_messages'?appleMessageRequest({baseUrl:connection.transport_config?.api_base,accountId:connection.provider_account_id,recipientId,body,messageId,token:channelToken(connection,env)}):connection.provider==='android_rcs'?rcsMessageRequest({agentId:connection.provider_account_id,recipientId,body,messageId,accessToken:await rcsAccessToken(channelToken(connection,env),{fetchImpl:fetchOverride||fetch})}):graphMessageRequest({provider:connection.provider,accountId:connection.provider_account_id,recipientId,commentId,body,token:channelToken(connection,env),version:env.NOVA_META_GRAPH_VERSION,loginMode:connection.login_mode});}
 catch{return {status:'failed',code:'invalid_message_or_provider_configuration'};}
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),10000);
 try{
  const r=await(fetchOverride||fetch)(request.url,{method:request.method,headers:request.headers,body:JSON.stringify(request.body),redirect:'error',signal:ctrl.signal});
  const j=await r.json().catch(()=>({}));
  const receipt=['apple_messages','tiktok'].includes(connection.provider)?(j.messages?.[0]?.messageId===messageId&&['PENDING','DELIVERED'].includes(j.messages[0].status?.groupName)?messageId:null):connection.provider==='android_rcs'?(typeof j.name==='string'&&j.name.endsWith(`/agentMessages/${messageId}`)?j.name:null):j.message_id||j.messages?.[0]?.id;
  if(r.ok&&typeof receipt==='string'&&receipt.length<=256)return {status:'provider_accepted',id:receipt};
  return {status:r.status>=500||r.ok?'ambiguous':'failed',code:`provider_http_${r.status}`};
 }catch{return {status:'ambiguous',code:'provider_outcome_unknown'};}
 finally{clearTimeout(timer);}
}
export async function sendChannelMessage({orgId,conversationId,contactId,body,purpose,idempotencyKey,sentBy=null,isTest=false,now=new Date()}){
 if(!idempotencyKey)return {status:'blocked',reason:'idempotency_key_required'};
 const conv=await dbOne(`wave1_conversations?id=eq.${enc(conversationId)}&organization_id=eq.${enc(orgId)}&select=*`);
 if(!conv||conv.contact_id!==contactId)return {status:'blocked',reason:'conversation_contact_mismatch'};
 const thread=await dbOne(`channel_threads?conversation_id=eq.${enc(conversationId)}&organization_id=eq.${enc(orgId)}&select=*`);
 if(!thread)return {status:'blocked',reason:'channel_thread_not_found'};
 const [connection,identity,contact,settings]=await Promise.all([
  dbOne(`channel_connections?id=eq.${enc(thread.connection_id)}&organization_id=eq.${enc(orgId)}&select=*`),
  dbOne(`channel_identities?id=eq.${enc(thread.identity_id)}&connection_id=eq.${enc(thread.connection_id)}&organization_id=eq.${enc(orgId)}&select=*`),
  dbOne(`crm_contacts?id=eq.${enc(contactId)}&organization_id=eq.${enc(orgId)}&select=suppressed,do_not_contact`),
  dbOne(`wave1_org_settings?organization_id=eq.${enc(orgId)}&select=paused,channels_paused`),
 ]);
 if(!connection||!identity||!contact||identity.contact_id!==contactId)return {status:'blocked',reason:'channel_identity_mismatch'};
 let decision=channelSendDecision({connection,identity,conversation:conv,org:settings,purpose,now});
 if(contact?.suppressed||contact?.do_not_contact)decision={allowed:false,reason:'contact_suppressed'};
 if(process.env.OPS_KILL_SWITCH==='true'||settings?.channels_paused?.includes(conv.channel))decision={allowed:false,reason:'channel_paused'};
 const pause=await channelPauseState(orgId,{staff:purpose==='staff_reply',provider:connection.provider});if(pause.paused)decision={allowed:false,reason:pause.reason};
 if(pause.paused||settings?.paused||settings?.channels_paused?.includes(conv.channel)||process.env.OPS_KILL_SWITCH==='true'||connection.status==='paused'||(purpose!=='staff_reply'&&(!connection.automation_enabled||conv.staff_takeover)))return {status:'deferred',paused:true,reason:'business_or_conversation_paused'};
 const execution=currentChannelTurn();
 if(execution&&(!execution.valid||execution.orgId!==orgId||execution.conversationId!==conversationId||thread.lock_token!==execution.token||Date.parse(thread.lock_expires_at)<=Date.now()))decision={allowed:false,reason:'conversation_lease_lost'};
 if(decision.allowed&&!channelToken(connection))decision={allowed:false,reason:'server_token_not_configured'};
 const previous=await dbOne(`wave1_messages?organization_id=eq.${enc(orgId)}&idempotency_key=eq.${enc(idempotencyKey)}&select=*`);
 if(previous)return previous.conversation_id!==conversationId||previous.body!==body?{status:'blocked',reason:'idempotency_conflict'}:{status:'duplicate',reason:'already_attempted',message:previous};
 const base={organization_id:orgId,conversation_id:conversationId,direction:'outbound',body,purpose,automated:!sentBy,sent_by:sentBy,is_test:isTest,provider:`channel:${connection.id}`,idempotency_key:idempotencyKey};
 const claimed=await dbInsert('wave1_messages',{...base,status:decision.allowed?'queued':'blocked',blocked_reason:decision.allowed?null:decision.reason},{onConflict:'organization_id,idempotency_key'});
 if(!claimed.row)return {status:'duplicate',reason:'already_attempted'};
 if(!decision.allowed)return {status:'blocked',reason:decision.reason,message:claimed.row};
 const outcome=await submitProviderMessage(connection,{recipientId:identity.external_user_id,body,messageId:claimed.row.id});
 const [message]=await dbPatch('wave1_messages',`id=eq.${enc(claimed.row.id)}&organization_id=eq.${enc(orgId)}`,{status:outcome.status,provider_sid:outcome.id||null,error_code:outcome.code||null,submitted_at:nowIso()});
 if(outcome.status==='provider_accepted')await dbPatch('wave1_conversations',`id=eq.${enc(conversationId)}&organization_id=eq.${enc(orgId)}`,{last_outbound_at:nowIso()});
 return {status:outcome.status,reason:outcome.code||null,message};
}
export async function sendApprovedComment(job){
 const event=await dbOne(`channel_events?id=eq.${enc(job.payload?.event_id)}&organization_id=eq.${enc(job.organization_id)}&kind=eq.comment&select=*`);
 if(!event||event.status!=='approved'||!event.approved_by||!event.approved_reply)return {skipped:'comment_not_approved'};
 const connection=await dbOne(`channel_connections?id=eq.${enc(event.connection_id)}&organization_id=eq.${enc(job.organization_id)}&select=*`);
 const settings=await dbOne(`wave1_org_settings?organization_id=eq.${enc(job.organization_id)}&select=paused,channels_paused`);
 if(process.env.NOVA_SPENDING_LOCK!=='disabled'||process.env.NOVA_CHANNEL_SEND_ENABLED!=='true')return {blocked:'sending_locked'};
 if(process.env.OPS_KILL_SWITCH==='true'||settings?.paused||settings?.channels_paused?.includes('instagram')||(await channelPauseState(job.organization_id,{provider:'instagram'})).paused)return {paused:true,reason:'business_paused'};
 if(connection&&!connection.automation_enabled)return {paused:true,reason:'connection_automation_paused'};
 if(event.approved_rule_id){const rule=await dbOne(`channel_comment_rules?id=eq.${enc(event.approved_rule_id)}&connection_id=eq.${enc(event.connection_id)}&organization_id=eq.${enc(job.organization_id)}&select=enabled,reply`);if(!rule?.enabled||rule.reply!==event.approved_reply)return {paused:true,reason:'approved_rule_paused'};}
 if(!connection?.verified_at||connection.status!=='enabled'||!connection.outbound_enabled||connection.provider!=='instagram')return {blocked:'connection_not_enabled'};
 const age=Date.now()-Date.parse(event.occurred_at);
 if(age<0||age>=7*86400000)return {blocked:'private_reply_window_closed'};
 const identities=await dbGet(`channel_identities?connection_id=eq.${enc(connection.id)}&organization_id=eq.${enc(job.organization_id)}&external_user_id=eq.${enc(event.sender_id)}&select=suppressed,contact_id`);
 if(identities.some(x=>x.suppressed))return {blocked:'suppressed_opt_out'};
 if(identities.length){const cs=await dbGet(`crm_contacts?organization_id=eq.${enc(job.organization_id)}&id=in.(${identities.map(x=>enc(x.contact_id)).join(',')})&select=suppressed,do_not_contact`);if(cs.some(x=>x.suppressed||x.do_not_contact))return {blocked:'contact_suppressed'};}
 if(!channelToken(connection))return {blocked:'server_token_not_configured'};
 const claim=await dbRpc('nova_channel_claim_comment',{p_org:job.organization_id,p_event:event.id,p_job:job.id||null,p_worker:job.leased_by||null});
 if(claim==='paused')return {paused:true,reason:'connection_or_rule_paused'};
 if(claim!=='claimed')return {blocked:claim};
 const result=await submitProviderMessage(connection,{commentId:event.provider_event_id,body:event.approved_reply});
 await dbPatch('channel_events',`id=eq.${enc(event.id)}&organization_id=eq.${enc(job.organization_id)}&status=eq.submitting`,{status:result.status,provider_message_id:result.id||null,error_code:result.code||null});
 return {status:result.status};
}
