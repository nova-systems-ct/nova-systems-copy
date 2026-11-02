import assert from 'node:assert/strict';
process.env.SUPABASE_URL='https://db.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
const {handleOps}=await import('../api/_ops/index.js');
let accountReads=0,writes=0;
globalThis.fetch=async(url,init={})=>{
 const u=new URL(url);assert.equal(u.host,'db.test');
 if(u.pathname==='/auth/v1/user')return Response.json({id:'owner',email:'test@example.test'});
 if(u.pathname==='/rest/v1/organization_members')return Response.json([{role:'nova_super_admin',organization_id:'o',organizations:{kind:'nova_internal'}}]);
 if(u.pathname==='/rest/v1/rpc/has_permission')return Response.json(JSON.parse(init.body).target_org_id==='o');
 if(u.pathname==='/rest/v1/loyalty_accounts'){accountReads++;assert.equal(u.searchParams.get('organization_id'),'eq.o');return Response.json([]);}
 if(init.method&&init.method!=='GET'){writes++;throw Error('No mutation expected');}
 throw Error(`Unexpected query ${u.pathname}`);
};
const call=async(org,headers={authorization:'Bearer test'})=>{const r={code:200,status(v){this.code=v;return this;},setHeader(){},json(b){this.body=b;return this;}};await handleOps({method:'POST',query:{},headers,body:{organization_id:org,action:'wallet-pass',platform:'apple',account_id:'foreign'}},r,'loyalty');return r;};
assert.equal((await call('o',{})).code,401);assert.equal(accountReads,0);
assert.equal((await call('foreign')).code,403);assert.equal(accountReads,0,'Authorization must precede object reads');
assert.equal((await call('o')).code,404);assert.equal(accountReads,1);assert.equal(writes,0);
console.log('PASS — Wallet HTTP surface rejects unauthenticated, foreign-business and missing-account issuance');
