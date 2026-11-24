# Handoff — 2026-11-14 (updated 2026-11-21)

## Update — 2026-11-21

The ten commits below were pushed to GitHub on Nov 14 and the Vercel preview built. Work added on
Nov 21, each **locally verified only** (unit suites in `npm run verify:local`, migrations applied
twice to a throwaway PostgreSQL 16). Nothing below is deployed, applied to a database, or tested
with a real provider. No money was spent.

### Order to run the migrations (staging first, each twice; never the two already in production)

1. `business-agents-migration-standalone.sql`
2. `business-registration-migration-standalone.sql`
3. `customer-journey-migration-standalone.sql`
4. `revive-proof-migration-standalone.sql`
5. `card-payments-migration-standalone.sql` (new Nov 21)
6. `outbound-email-migration-standalone.sql` (new Nov 21)
7. `team-dispatch-migration-standalone.sql` (new Nov 21)
8. `reviews-migration-standalone.sql` (new Nov 21)
9. `business-channels-migration-standalone.sql` (new Nov 21, evening: calls and every message channel)
10. `job-photos-migration-standalone.sql` (new Nov 24: job photos table and the private bucket)
11. `zz-public-schema-lockdown-standalone.sql`, always last

The same eleven, in this order, are in one file to paste into the Supabase SQL editor:
`supabase/nova-install-bundle.sql` (rebuilt by `node scripts/build_install_bundle.mjs`; a check
fails if it falls out of date).

Each new file was applied twice to a throwaway PostgreSQL 16 on Nov 21 and its constraints were
exercised there (with stub tables for what the real dependencies would provide).

### Still not built

Tax lines on quotes (Crystal Clear is not registered for sales tax yet; the rate is a tax
question for an accountant) and Aura reading Isaac's calendar and email (needs his sign-in to
those apps). Every one of the 28 systems is built and tested locally; what each still waits on to
work for real is listed below. Nothing is deployed: that needs Isaac signed in to Supabase and
Vercel (both showed their sign-in pages on Nov 24).

### Update — 2026-11-24: email, job photos, Wallet passes

- **Email (16)**, `api/_journeyEmail.js`: the quote, each invoice and a reminder the day before
  the appointment, from the business's name. Needs `RESEND_API_KEY`, `NOVA_EMAIL_SENDING=on`,
  `NOVA_FROM_EMAIL` on a domain verified in Resend (free plan: 100 a day), `CRON_SECRET` for the
  daily 9 a.m. run (`/cron/daily-emails`), and per business: email on, a reply address and a
  mailing address. Links sent by email, text or chat now use their own key
  (`journeys.customer_link_hash`), so they never end the customer's browser session.
- **Job photos (24)**, `api/_jobPhotos.js`: before/after photos on the worker's phone page, into
  the private `job-photos` bucket (made by the migration); the owner sees one-hour links in the
  customer's record. Needs nothing else.
- **Wallet passes (18)**, `api/_walletPass.js`: "Add to Apple Wallet" and "Add to Google Wallet"
  on the request page once a time is booked. Apple needs `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`,
  `APPLE_PASS_CERT_PEM`, `APPLE_PASS_KEY_PEM` and `APPLE_WWDR_PEM` (from the Apple Developer
  account that signed the Nov 7 test pass). Google needs `GOOGLE_WALLET_ISSUER_ID`,
  `GOOGLE_WALLET_SERVICE_EMAIL` and `GOOGLE_WALLET_PRIVATE_KEY` (the Google Wallet console needs
  a working Google account; the Nov 8 attempt was refused). A button shows only when its keys are set.

### Calls and messages for client businesses (systems 10 to 15, and website chat)

Built Nov 21 (evening), **locally verified only**: 199 new checks across
`unit_business_channels_test`, `unit_business_calls_test`, `unit_channel_admin_test`,
`unit_channel_setup_test` and `unit_install_test`; the chat widget and the new desk tabs were also
run in Chrome with stand-in data. The migration was applied twice to a throwaway PostgreSQL 16.

