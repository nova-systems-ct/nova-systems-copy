// Resolves Nova AI's 4 third-party API keys from the nova_ai_settings table
// first (set via the dashboard's Settings tab), falling back to the
// equivalent environment variable if no DB value is saved. This lets Isaac
// configure keys live from the dashboard without a redeploy, while still
// working out of the box from Vercel env vars alone.

const SETTINGS_KEYS = ['ELEVENLABS_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'DEEPGRAM_API_KEY'];

export async function getNovaAIConfig() {
  const config = {
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
    DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY || '',
  };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return config;

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/nova_ai_settings?select=key,value&key=in.(${SETTINGS_KEYS.join(',')})`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (r.ok) {
      const rows = await r.json();
      for (const row of rows) {
        if (row.value) config[row.key] = row.value;
      }
    }
  } catch (err) {
    console.error('[nova-ai:config] Failed to load nova_ai_settings (falling back to env):', err.message);
  }

  return config;
}

export { SETTINGS_KEYS };
