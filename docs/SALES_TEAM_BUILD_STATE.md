# Nova Sales Team platform — build state (narrative checkpoint)

**Last updated:** 2026-09-27. **Overall status:** backend + UI + Academy content + docs complete and **locally verified**; nothing
installed to staging or production.

## What exists, in build order
1. `api/_sales/core.js` — shared plumbing (db helpers, auth, audit, tokens, storage, email/notify).
2. Migration part 1 (`sales-team-01…`) + `hiring.js`/`hiringRules.js` — applications, owner hiring workspace, secure invitations. Fixed a real production-adjacent bug along the way (candidate role rejected by the old CHECK constraint; an RLS gap that let any staff member read Nova-wide data; an overbroad `nova_sales` permission bundle; legacy `invite-applicant`/`activate-representative`/`update-application` endpoints in `api/intake.js` and `api/team.js` that bypassed the new owner-only controls — all now return 410 or are hardened).
3. Migration part 2 + `academy.js`/`academyRules.js`/`pdf.js` — Academy v2 engine (policy versioning, attempt gating, exercises, practicals, certificates). Content itself came later (part 7).
4. Migration part 3 + `documents.js`/`documentRules.js` — agreements/e-signature with a hash-chained tamper-evident event log, and the owner activation checklist.
5. Migration part 4 + `leads.js`/`pipelineRules.js`/`catalog.js` — rep pipeline on the *existing* CRM tables (no second CRM), prospect de-duplication, product readiness/toolkit.
6. Migration part 5 + `proposals.js`/`proposalRules.js`/`payments.js` — proposals, client e-signature, Stripe-verified payments, owner sale verification, fulfillment handoff (idempotent).
7. Migration part 6 + `commissions.js`/`commissionRules.js` — commission ledger (Estimated→Pending→Eligible→Owner Approved→Scheduled→Paid), payout batches, provider + externally-recorded payouts.
8. `notifications.js` + `worker/index.mjs`'s `sales_maintenance` job — honest delivery states, Resend webhook, maintenance sweep.
9. Migration part 7 (generated) — 10 Academy programs written out in full (50 lessons, 102 questions, 22 exercises, practical rubrics for programs 6–7, critical questions concentrated in 9–10), 25 draft toolkit items. Built via `scripts/academy_content/*` + `scripts/build_academy_content.mjs`, checked by `scripts/validate_academy_content.mjs` (structural + no-invented-claims lint).
10. Full front-end: public `/apply/sales`, `/join/:token`, `/proposal/:token`; representative workspace at `/rep/*`; Nova HQ → Sales Team at `/dashboard/sales-team/*`; the Academy learner UI is shared between the old `/dashboard/academy` route and the new `/rep/training` (`src/components/sales/Training.jsx`) so there's one implementation, not two.
11. Acceptance journeys A–D (`e2e_sales_journeys_test.mjs`, 72 checks) run one continuous story — application through payout — plus explicit negative cases (isolation, escalation, forgery, duplicates, retries, suspension).
12. Live-browser suite (`e2e_sales_browser_test.mjs`, 48 checks) drives the actual compiled front-end in a real headless browser against the real API and a real local database — not mocked responses.

## Known limitations (deliberate, not oversights)
- The candidate role check in `documentRules.js` treats manager-scoping via `visibleRepUserIds`; a manager who manages 0 reps sees an empty scope by design, not an error.
- `catalog.js`'s toolkit "approve" flow creates a new draft version on edit of an approved item; there is no delete, only retire — intentional (see `product_readiness_history`/append-only pattern used throughout).
- No SMS/voice provider is wired (out of the numbered scope for this build).
- Legacy `e2e_org_isolation_test.mjs`, `e2e_api_client_auth_test.mjs`, `e2e_login_path_test.mjs`, `e2e_hiring_workflow_test.mjs` were **not** re-run this session: the first three touch the real Supabase project via `.env.local` and were out of scope for a backend/UI build session; the fourth tests the now-410'd legacy hiring endpoints and is superseded by `e2e_sales_hiring_test.mjs`. Recommend running the first three before any production install, since `api/team.js`/`api/intake.js` were touched.

## Disclosure
During an early exploratory step this session, a direct API probe against **production** wrote one row into `organization_members`
(role `nova_sales`, no matching foreign-key constraint at the time). It was detected immediately, deleted, and the table was verified
back to its original 2 rows. No other production system was touched at any point in this build. Everything else described in this
document and its siblings ran only against the local disposable test environment described in `SALES_TEAM_INSTALLATION.md`.

## Next session should start with
1. Read `SALES_TEAM_OWNER_ACTIONS.md` with Isaac — nothing here is usable by a real rep until those approvals happen.
2. If continuing engineering work: SMS/voice integration was explicitly out of scope and is the largest remaining gap versus the
   original 24-section product prompt (`NOVA_PRODUCT_ONLY_MASTER_EXECUTION_PROMPT.md`), not versus this Sales Team master prompt.
3. Before a staging install: run the three real-Supabase legacy regression suites listed above against a non-production project.
