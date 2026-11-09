import {dbOne,dbPatch,dbRpc,enc} from '../_sales/core.js';
import {rawChannelBody} from './service.js';
import {normalizeAppleMessages,verifyAppleWebhook} from './appleMessages.js';
import {channelCredentialsAssigned} from './delivery.js';
export const handleAppleWebhook=(req,res)=>handleMspWebhook(req,res,{provider:'apple_messages',normalize:normalizeAppleMessages});
export async function handleMspWebhook(req,res,{provider,normalize}){
 if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 const id=req.query?.connection_id;
 if(!/^[0-9a-f-]{36}$/i.test(id||''))return res.status(400).json({error:'Connection required'});
 try{
  const c=await dbOne(`channel_connections?id=eq.${enc(id)}&provider=eq.${enc(provider)}&select=*`);
  const ref=c?.webhook_secret_ref,secret=/^NOVA_CHANNEL_WEBHOOK_[A-Z0-9_]{1,80}$/.test(ref||'')?process.env[ref]:null;
  if(!channelCredentialsAssigned(c)||!verifyAppleWebhook(req.headers?.authorization,secret))return res.status(403).json({error:'Webhook authentication failed'});
  const events=normalize(JSON.parse((await rawChannelBody(req)).toString('utf8')),c.provider_account_id);
  if(events.length){
   // A matching authenticated callback proves routing even before activation. Do not queue unverified work.
   const [updated]=await dbPatch('channel_connections',`id=eq.${enc(c.id)}&revision=eq.${c.revision}`,{last_webhook_at:new Date().toISOString()});
   if(!updated)return res.status(409).json({error:'Connection changed; retry this callback'});
  }
  let accepted=0;
  if(c.verified_at)for(const event of events){await dbRpc('nova_channel_ingest',{p_event:event});accepted++;}
  return res.status(200).json({ok:true,events:accepted,awaiting_verification:!c.verified_at});
 }catch(e){return res.status(e.status===413?413:e instanceof SyntaxError?400:503).json({error:'Messaging callback could not be stored'});}
}
