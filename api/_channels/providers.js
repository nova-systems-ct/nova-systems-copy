import {appleProviderBase} from './appleMessages.js';
export const CHANNEL_PROVIDERS = ['instagram', 'facebook', 'whatsapp', 'android_rcs','apple_messages','tiktok'];
export function channelAccountValid(provider, value) {
  if(provider==='apple_messages')return /^[A-Za-z0-9._:-]{1,128}$/.test(value||'');
  if(provider==='tiktok')return /^[A-Za-z0-9._:@=+/-]{1,128}$/.test(value||'');
  return provider === 'android_rcs' ? /^[A-Za-z0-9._@-]{1,128}$/.test(value || '') : ['instagram', 'facebook', 'whatsapp'].includes(provider) && /^\d{1,50}$/.test(value || '');
}
export function channelSetupValid(provider, data) {
  if(provider==='apple_messages')return !!appleProviderBase(data.transport_config?.api_base)&&/^NOVA_CHANNEL_WEBHOOK_[A-Z0-9_]{1,80}$/.test(data.webhook_secret_ref||'');
  if(provider==='tiktok')return !!appleProviderBase(data.transport_config?.api_base)&&/^[A-Z]{2}$/.test(data.transport_config?.account_region||'')&&/^NOVA_CHANNEL_WEBHOOK_[A-Z0-9_]{1,80}$/.test(data.webhook_secret_ref||'');
  return provider !== 'android_rcs' || (/^[A-Za-z0-9._-]{1,128}$/.test(data.transport_config?.brand_id || '') && /^NOVA_CHANNEL_WEBHOOK_[A-Z0-9_]{1,80}$/.test(data.webhook_secret_ref || ''));
}

export const CHANNEL_JOB_TYPES={instagram:"channel_instagram_turn",facebook:"channel_facebook_turn",whatsapp:"channel_whatsapp_turn",android_rcs:"channel_rcs_turn",apple_messages:"channel_apple_turn",tiktok:"channel_tiktok_turn"};
export const CHANNEL_CAPABILITY_KEYS={instagram:'instagram_inbox',facebook:'facebook_inbox',whatsapp:'whatsapp_inbox',android_rcs:'rcs_inbox',apple_messages:'apple_inbox',tiktok:'tiktok_inbox',sms:'sms_inbox',voice:'phone_agent'};
