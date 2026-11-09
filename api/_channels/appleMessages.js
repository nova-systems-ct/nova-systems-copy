// Infobip's documented Messages API (APPLE_MB), not an undocumented direct iMessage API.
// Contracts: github.com/infobip/infobip-api-go-client (messagesapi), pinned in the release receipt.
import crypto from 'node:crypto';
const identifier=x=>typeof x==='string'&&/^[A-Za-z0-9._:@=-]{1,256}$/.test(x);
export function appleProviderBase(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&u.pathname==='/'&&!u.search&&!u.hash&&/^(?:[a-z0-9][a-z0-9-]{0,62}\.)?api\.infobip\.com$/.test(u.hostname)?u.origin:null;}catch{return null;}
}
export function verifyAppleWebhook(header,secret){
 if(typeof secret!=='string'||secret.length<32||typeof header!=='string')return false;
 const expected=Buffer.from('Basic '+Buffer.from(`nova:${secret}`).toString('base64')),actual=Buffer.from(header);
 return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);
}
export function normalizeAppleMessages(payload,accountId){
 if(!identifier(accountId)||!Array.isArray(payload?.results)||payload.results.length>100)throw Error('Invalid Apple messaging envelope');
 const events=[];
 for(const r of payload.results){
  if(r.event!=='MO')continue; // Seen, typing and delivery are not new customer requests.
  if(r.channel!=='APPLE_MB'||r.destination!==accountId)throw Error('Webhook account does not match the owned Apple business');
  if(!identifier(r.sender)||!identifier(r.messageId)||!Number.isFinite(Date.parse(r.receivedAt)))throw Error('Invalid Apple customer identifiers');
  const onlyText=Array.isArray(r.content)&&r.content.length===1&&r.content[0]?.type==='TEXT'&&typeof r.content[0].text==='string';
  const text=onlyText?r.content[0].text:null;
  if(text?.length>4000)throw Object.assign(Error('Message too long'),{status:413});
  events.push({provider:'apple_messages',account_id:accountId,sender_id:r.sender,event_id:r.messageId,kind:text?'message':'unsupported',text:text||'[Unsupported Apple content: needs a person]',at:r.receivedAt});
 }
 return events;
}
export function appleMessageRequest({baseUrl,accountId,recipientId,messageId,body,token}){
 const base=appleProviderBase(baseUrl);
 if(!base||!identifier(accountId)||!identifier(recipientId)||!/^[0-9a-f-]{36}$/i.test(messageId||'')||typeof body!=='string'||!body.trim()||Buffer.byteLength(body)>4000||!token)throw Error('Invalid Apple messaging-provider configuration');
 return {url:`${base}/messages-api/1/messages`,method:'POST',headers:{Authorization:`App ${token}`,'Content-Type':'application/json'},body:{messages:[{channel:'APPLE_MB',sender:accountId,destinations:[{to:recipientId,messageId}],content:{body:{type:'TEXT',text:body}}}]}};
}