- **One rule for every channel** (`api/_businessChannels.js`): a reply goes out only if the
  business is live, the channel is on, the customer has not opted out, and, for anything that costs
  money, spending is switched on for all businesses AND this month's planned spend (texts, paid
  messages and calls together) stays under the business's cap. Otherwise the message is saved and
  a person is flagged. Replies come from the journey rules: free, exact, never a price that is not
  approved. Texts now count against the same budget (they used to count separately).
- **Calls** (system 11, `api/_businessCalls.js`): per business, "off" (busy tone, $0), ring the
  owner only, ring the owner then the assistant, or the assistant first. The assistant says it is
  automated and that it writes down what the caller says, gives only approved prices, and texts a
  private link to the caller's quote and booking page (`/start?org=…#j=…&k=…`); anything else is
  marked "call back" and the owner gets one alert text. A missed caller gets at most one text a
  day. Under the $0 lock every call gets a busy tone (Twilio does not charge for rejected calls)
  and is still logged. Planned costs: forwarded call 5¢, assistant call 15¢, premium voice 40¢,
  text 2¢ (planning numbers only).
- **Premium voice** (ElevenLabs): register-call hand-off per business, falling back to the
  standard assistant; the agent can act only through four tools at
  `/webhooks/voice-tools/<services|open_times|send_link|hand_to_person>`, secured by a voice key
  per business (shown once, stored as a hash).
- **Website chat**: `/chat?b=<slug>` in a frame; one script line for any website
  (`<script src="https://nova-systems.app/chat/embed.js" data-business="<slug>" async></script>`),
  and automatic on `/b/<slug>` when chat is on. Free. A team reply shows in the visitor's chat.
  `vercel.json` lets only `/chat` and `/chat/*` be framed (CSP `frame-ancestors *`).
- **WhatsApp, RCS** (Twilio), **Apple Messages** (CM.com relay) and **Facebook/Instagram** (Meta
  webhook at `/webhooks/meta-business`, signed with `META_APP_SECRET`): each message is answered as
  the business that owns that sender, Page or account. A comment on a business's post gets one
  private reply with the owner's approved comment offer, and the commenter's reply continues the
  same request. WhatsApp, Facebook and Instagram replies only within 24 hours of the customer's
  last message.
- **Business desk**: new tabs Messages (every channel in one inbox; reply; mark handled), Calls
  (the log in plain words) and Switch on (what is on, waiting or missing; go live, texting and the
  monthly cap; call answering; channel IDs; Page token; voice key; the addresses to paste into each
  provider). Saving the assistant's details no longer switches texting or the cap off.

What each one still needs before it works for real (all owner or provider steps; nothing here is
bought or signed by Claude):

