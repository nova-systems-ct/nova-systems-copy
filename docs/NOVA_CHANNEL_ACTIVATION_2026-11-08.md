# Nova channel activation — November 8, 2026

## Saved account work

Apple Developer sign-in succeeded and was verified on the actual Nova Systems LLC account. Registered `Nova Workspace Sign In`, Key ID `D2AG676RYT`, with only Sign in with Apple enabled and primary app `app.nova-systems.workspace`. The private P-256 key was downloaded and retained outside source control in protected files (mode 0600). The offline ES256 utility generated a client secret for `app.nova-systems.workspace.web`; its signature verified and it expires May 7, 2027 at 16:32:43 UTC. No private credential is included here or in the proof screenshot.

Supabase's existing-account password sign-in reached an hCaptcha human-verification challenge. Apple provider settings have not been saved and real Apple sign-in to Nova has not been demonstrated. The challenge is preserved for owner completion. Automatic approval review rejected Apple's optional Remember me setting; normal sign-in succeeded without changing that setting. A hosted backend credential-save attempt returned an error; do not assume the key is durably saved in that backend. Protected local copies still exist and need an authorized durable secret-store backup.

Twilio account sign-in and SMS multi-factor verification succeeded. The account UI showed 90 free SMS and 73 free voice minutes remaining. No live test has been sent or called in this continuation. The existing phone is `(860) 962-6160`.

The account has two existing rejected campaigns, not one:

| Existing campaign | Use case | Messaging service | Monthly fee after approval |
| --- | --- | --- | --- |
| `CMd844e5f9104dd9b5b785509cd3fc785b` | LOW_VOLUME | `MGcfd121875758c03eb9a88db6fca26767` | $1.50 |
| `CMf068d0171566c5f5eda3243d1172eae1` | Account Notification | `MGb4cbfaf0ce69cc14eb7bc020a9038ec2` | $10 |

The low-volume campaign currently has no assigned phone numbers. Both use approved brand `BN89a7130e6725c7292f7d9af7aa27de31`. The CTA rejection is 30909. The old flow describes form submission as consent and includes marketing; the new program is limited to separately requested service texts. Reuse an existing suitable campaign rather than create another. The owner was notified before submission that the low-volume campaign costs $1.50/month from approval, with usage charges separate. Current detailed Twilio guidance says the same-campaign resubmission avoids a second vetting fee. No campaign has been resubmitted by this code release; inspect the final UI for any different charge before doing so.

References: [campaign correction](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/troubleshooting-a2p-brands/troubleshooting-and-rectifying-a2p-campaigns-1), [fees](https://help.twilio.com/articles/1260803965530-What-pricing-and-fees-are-associated-with-the-A2P-10DLC-service-), [CTA and policy requirements](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/collect-business-info).

## Production service-request feature

The production Vercel deployment resolved from `nova-systems.app` was `dpl_BpZUUKZkCJAXpMR7ZCkb8brWmHXC`, Git commit `bd531333e6a36919a20a38ab4d9c5d817798f402` on `main`. This release is based on that exact deployed commit. The feature consists of a public systems-request form, program-specific privacy/terms, an early service-request branch in the existing booking API, a private transactional consent ledger, and a staff intake display for requests without appointments.

Public routes prepared: `/service-request`, `/service-texts/privacy`, `/service-texts/terms`. The main desktop/mobile navigation's **Talk to Nova** button opens the real service-request page using a native link. The server and form share disclosure `nova-service-sms-web-2026-11-08`. Phone is optional. The service-text checkbox is optional, initially unchecked, independent of marketing and purchase. Its disclosure is present in the server HTML as well as the shared JavaScript policy. The server validates the exact version, normalized phone, idempotency ID, timing and contact fields. Client-supplied marketing or organization fields grant nothing.

The production database is `xizmgruvuazmummotzkp`. Its existing active schema uses `intake_requests`, `nova_crm_contacts` and `nova_crm_activities`; the separate newer staging worker schema is not present there. The new function saves the existing intake/CRM records and the exact service-only receipt atomically. Existing contacts are reused without overwriting their information or permissions. New contacts use `inbound_request`, not a cold-outreach state. A request does not create a calendar booking or authorize marketing. This route calls no email, phone, SMS, model, payment or background job provider.

Applied migration `20261108172929_service_sms_intake`. It adds the RLS-protected `nova_service_sms_receipts` table and a SECURITY INVOKER function callable only by `service_role`. Existing intake phone/date/time columns now allow NULL for optional phones and unbooked requests. Existing records were unchanged: 0 intake requests, 3 CRM contacts, 9 activities. New receipt count was 0 after migration. Hosted verification confirmed RLS enabled; anonymous and authenticated-client function access denied; server execution allowed; no SECURITY DEFINER. The advisor's RLS-without-policy informational finding is intentional: receipt data is server-only, with no public/client policy.

## Verification

Real disposable PostgreSQL/PostgREST acceptance passed: unchecked/phone-only never grants SMS or marketing, exact disclosure/source/time receipt, contact reuse, duplicate retry and concurrent request suppression, no invented appointment, anonymous/unrelated-client access denial, and complete rollback when an activity insert fails. The expected injected failure logs a generic storage error during the test.

Browser acceptance passed with the actual form/API/database: public policy links and confirmation, both selected/unselected saves, desktop/iPad/phone fit, no page errors and zero email-provider requests. Lint and production build passed. Evidence is in `docs/qa/service-sms-web-2026-11-08/` and `docs/qa/channel-activation-2026-11-08/`.

Published commit `7ee5a0b7db4771c23bba7668a255388d7d24e1e9` to the existing GitHub main branch. Production deployment `dpl_CuxsVWPTBU1MBmoaJ9mDb1cjvWPh` reached READY. All three public routes are live on `nova-systems.app`; the home navigation opens the form. Both real production browser saves passed: unchecked request `8814a0d1-75ad-4287-9f6b-2f4abefdbc25` and checked request `c2a8e640-cb44-4ad6-b230-5c64d9b25e14`. They reused one synthetic contact. Both receipts are marked `is_test=true`, the intake/contact source is `test_service_request`, and the two activities are `test_only`. Neither request granted marketing permission or created an appointment. No message, call, email, paid-model request or payment was dispatched. Exact receipt metadata is in `production-acceptance.json`; the matching live screenshots are in the same evidence folder. Local tests and provider account preparation are not carrier approval, real-device Wallet acceptance, a live LLM conversation, or proof that every channel is connected. Paid model dispatch remains off. Google, Apple Messages, TikTok and Instagram still require their outstanding authentication/access/review steps.
