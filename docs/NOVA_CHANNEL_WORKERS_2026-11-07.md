# Nova channel workers — 2026-11-07

## What this release changes

Nova now has reusable inbound/outbound adapters for native Google RCS and supported Infobip Apple Messages for Business and TikTok messaging. They use the existing customer journey: approved service → real available time → held booking → agreement link. A signed agreement and any required payment still control confirmation; an adapter never invents a completed booking.

Instagram, Facebook Messenger, WhatsApp, RCS, Apple Messages and TikTok now have independent queue types and specialist worker controls. SMS has its own queue type too. The phone receptionist is an actual synchronous Twilio handler, rather than an invented background job. It rechecks the business, worker and emergency pause on every voice turn and transfers a paused call before creating a quote or booking.

Install Systems exposes account preparation to the owner of that business. It no longer requires Nova-wide admin access. Existing business scope, exact provider-account binding, deduplication, ordered turns, lease fencing, STOP, staff takeover and zero-spend controls remain enforced. Native RCS unsubscribe/subscribe events are honored without granting SMS or marketing permission.

### Credential boundary

A client cannot claim a server key by typing its environment-variable name. A separate Nova administrator assigns credentials to that exact, immutable business account. A client edit clears that assignment and identity verification. Apple/TikTok callbacks require the assigned private notification-profile secret. Google callbacks require the assigned client token and verified HMAC. Keys never appear in the client response or these files.

### Real hierarchy and work

The installer registers 21 executable capabilities, including the legacy compatibility worker, rather than 21 separate language models. Each has a versioned playbook; the specialists report to the COO, growth workers to the CMO, and executives to Isaac's decision assistant. Registration is idempotent. New channel workers inherit an old shared worker's pause, so an upgrade does not silently resume work. Independent channel pausing is enforced both when claiming and immediately before acting.

The workflows run without paid model inference. Optional role reasoning remains off by default. This release does not create a free, permanently hosted model or an always-on service guarantee.

## Verification

All provider deliveries below used isolated local stand-ins, never the user's real provider account or a real customer.

| Check | Result |
|---|---|
| Local logic/schema suites | 62 suites passed, bundled renderer enabled |
| Security personas | 90 passed |
| Existing full customer journey | 69 passed |
| Phone/SMS, Sentry and weekly schedule | 41 passed, including mid-call pause and SMS hold |
| Revive recovery | 20 passed |
| Installation safety | 16 passed |
| Clean manifest install | 17 passed; all 50 manifest files re-apply cleanly |
| RCS journey | Passed: administrator credential assignment, agent/signature binding, duplicate event, zero-spend gate, real service/time/agreement states, STOP and native preference events |
| Apple messaging journey | Passed: credential assignment, authenticated routing proof, own worker pause, service/time/agreement, STOP, no SMS fallback and cross-business denial |
| TikTok journey | Passed: credential assignment, authenticated routing, opaque IDs, own worker pause, service/time/agreement and refusal to activate a US account through the unsupported MSP route |
| Meta channel engine | Passed: real database, signed events, ordered/fenced turn, keyword replies, takeover, opt-out and tenant checks |
| Workforce installation | Passed: 21 capabilities/playbooks/reporting lines, idempotency, old pause preservation, scoped hosted maintenance and emergency pause |
| Customer browser journey | Passed: client owner prepares and reloads an RCS connection from Install Systems, retests installation, activates test-only workflow, desktop/iPad/phone fit |
| Lint / build | Passed |

QA images: `docs/qa/channel-workers-2026-11-07/`. These show local acceptance data, not connected-provider acceptance.

## Provider constraints and missing work

- **Nova has no live social/messaging connection in staging.** Code tests do not establish account authorization, provider review or device acceptance.
- **TikTok:** the documented Infobip route excludes US/UK/CH/EEA accounts. Nova is US-based. Direct TikTok Business Messaging approval remains a separate, unconnected route. No country substitution, invented registration or arbitrary automated LinkedIn DM claim.
- **Apple Messages:** Apple business registration, an approved MSP and real iPhone acceptance are still required. No application submission receipt exists.
- **RCS:** Google brand/agent access, service-account key, signed webhook, carrier launch and real Android acceptance remain required.
- **Phone/SMS:** number rental, messaging/call usage and applicable registration can cost money. No paid registration, live call, text or cold-call campaign was triggered. The receptionist does not originate cold calls.
- **Wallet/payments:** the earlier signed Apple snapshot/test pass and Google Wallet signer remain unchanged. Automatic Wallet updates, real device redemption, Google issuer setup and live payment/refund acceptance are not finished.
- **Nova's own booking setup:** actual hours, approved services/prices and agreement remain required. This release does not invent them or change its audits/clocks.
- **Hosting:** the existing free Render preview can sleep and has quotas. Bounded queued work is not a 24/7 availability promise. The primary public domain is not updated by staging releases.
- No new provider was registered, no agreement accepted, no customer contacted, no card charged and no paid model called.

## Sources used for implementation

- Google RCS webhook authentication: https://developers.google.com/business-communications/rcs-business-messaging/guides/integrate/webhooks
- Google agent-message endpoint: https://developers.google.com/business-communications/rcs-business-messaging/reference/rest/v1/phones.agentMessages/create
- Google brand/agent verification: https://developers.google.com/business-communications/rcs-business-messaging/reference/business-communications/rest/v1/brands.agents/get
- Google native preference events: https://developers.google.com/business-communications/rcs-business-messaging/reference/rest/v1/UserEvent.EventType
- Infobip Apple protocol: official Go SDK at commit `9fae5eb68db7b46ecf7617b072cc38add6e097f5`, `pkg/infobip/api/messages_api.go` and `pkg/infobip/models/messagesapi/`.
- Infobip Apple setup: https://www.infobip.com/docs/apple-messages-for-business/send-message
- Infobip TikTok API schema (observed in the rendered official documentation): https://www.infobip.com/docs/api/channels/tiktok/tiktok-outbound-messages/send-tiktok-messages
- Infobip TikTok incoming schema: https://www.infobip.com/docs/api/channels/tiktok/tiktok-inbound-messages/receive-inbound-tiktok-messages
- Infobip TikTok regional availability: https://www.infobip.com/docs/tiktok
- Infobip authenticated notification profiles: https://www.infobip.com/docs/subscriptions/subscription-components

## Release record

The initial channel-worker release is deployed to the existing free staging service, not the old public domain.

- Local source: `fbce04c` plus laptop-dispatch correction `02bdb6f`.
- Published source: `f7da9bd1808865c38a613e177baee09bd57030d0` on `codex/render-demo`.
- Hosted migration: `nova_channel_workers_and_messaging_20261107`, applied to the existing staging database. RLS remains enabled and channel ingestion/locking execute rights remain service-only.
- Render deploy: `dep-dbniva0u01pc73csvo6g`, confirmed live November 7 at 14:04:37 UTC.
- Staging: https://nova-staging-demo.onrender.com.
- Signed-in owner installed the workforce: 21/21 registered, correct reporting lines, spending locked. The install did not connect any provider or enable paid model inference.
- Post-release database check: zero prepared/verified/enabled messaging connections. This must remain visible in any handoff; registered workflows are not live messaging accounts.

Account activation and subsequent consent repairs are recorded separately in `docs/NOVA_PROVIDER_ACTIVATION_2026-11-07.md`. Those repairs require their own release evidence.
