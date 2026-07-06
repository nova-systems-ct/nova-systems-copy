import { setCors } from '../_cors.js';
import { rateLimit } from '../_rateLimit.js';
import { sanitize, sanitizePhone } from '../_sanitize.js';
import { validateTwilioSignature, twiml, twilioRequest } from './_twilio.js';
import { buildSystemPrompt, getClaudeReply } from './stream.js';
import { getNovaAIConfig, SETTINGS_KEYS } from './_config.js';

// Combined Nova AI endpoint — dispatch via ?action=
//   sms-webhook          POST  Twilio inbound-SMS webhook (form-encoded)
//   send-sms             POST  { to, message, agent_id } — outbound SMS
//   call-completed       POST  Twilio call-status callback (form-encoded)
//   get-twilio-numbers    GET  list available CT Twilio numbers (203/860/475)
//   provision-number     POST  { phone_number, agent_id } — buy + wire up a number
//   get-voice-preview    POST  { voice_id, sample_text } — ElevenLabs TTS preview
//   agents                GET  list (or ?id=) / POST { action: create|update|delete }
//   agent-detail           GET ?id= — stats + 30-day call chart + knowledge base
//   knowledge-base         GET ?agent_id= / POST { action: 'save', agent_id, ... }
//   voices                 GET  list / POST { action: 'create', ... }
//   settings               GET  key/value map / POST { KEY: value, ... }
//   call-logs               GET ?agent_id=&outcome=&from=&to=
//   sms-logs                GET ?agent_id= (grouped threads) or ?agent_id=&contact_phone= (one thread)

const CT_AREA_CODES = ['203', '860', '475'];

async function supabaseFetch(path, opts = {}) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase not configured');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  return res;
}

async function findAgentByNumber(phoneNumber) {
  const r = await supabaseFetch(`nova_ai_agents?phone_number=eq.${encodeURIComponent(phoneNumber)}&select=*&limit=1`);
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
}

async function findKnowledgeBase(agentId) {
  const r = await supabaseFetch(`nova_ai_knowledge_bases?agent_id=eq.${encodeURIComponent(agentId)}&limit=1`);
  if (!r.ok) return {};
  const rows = await r.json();
  return rows[0] || {};
}

async function logSms({ agentId, contactPhone, direction, message }) {
  try {
    await supabaseFetch('nova_ai_sms_logs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ agent_id: agentId, contact_phone: contactPhone, direction, message }),
    });
  } catch (err) {
    console.error('[nova-ai] Failed to log SMS (non-fatal):', err.message);
  }
}

// ---------------------------------------------------------------- sms-webhook
async function handleSmsWebhook(req, res) {
  const { TWILIO_AUTH_TOKEN, TWILIO_ACCOUNT_SID } = await getNovaAIConfig();
  if (TWILIO_AUTH_TOKEN) {
    const fullUrl = `https://${req.headers.host}${req.url}`;
    if (!validateTwilioSignature(req, TWILIO_AUTH_TOKEN, fullUrl)) {
      console.error('[nova-ai:sms-webhook] Invalid Twilio signature');
      return res.status(403).send('Invalid signature');
    }
  }

  const from = req.body?.From || '';
  const to = req.body?.To || '';
  const body = sanitize(req.body?.Body, 1600);

  res.setHeader('Content-Type', 'text/xml');
  if (!from || !to || !body) return res.status(200).send(twiml(''));

  const agent = await findAgentByNumber(to);
  if (!agent) return res.status(200).send(twiml(''));

  await logSms({ agentId: agent.id, contactPhone: from, direction: 'inbound', message: body });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(200).send(twiml(''));

  try {
    const kb = await findKnowledgeBase(agent.id);
    const systemPrompt = buildSystemPrompt(agent, kb) + '\n\nYou are texting, not calling. Keep replies to 1-2 short sentences, SMS style.';

    // Last few messages with this contact, oldest first, for conversation context.
    const histRes = await supabaseFetch(`nova_ai_sms_logs?agent_id=eq.${encodeURIComponent(agent.id)}&contact_phone=eq.${encodeURIComponent(from)}&order=created_at.desc&limit=10`);
    const histRows = histRes.ok ? (await histRes.json()).reverse() : [];
    const history = histRows.slice(0, -1).map((m) => ({ role: m.direction === 'inbound' ? 'user' : 'assistant', content: m.message }));

    const replyText = await getClaudeReply({ anthropicApiKey: ANTHROPIC_API_KEY, systemPrompt, history, userText: body });

    if (TWILIO_AUTH_TOKEN && TWILIO_ACCOUNT_SID && replyText) {
      await twilioRequest(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, 'POST', 'Messages.json', {
        To: from, From: to, Body: replyText,
      });
      await logSms({ agentId: agent.id, contactPhone: from, direction: 'outbound', message: replyText });
    }
  } catch (err) {
    console.error('[nova-ai:sms-webhook] Error:', err.message);
  }

  return res.status(200).send(twiml(''));
}

