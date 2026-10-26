# Nova activation checklist — from tested code to real use (2026-10-18)

The development milestone is closed on commit `ce5bafa` (final verification run 11: both passes 38/38 suites, 1617
checks, 0 failures — local disposable database with provider stand-ins). Nothing below has been done yet. Each step
says where to go and what to do. Never paste keys or passwords into chat: enter them directly in Vercel / Supabase /
the worker host.

Every API key and variable, with where to get it and how to test it: `docs/NOVA_INTEGRATION_INVENTORY.md`.

**Legend** — *Local-tested*: passed automated tests on this computer with stand-ins for providers.
*Live-verified*: proven with the real provider. Today **nothing is live-verified**.

## Phase 0 — housekeeping (≈15 min)
1. **Make the repository private:** github.com/nova-systems-ct/nova-systems-copy → Settings → General → Danger Zone →
   Change visibility → Private.
2. **Push the work:** in a terminal: `cd C:\Users\NVUBCrosbyUBMS07\nova-mvp-work` then `git push`.
3. **Install Node 22 LTS:** `winget install -e --id OpenJS.NodeJS.LTS` (Node 24 crashes the local tools on Windows).

## Phase 1 — a hosted test environment (≈1–2 h, needs payment decision)
4. **Supabase:** pay the overdue invoice (supabase.com → Organization → Billing). Then create a **staging project**
   (check the plan price first — this is a cost you approve).
5. **Build its database:** Supabase → staging project → SQL editor → run every file listed in
   `supabase/migration-manifest.json`, in order (38 files). Or give Claude the staging connection string *in a local
   `.env.staging` file* (not chat) and ask it to run them.
6. **Point the Vercel Preview at staging:** vercel.com → project **nova-systems-copy** → Settings → Environment
   Variables → for **Preview only** add: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (legacy JWT anon key),
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (legacy JWT service_role key — staging's, never production's),
   `APP_BASE_URL` (the preview URL), `SALES_EMAIL_MODE=dry_run`. Then Deployments → latest `mvp/operational` → Redeploy.
7. **Create your owner login** in the staging project (Supabase → Authentication → Add user), then ask Claude to
   provision the Nova organization and owner role there (the same steps `scripts/local/staging.mjs provision` does locally).

## Phase 2 — set up Nova on Nova (≈30 min, in the app, signed in as owner)
8. **Operations → Settings:** time zone and business hours; **escalation contact** (name + phone or email) — the only
   required item still blocked in Install Systems.
9. **Operations → Settings → Services:** create "Nova Audit scoping call" (free, 30 min) and approve it. Approve the
   agreement template (business approval only; have an attorney review before real customers).
10. **Operations → Install Systems → Install Systems.** Expect every required component done; the result page lists
    exactly what is still blocked.
11. **Run an audit → All audits → Nova Systems (own business):** review the 7 findings and approve the report.
    For each new audit case: Intake tab → "Fill in the proposed default" → adjust → **Approve policy**.

## Phase 3 — connect providers (each unlocks one channel)
12. **Email (Resend):** resend.com → Domains → add `nova-systems.app` → add the DNS records it shows at your domain
    registrar → wait for "Verified". API Keys → create one → Vercel (Preview first) → `RESEND_API_KEY`,
    `SALES_EMAIL_MODE=live`, and `SALES_EMAIL_ALLOWLIST` = your own email addresses while testing. Redeploy.
    Emails are sent from `noreply@nova-systems.app`, so that domain must show "Verified" in Resend.
13. **Phone + SMS (Twilio):** twilio.com → Phone Numbers → buy or pick a number. **Messaging → A2P 10DLC:** register
    the brand and campaign (approval takes days to weeks; required before US texting). Vercel → add
    `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `WAVE1_PUBLIC_BASE` (the deployment URL),
    `WAVE1_SEND_ENABLED=true`, `OPS_SEND_ALLOWLIST` = your own test phone numbers. In Twilio → the number →
    **A message comes in:** `https://<deployment>/api/client?resource=wave1&op=sms-inbound` (HTTP POST);
    **A call comes in:** `https://<deployment>/api/client?resource=ops&op=voice-inbound` for the AI receptionist
    (it answers only when the business has an **active voice configuration with your approved disclosure script**;
    otherwise it forwards the call to a person; optional AI understanding needs `OPS_MODEL_ENABLED=true` and
    `ANTHROPIC_API_KEY`) — or
    `…resource=wave1&op=voice-inbound` for forward-to-you + missed-call text.
14. **Payments (Stripe, test mode first):** dashboard.stripe.com → test mode → Developers → API keys → Vercel
    `STRIPE_SECRET_KEY` (sk_test_…). Webhooks → add `https://<deployment>/api/stripe` for
    `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded` →
    `STRIPE_WEBHOOK_SECRET`. For client-owned deposits: Connect → enable → a second (Connect) webhook to the same URL →
    `STRIPE_CONNECT_WEBHOOK_SECRET`; each business enters its `acct_…` in Settings → Payments. Nova's own audit call
    is free, so Nova on Nova does not need Stripe.
