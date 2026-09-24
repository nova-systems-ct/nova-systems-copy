# Nova Product Build — State Checkpoint

Last updated: 2026-09-24, commit pending (post-Marketing-Automation). Written per the master
execution prompt's §23 requirement to maintain a real, resumable checkpoint rather than claim
unattended progress across a session boundary this environment cannot actually cross.

**Canonical specification**: [`NOVA_PRODUCT_ONLY_MASTER_EXECUTION_PROMPT.md`](../NOVA_PRODUCT_ONLY_MASTER_EXECUTION_PROMPT.md)
(recovered 2026-09-24 verbatim from this session's own saved transcript after a prior context
compaction had left only a lossy summary in circulation — read the actual file, not a paraphrase).

## Status framework

Per Isaac's 2026-09-24 instruction, every module below is tracked against five concrete states,
which map onto this document's existing vocabulary (`docs/requirement-matrix.md`'s status column)
as follows:

| Isaac's five states | This project's status column |
|---|---|
| Implemented | `in development` — code written, not yet run against any real data |
| Locally tested | `locally verified` — pg-mem schema proof and/or a pure-logic unit test and/or an e2e test written (even if it currently fails-fast on a missing migration — see below) |
| Tested with an actual provider | `staging verified` — not yet reached by any module; no live provider credentials are configured in this environment |
| Installed in production | `installed` — the migration has been applied and the code deployed, but not yet exercised live |
| Verified live | `live verified` — actually exercised against production and confirmed working |

**No module has moved past "locally tested" this session** except the ones already live before
this session started (login, org isolation, the dashboard shell, Integration Center). Every new
domain built in the last two days is real, tested code sitting one migration-run away from
"installed" — see the owner-action checklist for exactly what that requires.

## Where this build actually is

This is a genuinely large scope — 24 sections describing what amounts to a full multi-tenant
SaaS platform. It has not been built in one pass, and claiming otherwise would violate the master
prompt's own explicit instructions. See `docs/requirement-matrix.md` for the full module-by-module
status (source of truth; this document is the narrative checkpoint, not a duplicate of it).

As of this update: identity/tenancy, the dashboard shell, Sales Academy, hiring pipeline, shared
CRM foundations (businesses/contacts/deals), the product catalog, the order lifecycle, the full
Nova Audit domain (cases/evidence/findings/recommendations/reports/deliveries/outcomes, with a
real, independently unit-tested deadline clock), Zion Studio (journal/facts/ideas/scripts/
production/review), the Integration Center (found already complete on inspection — see below), the
Approval Inbox (aggregation + generic consequential-action approval/reject/revoke), the
Installation Center's provisioning workflow (sandbox testing, activation authority, pause/
offboard), a real review/scheduling workflow for blog content (draft → review → approval →
publish, closing a live "any staff can publish with zero review" gap), a durable job queue with a
genuinely runnable worker process (real local persistence and tested crash-recovery proven today),
and Crystal / Company 002's full operational workspace (customers → quote → versioned estimate →
acceptance → booking → worker assignment → evidence-gated completion → customer approval →
invoicing → feedback/recurring service) are all real, tested code. Nine migration files are
written, safety-reviewed, and NOT yet applied to production (this environment has no DDL access —
never has, this whole project). Three storage buckets are specified and NOT yet created (blocked
by this session's own permission system, not bypassed). Live voice/phone infrastructure (a
concrete recommendation exists — see `docs/RUNTIME_HOSTING_RECOMMENDATION.md` — but no code
against a specific provider yet, pending Isaac's decision) and broader multi-channel marketing
automation (social/email campaigns beyond blog review) remain not started.

## How schema-dependent work is being tested (no Docker/local Postgres in this environment)

The master prompt requires testing schema-dependent features against an isolated local/test
database rather than production. This environment has neither Docker nor a local Postgres
install (checked directly — `docker`, `psql`, `postgres`, `pg_ctl` all absent). The real substitute
used throughout this session:

- **Schema/constraint validation**: `pg-mem`, an in-process Postgres-compatible engine, actually
  executes every new migration's DDL and proves real constraint behavior (FK rejection, CHECK
  rejection, UNIQUE rejection) — not just "the SQL parses." One real, confirmed pg-mem-specific
  limitation was found and documented (it does not implement standard SQL's NULL-satisfies-CHECK
  semantics) — isolated with a standalone reproduction before being treated as a pg-mem quirk
  rather than a schema defect, and worked around in the *tests*, never in the schema itself.
  Scripts: `scripts/validate_crm_order_audit_schema.mjs` (8/8), `scripts/validate_zion_schema.mjs`
  (6/6).
