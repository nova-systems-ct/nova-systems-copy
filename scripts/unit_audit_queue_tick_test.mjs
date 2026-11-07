import assert from 'node:assert/strict';
const M=await import('../api/_auditQueueTick.js').catch(()=>({}));
assert.equal(typeof M.handleAuditQueueTick,'function','Scheduled audits need a bounded authenticated queue receiver');
const e={CRON_SECRET:'fixture-secret',NOVA_AUDIT_HTTP_WORKER_ENABLED:'true',SUPABASE_URL:'https://staging.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',NOVA_WORKER_TARGET_REF:'staging'};
const res=()=>({code:200,status(v){this.code=v;return this;},json(v){this.body=v;return this;}});
const ts=String(Math.floor(Date.now()/1000));const nonce='00000000-0000-0000-0000-000000000001';
const headers={'x-nova-audit-timestamp':ts,'x-nova-audit-nonce':nonce,authorization:`Bearer ${M.schedulerSignature(ts,nonce,e.CRON_SECRET)}`};
let claims=0;
const store={claimNext:async(args)=>{claims++;assert(args.jobTypes.every(x=>x.startsWith('audit_')));return null;}};
let r=res();await M.handleAuditQueueTick({method:'POST',headers:{}},r,{e,store,heldTypes:async()=>[],rememberNonce:async()=>true});assert.equal(r.code,403);assert.equal(claims,0);
r=res();await M.handleAuditQueueTick({method:'POST',headers},r,{e:{...e,NOVA_WORKER_TARGET_REF:'production'},store,heldTypes:async()=>[],rememberNonce:async()=>true});assert.equal(r.code,503);assert.equal(claims,0);
r=res();await M.handleAuditQueueTick({method:'POST',headers},r,{e,store,heldTypes:async()=>[],rememberNonce:async()=>true});assert.equal(r.code,200);assert.equal(claims,1);assert.equal(r.body.processed,false);
console.log('PASS — queue receiver authentication, explicit project target and audit-only claim scope passed');

r=res();await M.handleAuditQueueTick({method:'POST',headers},r,{e,store,heldTypes:async()=>[],rememberNonce:async()=>false});assert.equal(r.code,409);assert.equal(claims,1,'Replayed scheduler request cannot claim more work');
