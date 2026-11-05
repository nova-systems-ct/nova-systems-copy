import {requireStaff} from '../_auth.js';
import {requireOrgAccess} from '../_orgAccess.js';
import {graphOrigin} from './meta.js';
import {dbOne,dbGet,dbInsert,dbPatch,dbRpc,enc,audit} from '../_sales/core.js';
import {CHANNEL_CATALOG,applicationPacket} from './catalog.js';
import {channelToken,CHANNEL_PROVIDERS,sendChannelMessage} from './delivery.js';
const fail=(res,status,error)=>res.status(status).json({error});
const publicConnection=c=>({id:c.id,provider:c.provider,provider_account_id:c.provider_account_id,label:c.label,status:c.status,login_mode:c.login_mode,verified_at:c.verified_at,last_webhook_at:c.last_webhook_at,automation_enabled:c.automation_enabled,outbound_enabled:c.outbound_enabled,token_ref:c.token_ref,token_configured:!!channelToken(c),authorization_reference:c.authorization_reference});
export async function handleChannelAdmin(req,res){
 const caller=await requireStaff(req,res,'admin.view');if(!caller)return;
 const b=req.body||{},q=req.query||{},org=req.method==='GET'?q.organization_id:b.organization_id;
 if(typeof org!=='string'||!/^[0-9a-f-]{36}$/i.test(org))return fail(res,422,'Choose a business');
 if(!(await requireOrgAccess(req,res,org,'admin.view')))return;
 try{
  if(req.method==='GET'){
   const [connections,events,rules]=await Promise.all([dbGet(`channel_connections?organization_id=eq.${enc(org)}&select=*&order=created_at.desc`),dbGet(`channel_events?organization_id=eq.${enc(org)}&select=id,connection_id,kind,body,status,occurred_at,conversation_id,approved_reply,error_code&order=created_at.desc&limit=100`),dbGet(`channel_comment_rules?organization_id=eq.${enc(org)}&select=id,connection_id,keyword,reply,enabled,approved_at&order=approved_at.desc`)]);
   return res.status(200).json({catalog:CHANNEL_CATALOG,connections:connections.map(publicConnection),events,rules,spending_locked:process.env.NOVA_SPENDING_LOCK!=='disabled',sending_enabled:process.env.NOVA_CHANNEL_SEND_ENABLED==='true',callback_url:'/api/integrations?op=channel-webhook&provider=meta',applications:CHANNEL_CATALOG.map(x=>applicationPacket(x.key))});
  }
  if(req.method!=='POST')return fail(res,405,'POST or GET only');
  if(b.action==='prepare'){
   if(!CHANNEL_PROVIDERS.includes(b.provider)||!/^\d{1,50}$/.test(b.provider_account_id||'')||!/^NOVA_CHANNEL_TOKEN_[A-Z0-9_]{1,80}$/.test(b.token_ref||'')||typeof b.label!=='string'||!b.label.trim())return fail(res,422,'Choose a supported messaging provider, numeric account ID, label and a NOVA_CHANNEL_TOKEN_ server secret reference. Never paste a token here.');
   const ins=await dbInsert('channel_connections',{organization_id:org,provider:b.provider,provider_account_id:b.provider_account_id,label:b.label.trim().slice(0,120),token_ref:b.token_ref,login_mode:b.provider==='instagram'&&b.login_mode==='instagram'?'instagram':'facebook',created_by:caller.id});
   if(!ins.row)return fail(res,409,'This provider account is already assigned. Review its existing business connection.');
   await audit(caller,'channel_connection',ins.row.id,'prepared',{provider:b.provider,organization_id:org});
   return res.status(200).json({connection:publicConnection(ins.row),note:'Prepared only. No account registered, provider permissions verified or message sent.'});
  }
  if(b.action==='reply'){
   if(!/^[0-9a-f-]{36}$/i.test(b.request_id||''))return fail(res,422,'A unique reply request ID is required');
   const conv=await dbOne(`wave1_conversations?id=eq.${enc(b.conversation_id||'')}&organization_id=eq.${enc(org)}&select=id,contact_id,channel`);
   if(!conv||!CHANNEL_PROVIDERS.includes(conv.channel))return fail(res,404,'Connected conversation not found in this business');
   if(typeof b.text!=='string'||!b.text.trim()||Buffer.byteLength(b.text)>1000)return fail(res,422,'Enter a reply up to 1000 UTF-8 bytes');
   const result=await sendChannelMessage({orgId:org,conversationId:conv.id,contactId:conv.contact_id,body:b.text.trim(),purpose:'staff_reply',idempotencyKey:`staff-channel:${caller.id}:${b.request_id}`,sentBy:caller.id});
   return res.status(200).json(result);
  }
  const c=await dbOne(`channel_connections?id=eq.${enc(b.connection_id||'')}&organization_id=eq.${enc(org)}&select=*`);
  if(!c)return fail(res,404,'Connection not found in this business');
  if(b.action==='edit-draft'){
   if(c.status==='enabled')return fail(res,409,'Pause this connection before changing its authorization details');
   if(!/^NOVA_CHANNEL_TOKEN_[A-Z0-9_]{1,80}$/.test(b.token_ref||'')||typeof b.label!=='string'||!b.label.trim()||!['facebook','instagram'].includes(b.login_mode)||(c.provider!=='instagram'&&b.login_mode!=='facebook'))return fail(res,422,'Use a valid label, server secret reference and authorization method');
   const [row]=await dbPatch('channel_connections',`id=eq.${enc(c.id)}&organization_id=eq.${enc(org)}&status=neq.enabled&revision=eq.${c.revision}`,{label:b.label.trim().slice(0,120),token_ref:b.token_ref,login_mode:b.login_mode,status:'draft',verified_at:null,authorization_reference:null,automation_enabled:false,outbound_enabled:false,revision:c.revision+1,updated_at:new Date().toISOString()});
   if(!row)return fail(res,409,'Connection changed meanwhile; reload before editing');
   await audit(caller,'channel_connection',c.id,'draft_corrected',{organization_id:org});
   return res.status(200).json({connection:publicConnection(row),note:'Draft corrected. Account verification was cleared; automation and sending remain off.'});
  }
  if(b.action==='approve-keyword-rule'){
   const keyword=String(b.keyword||'').trim().toUpperCase();
   if(c.provider!=='instagram'||!/^[A-Z0-9_]{2,32}$/.test(keyword)||typeof b.text!=='string'||!b.text.trim()||Buffer.byteLength(b.text)>1000)return fail(res,422,'Instagram rules need one keyword (2–32 letters or digits) and the exact approved reply up to 1000 UTF-8 bytes');
   const saved=await dbInsert('channel_comment_rules',{organization_id:org,connection_id:c.id,keyword,reply:b.text.trim(),approved_by:caller.id});
   if(!saved.row)return fail(res,409,'An enabled rule already uses that keyword. Pause it before approving another version.');
   await audit(caller,'channel_comment_rule',saved.row.id,'exact_reply_approved',{organization_id:org,keyword});
   return res.status(200).json({rule:{id:saved.row.id},note:'Rule approved for future matching comments. Provider permissions and sending gates still apply.'});
  }
  if(b.action==='configure-keyword-rule'){
   if(typeof b.enabled!=='boolean')return fail(res,422,'Choose whether this rule is enabled');
   const [rule]=await dbPatch('channel_comment_rules',`id=eq.${enc(b.rule_id||'')}&connection_id=eq.${enc(c.id)}&organization_id=eq.${enc(org)}`,{enabled:b.enabled});
   if(!rule)return fail(res,404,'Rule not found in this connection');
   await audit(caller,'channel_comment_rule',rule.id,b.enabled?'resumed':'paused',{organization_id:org});
   return res.status(200).json({ok:true,note:b.enabled?'Rule resumed for future comments.':'Rule paused, including its queued comments.'});
  }
  if(b.action==='verify-account'){
   const token=channelToken(c),version=process.env.NOVA_META_GRAPH_VERSION;
   if(!token||!/^v\d{1,2}\.\d+$/.test(version||''))return fail(res,409,'Store the scoped token in the named server secret and configure the verified Graph API version first');
   const r=await fetch(`${graphOrigin(c.provider,c.login_mode)}/${version}/${c.provider_account_id}?fields=id`,{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(8000)});
   const data=await r.json().catch(()=>({}));
   if(!r.ok||String(data.id)!==c.provider_account_id)return fail(res,409,'Provider could not verify this exact account; check ownership and token permissions');
   const [verified]=await dbPatch('channel_connections',`id=eq.${enc(c.id)}&organization_id=eq.${enc(org)}&revision=eq.${c.revision}`,{verified_at:new Date().toISOString(),revision:c.revision+1,updated_at:new Date().toISOString()});
   if(!verified)return fail(res,409,'Connection details changed during verification. Verify the corrected configuration.');
   await audit(caller,'channel_connection',c.id,'account_identity_verified',{organization_id:org});
   return res.status(200).json({ok:true,note:'Account identity verified. Messaging permissions and real customer acceptance are separate requirements.'});
  }
  if(b.action==='configure'){
   if(!['enabled','paused'].includes(b.status))return fail(res,422,'Choose enabled or paused');
   if(b.status==='enabled'&&(!c.verified_at||typeof b.authorization_reference!=='string'||b.authorization_reference.trim().length<8))return fail(res,409,'Verify the account and record the actual owned-account test authorization or provider permission evidence first');
   if(b.outbound_enabled===true&&(process.env.NOVA_SPENDING_LOCK!=='disabled'||process.env.NOVA_CHANNEL_SEND_ENABLED!=='true'))return fail(res,423,'Sending stays locked under the owner’s no-spending instruction');
   const [row]=await dbPatch('channel_connections',`id=eq.${enc(c.id)}&organization_id=eq.${enc(org)}&revision=eq.${c.revision}`,{status:b.status,automation_enabled:b.automation_enabled===true,outbound_enabled:b.outbound_enabled===true,authorization_reference:String(b.authorization_reference||c.authorization_reference||'').slice(0,1000),revision:c.revision+1,updated_at:new Date().toISOString()});
   if(!row)return fail(res,409,'Connection changed meanwhile. Reload before changing its controls.');
   await audit(caller,'channel_connection',c.id,'configured',{organization_id:org,status:b.status,automation_enabled:row.automation_enabled,outbound_enabled:row.outbound_enabled});
   return res.status(200).json({connection:publicConnection(row)});
  }
  if(b.action==='approve-comment'){
   const event=await dbOne(`channel_events?id=eq.${enc(b.event_id||'')}&connection_id=eq.${enc(c.id)}&organization_id=eq.${enc(org)}&kind=eq.comment&select=*`);
   if(!event)return fail(res,409,'This comment is not awaiting review in this connection');
   if(typeof b.text!=='string'||!b.text.trim()||Buffer.byteLength(b.text)>1000)return fail(res,422,'Enter the exact approved reply up to 1000 UTF-8 bytes');
   if(Date.now()-Date.parse(event.occurred_at)>=7*86400000)return fail(res,409,'The private reply window has closed');
   const approved=await dbRpc('nova_approve_channel_comment',{p_org:org,p_event:event.id,p_actor:caller.id,p_text:b.text.trim()});
   if(!approved.ok)return fail(res,409,approved.reason);
   await audit(caller,'channel_event',event.id,'private_reply_approved',{organization_id:org});
   return res.status(200).json({ok:true,note:'Approved and queued. Sending gates still apply; this is not a delivery receipt.'});
  }
  return fail(res,404,'Unknown channel action');
 }catch{return fail(res,503,'Channel operation could not be completed. Reload the saved state before retrying.');}
}