- **Pure business logic**: the Audit deadline clock (`api/_auditClock.js`) has zero database
  dependency and is unit-tested directly — `scripts/unit_audit_clock_test.mjs`, 13/13, including a
  real business-hours weekend-skip case and the "a pause extends the deadline by exactly its own
  duration" invariant the master prompt explicitly requires.
- **Live authorization/integration proof**: real e2e scripts (`scripts/e2e_crm_order_audit_test.mjs`,
  `scripts/e2e_zion_studio_test.mjs`, `scripts/e2e_approval_inbox_test.mjs`,
  `scripts/e2e_installation_center_test.mjs`, `scripts/e2e_marketing_content_workflow_test.mjs`,
  plus the pre-existing `e2e_academy_auth_test.mjs`/`e2e_hiring_workflow_test.mjs`) run against the
  actual Supabase project using real throwaway orgs/users, cleaned up after. All seven
  domain-specific scripts currently fail fast with a clear "table not found"/"column does not
  exist" error — an honest, correct result, since none of their target migrations have been
  applied yet. This is not being reported as a pass.

Every pre-existing permanent regression suite (org isolation 8/8, API client auth 22/22, login
path 12/12) has been re-run after every change this session and still passes — no regressions.

## This build's real work (2026-09-23 → 2026-09-24, chronological)

1. **Login path re-verified from scratch**, not re-asserted — production URL/CSP/anon-key
   re-checked; `scripts/e2e_login_path_test.mjs` (new, 12/12 live) plus a real Playwright run
   against live production proving the system itself works end to end. Isaac's own account issue
   (Supabase rejecting `isaac@nova-systems.app` for recovery, `email_address_invalid`, not a DNS
   problem) is unchanged and still owner-blocked.
2. **Isaac's iCloud membership directly verified**, per explicit instruction that a working
   reset path alone is insufficient proof: queried `organization_members` for
   `isaac_0427@icloud.com` and confirmed a real, pre-existing `nova_super_admin` row (created in
   the original Stage 4 bootstrap, not created by this check) on the real Nova Systems org.
   Nothing to fix — the established authorization process already produced the correct result.
3. **Vault signed-link lifetime corrected**, per explicit instruction not to treat a long-lived
   bearer link as equivalent to a permission check at the moment of access: re-verified that
   invoices/contracts already email the PDF as a direct attachment (never a link to this bucket),
   dropped the default signed-URL lifetime from 30 days to 5 minutes, stopped persisting any URL
   at upload time at all, and wired `NovaVault.jsx` to mint a fresh link on every view/download
   click via the existing `resign` action.
4. **Shared CRM/Order foundations** (§6/§12): businesses (search-before-create identity
   resolution, ambiguous matches surfaced, never auto-merged), contacts, deals (full pipeline +
   stage history), a versioned product catalog (seeded with Nova Audit Digital/360 and a
   separately-versioned `communications-crm-bundle` entry — reconciling the Wave One naming
   collision at the data-model level without touching the legacy `WaveOne.jsx` page), and the full
   17-state order lifecycle (unapproved product pricing is never invented). Every handler checks
   the caller's real permission on the *specific* organization via `has_permission()` called with
   the caller's own token — real object-level authorization, not the older invoices/referrals
   handlers' "any staff with the permission string, any org" gap.
