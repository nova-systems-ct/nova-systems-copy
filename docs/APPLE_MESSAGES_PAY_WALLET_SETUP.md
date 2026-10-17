# Apple Messages for Business, Apple Pay and Apple Wallet — setup path (2026-10-17)

Master prompt §10. Nothing Apple-branded is live or advertised. No Apple account, MSP, merchant ID or pass certificate
is connected. This file says what is built, what Apple requires (with sources), and the exact owner steps.

## What exists in Nova today
| Piece | State | Evidence |
|---|---|---|
| Conversation state machine an MSP adapter would plug into (qualify → price → times → hold → agreement → deposit) | locally verified on SMS and web form | `e2e_ops_core_journey_test` 69/69, `e2e_ops_revive_test` 24/24 |
| Loyalty program + append-only points ledger (what a Wallet pass displays) | locally verified | `e2e_ops_loyalty_test` 22/22; Operations → Rewards |
| Wallet pass serial + auth-token slot per customer account | schema ready; **no pass signed or issued** | `loyalty_accounts.pass_serial`, `pass_auth_token_hash` |
| Wallet pass signing / pass web service / APNs updates | **not built** — needs the Pass Type ID certificate first | `walletReadiness()` reports the missing credentials |
| Apple Messages for Business adapter | **not built** — needs a chosen MSP and its API | — |
| Native in-message Apple Pay | **not built** — needs a Merchant ID and a processor the MSP supports | — |

Important distinction: a Stripe Checkout link opened from a message is **web checkout** (Apple Pay may appear in Safari
there). That is not native Apple Pay inside Messages, and Nova must not describe it as such.

## What Apple requires (verified 2026-10-17; re-check at signup)
- **Account:** a Messages for Business account created in **Apple Business Register**, and messaging goes through an
  Apple-approved **Messaging Service Provider (MSP)**; the provider dropdown in Apple Business Register is the
  authoritative list. Apple does not charge for the channel; the MSP does. Apple is not onboarding businesses that
  primarily offer medical/health services (Nova's pilots are not healthcare).
  Sources: [Apple MSP documentation](https://register.apple.com/resources/messages/messaging-documentation),
  [Bird: which providers support it](https://bird.com/explained/apple-messages/which-providers-support-apple-messages-for-business),
  [Kanal: how it works in 2026](https://getkanal.com/blog/apple-messages-for-business).
- **Apple Pay in Messages:** an **Apple Pay Merchant ID** entered in the Messages for Business account (one per
  account); the payment gateway obtains a fresh merchant session for every payment request; the order system must
  confirm payment independently of the message ("approval to use the message type does not prove the processor is
  integrated"). Sources: [Apple: Integrating Apple Pay](https://register.apple.com/resources/messages/msp-api-tutorial/applepay),
  [Bird: what Apple Pay in Messages needs](https://bird.com/explained/apple-messages/what-does-apple-pay-in-messages-need-from-a-provider).
- **Wallet passes:** a **paid Apple Developer account**, a **Pass Type ID** and its **certificate** (plus Apple's WWDR
  certificate) to sign passes; a pass carries `webServiceURL` and `authenticationToken`; updates = re-sign with the
  same serial and pass type, push an empty APNs notification, Wallet fetches the new pass; an expired certificate stops
  saving and updates. Sources: [Apple: Wallet Passes](https://developer.apple.com/documentation/walletpasses),
  [Apple: Pass Type ID API](https://developer.apple.com/documentation/appstoreconnectapi/pass-type-id),
  [Passcreator: certificates](https://service.passcreator.com/portal/en/kb/articles/certificates).

## How to choose the MSP (criteria, in order)
1. A documented **inbound webhook + outbound API** so Nova's existing state machine stays the single brain (no second bot).
2. **Native Apple Pay** support, and which payment processors it supports — must allow the **client's own** Stripe
   connected account (§9: client proceeds go to the client).
3. **Live-agent handoff** inside the same conversation, with context.
4. List-picker / time-picker message types for choosing services and appointment times.
5. Test/sandbox access before a paid commitment; pricing and minimum term in writing.
Candidates named in 2026 sources (secondhand; confirm in the Register dropdown): Zendesk, Salesforce, Freshworks,
Genesys, LivePerson, Infobip, Sprinklr, Microsoft Dynamics, AWS, LiveChat, Khoros, NICE, Webex.

## Owner steps (each is a dependency; nothing here can be done from this machine)
1. **Apple Developer Program** enrollment for Nova Systems LLC (paid annual fee — **needs your approval**; D-U-N-S number
   required for an organization). Unlocks Pass Type ID + certificate and the Merchant ID.
2. Create a **Pass Type ID** (e.g. `pass.app.nova-systems.rewards`) and its certificate; put the certificate and
   password in the hosting provider's secret store as `APPLE_PASS_CERT_P12_BASE64`, `APPLE_PASS_CERT_PASSWORD`,
   `APPLE_WWDR_CERT_BASE64`, `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID` — never in chat or the repo.
3. **Apple Business Register:** create the Messages for Business account (brand assets, support hours, escalation).
4. Pick the MSP using the criteria above; request sandbox access; tell Nova engineering which one (no payment until you
   approve its pricing).
5. Create an **Apple Pay Merchant ID** and confirm with the MSP which processor routes to a client's Stripe account.
6. Approve each pilot business's **reward rules** (Operations → Rewards); Nova does not invent reward economics.

## Next engineering steps once the dependencies exist
Pass signing (PKCS#7 detached signature over the manifest) + the pass web service endpoints + APNs push; the MSP adapter
on top of `handleInboundTurn`; native Apple Pay through the MSP with payment confirmation from the processor's own event.
Each must be tested on a real device before any public mention.
