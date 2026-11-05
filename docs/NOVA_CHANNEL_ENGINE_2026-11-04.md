# Nova connected channels — engineering release, 4 November 2026

This continues the owner-authorized next system. No purchases, paid provider calls, live customer messages or fee-bearing registrations are authorized. Existing Nova and Sweet Bella audit clocks are not reset or modified by this release.

## What this release actually builds

Instagram, Facebook Messenger and WhatsApp Cloud text conversations use Nova's existing inquiry/service/quote/availability/agreement journey. New messages enter through a signed webhook, are saved against the exact connected business account and receive a business-scoped identity. No phone, email or marketing consent is fabricated. Unsupported attachments go to a person; attachment URLs are never fetched.

Owners can prepare an account, correct its draft authorization configuration, verify its exact account identity through the provider, record authorization evidence, enable processing with sending off and pause it. Secrets stay in the server environment; the browser accepts a secret reference name only. Verifying account identity does not certify messaging permissions or a successful provider/device test.

Instagram also supports owner-approved keyword replies to future comments: one whole-word keyword, one immutable approved response and one private-reply attempt per comment. Multiple matching rules require review. Pausing a rule holds its queued work. Likes never create permission to message. Private replies are restricted to the provider's configured reply window; subsequent conversation requires an actual inbound message.

The Integration Center has Connections and Coverage/application views, the selected business is explicit, and infrastructure diagnostics are collapsed. It fits desktop, iPad and phone viewports. The inbox retains the source channel and uses existing human takeover controls.

## Safety and recovery

- Raw-body HMAC verification precedes JSON parsing. Batches and text lengths are bounded; replayed event IDs enqueue only once.
- Composite foreign keys enforce business, account, contact and conversation binding. Channel tables/functions are service-only with RLS; handlers authorize organization access.
- STOP wins against an equal or earlier START. A DM does not grant email, SMS or channel-marketing consent.
- Replies honor live business/channel/worker/global pauses, opt-outs, takeover and provider reply windows. No-spending and sending flags are fail-closed.
- Each execution uses a fresh token bound to a real, unexpired job lease. Database write triggers verify and lock that lease within reused booking/state writes. Every long-worker claim gets a distinct owner even when a process name is configured.
- Late queued input is rechecked against the conversation watermark at claim, so it cannot advance a newer state.
- Conversation state and the prepared reply are saved atomically. A retry sends only that saved reply; it does not reinterpret the same service answer as a time choice. Partial execution with no prepared result becomes visible review/takeover work.
- Paused jobs are deferred without exhausting retries. Completion, failure and renewal cannot overwrite cancellation or an expired lease.
- Comment dispatch atomically claims its approved event only while the correct job lease, account, rule, window and suppression gates remain valid.
- A provider receipt means accepted, not delivered. Ambiguous outcomes are retained and never automatically resent. Delivery/read receipt reconciliation remains to build.
- Draft edits clear verification and disable sending. Revision checks prevent a slow verification or enable request from overwriting a concurrent correction/pause.
- Legacy CRM contact merge refuses contacts with connected identities rather than breaking their bindings.

## Verification evidence

Actual local PostgreSQL/PostgREST and Nova handlers: `scripts/e2e_channel_engine_test.mjs`. It covers signed input, replay/concurrency, existing booking decisions, isolated identities, STOP/START, tenant denial, owner controls, stale workers, cancellation/expiry, induced crash recovery, pause recovery, delayed input and exact-once private replies. Graph delivery is intercepted with a local test stand-in; no real provider was contacted.

Actual browser and database: `scripts/e2e_channel_browser_test.mjs`. It signs in a TEST owner, saves/reloads/corrects a connection, approves a keyword response, delays a save while switching businesses and checks desktop/iPad/phone layouts. This is Chromium at device-sized viewports, not a real iPad or iPhone.

