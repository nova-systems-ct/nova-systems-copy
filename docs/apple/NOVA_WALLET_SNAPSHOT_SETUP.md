# Wallet snapshot setup — 2 November 2026

## Implemented boundary

`api/_ops/wallet.js` builds real Apple .pkpass packages and Google Wallet RS256 save JWTs from an existing approved program and its existing points balance. The authenticated Rewards endpoint requires ops.configure and same-organization membership. Neither endpoint adds points, redeems rewards, sends customer messages, registers a device or charges a provider. Issuance records a hash and timestamp; it never logs signing material or the save JWT.

Both platforms are disabled by default. Configuration belongs in server-side secrets only. Do not put credentials in browser variables, git, screenshots or audit evidence. Do not enable a program or fabricate reward rules to make a pass appear working.

## Shared issuer configuration

- NOVA_WALLET_ORGANIZATION_ID: the exact business organization that owns the issuer.
- NOVA_WALLET_ISSUER_NAME: that business's approved display name.
- APPLE_WALLET_ENABLED / GOOGLE_WALLET_ENABLED: explicit true only after configuration and acceptance.

This implementation binds one issuer configuration to one business. Client businesses need their own issuer configuration/authorization; Nova's certificate must not silently become a shared client issuer.

## Apple

Existing registered identifier: pass.app.nova-systems.rewards; existing team DWCWDDW2DT. The public CSR is Nova-Wallet.certSigningRequest. Its matching encrypted private key and passphrase were saved with explicit owner authorization in Render. No Apple-issued signing certificate has been obtained yet.

Required server variables:
- APPLE_PASS_TYPE_ID
- APPLE_TEAM_ID
- APPLE_PASS_SIGNER_CERT_PEM (the certificate Apple issues for the matching CSR)
- APPLE_CSR_PRIVATE_KEY_PEM
- APPLE_CSR_PRIVATE_KEY_PASSWORD (for the existing encrypted key)
- APPLE_WWDR_CERT_PEM (the corresponding authentic Apple intermediate)

The builder checks matching private/public keys, UID/pass type, OU/team, validity dates and signing certificate verification against the configured intermediate. This is not an independent Apple-root trust verification; obtain the intermediate directly from Apple. Local tests verify the ZIP manifest and detached CMS signature using disposable fixture certificates. Those test certificates are not trusted by Apple and are never deployed.

Owner/provider steps: securely sign in to the existing Apple team, request the free Pass Type certificate using the existing CSR, save only the issued certificate and authentic intermediate to the existing authorized server store, and physically test Add to Wallet on an iPhone. No membership purchase or renewal is authorized. Check the visible business name, balance, reward, terms and QR against the real ledger before enabling customer issuance.

## Google / Android

Required server variables:
- GOOGLE_WALLET_ISSUER_ID
- GOOGLE_WALLET_CLASS_ID (an already created loyalty class under that issuer)
- GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL
- GOOGLE_WALLET_PRIVATE_KEY_PEM

The service account must actually be authorized on the issuer. The class and issuer must be approved/configured through Google, and test users must satisfy Google's current test-mode requirements. Creating the JWT does not create or approve the issuer or class. No account/key or Google API call was created during this work. Physically test saving the pass on Android before enabling issuance.

## Explicit snapshot limitation

Apple has no device registration/update service or APNs integration yet. Google REST object balance updates are also not implemented. These are signed point-in-time snapshots with the time and limitation shown on the card. Reusing a Google object ID does not guarantee its existing balance will update. Redemption must always use Nova's current ledger; a card image or stale balance cannot authorize a reward. Device saves are not reported as confirmed.

Apple Pay / Google Pay, Apple Messages for Business, SMS and RCS are separate integrations and are not activated by these Wallet files.
