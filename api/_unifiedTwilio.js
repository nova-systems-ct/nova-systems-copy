import {verifyTwilioSignature,normalizePhone} from './_wave1.js';
import {runtimeProviderEnv} from './_providerVault.js';
import {launchRpc} from './_launchWorker.js';
import {billableDispatchEnabled} from './_spendingPolicy.js';
import {scheduleInboundSalesWorker,generateSalesReply,requireCostBudget} from './_autonomousSales.js';
const base='https://nova-systems.app';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const xml=(res,inside)=>{res.setHeader('Content-Type','text/xml');return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response>'+inside+'</Response>')};
export function buildVoiceTurn(reply,turn){const action=base+'/webhooks/voice-agent?turn='+turn;return '<Gather input="speech" action="'+escape(action)+'" method="POST" timeout="5" speechTimeout="auto" language="en-US" actionOnEmptyResult="true"><Say>'+escape(reply)+'</Say></Gather><Say>Thank you for calling Nova Systems. Your request has been saved for the team.</Say><Hangup/>'}
export async function handleUnifiedTwilio(req,res,op){
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});const env=await runtimeProviderEnv(),p=req.body||{},turn=Number(req.query?.turn||0),path=op==='voice-agent'?'/webhooks/voice-agent'+(req.query?.turn!=null?'?turn='+String(req.query.turn):''):op==='twilio-status'?'/webhooks/twilio-status':'/webhooks/twilio-message';
 if(!env.TWILIO_AUTH_TOKEN||!env.TWILIO_ACCOUNT_SID)return res.status(503).json({error:'The business phone account is not configured.'});
 if(p.AccountSid!==env.TWILIO_ACCOUNT_SID||!verifyTwilioSignature({url:base+path,params:p,signature:req.headers['x-twilio-signature'],authToken:env.TWILIO_AUTH_TOKEN}))return res.status(403).json({error:'Invalid provider signature.'});
 if(op==='voice-agent')return voice(req,res,p,turn,env);
 const channel=String(op==='twilio-status'?p.From:p.To).startsWith('whatsapp:')?'whatsapp':'sms',account=channel==='whatsapp'?env.TWILIO_WHATSAPP_FROM:env.TWILIO_PHONE_NUMBER;
 if(String(op==='twilio-status'?p.From:p.To)!==account)return res.status(403).json({error:'The business sender does not match.'});
 if(op==='twilio-status'){
  if(!['delivered','undelivered','failed'].includes(p.MessageStatus))return res.status(200).json({received:true});
  const d=await launchRpc('nova_channel_delivery',{p_channel:channel,p_account:account,p_sid:String(p.MessageSid||''),p_status:p.MessageStatus});return res.status(d.ok?200:400).json({received:d.ok});
 }
 const from=normalizePhone(String(p.From||'').replace(/^whatsapp:/,''));if(!from||!/^SM[0-9a-fA-F]{32}$/.test(p.MessageSid||'')||typeof p.Body!=='string')return xml(res,'');
 if(!p.Body.trim())return xml(res,'');
 const d=await launchRpc('nova_channel_receive',{p_channel:channel,p_account:account,p_peer:from,p_thread:from,p_external_message:p.MessageSid,p_text:p.Body.slice(0,6000),p_received_at:new Date().toISOString(),p_test:false});
 if(!d.ok)return res.status(500).json({error:'The customer message could not be saved.'});if(!d.duplicate)await scheduleInboundSalesWorker(d.thread_id);return xml(res,'');
}
async function voice(req,res,p,turn,env){
 if(!Number.isInteger(turn)||turn<0||turn>12||p.To!==env.TWILIO_PHONE_NUMBER)return res.status(403).json({error:'Invalid phone route.'});
 // A live incoming call and speech processing can cost money. Never activate it under a $0 lock.
 if(!billableDispatchEnabled(env)){await launchRpc('nova_worker_budget_need',{p_service:'voice'});return res.status(503).json({error:'Live AI reception is paused pending a CFO budget and owner activation.'})}
 if(turn===0){const budget=await requireCostBudget('voice','voice-call:'+p.CallSid,env);if(budget.duplicate){/* The call ledger below decides whether this turn already has a receipt. */}}
 const received=await launchRpc('nova_voice_receive',{p_call:String(p.CallSid||''),p_from:normalizePhone(p.From)||'',p_account:p.AccountSid,p_turn:turn,p_text:turn===0?'Customer called Nova.':String(p.SpeechResult||'').slice(0,2000)});
 if(!received.ok)return res.status(409).json({error:'The phone turn could not be claimed.'});
 if(received.end_call)return xml(res,'<Say>Thank you. Your request is saved for Nova to follow up. Goodbye.</Say><Hangup/>');
 if(received.duplicate){if(received.state==='completed')return xml(res,buildVoiceTurn(received.reply,turn+1));return res.status(503).json({error:'This phone turn is already processing.'})}
 let reply;if(turn===0)reply='Hello, I’m Aria, Nova Systems’ AI assistant. I can help with your business systems inquiry and arrange a next step. What kind of business do you run?';
 else if(!String(p.SpeechResult||'').trim())reply='I did not catch that. Please tell me what your business needs help with, or say that you would like a callback.';
 else{try{const generated=await generateSalesReply({agent:'voice',messages:[...(received.transcript||[]),{direction:'inbound',text:p.SpeechResult}],key:'voice-model:'+p.CallSid+':'+turn,env});reply=generated.text}catch{reply='I’ve saved your inquiry for the Nova team. A team member can help arrange a phone introduction. Please visit nova systems dot app for the booking page.'}}
 await launchRpc('nova_voice_finish',{p_session:received.session_id,p_turn:turn,p_reply:reply});return xml(res,buildVoiceTurn(reply,turn+1));
}
