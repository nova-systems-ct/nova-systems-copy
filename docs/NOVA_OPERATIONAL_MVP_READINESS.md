# Nova Operational MVP — capability readiness (2026-10-11)

Levels: **Built** → **Locally tested** (real local database, real handlers/worker/browser, provider stand-ins) →
**Staging verified** (real providers, test resources) → **Production verified**. Nothing is beyond "Locally tested".

| Capability | Built | Locally tested | Staging verified | Production verified | Sellable now? |
|---|---|---|---|---|---|
| Nova Audit (evidence, tests with permission, scenarios, report, PDF, client link) | yes | yes | no | no (audit tables not in production) | As a Nova-delivered service once migrations are applied |
| Login, recovery, roles, tenant isolation | yes | yes | no | no (current production is the Sept 27 build) | — |
| Text inquiry → qualification → approved price → booking | yes | yes | no | no | No — needs Twilio number, registration, staging pass |
| Web form inquiry → same journey | yes | yes | no | no | No |
| Agreement e-signature | yes | yes | no | no | No — attorney review of template |
| Deposits (Stripe-hosted) | yes (test mode) | yes | no | no | No — funds-recipient arrangement not built/decided |
| Fulfillment queue and completion | yes | yes | no | no | With the journey above |
| AI voice receptionist | yes | yes | no | no | **No** — do not sell until staging verified |
| Call forwarding to a person | yes (existing) | yes | no | no | With Twilio setup |
| Missed-call text-back (consent-based) | yes | yes | no | no | No — registration |
| Past-customer reactivation | yes | yes | no | no | No — registration + owner-approved lists |
| Review/referral invitations | yes | yes | no | no | No |
| Monitoring + incidents + alerts | yes | yes | no | no | Requires the worker to be hosted |
| Weekly scoreboard | yes | yes | no | no | Requires the worker |
| Owner/client/staff screens | yes | yes (browser, desktop + phone) | no | no | — |

## Answers
- **Can Isaac demonstrate it?** Yes, locally: run `node scripts/e2e_ops_browser_test.mjs` (or the dev harness) to show the real screens with a Nova TEST business, including a phone-sized customer signing page and the weekly report. Not on nova-systems.app today (site disabled, code not deployed).
- **Can Nova install it for an authorized pilot?** Not yet. Minimum path: owner actions 1–3, 6–11 and a passed staging run (installation section 9). Then a pilot limited to text/form inquiries, booking, agreement and (if a deposit arrangement is approved) deposits, with the voice assistant off.
- **Can salespeople sell it?** Only the **Nova Audit** as a service delivered by Nova, after the audit migrations are applied and salesperson arrangements are resolved. Core/Harvest/Sentry may be offered only as a clearly labeled limited pilot after staging verification. The AI voice receptionist must not be sold yet.
