// Read-only checks. No message, model inference, calendar write or payment endpoint is called.
export const LAUNCH_SERVICE = 'MGcfd121875758c03eb9a88db6fca26767';
export const LAUNCH_CAMPAIGN = 'CMd844e5f9104dd9b5b785509cd3fc785b';
export const LAUNCH_PHONE = 'PN44e46862da7feae1e45de3ed7de784ce';
export async function checkLaunchConnections(env = process.env, request = fetch) {
  const get = async (url, headers) => {
    try {
      const r = await request(url, { method: 'GET', headers, signal: AbortSignal.timeout(12000) });
      if (!r.ok) return { ok:false, http_status:r.status };
      const data=await r.json();
      if (!data || typeof data !== 'object') return {ok:false,reason:'invalid_response'};
      return {ok:true,data};
    } catch { return {ok:false, reason:'unreachable'}; }
  };
  const result = { checked_at:new Date().toISOString(), operations:'read_only', spending_enabled:false };
  const sid=env.TWILIO_ACCOUNT_SID, token=env.TWILIO_AUTH_TOKEN;
  if (/^AC[0-9a-f]{32}$/i.test(sid||'') && token) {
    const headers={Authorization:'Basic '+Buffer.from(sid+':'+token).toString('base64')};
    const [account,campaign,phone] = await Promise.all([
      get(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,headers),
      get(`https://messaging.twilio.com/v1/Services/${LAUNCH_SERVICE}/Compliance/Usa2p/${LAUNCH_CAMPAIGN}`,headers),
      get(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${LAUNCH_PHONE}.json`,headers),
    ]);
    result.twilio={credentials_accepted:account.ok,account_type:account.ok?String(account.data.type||'unknown').slice(0,30):null,http_status:account.http_status||null,
      campaign_readable:campaign.ok,campaign_status:campaign.ok?String(campaign.data.campaign_status||'unknown').slice(0,40):'unverified',
      campaign_errors:campaign.ok?(Array.isArray(campaign.data.errors)?campaign.data.errors:[]).slice(0,5).filter(Boolean).map(e=>({code:String(e.code||e.error_code||'').slice(0,20)})):[],
      phone_readable:phone.ok,voice_webhook_present:phone.ok&&!!phone.data.voice_url,sms_webhook_present:phone.ok&&!!phone.data.sms_url,
      ai_receptionist_verified:false,sms_delivery_verified:false};
  } else result.twilio={credentials_accepted:false,campaign_status:'unverified',reason:'credentials_missing'};
  const base=(env.SUPABASE_URL||'').replace(/\/$/,'');
  const anon=env.VITE_SUPABASE_ANON_KEY;
  if(base&&anon){const a=await get(base+'/auth/v1/settings',{apikey:anon});result.login={settings_readable:a.ok,apple_enabled:a.ok&&a.data.external?.apple===true,google_enabled:a.ok&&a.data.external?.google===true};}
  else result.login={settings_readable:false,apple_enabled:false,google_enabled:false};
  if(env.RESEND_API_KEY){const d=await get('https://api.resend.com/domains',{Authorization:'Bearer '+env.RESEND_API_KEY});result.email={credentials_accepted:d.ok,verified_domain:d.ok&&Array.isArray(d.data.data)&&d.data.data.some(x=>x?.status==='verified'),delivery_verified:false};}
  else result.email={credentials_accepted:false,verified_domain:false,delivery_verified:false};
  return result;
}
