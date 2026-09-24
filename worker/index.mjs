// Nova's durable background worker — the always-on process described in
// docs/RUNTIME_HOSTING_RECOMMENDATION.md. Polls the jobs table (supabase/durable-jobs-migration-
// standalone.sql) and executes whatever handler is registered for each job's job_type.
//
// Two runnable modes, picked automatically (override with --local):
//   - Postgres mode (default when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set): real
//     production behavior, safe concurrent leasing via the claim_next_job() SQL function.
//   - Local mode (--local, or automatic when those env vars are absent): a JSON-file-backed store
//     at .data/jobs.local.json — genuinely runnable on this machine right now, with real
//     persistence across restarts, no external service required.
//
// Usage:
//   node worker/index.mjs               # poll forever (Ctrl+C to stop)
//   node worker/index.mjs --once        # claim and process at most one job, then exit
//   node worker/index.mjs --local       # force the local file store even if Supabase env vars exist
//   node worker/index.mjs --enqueue-demo  # enqueue one demo marketing_publish job, for a real
//                                          end-to-end local smoke test
//   node worker/index.mjs --cancel=<job-id> [--reason="..."]  # cancel a pending/leased job —
//                                          terminal, never reclaimed after (see
//                                          scripts/unit_job_queue_correctness_test.mjs)
//
// DELIVERY GUARANTEE: this queue is at-least-once, not exactly-once — a job whose worker crashes
// after a real side effect but before calling complete() WILL be handed to another worker again.
// Every handler registered below MUST be idempotent (check current state, treat "already done" as
// a no-op) rather than assume single delivery. See marketing_publish for the pattern, and
// scripts/unit_job_queue_correctness_test.mjs for the proof this pattern actually prevents a
// duplicate side effect on redelivery.

import fs from 'node:fs';
import { createLocalJobStore } from './localJobStore.mjs';
import { createPostgresJobStore } from './postgresJobStore.mjs';

const args = process.argv.slice(2);
const once = args.includes('--once');
const forceLocal = args.includes('--local');
const enqueueDemo = args.includes('--enqueue-demo');
const cancelId = args.find((a) => a.startsWith('--cancel='))?.split('=')[1];
const cancelReason = args.find((a) => a.startsWith('--reason='))?.split('=').slice(1).join('=');
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS) || 5000;
const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

function loadEnvFile() {
  const env = {};
  try {
    fs.readFileSync('.env.local', 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    });
  } catch { /* no .env.local — fine in local mode */ }
  return env;
}

function buildStore() {
  const fileEnv = loadEnvFile();
  const SUPABASE_URL = process.env.SUPABASE_URL || fileEnv.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!forceLocal && SUPABASE_URL && SERVICE_KEY) {
    console.log(`[worker] Postgres mode — ${SUPABASE_URL}`);
    return { store: createPostgresJobStore({ url: SUPABASE_URL, serviceKey: SERVICE_KEY }), url: SUPABASE_URL, serviceKey: SERVICE_KEY, mode: 'postgres' };
  }
  console.log('[worker] Local mode — .data/jobs.local.json (no Supabase credentials found, or --local forced)');
  return { store: createLocalJobStore(), url: null, serviceKey: null, mode: 'local' };
}

