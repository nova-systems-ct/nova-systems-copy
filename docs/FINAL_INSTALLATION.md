# Nova — Consolidated Installation Package

Generated 2026-09-24 against commit history through the marketing/Crystal/Zion/voice slices of
this build. Per master prompt §22: exact ordered steps generated from the actual implementation,
not invented SQL. This is the single document Isaac needs for one coordinated activation session —
`docs/PRODUCT_BUILD_STATE.md` remains the narrative build log; this is the operational checklist.

**Status vocabulary used below**: `not started` / `in development` / `locally verified` /
`staging verified` / `waiting on owner-provider` / `ready for installation` / `installed` /
`live verified`. Nothing in this repository has been marked `installed` or `live verified` for any
module built this session — every migration below is `locally verified` (real pg-mem schema proof
and/or e2e test written) and genuinely `waiting on owner` to actually run.

## 1. Target environment

- **Supabase project**: `xizmgruvuazmummotzkp` (`https://xizmgruvuazmummotzkp.supabase.co`) — the
  one project both `nova-systems.app` and the retired `nova-systems.agency` share.
- **Frontend/API host**: Vercel, `nova-systems.app`, assumed Hobby plan (never independently
  re-verified via API in this environment — **action: confirm the actual current plan in the
  Vercel dashboard before relying on the 12-function-cap assumption below**).
- **Current Vercel function count**: 12 of 12 top-level `api/*.js` files (re-verified today). Any
  new top-level endpoint requires either consolidating into an existing file's `?resource=`
  dispatch or a plan upgrade.
- **Backup/recovery prerequisite**: before running any migration below, take a manual Supabase
  project backup/snapshot (Dashboard → Database → Backups) — none of these statements are
  destructive, but a pre-migration snapshot is the honest baseline "rollback steps" below assume.

## 2. Migration manifest (run in this exact order)

Every file is additive (`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN IF NOT EXISTS` /
`ON CONFLICT DO NOTHING`) except the two explicitly marked — both of those touch only a
newly-added column on an already-live table and are proven idempotent in their own validator
script. Zero `DROP`/`TRUNCATE`/`DELETE` statements anywhere in this manifest.

| # | File | Depends on | Real pre-existing data touched? | Local validation |
|---|---|---|---|---|
| 1 | `supabase/academy-migration-standalone.sql` | — | No (new tables) | Schema built alongside `api/academy.js`; no standalone pg-mem script — validated via `scripts/e2e_academy_auth_test.mjs` once applied |
| 2 | `supabase/hiring-workflow-migration-standalone.sql` | — | No (new tables) | Validated via `scripts/e2e_hiring_workflow_test.mjs` once applied |
| 3 | `supabase/crm-order-audit-migration-standalone.sql` | — | Adds `leads.business_id` column (additive) | `scripts/validate_crm_order_audit_schema.mjs` — 8/8 |
| 4 | `supabase/zion-studio-migration-standalone.sql` | — | No (new tables) | `scripts/validate_zion_schema.mjs` — 6/6 |
| 5 | `supabase/approval-inbox-migration-standalone.sql` | — | No (new table) | `scripts/validate_approval_inbox_schema.mjs` — 3/3 |
| 6 | `supabase/installation-center-migration-standalone.sql` | #3 (`orders`) | No (new tables) | `scripts/validate_installation_center_schema.mjs` — 6/6 |
| 7 | **`supabase/marketing-content-workflow-migration-standalone.sql`** | — | **Yes — the live `blog_posts` table.** Contains one narrow, idempotent backfill UPDATE (sets the new `status` column from the existing `published` boolean on existing rows only; proven idempotent on re-run) | `scripts/validate_marketing_content_workflow_schema.mjs` — 5/5 |
| 8 | `supabase/durable-jobs-migration-standalone.sql` | — | No (new tables + `claim_next_job()` function) | `scripts/validate_durable_jobs_schema.mjs` — 4/4 (table/constraint DDL only — pg-mem does not reliably execute PL/pgSQL function bodies; the function's real algorithm is proven separately in `scripts/unit_job_queue_test.mjs` + `scripts/unit_job_queue_correctness_test.mjs`, 27/27 combined) |
| 9 | `supabase/crystal-migration-standalone.sql` | — | No (new tables) | `scripts/validate_crystal_schema.mjs` — 8/8 |
| 10 | **`supabase/marketing-automation-migration-standalone.sql`** | #3 (for `marketing_campaigns.organization_id` FK pattern consistency, not a hard dependency) | **Yes — the live, pre-existing `marketing_brands` table (2 real seeded rows from 2026-08-12) and the empty, pre-existing `content_ideas`/`content_assets` tables.** See the file's own header for how this reconciliation was discovered and confirmed via a full repo grep before writing a single ALTER statement | `scripts/validate_marketing_automation_schema.mjs` — 10/10, seeded with the REAL pre-existing row shape, not an idealized fresh schema |
| 11 | `supabase/voice-agent-migration-standalone.sql` | #3 (`crm_contacts`) | No (new tables) | `scripts/validate_voice_agent_schema.mjs` — 9/9 |
| 12 | `supabase/zion-studio-remaining-tabs-migration-standalone.sql` | #4 | Adds columns to live `zion_videos`/`zion_character_assets` (both still empty of real rows as of this writing) | `scripts/validate_zion_remaining_tabs_schema.mjs` — 6/6 |
| 13 | `supabase/crystal-evidence-requirements-migration-standalone.sql` | #9 | Adds columns to `crystal_service_catalog`/`crystal_jobs` (both empty as of this writing) | `scripts/validate_crystal_evidence_requirements_schema.mjs` — 3/3 |

Run each file's full contents in the Supabase SQL Editor, in the numbered order above (later files
reference tables/columns earlier files create). After each file, note in this table (or in
`docs/requirement-matrix.md`) that it moved from `locally verified` to `installed`.

