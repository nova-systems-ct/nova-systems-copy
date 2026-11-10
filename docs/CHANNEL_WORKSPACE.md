# November 10 channel workspace

The owner dashboard now opens a black, ivory and gold workspace with actual recent web requests, published availability, a conversation inbox and named workers. Desktop navigation, phone navigation and the customer homepage use the same visual language. The responsive shell no longer forces the desktop sidebar onto phone screens.

The existing public domain is https://nova-systems.app/. Vercel project-domain inspection on November 10 confirmed that this domain is already verified and assigned to the existing production project. No domain purchase or paid hosting resource was created.

## Worker execution

Mira handles Instagram replies, Kai handles TikTok replies and Ellis handles Apple Messages replies. Their separate playbooks live in `src/lib/localAIPlaybooks.js`. Atlas represents the existing intake/booking workflow. The six role playbooks share a pinned Qwen2.5-0.5B-Instruct model; every generation receives fresh context. These are separate roles and conversations, not six separately trained proprietary models.

The optional model runs on the operator's device while the page remains open. First use downloads about 750 MB. Hosted paid inference is not called. A worker can prepare a response or, when the operator chooses the send-after-run option, call the same validated reply tool. The page must be open; this release does not claim a continuously running hosted LLM receptionist or automatic background monitoring of every channel.

All generated output passes the existing fact filter. Unsupported prices, times, booking/completion claims and placeholders trigger a labelled template. Appointment authority remains the transactional booking service, not the model. The operator can add Nova's real customer booking link to a reviewed response.

## Real channel actions

- Instagram text replies use the Instagram Login Send API: `POST https://graph.instagram.com/{version}/{account}/messages`, professional-account token, messaging permission, recipient ID and message text. The API version is an explicit deployment setting, not guessed from a token. Signed inbound events verify the exact raw request using `X-Hub-Signature-256`, match the configured business account and create a private conversation, legacy CRM contact/activity and follow-up task atomically.
- TikTok uses the Business Messaging API, not the content-publishing API: `POST /open_api/v1.3/business/message/send/`, with `recipient_type=CONVERSATION`, conversation recipient and `text.body`. The Sync TikTok action makes bounded read-only requests for recent STRANGER/SINGLE conversations and their message content. `URLSearchParams` preserves encoded conversation IDs. Sender/recipient IDs and timestamps come from the provider's `from_user`, `to_user` and `timestamp` fields. Recent text synchronization is intentionally bounded and is not a full-history import or a registered always-on TikTok webhook.
- Apple Messages outbound uses CM.com's documented Apple channel envelope and header authentication. It sends a stable reply reference and accepts only the matching `Accepted` receipt with no provider error. A stored `cm-reference:` value is the echoed correlation reference, not a provider-assigned message ID. CM's public inbound MO schema does not document a cryptographic signature. The Apple inbound bridge therefore requires an authenticated, operator-verified MSP relay with a bearer secret in an HTTP header. It rejects requests until that relay is explicitly configured and verified; it never trusts an account ID in JSON as authentication. Selecting CM in code does not create a provider account or an Apple approval.
- SMS/voice, WhatsApp and email connection cards refer to the existing installation paths. They are not claimed as live LLM channels. Billable dispatch remains locked by default.

Clean raw-body routes share the existing consolidated function, preserving the project's function limit:

| Purpose | Route |
| --- | --- |
| Owner workspace | `/dashboard/conversations` |
| Owner API | `/api/client?resource=channels` |
| Instagram webhook | `/webhooks/instagram` |
| Authenticated Apple MSP relay | `/webhooks/apple-messages` |

## Privacy, dispatch and receipts

Migration `20261110121400_channel_workspace.sql` creates private RLS-enabled channel tables and three service-only SECURITY INVOKER functions. An active Nova internal super-admin membership is required for owner actions. A role in an unrelated client organization cannot access this workspace. Anonymous and ordinary authenticated users cannot execute the storage RPCs or read the tables.

