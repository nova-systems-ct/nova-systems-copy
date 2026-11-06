# Installation and recovery repair — 6 November 2026

Scope: Nova only. No purchases, paid inference, real charges or customer sends.
The two running audit cases and their clocks are outside this repair.

## What changed

1. Installation acceptance now includes the actual approved prices, service
   versions, agreement text, hours, calendar rules, escalation settings, payment
   destination and selected module configuration. Changing a price while keeping
   the same number of services requires a new tested plan.
2. Rerunning an installation rechecks completed prerequisites. Activation repeats
   the checks, including a clearly labelled TEST inquiry that is then cancelled.
   A stopped worker or stale configuration prevents activation.
3. Demand readiness reads this business's actual approved acquisition campaign.
   It does not start outreach or confuse recovery with new customer acquisition.
4. Payment readiness is consistent between the readiness API and installer.
   Existing checkout is TEST-only. A connected account ID is not live acceptance.
   A real business requiring deposits cannot activate based on a test-only setup.
5. Settings can verify an existing business-owned Stripe account through the
   existing API. This opens no account and enables no live payment. Missing
   credentials remain a visible blocker.
6. Hosted Core execution now includes approved recovery-campaign jobs. Quiet
   hours create one future successor; the completed original does not also retry
   every five seconds. Paused campaigns retain their work without consuming
   failure attempts. The staging scheduler's allowlist includes that handler.
7. Recovery jobs belong to Follow-up and Revive, including its pause control and
   playbook. They previously belonged to Demand, which meant suspending Revive
   did not hold them. Demand's status now states that its acquisition sender is
   not implemented instead of claiming recovery sends are acquisition.
8. Install Systems puts the required next actions first, collapses passed groups,
   blocks the stale-plan Activate button, and fits desktop, iPad and phone widths.
   Loading failures have retry controls instead of an empty-looking setup.

## Evidence

Before repair, the new configuration test failed on an unchanged service count
with a changed price. The actual API/database safety test reproduced eight
failures. The hosted-worker test failed for a missing campaign handler, and the
worker pause regression failed before correcting capability ownership.

Local checks on the repaired source:

| Check | Result | Boundary |
|---|---|---|
| Local logic/schema suites | 57 passed; none skipped | Bundled Chromium enabled; not hosted/provider acceptance |
| Configuration/payment readiness | 17 assertions passed | Read-only fixtures; no network service |
| Installer safety | 16 passed, 0 failed | Actual API + disposable PostgreSQL |
| Customer journey | 69 passed, 0 failed | Actual handlers + worker; local SMS/Stripe stand-ins |
| Revive, continuous worker | 25 passed, 0 failed | Local provider stand-in |
| Revive, signed hosted receiver | 25 passed, 0 failed | Actual receiver + PostgreSQL; local provider stand-in |
| Hosted campaign controls | Passed | Quiet-hour successor, pause, worker suspension, spending lock; no provider sends |
| Connected deposits | 17 passed, 0 failed | Local Stripe stand-in; account-event isolation and live-key refusal |
| Workforce installation | Passed | Idempotent 13-worker setup, reporting lines, playbooks and pause preservation |
| Security personas | 90 passed, 0 failed | Actual API and disposable DB; anonymous, sales, staff, owner and other organization |
| Installer/payment UI | Passed | Actual app/API/database; desktop 1366, iPad 820, phone 390 pixels |
| Lint, production build, whitespace | Passed | Source verification |

Browser evidence: `docs/qa/install-safety-2026-11-06/`.
The release does not claim physical iPhone acceptance, live payments, live SMS,
connected social accounts, useful audit findings or measured recovered revenue.

## Hosted observations before release

- Existing Render staging remains on the free plan, with automatic deployment
  off. No new service or plan upgrade is needed for this repair.
- Existing Core scheduler completed 60 of 60 recorded ticks in the preceding
  hour. No recovery jobs were due when inspected.
- Nova's hosted business had no time zone, hours, escalation contacts, approved
  services or approved agreement. A repaired installer must report those gaps;
  it cannot invent an offer, owner availability or legal approval.
- Security advisor output contains existing INFO notices for server-only tables
  with RLS and no client policies, plus warnings about the public `btree_gist`
  extension, three callable authorization functions and leaked-password
  protection. These were not silently disabled or presented as a security pass.
  Callable membership/permission helpers require their existing authorization
  semantics; blanket revocation would break the application.

## What remains before customer operation

- Owner-approved business hours, actual services/prices and booking terms.
- A verified runtime for each installed capability. The bounded Core receiver
  does not prove that every legacy continuous-worker maintenance job runs.
- Real provider credentials, account permissions, registrations and an authorized
  end-to-end acceptance test for each live sending or payment channel.
- An implemented acquisition sender; current Demand supports approval, prospect
  tracking, manual contact records and attribution, not autonomous cold outreach.
- Connected social/Apple/Android accounts and their separate provider/device
  acceptance. Adapter code or an application draft is not a live connection.
- Actual customer outcomes before claiming money recovered, ROI or guaranteed
  customers. Unknown impact stays unknown.

Deployment and hosted acceptance are recorded below only after observation.
