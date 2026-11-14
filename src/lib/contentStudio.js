export const STUDIO_PLATFORMS=['instagram','facebook','tiktok','youtube'];

// A free editorial starting point, deliberately labelled a template. Optional
// on-device AI replaces the actual caption, not a decorative handoff message.
export function buildContentPack({brand,objective,facts}){
  const personal=brand.key==='isaac'||brand.key==='zion';
  const hook=personal?'Building the life. Showing the work.':'Every inquiry deserves a next step.';
  const script=personal
    ? `I’m Isaac. Zion is the story of building my companies, one real step at a time.\n${facts}\nThe goal is to become a millionaire. This is the work in progress, not a claim that I’m there.\nFollow the journey.`
    : `${hook}\n${facts}\n${objective}\nStart a conversation at nova-systems.app.`;
  const scenes=[
    {seconds:4,text:hook,detail:personal?'ZION · THE FOUNDER JOURNEY':brand.name},
    {seconds:6,text:facts.slice(0,160),detail:'THE WORK TODAY'},
    {seconds:5,text:personal?'The goal is big. The next step is real.':objective.slice(0,150),detail:personal?'A JOURNEY IN PROGRESS':'BUILT AROUND YOUR BUSINESS'},
    {seconds:4,text:personal?'Follow the journey.':'Start a conversation.',detail:personal?'ZION / ISAAC NOVA':'nova-systems.app'},
  ];
  return {title:objective.slice(0,160),script,scenes,source_notes:facts,generated_by:'template',drafts:STUDIO_PLATFORMS.map(platform=>({platform,caption:`${hook}\n\n${facts}\n\n${personal?'Follow Zion as I build my companies.':platform==='tiktok'?'Explore Nova through the link in bio.':'See the workflow: https://nova-systems.app/service-request'}`,format:platform==='youtube'?'short':platform==='tiktok'?'short_video':'reel'}))};
}

export function summarizePerformance(assets){
  const measured=assets.filter(a=>Number(a.metrics?.views)>0);
  if(!measured.length)return {headline:'No performance data yet',detail:'Add the figures and source from a published post. Recommendations use recorded results only.',ranked:[]};
  const ranked=measured.map(a=>({...a,engagement_rate:((a.metrics.likes||0)+(a.metrics.comments||0)+(a.metrics.shares||0))/a.metrics.views})).sort((a,b)=>b.engagement_rate-a.engagement_rate);
  const best=ranked[0];
  return {headline:`${best.platform} has the highest recorded engagement rate`,detail:`${(best.engagement_rate*100).toFixed(1)}% across ${best.metrics.views.toLocaleString()} views. Compare similar audiences and measurement windows before changing the plan.`,ranked};
}

export function validateStudioPack(pack){
  if(!pack||typeof pack.title!=='string'||pack.title.trim().length<3||pack.title.length>160)return 'Enter a title of 3–160 characters.';
  if(typeof pack.source_notes!=='string'||pack.source_notes.trim().length<8||pack.source_notes.length>3000)return 'Add the real facts or source notes used in this content.';
  if(typeof pack.script!=='string'||pack.script.length>5000)return 'The script must be at most 5,000 characters.';
  if(!Array.isArray(pack.scenes)||pack.scenes.length<2||pack.scenes.length>8||pack.scenes.some(s=>!Number.isInteger(s.seconds)||s.seconds<2||s.seconds>12||typeof s.text!=='string'||!s.text.trim()||s.text.length>180||typeof s.detail!=='string'||s.detail.length>100))return 'Use 2–8 scenes, 2–12 seconds each, with short text.';
  if(!Array.isArray(pack.drafts)||pack.drafts.length<1||pack.drafts.length>4||new Set(pack.drafts.map(d=>d.platform)).size!==pack.drafts.length||pack.drafts.some(d=>!STUDIO_PLATFORMS.includes(d.platform)||typeof d.caption!=='string'||!d.caption.trim()||d.caption.length>2200))return 'Choose one caption per supported platform, up to 2,200 characters each.';
  return null;
}
