# Nova — authoritative checkpoint (2026-10-17, end of day)

One current record. Earlier notes live in git history (`git log -p -- docs/NOVA_OPERATIONAL_MVP_CHECKPOINT.md`).
Product authority: the owner's master execution prompt of 2026-10-17 (Triangle of Nova: Audit, Agents, Demand; Revive,
Sentry and Scale underneath). Owner to-do list: `docs/NOVA_OPERATIONAL_MVP_OWNER_ACTIONS.md` (top section).

## Source and environments
| Item | State |
|---|---|
| Repository / branch | `nova-mvp-work`, branch `mvp/operational`, remote github.com/nova-systems-ct/nova-systems-copy — **public** |
| Pushed to GitHub | no — the owner pushes; 23+ local commits ahead at end of day (`git status -sb`) |
| Production (nova-systems.app) | `main@bd53133` (2026-09-27): old site; none of this work is deployed |
| Vercel Preview (mvp/operational) | builds; no database variables → API cannot reach a database |
| Hosted staging | blocked (overdue Supabase invoice) |
| **Local staging** | real Supabase in Docker, app http://localhost:5180 — `docs/LOCAL_STAGING.md`; 38 migrations applied |
| Runtime | **Node 22 LTS**: Node 24.15 on Windows aborts (libuv assertion, 0xC0000409) under network load |
| nova-wave-one crons | disabled since 2026-10-16 02:25 UTC |

## Gates (master prompt §3)
| Gate | Status | Evidence |
|---|---|---|
| A — internal foundation | **locally verified**: auth, roles, recovery, isolation; owner home leads with the product; hierarchy handoffs: an ordinary staff member sees and works their own tasks (My work), acknowledgment deadlines, result handed to a named person, unacknowledged/overdue work escalated to the manager (owner if none) by the worker every 5 min | `e2e_hierarchy_handoffs_test` 21/21; `e2e_local_staging_test` 31/31 |
| B — full audit on Nova | public evidence + hosting configuration: 7 evidenced findings, draft report awaiting approval. Delivery clock: versioned owner-approved policy, input checklist gate, blockers that do not move the deadline, client-agreed extensions | `docs/evidence/nova-live-audit-2026-10-17.json`; `e2e_audit_clock_test` 22/22 |
| C — install and operate on Nova | **partial, locally verified**: Install Systems 8/14 components; /book form → time → signature → confirmed booking; Revive finds stalled requests in Nova's own records and a reply continues the same request | owner walkthrough 24/24; `e2e_ops_revive_test` 24/24 |
| D — Demand + staff readiness | Demand workflow built; first campaign prepared as a **draft** (20 sourced prospects, code WUETJW), not approved, nobody contacted. Academy states what is not live (voice, deposits, Apple channels) | `e2e_ops_demand_test` 19/19; `e2e_sales_academy_test` 84/84 |
| E — verified operation | clean-export full runs under Node 22: see below | — |
| F — public presentation | triangle homepage, /book, /demo, owner home rebuilt **locally**; desktop dashboard no longer covered by the mobile bar; not deployed | — |

## Full-suite runs (clean export, Node 22)
- Run 9 pass 1 on `341746b`: 36/37 suites, 1564 checks, 16 min, no PostgREST start-up timeout, no suspend. The one failure
  (`e2e_ops_browser_test`: a confirmation wiped by the list refresh) was a real UI bug, fixed in `f64059d` and now
  checked explicitly (fails without the fix, passes with it).
- **Final verification queued 2026-10-17 19:20** (not yet a result): a detached process waits for run 9 pass 2 (old
  commit `341746b`) to finish, then exports the then-current HEAD (expected `6f0fca9` or this docs commit) and runs
  `npm ci`, build, lint, `verify_local_all`, and the full aggregate twice under Node 22. The run waits for AC power
  before starting and is paused if the computer sleeps. Logs (scratchpad of this Claude session):
  `…\scratchpad\final10\` — `chain.log` (start/end and commit), `commit.txt`, `steps.log`, `aggregate_1.log`,
  `aggregate_2.log`, `fail_logs_N\` (each failed suite's full output, with free memory and PostgREST timings).
  Full path: `C:\Users\NVUBCR~1\AppData\Local\Temp\claude\C--Users-NVUBCrosbyUBMS07\0b6faf8f-e3e8-4db7-8a2f-959b933b9147\scratchpad\final10\`.
  Run 9 logs: same folder, `final9\`.
- All suites run against **local disposable PostgreSQL + PostgREST** (or local Supabase in Docker for the staging
  suites) with stand-ins for Auth/Storage/email/Twilio/Stripe. They are not real-provider tests.
- Earlier intermittent PostgREST start-up timeouts: memory pressure ruled out (3.4–5.3 GB free at failure). PostgREST now
  logs its connection and schema-cache phases with timings, and a dead process fails immediately.

## Not verified with any real external provider
Twilio voice and SMS, external email delivery, Stripe test payments (Connect built; no keys locally), Cal.com,
Apple Messages for Business / Apple Pay / Wallet (setup path: `docs/APPLE_MESSAGES_PAY_WALLET_SETUP.md`), social
channels, hosted worker.

## Next implementation task
Wallet pass signing and pass web service once the Pass Type ID certificate exists; until then: social channel adapter
behind an approved provider account, and deployment to a staging database once one exists.