**Do not** run the sections of the cumulative `supabase/schema-update.sql` that duplicate any of
the above — that file has not been kept in sync with migrations #3 through #13 and predates most
of this build; it remains useful only for the tables it already covers from before this session.

## 3. Storage bucket policies

Three buckets are referenced by existing code and confirmed **absent** in production (404 on all
three via the Storage Admin API) — every upload path in the app has been silently failing until
these exist:

| Bucket | Visibility | Size limit | Consumers | Retention |
|---|---|---|---|---|
| `portfolios` | **Private** | ~5MB | Resumes/application uploads (hiring pipeline) | Per hiring-record retention policy — not yet formally set; do not auto-delete |
| `nova-vault` | **Private** | ~10MB | Invoices, signed contracts, generated documents | Code already uses short-lived (5-minute) on-demand signed URLs, never a stored permanent link — bucket creation alone is the remaining step, no further code change needed |
| `portfolio` | **Public** | ~5MB | Marketing case-study images — intentionally public | N/A (public marketing assets) |

**Action**: create all three in Supabase Dashboard → Storage, matching the visibility above exactly
(a private bucket accidentally created public is a real data-exposure risk — this project has
fixed exactly that class of bug before, in the unrelated `mars-hill-clean` project). This
environment's own permission system blocks direct bucket creation via the Storage Admin API
(flagged as a shared-resource modification) — this has never been bypassed, only reported.

No new buckets are needed for anything built this session (Crystal job media, voice
recordings/transcripts, and social-post media all reference `storage_path`/`media_url`/
`transcript_ref` columns pointing at these same three buckets' private namespace conventions, not
new buckets).

## 4. Hosting configuration — the durable worker

Per `docs/RUNTIME_HOSTING_RECOMMENDATION.md`: one small always-on process (`worker/index.mjs`)
handling durable jobs (scheduled publishing, follow-ups) and, if self-hosted voice is chosen, the
call-audio bridge.

1. **Create a Fly.io account**, attach a payment method. Estimated cost: ~$2-8/month for one small
   `shared-cpu-1x` machine.
2. **Deploy** `worker/index.mjs` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set as real
   secrets (never committed) — the same two variables already used by every other server-side
   piece of this codebase, no new credential type introduced.
3. **Smoke test after deploy**: `node worker/index.mjs --once` should log either "processed one
   job" or "no eligible job found" — both are healthy. `node worker/index.mjs --enqueue-demo --once`
   proves a full enqueue→claim→complete cycle end-to-end (already verified locally in this
   environment; re-verify once actually deployed, since local proof is not the same as live proof).