5. **Nova Audit workflow** (§8/§9): the full case/evidence/finding/recommendation/report/
   delivery/outcome domain, immutable approved report versions, and a real, pure, independently
   tested deadline clock distinguishing waiting_for_client/queue/active/at_risk/overdue/
   reviewer_wait/paused/completed exactly as specified.
6. **Zion Studio** (§16): journal (private-by-default, author-scoped), facts (unconfirmed until
   Isaac explicitly confirms — enforced, not just described), ideas (can only cite already-
   confirmed facts), scripts, storyboards, videos (full field list from §16), review/approval
   (approve/request-changes/reject/schedule). **A real authorization gap was found and fixed
   before this shipped**: the first draft gated every action at "any active staff member," which
   would have let a low-privilege role reach Nova's real content tooling — fixed to require
   `growth.view` for everything except the ownership-scoped journal/facts, and covered by a test
   written specifically to prove the fix, not just that the code runs.
7. **Integration Center verified already complete** (§19): before writing a "not started" entry,
   `api/integrations.js`/`src/pages/dashboard/Integrations.jsx` were read directly and found to
   already be a real, working registry for all 8 providers this codebase touches, honest status
   vocabulary, on-demand testing, already routed — corrected the requirement matrix instead of
   duplicating working code.
8. **Approval Inbox built** (§19): `approval_requests` table (pg-mem validated 3/3), `api/client.js`'s
   `approvals` resource (GET aggregates pending Audit reports + Zion videos + generic requests;
   POST create/approve/reject/revoke, gated `admin.view`), `src/pages/dashboard/ApprovalInbox.jsx`
   wired into the Admin hub. Content-version mismatch refused (409), expiry auto-marks a row
   `expired` on a late approve attempt (410). **A real logic bug caught and fixed before shipping**:
   the first draft guarded `revoke` behind the same "status must still be pending" check used for
   approve/reject, which made revoke permanently unreachable (revoking only ever makes sense on an
   already-*approved* row) — split the guard so approve/reject require `pending` and revoke
   requires `approved`. `scripts/e2e_approval_inbox_test.mjs` written and confirmed to fail fast
   correctly (migration not applied).
9. **Requirement matrix and this checkpoint updated** to reflect all of the above against actual
   evidence — not narrated separately from the code that backs each claim.
