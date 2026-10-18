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

## Full-suite runs (clean export, Node 22) — what actually ran
All of these run against **local disposable PostgreSQL + PostgREST** with stand-ins for Auth, Storage, email, Twilio and
Stripe; the two local-staging suites run against **local Supabase in Docker**. None of this is a real-provider test.
Log folder (scratchpad of this Claude session): `C:\Users\NVUBCR~1\AppData\Local\Temp\claude\C--Users-NVUBCrosbyUBMS07\0b6faf8f-e3e8-4db7-8a2f-959b933b9147\scratchpad\`
— each run has `chain.log` (when started, which commit), `commit.txt`, `steps.log`, `aggregate_1.log`, `aggregate_2.log`
and `fail_logs_N\` (every failed suite's full output, with free memory and PostgREST timings).

| Run | Commit | Result |
|---|---|---|
| 9, pass 1 (2026-10-17 18:53–19:09), `final9\` | `341746b` | 36/37 suites, 1564 checks, no start-up timeout, no suspend. Failure: `e2e_ops_browser_test` — a confirmation wiped by a list refresh; real UI bug, fixed in `f64059d` |
| 9, pass 2 (19:09–19:25), `final9\` | `341746b` | 34/37 suites, 1514 checks. Failures: `e2e_ops_browser_test` (same bug); `e2e_ops_harvest_test` — a campaign stayed "running" when its last recipient was stopped; real bug, fixed in `502da6e`; `e2e_sales_browser_test` — **PostgREST exited with code 3, 63 ms after start**, the first direct evidence of what the old "120 s timeouts" were; start-up exits are now retried with the evidence printed (`502da6e`) |
| 10, `final10\` | `93908c5` | **stopped by Claude** soon after it began: that commit predates both fixes, so it could not be the final verification |
| **11 — final verification**, `final11\` | **`ce5bafa`** (= `502da6e` + docs only) | Started 2026-10-18 12:21 on AC power; npm ci, build, lint, `verify_local_all` all exit 0. **Pass 1 (12:23–12:37): 38/38 suites, 1617 checks, 0 fail, 0 timeout, 0 suspend. Pass 2 (12:37–12:51): 38/38, 1617 checks, 0 fail, 0 timeout, 0 suspend.** Limit: the runner keeps full output only for failing suites, so these logs cannot show whether a passing suite needed a PostgREST start-up retry. |

**Development milestone closed on `ce5bafa` (2026-10-18).** Next phase: activation and real-world testing —
`docs/NOVA_ACTIVATION_CHECKLIST.md`. Everything above is *local-tested*; nothing is *live-verified* with a real provider.

Checks run individually on the fixed code (local disposable database): revive 25/25 (its new completion check fails
without the fix), harvest 20/20, ops browser 32/32 (fails without the refresh fix), loyalty 22/22, audit clock 22/22,
hierarchy handoffs 21/21, audit engine 30/30, audit delivery 40/40, core journey 69/69, Connect deposits 17/17, Sentry
36/36, clean install 17/17, academy 84/84, hierarchy work items 69/69, meetings 25/25, durable worker 15/15, governance
45/45. Local Supabase in Docker: staging suite 31/31; owner walkthrough 24/24 (Demand, Revive, Rewards and My work
through the menus). The loyalty suite has not yet been through a full clean-export run (run 11 includes it).

## Not verified with any real external provider
Twilio voice and SMS, external email delivery, Stripe test payments (Connect built; no keys locally), Cal.com,
Apple Messages for Business / Apple Pay / Wallet (setup path: `docs/APPLE_MESSAGES_PAY_WALLET_SETUP.md`), social
channels, hosted worker.

## Next implementation task
Wallet pass signing and pass web service once the Pass Type ID certificate exists; until then: social channel adapter
behind an approved provider account, and deployment to a staging database once one exists.
