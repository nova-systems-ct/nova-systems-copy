import {handleAuditQueueTick} from './_auditQueueTick.js';
import {handleInboundTurn,sendFollowup} from './_ops/service.js';
import {dbInsert} from './_sales/core.js';
import {CHANNEL_HANDLERS} from './_channels/service.js';
export const CORE_HANDLERS={
 ...CHANNEL_HANDLERS,
 ops_conversation_turn:async job=>{const r=await handleInboundTurn({orgId:job.organization_id,conversationId:job.payload?.conversation_id,messageId:job.payload?.message_id});return r.skipped==='organization_paused'?{...r,paused:true}:r;},
 ops_followup_send:job=>sendFollowup({orgId:job.organization_id,followupId:job.payload?.followup_id,enqueue:row=>dbInsert('jobs',row,{onConflict:'idempotency_key'})}),
};
export function handleCoreQueueTick(req,res,opts={}){
 return handleAuditQueueTick(req,res,{...opts,handlers:opts.handlers||CORE_HANDLERS,jobTypes:Object.keys(CORE_HANDLERS),enableFlag:'NOVA_CORE_HTTP_WORKER_ENABLED',signaturePrefix:'nova-core-tick',receiptPrefix:'core-tick',deferPaused:true});
}
