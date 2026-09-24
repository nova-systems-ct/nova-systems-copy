# Nova Product Build — Requirement Matrix

Generated 2026-09-23 against commit `69fef38` (plus the login-path verification work landing
alongside this document). Tracks the 24-section "NOVA — PRODUCT-ONLY MASTER EXECUTION PROMPT"
against verified repository/live-database/live-production evidence — not intent, not what a
previous prompt described, not what a route's mere existence implies.

**Status vocabulary** (per the master prompt's own definitions): `not started` · `in development`
· `locally verified` · `staging verified` · `waiting on owner/provider` · `ready for
installation` · `installed` · `live verified`.

**How to read this table**: "Evidence" cites the actual file, migration, or test run that backs
the status — not a description of intended behavior. Where a prior session's report turned out to
be wrong (the VITE_SUPABASE_URL login theory), that correction is noted explicitly rather than
silently dropped.

| ID | Source | Module | Depends on | Current evidence | Acceptance test | Status | Blocker |
|----|--------|--------|-----------|-------------------|------------------|--------|---------|
| R01 | §4 | Login path — system-level correctness | Supabase Auth, canonical RBAC | Live-verified 2026-09-23: production URL/CSP/anon key all correct (re-checked); `scripts/e2e_login_path_test.mjs` 12/12 against live DB (wrong-password rejection, real session issuance/persistence/sign-out, no-membership = zero access, revoked membership = zero access, active membership = full access — all via real RPC calls as the actual user, not service-role); real Playwright run against `https://nova-systems.app/login` with a throwaway account reached `/dashboard`, survived a refresh, rendered real content, zero console errors, and an unauthenticated direct hit to `/dashboard/admin` correctly redirected to `/login` | T01 (partial — no real owner account tested) | **live verified** (system level) | none — this module works |
| R02 | §4 | Login path — Isaac's specific account | R01 | `isaac@nova-systems.app`: confirmed, not banned, real historical successful sign-in on file. A password-reset request for it is REJECTED by Supabase itself (`email_address_invalid`) despite `nova-systems.app` having a valid MX record (ruled out as a DNS/deliverability issue). `isaac_0427@icloud.com`: reset email dispatched successfully (200) — untested whether Isaac completed it | Isaac completes a real reset/login using `isaac_0427@icloud.com`, or investigates the `email_address_invalid` rejection in Supabase Dashboard → Authentication → Email/URL Configuration | **waiting on owner** | Requires Isaac's own Supabase Dashboard access — no Management API token exists in this environment to inspect or fix Auth email-validation settings |
| R03 | §3 | Canonical identity/tenancy/RBAC foundation | — | `organizations`/`organization_members`/`permissions`/`role_permissions` live in production since Stage 4 (2026-09-13); `scripts/e2e_org_isolation_test.mjs` 8/8 and `scripts/e2e_api_client_auth_test.mjs` 22/22, both re-run 2026-09-23, both still passing | T02 | **live verified** | none |
| R04 | §7 | Six-hub dashboard shell (Overview/Intelligence/Growth/Execution/Companies/Admin) | R03 | Shipped Stage 3-4.1; `src/components/dashboard/DashboardLayout.jsx`, real permission-filtered nav, org switcher | — | **live verified** (shell only — module *contents* vary, see below) | Owner/company split view (§7's "Run Nova / Run Companies") NOT built — current shell is single-context, not yet split |
| R05 | §7/§12 | Growth hub — Leads | R03 | `src/pages/dashboard/Leads.jsx`, real org-scoped Supabase query, no fake data | T02 | **live verified** | Full CRM pipeline stages (§12) NOT built — current Leads page is list-only, no pipeline/stage-history/outreach |
| R06 | §7 | Growth hub — Referrals, Wave One (legacy), Blog, Portfolio, Newsletter | R03 | Pre-existing pages, real Supabase-backed as of the 2026-09-21/23 fake-data repair pass (`Newsletter.jsx` real as of commit `2abbf5e`) | — | **live verified** | "Wave One" here is the legacy application-tracking page, NOT §10's communications/CRM bundle — these are different things sharing a name, not yet reconciled |
| R07 | §6/§15 | Nova Sales Academy (10 programs, quiz engine, certificates) | R03, migration | Fully coded: `api/academy.js`, `src/pages/dashboard/Academy*.jsx`, schema in `supabase/academy-migration-standalone.sql`. `scripts/e2e_academy_auth_test.mjs` written (13 checks) — fails fast on missing schema, confirmed unchanged today | T08 (partial) | **locally verified** (code), **waiting on owner** (schema) | Migration not applied — no DDL access from this environment |
| R08 | §15 | Hiring pipeline (application → invite → candidate → Academy → practical review → agreement → activation) | R03, R07, migration | Fully coded: `api/intake.js` (invite-applicant/my-application/resume-signed-url/activate-representative), `api/contracts.js` (application_id linkage), `nova_sales_candidate` role. `scripts/e2e_hiring_workflow_test.mjs` written (13 checks) — fails fast on missing schema, confirmed unchanged today | T08 | **locally verified** (code), **waiting on owner** (schema) | Same migration file as R07, plus the storage-bucket blocker (R09) for private uploads specifically |
| R09 | §3/§15 | Private file storage (resumes, contracts, invoices, generated docs, portfolio images) | — | **Real defect found 2026-09-23**: none of the three buckets this codebase references (`portfolios`, `portfolio`, `nova-vault`) exist in production — confirmed live via Storage Admin API (404 on all three). Every upload path in the app has been silently failing. Code rewritten to the correct target state (private path storage + on-demand signed URLs for resumes, `_vaultStorage.js` unchanged pending the same bucket-creation step) | T09 | **waiting on owner** | Bucket creation attempt was blocked by this session's own permission classifier ("Modify Shared Resources"); exact spec below in the build-state doc |
| R10 | §8 | Nova Audit / diagnostic engine (evidence, findings, report builder, 24-72h clock, delivery) | R03 | `/business-diagnostic` public page exists (marketing copy only); `docs/current-state-audit.md`/`docs/product-requirements.md` from an earlier Phase 0 pass describe intended scope. **No case/evidence/finding/recommendation/report domain model exists in the schema or API today** | T03 | **not started** | Needs its own schema design session — largest single remaining domain, not something to bolt onto existing tables |
| R11 | §10 | Wave One (real communications-to-CRM bundle as specified in §10) | R03, R23 (voice) | `api/waves-intake.js`/`WaveOne.jsx` exist but implement a much narrower thing: an application/enrollment tracker for a past "Wave One" product launch, not missed-call handling, inbound routing, or a unified inbox. §10's actual scope has no implementation | T05 | **not started** | Name collision with R06 needs Isaac's explicit reconciliation before building — do not silently rename or merge |
| R12 | §11 | 24/7 AI voice/call agents | R03 | Zero implementation. No telephony provider credentials configured in `.env.local` (checked: no Twilio voice-specific webhook handler, no persistent-connection runtime) | T05 | **not started** | Needs a hosted, persistent-connection-capable runtime — current Vercel serverless functions cannot host live call audio; provider/account decisions needed first |
| R13 | §12 | CRM pipelines, outreach, calendar engine, workflow builder | R03 | Only the Leads list (R05) exists. No deal/pipeline model, no outreach sequencing, no calendar/booking engine, no workflow runtime | T06/T07 | **not started** | — |
| R14 | §13 | Installation Center (product catalog, order states, client provisioning) | R03 | Zero implementation — no product catalog table, no order-state machine | T13 | **not started** | — |
| R15 | §16 | Zion Studio (journal → character video pipeline) | R03 | Zero implementation. No character reference assets located in the repository | T11 | **not started** | Blocked on Isaac supplying the existing Zion character reference assets — building rendering without them would mean inventing an unapproved appearance |
| R16 | §17 | Marketing/content/SEO engine | R03 | Zero implementation beyond the existing public Insights blog (content-only, no workflow/approval/scheduling) | T12 | **not started** | — |
| R17 | §14 | Crystal / Company 002 operational workspace | R03 | Zero implementation. Naming still provisional per historical context | T10 | **not started** | Blocked behind R10-R13 per this prompt's own dependency order (§23 step 8 comes after CRM/Audit/Wave One) |
| R18 | §19 | Integration Center, Approval Inbox | R03 | Zero implementation as a unified system. Individual ad-hoc provider calls exist (Stripe, Resend, Twilio SMS, Anthropic) but no registry/status-tracking/approval-versioning layer | T14 | **not started** | — |
| R19 | §20 | Durable workers/queues, cost tracking, incident monitoring | R03 | Zero implementation — current architecture is 100% Vercel serverless functions (request/response only), no worker/queue infrastructure exists | T15 | **not started** | Needs an explicit hosting decision (Vercel Cron? external worker host?) before any code — this is infrastructure, not application logic |
| R20 | §9 | Vercel function capacity | — | Re-verified 2026-09-23: exactly 12 of 12 top-level `api/*.js` files. Confirmed still the actual constraint (not assumed) — this is the real current plan limit, not an unverified carryover number | — | **live verified** | Any new top-level endpoint requires consolidating into an existing file or confirming a plan upgrade with Isaac |

## What this table intentionally does NOT do

It does not restate every one of the master prompt's ~200 individual acceptance criteria as a
separate row — that would produce a document nobody reads rather than one that's actually used to
track real work. Each row above represents one coherent module; the "Current evidence" column
points at the actual code/test/live-check backing the status claim, so any row can be re-verified
independently rather than taken on faith.

## Summary counts

- **Live verified**: R01 (system-level login), R03, R04 (shell), R05, R06, R20 — 6
- **Locally verified, waiting on owner for schema/infra**: R07, R08, R09 — 3
- **Waiting on owner (no code blocker)**: R02 — 1
- **Not started**: R10, R11, R12, R13, R14, R15, R16, R17, R18, R19 — 10

Ten of twenty tracked modules have not been started at all. This matrix will be updated, not
replaced, as each module moves — see `docs/PRODUCT_BUILD_STATE.md` for the live checkpoint and
exact next task.
