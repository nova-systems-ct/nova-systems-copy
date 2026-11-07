# Nova provider activation — 7 November 2026

## Current saved state after the owner's approval

This section supersedes the earlier preparation and blocked-attempt notes below. The owner specifically approved the Apple capability confirmation and the limited TikTok grant. Those two actions were completed. No money was spent, no paid plan was accepted, and no external SMS, call or paid model request was sent.

| System | Saved result | Still required for live use |
| --- | --- | --- |
| Apple web sign-in | Enabled Sign In with Apple on `app.nova-systems.workspace`; saved and reopened to verify it. Registered Services ID `app.nova-systems.workspace.web`, associated the primary app, and saved staging domain `ubjnddxmdaxnbpzcmxnc.supabase.co` and return URL `https://ubjnddxmdaxnbpzcmxnc.supabase.co/auth/v1/callback`. Reopened the registered configuration and verified both stored URL records. | A new key named `Nova Workspace Sign In` is at final Register review with only Sign in with Apple selected. It has not been issued; creating this persistent signing credential requires specific confirmation. Then configure the server-side Supabase Apple provider and test a real account. The hosted provider remains disabled until that is done. |
| Apple Wallet / Watch | Existing pass signing integration and developer membership/certificate were preserved. | No real iPhone or Apple Watch save, update or redemption was observed. A signed test package alone does not prove device acceptance. |
| Apple Messages for Business | Opened Business Register and submitted sign-in through the secure authentication flow. | Apple rejected the supplied verification code. No agreement acceptance, MSP selection, submission or live business conversation was completed in this continuation. |
| Google / Android | Attempted the existing Google Wallet sign-in through the secure flow. | Google returned "Couldn't find this account." Correct account access, issuer/OAuth setup, provider credentials and real-device proof are pending. No replacement account was invented. |
| Twilio SMS / voice | Prepared the verifiable optional service-text flow and retained the existing rejected campaign/phone rather than creating a duplicate. | The current secure console login returned "Wrong email or password." No resubmission, new campaign or live call/text was made. Verify the exact existing use case, public CTA, plan and recurring charges before submitting. |
| TikTok | Submitted the owner's approved seven-scope TikTok For Business grant: `user.info.basic`, `biz.account.email`, `biz.account.info`, `bizpartner.user.info`, `message.list.admin`, `user.account.type`, `user.info.email`. Unrelated phone, advertising, video publishing, private-post, analytics and settings permissions stayed unselected. | Linking the existing TikTok For Business account reached an interactive CAPTCHA. No attempt was made without specific confirmation. This first-party console grant is not a Nova Business Messaging API approval, channel connection or customer conversation. The implemented MSP route still excludes US accounts. |
| Instagram | On app `1553124729858090`, `instagram_business_basic` and `instagram_business_manage_messages` now show **Ready for testing**. | Adding `instagram_business_manage_comments` failed twice with Meta's "Something went wrong" error and remains unavailable. No owned professional account, token, verified webhook, live DM, publication or app-review submission was completed. |
| Nova intake / CRM | Replaced the audit-only request copy with calls, messages, bookings and customer follow-up. The request continues to the private conversation; it does not promise a confirmed calendar slot. Disclosure `nova-service-sms-2026-11-07-v2` covers requested service updates. | Live provider delivery and actual approved service/calendar configuration are separate. Zero live channel connections were established by these account changes. |