4. **Health/incident monitoring**: not yet built (§20's remaining scope) — the worker currently
   logs to stdout only; a real alerting path (a failed job past N retries → dead_letter → a human
   notified) is a real follow-up, not claimed as done.

## 5. Provider authorization (all currently blocked, all owner-only actions)

| Provider | What's needed | Cost | Blocks |
|---|---|---|---|
| Fly.io | Account + payment method | ~$2-8/mo | The worker above; scheduled publishing never actually fires without it |
| Twilio | Account, phone number purchase | ~$1.15-2.15/mo + per-minute usage | Live voice calls (self-hosted path) |
| Deepgram | API account | Usage-based (~$0.0077/min streaming) | Voice speech-to-text (self-hosted path) |
| ElevenLabs | API account | Usage-based (~$0.05/1k chars) | Voice text-to-speech (self-hosted path) |
| TikTok | Developer account + app review (privacy policy, demo video) | Free; ~1-2 weeks review | Automated TikTok posting — manual export works today regardless |
| Instagram/Facebook | Meta developer app + Business verification + App Review | Free; weeks + 2-5 business days verification | Automated IG/FB posting — manual export works today regardless |
| LinkedIn | Developer app only — **no approval needed for basic sharing** | Free; same-day | The most accessible of the 5 — worth prioritizing first if any automated posting is wanted soon |
| YouTube | Verified Google Cloud project | Free at default quota (~100 uploads/day) | Automated video uploads — manual export works today regardless |
| Email (Resend) | **Already connected** — sequences stay DRY-RUN until the worker is started with `SEQUENCE_SEND_ENABLED=true`, `RESEND_API_KEY` and `SEQUENCE_FROM_ADDRESS` (a verified sender domain) — deliberate, so no campaign sends before you authorize it | Already in use | Nothing — this was confirmed, not a gap |
| Isaac's `isaac@nova-systems.app` | Investigate Supabase Auth `email_address_invalid` rejection in Dashboard → Authentication, or continue using the already-working `isaac_0427@icloud.com` | — | Nothing functional — his real membership is confirmed correct either way |

None of the social-platform review processes block anything else in this build — every adapter's
`publish()` function already returns an honest `authorization_required` result and every platform
post defaults to `manual_export` (a human downloads prepared content and posts by hand) until an
app clears review.

## 6. Tests — what to run after each migration lands

Every e2e script below currently fails fast with a clear "table/column not found" error, which is
the correct, honest result until its migration is applied. After section 2's migrations run, in
order:

```
node scripts/e2e_academy_auth_test.mjs
node scripts/e2e_hiring_workflow_test.mjs
node scripts/e2e_crm_order_audit_test.mjs
node scripts/e2e_zion_studio_test.mjs
node scripts/e2e_approval_inbox_test.mjs
node scripts/e2e_installation_center_test.mjs
node scripts/e2e_marketing_content_workflow_test.mjs
node scripts/e2e_crystal_test.mjs
node scripts/e2e_marketing_automation_test.mjs
node scripts/e2e_voice_agent_test.mjs
node scripts/e2e_zion_remaining_tabs_test.mjs
```

Already passing today, with zero dependency on any migration above:

```
node scripts/unit_audit_clock_test.mjs           # 13/13
node scripts/unit_job_queue_test.mjs             # 12/12
node scripts/unit_job_queue_correctness_test.mjs # 15/15
node scripts/unit_social_adapters_test.mjs       # 12/12
node scripts/unit_email_sequence_test.mjs        # 12/12
node worker/index.mjs --local --enqueue-demo --once
```

Permanent regression suites — re-run after every migration batch to confirm zero regressions
(all passing as of this writing, unaffected by any pending migration):

```
node scripts/e2e_org_isolation_test.mjs     # 8/8
node scripts/e2e_api_client_auth_test.mjs   # 22/22
node scripts/e2e_login_path_test.mjs        # 12/12
```

## 7. Rollback steps

Because every migration is additive (new tables, or new nullable/defaulted columns on existing
tables), rollback is genuinely low-risk:

- **A new table** causing an unexpected problem: drop it directly (`DROP TABLE IF EXISTS
  <table_name>;`) — no other table has a hard `NOT NULL` foreign key into any table added this
  session, so no cascading break. Application code for that domain will start returning honest
  "table not found" 404s again, matching this environment's own pre-migration state exactly —
  the same failure mode already exercised and proven safe in every e2e test's fail-fast path.
- **A new column** on an existing live table (blog_posts, marketing_brands, content_ideas,
  content_assets, zion_videos, zion_character_assets, crystal_service_catalog, crystal_jobs):
  `ALTER TABLE <table> DROP COLUMN IF EXISTS <column>;` — safe, since nothing in this session's
  code depends on that column existing to read/write the table's PRE-EXISTING columns; only the
  new features that use it will error, not the whole table.
- **The one backfill UPDATE** (marketing-content-workflow, `blog_posts.status`): rollback is
  `ALTER TABLE blog_posts DROP COLUMN IF EXISTS status;` (plus the other columns that migration
  added) — the original `published` boolean this backfill READ FROM is never modified, so no data
  loss is possible from this specific statement under any circumstance.
- **Full restore**: the manual pre-migration backup from section 1 is the final fallback for
  anything not covered above.

No migration in this manifest requires an application code rollback in lockstep — every new
`?resource=`/`?op=` route returns a clean, honest error (401/403/404/500 with a real message) if
its backing table doesn't exist yet, rather than crashing the whole `api/client.js` file, which is
exactly why this build could ship code ahead of its own migrations all session without breaking
anything already live.

## 8. Owner-action checklist, grouped by account

1. **Supabase** (existing account, no new signup): run the 13 migrations in section 2; create the
   3 storage buckets in section 3; investigate `isaac@nova-systems.app`'s Auth rejection or
   continue with `isaac_0427@icloud.com`.
2. **Vercel** (existing account): confirm actual current plan/tier in the dashboard.
3. **Fly.io** (new account): create, attach payment, deploy `worker/index.mjs` per section 4.
4. **Voice providers** (new accounts, only if self-hosted voice is chosen): Twilio, Deepgram,
   ElevenLabs — see section 5 for costs.
5. **Social platform developer accounts** (new, as many or as few as desired): TikTok, Meta
   (Instagram+Facebook share one app), LinkedIn, Google Cloud (YouTube) — see section 5.
6. **Business decisions, no account needed**: approve/reject the 80% Academy threshold; supply
   Zion's character reference assets (unblocks the render step only).
