// Infobip TikTok API: /tiktok/1/messages and MO_OTT_MSISDN inbound callbacks.
// Account access and region eligibility are provider prerequisites, not implied by a passing code test.
import {appleProviderBase} from './appleMessages.js';
const opaque=x=>typeof x==='string'&&/^[A-Za-z0-9._:@=+/-]{1,256}$/.test(x);
const unavailable=new Set(['US','GB','CH','AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE']);
export function tiktokMspEligible(region){return typeof region==='string'&&/^[A-Z]{2}$/.test(region)&&!unavailable.has(region);}
export function normalizeTikTokMessages(payload,accountId){
 if(!opaque(accountId)||!Array.isArray(payload?.results)||payload.results.length>100)throw Error('Invalid TikTok envelope');
 return payload.results.map(r=>{
  if(r.integrationType!=='TIKTOK'||r.to!==accountId)throw Error('Webhook account does not match the owned TikTok account');
  if(!opaque(r.sender)||!opaque(r.messageId)||!Number.isFinite(Date.parse(r.receivedAt)))throw Error('Invalid TikTok event identifiers');
  const text=r.message?.type==='TEXT'&&typeof r.message.text==='string'?r.message.text:null;
  if(text?.length>4000)throw Object.assign(Error('Message too long'),{status:413});
  return {provider:'tiktok',account_id:accountId,sender_id:r.sender,event_id:r.messageId,kind:text?'message':'unsupported',text:text||'[Unsupported TikTok content: needs a person]',at:r.receivedAt,metadata:{conversation_id:typeof r.message?.conversationId==='string'?r.message.conversationId.slice(0,256):null}};
 });
}
export function tiktokMessageRequest({baseUrl,accountId,recipientId,messageId,body,token,region}){
 if(!tiktokMspEligible(region))throw Error('This account region is not supported by the TikTok messaging provider');
 const base=appleProviderBase(baseUrl);
 if(!base||!opaque(accountId)||!opaque(recipientId)||!/^[0-9a-f-]{36}$/i.test(messageId||'')||typeof body!=='string'||!body.trim()||body.length>4000||!token)throw Error('Invalid TikTok message configuration');
 return {url:`${base}/tiktok/1/messages`,method:'POST',headers:{Authorization:`App ${token}`,'Content-Type':'application/json'},body:{messages:[{sender:accountId,destinations:[{to:recipientId,messageId}],content:{type:'TEXT',text:body},options:{validityPeriod:{amount:60,timeUnit:'MINUTES'}}}]}};
}
