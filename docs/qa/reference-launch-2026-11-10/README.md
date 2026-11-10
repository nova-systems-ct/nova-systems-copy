# Nova reference-design release — November 10, 2026

This release implements the supplied black-and-gold reference across the public hero, login, owner dashboard, calendar, audit assessment, workers, connections and CFO desk. Screenshots in this directory are actual browser renders with a disposable authenticated test organization and synthetic records. They are not evidence of live social delivery.

## Verified

- `npm run build` and `npm run lint` passed.
- `NOVA_TEST_RUNTIME=… NOVA_COMPANY_BROWSER=1 node scripts/e2e_company_operations_test.mjs` passed with real embedded PostgreSQL, PostgREST, authentication and browser actions. Audit evidence survives reload; bookings reschedule atomically; private photo upload and organization access are checked.
- The same acceptance suite passed again after SMS STOP/START handling was tightened. STOP cannot be bypassed by archiving; ordinary text does not reopen the thread. START/UNSTOP restores service replies without granting marketing consent.
- CFO request caps are immutable, approvals expire, revocation is enforced, and unknown costs remain quote-required. An approval does not enable dispatch. Reservations enforce approved ceilings atomically.
- Signed SMS/WhatsApp, Instagram comment private replies, delivery callbacks and Twilio speech turns were exercised with HTTP provider fixtures. No live provider message, call or hosted model request was made. Accepted and delivered are separate states; uncertain attempts are held for review.
- `verify_local_worker_models.mjs` ran the pinned Qwen2.5-0.5B model locally for all nine playbooks. `actual-model-drafts.json` records actual outputs and guardrail replacements, where applicable. These are separate role instructions on a shared model, not separately trained models.
- Spending-policy, channel-envelope, draft-policy and legacy voice/SMS regression suites passed.
- Both production migrations were installed and checked: private new tables use RLS, authenticated clients have no direct access, service RPCs are not exposed to authenticated clients, and no paid reservation existed after installation.

## Production work started

The owner-authorized launch committee was run in the real Nova organization. It saved one marketing brief and its review task, and routed provider costs to quote-required CFO requests. There were no eligible live inbound inquiries for follow-up drafting. No campaign was published and no external message was sent.

## Remaining live dependencies

- Twilio credentials, business sender and carrier registration must be verified before a live SMS or phone test. Voice uses signed speech-turn webhooks, qualification and CRM/callback tasks; it does not itself confirm calendar bookings.
- Instagram requires professional-account authorization, approved permissions and signed comments/messages subscriptions. A comment permits one private reply within seven days; continued messaging depends on a customer response and the current messaging window.
- TikTok requires approved Business Messaging access. Its current comment-to-message feature is restricted to accounts registered in Vietnam, Indonesia and Thailand; a US account cannot use this release to bypass eligibility. Inbox synchronization is bounded and manually initiated, not a registered always-on TikTok webhook.
- Apple Messages requires an approved business account and messaging provider. Apple/Google Wallet and social sign-in require the actual issuer/developer configuration. This release does not create an installed Wallet pass or activate Apple/Google login.
- Automatic hosted inference and billable transports remain behind the global spending lock, explicit verified per-action ceilings, a current approved CFO budget and channel activation. Default automatic replies remain paused. On-device drafting runs only while the user has the browser open.

Official contracts: [Instagram private replies](https://developers.facebook.com/documentation/instagram-platform/private-replies), [TikTok Business Messaging](https://business-api.tiktok.com/portal/docs/send-a-message-to-a-conversation/v1.3), [Twilio Gather](https://www.twilio.com/docs/voice/twiml/gather), [Twilio WhatsApp](https://www.twilio.com/docs/whatsapp/api).
