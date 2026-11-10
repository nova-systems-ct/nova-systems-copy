import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {launchRpc} from './_launchWorker.js';
import {normalizePhone} from './_wave1.js';
let cached=null;
const FIELDS={twilio:['account_sid','auth_token','phone_number','whatsapp_from'],instagram:['account_id','access_token','api_version','app_secret','verify_token'],tiktok:['business_id','access_token','region'],apple_messages:['business_id','product_token','relay_secret']};
const ENV_MAP={twilio:{account_sid:'TWILIO_ACCOUNT_SID',auth_token:'TWILIO_AUTH_TOKEN',phone_number:'TWILIO_PHONE_NUMBER',whatsapp_from:'TWILIO_WHATSAPP_FROM'},instagram:{account_id:'INSTAGRAM_ACCOUNT_ID',access_token:'INSTAGRAM_ACCESS_TOKEN',api_version:'INSTAGRAM_API_VERSION',app_secret:'INSTAGRAM_APP_SECRET',verify_token:'INSTAGRAM_VERIFY_TOKEN'},tiktok:{business_id:'TIKTOK_BUSINESS_ID',access_token:'TIKTOK_MESSAGING_ACCESS_TOKEN',region:'TIKTOK_ACCOUNT_REGION'},apple_messages:{business_id:'APPLE_BUSINESS_ACCOUNT_ID',product_token:'CM_PRODUCT_TOKEN',relay_secret:'CM_INBOUND_SECRET'}};
function key(secret){if(typeof secret!=='string'||secret.length<16)throw Error('Connection encryption is not configured.');return createHash('sha256').update('nova-provider-vault-v1\0'+secret).digest()}
export function encryptProviderCredentials(value,secret=process.env.CLIENT_SESSION_SECRET){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret),iv),bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),bytes.toString('base64url')].join('.')}
export function decryptProviderCredentials(text,secret=process.env.CLIENT_SESSION_SECRET){const [version,iv,tag,body]=String(text).split('.');if(version!=='v1'||!iv||!tag||!body)throw Error('Invalid encrypted connection.');const decipher=createDecipheriv('aes-256-gcm',key(secret),Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(body,'base64url')),decipher.final()]).toString('utf8'))}
export function validateProviderConfig(channel,input){
 if(!FIELDS[channel]||!input||typeof input!=='object')throw Error('Choose a supported business connection.');
 const d=Object.fromEntries(FIELDS[channel].map(k=>[k,typeof input[k]==='string'?input[k].trim():'']));if(Object.values(d).some(v=>v.length>10000))throw Error('A connection field is too long.');
 if(channel==='twilio'){if(!/^AC[0-9a-f]{32}$/i.test(d.account_sid)||d.auth_token.length<16||!normalizePhone(d.phone_number))throw Error('Enter the account SID, current auth token and E.164 business number.');d.phone_number=normalizePhone(d.phone_number);if(d.whatsapp_from){const number=normalizePhone(d.whatsapp_from.replace(/^whatsapp:/,''));if(!number)throw Error('Use the approved WhatsApp sender in E.164 format.');d.whatsapp_from='whatsapp:'+number}}
 if(channel==='instagram'&&(!/^\d+$/.test(d.account_id)||d.access_token.length<10||!/^v\d{1,2}\.0$/.test(d.api_version)||d.app_secret.length<10||d.verify_token.length<12))throw Error('Enter the professional account ID, token, explicit API version, app secret and webhook verify token.');
 if(channel==='tiktok'&&(!d.business_id||d.access_token.length<10||!/^([A-Z]{2})$/.test(d.region)))throw Error('Enter the authorized business ID, messaging token and two-letter registration region.');
 if(channel==='apple_messages'&&(!d.business_id||d.product_token.length<10||d.relay_secret.length<16))throw Error('Enter the approved Apple business ID, CM product token and authenticated relay secret.');
 return d;
}
export function publicProviderConfig(channel,d){if(channel==='twilio')return {account_id:d.account_sid,phone_number:d.phone_number,whatsapp_sender_configured:Boolean(d.whatsapp_from)};if(channel==='instagram')return {account_id:d.account_id,api_version:d.api_version,webhook_url:'https://nova-systems.app/webhooks/instagram'};if(channel==='tiktok')return {account_id:d.business_id,region:d.region,comment_to_dm_eligible_region:['VN','ID','TH'].includes(d.region)};return {account_id:d.business_id,relay_verified:false,webhook_url:'https://nova-systems.app/webhooks/apple-messages'}}
export function clearProviderCache(){cached=null}
export async function runtimeProviderEnv(base=process.env){
 if(!base.SUPABASE_URL||!base.SUPABASE_SERVICE_ROLE_KEY)return {...base};
 if(cached&&cached.base===base.SUPABASE_URL&&cached.until>Date.now())return {...base,...cached.values};
 let rows;try{rows=await launchRpc('nova_provider_runtime',{})}catch{return {...base}}
 const values={};for(const row of rows||[]){const mapping=ENV_MAP[row.channel];if(!mapping)continue;const data=decryptProviderCredentials(row.ciphertext,base.CLIENT_SESSION_SECRET);for(const [k,name]of Object.entries(mapping))if(data[k])values[name]=data[k]}
 cached={base:base.SUPABASE_URL,until:Date.now()+30000,values};return {...base,...values};
}
export async function handleProviderSetup(req,res,caller){
 const b=req.body||{};try{const access=await launchRpc('nova_provider_connection',{p_actor:caller.id,p_action:'overview'});if(!access.ok)return res.status(403).json({error:'Only the Nova owner can manage provider credentials.'});
  if(req.method==='GET')return res.status(200).json({...access,encrypted_storage_ready:Boolean(process.env.CLIENT_SESSION_SECRET?.length>=16)});
  if(req.method!=='POST'||b.action!=='save_provider')return res.status(405).json({error:'Method not allowed.'});
  let config;try{config=validateProviderConfig(b.channel,b.config)}catch(e){return res.status(422).json({error:e.message})}
  if(!process.env.CLIENT_SESSION_SECRET||process.env.CLIENT_SESSION_SECRET.length<16)return res.status(503).json({error:'Encrypted connection storage is not configured. Contact the owner.'});
  const result=await launchRpc('nova_provider_connection',{p_actor:caller.id,p_action:'save',p_channel:b.channel,p_config:publicProviderConfig(b.channel,config),p_ciphertext:encryptProviderCredentials(config)});clearProviderCache();
  return res.status(result.ok?200:409).json({...result,credentials_returned:false,dispatch_enabled:false});
 }catch{return res.status(502).json({error:'The encrypted connection could not be confirmed. No sending was activated.'})}
}
