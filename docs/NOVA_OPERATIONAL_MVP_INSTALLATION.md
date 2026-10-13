# Nova Operational MVP — installation sequence

Every step below changes a real system and needs Isaac's approval of that step. Run it on **staging first**
(a separate Supabase project and a Vercel preview), then repeat for production after staging passes.
No secret values belong in this document; names only.

## 0. Preconditions
- Vercel team "nova-systems1" billing restored (sites were disabled for an unpaid invoice on 2026-10-03).
- The source of the unexplained pushes to GitHub resolved, or this code moved to a repository whose pushes are controlled.
- A staging Supabase project created (none exists today).

## 1. Backup and preflight
1. Supabase dashboard → Database → Backups: take a backup immediately before any change.
2. Run `supabase/checks/security-metadata-check.sql` (reads catalog metadata only) and keep the output.

## 2. Migrations (dependency order — `supabase/migration-manifest.json` is the source of truth)
- **Already-provisioned production database:** apply only what is missing. Do not re-run `schema-update.sql` blindly.
  1. `security-repair-2026-09-30-production-patch-standalone.sql` (closes anonymous access; A3 in the security report)
  2. `security-repair-2026-09-30-columns-standalone.sql`
  3. `crm-order-audit-migration-standalone.sql` (audit tables do not exist in production today) — then `audit-02-evidence-scenarios-delivery-migration-standalone.sql`
  4. Whatever of `durable-jobs`, `voice-agent`, `wave1-pilot`, `sales-team-01…07`, `hierarchy-01…04` is missing (check with the metadata query)
  5. `ops-01-operational-mvp-migration-standalone.sql`
  6. `zz-public-schema-lockdown-standalone.sql` last
- **Empty staging database:** apply the manifest in order. `scripts/e2e_clean_install_test.mjs` proves this exact order installs with zero SQL errors and can be re-run.
- After each file: re-run the metadata check. Expect zero public tables without RLS and zero anonymous privileges.

## 3. Storage
- Private buckets: `nova-vault`, `ops-private` (signed agreements), `nova-intake-files` (made private by the production patch). No public buckets for customer documents.

## 4. Authentication settings
- Site URL and redirect allow-list: `https://<domain>/auth/callback` (staging and production separately).
- Password recovery email template uses the redirect above. Confirm a recovery link works once and not twice.
- Isaac's own sign-in: the earlier block was a Supabase-side email rejection; confirm his account email in Auth → Users.

## 5. Configuration (Vercel project environment — names only)
Server-only: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_BASE_URL`, `WAVE1_PUBLIC_BASE`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`STRIPE_SECRET_KEY` (test key `sk_test_…` only), `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `OPS_ALERT_EMAIL`,
optional `ANTHROPIC_API_KEY` + `OPS_MODEL_ENABLED=true`, optional `CALCOM_API_KEY`.
Safety switches: leave `WAVE1_SEND_ENABLED` unset (dry run) until step 10 passes; on staging set `OPS_SEND_ALLOWLIST` to Nova-owned test numbers only;
`OPS_KILL_SWITCH=true` stops all new automated texts and checkouts. Never set `SALES_ALLOW_LIVE_STRIPE`.
Browser-public: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` only.

## 6. Providers
- **Twilio:** one number per business (or a shared Nova test number on staging); A2P 10DLC registration approved (record it in the business's settings); Messaging webhook → `/api/client?resource=wave1&op=sms-inbound`, status callback → `…op=sms-status`; Voice webhook → `/api/client?resource=ops&op=voice-inbound` (falls back to forwarding until the voice assistant is activated), status → `…resource=wave1&op=call-status`.
- **Stripe (test mode):** webhook endpoint `/api/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `charge.refunded`. Decide who receives client deposits before any real business uses deposits (see owner actions).
- **Resend:** verified sending domain; `OPS_ALERT_EMAIL` for incident alerts.

## 7. Worker
- Run `node worker/index.mjs` as a long-running process with the server-only variables above and `NOVA_WORKER_TARGET_REF=<that project's ref>` (it refuses a remote database otherwise). It seeds the 5-minute monitoring sweep and the hourly scoreboard tick and writes a heartbeat every 20 s.
- Runtime choice and cost need approval (see `docs/RUNTIME_HOSTING_RECOMMENDATION.md`). Do not start it against production until staging passes.

## 8. Owner-approved business content (per business, in Operations → Settings)
Time zone and hours; escalation phone; approved prices; agreement text (business approval + attorney review); deposit arrangement; review link; referral terms; voice disclosure; weekly-report number with the owner's consent.

## 9. Staging verification (real providers, Nova-owned test resources only)
1. Text the test number from an allowlisted Nova phone → reply received; walk through service → time → agreement → Stripe **test** card → webhook → confirmed booking → complete job.
2. Call the number: forwarding (assistant off), then assistant on: disclosure, booking, texted link, transfer on "0".
3. Missed call from an allowlisted, consented number → exactly one text. STOP → nothing further.
4. Stop the worker → Sentry incident + email; restart → resolved.
5. Generate the weekly report; reconcile each number to the records.
Record each result in `NOVA_OPERATIONAL_MVP_ACCEPTANCE.md` as **staging verified** only when it happened on real providers.

## 10. Production release (separate approval)
Deploy the reviewed commit; repeat steps 1–5 of section 2 checks; keep `WAVE1_SEND_ENABLED` unset until one business's go-live is approved; then enable per the readiness matrix.

## 11. Rollback
- Code: redeploy the previous Vercel deployment.
- Automation: `OPS_KILL_SWITCH=true` or pause the business in Settings (immediate, no deploy).
- Database: migrations are additive; never restore the old blanket policies or disable RLS. Restore from the step-1 backup only for data loss.