15. **Background worker (required for SMS replies, follow-ups, Revive, escalations, weekly reports):** choose a host
    (e.g. Fly.io, a few dollars a month — your approval). It runs `node worker/index.mjs` continuously with
    `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and the same Twilio/Resend variables. Ask Claude to prepare the
    deployment files once you have chosen the host.

## Phase 4 — test the whole journey yourself (staging, your own phone and email)
| # | Test | Where | Passes when |
|---|---|---|---|
| T1 | Inquiry → booking | Homepage → Request your audit → fill in → choose a time → sign | Booking confirmed on screen; record under Operations → Requests |
| T2 | Confirmation email | after T1 (needs step 12) | Email arrives; Admin → notifications show "sent", not "dry run" |
| T3 | Text conversation | text the Twilio number (needs 13 + 15) | Assistant replies with services, real times; booking held; link sent |
| T4 | Missed call → text | call the number, do not answer (needs 13 + 15) | One follow-up text, only if your number has recorded consent |
| T5 | AI call | call the number (needs 13 with ops voice-inbound + 15) | Disclosed AI answers, captures your request, offers times or hands to a person |
| T6 | Audit | Run an audit → new case → intake → approve clock policy → inputs → start → findings → report → approve → publish link | Client link shows exactly the approved version; PDF matches |
| T7 | Revive | Operations → Revive campaigns → preview → save draft → approve → start | Only eligible, consented people messaged; a reply continues the same request; STOP stops everything |
| T8 | Demand | Operations → Demand → approve WUETJW → approve prospects → record real contacts | Funnel counts only what you recorded; replies with the code are attributed |
| T9 | Hierarchy | Command → create a task, assign to a staff member | They see it under My work; overdue → escalation to their manager |
| T10 | Monitoring | Operations → Monitoring | Worker heartbeat and checks green; a stopped worker raises an alert |

## Phase 5 — production (only after Phase 4 passes; each step is your explicit approval)
16. Supabase production → Database → Backups: confirm a recent backup.
17. Apply the migration manifest to production (same 38 files) — production schema differs from staging; Claude
    checks the live tables first.
18. Merge `mvp/operational` into `main` (GitHub pull request) → Vercel deploys nova-systems.app → repeat T1–T6 on production.
19. Rotate the credentials listed in `docs/SECURITY_CREDENTIALS_AND_LEGACY_PAUSE_PLAN_2026-09-30.md`.

## Phase 6 — first pilot businesses
20. For each pilot: Operations → Client businesses → Add a business (untick TEST) → its owner sets services, prices,
    agreement, escalation contact → Install Systems → T1–T5 with that business's own test contact.
21. Approve the Demand campaign and assign prospect lists to representatives (Academy certification first).

## Additions for hosted staging and production — 2026-10-26 (prepared, nothing purchased or deployed)
Everything below is ready in the code; each line is an owner action on a paid or external service.
- **Migrations to apply** (in `supabase/migration-manifest.json` order, after the existing ones): `ops-06-ai-spend-guard`,
  `ops-07-contract-drafts-delivery`, `ops-08-audit-workspace`, `ops-09-worker-capabilities`, then re-run
  `zz-public-schema-lockdown` (idempotent). All are additive.
- **Storage:** private bucket `nova-vault` must exist (audit PDFs go to `audit-reports/<org>/<case>/`); `ops-private`
  for evidence photos. No public buckets are needed for these features.
- **Environment variables (names only):** `SALES_EMAIL_MODE` (`dry_run` until Resend is verified), `SALES_EMAIL_ALLOWLIST`
  (recommended during staging), `RESEND_API_KEY`, `APP_BASE_URL`; optional AI: `NOVA_AI_PAID_CALLS`, `NOVA_AI_PRICES`,
  `NOVA_DOC_MODEL`, `ANTHROPIC_API_KEY` (leave unset to keep AI off). Contract emails now obey `SALES_EMAIL_MODE`.
- **Function count:** no new top-level `api/*.js` files were added (still 12/12); new operations ride on `api/client.js`.
- **Server needs outbound internet** for the audit review (public web pages and DNS); no paid service is used.
- **Worker host:** the background worker (`worker/index.mjs`) must run somewhere always-on for follow-ups, monitoring and
  reporting; until then those run only while the laptop is awake.
- **Hosted verification to run after deploy:** `scripts/local/e2e_audit_journey_test.mjs`, `e2e_contract_composer_test.mjs`
  and `e2e_workers_test.mjs` are written for local staging; point them at staging only with a staging test-account file.