// -------------------------------------------------------------------- send-sms
async function handleSendSms(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = await getNovaAIConfig();
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return res.status(500).json({ error: 'Twilio is not configured' });

  const b = req.body || {};
  const to = sanitizePhone(b.to);
  const message = sanitize(b.message, 1600);
  const agentId = sanitize(b.agent_id, 100);
  if (!to || !message) return res.status(400).json({ error: 'to and message are required' });

  let fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
  if (agentId) {
    const agent = await (await supabaseFetch(`nova_ai_agents?id=eq.${encodeURIComponent(agentId)}&select=phone_number&limit=1`)).json().catch(() => []);
    if (agent?.[0]?.phone_number) fromNumber = agent[0].phone_number;
  }
  if (!fromNumber) return res.status(400).json({ error: 'No sending number available' });

  try {
    await twilioRequest(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, 'POST', 'Messages.json', { To: to, From: fromNumber, Body: message });
    await logSms({ agentId: agentId || null, contactPhone: to, direction: 'outbound', message });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[nova-ai:send-sms] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to send SMS' });
  }
}

// --------------------------------------------------------------- call-completed
async function handleCallCompleted(req, res) {
  const { TWILIO_AUTH_TOKEN } = await getNovaAIConfig();
  if (TWILIO_AUTH_TOKEN) {
    const fullUrl = `https://${req.headers.host}${req.url}`;
    if (!validateTwilioSignature(req, TWILIO_AUTH_TOKEN, fullUrl)) {
      console.error('[nova-ai:call-completed] Invalid Twilio signature');
      return res.status(403).send('Invalid signature');
    }
  }

  const to = req.body?.To || '';
  const from = req.body?.From || '';
  const duration = Number(req.body?.CallDuration) || 0;
  const recordingUrl = req.body?.RecordingUrl || null;
  const callStatus = req.body?.CallStatus || '';

  const outcome = callStatus === 'no-answer' || callStatus === 'busy' || callStatus === 'failed' ? 'unknown' : 'hangup';

  try {
    const agent = await findAgentByNumber(to);
    if (agent) {
      await supabaseFetch('nova_ai_calls', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          agent_id: agent.id, caller_phone: from, duration,
          recording_url: recordingUrl, outcome, booked: false,
        }),
      });
      await supabaseFetch(`nova_ai_agents?id=eq.${encodeURIComponent(agent.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ calls_total: (agent.calls_total || 0) + 1 }),
      });
    }
  } catch (err) {
    console.error('[nova-ai:call-completed] Error:', err.message);
  }

  return res.status(200).send('OK');
}

// ----------------------------------------------------------- get-twilio-numbers
async function handleGetTwilioNumbers(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = await getNovaAIConfig();
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return res.status(500).json({ error: 'Twilio is not configured' });

  try {
    const results = await Promise.all(CT_AREA_CODES.map(async (areaCode) => {
      try {
        const data = await twilioRequest(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, 'GET', `AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode}&Limit=5`);
        return (data.available_phone_numbers || []).map((n) => ({
          phone_number: n.phone_number, friendly_name: n.friendly_name,
          locality: n.locality, region: n.region,
        }));
      } catch (err) {
        console.error(`[nova-ai:get-twilio-numbers] Area code ${areaCode} failed:`, err.message);
        return [];
      }
    }));
    return res.status(200).json(results.flat());
  } catch (err) {
    console.error('[nova-ai:get-twilio-numbers] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch available numbers' });
  }
}

// ------------------------------------------------------------- provision-number
async function handleProvisionNumber(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = await getNovaAIConfig();
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return res.status(500).json({ error: 'Twilio is not configured' });

  const b = req.body || {};
  const phoneNumber = sanitizePhone(b.phone_number);
  const agentId = sanitize(b.agent_id, 100);
  if (!phoneNumber || !agentId) return res.status(400).json({ error: 'phone_number and agent_id are required' });

  const origin = req.headers.origin || `https://${req.headers.host}`;

  try {
    const purchased = await twilioRequest(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, 'POST', 'IncomingPhoneNumbers.json', {
      PhoneNumber: phoneNumber,
      VoiceUrl: `${origin}/api/nova-ai/incoming-call`,
      VoiceMethod: 'POST',
      SmsUrl: `${origin}/api/nova-ai?action=sms-webhook`,
      SmsMethod: 'POST',
      StatusCallback: `${origin}/api/nova-ai?action=call-completed`,
      StatusCallbackMethod: 'POST',
    });

    await supabaseFetch(`nova_ai_agents?id=eq.${encodeURIComponent(agentId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ phone_number: purchased.phone_number, twilio_number_sid: purchased.sid }),
    });

    return res.status(200).json({ ok: true, phone_number: purchased.phone_number, sid: purchased.sid });
  } catch (err) {
    console.error('[nova-ai:provision-number] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to provision number' });
  }
}

// ------------------------------------------------------------- get-voice-preview
async function handleGetVoicePreview(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;

  const { ELEVENLABS_API_KEY } = await getNovaAIConfig();
  if (!ELEVENLABS_API_KEY) return res.status(500).json({ error: 'ElevenLabs is not configured' });

  const b = req.body || {};
  const voiceId = sanitize(b.voice_id, 100);
  const sampleText = sanitize(b.sample_text, 500) || "Hi! Thanks for calling — how can I help you today?";
  if (!voiceId) return res.status(400).json({ error: 'voice_id is required' });

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: sampleText, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!r.ok) { console.error('[nova-ai:get-voice-preview] ElevenLabs error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to generate voice preview' }); }
    const buf = Buffer.from(await r.arrayBuffer());
    return res.status(200).json({ audio_base64: buf.toString('base64'), mime_type: 'audio/mpeg' });
  } catch (err) {
    console.error('[nova-ai:get-voice-preview] Error:', err.message);
    return res.status(500).json({ error: 'Failed to generate voice preview' });
  }
}

// -------------------------------------------------------------------- agents
async function handleAgents(req, res) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const id = sanitize(req.query?.id, 100);

    if (id) {
      const r = await supabaseFetch(`nova_ai_agents?id=eq.${encodeURIComponent(id)}&limit=1`);
      const rows = r.ok ? await r.json() : [];
      return res.status(200).json(rows[0] || null);
    }

    const r = await supabaseFetch('nova_ai_agents?order=created_at.desc');
    const agents = r.ok ? await r.json() : [];

    // Merge in "this month" counts from nova_ai_calls / bookings.
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    try {
      const callsRes = await supabaseFetch(`nova_ai_calls?created_at=gte.${monthStart.toISOString()}&select=agent_id,booked`);
      const calls = callsRes.ok ? await callsRes.json() : [];
      const callsByAgent = {};
      const bookingsByAgent = {};
      for (const c of calls) {
        callsByAgent[c.agent_id] = (callsByAgent[c.agent_id] || 0) + 1;
        if (c.booked) bookingsByAgent[c.agent_id] = (bookingsByAgent[c.agent_id] || 0) + 1;
      }
      for (const a of agents) {
        a.calls_this_month = callsByAgent[a.id] || 0;
        a.bookings_this_month = bookingsByAgent[a.id] || 0;
      }
    } catch (err) {
      console.error('[nova-ai:agents] Monthly stats error (non-fatal):', err.message);
    }

    return res.status(200).json(agents);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;

  const b = req.body || {};
  const action = sanitize(b.action, 20);

  if (action === 'create') {
    const record = {
      client_id: sanitize(b.client_id, 100) || null,
      agent_name: sanitize(b.agent_name, 100) || 'Nova',
      business_name: sanitize(b.business_name, 200),
      status: 'testing',
    };
    if (!record.business_name) return res.status(400).json({ error: 'business_name is required' });
    try {
      const r = await supabaseFetch('nova_ai_agents', {
        method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(record),
      });
      if (!r.ok) { console.error('[nova-ai:agents] Create error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to create agent' }); }
      const rows = await r.json();
      return res.status(200).json({ ok: true, agent: rows[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Failed to create agent' });
    }
  }

  if (action === 'update') {
    const id = sanitize(b.id, 100);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const patch = {};
    for (const field of ['agent_name', 'business_name', 'phone_number', 'voice_id', 'voice_name', 'status', 'client_id']) {
      if (field in b) patch[field] = typeof b[field] === 'string' ? sanitize(b[field], 200) : b[field];
    }
    try {
      const r = await supabaseFetch(`nova_ai_agents?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch),
      });
      if (!r.ok) { console.error('[nova-ai:agents] Update error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to update agent' }); }
      const rows = await r.json();
      return res.status(200).json({ ok: true, agent: rows[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Failed to update agent' });
    }
  }

  if (action === 'delete') {
    const id = sanitize(b.id, 100);
    if (!id) return res.status(400).json({ error: 'id is required' });
    try {
      await supabaseFetch(`nova_ai_knowledge_bases?agent_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      await supabaseFetch(`nova_ai_calls?agent_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      await supabaseFetch(`nova_ai_sms_logs?agent_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      await supabaseFetch(`nova_ai_agents?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Failed to delete agent' });
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// ---------------------------------------------------------------- agent-detail
async function handleAgentDetail(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const id = sanitize(req.query?.id, 100);
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    const [agentRes, kbRes, callsRes] = await Promise.all([
      supabaseFetch(`nova_ai_agents?id=eq.${encodeURIComponent(id)}&limit=1`),
      supabaseFetch(`nova_ai_knowledge_bases?agent_id=eq.${encodeURIComponent(id)}&limit=1`),
      supabaseFetch(`nova_ai_calls?agent_id=eq.${encodeURIComponent(id)}&order=created_at.desc&select=duration,outcome,booked,created_at`),
    ]);

    const agent = agentRes.ok ? (await agentRes.json())[0] || null : null;
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const knowledgeBase = kbRes.ok ? (await kbRes.json())[0] || null : null;
    const calls = callsRes.ok ? await callsRes.json() : [];

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const callsToday = calls.filter((c) => new Date(c.created_at) >= today);
    const totalBookings = calls.filter((c) => c.booked).length;
    const totalDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0);

    const stats = {
      total_calls: calls.length,
      total_bookings: totalBookings,
      conversion_rate: calls.length ? Math.round((totalBookings / calls.length) * 100) : 0,
      avg_duration: calls.length ? Math.round(totalDuration / calls.length) : 0,
      calls_today: callsToday.length,
      bookings_today: callsToday.filter((c) => c.booked).length,
    };

    // Calls per day for the last 30 days.
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      days.push(d);
    }
    const callsPerDay = days.map((d) => {
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const count = calls.filter((c) => { const t = new Date(c.created_at); return t >= d && t < next; }).length;
      return { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), calls: count };
    });

    return res.status(200).json({ agent, knowledge_base: knowledgeBase, stats, calls_per_day: callsPerDay });
  } catch (err) {
    console.error('[nova-ai:agent-detail] Error:', err.message);
    return res.status(500).json({ error: 'Failed to load agent detail' });
  }
}

// --------------------------------------------------------------- knowledge-base
async function handleKnowledgeBase(req, res) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const agentId = sanitize(req.query?.agent_id, 100);
    if (!agentId) return res.status(400).json({ error: 'agent_id is required' });
    const r = await supabaseFetch(`nova_ai_knowledge_bases?agent_id=eq.${encodeURIComponent(agentId)}&limit=1`);
    const rows = r.ok ? await r.json() : [];
    return res.status(200).json(rows[0] || null);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;

  const b = req.body || {};
  const action = sanitize(b.action, 20);
  if (action !== 'save') return res.status(400).json({ error: `Unknown action: ${action}` });

  const agentId = sanitize(b.agent_id, 100);
  if (!agentId) return res.status(400).json({ error: 'agent_id is required' });

  const record = {
    agent_id: agentId,
    client_id: sanitize(b.client_id, 100) || null,
    business_name: sanitize(b.business_name, 200),
    business_description: sanitize(b.business_description, 5000),
    services: sanitize(b.services, 5000),
    hours: sanitize(b.hours, 300),
    address: sanitize(b.address, 300),
    booking_process: sanitize(b.booking_process, 2000),
    faqs: Array.isArray(b.faqs) ? b.faqs.slice(0, 10).map((f) => ({ q: sanitize(f?.q, 300), a: sanitize(f?.a, 1000) })) : [],
    never_say: sanitize(b.never_say, 2000),
    always_say: sanitize(b.always_say, 2000),
    escalation: sanitize(b.escalation, 500),
    personality: sanitize(b.personality, 1000),
    updated_at: new Date().toISOString(),
  };

  try {
    const existingRes = await supabaseFetch(`nova_ai_knowledge_bases?agent_id=eq.${encodeURIComponent(agentId)}&select=id&limit=1`);
    const existing = existingRes.ok ? (await existingRes.json())[0] : null;

    const url = existing ? `nova_ai_knowledge_bases?id=eq.${existing.id}` : 'nova_ai_knowledge_bases';
    const r = await supabaseFetch(url, {
      method: existing ? 'PATCH' : 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(record),
    });
    if (!r.ok) { console.error('[nova-ai:knowledge-base] Save error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to save knowledge base' }); }
    const rows = await r.json();
    const kb = rows[0];

    if (!existing) {
      await supabaseFetch(`nova_ai_agents?id=eq.${encodeURIComponent(agentId)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ knowledge_base_id: kb.id }),
      });
    }

    return res.status(200).json({ ok: true, knowledge_base: kb });
  } catch (err) {
    console.error('[nova-ai:knowledge-base] Error:', err.message);
    return res.status(500).json({ error: 'Failed to save knowledge base' });
  }
}

// -------------------------------------------------------------------- voices
async function handleVoices(req, res) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const r = await supabaseFetch('nova_ai_voices?order=created_at.asc');
    return res.status(200).json(r.ok ? await r.json() : []);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;

  const b = req.body || {};
  const action = sanitize(b.action, 20);
  if (action !== 'create') return res.status(400).json({ error: `Unknown action: ${action}` });

  const voiceName = sanitize(b.voice_name, 100);
  const elevenlabsVoiceId = sanitize(b.elevenlabs_voice_id, 100);
  if (!voiceName || !elevenlabsVoiceId) return res.status(400).json({ error: 'voice_name and elevenlabs_voice_id are required' });

  const record = {
    voice_name: voiceName,
    elevenlabs_voice_id: elevenlabsVoiceId,
    industry: sanitize(b.industry, 100) || null,
    language: sanitize(b.language, 20) || 'en-es',
    description: sanitize(b.description, 500) || null,
  };

  try {
    const r = await supabaseFetch('nova_ai_voices', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(record) });
    if (!r.ok) { console.error('[nova-ai:voices] Create error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to add voice — name may already be in use' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, voice: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to add voice' });
  }
}

// ------------------------------------------------------------------- settings
async function handleSettings(req, res) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const r = await supabaseFetch('nova_ai_settings?select=key,value');
    const rows = r.ok ? await r.json() : [];
    const map = {};
    for (const key of SETTINGS_KEYS) map[key] = '';
    for (const row of rows) map[row.key] = row.value;
    return res.status(200).json(map);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;

  const b = req.body || {};
  const updates = SETTINGS_KEYS.filter((k) => k in b).map((k) => ({ key: k, value: sanitize(b[k], 500), updated_at: new Date().toISOString() }));
  if (!updates.length) return res.status(400).json({ error: 'No recognized settings keys provided' });

  try {
    const r = await supabaseFetch('nova_ai_settings', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(updates),
    });
    if (!r.ok) { console.error('[nova-ai:settings] Save error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to save settings' }); }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to save settings' });
  }
}

// ------------------------------------------------------------------ call-logs
async function handleCallLogs(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const agentId = sanitize(req.query?.agent_id, 100);
  const outcome = sanitize(req.query?.outcome, 30);
  const from = sanitize(req.query?.from, 30);
  const to = sanitize(req.query?.to, 30);

  let qs = 'select=*,nova_ai_agents(agent_name,business_name)&order=created_at.desc&limit=200';
  if (agentId) qs += `&agent_id=eq.${encodeURIComponent(agentId)}`;
  if (outcome) qs += `&outcome=eq.${encodeURIComponent(outcome)}`;
  if (from) qs += `&created_at=gte.${encodeURIComponent(from)}`;
  if (to) qs += `&created_at=lte.${encodeURIComponent(to)}`;

  const r = await supabaseFetch(`nova_ai_calls?${qs}`);
  if (!r.ok) { console.error('[nova-ai:call-logs] Error:', r.status, await r.text()); return res.status(200).json([]); }
  return res.status(200).json(await r.json());
}

// ------------------------------------------------------------------- sms-logs
async function handleSmsLogs(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const agentId = sanitize(req.query?.agent_id, 100);
  const contactPhone = sanitize(req.query?.contact_phone, 30);

  if (agentId && contactPhone) {
    const r = await supabaseFetch(`nova_ai_sms_logs?agent_id=eq.${encodeURIComponent(agentId)}&contact_phone=eq.${encodeURIComponent(contactPhone)}&order=created_at.asc`);
    return res.status(200).json(r.ok ? await r.json() : []);
  }

  let qs = 'select=*,nova_ai_agents(agent_name,business_name)&order=created_at.desc&limit=500';
  if (agentId) qs += `&agent_id=eq.${encodeURIComponent(agentId)}`;
  const r = await supabaseFetch(`nova_ai_sms_logs?${qs}`);
  const rows = r.ok ? await r.json() : [];

  const threads = {};
  for (const row of rows) {
    const key = `${row.agent_id}::${row.contact_phone}`;
    if (!threads[key]) {
      threads[key] = {
        agent_id: row.agent_id, contact_phone: row.contact_phone,
        agent_name: row.nova_ai_agents?.agent_name, business_name: row.nova_ai_agents?.business_name,
        sent: 0, received: 0, last_message_at: row.created_at,
      };
    }
    if (row.direction === 'outbound') threads[key].sent++;
    else threads[key].received++;
    if (new Date(row.created_at) > new Date(threads[key].last_message_at)) threads[key].last_message_at = row.created_at;
  }

  return res.status(200).json(Object.values(threads).sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)));
}

export default async function handler(req, res) {
  const action = typeof req.query?.action === 'string' ? req.query.action : '';

  // Twilio webhooks post form-encoded bodies and don't care about CORS.
  if (action !== 'sms-webhook' && action !== 'call-completed') {
    if (setCors(req, res)) return;
  }

  switch (action) {
    case 'sms-webhook':          return handleSmsWebhook(req, res);
    case 'send-sms':             return handleSendSms(req, res);
    case 'call-completed':       return handleCallCompleted(req, res);
    case 'get-twilio-numbers':   return handleGetTwilioNumbers(req, res);
    case 'provision-number':     return handleProvisionNumber(req, res);
    case 'get-voice-preview':    return handleGetVoicePreview(req, res);
    case 'agents':                return handleAgents(req, res);
    case 'agent-detail':           return handleAgentDetail(req, res);
    case 'knowledge-base':          return handleKnowledgeBase(req, res);
    case 'voices':                    return handleVoices(req, res);
    case 'settings':                   return handleSettings(req, res);
    case 'call-logs':                   return handleCallLogs(req, res);
    case 'sms-logs':                     return handleSmsLogs(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
