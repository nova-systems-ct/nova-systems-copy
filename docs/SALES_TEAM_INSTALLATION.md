# Nova Sales Team platform — installation package

**Status of everything below: NOT applied to production.** Nothing in this package has been run against the live Supabase project,
Vercel, Resend or Stripe. Every migration, endpoint and screen was verified only against a **local, disposable** PostgreSQL + PostgREST
with stand-ins for Supabase Auth/Storage, Resend and Stripe (see "What the tests do and do not prove").

Status vocabulary (project standard): not started / in development / locally verified / staging verified / waiting on owner-provider /
ready for installation / installed / live verified. Today: **locally verified; ready for an isolated (staging) install; not installed.**

---

## 1. Do this in an ISOLATED environment first
Create a separate Supabase project (or a branch/database) and a Vercel preview deployment. Run steps 2–7 there, run the checks in
section 8, and only then repeat in production. Do not run the migrations in production first "to see".

## 2. Migrations — one sequence, dependency order
Run each file in the Supabase SQL editor, top to bottom, in this order. **Every file is idempotent** (safe to re-run) and additive; skip
a file only if you have confirmed it is already applied.

| # | File | What it adds |
|---|------|--------------|
| 0a | `supabase/schema-update.sql` (run statement-by-statement if it aborts as one transaction) | legacy cumulative base (only if not already applied) |
| 0b | `supabase/academy-migration-standalone.sql` | Academy programs/lessons/quiz/enrollments/certificates + 10 seeded programs |
| 0c | `supabase/hiring-workflow-migration-standalone.sql` | hiring workflow base (legacy) |
| 0d | `supabase/crm-order-audit-migration-standalone.sql` | businesses, crm_contacts/deals/activities/proposals, products, orders, audit tables |
| 0e | `supabase/approval-inbox-migration-standalone.sql` | approval inbox |
| 0f | `supabase/durable-jobs-migration-standalone.sql` | durable job queue |
| 1 | `supabase/sales-team-01-access-and-hiring-migration-standalone.sql` | roles/permissions, audit log, config, reps, hiring tables, notifications; **replaces** the broad `members_read_*` policies on Nova-wide tables with permission-based ones (see warning) |
| 2 | `supabase/sales-team-02-academy-v2-migration-standalone.sql` | policy versions, lesson progress, attempts, exercises, practicals, certificates v2; seeds the passing policy as **pending approval** |
| 3 | `supabase/sales-team-03-documents-and-activation-migration-standalone.sql` | agreement templates (empty), versions, signature requests, hash-chained events, rep notes/history |
| 4 | `supabase/sales-team-04-pipeline-catalog-toolkit-migration-standalone.sql` | rep pipeline columns/stages on `crm_deals`, duplicate keys, history, product sales-readiness, toolkit, audit-terms (pending) |
| 5 | `supabase/sales-team-05-proposals-closing-migration-standalone.sql` | proposal pricing/signature fields + immutability, provider events, payments, verification, scope exceptions, order de-dup |
| 6 | `supabase/sales-team-06-commissions-payouts-migration-standalone.sql` | commission ledger + events, payout accounts/batches/payouts, DB guards |
| 7 | `supabase/sales-team-07-academy-content-migration-standalone.sql` | GENERATED: 10 programs of content (50 lessons, 102 questions, 22 exercises), practical briefs/rubrics, 25 **draft** toolkit items — all *pending owner review* |
| **LAST** | `supabase/zz-public-schema-lockdown-standalone.sql` | enables RLS and revokes anon/authenticated writes on every table above. **Must run after all others.** Re-run it after any later migration that adds tables (`node scripts/regen_lockdown.mjs` regenerates its list). |

> **Warning (part 1):** it drops and recreates the read policies on `leads, referral_tracking, wave_one_applications, contact_submissions,
> newsletter_*, intake_submissions, clients, contracts, client_invoices, meetings, nova_tasks, businesses, crm_*, orders, audit_cases,
> wave1_*, pilots, approval_requests` so they are granted by `has_permission(...)` instead of "any member of the org". Effect: the
> `nova_sales` role (and the new candidate/manager/finance roles) can no longer read Nova-wide data through the database API. This is
> intended (it fixed a real leak found in testing) but it changes existing behaviour for any non-owner staff account — check with
> `docs/permissions-matrix.md` before running in production.

Regenerating content: `node scripts/build_academy_content.mjs` rewrites migration 7 from `scripts/academy_content/*` and refuses to run if
the content fails `scripts/validate_academy_content.mjs`. Re-running migration 7 never overwrites a program the owner already approved.

## 3. Environment variables (server-side only — never in the browser bundle, never in git)
| Variable | Purpose | Safe default |
|----------|---------|--------------|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | existing | — |
| `APP_BASE_URL` | absolute URL used in emailed links (`/join/…`, `/proposal/…`, `/apply/continue`) | `https://nova-systems.app` |
| `SALES_EMAIL_MODE` | `dry_run` (record, do **not** send) or `live` | `dry_run` |
| `SALES_EMAIL_ALLOWLIST` | comma list of addresses/`@domains`; in `live` mode anything else is recorded as **blocked** | none |
| `RESEND_API_KEY`, `SALES_FROM_EMAIL` | outbound email | unset → `failed: RESEND_API_KEY is not configured` |
| `RESEND_WEBHOOK_SECRET` | verifies Resend (Svix) delivery callbacks at `/api/stripe` | unset → callback answered 503 |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | client payment links + verified webhooks | unset → online payment "not available" |
| `SALES_ALLOW_LIVE_STRIPE` | must be `yes` before a **live** (`sk_live…`) key can create checkout sessions or transfers | unset → live keys are refused |
| `SALES_PAYOUTS_MODE` | `provider` enables Stripe Connect payouts; otherwise payouts are recorded by the owner | unset |
| `STRIPE_API_BASE` | test-only override so tests can point at a stand-in Stripe; **leave unset in production** | unset |

