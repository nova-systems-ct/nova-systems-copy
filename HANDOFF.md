# Handoff — 2026-11-14 (updated 2026-11-21)

## Update — 2026-11-21

The ten commits below were pushed to GitHub on Nov 14 and the Vercel preview built. Work added on
Nov 21, each **locally verified only** (unit suites in `npm run verify:local`, migrations applied
twice to a throwaway PostgreSQL 16). Nothing below is deployed, applied to a database, or tested
with a real provider. No money was spent.

### Card payments (system 17)

- `api/_cardPayments.js`: each business connects its own Stripe account; customers pay deposit and
  balance invoices on Stripe's page; the charge is made directly on the business's account
  (`Stripe-Account` header), so Nova never holds the money and takes no fee. Stripe's signed
  Connect event records the payment through `recordPayment` as `provider_verified`, once per
  payment, and the journey moves on by itself. A late or odd payment is never dropped: it is
  flagged to the owner (`card_payment_needs_review`).
- Customer page `/start`: "Pay by card" appears only when the business's account can take payments.
  Business desk → Money owed → Card payments: Connect Stripe / Check status.
- Webhook: `POST /api/stripe?action=connect-webhook` (own signing secret).
- Migration: `supabase/card-payments-migration-standalone.sql` (table `business_payment_accounts`).
  Run after `customer-journey-migration-standalone.sql`, then re-run the lockdown file.
- Tests: `scripts/unit_card_payments_test.mjs` (51 checks).
- Account type defaults to **Standard**: per Stripe's Connect pricing page, when Stripe handles
  pricing for connected accounts there is no platform fee. Express
  (`NOVA_CONNECT_ACCOUNT_TYPE=express`) is listed at $2 per monthly active account plus 0.25% + 25¢
  per payout, so it needs Isaac's yes first.