Other release checks: all local suites with `NOVA_CHROMIUM_PROVIDER=bundled`; lint/build; existing Core journey 69/69; security personas 90/90; clean installation 17/17, including all 48 manifest files reapplying. The final command outputs, release identifiers and hosted receipts are appended below after verification; do not infer a deployment from this file alone.

Two independent read-only reviewers reported no remaining critical/important issue within the reviewed channel and UI scope. Real platform approval and provider/device acceptance are outside those reviews.

## Code and database

New code: `api/_channels/`, `api/_coreQueueTick.js`, `src/pages/dashboard/ChannelCenter.jsx`. Existing `api/integrations.js` dispatches channel callbacks, owner controls and the bounded Core queue without adding a top-level serverless function. The shared booking engine and messaging dispatcher preserve existing phone/form behavior.

Migration: `supabase/migrations/20261105001057_nova_channel_engine.sql`, included in the strict manifest. New service-only tables: connections, identities, threads, events, comment rules and prepared turn results. It adds no credentials or real account records.

Hosted Core ticks are signed with their own prefix and an explicit project/enable gate. They can claim only channel turns, approved comment replies, existing Core turns and follow-ups; audit and executive schedulers retain separate allowlists. Bounded scheduled processing is preview infrastructure and does not establish continuous availability or a real-time response guarantee.

## Provider/account state and genuine remaining work

| Capability | Verified state | Still required |
|---|---|---|
| Instagram/Messenger/WhatsApp | Connector and owner controls locally verified | Owned business account/app, minimal permitted scopes, token, webhook subscription, applicable review, actual device/customer-journey acceptance |
| Apple Wallet | Signed-in Nova Systems LLC team DWCWDDW2DT and existing pass.app.nova-systems.rewards identifier verified; existing public CSR selected | Owner confirmation to issue a new signing credential; then install matching public certificate/intermediate, approve real loyalty program and test iPhone save/redemption |
| Google Wallet | Existing snapshot-building code | Issuer/service account, publishing approval, Android save/redemption and automatic update implementation |
| Apple Pay/Google Pay | Existing Stripe-hosted test payment path | Client-owned merchant onboarding, applicable agreements/domain validation, approved processing fees and real payment/refund acceptance |
| Apple Messages for Business | Requirements and use case prepared | Actual business registration, supported MSP, connector, review and device acceptance; Wallet credentials do not enable messaging |
| Android RCS | Requirements and use case prepared | Partner/brand agent, connector, verification, consent/device test and carrier launch approval |
| Twilio phone/SMS | Existing guarded code; fee-free preparation packet | Legal identity/opt-in verification, approved number/usage/A2P fees, registration and real call/SMS acceptance. No fee-bearing registration submitted |
| TikTok messaging | Official access requirements recorded | Supported Business Messaging access, connector and acceptance |
| LinkedIn | Existing publishing adapters | Supported access/review for actual permitted engagement; no arbitrary-DM connector or private-session scraping |
| Native stores | Responsive web app only | Real signed native builds, device tests, privacy/deletion declarations, review accounts and submissions |

No OAuth app, provider approval, live channel connection or native-store submission is fabricated. Apple Pay's separate agreement is not accepted. The existing matching Wallet private key is not regenerated, retrieved or exposed. The certificate creation page is prepared, not submitted; screenshot: `docs/qa/apple-wallet-certificate-ready-2026-11-04.png`.

## Owner continuation

After the engineering release is online, sign in to staging and open More → Integrations. Use Connections to prepare the first owned Meta account, or Coverage and applications to inspect each Apple/Android prerequisite. Never paste keys in chat or the connection form. The server-secret reference is a name, not a token.

The next explicit confirmation is Apple Wallet certificate issuance using the existing CSR. That creates a credential; it does not purchase a membership. No new payment authorization is implied. Other provider registrations still require actual legal/account facts in their secure forms and any applicable agreement approval.

## Release receipt

Pending final checks/publication at the time this checkpoint was written. See the appended receipt for what was actually deployed. Production main and the production domain are not changed by a staging release.
