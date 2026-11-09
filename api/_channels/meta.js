import crypto from 'node:crypto';
const id = v => typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,256}$/.test(v);
const account = v => typeof v === 'string' && /^\d{1,50}$/.test(v);
export function verifyMetaSignature(raw, signature, secret) {
  if (!Buffer.isBuffer(raw) || !secret || !/^sha256=[a-f0-9]{64}$/.test(String(signature))) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
export function normalizeMetaEvents(payload, now = new Date()) {
  const out=[];
  const add = e => {
    const at = new Date(e.at);
    if (!account(e.account_id) || !id(e.sender_id) || !id(e.event_id) || !Number.isFinite(at.getTime()) || at.getTime()>now.getTime()+300000 || e.sender_id===e.account_id) return;
    if (out.length>=50) throw Object.assign(Error('Webhook batch is too large'),{status:413});
    out.push({...e,at:at.toISOString(),text:typeof e.text==='string'?e.text.slice(0,4000):null});
  };
  for (const entry of payload?.entry||[]) {
    if (['instagram','page'].includes(payload.object)) {
      const provider=payload.object==='instagram'?'instagram':'facebook';
      for (const m of entry.messaging||[]) {
        if (!m.message || m.message.is_echo || m.recipient?.id!==entry.id || !m.message.mid) continue;
        add({provider,account_id:entry.id,sender_id:m.sender?.id,event_id:m.message.mid,kind:typeof m.message.text==='string'?'message':'unsupported',text:m.message.text,at:m.timestamp});
      }
      for(const change of entry.changes||[]) {
        const v=change.value;
        if(provider!=='instagram'||change.field!=='comments'||!v?.from?.id||v.media?.media_product_type==='LIVE')continue;
        add({provider,account_id:entry.id,sender_id:v.from.id,event_id:v.id,kind:'comment',text:v.text,at:Number(entry.time)*1000});
      }
    } else if(payload.object==='whatsapp_business_account') {
      for(const change of entry.changes||[]) {
        if(change.field!=='messages')continue;
        const v=change.value;
        for(const m of v?.messages||[])add({provider:'whatsapp',account_id:v.metadata?.phone_number_id,sender_id:m.from,event_id:m.id,kind:m.type==='text'?'message':'unsupported',text:m.text?.body,at:Number(m.timestamp)*1000});
      }
    }
  }
  return out;
}
export const graphOrigin=(provider,loginMode='facebook')=>provider==='instagram'&&loginMode==='instagram'?'https://graph.instagram.com':'https://graph.facebook.com';
export function graphMessageRequest({provider,accountId,recipientId,commentId,body,token,version,loginMode='facebook'}) {
  if(!['instagram','facebook','whatsapp'].includes(provider)||!account(accountId)||!/^v\d{1,2}\.\d+$/.test(version||'')||!token||typeof body!=='string'||!body.trim()||Buffer.byteLength(body)>1000)throw Error('Invalid channel request');
  if(commentId){if(provider!=='instagram'||!id(commentId))throw Error('Unsupported private reply');}
  else if(!id(recipientId))throw Error('Invalid recipient');
  const message=provider==='whatsapp'?{messaging_product:'whatsapp',recipient_type:'individual',to:recipientId,type:'text',text:{body}}:{recipient:commentId?{comment_id:commentId}:{id:recipientId},message:{text:body},...(provider==='facebook'?{messaging_type:'RESPONSE'}:{})};
  return {url:`${graphOrigin(provider,loginMode)}/${version}/${accountId}/messages`,method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:message};
}
