import {launchRpc} from './_launchWorker.js';
import {channelConfiguration} from './_channelProviders.js';
import {runtimeProviderEnv} from './_providerVault.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const messages={
  owner_required:'Only an active Nova owner can run executive assignments.',
  mission_not_found:'That mission is unavailable.',
  mission_conflict:'This mission reference already belongs to another instruction.',
  invalid_mission:'Enter an objective between 8 and 1,000 characters and choose a campaign focus.',
  step_changed:'The mission has moved to another step. Reload it before continuing.',
  brand_required:'The Nova Systems marketing brand needs to be set up first.',
  task_not_available:'Choose a pending task in your Nova organization.',
  invalid_assignee:'Enter the name of a worker or staff member.',
};

export async function handleExecutiveTeam(req,res,caller) {
  const body=req.body||{};
  const action=req.method==='GET'?'overview':body.action;
  const missionId=req.method==='GET'?req.query?.mission_id:body.mission_id;
  if(!['overview','start','advance','assign'].includes(action))return res.status(400).json({error:'Unknown executive action.'});
  if((missionId&&!uuid.test(missionId))||(['start','advance'].includes(action)&&!missionId))return res.status(422).json({error:'Choose a valid mission.'});
  if(action==='advance'&&(!Number.isInteger(body.expected_step)||body.expected_step<0||body.expected_step>6))return res.status(422).json({error:messages.step_changed});
  if(action==='assign'&&!uuid.test(body.task_id||''))return res.status(422).json({error:messages.task_not_available});

  const payload={mission_id:missionId||null};
  if(action==='start'){
    payload.objective=typeof body.objective==='string'?body.objective.trim():'';
    payload.focus=body.focus;
    if(payload.objective.length<8||payload.objective.length>1000)return res.status(422).json({error:messages.invalid_mission});
  }
  if(action==='advance'){
    payload.expected_step=body.expected_step;
    payload.model_note=typeof body.model_note==='string'?body.model_note.trim().slice(0,2000):null;
  }
  if(action==='assign'){
    payload.task_id=body.task_id;
    payload.assignee=typeof body.assignee==='string'?body.assignee.trim():'';
  }

  try{
    const channels=channelConfiguration(await runtimeProviderEnv()).map(channel=>({
      key:channel.key,
      name:channel.name,
      status:channel.status,
      delivery_verified:false,
    }));
    if(action==='advance'&&body.expected_step===2)payload.channel_readiness=channels;
    const result=await launchRpc('nova_team_owner',{p_actor:caller.id,p_action:action,p_payload:payload});
    if(!result.ok){
      const status=result.code==='owner_required'?403:result.code==='mission_not_found'?404:409;
      return res.status(status).json({error:messages[result.code]||'The action could not be completed.',code:result.code});
    }
    return res.status(200).json({...result,channels});
  }catch{
    return res.status(502).json({error:'Executive work could not be confirmed. Reload the saved mission before continuing.'});
  }
}
