import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function testExecutiveTeam({env,owner,admin,external,client,call,q,org}){
  const team=(body,token=owner.token)=>call(client,body,token,{resource:'company',op:'team'});
  const missionId=randomUUID();
  const start={action:'start',mission_id:missionId,objective:'TEST prepare a Nova Audit campaign for local service companies.',focus:'audit'};
  for(const token of [null,admin.token,external.token])assert.equal((await team(start,token)).status,token?403:401);
  const started=await team(start);
  assert.equal(started.status,200,JSON.stringify(started));
  assert.equal(started.result.events.length,1);
  assert.equal((await team(start)).result.events.length,1);
  assert.equal((await team({...start,objective:'TEST use the same key for a different campaign'})).status,409);
  const advance=(expected_step,model_note)=>team({action:'advance',mission_id:missionId,expected_step,model_note});
  assert.equal((await advance(2)).status,409);
  for(let step=0;step<7;step++){
    const results=await Promise.all([advance(step,'TEST fixture-only local model proposal'),advance(step,'TEST fixture-only local model proposal')]);
    for(const result of results){
      assert.equal(result.status,200,JSON.stringify(result));
      assert.equal(result.result.events.length,step+2);
    }
    assert.equal(results.filter(result=>result.result.duplicate).length,1);
  }
  const saved=await call(client,{},owner.token,{resource:'company',op:'team',mission_id:missionId},'GET');
  assert.equal(saved.status,200,JSON.stringify(saved));
  assert.equal(saved.result.mission.state,'review');
  assert.equal(saved.result.events[6].receipt.spent_cents,0);
  assert.equal(saved.result.events[7].recipient,'owner');
  assert.equal(saved.result.events[5].receipt.scenes.length,3);
  assert.equal(saved.result.events[1].model_note,'TEST fixture-only local model proposal');
  assert.deepEqual(await q('select platform,status from content_assets order by platform'),[{platform:'instagram',status:'draft'},{platform:'tiktok',status:'draft'}]);
  assert.equal((await q("select count(*)::int n from nova_tasks where organization_id=$1 and trigger_type='executive_mission' and status='completed'",[org]))[0].n,4);
  for(const table of ['nova_team_missions','nova_team_events'])assert.equal((await env.rest(owner.token,table+'?select=*')).status,403);
  const pending=(await q("insert into nova_tasks(organization_id,title,status) values($1,'TEST private staffing task','pending') returning id",[org]))[0];
  const assignment=await team({action:'assign',task_id:pending.id,assignee:'TEST Operations worker'});
  assert.equal(assignment.status,200,JSON.stringify(assignment));
  assert.equal((await q('select assigned_to from nova_tasks where id=$1',[pending.id]))[0].assigned_to,'TEST Operations worker');
  assert.equal((await team({action:'assign',task_id:pending.id,assignee:'TEST Operations worker'})).result.duplicate,true);
  console.log('PASS executive team: owner isolation, simultaneous retries, eight durable handoffs, four completed tasks, two marketing drafts, Zion script, $0 cost receipt, assignment update.');
}