Twilio's current detailed guidance says editing/resubmitting the **same existing rejected campaign** does not incur a second vetting fee; a replacement campaign would. This corrects the earlier blanket statement that every resubmission is fee-bearing. Twilio also says monthly campaign charges begin at approval. Therefore a free vetting resubmission is not automatically a zero-cost commitment: inspect the actual account and rate before taking the final action under the owner's $0 instruction. References: [same-campaign correction](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/troubleshooting-a2p-brands/troubleshooting-and-rectifying-a2p-campaigns-1), [campaign fee guidance](https://help.twilio.com/articles/1260803965530-What-pricing-and-fees-are-associated-with-the-A2P-10DLC-service-).

Evidence: `docs/qa/provider-activation-approved-2026-11-07/` contains the actual saved Apple web configuration, final unissued key review, and Instagram permission result. No private key, password, OTP, callback authorization code, session URL or access token is saved in these screenshots. The earlier entries below describe the preceding attempts, not the current state of those two approved actions.

Validation after the request copy/disclosure change: service-consent/opt-out acceptance passed all five groups; real public-form/local API/database browser acceptance passed for unchecked optional permission, both private continuation paths, exact versioned receipt, zero promotional permission and zero external SMS, with desktop/iPad/phone fit. Lint and production build passed. Local acceptance is not carrier or identity-provider approval.

## Earlier preparation and release history

## Scope and actual result

The owner prioritized working channels over diagnostics. No audit record, research run or clock was changed. Spending, paid model calls, outbound tests and fee-bearing registrations stay locked. This is an engineering/account receipt, not a claim that every provider is live.

The preceding channel release is on free Render staging (`f7da9bd`, deploy `dep-dbniva0u01pc73csvo6g`). Nova has 21 registered executable workflows, with individual playbooks and per-worker optional model configuration. LLM reasoning is disabled, not silently replaced with a paid call. The scheduled deterministic role handlers still execute. Zero messaging accounts are connected. The hosted Nova form token exists, but Nova has zero approved operational services and zero approved agreement templates; agents cannot invent the commercial playbook or complete a real booking without those inputs and actual availability.

## Account checks through the real provider portals

| Provider | Observed result | Remaining boundary |
| --- | --- | --- |
| Apple Developer | Signed in to Nova Systems LLC. Existing organization membership renews July 8, 2027. Existing `Nova Rewards Wallet` Pass Type certificate `YHJMW6Q3S4` expires December 5, 2027. | Registered the free explicit App ID `app.nova-systems.workspace` (Nova Systems Workspace); it appears in Apple’s identifier list. No optional capabilities or new signing credentials were enabled. No membership purchase or duplicate certificate. Real iPhone/Watch save and redemption remain unobserved. |
| Apple Messages for Business | Signed in successfully to Apple Business Register. The first screen is acceptance of Messages for Business and Business Register agreements. Both remain unchecked/unaccepted. | Owner must approve those exact binding agreements before acceptance. MSP selection, costs, business registration, Apple review and a real conversation are not complete. |
| Google Wallet | The sign-in attempt returned “Couldn't find this account.” | Correct Google account is needed. No substitute identity, issuer, service-account key or publishing application was created. |
| Twilio | Existing account and phone number `(860) 962-6160`; voice enabled; brand step complete; campaign rejected. Rejection explicitly says CTA/opt-in could not be verified. | No second brand/campaign created, no resubmission, purchase, call or SMS. Existing voice configuration points to an older Nova deployment; do not replace it with an unverified sleeping preview. |
| Meta | Signed in to existing Nova Systems app `1553124729858090`, portfolio `nova_systems27`. Instagram, Messenger and WhatsApp use cases exist. App is unpublished. | Messaging permission is at the add-permission confirmation and not accepted. Instagram's saved redirect points to an older deployment. No channel credentials, account grant, webhook subscription, app publication or review submission completed. |
| TikTok | Opened official Business Messaging hub and Business account login. Secure login could not validate the current form controls; no credentials were entered through model-visible tools. | Account login and direct Business Messaging access still needed. The implemented Infobip route excludes US accounts; no country substitution or claim of US direct approval. |

No private address, tax ID, password, OTP, access token, private key or session URL belongs in this document or screenshots committed with it.

## Concrete SMS repair

The rejected campaign said submitting a form itself grants phone/SMS permission. That is not the actual permission model. A production bug also treated a phone field as a customer-initiated SMS request even without the explicit checkbox.

Implemented:

- Phone-only form submissions create a web conversation and queue no SMS.
- `/book` has a separate optional, initially unchecked **Service texts** checkbox. It identifies Nova, the service purpose, variable frequency, message/data rates, STOP, HELP and that consent is not a purchase condition. Privacy and terms links sit beside it.
- The server stores the choice, normalized phone, exact server disclosure/version, purpose, source paths and time in the existing source-event receipt. Submitted custom disclosure text is never trusted.
- Nova's organization identity enforces the policy for both the named Nova route and the legacy form-token route. Posting a generic marketing flag cannot bypass it.
- Service permission does not grant marketing/Revive permission. Carrier START cannot upgrade a service-only contact into that promotional audience. Existing independent marketing permission is not erased by a new service checkbox.
- Explicit opt-in plus continuing by text queues the actual dedicated `ops_sms_turn`; continuing on the web avoids a parallel text conversation.
- REVOKE and OPTOUT suppress alongside the other carrier-standard STOP keywords. Signed Twilio `OptOutType` handles localized keywords without queuing a duplicate reply; a STOP body takes priority over conflicting metadata.
- Privacy/terms explain the actual service-text program and no sharing of mobile opt-in data for third-party marketing. These changes are not a legal certification or guarantee of carrier approval.

No database migration is needed; receipts, contact scope and queue fields already exist. Sending remains off.

## Prepared campaign correction — not submitted

Only use this after the same form and policies are publicly deployed on the domain entered in the campaign. The old public `nova-systems.app` build is not automatically updated by a staging deployment.

**Campaign description:** Nova Systems sends service messages about a request the person initiates: requested booking links, appointment reminders and requested service updates. This campaign does not send promotional messages. A separate approved campaign and consent process are required for promotions.

**Message flow:** A person visits the deployed Nova booking form, enters their name, contact information and request, and may independently select the optional Service texts checkbox. The checkbox starts unchecked and is not required to submit a request or buy a service. The disclosure identifies Nova Systems, the service purpose, message frequency, message/data rates, STOP/HELP and the optional nature of consent. Privacy and terms links are adjacent. The server saves the exact disclosure version/text, choice, phone, source and time. A phone number alone does not opt the person in. Opt-outs are honored before later sends. SMS opt-in data is not sold or shared for third-party marketing.

**Sample 1:** Nova Systems: Here is the booking link you requested: [real Nova private booking URL]. Reply STOP to opt out or HELP for help. Msg & data rates may apply.

**Sample 2:** Nova Systems: Your requested appointment reminder: [actual confirmed date/time]. For changes, use [real Nova booking URL]. Reply STOP to opt out or HELP for help.

**HELP:** Nova Systems support: isaac@nova-systems.app or (203) 706-0504. Reply STOP to opt out. Msg & data rates may apply.

Bracketed sample elements are registration examples of actual runtime values, never fake live confirmations. Configure the provider's actual STOP/START/HELP replies to match the submitted program. Do not claim a keyword signup flow or promotional consent that has not been implemented and shown.

Twilio registration/vetting, recurring campaign fees and usage are chargeable; the current zero-spending instruction blocks a fee-bearing resubmission. Exact account charges must be checked at the actual final step. Sources:

- https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/quickstart
- https://help.twilio.com/articles/1260803965530-What-pricing-and-fees-are-associated-with-the-A2P-10DLC-service-
- https://help.twilio.com/hc/en-us/articles/11847054539547-A2P-10DLC-Campaign-Approval-Best-Practices
- https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out

## Acceptance and release

Local verification completed against the actual app and disposable PostgreSQL/PostgREST:

- Form/SMS receipt and opt-out acceptance: five groups pass, including phone-only refusal, versioned service receipt, form-token bypass prevention, STOP/REVOKE/OPTOUT and localized signed provider opt-out, duplicate suppression, no parallel web/SMS turn and service-only START. No external messages.
- Public browser journey: unchecked optional checkbox, both submissions reach private booking, versioned receipt saved, zero promotional opt-ins and zero SMS sends; desktop/iPad/phone fit.
- Wallet browser journey: real signed-package download with synthetic local certificate, zero programs/accounts/points; desktop/iPad/phone fit. The earlier hard-coded 13-worker assertion was stale and corrected to 21; no Wallet production change was needed. This is package/workflow evidence, not Apple device acceptance.
- Core customer journey: 69/69, including actual worker dispatch, using local SMS/payment stand-ins.
- Tenant/security personas: 90/90.

The final local gate, lint/build and exact staging release are appended below after completion. A successful local provider stand-in is not a live carrier/device test.

## Next account actions, in order

1. Owner decision on the two Apple business agreements. Continue the saved signed-in registration only after action-time approval; prepare the actual brand/MSP submission without agreeing to any paid provider plan.
2. Finish the Google sign-in with the correct existing account through the secure form, then prepare its issuer registration. Any new service-account access grant requires approval at that boundary.
3. Publish and visually verify the actual Nova opt-in on the campaign's domain; revise the existing rejected campaign, not a duplicate. Keep fee-bearing resubmission blocked.
4. Approve the specific Meta messaging permission change; connect only an owned professional account and save credentials server-side. Do not advertise live messaging until a signed inbound event, actual reply and CRM/booking handoff are observed on that account.
5. Complete TikTok login and direct-access eligibility. Do not activate the US-excluded MSP path for Nova.
6. Owner supplies the approved service, prices/duration, real availability, agreement and escalation policy. Test one complete real customer journey with explicit recipient/cost authority before opening the channel to customers.

## Continuation: workspace sign-in

Implemented Apple and Google sign-in entry points in Nova's real login screen. Each checks Supabase Auth's public provider setting before offering a redirect. Disabled/unreachable providers leave password sign-in usable. The SDK receives an allowlisted provider and a same-origin callback with a validated in-app destination. Callback errors are removed from the URL and cannot reuse a previous browser session as evidence of a successful provider login. No provider secret is included in frontend code.

Fresh staging Auth check on November 7: Apple `false`, Google `false`, email `true`. Both social providers remain unconfigured; these buttons are not a claim of successful live sign-in.

Apple Developer authentication succeeded through the secure sign-in form. Existing Nova Systems Workspace App ID `app.nova-systems.workspace` was confirmed. Its Sign In with Apple option was prepared, but saving it reached Apple's Modify App Capabilities warning: existing provisioning profiles would be invalidated. Automatic approval review rejected the final confirmation, so the change was not saved. It needs specific owner approval before retrying. No alternate route was used. No Sign in with Apple key, Services ID association or Supabase provider secret was created.

Google Cloud's client setup page returned Site Unavailable after one reload. Google Wallet's secure sign-in returned "Couldn't find this account" for the supplied identifier. No Google account, issuer, service account or OAuth client was substituted or created.

The existing Meta app is still unpublished. Its Instagram Unified Login setup currently has no compatible configuration and retains the old `nova-systems.vercel.app` redirect. No new permission, token, configuration, webhook subscription or publication was granted. Do not point it at a route that Nova has not implemented.

Local acceptance passed with the real frontend, SDK, API and database, and isolated OAuth identities: Apple/Google authorization redirects, return to the CRM, same-origin destination, rejected callback despite an existing session, disabled/unavailable provider handling, password fallback, desktop/iPad/phone fit. This is not real Apple/Google identity acceptance. Lint/build pass. Across the local logic/schema gate, 61 suites passed on the initial run; a cost-register wording assertion was updated for the actual rejected SMS campaign, and that suite plus the initially skipped renderer both passed afterward with bundled Chromium (63 suites covered). Public SMS form browser acceptance, service-consent/opt-out acceptance and the 69-check core customer journey also passed. No external calls, texts, payments or model inference were triggered.

## Deployed release and remaining account approvals

- Published source: `283e07d2cc1b47d6c08168470e9f1cf5fe81e82c`, branch `codex/render-demo`.
- Existing free Render service deploy: `dep-dbnnpcrbc2fs73flf4dg`, live November 7 at 19:33:53 UTC (2:33 PM Eastern).
- Live https://nova-staging-demo.onrender.com/login shows the new Apple/Google entry points and their actual pending setup state. The public `/book` form shows optional, unchecked service-text permission. `/healthz` returned `{"ok":true}`.
- The separate older `nova-systems.app` production site was not replaced. The opt-in therefore still must be deployed on the exact campaign domain before carrier resubmission.
- Security personas: 90/90 passed. No application errors were returned by the subsequent Render error-log query; this is not a guarantee of continuous availability on free hosting.

TikTok's Nova Systems account completed Apple authentication and email identity verification. The TikTok For Business grant screen is prepared with only profile, business email/information, partner information, inbox management, account-type read and email read selected. Phone numbers, Promote, ad/video publishing, non-public posts, account-type changes, settings changes and analytics permissions are unselected. **Continue has not been pressed:** it grants account/inbox access and accepts TikTok For Business terms, requiring specific owner approval. This is account preparation, not a Nova Business Messaging API connection or a verified customer conversation. A prior attempt to narrow the proposed scopes did not execute because automatic approval review hit a usage limit; after continuation, the switches were prepared successfully through the same browser interface. No workaround or grant was used.

Apple's pending capability save still needs specific approval because Apple says provisioning profiles for `app.nova-systems.workspace` would be invalidated. The rejected confirmation has not been retried. Google still needs the correct existing account, Meta remains unpublished/unconnected, and Twilio's fee-bearing campaign resubmission remains outside the zero-spending instruction. No live channel connection has been established by these actions.

## Offline Apple client-secret setup utility

`scripts/apple_signin_secret.mjs` now generates the ES256 client-secret JWT required for web Sign in with Apple from an existing, authorized P-256 key. It runs locally, has no network calls, prints no secret, creates only a new owner-readable file, refuses existing files/symlinks, and keeps the key and output outside the repository. Its default lifetime is 30 days; renewal before expiry remains an operator task. It does not create an Apple key, enable a provider, renew membership or accept account terms.

After the real Services ID and Sign in with Apple key exist, run locally using actual IDs and private paths:

```sh
node scripts/apple_signin_secret.mjs --key-file /private/AuthKey.p8 --key-id APPLE_KEY_ID --team-id APPLE_TEAM_ID --services-id REGISTERED_WEB_SERVICES_ID --out /private/apple.client-secret.jwt
```

The generated JWT belongs only in Supabase's server-side Apple provider configuration. The web Services ID must match the token subject and be listed first for the web OAuth flow. Apple's callback for this staging project is `https://ubjnddxmdaxnbpzcmxnc.supabase.co/auth/v1/callback`; the app returns to Nova's `/auth/callback` with its validated `returnTo` destination. No real signing key or secret was supplied or generated in this task.

The new test verifies actual P-256 signatures with fresh synthetic keys, claim/expiry validation, private file permissions, refusal to overwrite or follow an output symlink, repository exclusion and absence of credentials in CLI output. It passed, and lint passed. This setup utility does not change the already deployed app and needs no additional app deployment.

Current references: https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret ; https://developer.apple.com/documentation/SigninwithAppleRESTAPI/Generate-and-validate-tokens ; https://supabase.com/docs/guides/auth/social-sign-in/auth-apple .
