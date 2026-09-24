# Nova Product Build — State Checkpoint

Last updated: 2026-09-23, commit pending (post-Approval-Inbox). Written per the master execution
prompt's §23 requirement to maintain a real, resumable checkpoint rather than claim unattended
progress across a session boundary this environment cannot actually cross.

## Where this build actually is

This is a genuinely large scope — 24 sections describing what amounts to a full multi-tenant
SaaS platform. It has not been built in one pass, and claiming otherwise would violate the master
prompt's own explicit instructions. See `docs/requirement-matrix.md` for the full module-by-module
status (source of truth; this document is the narrative checkpoint, not a duplicate of it).

As of this update: identity/tenancy, the dashboard shell, Sales Academy, hiring pipeline, shared
CRM foundations (businesses/contacts/deals), the product catalog, the order lifecycle, the full
Nova Audit domain (cases/evidence/findings/recommendations/reports/deliveries/outcomes, with a
real, independently unit-tested deadline clock), Zion Studio (journal/facts/ideas/scripts/
production/review), the Integration Center (found already complete on inspection — see below), and
the Approval Inbox (aggregation + generic consequential-action approval/reject/revoke) are all
real, tested code. Six migration files are written, safety-reviewed, and NOT yet applied to
production (this environment has no DDL access — never has, this whole project). Three storage
buckets are specified and NOT yet created (blocked by this session's own permission system, not
bypassed). Voice/phone infrastructure, the Installation Center UI, Crystal, marketing automation,
and durable worker infrastructure have not been started.

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
  `scripts/e2e_zion_studio_test.mjs`, `scripts/e2e_approval_inbox_test.mjs`, plus the pre-existing
  `e2e_academy_auth_test.mjs`/`e2e_hiring_workflow_test.mjs`) run against the actual Supabase
  project using real throwaway orgs/users, cleaned up after. All five domain-specific scripts
  currently fail fast with a clear "table not found" error — an honest, correct result, since none
  of their target migrations have been applied yet. This is not being reported as a pass.

Every pre-existing permanent regression suite (org isolation 8/8, API client auth 22/22, login
path 12/12) has been re-run after every change this session and still passes — no regressions.

## This session's real work (2026-09-23, chronological)

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

## What was deliberately NOT attempted this session

Voice/phone infrastructure (§11) needs a real hosted persistent-connection runtime decision before
any code is worth writing — Vercel's serverless functions cannot host live call audio, and no
telephony provider is configured. The Installation Center's actual UI/workflow (sandbox tests,
activation authority, pause/offboard, the two-independent-test-org isolation proof) is not built —
only its underlying data model (product catalog + order lifecycle) is. Crystal, marketing
automation, and durable worker/queue infrastructure are all still zero-implementation. Starting any
of these shallowly would produce exactly the "scaffold with no real domain logic" the master prompt
prohibits — each needs its own properly-scoped pass.

## Exact next task

Per §23's dependency order and the requirement matrix's own "not started" list (R12 voice, R16
marketing/SEO engine, R17 Crystal, R19 durable workers), every remaining not-started module needs
either live provider credentials, a hosting/runtime decision, or is explicitly gated behind other
modules per the master prompt's own dependency order (Crystal behind R10-R13). The next
dependency-ready, credential-free, locally-testable increment is the **Installation Center's actual
UI/workflow** (§13) — its underlying data model (product catalog + order lifecycle, R14) is already
built and tested; what remains is the sandbox-test flow, activation authority, pause/offboard
controls, and the two-independent-test-org isolation proof (T13), all of which can be built and
pg-mem/e2e-tested the same way as everything else in this checkpoint without needing owner
decisions first.

## Owner-action items currently blocking further automated progress

1. **Run six SQL migration files** in the Supabase SQL Editor (all reviewed for safety — every
   statement is additive, `IF NOT EXISTS`/`ON CONFLICT`, zero destructive statements):
   - `supabase/academy-migration-standalone.sql`
   - `supabase/hiring-workflow-migration-standalone.sql`
   - `supabase/crm-order-audit-migration-standalone.sql`
   - `supabase/zion-studio-migration-standalone.sql`
   - `supabase/approval-inbox-migration-standalone.sql`
   - (the equivalent sections are also appended to the cumulative `supabase/schema-update.sql`
     for the historical record, but the five standalone files above are the ones meant to be run)
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
6. **A hosting/runtime decision for voice/phone and durable workers** (§11/§20) before any of
   that code is worth writing — current architecture is 100% short-lived Vercel serverless
   functions, which cannot host live call audio or long-running background jobs.

After the SQL files run: `node scripts/e2e_academy_auth_test.mjs`,
`node scripts/e2e_hiring_workflow_test.mjs`, `node scripts/e2e_crm_order_audit_test.mjs`,
`node scripts/e2e_zion_studio_test.mjs`, and `node scripts/e2e_approval_inbox_test.mjs` each give
real, immediate, live pass/fail evidence for their respective domains — none of this has been
claimed as passing against production, and won't be until these actually run and are reported
honestly either way.
