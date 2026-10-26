# Nova — authoritative checkpoint (updated 2026-10-25)

One current record. Earlier notes live in git history (`git log -p -- docs/NOVA_OPERATIONAL_MVP_CHECKPOINT.md`).
Product authority: the owner's master execution prompt of 2026-10-17, refined by the "inside out" brief of 2026-10-25.
Owner to-do list: `docs/NOVA_OPERATIONAL_MVP_OWNER_ACTIONS.md` (top section). Keys and costs:
`docs/NOVA_INTEGRATION_INVENTORY.md`. Activation steps: `docs/NOVA_ACTIVATION_CHECKLIST.md`.

## Status observed 2026-10-25 (from the running system, not from earlier reports)
- Branch `mvp/operational`; work committed through this checkpoint; ~31 commits not on GitHub. No `AGENTS.md` exists
  (project instructions are in `CLAUDE.md`).
- **Final verification run 11 finished** on `ce5bafa`: both passes 38/38 suites, 1617 checks, 0 failures/timeouts/suspends.
  Its runner keeps output only for failing suites, so start-up retries in passing suites cannot be ruled out. Every
  regression check run 2026-10-25 recorded **0 PostgREST retries**.
- **Local Supabase (Docker) is running** (up 6 days; `supabase_vector`, a log shipper, restart-loops — no effect found).
  All **38/38 migrations applied, none changed since applied**. Owner and representative **sign in** (HTTP 200) and reach
  the API. Local worker running, heartbeat current; the queue ran only ~6 h of sweeps in 6 days because the laptop slept.
- **Production nova-systems.app is the old build** (none of the current routes/wording in its bundle; Last-Modified
  2026-10-16). nova-systems.agency still serves "Nova Wave One". Nothing from this branch is deployed.
- **Hosted testing is blocked by:** no hosted staging database (Supabase invoice / plan — owner), Preview environment has
  no variables, Vercel CLI on this computer is logged out (`vercel login`), email domain not fully verified in Resend
  (DKIM published; `send.nova-systems.app` MX + SPF missing).

## Readiness (2026-10-25)
Environments: **disposable** = throwaway PostgreSQL + PostgREST with stand-ins; **local Supabase** = real Supabase in
Docker on this laptop; **sandbox/live** = real provider. No capability is verified on a real provider yet.

| Capability | Implemented | Configuration missing | Last verified environment | Current failure / gap | Next action |
|---|---|---|---|---|---|
| Audit (case, scope, intake, clock, evidence, findings, scenarios, report, PDF, secure link) | yes | live email for the client link | local Supabase 2026-10-25 (walkthrough 27/27); disposable (engine 30, delivery 40, clock 22) | Nova's audit (Oct 17): 7 reviewed findings, 9 evidence records, **no clock policy approved**, priorities blank, report v1 **draft**; evidence is 8 days old | Isaac decides the clock policy and reviews the report; re-check evidence before approval |
| CRM / leads | yes | — | disposable (sales suites) + local Supabase | none found | — |
| Booking (Nova calendar) | yes | Cal.com optional | local Supabase 2026-10-25 | none found | — |
| Agreements / e-sign | yes | attorney review of the template | local Supabase | template is business-approved only | attorney review before real customers |
| Email | yes, gated (`SALES_EMAIL_MODE`) | Resend domain verification; `SALES_EMAIL_MODE=live` on a hosted environment | local Supabase: dry-run + copy in the local test inbox (new 2026-10-25) | never sent through Resend | DNS records + approval |
| Booking confirmation | yes (SMS; **email added 2026-10-25** for web-form customers) | as email | local Supabase 2026-10-25 | — | — |
| Voice (AI receptionist) | yes (Twilio speech + Polly) | Twilio number + webhook, active voice config with approved disclosure, hosted deployment | disposable (stand-in Twilio) | **no real inbound call possible** | Twilio + hosting |
| SMS / missed-call text | yes | A2P 10DLC, `WAVE1_SEND_ENABLED`, worker host, hosted deployment | disposable (stand-in) | no real text sent | Twilio registration |
| Revive | yes | SMS | disposable (revive 25, harvest 20) | — | after SMS |
| Demand | yes; campaign WUETJW **draft** (20 sourced prospects) | owner approval | local Supabase | not approved; nobody contacted | Isaac approves or edits |
| Monitoring (Sentry) | yes | `OPS_ALERT_EMAIL` | local Supabase (live heartbeat) | alert by SMS not implemented | — |
| Training (Academy) | yes, 10 programs | owner content review | disposable (academy 84) | — | — |
| Certification | yes, server-graded + manager review | — | disposable | — | — |
| Payments (Stripe Connect deposits) | yes | Stripe **test** keys, Connect, webhooks | disposable (stand-in Stripe) | never run against Stripe test mode | not needed for Nova on Nova |
| Demo (/demo) | yes | hosted database | disposable (demo 39) | deployed Preview cannot reach a database | hosted staging |
| Client setup (Install Systems) | yes, 14 components | escalation contact, email, phone/SMS, Revive, Demand | local Supabase 2026-10-25 | Nova: 8 done, 5 blocked, 1 not needed | owner items |
| Apple Messages / Pay / Wallet | rewards ledger only | Apple Developer account, MSP, certificates | disposable (loyalty 22) | not integrated | `docs/APPLE_MESSAGES_PAY_WALLET_SETUP.md` |
| Social channels | sign-in link only | developer apps | — | not implemented | later |

