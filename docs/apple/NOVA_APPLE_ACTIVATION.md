# Nova Apple activation — 1 November 2026

## Verified state

The owner completed Apple sign-in. Nova Systems LLC is enrolled as an organization, Team ID DWCWDDW2DT, with renewal July 8, 2027. The updated-agreement blocker cleared through owner interaction; the agent did not accept it. Certificates and Identifiers are now accessible. No purchase or renewal was made.

Nova's rewards ledger exists, but `api/_ops/loyalty.js:walletReadiness` deliberately refuses issuance. Pass signing, authenticated pass updates and device acceptance are not implemented. Android Wallet issuance is also not implemented. Website access on an iPhone/Android is separate from Wallet integration.

## Prepared material

`Nova-Wallet.certSigningRequest` is a real RSA-2048 certificate signing request, checked with `openssl req -verify`. It is public material and contains no private key. With the owner's explicit authorization, the encrypted matching private key and its password were saved to the Render staging service's server environment as APPLE_CSR_PRIVATE_KEY_PEM and APPLE_CSR_PRIVATE_KEY_PASSWORD. No values were printed or committed. Local copies remain mode 0600 outside git. If that private material is lost, generate a new key/CSR before requesting a certificate. A CSR is not an Apple-issued certificate.

Registered and read back in Apple Developer: **Nova Rewards**, `pass.app.nova-systems.rewards`. The Pass Type ID initially had no certificates. Its certificate form is prepared but no CSR has been uploaded and no certificate has been issued.
Contact supplied by owner: Isaac Nova, isaac@nova-systems.app, (203) 706-0504, https://nova-systems.app . Business: Nova Systems, Waterbury, CT. Entity and team are verified above. Do not publish the account's private mailing address. Support coverage and reward rules still require owner decisions; do not fabricate them.

## Wallet sequence

1. Securely sign in to the existing Apple Developer account; verify team and active membership. Do not renew or buy enrollment.
2. Confirm the Pass Type identifier and create it in Certificates, Identifiers & Profiles.
3. After safeguarding the private key, request its Pass Type certificate using the prepared CSR.
4. Install the certificate, matching private key and required Apple intermediate certificate in server-side secret storage, never GitHub or frontend variables.
5. Implement and verify pass package signing, per-customer scoped issuance, authenticated update/registration endpoints, APNs updates and counter redemption against the real ledger.
6. Test adding/updating/revoking a pass on a physical iPhone. Do not mark the feature live before this succeeds.

## Messages for Business: a separate approval

Apple's current first-party guide requires selecting an Apple-approved Messaging Service Provider, preparing use cases, creating an internal test account, building/testing the experience and having the MSP submit a screen recording for Experience Review. An Apple Developer subscription does not activate this channel.

Draft use cases grounded in Nova's intended product:

- Answer questions using the business's approved knowledge and route uncertain requests to a person.
- Collect the minimum details for an inquiry and save them to the correct organization.
- Offer actual availability, confirm only after successful booking, and handle changes with appropriate identity checks.
- Let a customer request a person and preserve conversation context during handoff.
- Display truthful after-hours availability and escalation behavior.

These are implementation requirements, not claims of a working Apple channel. No approval video can truthfully be supplied until a real test conversation and handoff work. No MSP has been selected or purchased. Provider pricing and sandbox access need to be established without a paid commitment.

Apple Pay is separate again: merchant/processor authorization and payment reconciliation are required. A hosted checkout link is not native Apple Pay inside Messages.

## Official references checked today

- https://developer.apple.com/help/account/capabilities/create-wallet-identifiers-and-certificates/
- https://register.apple.com/resources/messages/messaging-documentation/
- https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes

No submission is recorded as complete in this document.

## Explicit approval needed before certificate issuance

Automatic review rejected storing the encrypted matching CSR private key and its password in the Render staging service environment because the owner had not explicitly authorized those specific secrets going to that destination. Nothing was transferred. Do not retry through another tool or storage path to bypass the rejection. Ask for explicit approval to store both on the owner's `nova-staging-demo` Render service and to request the Pass Type certificate. The encrypted local key/password remain mode 0600 outside git. The CSR form is left unsubmitted.

## Current checkpoint after explicit owner authorization

The owner explicitly approved storing the signing keys in Render. The environment-variable merge completed successfully on nova-staging-demo without replacing unrelated settings. This resolves the earlier automatic-review rejection for that transfer; it was retried only after specific new authorization. Certificate issuance remains paused at the owner's request to review Gemini feedback and improve audit sellability first. No CSR upload, certificate issuance or Wallet activation is claimed. No money was spent.
