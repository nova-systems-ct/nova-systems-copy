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

See the verified receipt below. Production main and the production domain are not changed by this staging release.

### Verified hosted receipt — 5 November 2026

- Published application commit: `15bc44c887ce5d8cefb5b16add3f6b7a4bf86fa4`; exact tested source tree `91a9c33fd7052f6ea0c6110d01db9b4e1e12d694`. Published on `codex/render-demo`, not production `main`.
- Render service `srv-dbjq50nlk1mc73a0cvb0`, existing free plan. Deploy `dep-dbltijlpetos738lqhb0` is **live**; provider completion timestamp `2026-11-05T01:19:24.07593Z`. Staging: https://nova-staging-demo.onrender.com .
- Additive migration applied to staging project `ubjnddxmdaxnbpzcmxnc`. SQL SHA-256 `bbbfe3f73ec35d5d81e44c3166fc1e5627677fc2cd26dde5c39549f8487e3121`. All six new tables have RLS enabled and deny direct anon/authenticated SELECT. Zero provider connection records exist; no fake accounts were inserted.
- Sending remains `NOVA_CHANNEL_SEND_ENABLED=false`; spending remains `NOVA_SPENDING_LOCK=locked`. The bounded Core HTTP receiver is enabled. No outbound messages or purchases occurred.
- Staging cron job **3**, `nova-staging-core-due-work`, is active every minute. Its SQL is in `supabase/operations/nova-staging-core-scheduler.sql`. It only makes an HTTP request when an eligible job is due and its registered capability is not paused. It signs with the existing Vault reference; no secret value is stored in this repository. Three observed scheduled runs succeeded. Zero eligible customer jobs were due.
- An explicit signed hosted Core smoke request, pg_net request **251**, returned HTTP **200**, `{processed:false}`, no timeout/error. That verifies the deployed receiver, project gate and signature; it is not evidence of a real provider conversation.
- `/healthz` returned 200, the dashboard route served the SPA, unauthenticated channel admin returned 401, and a wrong Meta verification token returned 403. A later request briefly returned 503 while the free service restarted; startup logs returned to “Nova demo HTTP server ready.” Free preview hosting is not a continuous-availability guarantee.
- Final local verification: **55/55 local suites, no skips** using bundled Chromium; lint/build passed; channel database and browser suites passed; existing Core journey **69/69**; security personas **90/90**; clean install **17/17**, manifest reapply **48/48**. Browser checks use a real Chromium browser and local database, with provider delivery intercepted, not a real social device.
- A legacy Core test initially failed because its simulated-provider phase did not explicitly unlock the new spending guard. The fixture now unlocks only after installing its isolated provider stand-in; the actual environment remains locked. A missing Chromium test was re-run with the installed bundle and passed **10/10**.
- The actual hosted browser sign-in submitted through secure credential entry returned **Invalid email or password**. No password was read, reset or changed. Supabase confirms the owner account **isaac_0427@icloud.com** is email-confirmed and has a password set. Signed-in hosted UI acceptance remains **blocked on owner sign-in**, not passed. Local signed-in browser acceptance is separate evidence.
- Security advisor comparison: the six new no-client-access RLS tables add informational “RLS enabled/no policy” notices by design; no new warning category appeared. Existing warnings remain: public `btree_gist` extension, three intentional auth helper SECURITY DEFINER functions, and leaked-password protection disabled. Review links: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public , https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable , https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . This is not a clean-security certification.

Apple, Google, Twilio and social-provider registrations retain the precise pending states in the table above. Account preparation, published code and database installation do not constitute a provider approval, working live payment method or App Store release. The new scheduler does not modify audit clocks or their separate scheduler.