Inbound IDs deduplicate webhook retries. Reply UUIDs bind immutable text and thread identity. Drafts never complete follow-up tasks. A confirmed provider acceptance or labelled practice execution records the appropriate CRM activity and completes the response task. Acceptance is always displayed separately from delivery; no live delivery result was fabricated. An uncertain or in-flight result blocks another reply on that thread. Expired reply windows, pause/opt-out state and conservative reply caps are checked inside the locked database transaction.

Instagram replies require a recent customer-initiated conversation. TikTok enforces its 48-hour/10-reply window. The Apple bridge uses a conservative 24-hour operator window; this is an implementation restriction, not a claim about Apple's platform-wide policy. No new arbitrary recipient can be supplied in a send request.

Practice conversations are visibly labelled, use a reserved test account ID and remain private. Their `test_recorded` outcome means no provider message was sent. They still create actual CRM records and response-task receipts, so the owner can test the full internal workflow without spending money.

## Configuration and present limits

No production provider secret was read, exported, rotated or placed in the browser. New code reads only the configured server environment at runtime.

| Channel | Server settings | Additional requirement |
| --- | --- | --- |
| Instagram | `INSTAGRAM_ACCOUNT_ID`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_API_VERSION`; inbound `INSTAGRAM_APP_SECRET`, `INSTAGRAM_VERIFY_TOKEN` | Correct account authorization and messaging permission; register webhook |
| TikTok | `TIKTOK_BUSINESS_ID`, `TIKTOK_MESSAGING_ACCESS_TOKEN` | Approved Business Messaging access and account authorization |
| Free social dispatch | `NOVA_FREE_SOCIAL_SEND_ENABLED=true` | Explicitly verify the intended account and zero-cost delivery allowance first |
| Apple Messages via CM | `CM_PRODUCT_TOKEN`, `APPLE_BUSINESS_ACCOUNT_ID`; inbound `CM_INBOUND_SECRET`, `NOVA_CM_RELAY_VERIFIED=true` | Approved Apple/MSP account, verified authenticated relay and budget authorization |
| Billable dispatch | `NOVA_SPENDING_LOCK=disabled` and `NOVA_BILLABLE_DISPATCH_ENABLED=true` | A later owner spending decision; not enabled by this release |

The previously deployed read-only production check returned Twilio HTTP 401, Apple/Google login providers disabled and valid email credentials with a verified sending domain. Fresh deployment checks should be read before changing that status. TikTok/Instagram messaging credentials were not configured. Apple Messages/Wallet and Google Wallet still need their provider setup, credentials/permissions and live acceptance tests. The conversational telephone AI receptionist is not deployed. No platform approval can be guaranteed by application code.

## Verification and source contracts

The channel acceptance script runs real disposable PostgreSQL/PostgREST and authenticated browser sessions. Provider HTTP responses are explicit fixtures, not live delivery evidence. Actual model tests use the pinned public weights: native CPU tests exercise all role playbooks, and the optional browser test exercises the same Worker through the inbox and persists private practice responses. The local browser's public model assets are transported through a local test server because this test host does not give its headless browser direct external egress. Computation remains actual browser WASM. See `docs/qa/launch-day-2026-11-10/` for selected logs and screenshots.

Primary contracts checked on November 10:

- Meta's official collection: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- TikTok send: https://business-api.tiktok.com/portal/docs/send-a-message-to-a-conversation/v1.3
- TikTok conversations: https://business-api.tiktok.com/portal/docs/get-a-list-of-conversations/v1.3
- TikTok messages: https://business-api.tiktok.com/portal/docs/get-a-list-of-messages/v1.3
- TikTok setup: https://business-api.tiktok.com/portal/docs/business-messaging-api-get-started/v1.3
- Apple's approved-provider and experience-review process: https://register.apple.com/resources/messages/messaging-documentation/
- CM Apple envelope: https://developers.cm.com/messaging/docs/apple-messages-for-business
- CM header authentication and acceptance receipt: https://developers.cm.com/messaging/docs/integration
- CM inbound envelope: https://developers.cm.com/messaging/docs/incoming-messages