## Session 2026-10-26: repair brief milestones 1–2 (skills) and durable brief
- Preflight: branch `mvp/operational`, HEAD `58b2fa7`, clean tree before this session. Claude Code bills to the
  claude.ai **Pro** subscription; no `ANTHROPIC_API_KEY` in the launch environment. Docker and local Supabase running.
- **Skills installed and discovery verified** in a fresh project session: 10 engineering/design skills and 8 marketing
  skills in `.claude/skills/`. Sources, commits, licenses and deviations: `docs/SKILLS_MANIFEST.md`. Impeccable's
  per-edit hooks deliberately not installed. Roast Room prepared in its own folder, not run; its app calls the
  Anthropic API with an API key (separate billing).
- Durable brief added: `docs/NOVA_PRODUCT.md`, `docs/NOVA_DESIGN.md`, "Start here" section in `CLAUDE.md`.
- **Not started yet (next, in order):** milestone 3 spending guard in code + defect list linking each owner symptom
  to route/steps/cause; milestone 4 contract composer "local api error", audit persistence, clock controls,
  report/PDF/Vault. Local test credentials still need rotation (they were photographed).
- Release verification run 12's outcome was not re-checked in this session.

## Changes 2026-10-25, second session (design, iPad, audit refresh)
- **Design (approved black/gold/white references):** sidebar with the approved logo and a task-based menu (back office
  under "More"); owner dashboard rebuilt on a new `ops/home` endpoint — every figure from the business's own records,
  test records counted apart, booked value separate from money collected (shown as not measured: no live payments),
  priorities from real open items, recorded worker activity incl. hierarchy task events, worker roster (empty: none
  registered), audit queue, 30-day inquiry chart, integrations in plain words; sign-in page; client report page
  ("Your Nova Audit": tabs, real counts, "Estimate requires business inputs" when no scenario exists).
- **iPad over Wi-Fi:** `node scripts/local/staging.mjs serve --lan` — only the app is reachable; it forwards just
  sign-in and row-level-security reads; service-role keys and Supabase admin are refused (verified through
  10.0.0.82). **Found:** Docker publishes local Supabase (Studio, database, API, mail) on all interfaces and the
  Docker firewall rule allows Public networks — closing it needs an administrator (owner action). Home Screen icon and
  secure-context fallbacks added. Guide: `docs/LOCAL_STAGING.md`.
- **Nova's audit refreshed** with evidence captured 2026-10-25 (`docs/evidence/nova-live-audit-2026-10-25.json`): all
  9 public pages unchanged since 2026-10-17; 4 new evidence-backed findings (email DNS not set up for sending — no SPF,
  no DMARC, send.* records missing; two long inquiry forms; no escalation contact / no registered workers; hosting
  leftovers). **11 reviewed findings (3 high, 5 medium, 3 low), financial impact unknown on all, report v3 DRAFT —
  passes every approval check, not approved. Clock policy v1 saved, NOT approved.** A first refresh run wrote to a
  TEST fixture by mistake; those writes were removed and the script now selects Nova's case by name or refuses.
- **Full journey test** on local Supabase (walkthrough 34/34, commit `d33fc30`): homepage → /book → time → signed
  agreement → confirmation email (local inbox copy, recorded as dry run) → owner dashboard and Requests → audit →
  Install Systems → TEST audit approved and published → client opens the emailed link on a tablet → PDF.
  Other checks on this code: audit delivery 40, engine 30, clock 22, ops browser 32 (incl. report page), sales browser
  49, hierarchy browser 22 (+2 not built), demo browser 20, local staging 31.
- **Release verification run 12** (clean export, Node 22, two passes): queued 2026-10-25 18:33, **waiting for AC power
  — no result yet**. Logs: scratchpad `final12\`.
- Local inbox copies are **not** email delivery: no email has been sent through Resend from any environment.

## Changes 2026-10-25
- Web-form bookings now get a **confirmation email** (previously only SMS confirmations existed).
- Local staging: dry-run emails are also copied into the local test inbox (http://127.0.0.1:54324); records stay `dry_run`.
- Install Systems keeps the finished audit when a newer audit has no findings, and says so.
- **Audits** is a top-level dashboard item; the audit list is ~30× faster (4.5 s → ~0.2 s server time); test fixtures
  hidden by default; rows show finding count and start date; no more "0 cases" while loading.
- Checks (first attempt, 0 retries): walkthrough 27/27 and staging 31/31 on local Supabase; core journey 69, Connect
  deposits 17, calendar 19, demo 39, notifications 40, closing 97, hiring 76, audit delivery 40, audit engine 30, audit
  clock 22 + unit 13, ops browser 32, hierarchy browser 22 (+2 not built), sales browser 49.

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
