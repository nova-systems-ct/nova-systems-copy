# Runtime & Hosting Recommendation

Written 2026-09-24 per master prompt §20 and Isaac's explicit instruction not to ask him to pick
infrastructure without analysis. This is a concrete engineering recommendation backed by real,
sourced current pricing (fetched today, not recalled from training data) and a real, runnable
local implementation — not a menu of abstract options.

## 1. What the current stack can and cannot do

**Verified directly** (not assumed): `api/*.js` are Vercel Serverless Functions, currently 12 of
12 slots used, deployed on what this environment has always treated as the Hobby plan (no Vercel
API token exists in this environment to confirm the account's actual current tier — this is the
one fact in this document Isaac should personally confirm in the Vercel dashboard before relying
on it). Checked today against Vercel's own current published limits:

- **Hobby**: functions get a **10-second execution timeout**. Cron jobs are capped at **once per
  day** (timing only guaranteed within the hour it's scheduled for), and most sources cap it at 2
  cron jobs per project.
- **Pro** ($20/mo/user): **300-second** function timeout, **per-minute** cron precision.

Neither tier changes the fundamental limitation: a Vercel Function is a stateless request/response
handler that terminates when it returns. It cannot hold a phone call's audio connection open, and
it cannot run a background loop that outlives one HTTP request. Upgrading to Pro would fix the
"once a day" cron granularity, but would **not** solve live voice or genuinely long-running jobs —
those need a process that stays alive between requests, which no Vercel plan provides.

## 2. The three distinct needs, and what each actually requires

| Need | Requires |
|---|---|
| Scheduled publishing, follow-up sequences, audit research steps, Zion render-status polling | A durable job queue + something that polls it periodically. Each unit of work can be short (seconds), so it does NOT need a persistent connection — it needs reliable **scheduling and retry**, not raw compute time. |
| Live voice (if self-hosted) | A **persistent, long-lived connection** (WebSocket) held open for the entire call — this is the one need Vercel categorically cannot meet at any plan tier. |
| Media/audit-research jobs that might run longer than a request-response cycle | Either chunked into resumable steps (fits inside serverless), or run on a process with no hard time limit. |

## 3. Recommendation: one small always-on worker, not three separate systems

**Add exactly one new piece of infrastructure**: a small, always-on Node.js process, polling a
durable job queue that lives in the Supabase Postgres database Nova already has (zero new
infrastructure for the queue itself). This single worker serves all three needs above — not three
separate services — which is the actual "smallest suitable architecture" for what's being asked:

- It polls `jobs` (see `supabase/durable-jobs-migration-standalone.sql`, built today) every few
  seconds for scheduled publishing, follow-ups, and research-job steps.
- If Nova self-hosts voice (see §4), the same process is also where the Twilio Media Streams
  WebSocket bridge would live, because it's already the one piece of infrastructure guaranteed to
  stay running between requests.

**This has already been built as real, runnable code**, not just proposed:

- `supabase/durable-jobs-migration-standalone.sql` — the `jobs` table plus a `claim_next_job()`
  Postgres function using `FOR UPDATE SKIP LOCKED` for safe concurrent leasing (two workers can
  poll at once without ever double-claiming a job). pg-mem validated
  (`scripts/validate_durable_jobs_schema.mjs`, 4/4).
- `worker/jobQueueEngine.mjs` — the actual claim/complete/fail/retry/dead-letter algorithm, as
  pure, dependency-free logic.
- `scripts/unit_job_queue_test.mjs` — **12/12**, including the specific proof Isaac asked for:
  a job whose worker "crashes" mid-processing (its lease simply expires) is automatically reclaimed
  by a different worker with no operator intervention, a failing job retries with real exponential
  backoff (30s → 60s → 120s...), and a job that exhausts its retry budget moves to `dead_letter`
  instead of disappearing or looping forever.
- `worker/index.mjs` — the actual poll loop, runnable **right now** in this environment with
  `node worker/index.mjs --local` (no external service needed — it falls back to a JSON-file-backed
  store when no Supabase credentials are present) or against real Postgres once deployed. Verified
  today with a real end-to-end run: enqueued a job, processed it, confirmed it persisted correctly
  to disk, confirmed a second run found nothing left to do (no duplicate processing).
- Wired into a real consumer already: `handleBlogAdmin`'s `schedule` action (§17) now enqueues a
  real `marketing_publish` job with the post's `scheduled_at` — this is what turns "scheduled" from
  a field nobody reads into something that actually fires, once the worker is deployed and the
  migration applied.

### Where to run it (deployment options, cheapest-first, real pricing fetched today)

| Option | Cost (small always-on instance) | Notes |
|---|---|---|
| **Fly.io** | ~$2–8/mo (pure pay-per-second; a `shared-cpu-1x`/256MB machine runs about $2/mo) | No free tier for new accounts as of 2026. Recommended default — cheapest, and Fly.io machines are designed exactly for this "small always-on process" shape. |
| **Railway** | ~$6–13/mo (Hobby plan $5/mo base + per-GB-RAM/vCPU usage) | More predictable billing (flat-ish), slightly pricier. Reasonable alternative if Fly.io's pure-usage billing is unwelcome. |
| **Vercel Pro + external worker** | $20/mo (Pro) + worker cost above | Only worth it if Nova also needs per-minute cron or >10s function timeouts for reasons unrelated to this worker — not needed for the worker itself. |

**Recommendation: Fly.io**, one small machine, ~$2–8/month. This requires Isaac to create a Fly.io
account and attach a payment method — **not done**, queued in the owner-action checklist below,
per "do not purchase hosting... without authorization."

## 4. Voice: managed provider vs. Nova hosting the connection

This is the distinction Isaac specifically asked to be made explicit, since §11 lists Twilio/speech
providers as candidates "until inspected," and the existing Integration Center (`api/integrations.js`)
already lists Twilio, Deepgram, and ElevenLabs among its 8 tracked providers — suggesting this
direction was already anticipated in this codebase's design, though never committed to.

### Option A — Nova hosts the audio connection (self-hosted)

Twilio handles the PSTN/telephony leg only (answering the call, routing, TwiML). **Nova's own
always-on worker** (the same Fly.io process from §3) holds a WebSocket open for the call's entire
duration, bridging: Twilio Media Streams → Deepgram (speech-to-text) → Claude (the LLM already used
throughout this app) → ElevenLabs (text-to-speech) → back to Twilio.

Real, sourced per-minute costs (fetched today):
- **Twilio**: ~$0.0085/min inbound (local number) to ~$0.013/min outbound, plus ~$1.15/mo per
  local phone number ($2.15/mo toll-free).
- **Deepgram** (Nova-3, streaming/real-time): ~$0.0077/min.
- **ElevenLabs** (Flash/Turbo tier, the cheap conversational tier): $0.05 per 1,000 characters — at
  a rough ~150 words/minute spoken rate (~750 characters/min), that's roughly **$0.0375/min of
  AI-generated speech** (my own conversion from their published per-character rate, not an
  official per-minute number — flagged as an estimate, not a quoted price).
- **Total self-hosted estimate: roughly $0.06–0.07 per minute of conversation**, plus the ~$2–8/mo
  flat worker cost from §3 (shared across all worker responsibilities, not voice-specific).

**Pro**: meaningfully cheaper per minute at any real call volume; the worker infrastructure is
already being built for §17/§9 regardless. **Con**: Nova owns building/tuning barge-in handling,
silence detection, reconnection logic, and latency — real engineering work §11 explicitly requires
("interruption/barge-in, silence/noise, ambiguous names... dropped calls, duplicate/out-of-order
events and provider outages"), not a solved problem out of the box.

### Option B — A managed voice AI platform hosts everything (e.g. Vapi, Retell, Bland)

The **provider** hosts the persistent connection, the STT/LLM/TTS loop, and exposes a
configuration API + webhooks for call events. Nova configures an agent via their dashboard/API;
Nova hosts nothing persistent for voice at all.

Real, sourced pricing (Vapi, fetched today, as a representative example of this category):
advertised from $0.05/min for orchestration alone, but **realistic all-in cost once STT/LLM/TTS/
telephony are included is $0.08–0.15/min in a typical configuration, and can run $0.25–0.33/min**
depending on model/voice choices — notably higher than Option A's ~$0.06–0.07/min at any real
volume, in exchange for zero infrastructure to build or operate.

**Pro**: fastest to a working pilot, zero ops burden, provider handles interruption/reconnection
edge cases already. **Con**: real ongoing cost premium at volume, another vendor relationship and
account to manage, less control over the exact conversation loop, and none of these three
providers (Vapi/Retell/Bland) has been vetted against Nova's actual needs — this is a category
description, not a specific endorsement.

### Recommendation

**Self-hosted (Option A)**, because: it's the direction the codebase's existing Integration Center
already anticipated (Twilio/Deepgram/ElevenLabs are already tracked providers, not a new addition);
the always-on worker is being built anyway for durable jobs, so voice adds a responsibility to
existing infrastructure rather than a new piece of it; and it's meaningfully cheaper at any volume
Nova would actually run. This is a recommendation, not an irreversible commitment — the same worker
architecture can integrate a managed provider's webhook-based API later with much less rework than
the reverse.

**Not done, and not something to do without explicit authorization**: creating Twilio/Deepgram/
ElevenLabs accounts, purchasing a phone number, or writing the actual Media Streams bridge code
(§11's call-flow/typed-tools/interruption-handling requirements are substantial and deserve their
own properly-scoped implementation pass once Isaac confirms this direction, per §11's own
explicit requirement to verify the actual selected stack before building call-flow code against
it).

## 5. What this does NOT decide

This recommendation covers infrastructure shape and provider category. It does not commit to:
prices Nova charges its own customers for AI receptionist service (a separate, unrelated business
decision); exact call volume/budget caps (§20 requires these exist, not what their number is);
recording/disclosure legal review (§11's own explicit carve-out); or which of Deepgram/AssemblyAI
or ElevenLabs/other TTS vendors is final — Deepgram/ElevenLabs are recommended because they're
already the ones this codebase's Integration Center already tracks, not because alternatives were
evaluated and rejected.

## Owner-action items this recommendation adds to the consolidated checklist

1. Confirm the Vercel account's actual current plan/tier in the dashboard (this document's Hobby-
   plan assumption is carried over from prior sessions, never independently re-verified via API).
2. Create a Fly.io account, attach a payment method, authorize ~$2–8/month for one small always-on
   machine to run `worker/index.mjs`.
3. Decide: self-hosted voice (Option A, recommended) or a managed platform (Option B) — or defer
   voice entirely for now and use the worker purely for durable jobs (§17/§9), which needs no voice
   decision at all to be useful today.
4. If self-hosted voice is chosen: create Twilio, Deepgram, and ElevenLabs accounts, authorize a
   phone number purchase (~$1.15–2.15/mo) and per-minute usage budgets.
5. Apply `supabase/durable-jobs-migration-standalone.sql` (already in the migration queue below).

Sources (fetched 2026-09-24):
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations)
- [Vercel Cron Jobs: Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Twilio Programmable Voice Pricing — US](https://www.twilio.com/en-us/voice/pricing/us)
- [Deepgram Pricing](https://deepgram.com/pricing)
- [ElevenLabs API Pricing](https://elevenlabs.io/pricing/api)
- [Fly.io Pricing 2026 (Budgetforge analysis)](https://www.budgetforge.dev/tools/fly-io-pricing-2026-2)
- [Railway vs Fly.io 2026 (Northflank analysis)](https://northflank.com/blog/railway-vs-flyio)
- [Vapi AI Pricing 2026 (Cekura analysis)](https://www.cekura.ai/blogs/vapi-ai-pricing)
