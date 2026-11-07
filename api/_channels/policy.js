import {tiktokMspEligible} from './tiktokMessages.js';
const REPLY_PURPOSES = new Set(['reply','staff_reply','booking_link','booking_confirmation','appointment_reminder','escalation_notice']);
export function channelSendDecision({connection,identity,conversation,org,purpose,now=new Date(),env=process.env}) {
  const no=reason=>({allowed:false,reason});
  if(env.NOVA_SPENDING_LOCK!=='disabled')return no('spending_locked');
  if(env.NOVA_CHANNEL_SEND_ENABLED!=='true')return no('sending_disabled');
  if(connection?.provider==='tiktok'&&!tiktokMspEligible(connection.transport_config?.account_region))return no('provider_region_not_supported');
  if(!connection?.verified_at||connection.status!=='enabled'||!connection.outbound_enabled)return no('connection_not_enabled');
  if(purpose!=='staff_reply'&&!connection.automation_enabled)return no('automation_paused');
  if(identity?.suppressed)return no('suppressed_opt_out');
  if(org?.paused)return no('organization_paused');
  if(conversation?.staff_takeover&&purpose!=='staff_reply')return no('staff_takeover');
  const at=Date.parse(conversation?.last_inbound_at);
  if(!Number.isFinite(at)||at>now.getTime()||now.getTime()-at>=86400000)return no('reply_window_closed');
  if(!REPLY_PURPOSES.has(purpose)&&!(identity?.marketing_consent&&identity?.consent_source&&identity?.consent_at))return no('channel_marketing_consent_required');
  return {allowed:true,reason:'customer_initiated_reply_window'};
}
