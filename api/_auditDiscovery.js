import net from 'node:net';
// Public-source discovery, not a fact generator. No paid search API, login, or contact action.
const clean=(s,n=250)=>String(s||'').replace(/<[^>]*>/g,' ').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const phrase=s=>clean(s,140).replace(/[^\p{L}\p{N}\s.&-]/gu,' ').replace(/\s+/g,' ').trim();
function publicUrl(v){try{const u=new URL(v);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||net.isIP(u.hostname.replace(/^\[|\]$/g,''))||/(^|\.)(localhost|local|internal)$/.test(u.hostname)||/^(127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname))return null;u.hash='';return u.toString();}catch{return null;}}
async function boundedJson(response){const reader=response.body?.getReader();if(!reader)return response.json();let bytes=0;const chunks=[];try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>300000)throw Error('Discovery response exceeds the size limit');chunks.push(Buffer.from(value));}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}finally{await reader.cancel().catch(()=>{});}}
export async function discoverPublicNews({name,location},{fetchImpl=fetch,now=()=>new Date()}={}){
 const entity=phrase(name);if(entity.length<2)return {status:'unavailable',candidates:[],note:'A confirmed business name is required.'};
 const query=`"${entity}"${phrase(location)?` "${phrase(location)}"`:''}`;
 const endpoint=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
 for(const [k,v] of Object.entries({query,mode:'artlist',format:'json',maxrecords:'10',timespan:'3m',sort:'datedesc'}))endpoint.searchParams.set(k,v);
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetchImpl(endpoint.toString(),{redirect:'error',signal:controller.signal,headers:{Accept:'application/json','User-Agent':'NovaAuditResearch/2.0 (+https://nova-systems.app)'}});
  if(!response.ok)throw Error(`Public news source returned HTTP ${response.status}`);
  const data=await boundedJson(response);if(!Array.isArray(data.articles))throw Error('Public news source did not return an article list');
  const seen=new Set();const candidates=[];
  for(const row of data.articles.slice(0,10)){const url=publicUrl(row.url);if(!url||seen.has(url))continue;seen.add(url);candidates.push({kind:'news',url,title:clean(row.title),publisher:clean(row.domain,120),published_at:clean(row.seendate,40),discovered_at:now().toISOString(),identity_confirmed:false,claims_verified:false});}
  return {status:'searched',source:endpoint.toString(),query,searched_at:now().toISOString(),candidates,note:'GDELT indexed news only, over the requested three-month window. Matches require exact business identity and claim review. No results are not proof that no reporting exists.'};
 }catch(e){return {status:'unavailable',source:endpoint.toString(),query,searched_at:now().toISOString(),candidates:[],note:clean(e.message,300)};}finally{clearTimeout(timer);}
}
export function channelCandidates(signals={}){
 const candidates=[];
 for(const [channel,urls] of Object.entries(signals.social||{}))for(const raw of urls||[]){const url=publicUrl(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);if(url)candidates.push({kind:'social',channel,url,identity_confirmed:false,claims_verified:false});}
 for(const email of signals.emails||[])if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))candidates.push({kind:'contact',channel:'email',target:clean(email,200),identity_confirmed:false});
 for(const phone of signals.phones||[])candidates.push({kind:'contact',channel:'phone',target:clean(phone,40),identity_confirmed:false});
 const seen=new Set();return candidates.filter(x=>{const k=x.url||x.target;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,30);
}
