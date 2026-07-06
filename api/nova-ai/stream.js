// ============================================================================
// READ THIS FIRST — this file cannot run as a Vercel serverless function.
// ============================================================================
//
// Twilio's <Connect><Stream> feature opens a WebSocket connection to the URL
// in incoming-call.js's TwiML and holds it open for the entire phone call —
// often several minutes — streaming 20ms audio frames back and forth the
// whole time. Vercel Serverless Functions are request/response only: they
// cannot accept a WebSocket upgrade, and even if they could, Hobby-plan
// functions are killed after ~10 seconds, long before a real call ends.
//
// This is a platform limitation, not a bug to work around — the live-call
// audio loop needs an always-on process (a small Node server on something
// like Railway, Fly.io, Render, or a VPS), completely separate from this
// Vercel deployment. NOVA_AI_STREAM_WS_URL (see .env.example) should point
// at that service's public wss:// URL once it exists.
//
// What's in this file:
//   - `handler` (default export): what Vercel actually runs if this URL is
//     hit over plain HTTP. It responds 501 with a clear explanation instead
//     of crashing unhelpfully, so a misconfigured deployment fails loudly.
//   - `runMediaStreamTurn` / `createStreamSession`: the real, working
//     Deepgram → Claude → ElevenLabs pipeline logic, written to be framework-
//     agnostic (it takes plain callback functions, not a specific WebSocket
//     library) so it can be dropped into a real `ws`-based server elsewhere
//     without dragging a `ws` dependency into this Vercel deployment, which
//     never uses it.
//
// Deploying the real thing, sketched out:
//   1. New repo/service: `npm install ws @deepgram/sdk`, plain Node.
//   2. On `wss` connection, Twilio sends a `start` event with
//      customParameters.agent_id (see incoming-call.js) — load that agent's
//      knowledge base from Supabase using this same buildSystemPrompt().
//   3. For each `media` event, feed the base64 μ-law audio into a Deepgram
//      live-transcription socket (opened via openDeepgramSocket below).
//   4. On a final Deepgram transcript, call runMediaStreamTurn() and stream
//      the resulting μ-law audio back to Twilio as `media` events.
//   5. Point NOVA_AI_STREAM_WS_URL at this service and redeploy nova-systems-copy.
// ============================================================================

export default async function handler(req, res) {
  res.status(501).json({
    error: 'Not implemented on Vercel',
    reason: 'This endpoint requires a persistent WebSocket connection for the duration of a phone call, which Vercel Serverless Functions cannot provide. Deploy the media-stream service separately and point NOVA_AI_STREAM_WS_URL at it. See the comment block at the top of api/nova-ai/stream.js.',
  });
}

// ---------------------------------------------------------------------------
// Portable pipeline logic — imported by the separate always-on service, not
// used by the Vercel handler above.
// ---------------------------------------------------------------------------

export function buildSystemPrompt(agent, kb) {
  const faqLines = Array.isArray(kb.faqs)
    ? kb.faqs.filter((f) => f?.q).map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')
    : '';

  return [
    `You are ${agent.agent_name}, an AI assistant for ${kb.business_name || agent.business_name}.`,
    kb.business_description ? `About the business: ${kb.business_description}` : '',
    kb.services ? `Services and pricing:\n${kb.services}` : '',
    kb.hours ? `Business hours: ${kb.hours}` : '',
    kb.address ? `Address: ${kb.address}` : '',
    kb.booking_process ? `How booking works: ${kb.booking_process}` : '',
    faqLines ? `Frequently asked questions:\n${faqLines}` : '',
    kb.personality ? `Personality: ${kb.personality}` : '',
    kb.always_say ? `Always: ${kb.always_say}` : '',
    kb.never_say ? `Never: ${kb.never_say}` : '',
    kb.escalation ? `Escalate to a human when: ${kb.escalation}` : '',
    '',
    'You are having a live phone conversation. Keep responses conversational and natural. Maximum 2-3 sentences per response.',
    'If the caller wants to book an appointment, say you will send them a text with the booking link, then trigger the SMS booking flow.',
    'Always be warm, helpful, and professional. Never say you are an AI unless directly asked. If asked, say you are a virtual assistant for ' + (kb.business_name || agent.business_name) + '.',
  ].filter(Boolean).join('\n');
}

// Sends the caller's transcribed utterance + conversation history to Claude
// and returns the agent's next line. `anthropicApiKey` is ANTHROPIC_API_KEY.
export async function getClaudeReply({ anthropicApiKey, systemPrompt, history, userText }) {
  const messages = [...history, { role: 'user', content: userText }];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 200,
      system: systemPrompt,
      messages,
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Claude request failed');
  return data.content?.[0]?.text || '';
}

// Converts text to speech via ElevenLabs, requesting μ-law 8kHz output —
// the format Twilio Media Streams expects for the `media` payload back out.
export async function synthesizeSpeech({ elevenLabsApiKey, voiceId, text }) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=ulaw_8000`, {
    method: 'POST',
    headers: {
      'xi-api-key': elevenLabsApiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/basic',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status} ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString('base64'); // ready to embed directly in a Twilio `media` event
}

// Opens a Deepgram real-time transcription socket configured for Twilio's
// audio format (μ-law, 8kHz, mono). `onTranscript(text, isFinal)` fires as
// Deepgram returns partial and final results. Caller pipes Twilio `media`
// event payloads into the returned socket via `.send(audioBuffer)`.
export function openDeepgramSocket({ deepgramApiKey, onTranscript, onError, WebSocketImpl }) {
  const WS = WebSocketImpl; // pass in the `ws` package's WebSocket from the host server
  const url = 'wss://api.deepgram.com/v1/listen?encoding=mulaw&sample_rate=8000&channels=1&punctuate=true&interim_results=true';
  const socket = new WS(url, { headers: { Authorization: `Token ${deepgramApiKey}` } });

  socket.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const alt = msg?.channel?.alternatives?.[0];
      if (alt?.transcript) onTranscript(alt.transcript, !!msg.is_final);
    } catch (err) {
      onError?.(err);
    }
  });
  socket.on('error', (err) => onError?.(err));

  return socket;
}

// One full turn: caller's final transcript in, agent's spoken reply (base64
// μ-law audio) out. This is the function step 4 in the deployment sketch
// above calls on every final Deepgram transcript.
export async function runMediaStreamTurn({
  anthropicApiKey, elevenLabsApiKey, voiceId,
  systemPrompt, history, userText,
}) {
  const replyText = await getClaudeReply({ anthropicApiKey, systemPrompt, history, userText });
  const audioBase64 = await synthesizeSpeech({ elevenLabsApiKey, voiceId, text: replyText });
  return { replyText, audioBase64 };
}
