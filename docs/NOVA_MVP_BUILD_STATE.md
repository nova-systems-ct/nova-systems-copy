# Nova Audit + Wave One MVP — Build State

Narrative checkpoint for the scope pivot begun 2026-09-29 ("MASTER EXECUTION PROMPT — NOVA AUDIT
AND WAVE ONE WORKING MVP" / "MAKE NOVA WORK END TO END"). This is the chronological log; the
requirement-by-requirement evidence lives in `docs/NOVA_MVP_ACCEPTANCE.md` — read that first for
current status, this file for how we got here and what's next.

The prior phase (Nova Organizational Hierarchy — Phases B/C/D, Meeting Engine, Command Center) is
**paused, not abandoned**, per Isaac's explicit instruction. Its checkpoint is recorded at the top
of `docs/NOVA_HIERARCHY_BUILD_STATE.md`. Nothing from that phase is touched by the work below.

## 2026-09-29 — Baseline inspection

Four parallel code surveys (Nova Audit journey, Wave One systems, Installations/Proposals/
Payments/Dashboards, Auth/Security/Isolation) plus direct reads of `api/_twilio.js`,
`api/_auditResearch.js`, git state, and the Vercel function count. Findings synthesized into
`docs/NOVA_MVP_ACCEPTANCE.md`. Two real security gaps were cheap enough to fix immediately without
an owner decision, so they were fixed the same session rather than left as findings-only:

- **Gap A-1 (fixed, local/uncommitted):** `/set-password` and `/employee-dashboard` were live
  routes to a pre-Supabase, localStorage-only "auth" model (`nova_employee_accounts`/
  `nova_applicant_session`, trivially forgeable from devtools), superseded by real Supabase-Auth
  `ApplicantLogin.jsx`/`ApplicationStatus.jsx` but never removed. Deleted `SetPassword.jsx` and
  `EmployeeDashboard.jsx`; both routes now redirect to `/applicant-login`. `npm run build` clean.
- **Gap A-5 (fixed, local/uncommitted):** three legacy Stripe entry points in `api/stripe.js`
  (`handleCheckoutSession`, `handlePaymentIntent`, `handleSetupIntent` — used by invoice pay-now
  links, `/onboard`, `/intake`) had no live/test-mode gate at all; only the newer Sales Team
  proposal-payment path (`api/_sales/payments.js`) checked `SALES_ALLOW_LIVE_STRIPE` before
  allowing a `sk_live_` key to charge anything. Imported and applied the same `stripeAllowed()`
  gate to all three. `node --check` clean on both files. No dedicated test exists for these three
  handlers — the fix is code-verified, not test-verified; flagged in the acceptance matrix rather
  than glossed over.

Remaining open gaps at the end of this first session (A-2 and A-3, listed below as first written,
were fixed later the same day — see the next section):

- **A-3 (highest severity at the time):** several tenant/PII tables (`client_accounts` with
  password hashes, `vault_documents`, `nova_ai_calls`/`nova_ai_sms_logs`, `intake_requests`,
  `notifications`, and others) have no RLS and are not covered by the schema-lockdown script —
  reachable with the public anon key already in the browser bundle.
- **A-2:** an overly-broad `organizations`/`organization_members` staff-read policy inherited from
  an external migration, not present in this repo, grants any staff-typed row cross-org read
  access.
- **A-4:** `invoices`/`referrals`/`intake-requests` handlers in `api/client.js` are
  permission-gated but not organization-scoped.
- Two disconnected audit-intake systems (`businesses`/`audit_cases` vs.
  `intake_submissions`/`nova_ai_audits`) and two things both branded "Wave One" — need an explicit
  canonical-path decision from Isaac before further Audit/Wave-One build work.
- Confirmed **not built**: audit report renderer/email delivery, Wave One voice agent, Cal.com
  reschedule/webhook, manual inbox reply, a client-facing order/installation status portal, and any
  post-installation measurement/improvement loop connecting `audit_outcomes` to the
  sales→install journey.
- Installation Center's state machine (`api/client.js:1620-1786`) is real, non-mock code but its
  migration has never been applied anywhere reachable — its behavioral e2e test fails fast on
  "table not found." Schema-valid (pg-mem), never actually executed.

## 2026-09-29 (continued) — Gaps A-2/A-3 prepared and proven; audit report renderer built

Responding to Isaac's follow-up master prompt ("FINISH NOVA'S WORKING MVP"), which explicitly
authorized "additive migration preparation" and "local disposable database... testing" without
needing a separate go-ahead per item. Re-verified the prior session's specific factual claims
(git state, the two fix summaries) before proceeding, per the prompt's own "verify, don't repeat
the whole audit" instruction — all confirmed accurate.

- **Gap A-3 (fixed, local/uncommitted):** corrected the table count from 11 to **15** via a
  ground-truth diff (every table in `supabase/*.sql` against every `ENABLE ROW LEVEL SECURITY`
  statement, whitespace-tolerant regex — an earlier ad-hoc check under-counted from a regex bug,
  caught before it caused wrong output). Added all 15 to
  `zz-public-schema-lockdown-standalone.sql`. Fixed `check_migration_lockdown.mjs` itself: it only
  scanned `*-standalone.sql` files, so `schema-update.sql` — where all 15 tables live — was never
  checked at all; also fixed a logic gap that would have required lockdown-list membership even
  for tables with their own legitimate RLS policy. New `scripts/e2e_schema_lockdown_test.mjs`
  proves it against a real local disposable PostgreSQL+PostgREST: 48/48 passing, including a
  concrete proof that a real `client_accounts` row's `password_hash` cannot be read by the anon
  key, while the service role (what every real handler uses) still can.
- **Two real migration bugs found and fixed while building that test** (unrelated to RLS, found
  because the test runs the real migration set): (1) `wave_one_applications` had two conflicting
  `CREATE TABLE IF NOT EXISTS` definitions in `schema-update.sql` — the older one (no
  `organization_id`) always won the `IF NOT EXISTS` race, so the later "2026-09-20 BUG FIX"
  version's column, index, backfill, and RLS policy have never actually applied on any fresh
  database, including production if it's ever been migrated there. Removed the stale duplicate,
  added an idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` guard for databases where the
  stale version already ran. (2) The local test harness's own `scripts/testenv/bootstrap.sql` had
  stale, column-incomplete stub definitions for 7 tables under a header claiming schema-update.sql
  only "ALTERs" them — false for all 7 — silently masking real schema for those tables in every
  local test run. Removed the 7 stale stub lines. Neither of these was something the master prompt
  asked for directly; both were surfaced by actually running the migration set against a real
  database rather than trusting a static file-content check.
- **Gap A-2 (fixed, local/uncommitted):** replaced the inherited
  `staff_read_all_organizations`/`staff_read_all_members` policy (external, production-only,
  never in this repo) with a real per-membership check (`is_org_member()`/own-row), same pattern
  already used everywhere else in the file. New `scripts/e2e_org_membership_read_test.mjs`: 10/10
  passing against a real local disposable PostgreSQL+PostgREST — two real users in two throwaway
  orgs, each provably limited to their own org and membership row, a forged org-id query-string
  filter granting nothing, anon getting zero rows, service role unaffected.
- Regression check after all of the above: re-ran `e2e_schema_lockdown_test.mjs` (48/48),
  `e2e_audit_engine_test.mjs` (27/27), `e2e_sales_closing_test.mjs` (97/97),
  `e2e_api_client_auth_test.mjs` (22/22) — all clean. 204 real-database checks total this session
  across 5 suites, 0 regressions.
- **Audit report renderer (built, local/uncommitted):** `generateAuditReportPDF()` added to
  `src/utils/generatePdf.js`, reusing the exact `header()`/`sectionHeading()`/`addSection()`
  pattern already proven for contracts/invoices/certificates. Wired into `AuditCaseDetail.jsx`'s
  report tab as a real "Download PDF" button, shown only for `status==='approved'` reports, so it
  can only ever render exactly the approved, content-hash-bound section content — never a draft.
  Two stale UI strings that said "no PDF/document renderer exists" and "no report document
  generator... wired" were updated to match reality. `npm run build` clean. No dedicated test for
  the renderer itself (no headless-PDF/snapshot harness exists in this repo yet).
- **A-4 investigated, not fixed:** `intake_requests` has no `organization_id` column at all
  (unlike `client_invoices`/`referral_tracking`, which already do) — this gap needs a
  column-adding migration plus handler changes across three resources, a larger, more invasive
  change than A-1/A-2/A-3/A-5. Deferred rather than rushed.
- Tool availability note: the Edit/Bash safety classifier returned repeated transient errors
  mid-session (not content-specific — verified by testing an unrelated trivial edit, which also
  failed the same way). Used the enforced wait-and-retry discipline rather than working around it;
  all planned work completed once it recovered.

## What's next

Per the master prompt's priority order: (1) get Isaac's authorization to apply the now-prepared
and locally-proven A-2/A-3 migration to staging then production, (2) fix A-4 (needs a schema
change, larger than the others), (3) reconcile the intake/Wave-One naming decisions, (4) build the
still-confirmed-missing pieces (automated report delivery/email, Wave One inbox reply, Cal.com
webhook, client status portal, measurement loop), (5) run Nova Systems itself through the complete
journey as the first real client, (6) prepare one controlled outside pilot.
Local-disposable-Postgres testing (`scripts/testenv/`) remains the primary evidence class;
Supabase staging only with explicit authorization.