**Owner steps to switch it on (test mode first):**
1. Stripe Dashboard → Connect: complete the platform setup.
2. Stripe → Webhooks → add an endpoint for **events on connected accounts**:
   `https://<site>/api/stripe?action=connect-webhook`, events `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `account.updated`. Put its signing secret in Vercel
   as `STRIPE_CONNECT_WEBHOOK_SECRET`.
3. Vercel: `NOVA_CARD_PAYMENTS=on`, and `APP_BASE_URL` set to the site the customer pages run on.
   A live key also needs `NOVA_CARD_PAYMENTS_LIVE=yes`.
4. Done when: on staging, a business connects a test Stripe account, a customer pays a deposit with
   Stripe's test card, and the request moves to scheduling by itself.

### Sending Revive and the weekly scorecard (systems 20 and 23), by email

- `api/_email.js`: sends through Nova's Resend account from Nova's domain, with the business's name
  as the sender and replies going to the business. Off until `NOVA_EMAIL_SENDING=on`.
- Revive: a customer who agreed to email gets the come-back message by email (texting stays held
  until carrier approval). Every email carries the business's mailing address and an unsubscribe
  link (plus the one-click header); the link opts the customer out of every channel. Consent is
  re-checked at the moment of sending, and a message is marked sent only with the provider's id.
  Messages saved while email was off become ready once it is on.
- Scorecard: "Email me this report" on the Results tab, and every Monday 13:00 UTC by the Vercel
  schedule (`/cron/weekly-scorecards`, needs `CRON_SECRET`) for each business with email on. At most
  one per business per day.
- Business desk → Assistant: email switch, reply email, mailing address. Come-back list: "Send ready
  emails".
- Daily caps: 25 per business and 80 across Nova (`NOVA_EMAIL_DAILY_CAP_PER_BUSINESS`,
  `NOVA_EMAIL_DAILY_CAP_TOTAL`), under the Resend free plan's 100 a day, where sending pauses
  rather than charging.
- Migration: `supabase/outbound-email-migration-standalone.sql` (three columns on
  `business_agents`, `crm_contacts.unsubscribe_token`, table `scorecard_sends`). Run after
  `business-agents-migration-standalone.sql`, then re-run the lockdown file.
- Tests: `scripts/unit_outbound_email_test.mjs` (50 checks).

**Owner steps:** Vercel: `NOVA_EMAIL_SENDING=on` and `CRON_SECRET` (any long random string). Then
in the Business desk, fill in the email fields and tick the switch. Done when: on staging, one
prepared come-back email reaches a test inbox and the Results tab counts it as sent.

### Team dispatch and pay split (systems 24 and 25)

- `api/_team.js`: the owner adds workers (employee or independent pro) in Business desk → Team &
  pay; each gets a private phone link (`/crew?t=…`, only its SHA-256 stored; a new link replaces
  the old). A booked job is assigned from the job's detail under Customers. On the phone page the
  worker sees the time, address, request and the customer's first name and phone, and presses
  Done with a sentence of evidence; that runs the same `completeWork` step, so the balance is
  invoiced at once.
- Pay split: each business writes and approves its own split (up to six shares, exactly 100%, at
  most one share to whoever did the job). When a job is fully paid, the finance step records each
  share of the money actually received (`pay_split_entries`, last share takes the leftover cent).
  A record only: a person pays people and presses "Mark paid out". No split is ever defaulted.
- Customer page `/start` now asks for the job address (optional), saved on the request.
- Migration: `supabase/team-dispatch-migration-standalone.sql` (`business_workers`,
  `job_assignments`, `pay_split_rules`, `pay_split_entries`, `journeys.service_address`). Run after
  `customer-journey-migration-standalone.sql`, then re-run the lockdown file.
- Tests: `scripts/unit_team_pay_test.mjs` (46 checks). Not built: job photos from the worker's
  phone (needs a private storage bucket).
- Done when: on staging, a Crystal Clear test job is assigned, marked done from a phone, invoiced,
  paid, and the Team & pay tab shows each share.

### Bookkeeping export (system 26)

- `api/_bookkeeping.js`: Business desk → Money owed → "Download CSV" for any month: every invoice,
  payment (with who confirmed it: the payment provider or a person) and pay-split share, in the
  business's local month. Spreadsheet-formula cells are neutralised. Owner permission only.
- Tests: `scripts/unit_bookkeeping_test.mjs` (14 checks). No migration.

## Where the work is

- Branch: `claude/launch-recovery-20261114`, built on `codex/launch-recovery-20261113` (741aafa).
- **Not pushed.** This workspace has no push access to the repository. The commits exist only here and in the patch file given to Isaac: `nova-on-recovery-branch.patch`.
- To apply: `git checkout codex/launch-recovery-20261113 && git checkout -b claude/launch-recovery-20261114 && git am nova-on-recovery-branch.patch`
- Nothing was deployed. Nothing was applied to any database. No money was spent.

## Commits on top of the recovery checkpoint

1. Close open invoice, email and upload endpoints.
2. Add the per-business messaging agent (SMS slice).
3. Reposition the site as a service business with an eight-service catalog.
4. Add the customer journey: four agents from first contact to closed job, the `/start` customer page, and `AGENT_PLAYBOOKS.md`.
5. Add Nova Audit customer-style tests, Nova Revive, Nova Proof and industry packs.
6. Make intake uploads private; allow the staging database in the browser security policy.
7. Make `/start` each business's lead page.
8. Add the owner's Business desk (`/dashboard/business`): prices, offers, customers, money owed, come-back list, results, assistant details.
9. Add business registration (`/register` public page, `/dashboard/registrations` approval screen) and the `business.manage` permission for client owners.
10. Add the conversation worker: a customer is taken through the journey by message, by fixed rules, with no model call. Text messages to a business number use it when the business has published services.

## Migrations

- New and NOT applied anywhere: `supabase/business-agents-migration-standalone.sql`. Run after `voice-agent-migration-standalone.sql`. Safe to re-run.
- New and NOT applied anywhere: `supabase/customer-journey-migration-standalone.sql`. Run after `crm-order-audit-migration-standalone.sql` and `voice-agent-migration-standalone.sql`. Safe to re-run.
- New and NOT applied anywhere: `supabase/revive-proof-migration-standalone.sql`. Run after `customer-journey-migration-standalone.sql`, then re-run the lockdown file. Safe to re-run.
- New and NOT applied anywhere: `supabase/business-registration-migration-standalone.sql`. Run after `revive-proof-migration-standalone.sql`, then re-run the lockdown file. Safe to re-run. Adds `business_registrations` and the `business.manage` permission (granted to nova_super_admin, nova_admin, client_owner, client_admin). **Until it is applied, saving prices, offers, payments and assistant details returns 403 for everyone**, because those actions now require `business.manage`.
- Already in production (do not reapply): `20261114001055_launch_recovery_studio.sql`, `20261114001136_executive_background_scheduler.sql`.

## Read next

`BUILD_STATUS.md`, `TEST_RESULTS.md`, `INTEGRATION_STATUS.md`, `COST_BLOCKERS.md`, `SERVICE_CATALOG.md`, then `docs/handoffs/2026-11-14-launch-recovery.md`.

## Owner actions

1. GitHub: install the Claude GitHub App on `nova-systems-ct`, or apply the patch by hand.
2. Twilio: sign in so the credentials and campaign status can be checked. Do not resubmit the campaign.
3. Supabase: the `nova-intake-files` bucket does not exist in staging or production (checked 2026-11-14), so intake uploads currently fail. Create it as a PRIVATE bucket. The code now stores files under unguessable paths and opens them only through the staff-only `business-intake?action=file-url` link, which expires after five minutes.
4. Vercel plan is Hobby (confirmed 2026-11-14). Vercel limits Hobby to non-commercial use; moving to a paid plan is an owner decision and a cost.

## First next action

Push this branch. Apply the four new migrations to staging in the order above. Open `/register`, submit a registration for Crystal Clear and one for Flare, approve both at `/dashboard/registrations`, then set real prices at `/dashboard/business` and open each business's `/start?org=<id>` link. Then compare the production migration history with the repository, deploy to a preview pointed at staging, and submit one real request through `/services` → `/service-request`.

## Prompt for the next assistant

"Read HANDOFF.md and BUILD_STATUS.md on branch claude/launch-recovery-20261114 of nova-systems-ct/nova-systems-copy. Spend $0. Verify the branch is pushed; if not, apply nova-on-recovery-branch.patch. Run npm run lint, npx vite build and npm run verify:local. Then continue with the first row in BUILD_STATUS.md that is not VERIFIED, starting with section B: re-run the request-to-appointment journey end to end on the local PostgREST runtime, then carry the service-business wording to Contact, Pricing and Footer."
