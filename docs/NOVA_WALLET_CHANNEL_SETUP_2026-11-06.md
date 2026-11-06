# Wallet and channel setup — 6 November 2026

Owner instruction: leave the two running audits untouched. Complete free Wallet,
payments and messaging preparation; no purchases, real charges or customer sends.

## Implemented

- Authorized Operations configurators can generate an Apple **generic setup test**
  using the configured issuer's existing signing certificate and private key.
- The test uses a distinct `nova_setup_test_` serial namespace and explicitly says
  not redeemable, with no cash/reward value. It creates no program, customer,
  loyalty balance or redemption; it sends nothing to a provider or customer.
- Rewards offers preparation and download without inventing loyalty economics.
  Results are scoped to the selected organization, including delayed responses.
- Existing approved rewards snapshot issuance retains its separate approval and
  ledger checks. Test generation does not activate automatic Wallet updates.

## Verification

- New package and HTTP tests failed before implementation, then passed.
- 56/56 local suites passed with `NOVA_CHROMIUM_PROVIDER=bundled`; an earlier run
  without that variable skipped the renderer and was not complete.
- Lint and build passed.
- Actual frontend/API/disposable PostgreSQL browser test generated/downloaded the
  signed generic artifact, verified zero programs/accounts/ledger entries, and
  checked desktop/iPad/phone layouts. Its signer is a synthetic local certificate;
  this does **not** establish Apple or physical-device acceptance.

## Hosted account observations before release

- Existing Render free staging is on `codex/render-demo`; automatic deployment off.
- Nova owner signed in successfully. Existing Apple signing readiness passes.
- Hosted rewards programs/accounts and social connections: zero, checked at
  17:08 UTC. Google Wallet server configuration is missing.
- Apple Messages for Business opens its sign-in page; no application submitted.
- Google sign-in reported "Couldn't find this account" after the secure account
  identifier step. No password was exposed or entered through model-visible tools.

## Separate acceptance still required

- Save the generated pass on a physical iPhone; iPad download is not Wallet save.
- Owner-approved real rewards rules and physical redemption for a real program.
- Google issuer/class/signing setup and an authorized test device/account.
- Apple Pay / Google Pay checkout in Stripe TEST mode; no real purchase is allowed.
- Provider account access and permissions before social or Apple/RCS messaging.
- A genuinely free runtime/account before enabling any hosted LLM reasoning.

Prepared documents, adapters, signing readiness and local tests must not be
reported as submitted applications, connected providers or real delivery.

## Hosted acceptance receipt

- Source commit `6d79e8de5851ed5948746cd89317921814226214` was published through
  the connected GitHub service after terminal push lacked authentication.
- Existing free Render deploy `dep-dbn0o6ui0phs73d1piq0` became live at
  17:20:40 UTC (12:20 PM New York). No plan or billing configuration changed.
- Signed-in owner generated and downloaded the setup pass through the actual
  Rewards UI. The 169,684-byte package has the expected generic type, a setup-test
  serial, Pass Type ID `pass.app.nova-systems.rewards` and team `DWCWDDW2DT`.
  Every manifest hash and its detached CMS signature were independently verified.
  This is actual configured signing, not the synthetic local test signer.
- A subsequent hosted read confirms zero rewards programs, accounts, ledger
  entries and social connections. Generation does not create fictitious customers.
- Real PostgreSQL channel acceptance passes on this source: signed receipts,
  replay protection, scoped identity, existing booking logic, zero-spend replies,
  STOP/START and tenant denial. Provider calls are controlled local stand-ins.
- Apple account credentials advanced to two-factor verification, but Apple rejected
  the supplied verification code. Registration remains unsubmitted.
- Integration Center reports Stripe, Twilio, Resend and Anthropic disconnected.
  Their connection flags are not evidence that provider credentials were revoked.
  No live checkout, phone call or external message was attempted.
- Both audits were left untouched: no audit record, clock or job was changed by
  this release. No existing provider key or spending switch was modified.

Owner test: Operations → Rewards → Prepare Apple Wallet test pass → Download
Apple Wallet test pass. Open on an iPhone and verify Wallet accepts it; an iPad
download alone is not device acceptance. The pass is explicitly not redeemable.

Receipt screenshot (private account details excluded):
`docs/qa/live-wallet-2026-11-06/rewards.png`.