## 4. Storage
- Bucket `portfolios` must exist and be **private** (résumés are stored under `sales-applications/<application_id>/…`; the owner opens them
  through a 5-minute signed URL that is audited). No public URL for private documents exists anywhere.

## 5. Supabase Auth settings
- Add `APP_BASE_URL/apply/continue` to **Auth → URL Configuration → Redirect URLs** (applicant magic links redirect there).
- Applicants are real Supabase Auth users with **no** organization membership; candidates get `nova_sales_candidate` only when an
  invitation is accepted. There is no second identity system.

## 6. Webhooks (both land on the existing `/api/stripe` function — the project stays at 12/12 functions)
- Stripe → `https://<host>/api/stripe`: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded`,
  `charge.dispute.created`, `account.updated`, `transfer.created`, `transfer.reversed`. Signatures are verified with a 5-minute tolerance.
- Resend → `https://<host>/api/stripe`: `email.sent`, `email.delivered`, `email.bounced`, `email.complained`.

## 7. Background worker
```
node worker/index.mjs --enqueue-sales-maintenance   # once: starts the self-rescheduling loop (every 15 min)
node worker/index.mjs                               # keep running (see docs/RUNTIME_HOSTING_RECOMMENDATION.md)
```
The `sales_maintenance` job expires invitations/proposals/documents, promotes commissions after their hold-back, retries failed emails
(never `dry_run`/`blocked` ones) and sends overdue-follow-up reminders. It is idempotent. Owners can also press **Settings → Run
maintenance now**.

## 8. Verification after install (in the isolated environment)
1. `npm run build` and `npm run verify:local`.
2. Sign in as the owner → Sales Team. Nothing should be "approved": the Academy passing policy, activation policy, commission plan,
   audit terms, agreement text, prices and toolkit items are all pending (see `SALES_TEAM_OWNER_ACTIONS.md`).
3. With `anon` key: `GET /rest/v1/academy_quiz_questions?select=correct_index`, `…/crm_proposals?select=client_token_hash`,
   `…/sales_commission_entries` must return nothing/401 (lockdown applied).
4. Submit a test application from a **Nova-owned test email address** with `SALES_EMAIL_MODE=dry_run`; confirm no email left the system
   (Settings → Email delivery shows `dry_run`).
5. Only after the owner has approved policies/content: repeat with `SALES_EMAIL_MODE=live` and `SALES_EMAIL_ALLOWLIST` set to your own address.

## 9. Rollback
Migrations are additive. To take the feature offline without data loss: remove the Sales Team nav (revert the front-end), set
`SALES_EMAIL_MODE=dry_run`, unset `STRIPE_SECRET_KEY`/`SALES_PAYOUTS_MODE`, and suspend representatives from the Representatives screen
(suspension keeps all history). Do **not** drop tables: the commission ledger, document signatures and audit records are append-only by
design and hold records other people relied on. Reverting the `perm_read_*` policies (part 1) requires re-creating the old
`members_read_*` policies from `supabase/schema-update.sql`.

---

## Local test environment (how the evidence in this repo was produced)
```
cd .testenv && npm init -y && npm i embedded-postgres pg     # once (folder is git-ignored)
# download PostgREST v16.x for your OS into .testenv/bin/ (postgrest.exe on Windows)
node scripts/e2e_sales_hiring_test.mjs                        # any single suite
npm run verify:sales-e2e                                      # all nine real-database suites
PLAYWRIGHT_PATH=<dir with the playwright package> node scripts/e2e_sales_browser_test.mjs   # live-browser suite
```
`scripts/testenv/*` starts a disposable PostgreSQL (real), a real PostgREST, and small stand-ins for Supabase Auth (real `auth.users`, HS256
JWTs, admin/invite/magic-link endpoints), Storage, Resend (outbox + failure injection) and, inside the tests, Stripe (checkout, Connect
accounts, transfers with idempotency, injected declines/drops).

### What the tests do and do not prove
- **Proven locally:** the SQL applies cleanly in order; RLS/grants/triggers behave as written; the real request handlers enforce
  authorization, state machines, idempotency and immutability against a real PostgreSQL; the real front-end works against them.
- **NOT proven:** anything about Supabase's own Auth/Storage/RLS engine, Resend or Stripe behaviour, Vercel limits, email deliverability,
  real bank movement, or production data. Stand-ins imitate documented behaviour; they are not the providers.
- Legacy suites `e2e_org_isolation_test`, `e2e_api_client_auth_test`, `e2e_login_path_test` read `.env.local` and create/delete users in the
  **real** project, so they were deliberately **not** run during this work. `e2e_hiring_workflow_test.mjs` tests the retired legacy
  invite/activate endpoints (now answering 410) and is superseded by `e2e_sales_hiring_test.mjs`.
