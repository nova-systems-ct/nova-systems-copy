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
//
// Status values: not_connected | disconnected | connected | tested | degraded |
// authorization_required. `disconnected` is `not_connected` PLUS a known `resetNote` — every
// provider currently mid credential-reset (2026-09-20) carries one, so the UI can say *why* it's
// unconfigured (deliberately cleared pending rotation vs. a key that was found already dead vs.
// simply never set up) instead of leaving "Not Connected" ambiguous between those very different
// situations. `authorization_required` is reserved for a future OAuth-style integration — none of
// the 8 providers here use OAuth today (every one is a single long-lived key/token pair, confirmed
// in docs/credential-rotation-plan.md), so nothing currently returns it, but the frontend already
// knows how to render it so a future integration doesn't need a UI change to use it.

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
    resetNote: 'Secret key cleared 2026-09-20 — found already expired (live-mode) before the reset. Webhook secret was never set. Both need fresh values as part of the credential reset; see docs/credential-rotation-plan.md.',
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
    resetNote: 'Cleared 2026-09-20 — found already invalid before the reset. Needs a fresh key as part of the credential reset; see docs/credential-rotation-plan.md.',
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
    resetNote: 'Never set in this environment — not a reset action, just never configured. Whether it was ever set in Vercel production historically is still an open question; see docs/credential-rotation-plan.md.',
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
    resetNote: 'Account SID + Auth Token cleared 2026-09-20 — these were exposed in this session\'s own chat transcript and still need provider-side revocation in the Twilio Console (clearing the local value alone does not revoke it). See the URGENT section of docs/credential-rotation-plan.md.',
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
    resetNote: 'Cleared 2026-09-20 — exposed in this session\'s own chat transcript and still needs provider-side revocation in Google Cloud Console (clearing the local value alone does not revoke it). Unused in code, so safe to delete outright rather than rotate. See the URGENT section of docs/credential-rotation-plan.md.',
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
    resetNote: 'Cleared 2026-09-20 — exposed in this session\'s own chat transcript and still needs provider-side revocation in the ElevenLabs dashboard. Guards a feature that isn\'t built yet, so no urgency to replace, only to revoke. See the URGENT section of docs/credential-rotation-plan.md.',
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
    resetNote: 'Cleared 2026-09-20 — exposed in this session\'s own chat transcript and still needs provider-side revocation in the Deepgram Console. Guards a feature that isn\'t built yet, so no urgency to replace, only to revoke. See the URGENT section of docs/credential-rotation-plan.md.',
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
  // A resetNote means this specific credential's missing-ness is a known, explained fact (cleared
  // during the 2026-09-20 credential reset, or found already dead) rather than "just never set
  // up" — surfaced as `disconnected` instead of the more ambiguous `not_connected` so the UI can
  // show why, not just that.
  const status = configured ? 'connected' : (def.resetNote ? 'disconnected' : 'not_connected');
  return {
    key,
    label: def.label,
    purpose: def.purpose,
    breaksIfMissing: def.breaksIfMissing,
    resetNote: !configured ? (def.resetNote || null) : null,
    envVars: def.envVars.map((v) => ({ name: v, set: !!env[v] })),
    // Presence-only status — "connected" here means configured, not verified live. Use ?op=test
    // for a real check. Never conflate the two: this is intentionally the cheap, always-safe read.
    status,
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
    const baseline = statusRow(providerKey, def).status;
    return res.status(200).json({
      key: providerKey,
      status: result.ok ? 'tested' : (baseline === 'connected' ? 'degraded' : baseline),
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
