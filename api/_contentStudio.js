import {launchRpc} from './_launchWorker.js';
import {validateStudioPack} from '../src/lib/contentStudio.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const errors={owner_required:'Only the Nova owner can manage the studio.',brand_not_found:'Choose a brand in this workspace.',invalid_content:'Review the caption, script and source notes.',content_changed:'This content changed. Reload it before saving.',content_not_found:'This content is unavailable.',request_conflict:'This saved request has different content. Start a new pack.',invalid_metrics:'Enter nonnegative whole numbers and a source for the metrics.'};
export async function handleContentStudio(req,res,caller){
  const b=req.body||{},action=req.method==='GET'?'overview':b.action;
  if(!['overview','save_pack','update_asset','approve','reject','metrics','create_brand'].includes(action))return res.status(400).json({error:'Unknown studio action.'});
  if(['update_asset','approve','reject','metrics'].includes(action)&&(!uuid.test(b.asset_id||'')||!Number.isInteger(b.revision)))return res.status(422).json({error:'Reload the selected asset before saving.'});
  if(action==='save_pack'){
    const error=validateStudioPack(b.pack);
    if(!uuid.test(b.pack_id||'')||!uuid.test(b.brand_id||'')||error)return res.status(422).json({error:error||'Choose a brand and a unique content reference.'});
  }
  try{
    const result=await launchRpc('nova_studio_owner',{p_actor:caller.id,p_action:action,p_payload:b});
    if(!result.ok)return res.status(result.code==='owner_required'?403:409).json({...result,error:errors[result.code]||'The content could not be saved.'});
    return res.status(200).json(result);
  }catch{return res.status(502).json({error:'Studio records could not be confirmed. Reload before retrying.'});}
}
