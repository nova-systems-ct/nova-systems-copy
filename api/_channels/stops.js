import {dbOne} from '../_sales/core.js';
import {killSwitchStateFor} from '../_hierarchy/governance.js';
import {killSwitchBlocks} from '../_hierarchy/rules.js';
export async function channelPauseState(orgId,{staff=false}={}){
 const worker=staff?null:await dbOne('workers?portfolio_entity_id=is.null&capability_key=eq.channel_inbox&status=neq.inactive&select=*');
 if(worker&&!['active','restricted'].includes(worker.status))return {paused:true,reason:'channel_worker_paused'};
 const state=killSwitchBlocks(await killSwitchStateFor(worker,orgId));
 return {paused:state.blocked,reason:state.blocked?`kill_switch_${state.scope}`:null};
}