// ------------------------------------------------------------------------------- job handlers
// Each handler receives (job, ctx) and must either return a result (job completes) or throw (job
// retries with backoff, or moves to dead_letter once max_attempts is exhausted — see
// worker/jobQueueEngine.mjs). Register new job types here as new durable work is built; the queue
// itself never needs to change for a new job_type (see the migration's own header comment).
const handlers = {
  // §17: a blog post reaches its scheduled_at — this is what makes "Schedule" in Blog.jsx actually
  // fire, instead of just recording intent nobody ever acts on. Direct Postgres write (same fields
  // handleBlogAdmin's publish-now action sets) since the worker already holds the service-role key
  // for job leasing — no need to hop back through the HTTP API for its own scheduled action.
  async marketing_publish(job, ctx) {
    if (ctx.mode !== 'postgres') {
      return { skipped: true, reason: 'marketing_publish requires the real blog_posts table — nothing to do in local demo mode' };
    }
    const postId = job.payload?.post_id;
    if (!postId) throw new Error('marketing_publish job is missing payload.post_id');
    const headers = { apikey: ctx.serviceKey, Authorization: `Bearer ${ctx.serviceKey}`, 'Content-Type': 'application/json' };
    const getRes = await fetch(`${ctx.url}/rest/v1/blog_posts?id=eq.${encodeURIComponent(postId)}&select=status`, { headers });
    const [post] = getRes.ok ? await getRes.json() : [];
    if (!post) throw new Error(`blog_posts row ${postId} not found`);
    if (!['approved', 'scheduled'].includes(post.status)) {
      // The post was pulled back to draft (request-changes) or already published by a manual
      // "Publish Now" click after scheduling — either way, this stale job must not force it live.
      return { skipped: true, reason: `post status is ${post.status}, no longer eligible for scheduled publish` };
    }
    const patchRes = await fetch(`${ctx.url}/rest/v1/blog_posts?id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'published', published: true, updated_at: new Date().toISOString() }),
    });
    if (!patchRes.ok) throw new Error(`Failed to publish post ${postId}: ${patchRes.status} ${await patchRes.text()}`);
    const [published] = await patchRes.json();
    return { published: true, post_id: published.id, slug: published.slug };
  },

  // §17 approved email sequences. Payload: {enrollment_id}. Re-reads live state every run (so an
  // unsubscribe/reply/pause since enqueue always wins), asks the pure engine what to do, and is
  // idempotent per step via the engine's key. DRY-RUN unless SEQUENCE_SEND_ENABLED=true — no real
  // campaign email goes out from development or an unconfigured worker.
  async email_sequence_step(job, ctx) {
    if (ctx.mode !== 'postgres') return { skipped: true, reason: 'requires the real database' };
    const { decideNextAction, applyOutcome } = await import('./emailSequenceEngine.mjs');
    const headers = { apikey: ctx.serviceKey, Authorization: `Bearer ${ctx.serviceKey}`, 'Content-Type': 'application/json' };
    const get = async (path) => { const r = await fetch(`${ctx.url}/rest/v1/${path}`, { headers }); return r.ok ? r.json() : []; };
    const [enrollment] = await get(`marketing_sequence_enrollments?id=eq.${encodeURIComponent(job.payload?.enrollment_id)}`);
    if (!enrollment) throw new Error('enrollment not found');
    const [sequence] = await get(`marketing_sequences?id=eq.${enrollment.sequence_id}`);
    const [subscriber] = await get(`newsletter_subscribers?id=eq.${enrollment.subscriber_id}`);
    const decision = decideNextAction({ enrollment, sequence, subscriber });
    if (decision.action === 'wait' || decision.action === 'none') return decision;
    let result = decision;
    if (decision.action === 'send') {
      const live = process.env.SEQUENCE_SEND_ENABLED === 'true' && process.env.RESEND_API_KEY;
      if (live) {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': decision.idempotencyKey },
          body: JSON.stringify({ from: process.env.SEQUENCE_FROM_ADDRESS, to: subscriber.email, subject: decision.step.subject, html: decision.step.body }),
        });
        if (!r.ok) throw new Error(`Resend rejected the send: ${r.status} ${await r.text()}`);
        result = { ...decision, delivered: 'provider_accepted' };
      } else {
        result = { ...decision, delivered: 'dry_run' };
      }
    }
    const next = applyOutcome(enrollment, decision);
    await fetch(`${ctx.url}/rest/v1/marketing_sequence_enrollments?id=eq.${enrollment.id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ status: next.status, stopped_reason: next.stopped_reason || null, current_step: next.current_step, last_step_at: next.last_step_at || null }),
    });
    return result;
  },

  // A trivial handler kept only to give --enqueue-demo something real to run end-to-end in local
  // mode without needing any live credentials.
  async demo_echo(job) {
    return { echoed: job.payload, at: new Date().toISOString() };
  },
};

async function processOneJob(store, ctx) {
  const job = await store.claimNext({ workerId: WORKER_ID, leaseSeconds: 60 });
  if (!job) return false;
  console.log(`[worker] claimed job ${job.id} (${job.job_type}), attempt ${job.attempts}/${job.max_attempts}`);
  const handler = handlers[job.job_type];
  if (!handler) {
    await store.fail(job.id, new Error(`No handler registered for job_type '${job.job_type}'`));
    console.error(`[worker] no handler for job_type '${job.job_type}' — marked for retry/dead-letter`);
    return true;
  }
  try {
    const result = await handler(job, ctx);
    await store.complete(job.id, result);
    console.log(`[worker] completed job ${job.id}:`, JSON.stringify(result));
  } catch (err) {
    const after = await store.fail(job.id, err);
    console.error(`[worker] job ${job.id} failed: ${err.message} — now ${after?.status || 'unknown'}`);
  }
  return true;
}

async function main() {
  const { store, url, serviceKey, mode } = buildStore();
  const ctx = { url, serviceKey, mode };

  if (enqueueDemo) {
    const { job, deduped } = await store.enqueue({ job_type: 'demo_echo', payload: { hello: 'nova', at: new Date().toISOString() } });
    console.log(deduped ? '[worker] demo job already existed (deduped)' : `[worker] enqueued demo job ${job.id}`);
  }

  if (cancelId) {
    const result = await store.cancel(cancelId, cancelReason);
    if (result?.error) console.error(`[worker] cancel failed: ${result.error}`);
    else console.log(`[worker] cancelled job ${cancelId}`);
    return;
  }

  if (once) {
    const did = await processOneJob(store, ctx);
    console.log(did ? '[worker] processed one job, exiting (--once)' : '[worker] no eligible job found, exiting (--once)');
    return;
  }

  console.log(`[worker] ${WORKER_ID} polling every ${POLL_INTERVAL_MS}ms — Ctrl+C to stop`);
  let running = true;
  process.on('SIGINT', () => { console.log('\n[worker] shutting down...'); running = false; });
  process.on('SIGTERM', () => { running = false; });

  while (running) {
    try {
      const did = await processOneJob(store, ctx);
      if (!did) await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    } catch (err) {
      console.error('[worker] poll loop error:', err.message);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
}

main().catch((err) => {
  console.error('[worker] FATAL:', err);
  process.exit(1);
});
