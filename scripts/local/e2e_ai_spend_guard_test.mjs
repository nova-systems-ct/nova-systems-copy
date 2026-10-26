// Spending guard (api/_aiSpend.js + supabase/ops-06) against REAL local Supabase. The provider is a stand-in fetch:
// this test never reaches api.anthropic.com and never uses a real key. It proves the guard blocks before dispatch,
// reserves atomically under concurrency, settles reported usage, retries at most once and is idempotent.
//   node scripts/local/e2e_ai_spend_guard_test.mjs
import fs from 'node:fs';

const envFile = fs.readFileSync('.env.local-staging', 'utf8');
for (const line of envFile.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2]; }
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(process.env.SUPABASE_URL || '')) { console.error('refusing: not local Supabase'); process.exit(1); }
const { guardedModelCall } = await import('../../api/_aiSpend.js');

let pass = 0; let fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `  ${extra}`}`); };
const H = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
const rest = (p, o = {}) => fetch(`${process.env.SUPABASE_URL}/rest/v1/${p}`, { ...o, headers: { ...H, ...(o.headers || {}) } });
const P = `test_guard_${Date.now()}`;
const cleanup = async () => { await rest(`ai_spend_events?purpose=like.test_guard_*`, { method: 'DELETE' }); await rest(`ai_spend_limits?purpose=like.test_guard_*`, { method: 'DELETE' }); };

let calls = 0;
const okFetch = (delay = 0) => async () => { calls++; await new Promise((r) => setTimeout(r, delay)); return new Response(JSON.stringify({ content: [{ type: 'text', text: 'hi' }], usage: { input_tokens: 100, output_tokens: 20 } }), { status: 200 }); };
const body = { model: 'test-model', max_tokens: 100, messages: [{ role: 'user', content: 'x' }] };

try {
  await cleanup();
  delete process.env.NOVA_AI_PAID_CALLS;
  calls = 0; let r = await guardedModelCall({ purpose: P, body, fetchImpl: okFetch() });
  check('paid calls are off by default and nothing is dispatched', r.blocked && r.reason === 'paid_calls_disabled' && calls === 0, JSON.stringify(r));

  process.env.NOVA_AI_PAID_CALLS = 'enabled'; process.env.ANTHROPIC_API_KEY = 'stand-in-not-a-key'; delete process.env.NOVA_AI_PRICES;
  r = await guardedModelCall({ purpose: P, body, fetchImpl: okFetch() });
  check('a model without a configured price is blocked (unknown price never counts as zero)', r.reason === 'price_unknown' && calls === 0, JSON.stringify(r));

  process.env.NOVA_AI_PRICES = JSON.stringify({ 'test-model': { input_per_mtok: 1000, output_per_mtok: 1000, version: 'test-1' } });
  r = await guardedModelCall({ purpose: P, body, fetchImpl: okFetch() });
  check('no approved budget for the purpose blocks the call', r.reason === 'no_approved_budget' && calls === 0, JSON.stringify(r));
  const blockedRows = await (await rest(`ai_spend_events?purpose=eq.${P}&status=eq.blocked&select=block_reason`)).json();
  check('the blocked attempt is recorded with its reason', blockedRows.length === 1 && blockedRows[0].block_reason === 'no_approved_budget', JSON.stringify(blockedRows));

  await rest('ai_spend_limits', { method: 'POST', body: JSON.stringify({ purpose: P, period: 'day', limit_usd: 0.0001, max_concurrent: 2, approved_by: 'test' }) });
  r = await guardedModelCall({ purpose: P, body, fetchImpl: okFetch() });
  check('a reservation larger than the remaining budget is blocked', r.reason === 'budget_exhausted' && calls === 0, JSON.stringify(r));

  await rest(`ai_spend_limits?purpose=eq.${P}`, { method: 'PATCH', body: JSON.stringify({ limit_usd: 5 }) });
  r = await guardedModelCall({ purpose: P, body, fetchImpl: okFetch() });
  const ev = (await (await rest(`ai_spend_events?id=eq.${r.spendEventId}&select=*`)).json())[0];
  check('an approved call is dispatched once and settled with provider-reported tokens', r.ok && calls === 1 && ev?.status === 'settled' && ev.input_tokens === 100 && ev.output_tokens === 20 && ev.usage_basis === 'reported' && Number(ev.actual_usd) === 0.12, JSON.stringify(ev));
  check('the reservation was conservative (estimate >= actual)', Number(ev.reserved_usd) >= Number(ev.actual_usd), `${ev.reserved_usd} < ${ev.actual_usd}`);

  calls = 0;
  const rid = `${P}:same`;
  const a = await guardedModelCall({ purpose: P, body, requestId: rid, fetchImpl: okFetch() });
  const b = await guardedModelCall({ purpose: P, body, requestId: rid, fetchImpl: okFetch() });
  check('a repeated request id is not dispatched or reserved twice', a.ok && !b.ok && calls === 1, JSON.stringify(b));

  calls = 0; let n = 0;
  const flaky = async () => { n++; if (n === 1) { calls++; return new Response('{}', { status: 503 }); } return okFetch()(); };
  r = await guardedModelCall({ purpose: P, body, fetchImpl: flaky });
  check('a transient provider error gets exactly one retry under the same reservation', r.ok && calls === 2, `calls=${calls}`);
  calls = 0;
  r = await guardedModelCall({ purpose: P, body, fetchImpl: async () => { calls++; return new Response('{}', { status: 400 }); } });
  const fev = (await (await rest(`ai_spend_events?id=eq.${r.spendEventId}&select=status,reserved_usd`)).json())[0];
  check('a client error is not retried and the failed call keeps counting at its reservation', !r.ok && calls === 1 && fev?.status === 'failed' && Number(fev.reserved_usd) > 0, JSON.stringify(fev));

  calls = 0;
  const many = await Promise.all(Array.from({ length: 6 }, () => guardedModelCall({ purpose: P, body, fetchImpl: okFetch(400) })));
  const ran = many.filter((x) => x.ok).length; const conc = many.filter((x) => x.reason === 'too_many_concurrent').length;
  check('six simultaneous calls: at most two run at once, the rest are refused before dispatch', ran <= 2 && ran >= 1 && conc === 6 - ran && calls === ran, `ran=${ran} conc=${conc} calls=${calls}`);

  const anon = await fetch(`${process.env.SUPABASE_URL}/rest/v1/ai_spend_events?select=id&limit=1`, { headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}` } });
  const anonRows = anon.ok ? await anon.json() : [];
  check('the browser (anon) key cannot read the spend ledger', !anon.ok || anonRows.length === 0, `status ${anon.status}`);
  const anonRpc = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/ai_spend_reserve`, { method: 'POST', headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_request_id: 'x', p_organization_id: null, p_purpose: P, p_provider: 'x', p_model: 'x', p_pricing_version: 'x', p_reserve_usd: 0.01 }) });
  check('the browser (anon) key cannot reserve budget', !anonRpc.ok, `status ${anonRpc.status}`);
} finally {
  await cleanup();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
