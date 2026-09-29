# Nova Audit + Wave One MVP — Owner Actions

Everything below needs a decision, credential, or dashboard access that cannot be done from the
development environment. Nothing here has been done. See `docs/NOVA_MVP_ACCEPTANCE.md` for the
evidence behind each item and `docs/NOVA_MVP_BUILD_STATE.md` for the narrative checkpoint.

This is scoped to the current MVP pivot (Nova Audit + Wave One → installation → measurement) —
for the still-relevant, still-unexecuted general platform setup (storage buckets, worker hosting,
provider accounts, the 71-table migration order, legal/pricing decisions), see
`docs/NOVA_PILOT_OWNER_ACTIONS.md`, which this document does not duplicate.

## A. Security migration authorization (highest priority — before any real client data)

**A-3 and A-2 are now prepared AND locally proven** (58 real-database checks across two new test
files, `scripts/e2e_schema_lockdown_test.mjs` and `scripts/e2e_org_membership_read_test.mjs`, both
100% passing against a real disposable local PostgreSQL+PostgREST). The migration lives in
`supabase/schema-update.sql` and `supabase/zz-public-schema-lockdown-standalone.sql`. **What's
needed from you now is authorization to apply it to staging, then production — not more
preparation work.** A-4 is investigated but not yet fixed (see below — it needs a larger change).

1. **A-3 (done, locally proven):** RLS enabled on 15 tables that were reachable with the public
   anon key — `client_accounts` (contains password hashes), `client_messages`, `vault_documents`,
   `intake_requests`, `notifications`, `nova_ai_agents`, `nova_ai_audits`, `nova_ai_calls` (call
   transcripts/recordings), `nova_ai_knowledge_bases`, `nova_ai_settings`, `nova_ai_sms_logs`,
   `nova_ai_voices`, `blog_posts`, `portfolio`, `social_posts`. (The original 11-table estimate was
   corrected upward to 15 with a ground-truth diff against every RLS statement in the repo.)
2. **A-2 (done, locally proven):** the `staff_read_all_organizations`/`staff_read_all_members`
   policy on `organizations`/`organization_members` is replaced with a real per-membership check,
   so a client-side user can no longer read every org's membership rows.
3. **Two related migration bugs also found and fixed while testing A-3/A-2:** a real
   production-affecting bug where `wave_one_applications` silently never got its `organization_id`
   column, index, backfill, or RLS policy on any fresh database (two conflicting `CREATE TABLE IF
   NOT EXISTS` definitions in the same file); and a local-test-environment-only staleness bug
   affecting 7 tables. See `docs/NOVA_MVP_ACCEPTANCE.md` for the full detail.
4. **A-4 (investigated, not fixed — needs a larger change):** add `organization_id`-scoped
   filtering (the same `requireOrgAccess()` pattern already
   used elsewhere in `api/client.js`) to the `invoices`/`referrals`/`intake-requests` handlers.

**Decision needed from Isaac:** for A-2/A-3, authorize applying the already-prepared, already
locally-proven migration — first to a disposable/staging environment for verification, never
directly to production as the first test. For A-4, authorize preparing that migration (not yet
written).

## B. Two naming/architecture decisions before further Audit or Wave One build work

1. **Two disconnected audit-intake systems** exist: `businesses`/`audit_cases` (the tested audit
   engine) and `intake_submissions`/`nova_ai_audits` (a separate `Intake.jsx` 20-step flow). No
   code bridges them. Which is canonical for the MVP, or should they be connected?
2. **Two things are both branded "Wave One"**: the real lead-capture/call/SMS/booking product
   (`api/_wave1*.js`, `PilotConsole.jsx`) and Nova's own sales-funnel cohort-application form
   (`Waves.jsx`/`api/waves-intake.js`, `WaveOne.jsx`). The master prompt's "Wave One systems"
   means the former — confirm this reading is correct, and decide whether the latter needs
   renaming to stop the collision.

## C. Confirmed-missing pieces — build authorization / scope confirmation

The audit report renderer is now **built** (a real "Download PDF" button on approved reports,
`src/utils/generatePdf.js`'s `generateAuditReportPDF()`). Still not built, per direct code
inspection (not a status claim carried over from an old doc): automated email delivery (the PDF
still has to be sent by hand today), Wave One voice agent (needs a provider decision — no cash
budget currently, so this stays deferred or dry-run only), Cal.com reschedule + inbound webhook,
manual reply from the Wave One inbox, a client-facing order/installation status portal (today only
staff-facing dashboards and a one-off token-gated proposal page exist — a signed-in client has
nowhere to see their own status), and any post-installation measurement/improvement loop (the one
adjacent table, `audit_outcomes`, is a manual metric log with zero connection to the install
journey). Confirm these are in scope for this MVP pass before they're built, since building any of
them is real, non-trivial work.

## D. Installation Center — apply migration to a reachable environment

`supabase/installation-center-migration-standalone.sql` defines a real, non-mock state machine
(`api/client.js:1620-1786`) but has never been applied anywhere reachable, so its behavioral test
(`scripts/e2e_installation_center_test.mjs`) fails fast on "table not found" — only schema
validity (pg-mem) has been proven. Needs the same staging-first treatment as item A before it can
be claimed "locally tested" in the real sense (executed, not just schema-valid).

## E. Everything already tracked elsewhere (not repeated here)

- Push/deploy state, database migration order, storage buckets, deployment environment variables,
  provider accounts (Twilio/Cal.com/worker host), and the legal/pricing/business decisions list —
  all still accurate and unexecuted per `docs/NOVA_PILOT_OWNER_ACTIONS.md`. Re-read it; nothing in
  this MVP pivot has changed those facts.
- `isaac@nova-systems.app`'s Supabase Auth rejection is a **Supabase-dashboard-side** issue (per
  prior session's finding), not an application bug — still needs to be resolved in the dashboard
  directly.

## F. After A–D are resolved

Only then: run Nova Systems itself through the complete journey as the first real client (per the
master prompt's own priority order), then prepare one consenting outside pilot — not before.
