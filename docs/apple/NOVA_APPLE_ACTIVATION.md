# Nova Apple activation — 1 November 2026

## Verified state

No Apple account is signed in in the shared browser. No Apple registration, certificate request, purchase or agreement was submitted. Developer membership was reported by Isaac; its team and expiry have not been verified.

Nova's rewards ledger exists, but `api/_ops/loyalty.js:walletReadiness` deliberately refuses issuance. Pass signing, authenticated pass updates and device acceptance are not implemented. Android Wallet issuance is also not implemented. Website access on an iPhone/Android is separate from Wallet integration.

## Prepared material

`Nova-Wallet.certSigningRequest` is a real RSA-2048 certificate signing request, checked with `openssl req -verify`. It is public material and contains no private key. The encrypted matching private key is outside the repository in this working session's private scratch area. **Do not upload this CSR until the encrypted key and its password have been secured in the owner's approved secret storage.** If that private material is lost, generate a new key/CSR before requesting a certificate. A CSR is not an Apple-issued certificate.

Proposed identifier, not registered: `pass.app.nova-systems.rewards`.
Contact supplied by owner: Isaac Nova, isaac@nova-systems.app, (203) 706-0504, https://nova-systems.app . Business: Nova Systems, Waterbury, CT. Legal entity/address, Apple Team ID, enrollment state, support coverage and reward rules need verification in the actual account; do not fabricate them.

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
