import { validateTwilioSignature, escapeXml, twiml } from './_twilio.js';
import { getNovaAIConfig } from './_config.js';

// Twilio webhook for incoming calls to a Nova AI number. Twilio POSTs
// application/x-www-form-urlencoded — Vercel parses this into req.body
// automatically, so no bodyParser config is needed here (unlike the Stripe
// webhook, which needs the raw body for its own signature scheme).
//
// IMPORTANT — see api/nova-ai/stream.js for why the <Connect><Stream> target
// below must point at a separately-hosted WebSocket service, not this Vercel
// deployment. NOVA_AI_STREAM_WS_URL should be that service's wss:// URL.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { TWILIO_AUTH_TOKEN } = await getNovaAIConfig();
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (TWILIO_AUTH_TOKEN) {
    const fullUrl = `https://${req.headers.host}${req.url}`;
    if (!validateTwilioSignature(req, TWILIO_AUTH_TOKEN, fullUrl)) {
      console.error('[nova-ai:incoming-call] Invalid Twilio signature');
      return res.status(403).send('Invalid signature');
    }
  }

  const calledNumber = req.body?.To || '';
  const callerNumber = req.body?.From || '';
  console.log('[nova-ai:incoming-call] Call to', calledNumber, 'from', callerNumber);

  let agent = null;
  if (SUPABASE_URL && SUPABASE_KEY && calledNumber) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/nova_ai_agents?phone_number=eq.${encodeURIComponent(calledNumber)}&select=id,agent_name,business_name,status&limit=1`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      if (r.ok) {
        const rows = await r.json();
        agent = rows[0] || null;
      }
    } catch (err) {
      console.error('[nova-ai:incoming-call] Agent lookup error:', err.message);
    }
  }

  res.setHeader('Content-Type', 'text/xml');

  if (!agent || agent.status === 'inactive') {
    return res.status(200).send(twiml(
      `<Say voice="Polly.Joanna">This number is not currently active. Please try again later.</Say>`
    ));
  }

  const streamBase = process.env.NOVA_AI_STREAM_WS_URL || '';
  if (!streamBase) {
    console.error('[nova-ai:incoming-call] NOVA_AI_STREAM_WS_URL not configured');
    return res.status(200).send(twiml(
      `<Say voice="Polly.Joanna">This system is still being configured. Please try again soon.</Say>`
    ));
  }

  const streamUrl = `${streamBase}?agent_id=${encodeURIComponent(agent.id)}`;

  return res.status(200).send(twiml(
    `<Connect><Stream url="${escapeXml(streamUrl)}"><Parameter name="agent_id" value="${escapeXml(agent.id)}" /></Stream></Connect>`
  ));
}