10. **Installation Center built** (§13, 2026-09-24): `installations`/`installation_tests`/
    `installation_events` (pg-mem validated 6/6), `api/client.js`'s `installations` resource —
    sandbox_setup → sandbox_testing (real recorded test runs) → sandbox_passed (re-derived from
    the LATEST recorded test being an actual pass every time, never a separately trusted flag) →
    active, gated by `admin.view` specifically ("activation authority," distinct from the
    `growth.view` every other installation action uses) → pause/resume (reason required) /
    offboard (terminal, reason required). One installation per order enforced by a real UNIQUE
    constraint. `src/pages/dashboard/Installations.jsx` + `InstallationDetail.jsx`.
    `scripts/e2e_installation_center_test.mjs` includes the exact T13 acceptance test (two
    independent orgs, proving neither can read, write, or see the other's installation).
11. **Marketing content review/scheduling workflow built** (§17, 2026-09-24) on the existing, live
    `blog_posts` table: `status`/`scheduled_at`/`submitted_by`/`approved_by`/`review_notes` columns
    added (the one migration this session that includes a real UPDATE — an idempotent backfill of
    the new `status` column from existing rows' `published` value, proven correct and idempotent
    in `scripts/validate_marketing_content_workflow_schema.mjs`, 5/5). **Closed a real, live
    authorization gap**: any `growth.view` staff member could previously flip `published` straight
    to `true` with zero review — `save` no longer accepts `published`/`status` from the client at
    all; going live now requires `submit-for-review` → `approve` (`admin.view` specifically) →
    `publish-now`/`schedule`. In-review posts aggregate into the Approval Inbox as
    `item_type: 'content'`. **Also fixed a real bug in the Approval Inbox itself, caught while
    extending it**: the `audit_report` aggregation never included `organization_id` in its
    `approve_action`, which `handleAuditReports` requires on every POST — every "Approve" click on
    an audit report from the inbox would have failed with a 400; fixed via a PostgREST embed
    (`audit_cases(organization_id)`) through the existing `case_id` foreign key, a pattern already
    proven elsewhere in this codebase (`academy.js`, `_auth.js`). `Blog.jsx` rebuilt around the new
    status states. `scripts/e2e_marketing_content_workflow_test.mjs` written, fails fast correctly.

10. **Canonical spec recovered** (2026-09-24): the full 24-section master prompt was missing from
    the repository — only a lossy conversation summary survived a prior context compaction, which
    Isaac correctly flagged as a real risk ("do not rely on conversation summaries as the sole
    specification"). Recovered verbatim from this session's own saved transcript file (not
    re-typed from memory, not reconstructed) and saved as
    `NOVA_PRODUCT_ONLY_MASTER_EXECUTION_PROMPT.md`, referenced from a new `CLAUDE.md`.
11. **Runtime/hosting recommendation delivered as a concrete engineering decision**, not an open
    question handed back to Isaac (§20): `docs/RUNTIME_HOSTING_RECOMMENDATION.md`, backed by real
    current pricing fetched the same day from Vercel/Twilio/Deepgram/ElevenLabs/Fly.io/Railway/
    Vapi's own sources — recommends one small always-on worker (Fly.io, ~$2-8/mo) serving both
    durable jobs and, if self-hosted voice is chosen, the live-call audio bridge.
12. **Durable job queue built as real, runnable code**, not a proposal: `jobs` table +
    `claim_next_job()` Postgres function (`supabase/durable-jobs-migration-standalone.sql`,
    pg-mem validated 4/4), `worker/jobQueueEngine.mjs`'s pure claim/complete/fail/retry/dead-letter
    algorithm (`scripts/unit_job_queue_test.mjs`, 12/12 — includes a real proof that a job whose
    worker crashes mid-processing is automatically reclaimed once its lease expires, with zero
    operator intervention), and `worker/index.mjs`, a genuinely runnable poll loop verified today
    end-to-end locally (`node worker/index.mjs --local --enqueue-demo --once`) with real
    persistence to disk and no external service required. Wired into a real consumer: scheduling a
    blog post now enqueues an actual job instead of recording an unread field.
13. **Audit-report approval evidence produced on request**, surfacing and fixing a real gap:
    nothing previously stopped approving a stale (superseded) draft version. Fixed (409 refusal)
    and `scripts/e2e_crm_order_audit_test.mjs` now explicitly proves, in sequence: an unauthorized
    cross-org caller is refused (403), the same authorized caller is refused on a stale version
    (409), and the same caller succeeds on the actual current version (200).
14. **Crystal / Company 002's full operational workspace built** (§14, restored scope): customers,
    properties, configurable service catalog (unpriced services never default to zero), quote
    requests with private photo references, versioned estimates (stale-version-guarded, like
    Audit reports), customer acceptance, booking, worker assignment, job checklists, before/after
    media, and a real two-party completion record. **"AI cannot declare physical work completed
    without authorized evidence" is structurally enforced**: `complete` requires the caller be a
    real assigned worker AND at least one real "after" photo already on file. Invoicing (real
    amounts only, never invented), feedback, and recurring-service scheduling. `src/pages/
    dashboard/Crystal.jsx` (customers/quotes/jobs/invoices, with the estimate-builder and job-
    detail UI honestly flagged as the next increment — the workflow is proven real via the API and
    `scripts/e2e_crystal_test.mjs`, not yet fully reachable through a polished UI). The e2e test
    proves the two explicit isolation requirements Isaac asked for: cross-org separation and
    worker-level isolation (an unassigned worker sees nothing in "mine," cannot self-assign, and
    cannot complete a job they're not on).
15. **Marketing automation built (§17, restored scope) — with a real mid-build correction worth
    recording**: the first draft of this migration created brand-new `marketing_brands`/
    `marketing_content_items`/`marketing_platform_posts` tables. Before applying it, the live
    database was checked directly and found to ALREADY contain real, seeded `marketing_brands`
    rows (two actual brand identities — "Isaac / Zion — Personal" and "Nova Systems — Company,"
    with real content_pillars/voice_notes/never_say/always_say, dated 2026-08-12, predating this
    session) plus empty `content_ideas`/`content_assets` tables clearly designed for this exact
    purpose (content_ideas even already had a `journey_entry_id` column pointing at Zion's
    journal). A full repo grep confirmed zero application code read or wrote any of them — schema
    without a workflow, not a competing implementation. Per the master prompt's own "reconcile
    existing product definitions rather than silently overwriting them" rule, the migration was
    **rewritten before ever being applied** to extend those three real tables via `ALTER TABLE ADD
    COLUMN IF NOT EXISTS` instead of creating parallel ones, and `api/client.js`'s handlers were
    rewritten to match — pg-mem validated 8/8 against the REAL pre-existing shape (seeded with the
    actual existing row structure, not an idealized fresh schema). Only `marketing_campaigns` and
    `marketing_publishing_adapters` (exact §19 status vocabulary, every platform honestly seeded
    `not_implemented`) are genuinely new tables. Implements the real content pipeline
    (idea→brief→drafted→fact_checked→approved, `admin.view`-gated approval, fact-check requires
    real source_notes) and per-platform variants where `publish_mode` is derived from the real
    adapter state, never client-asserted (an unconnected platform is always forced to
    `manual_export`, an honest human handoff, never claimed as a real publish). Newsletter
    suppression is real: a new public `unsubscribe` action actually flips `subscribed=false` in
    the database. `scripts/e2e_marketing_automation_test.mjs` proves all of this and fails fast
    correctly. No frontend page built yet for this domain — flagged honestly as remaining scope,
    same as Crystal's estimate-builder/job-detail UI.

## What has deliberately NOT been attempted

Live voice/phone infrastructure (§11) has a concrete recommendation
(`docs/RUNTIME_HOSTING_RECOMMENDATION.md`) but no code against a specific provider yet — writing
Twilio Media Streams / Deepgram / ElevenLabs integration code before Isaac confirms the self-hosted
vs. managed-platform decision would risk building against the wrong stack. Broader multi-channel
marketing automation beyond blog content review (social scheduling across TikTok/Instagram/
LinkedIn/YouTube/Facebook, email campaign sequencing with stop-on-reply/unsubscribe/budget limits)
is still zero-implementation — this is real, substantial remaining scope from §17's restored
requirements, not yet started. Cost-per-org/provider tracking and incident escalation on top of the
new job queue (§20's remaining scope) are not built. Starting any of these shallowly would produce
exactly the "scaffold with no real domain logic" the master prompt prohibits — each needs its own
properly-scoped pass.

## Exact next task

With R14 (Crystal) and R19 (durable runtime foundation) both moved to locally-verified today, the
largest remaining real scope is §17's multi-channel marketing automation (social/email beyond blog
review) — credential-free and locally-testable for everything up to actual publishing (platform
adapters can be built with honest "not implemented"/"authorization required" states exactly like
the Integration Center already does, per §19's own status vocabulary). R12 (voice) has a concrete
recommendation now but is waiting on Isaac's self-hosted-vs-managed decision before any
provider-specific code is worth writing.

## Owner-action items currently blocking further automated progress

1. **Run ten SQL migration files** in the Supabase SQL Editor, in this order (all reviewed for
   safety; every statement is either `IF NOT EXISTS`-additive or a narrow, idempotent UPDATE/
   backfill on a column this same file just added — never touching pre-existing data — explained
   in each file's own header comment):
   - `supabase/academy-migration-standalone.sql`
   - `supabase/hiring-workflow-migration-standalone.sql`
   - `supabase/crm-order-audit-migration-standalone.sql`
   - `supabase/zion-studio-migration-standalone.sql`
   - `supabase/approval-inbox-migration-standalone.sql`
   - `supabase/installation-center-migration-standalone.sql` (depends on `orders` from the
     crm-order-audit migration — run that one first)
   - `supabase/marketing-content-workflow-migration-standalone.sql` (alters the existing, live
     `blog_posts` table)
   - `supabase/durable-jobs-migration-standalone.sql`
   - `supabase/crystal-migration-standalone.sql`
   - `supabase/marketing-automation-migration-standalone.sql` (alters the existing, live
     `marketing_brands`/`content_ideas`/`content_assets` tables — real, seeded `marketing_brands`
     rows already exist and are preserved untouched; see the file's own header for how that
     reconciliation was discovered)
   - (older sections are also appended to the cumulative `supabase/schema-update.sql` for the
     historical record, but every standalone file above is what's actually meant to be run — that
     cumulative file has NOT been kept in sync with the CRM/Zion/Approvals/Installation/Marketing/
     Jobs/Crystal migrations, a stale claim in an earlier version of this doc corrected here)
2. **Create three Storage buckets** (this session's own permission system blocked direct creation
   — flagged as a shared-resource modification, not bypassed):
   - `portfolios` — **private**, ~5MB file size limit (resumes/application uploads)
   - `nova-vault` — **private**, ~10MB file size limit (invoices, signed contracts, generated
     documents — code already updated to use short-lived on-demand signed URLs, not a permanent
     public link, so this is purely bucket creation now, no further code change needed first)
   - `portfolio` — **public**, ~5MB file size limit (marketing case-study images, intentionally
     public)
3. **Investigate `isaac@nova-systems.app`'s Supabase Auth rejection** in Dashboard →
   Authentication → Email / URL Configuration, or use `isaac_0427@icloud.com` (confirmed correct
   membership, already has a working reset path) going forward.
4. **Formally approve or reject the 80% Academy quiz-passing threshold** — currently a proposed
   default in `api/academy.js`'s `SCORE_THRESHOLD_PERCENT` constant. Does not block other work.
5. **Supply Zion's existing character reference assets** before the render step can produce
   anything — every other part of the Studio is built and works without them.
6. **Create a Fly.io account and authorize ~$2-8/month** for one small always-on machine to run
   `worker/index.mjs` (concrete recommendation with sourced pricing in
   `docs/RUNTIME_HOSTING_RECOMMENDATION.md` — no longer an open question, a specific action).
7. **Decide self-hosted voice (Twilio + Deepgram + ElevenLabs, recommended) vs. a managed platform
   (Vapi/Retell/Bland)** — see the runtime doc's §4 for the real cost/tradeoff comparison. Not
   needed to use the worker for durable jobs/scheduling, only for live call answering.
8. **Confirm the Vercel account's actual current plan/tier** in the dashboard — this project has
   always assumed Hobby, never independently re-verified via API (no token exists in this
   environment).

After the SQL files run: `node scripts/e2e_academy_auth_test.mjs`,
`node scripts/e2e_hiring_workflow_test.mjs`, `node scripts/e2e_crm_order_audit_test.mjs`,
`node scripts/e2e_zion_studio_test.mjs`, `node scripts/e2e_approval_inbox_test.mjs`,
`node scripts/e2e_installation_center_test.mjs`, `node scripts/e2e_marketing_content_workflow_test.mjs`,
`node scripts/e2e_crystal_test.mjs`, and `node scripts/e2e_marketing_automation_test.mjs` each give
real, immediate, live pass/fail evidence for their respective domains — none of this has been
claimed as passing against production, and won't be until these actually run and are reported
honestly either way. `node scripts/unit_job_queue_test.mjs`
and `node worker/index.mjs --local --enqueue-demo --once` already pass/run today with zero
dependency on the migrations above.
