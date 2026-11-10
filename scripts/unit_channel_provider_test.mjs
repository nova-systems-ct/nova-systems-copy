import assert from 'node:assert/strict';
import {channelConfiguration,createChannelRequest,sendChannelReply} from '../api/_channelProviders.js';
const id='3f346fb7-4a93-446c-ac19-a894fd30dab9';
const cases=[
 ['instagram',{INSTAGRAM_ACCOUNT_ID:'business',INSTAGRAM_ACCESS_TOKEN:'fixture',INSTAGRAM_API_VERSION:'v25.0',NOVA_FREE_SOCIAL_SEND_ENABLED:'true'},{message_id:'receipt'}],
 ['tiktok',{TIKTOK_BUSINESS_ID:'business',TIKTOK_MESSAGING_ACCESS_TOKEN:'fixture',NOVA_FREE_SOCIAL_SEND_ENABLED:'true'},{code:0,data:{message:{message_id:'receipt'}}}],
 ['apple_messages',{APPLE_BUSINESS_ACCOUNT_ID:'business',CM_PRODUCT_TOKEN:'fixture',NOVA_SPENDING_LOCK:'disabled',NOVA_BILLABLE_DISPATCH_ENABLED:'true'},{errorCode:0,messages:[{messageErrorCode:0,status:'Accepted',reference:id}]}],
];
for(const [channel,env,success]of cases){
 const thread={account_id:'business',external_peer_id:'customer',external_thread_id:'conversation+encoded==',reply_id:id};let requests=0;
 const send=async(data,status=200)=>sendChannelReply(channel,thread,'Reviewed reply.',{env,fetchImpl:async()=>{requests++;return Response.json(data,{status});}});
 const out=await send(success);assert.equal(out.state,'accepted');assert(out.provider_id);assert.equal(out.delivery_verified,undefined);
 assert.equal((await send({})).state,channel==='tiktok'?'failed':'unknown');assert.equal((await send({error:'no'},401)).state,'failed');assert.equal((await send({},503)).state,'unknown');
 assert.equal((await sendChannelReply(channel,thread,'Reviewed reply.',{env,fetchImpl:async()=>{throw Error('network timeout');}})).state,'unknown');
 assert.throws(()=>createChannelRequest(channel,{...thread,account_id:'wrong-account'},'Reviewed reply.',env),/does not match/);
 assert.equal(requests,4);
}
assert(channelConfiguration({}).every(c=>!c.configured&&!c.send_enabled));
assert.throws(()=>createChannelRequest('instagram',{account_id:'business',external_peer_id:'customer'},'hello',{...cases[0][1],NOVA_FREE_SOCIAL_SEND_ENABLED:'false'}),/paused/);
assert.throws(()=>createChannelRequest('apple_messages',{account_id:'business',external_peer_id:'customer',reply_id:id},'hello',{...cases[2][1],NOVA_SPENDING_LOCK:'locked'}),/paused/);
console.log('PASS — all three documented outbound envelopes; strict provider receipts, accepted versus delivered, missing/failed/uncertain results, account binding and default spending locks. HTTP responses are fixtures; no provider contacted.');
