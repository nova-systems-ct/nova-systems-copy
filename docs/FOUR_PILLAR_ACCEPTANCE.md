# Four-pillar pilot — release evidence

November 27, 2026 • recovery branch • $0 spent • synthetic data only

## Live demo available now

On November 27 the production [detailing business site](https://nova-systems.app/b/nova-demo) and [website chat](https://nova-systems.app/chat?b=nova-demo) both returned HTTP 200. A read-only check of the production demo organization found five active, owner-approved services, one scheduled demo request and zero provider-confirmed receipts. The concurrent handoff documents a browser test of quoting, booking and cancellation on the previous release. The new audit, agreements, reminders and ledger below have separate acceptance evidence.

## What ran

| Check | Observed result | Boundary of the check |
|---|---|---|
| Audit import and retest | Two complete, seven-day CSV fixtures on one staging audit. Baseline 4 of 10 answered, retest 8 of 10, change +40 percentage points. | Measures and authorization reference persisted. The numbers are fixtures, not a client performance claim. |
| Web journey rules | Staging records contain one accepted $199 quote, one signed agreement identical to the displayed quote, one reservation, and one work-completion document. | Real workflow functions ran locally. Each phase loaded staging data and the operator connector committed and re-read its changes. This did not exercise hosted customer authentication or external messages. |
| Ledger and results | Synthetic manual entries of $50, $99 and $50. The check read $50 remaining after the middle entry and zero on completion. The card-provider total was $0. | No charge, invoice delivery or bank transfer took place. The QA service was disabled afterward. |
| Atomic payment posting | Separate staging fixture, $100 starting balance. Concurrent requests for $40, the same $40 again, and a different $30 produced two receipts/events totaling $70. The duplicate returned `repeated=true`. Altered reference, overpayment and wrong organization returned `reference_conflict`, `excess_payment` and `not_found`. | The function runs in one database transaction. Anonymous and signed-in browser roles had no execute grant; the server role had the grant. This was a test of the database function, without a card provider. |
| Customer agreement and inbox | Rules tests show edited wording produces a new quote, stale versions cannot sign, short messages bind the typed name to a quote version and long agreements use a private request page. | Local customer/web and messaging tests, no carrier connection. |
| Invoice reminders | Two competing attempts sent one reminder to a test adapter showing only the remaining $49 on the test invoice. Consent withdrawal, pause, payment, cross-tenant access and repeated approval all stopped the relevant action. | Simulated mail provider; real inbox delivery remains a separate gate. |
| Recovery attribution | The scorecard links a return to a provider-accepted outreach, the tracked link and the same recipient in the same business. Receipts from linked jobs are labeled by source. | Historical untagged returns are excluded. No actual recovered customer or revenue claimed. |
| Sales and feedback | A permitted inbound sales thread can get a saved, zero-cost qualification draft when the paid model is off. An opt-out suppresses it; a request for a person is routed to review. Rated jobs have an owner reply draft in Results. | Drafting and routing only. No prospect contacted, public reply posted, client acquired or revenue earned. |

**Recheck the staging records.** Use staging project `ubjnddxmdaxnbpzcmxnc`. The walkthrough organization is `2e4a4729-4ba6-4c77-a805-cc09d240b477`. The audit case is `93d542cd-fac0-472f-89e8-47a7566a71ae`. The separate payment-concurrency fixture is in `be50e670-a19c-451e-aa93-fa95ba7d3357`. Leave both out of business performance reports. They contain synthetic QA data.

**Local verification.** Lint, the Vite production build and all 50 local suites passed on the integrated branch, including the owner’s open-times controls and the newer website-chat booking and cancellation changes.

**Database upgrade.** The staging migration history and prerequisite tables and columns were checked before applying `journey-payment-ledger-migration-standalone.sql`. The routine holds the journey row lock while it records the event, receipt and balance. It will send an older, incomplete payment to reconciliation. Apply the staging-verified migration together with this release at an approved production rollout. The app’s hosted payment path requires it.

## What a real pilot still needs

1. The recovery preview needs its own staging `SUPABASE_SERVICE_ROLE_KEY` binding. Both public and server database URL bindings for that branch point to staging. The other staging branch has a separately scoped sensitive credential. Add the correct server credential under **Preview → claude/launch-recovery-20261114**, redeploy and test a legitimate owner session. Do not put the server key into a browser-prefixed variable.
2. As that owner, publish one approved service and an opening. From another browser, submit a fresh request at `/start?org=814ee0f5-542b-4d0e-8276-6f034e7591bb`, review the agreement, follow the deposit policy, reserve the opening and inspect the owner’s desk.
3. Confirm recipient-side delivery for every channel being offered. Verify an authorized provider sandbox transaction, signed event and receipt before offering online payment. Production changes and any operation that costs money need Isaac’s decision.
4. Offer only the installation that passed. A prospect can be qualified and a draft proposal prepared while the owner makes the remaining decisions.

[Build order, audit method, 29-system inventory, and sales and operations playbooks](NOVA_FOUR_PILLARS.md)
