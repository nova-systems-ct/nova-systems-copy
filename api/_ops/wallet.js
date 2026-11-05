// Signed, read-only rewards snapshots. Issuance does not post points, redeem a
// reward, register a device, send a message, or claim automatic Wallet updates.
import crypto from 'node:crypto';
import {dbOne,dbInsert,enc} from '../_sales/core.js';
import {NOVA_LOGO_PNG_BASE64} from '../_novaLogo.js';
const error=(status,message)=>Object.assign(new Error(message),{status,expose:true});
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const appleKeys=['APPLE_PASS_TYPE_ID','APPLE_TEAM_ID','APPLE_PASS_SIGNER_CERT_PEM','APPLE_CSR_PRIVATE_KEY_PEM','APPLE_WWDR_CERT_PEM'];
const googleKeys=['GOOGLE_WALLET_ISSUER_ID','GOOGLE_WALLET_CLASS_ID','GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL','GOOGLE_WALLET_PRIVATE_KEY_PEM'];
export function walletPlatforms(env=process.env,orgId,{now=new Date()}={}){
 const scope=!!orgId&&env.NOVA_WALLET_ORGANIZATION_ID===orgId;
 const state=(kind,keys)=>{const missing=[...keys,'NOVA_WALLET_ORGANIZATION_ID','NOVA_WALLET_ISSUER_NAME'].filter(k=>!env[k]);const enabled=env[`${kind.toUpperCase()}_WALLET_ENABLED`]==='true';return {can_issue:scope&&enabled&&!missing.length,missing,reason:missing.length?'Missing server configuration':!scope?'Issuer is not configured for this business':!enabled?'Issuance is disabled':'Configured for signed snapshots; provider/device acceptance still required',automatic_updates:false};};
 const apple=state('apple',appleKeys);
 if(apple.can_issue){
  try{appleCertificates(env,now);apple.certificate_verified=true;apple.certificate_expires_at=new crypto.X509Certificate(env.APPLE_PASS_SIGNER_CERT_PEM).validTo;}
  catch{apple.can_issue=false;apple.certificate_verified=false;apple.reason='Apple signing certificate, private key, issuer, identifiers or validity could not be verified';}
 }
 return {apple,google:state('google',googleKeys)};
}
function approvedSnapshot({orgId,program,account}){
 if(!program||program.organization_id!==orgId||!account||account.organization_id!==orgId||account.program_id!==program.id)throw error(404,'Rewards account not found for this business');
 if(program.status!=='approved')throw error(409,'An approved rewards program is required');
 if(!program.rules_sha256||program.rules_sha256!==hash(JSON.stringify(program.rules)))throw error(409,'Rewards rules changed after approval');
 if(account.pass_status==='revoked')throw error(409,'This rewards pass is revoked');
 if(!Number.isSafeInteger(account.balance)||account.balance<0||!Number.isSafeInteger(program.rules.reward_threshold)||program.rules.reward_threshold<1)throw error(409,'Rewards balance or threshold is invalid');
 return {serial:`nova_${hash(`${orgId}:${program.id}:${account.id}`).slice(0,40)}`,balance:account.balance,threshold:program.rules.reward_threshold,reward:String(program.rules.reward_description||''),terms:String(program.rules.terms_text||'')};
}
function appleCertificates(env,now){
 try{
  const cert=new crypto.X509Certificate(env.APPLE_PASS_SIGNER_CERT_PEM),wwdr=new crypto.X509Certificate(env.APPLE_WWDR_CERT_PEM);
  const key=crypto.createPrivateKey({key:env.APPLE_CSR_PRIVATE_KEY_PEM,passphrase:env.APPLE_CSR_PRIVATE_KEY_PASSWORD||undefined});
  if(!cert.publicKey.export({type:'spki',format:'der'}).equals(crypto.createPublicKey(key).export({type:'spki',format:'der'})))throw Error('key mismatch');
  const subjects=Object.fromEntries(cert.subject.split('\n').map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
  if(subjects.UID!==env.APPLE_PASS_TYPE_ID||subjects.OU!==env.APPLE_TEAM_ID)throw Error('identifier mismatch');
  if(!cert.verify(wwdr.publicKey))throw Error('issuer mismatch');
  for(const c of [cert,wwdr])if(now<new Date(c.validFrom)||now>=new Date(c.validTo))throw Error('certificate outside validity window');
  return {signerCert:Buffer.from(env.APPLE_PASS_SIGNER_CERT_PEM),signerKey:Buffer.from(env.APPLE_CSR_PRIVATE_KEY_PEM),signerKeyPassphrase:env.APPLE_CSR_PRIVATE_KEY_PASSWORD||undefined,wwdr:Buffer.from(env.APPLE_WWDR_CERT_PEM)};
 }catch{throw error(409,'Apple signing certificate, private key, issuer, identifiers or validity could not be verified');}
}
export async function buildWalletPass(platform,data,env=process.env,{now=()=>new Date()}={}){
 const snapshot=approvedSnapshot(data);const state=walletPlatforms(env,data.orgId)[platform];
 if(!state)throw error(422,'Choose Apple or Google Wallet');
 if(!state.can_issue)throw error(409,`${platform} Wallet is disabled or missing configuration for this business. ${state.reason}`);
 const at=now();const issuer=String(env.NOVA_WALLET_ISSUER_NAME).slice(0,100);
 if(platform==='google'){
  if(!/^\d+$/.test(env.GOOGLE_WALLET_ISSUER_ID)||!env.GOOGLE_WALLET_CLASS_ID.startsWith(`${env.GOOGLE_WALLET_ISSUER_ID}.`)||!/^[\w.-]+\.[\w.-]+$/.test(env.GOOGLE_WALLET_CLASS_ID)||!/@[^@]+\.iam\.gserviceaccount\.com$/.test(env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL))throw error(409,'Google issuer, class or service account configuration is invalid');
  const iat=Math.floor(at.getTime()/1000);
  const claims={iss:env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL,aud:'google',typ:'savetowallet',iat,exp:iat+900,payload:{loyaltyObjects:[{id:`${env.GOOGLE_WALLET_ISSUER_ID}.${snapshot.serial}`,classId:env.GOOGLE_WALLET_CLASS_ID,state:'ACTIVE',accountId:snapshot.serial,loyaltyPoints:{label:'POINTS',balance:{int:snapshot.balance}},textModulesData:[{id:'as_of',header:'Balance snapshot',body:`${at.toISOString()}. Current balance and redemption are verified in Nova; automatic updates are not connected.`},{id:'reward',header:'Reward',body:`${snapshot.threshold} points: ${snapshot.reward}`},{id:'terms',header:'Terms',body:snapshot.terms}]}]}};
  const payload=[{alg:'RS256',typ:'JWT'},claims].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
  let signature;try{const key=crypto.createPrivateKey(env.GOOGLE_WALLET_PRIVATE_KEY_PEM);if(key.asymmetricKeyType!=='rsa')throw Error('RSA required');signature=crypto.sign('RSA-SHA256',Buffer.from(payload),key).toString('base64url');}catch{throw error(409,'Google Wallet signing key is invalid');}
  return {platform,url:`https://pay.google.com/gp/v/save/${payload}.${signature}`,snapshot_at:at.toISOString(),automatic_updates:false};
 }
 const certificates=appleCertificates(env,at);const {PKPass}=await import('passkit-generator');
 const logo=Buffer.from(NOVA_LOGO_PNG_BASE64,'base64');
 const pass=new PKPass({'icon.png':logo,'icon@2x.png':logo,'icon@3x.png':logo,'logo.png':logo},certificates,{formatVersion:1,passTypeIdentifier:env.APPLE_PASS_TYPE_ID,teamIdentifier:env.APPLE_TEAM_ID,serialNumber:snapshot.serial,organizationName:issuer,description:String(data.program.name).slice(0,100),logoText:issuer,backgroundColor:'rgb(10,10,10)',foregroundColor:'rgb(250,250,250)',labelColor:'rgb(201,168,76)'});
 pass.type='storeCard';pass.auxiliaryFields.push({key:'as_of',label:'BALANCE SNAPSHOT',value:at.toISOString().slice(0,16).replace('T',' ')});pass.primaryFields.push({key:'points',label:'POINTS',value:snapshot.balance});pass.secondaryFields.push({key:'reward',label:`${snapshot.threshold} POINT REWARD`,value:snapshot.reward});
 pass.backFields.push({key:'snapshot',label:'BALANCE AS OF',value:at.toISOString()},{key:'terms',label:'TERMS',value:snapshot.terms},{key:'updates',label:'CURRENT BALANCE',value:'This card is a snapshot. Nova verifies the current balance at redemption. Automatic pass updates are not connected.'});
 pass.setBarcodes({format:'PKBarcodeFormatQR',message:snapshot.serial,messageEncoding:'iso-8859-1'});
 return {platform,file_name:'nova-rewards.pkpass',mime_type:'application/vnd.apple.pkpass',base64:pass.getAsBuffer().toString('base64'),snapshot_at:at.toISOString(),automatic_updates:false};
}
export async function issueWalletPass({orgId,accountId,platform,actor},env=process.env){
 const account=await dbOne(`loyalty_accounts?id=eq.${enc(accountId)}&organization_id=eq.${enc(orgId)}&select=*`);
 if(!account)throw error(404,'Rewards account not found for this business');
 const program=await dbOne(`loyalty_programs?id=eq.${enc(account.program_id)}&organization_id=eq.${enc(orgId)}&select=*`);
 const result=await buildWalletPass(platform,{orgId,program,account},env);
 await dbInsert('ops_transitions',{organization_id:orgId,entity:'settings',entity_id:account.id,from_state:account.pass_status,to_state:account.pass_status,actor_type:'user',actor_id:actor?.id||null,reason:`${platform} Wallet snapshot generated; device save not confirmed`,evidence:{platform,snapshot_at:result.snapshot_at,artifact_sha256:hash(result.base64||result.url),automatic_updates:false}});
 return result;
}
