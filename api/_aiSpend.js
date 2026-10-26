// Nova application AI spending guard (repair brief §3). Every optional paid model call goes through
// guardedModelCall(). Order of checks, any failure = the call is NOT dispatched and the caller gets an actionable reason:
//   1. NOVA_AI_PAID_CALLS must be exactly 'enabled' (off by default; local development and tests leave it off).
//   2. The provider key must be configured.
//   3. The model must have a configured price (NOVA_AI_PRICES JSON). Unknown price blocks; it never counts as zero.
//   4. An atomic database reservation (ai_spend_reserve) against the owner-approved limit for that purpose.
// Then: one bounded call (timeout, output cap, at most one retry on 429/5xx under the same reservation), and settlement
// with provider-reported tokens when present. Prompts and customer text are never logged or stored.
//
// NOVA_AI_PRICES example (USD per million tokens; take the numbers from the provider's current price page):
//   {"claude-haiku-4-5-20251001":{"input_per_mtok":1,"output_per_mtok":5,"version":"2026-10-26"}}
import crypto from 'node:crypto';
import { dbRpc } from './_sales/core.js';

const env = () => process.env;

export const BLOCK_MESSAGES = {
  paid_calls_disabled: 'AI drafting is turned off on this server (NOVA_AI_PAID_CALLS is not enabled). Nothing was sent to a paid provider.',
  provider_key_missing: 'No AI provider key is configured on this server.',
  price_unknown: 'This model has no approved price on this server, so its cost cannot be bounded. Add it to NOVA_AI_PRICES.',
  no_approved_budget: 'No approved AI budget exists for this task. The owner must approve a limit (ai_spend_limits) first.',
  budget_exhausted: 'The approved AI budget for this task is used up for the current period.',
  too_many_concurrent: 'Too many AI requests of this kind are running. Try again in a minute.',
  guard_unavailable: 'The spending guard could not be reached, so the AI request was not sent.',
};

export function priceFor(model, e = env()) {
  try {
    const table = JSON.parse(e.NOVA_AI_PRICES || '{}');
    const p = table[model];
    if (p && Number(p.input_per_mtok) > 0 && Number(p.output_per_mtok) > 0) return { in: Number(p.input_per_mtok), out: Number(p.output_per_mtok), version: String(p.version || 'unversioned') };
  } catch { /* malformed table = unknown price */ }
  return null;
}

// Conservative estimate: ~3 characters per input token (real text averages closer to 4) plus the full output cap.
export function estimateUsd(price, body) {
  const inputChars = JSON.stringify({ s: body.system, m: body.messages, t: body.tools }).length;
  const inTok = Math.ceil(inputChars / 3) + 50;
  const outTok = Number(body.max_tokens) || 1024;
  return Number(((inTok * price.in + outTok * price.out) / 1e6).toFixed(6));
}
export const actualUsd = (price, usage) => Number((((usage.input_tokens || 0) * price.in + (usage.output_tokens || 0) * price.out) / 1e6).toFixed(6));

const blocked = (reason, extra = {}) => ({ ok: false, blocked: true, reason, message: BLOCK_MESSAGES[reason] || reason, ...extra });

export async function guardedModelCall({ purpose, organizationId = null, body, requestId, timeoutMs = 30_000, fetchImpl, rpcImpl }) {
  const e = env(); const rpc = rpcImpl || dbRpc;
  if (e.NOVA_AI_PAID_CALLS !== 'enabled') return blocked('paid_calls_disabled');
  if (!e.ANTHROPIC_API_KEY) return blocked('provider_key_missing');
  const price = priceFor(body.model, e);
  if (!price) return blocked('price_unknown');
  const reqId = requestId || `${purpose}:${crypto.randomUUID()}`;
  let reservation;
  try {
    reservation = await rpc('ai_spend_reserve', { p_request_id: reqId, p_organization_id: organizationId, p_purpose: purpose, p_provider: 'anthropic', p_model: body.model, p_pricing_version: price.version, p_reserve_usd: estimateUsd(price, body) });
  } catch { return blocked('guard_unavailable'); }
  if (!reservation?.ok) return blocked(reservation?.reason || 'guard_unavailable', { spendEventId: reservation?.id });

  const started = Date.now(); let attempt = 0; let result = null; let status = 'failed'; let outcome = 'error';
  while (attempt < 2) {
    attempt++;
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await (fetchImpl || fetch)('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctrl.signal, headers: { 'x-api-key': e.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => null);
      if (r.ok && j) { result = j; status = 'settled'; outcome = 'ok'; break; }
      outcome = `http_${r.status}`;
      if (!(r.status === 429 || r.status >= 500)) break; // only transient errors get the single retry
    } catch (err) { outcome = err?.name === 'AbortError' ? 'timeout' : 'network_error'; }
    finally { clearTimeout(timer); }
  }
  const usage = result?.usage;
  const basis = usage && (usage.input_tokens != null || usage.output_tokens != null) ? 'reported' : 'unknown';
  try {
    await rpc('ai_spend_settle', { p_id: reservation.id, p_status: status, p_input_tokens: usage?.input_tokens ?? null, p_output_tokens: usage?.output_tokens ?? null, p_actual_usd: basis === 'reported' ? actualUsd(price, usage) : null, p_usage_basis: basis, p_latency_ms: Date.now() - started, p_outcome: outcome });
  } catch { /* the open reservation keeps counting at full estimate, which is the conservative side */ }
  if (!result) return { ok: false, blocked: false, reason: outcome, message: 'The AI provider did not return a result.', spendEventId: reservation.id };
  return { ok: true, data: result, spendEventId: reservation.id, usageBasis: basis };
}