| System | Needs |
| --- | --- |
| Calls (11) | Twilio credentials that work; a Twilio number per business with "A call comes in" set to `https://nova-systems.app/webhooks/business-call` and "Call status changes" to `…/business-call?step=status`; spending switched on and a cap set (NEEDS MONEY: Twilio minutes and speech) |
| Premium voice | `ELEVENLABS_API_KEY` (Nova's account), an ElevenLabs agent per business with the four tools and the voice key header |
| Texts and missed-call text (10) | The carriers' approval of the texting campaign (do not resubmit; read the status) |
| WhatsApp (14) | An approved WhatsApp sender per business in Twilio, webhook `…/webhooks/twilio-message` |
| RCS (13) | Twilio RCS brand approval and a Messaging Service per business, inbound to `…/webhooks/twilio-message` |
| Apple Messages (12) | Apple Business Register approval per business; CM.com (paid) relay with `CM_INBOUND_SECRET` and `NOVA_CM_RELAY_VERIFIED=true`; `CM_PRODUCT_TOKEN` to reply |
| Facebook/Instagram (15) | A Meta app with business verification and app review (pages_messaging, instagram_manage_messages, comments); `META_APP_SECRET`, `META_VERIFY_TOKEN`; each business's Page token pasted in Switch on |

### Crystal Clear and Flare: ready to install

- `installs/crystal-clear.json`: the five prices Isaac approved on Nov 21 ("Approve as written"):
  sedan full detail $199, SUV or truck $249, outside windows up to 20 $199, quarter-load junk
  removal $175, Holiday Ready (sedan detail plus outside windows) $299 booked by Dec 15. Lawn
  mowing is kept with no price and switched off until spring. No deposit and no agreement wording
  (not decided). Assistant: Fairfield County, website chat on. Pay split saved as a PROPOSAL only
  (pro 50% / Crystal Clear 50%, the subcontract plan); Isaac approves or changes it in Team & pay.
- `installs/flare.json`: mystery box campaign, street poll, event, content day; no prices; all
  switched off while Flare is on hold.
- Run after registering and approving each business (staging first):
  `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/install_business.mjs installs/crystal-clear.json --org <id>`
  shows the changes; add `--apply` to make them. It refuses Nova's own organization, refuses the
  production database without `--production`, never switches anything live and never sets a cap.
- **Switch Holiday Ready off on December 16** (Business desk → Services). The company website
  hides it by itself after December 15; the booking system does not.
- Company websites (`company-sites.zip`, outside this repository): Crystal Clear now shows the
  approved prices, Fairfield County, the Holiday Ready offer (hidden automatically after Dec 15)
  and "Prices are before any sales tax." `site.json` gains `chat` (the business page name) to add
  the chat button.

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

### Reviews (system 19)

- `api/_reviews.js`: after a paid job the customer is asked "How did we do, 1 to 5?" on their own
  request page, and by email through the come-back list (private link `/rate?t=…`, only its
  SHA-256 stored, asked once, within 14 days, only of customers who agreed to email). 1 to 3 asks
  the owner to call (Approval Inbox task + "Call them" in Results).
- **Changed from the Master Build Prompt on purpose:** the owner's review page is offered to every
  customer who rates, at any rating, not only to 4s and 5s. Showing it only to happy customers is
  "review gating", which Google's review policy forbids ("selectively soliciting positive
  reviews"); a business caught doing it risks its reviews and its profile. Nova never writes or
  posts a review, and nothing is offered for a rating.
- Business desk → Assistant: review page link; Results: ratings, average, "Mark handled".
- Migration: `supabase/reviews-migration-standalone.sql` (`business_agents.review_url`,
  `customer_feedback`, `revive_outreach.kind` gains `review_request`). Run after
  `revive-proof-migration-standalone.sql`, then re-run the lockdown file.
- Tests: `scripts/unit_reviews_test.mjs` (27 checks).

### Audit screen (system 22)

- Audit case page → new "Customer tests" tab (`src/pages/dashboard/AuditCustomerTests.jsx`): staff
  record each call, text, form or message they ran on a prospect (saved as first-hand evidence by
  the existing `customer-test` op), enter the owner's three numbers to get the server's dollar
  range with its assumptions, save it as an estimate finding linked to the tests, and print a
  one-page Audit. Helpers in `src/lib/auditTests.js`; tests `scripts/unit_audit_screen_test.mjs`
  (10 checks, including that the screen's test list matches the server's). No migration.

### Client websites (system 5)

- `api/_site.js`: every client business gets a one-page website at `/b/<organization slug>`,
  built from its own records each time it is opened: name, its own words, active services, prices
  only where approved, hours when set (days with no record are left out, never assumed open), the
  approved website offer, phone, and "Request a quote" to its `/start` page. It works as soon as a
  registered business switches on one service. Shown on the Business desk as "Your website".
- Served by the existing `api/client.js` (no new function) through the `/b/:slug` rewrite.
- Tests: `scripts/unit_site_test.mjs` (16 checks). No migration.

### Aura 0.1: the morning brief

- `/dashboard/aura` ("Morning brief" in the menu, `src/pages/dashboard/Aura.jsx`) reads every
  business the person belongs to through `op=brief` (`api/_brief.js`): new requests since
  yesterday, today's jobs with times and addresses, what is waiting on the owner, customers to
  call, card payments to check, money collected and owed, come-back messages ready. "Copy brief"
  gives the same in plain words. Read-only. Calendar and email are not connected (needs Isaac's
  sign-in to those apps); drafting replies with a model is not built ($0 policy).
- Tests: `scripts/unit_brief_test.mjs` (10 checks). No migration.

## Where the work is

- Branch: `claude/launch-recovery-20261114`, built on `codex/launch-recovery-20261113` (741aafa).
- Pushed to GitHub (Nov 21) on branch `claude/launch-recovery-20261114` of nova-systems-ct/nova-systems-copy. Not merged to main, not deployed to production.
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
