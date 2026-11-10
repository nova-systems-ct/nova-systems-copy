# Free launch workers and connections

The on-device AI feature uses the pinned `@huggingface/transformers` 4.3.2 runtime and the open Qwen2.5-0.5B-Instruct model, pinned to revision `22942cb7d7ba4cc81bb4673549ca4d4614469b5e`. It runs inference in a browser Worker, with separate playbooks and a fresh conversation for intake, appointment-response and follow-up drafting. The three workers share model weights to avoid three large downloads. The first model load is approximately 750 MB. Runtime code and WebAssembly assets are served by Nova; model weights are downloaded from Hugging Face. Prompts are not sent to a hosted AI inference API.

This is on-device drafting while the page is open. It is not an always-running telephone receptionist, autonomous message delivery or a newly trained proprietary model. The existing transactional booking worker continues to save requests and reservations independently of AI availability. The public helper can add a reviewed planning draft to the form. The owner can generate from an actual saved request and save a reviewed draft privately, with a CRM activity; saving does not send a message or complete the follow-up task.

The owner draft write is authorized by active Nova internal super-admin membership, bound to an active request in that organization, idempotent by draft UUID and immutable on retry. Cancelled or missing requests cannot receive new drafts. The attempted model and role are recorded as client-reported context, not cryptographic server attestation. New storage is private, RLS-enabled and service-role-only. Raw customer text is rendered as text, never inserted as HTML.

Apple/Google login controls use the authentication service's enabled-provider settings and existing safe-return callback. Disabled providers do not appear as usable buttons. Ordinary role/membership checks still govern the dashboard after any login method.

## Actual connection result from production

Private production build check at `2026-11-10T01:59:38.732Z` (November 9 Eastern), source `edb681a6e15e7c1fe6a24283622c4e959142f290`:

- Twilio's stored production credentials were rejected with HTTP 401. The submitted campaign could not be read with these credentials, so its fresh approval status remains unknown. This does not prove the campaign was rejected. The account connection must be repaired using the intended existing Twilio account before registering webhooks or sending a test.
- Apple and Google authentication providers were both disabled.
- Resend credentials were accepted and at least one sending domain was verified. No delivery test was sent.

The check performs only GETs to account/settings/domain/campaign resources. It never calls a messaging send, phone-call creation, paid model, calendar write, payment or new account resource. Only selected status fields are written to private build logs. No secret or raw provider response is logged. The matching owner-only check is available through `/api/integrations?op=launch-check`.

## External steps still required

The existing Twilio credentials need reconnecting to Nova production. Apple and Google provider credentials and redirects must be configured in the existing production authentication service. Instagram/TikTok owned-account access, webhook registration, applicable review and business messaging permissions remain pending. Apple Messages and Google Wallet need their platform setup and acceptance tests. No upstream approval or delivery result is fabricated.

Zero-cost code, design and local tests do not authorize a purchase, new paid resource or paid inference. Existing carrier-registration approval fees were separately disclosed in the previous launch record.

## Acceptance evidence

The model produced an actual draft in a browser Worker under the production CSP, and that reviewed draft was copied into the transactional request form. The existing real PostgreSQL/PostgREST acceptance then completed booking, receipt recovery, calendar download and cancellation. Owner-only draft saving, duplicate handling, conflict rejection, request binding, cancellation blocking and RLS denial passed against real PostgreSQL/PostgREST. Headless local model files were transported from the pinned public revision through the local test server because this host does not give its headless browser direct external egress; the model computation still ran in the browser. A separate local CPU test runs all three exact playbooks on the same verified weights and records whether the candidate passed the fact check or was replaced by a labelled template.

Applied migration `20261110021301_local_worker_drafts.sql` only after the local database acceptance passed. Paid model calls and Twilio mutations now require both `NOVA_SPENDING_LOCK=disabled` and `NOVA_BILLABLE_DISPATCH_ENABLED=true`; neither is enabled by this release. Read-only account checks remain available.

Model candidates are never booking authority. Unsupported prices, times, dates, action claims or placeholders trigger a visibly labelled verified template. A booked request’s appointment response always uses its saved time. Complete sentences are retained rather than showing a truncated final fragment. Template saves carry an explicit template label in the saved body; they are not represented as model-authored text.

Migration `20261110023037_worker_model_metadata.sql` updates the recorded attempted-model defaults to the final Qwen model. The earlier smallest-model candidate was evaluated and replaced; no live customer draft used that candidate.

## Deployed production acceptance — November 9 Eastern

Release e11800e1ced489b28a8fa3b08abcb18aca4f3885, deployment dpl_BprqHwRHF3JVY8w22GjxHHybRqf1, reached READY on the existing production project. The cloud browser downloaded the actual pinned public weights, generated a draft in the production browser Worker and copied it into a real test-mode request. The production API booked November 10 at 2 PM Eastern and saved the CRM contact/activity, exact no-SMS choice and pending follow-up task. Private owner-RPC draft storage was verified directly through the database with the reviewed synthetic draft; this does not claim an authenticated owner-UI production session.

Synthetic reference: 443f2712-b4c6-4a3f-8396-8980ee0c972e. Cancellation through the production page cancelled the request, meeting and follow-up task and reopened the test slot. One private reviewed draft and its CRM activity remain as test evidence. No external message, call or payment was sent. Screenshots and selected machine-readable results are in docs/qa/free-launch/.

The repeated production read-only provider check at 2026-11-10T02:44:54.996Z returned the same Twilio 401, Apple/Google providers disabled and accepted email credentials with a verified sending domain. Email delivery remains untested. There are zero published live appointment times; the owner must publish genuine availability in Launch Desk. Requests without a time continue to work. The full multi-channel launch is therefore not verified ready.
