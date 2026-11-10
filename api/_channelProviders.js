import { billableDispatchEnabled } from './_spendingPolicy.js';

// Official sending contracts are linked in docs/CHANNEL_WORKSPACE.md.
const validVersion = v => /^v\d{1,2}\.0$/.test(v || '');
const present = (...keys) => keys.every(Boolean);
export function channelConfiguration(env = process.env) {
  const social = env.NOVA_FREE_SOCIAL_SEND_ENABLED === 'true';
  const paid = billableDispatchEnabled(env);
  return [
    { key:'instagram', name:'Instagram', configured:present(env.INSTAGRAM_ACCESS_TOKEN,env.INSTAGRAM_ACCOUNT_ID,validVersion(env.INSTAGRAM_API_VERSION)), send_enabled:social, requirement:'Connect the professional account with messaging permission.', setup_url:'https://developers.facebook.com/apps/' },
    { key:'tiktok', name:'TikTok', configured:present(env.TIKTOK_MESSAGING_ACCESS_TOKEN,env.TIKTOK_BUSINESS_ID), send_enabled:social, requirement:'Authorize a Business Messaging app approved by TikTok.', setup_url:'https://business-api.tiktok.com/portal/' },
    { key:'apple_messages', name:'Apple Messages', configured:present(env.CM_PRODUCT_TOKEN,env.APPLE_BUSINESS_ACCOUNT_ID), send_enabled:paid, requirement:'Connect an Apple-approved messaging provider and approved business account.', setup_url:'https://register.apple.com/' },
    { key:'sms', name:'SMS & calls', configured:present(env.TWILIO_ACCOUNT_SID,env.TWILIO_AUTH_TOKEN), send_enabled:paid, requirement:'Repair the existing Twilio connection and verify carrier approval.', setup_url:'https://console.twilio.com/' },
    { key:'whatsapp', name:'WhatsApp', configured:present(env.TWILIO_ACCOUNT_SID,env.TWILIO_AUTH_TOKEN,env.TWILIO_WHATSAPP_FROM), send_enabled:paid, requirement:'Connect an approved WhatsApp business sender.', setup_url:'https://console.twilio.com/' },
    { key:'email', name:'Email', configured:present(env.RESEND_API_KEY), send_enabled:paid, requirement:'Verify sending allowance before enabling delivery.', setup_url:'https://resend.com/domains' },
  ].map(c=>({...c,status:!c.configured?'connection_required':!c.send_enabled?'dispatch_paused':'configured_unverified',delivery_verified:false}));
}

export function createChannelRequest(channel, thread, text, env = process.env) {
  const config = channelConfiguration(env).find(c=>c.key===channel);
  if (!config?.configured) throw Object.assign(Error('This business channel is not connected.'),{code:'connection_required'});
  if (!config.send_enabled) throw Object.assign(Error('Message delivery is paused under the current spending settings.'),{code:'dispatch_paused'});
  if (typeof text!=='string'||!text.trim()||text.length>2000) throw Error('Review a message of 1 to 2,000 characters.');
  const peer=String(thread.external_peer_id||'');
  if (!peer||peer.length>300) throw Error('A verified conversation is required.');
  if(channel==='instagram') {
    if(thread.account_id!==env.INSTAGRAM_ACCOUNT_ID)throw Error('The account does not match this conversation.');
    return {url:`https://graph.instagram.com/${env.INSTAGRAM_API_VERSION}/${encodeURIComponent(thread.account_id)}/messages`,headers:{Authorization:`Bearer ${env.INSTAGRAM_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:{recipient:{id:peer},message:{text}}};
  }
  if(channel==='tiktok') {
    if(thread.account_id!==env.TIKTOK_BUSINESS_ID)throw Error('The account does not match this conversation.');
    return {url:'https://business-api.tiktok.com/open_api/v1.3/business/message/send/',headers:{'Access-Token':env.TIKTOK_MESSAGING_ACCESS_TOKEN,'Content-Type':'application/json'},body:{business_id:thread.account_id,recipient_type:'CONVERSATION',recipient:thread.external_thread_id,message_type:'TEXT',text:{body:text}}};
  }
  if(channel==='apple_messages') {
    if(thread.account_id!==env.APPLE_BUSINESS_ACCOUNT_ID)throw Error('The account does not match this conversation.');
    if(!/^[0-9a-f-]{36}$/i.test(thread.reply_id||''))throw Error('A reply reference is required.');
    return {url:'https://gw.messaging.cm.com/v1.0/message',headers:{'X-CM-PRODUCTTOKEN':env.CM_PRODUCT_TOKEN,'Content-Type':'application/json'},body:{messages:{msg:[{from:thread.account_id,to:[{number:thread.external_thread_id}],allowedChannels:['Apple Messages for Business'],body:{type:'auto',content:text},reference:thread.reply_id}]}}};
  }
  throw Object.assign(Error('Use the existing provider installation flow for this channel.'),{code:'connection_required'});
}

export async function sendChannelReply(channel,thread,text,{env=process.env,fetchImpl=fetch}={}) {
  // Build/validate before any network request. Test conversations never enter this function.
  const req=createChannelRequest(channel,thread,text,env);
  let response,data;
  try {response=await fetchImpl(req.url,{method:'POST',headers:req.headers,body:JSON.stringify(req.body),signal:AbortSignal.timeout(15000),redirect:'error'});data=await response.json();}
  catch{return {state:'unknown',error_code:'provider_result_unknown'};}
  if(!response.ok)return {state:response.status>=500?'unknown':'failed',error_code:'provider_http_'+response.status};
  let id;
  if(channel==='instagram')id=data.message_id;
  if(channel==='tiktok'){if(data.code!==0)return {state:'failed',error_code:'provider_rejected'};id=data.data?.message?.message_id;}
  if(channel==='apple_messages'){const message=data.messages?.[0];if(data.errorCode||message?.messageErrorCode)return {state:'failed',error_code:'provider_rejected'};if(data.errorCode===0&&message?.messageErrorCode===0&&message.status==='Accepted'&&message.reference===thread.reply_id)id='cm-reference:'+thread.reply_id;}
  return typeof id==='string'&&id?{state:'accepted',provider_id:id}:{state:'unknown',error_code:'provider_receipt_missing'};
}
