import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { requireStaff } from './_auth.js';

// Integration Center backend — reports connection status for every external provider this
// codebase actually touches, without ever returning a credential value. Two operations:
//   ?op=status              GET  — fast, local-only: which env vars are present, no network calls
//   ?op=test&provider=<key> POST — live check against that ONE provider's own API (on demand only,
//                                   never automatic, so this can't be used to hammer a provider or
//                                   burn quota just by loading the page)
// Admin-only (admin.view) — this can confirm whether a credential still works, which is itself
// sensitive operational information.

const PROVIDERS = {
  supabase: {
    label: 'Supabase',
    purpose: 'Database, auth, and storage for the entire platform.',
    envVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    breaksIfMissing: 'Everything — every dashboard resource, auth, and RLS-scoped query depends on this.',
    test: async (env) => {
      const url = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) return { ok: false, detail: 'Not configured' };
      const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      return { ok: r.ok, detail: r.ok ? 'Connected — schema reachable' : `Provider returned ${r.status}` };
    },
  },
  stripe: {
    label: 'Stripe',
    purpose: 'Invoice checkout sessions and payment webhooks.',
    envVars: ['STRIPE_SECRET_KEY', 'VITE_STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
    breaksIfMissing: 'Invoice "Pay Now" links stop working; webhook events are rejected outright (fails closed, not silently).',
    test: async (env) => {
      const key = env.STRIPE_SECRET_KEY;
      if (!key) return { ok: false, detail: 'Not configured' };
      const r = await fetch('https://api.stripe.com/v1/account', { headers: { Authorization: `Bearer ${key}` } });
      if (r.ok) return { ok: true, detail: 'Connected — account reachable' };
      const body = await r.json().catch(() => ({}));
      return { ok: false, detail: `Provider rejected key — ${body?.error?.code || r.status}` };
    },
  },
  resend: {
    label: 'Resend',
    purpose: 'Lead confirmation, invoice, and payment-received emails.',
    envVars: ['RESEND_API_KEY'],
    breaksIfMissing: 'All outbound email — lead confirmations, invoice emails, contact form replies — is skipped (each caller checks for this and fails safe, not silently).',
    test: async (env) => {
      const key = env.RESEND_API_KEY;
      if (!key) return { ok: false, detail: 'Not configured' };
      const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` } });
      return { ok: r.ok, detail: r.ok ? 'Connected — API key accepted' : `Provider returned ${r.status}` };
    },
  },
  anthropic: {
    label: 'Anthropic',
    purpose: 'Server-side document generation (proposals, contracts, SOWs).',
    envVars: ['ANTHROPIC_API_KEY'],
    breaksIfMissing: 'The Documents tool returns a clear "not configured" error instead of generating text.',
    test: async (env) => {
      const key = env.ANTHROPIC_API_KEY;
      if (!key) return { ok: false, detail: 'Not configured' };
      const r = await fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } });
      return { ok: r.ok, detail: r.ok ? 'Connected — API key accepted' : `Provider returned ${r.status}` };
    },
  },
  twilio: {
    label: 'Twilio',
    purpose: 'SMS alert to Isaac when a new /welcome lead comes in.',
    envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
    breaksIfMissing: 'No SMS alert fires; the lead is still saved — this is a non-blocking notification only.',
    test: async (env) => {
      const sid = env.TWILIO_ACCOUNT_SID, token = env.TWILIO_AUTH_TOKEN;
      if (!sid || !token) return { ok: false, detail: 'Not configured' };
      const auth = Buffer.from(`${sid}:${token}`).toString('base64');
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, { headers: { Authorization: `Basic ${auth}` } });
      return { ok: r.ok, detail: r.ok ? 'Connected — account reachable' : `Provider returned ${r.status}` };
    },
  },
  google: {
    label: 'Google (Maps/Geocoding)',
    purpose: 'Not currently used by any feature in this codebase.',
    envVars: ['GOOGLE_API_KEY'],
    breaksIfMissing: 'Nothing — unused today.',
    test: async (env) => {
      const key = env.GOOGLE_API_KEY;
      if (!key) return { ok: false, detail: 'Not configured' };
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${key}`);
      const data = await r.json().catch(() => ({}));
      const ok = data.status && data.status !== 'REQUEST_DENIED' && data.status !== 'INVALID_REQUEST';
      return { ok, detail: ok ? 'Connected — key accepted' : `Provider status: ${data.status || r.status}` };
    },
  },
  elevenlabs: {
    label: 'ElevenLabs',
    purpose: 'Reserved for the not-yet-built voice-agent feature.',
    envVars: ['ELEVENLABS_API_KEY'],
    breaksIfMissing: 'Nothing — no code path calls this yet.',
    test: async (env) => {
      const key = env.ELEVENLABS_API_KEY;
      if (!key) return { ok: false, detail: 'Not configured' };
      const r = await fetch('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': key } });
      return { ok: r.ok, detail: r.ok ? 'Connected — key accepted' : `Provider returned ${r.status}` };
    },
  },
  deepgram: {
    label: 'Deepgram',
    purpose: 'Reserved for the not-yet-built voice-agent feature.',
    envVars: ['DEEPGRAM_API_KEY'],
    breaksIfMissing: 'Nothing — no code path calls this yet.',
    test: async (env) => {
      const key = env.DEEPGRAM_API_KEY;
      if (!key) return { ok: false, detail: 'Not configured' };
      const r = await fetch('https://api.deepgram.com/v1/projects', { headers: { Authorization: `Token ${key}` } });
      return { ok: r.ok, detail: r.ok ? 'Connected — key accepted' : `Provider returned ${r.status}` };
    },
  },
};

function statusRow(key, def) {
  const env = process.env;
  const configured = def.envVars.every((v) => !!env[v]);
  return {
    key,
    label: def.label,
    purpose: def.purpose,
    breaksIfMissing: def.breaksIfMissing,
    envVars: def.envVars.map((v) => ({ name: v, set: !!env[v] })),
    // Presence-only status — "connected" here means configured, not verified live. Use ?op=test
    // for a real check. Never conflate the two: this is intentionally the cheap, always-safe read.
    status: configured ? 'connected' : 'not_connected',
  };
}

async function handleStatus(req, res) {
  if (!rateLimit(req, res, 30, 60_000)) return;
  const rows = Object.entries(PROVIDERS).map(([key, def]) => statusRow(key, def));
  return res.status(200).json({ providers: rows });
}

async function handleTest(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const providerKey = typeof req.query?.provider === 'string' ? req.query.provider : '';
  const def = PROVIDERS[providerKey];
  if (!def) return res.status(400).json({ error: `Unknown provider: ${providerKey}` });

  try {
    const result = await def.test(process.env);
    return res.status(200).json({
      key: providerKey,
      status: result.ok ? 'tested' : (statusRow(providerKey, def).status === 'connected' ? 'degraded' : 'not_connected'),
      detail: result.detail,
      tested_at: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(200).json({
      key: providerKey,
      status: 'degraded',
      detail: `Request failed: ${err.message}`,
      tested_at: new Date().toISOString(),
    });
  }
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (!(await requireStaff(req, res, 'admin.view'))) return;

  const op = typeof req.query?.op === 'string' ? req.query.op : 'status';
  if (op === 'status') return handleStatus(req, res);
  if (op === 'test') return handleTest(req, res);
  return res.status(400).json({ error: `Unknown op: ${op}` });
}
