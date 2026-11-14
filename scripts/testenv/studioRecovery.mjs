import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {buildContentPack,validateStudioPack,summarizePerformance} from '../../src/lib/contentStudio.js';
export async function testStudioRecovery({env,owner,admin,external,client,call,q,org}){
  const studio=(body,token=owner.token)=>call(client,body,token,{resource:'company',op:'studio'});
  for(const token of [null,admin.token,external.token])assert.equal((await studio({action:'overview'},token)).status,token?403:401);
  const overview=await call(client,{},owner.token,{resource:'company',op:'studio'},'GET');
  assert.equal(overview.status,200,JSON.stringify(overview));
  const brand=overview.result.brands[0],pack=buildContentPack({brand,objective:'TEST explain the customer intake workflow',facts:'TEST fixtures show a saved request and a published appointment.'});
  assert.equal(validateStudioPack(pack),null);
  const body={action:'save_pack',pack_id:randomUUID(),brand_id:brand.id,pack};
  const pair=await Promise.all([studio(body),studio(body)]);
  for(const r of pair)assert.equal(r.status,200,JSON.stringify(r));
  const assets=pair[0].result.assets.filter(a=>a.idea_id===body.pack_id);
  assert.equal(assets.length,4);
  assert.equal((await studio({...body,pack:{...pack,title:'TEST different request'}})).status,409);
  assert.equal((await studio({...body,pack_id:randomUUID(),brand_id:randomUUID()})).status,409);
  assert.equal((await studio({...body,pack_id:randomUUID(),pack:{...pack,source_notes:''}})).status,422);
  const first=assets[0];
  assert.equal((await studio({action:'approve',asset_id:first.id,revision:first.revision})).status,200);
  assert.equal((await studio({action:'update_asset',asset_id:first.id,revision:first.revision,caption:'TEST stale overwrite',script:'',source_notes:'TEST recorded evidence'})).status,409);
  const edited=await studio({action:'update_asset',asset_id:first.id,revision:first.revision+1,caption:'TEST changed caption',script:'TEST script',source_notes:'TEST recorded evidence'});
  assert.equal(edited.result.assets.find(a=>a.id===first.id).status,'draft');
  assert.equal((await studio({action:'metrics',asset_id:first.id,revision:first.revision+2,metrics:{views:-1,likes:0,comments:0,shares:0,leads:0},source:'TEST source'})).status,409);
  const measured=await studio({action:'metrics',asset_id:first.id,revision:first.revision+2,metrics:{views:100,likes:8,comments:1,shares:1,leads:2},source:'TEST supplied platform export, first seven days'});
  assert.equal(measured.status,200,JSON.stringify(measured));
  assert.equal(summarizePerformance(measured.result.assets).ranked[0].engagement_rate,.1);
  assert.equal(summarizePerformance([]).ranked.length,0);
  for(const table of ['content_assets','content_ideas','marketing_brands','nova_team_background_jobs']){
    assert.equal((await env.rest(external.token,table+'?select=*')).status,403,table);
  }
  assert.equal((await env.rest(owner.token,'rpc/nova_team_tick',{method:'POST',body:{}})).status,403);
  const team=body=>call(client,body,owner.token,{resource:'company',op:'team'});
  const mission_id=randomUUID();
  assert.equal((await team({action:'start',mission_id,objective:'TEST execute durable work with the browser disconnected.',focus:'agents'})).status,200);
  assert.equal((await team({action:'enqueue',mission_id})).result.background.status,'queued');
  assert.equal((await team({action:'pause',mission_id})).result.background.status,'paused');
  assert.equal((await q('select public.nova_team_tick() r'))[0].r.completed,0);
  await team({action:'enqueue',mission_id});
  const ticks=await Promise.all([q('select public.nova_team_tick() r'),q('select public.nova_team_tick() r')]);
  assert.equal(ticks.reduce((n,r)=>n+r[0].r.completed,0),1);
  assert.equal((await q('select count(*)::int n from nova_team_events where mission_id=$1',[mission_id]))[0].n,8);
  assert.equal((await q('select status from nova_team_background_jobs where mission_id=$1',[mission_id]))[0].status,'completed');
  assert.equal((await q('select public.nova_team_tick() r'))[0].r.completed,0);
  console.log('PASS recovery studio: existing schema, four real saved assets, idempotent concurrent requests, stale-edit rejection, approval invalidation, sourced metrics, organization isolation, paused work and exactly-once background handoffs with no browser or provider.');
}
