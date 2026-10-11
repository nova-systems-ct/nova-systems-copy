> **2026-09-29 — PAUSED.** Isaac's next master prompt ("NOVA AUDIT AND WAVE ONE WORKING MVP" /
> "MAKE NOVA WORK END TO END") explicitly pauses this hierarchy work in favor of the Nova
> Audit + Wave One MVP. Checkpoint at pause: all 5 hierarchy e2e suites passed 100% clean in the
> final aggregate run (202/202 — registry 49, governance 45, workitems 69, meetings 25,
> durable-worker 14), plus 101/101 pure-logic unit checks and 22/22 live-browser acceptance checks
> (20 real + 2 honest skips). Six pre-existing, unrelated sales suites hit the aggregate runner's
> new 120s timeout on that same run; an isolated re-check of one of them was still in progress when
> this pause arrived — inconclusive, not confirmed either way. They were independently verified
> clean multiple times earlier in this session, so this reads as environmental slowness late in an
> exceptionally long session rather than a regression, but that is an inference, not a confirmed
> fact — treat it as unconfirmed until re-run fresh. Nothing here was applied to Supabase or
> production. No further hierarchy work proceeds until Isaac says so again.

# Nova Organizational Hierarchy — build state

Status vocabulary (per `CLAUDE.md`): not started / in development / **locally verified** / staging
verified / waiting on owner-provider / ready for installation / installed / live verified.

## 2026-09-29 — Continuation: self-approval fix, Venture Lab governance, Authority Matrix
## enforcement, durable job queue integration, full Digital Headquarters screens, live browser
## acceptance — locally verified

Everything below is additional to the 2026-09-28 section further down this file (still accurate,
kept as history). No production/staging Supabase changes were made in this pass either.

**Fixed a real design flaw**: self-approval protection (built 2026-09-28) required a *different*
owner-level account to approve anything the sole owner drafted — a genuine deadlock for a
single-owner company. Replaced with a real re-authentication protocol: `governance?op=confirm-reauth`
re-verifies the caller's password against the real Supabase Auth password grant, requires a written
reason, and binds the confirmation to the exact content fingerprint (sha256 of the canonical JSON) of
what's being approved — a different, real owner-level account still needs no extra step. A
non-owner drafter is still blocked outright, no exception. New table:
`owner_reauth_confirmations` (single-use, auditable rows, not a signed token).

**Venture Lab now has a real, enforced lifecycle** (`ventureTransitionAllowed()` in
`api/_hierarchy/rules.js`): idea → research → zero_cost_validation → demand_signal → pre_sale →
sandbox_mvp → pilot → scale, pause/kill from any active stage, archive from paused/killed. A silent
jump (idea straight to scale, or resuming paused into an arbitrary stage) is refused unless the
caller explicitly sets `override:true` with real supporting evidence (10+ characters) — recorded
permanently in `venture_stage_events.override`/`.evidence` and in `decision_records`
(`decision_type='venture_override'`). `portfolio_entities.venture_data` (JSONB) now holds
hypothesis/customer/offer/budget/worker_hours/revenue_collected/costs/success_criteria/
kill_criteria/lessons via `save-venture-data`/`venture-data`.

**Authority Matrix is now enforceable, not just stored**: `api/_hierarchy/authority.js` exports
`checkAuthority({ actor, action, workerId, amountCents, dataClassification })` — one reusable
function evaluating the currently-APPROVED matrix (fails closed with none approved), kill switches,
the actor's role-derived authority level, and (for a worker actor) their contract's real spending
limit and data clearance. Wired into `api/_hierarchy/workitems.js`: `create-work-item`
(`create_internal_task`), `assign-work-item` (`reassign_routine_task`), and `set-venture-stage` when
closing a venture (`close_venture_experiment`). A real negative test proves it: setting
`create_internal_task` to `prohibited` in an approved matrix version genuinely blocks
`create-work-item` with a 403, and restoring a permissive matrix un-blocks it — not a cosmetic
label. Documented, not-yet-wired integration points for proposals/payments/documents/marketing/
communications/deployment/permissions are listed in that file's header, since retrofitting already
tested, independently-authorized modules was judged too risky to do blindly under time pressure —
this function only ever narrows what's allowed, never widens it, and nothing existing was weakened.

**Durable job queue integration** (`worker/index.mjs`'s `hierarchy_work_item_check` handler, real
and unmodified): a `url_check`-category work item's `start-work-item` call enqueues a REAL job on
the canonical `jobs` queue (`work_items.job_id` now correlates them) — the same queue every other
scheduled/background need in this codebase shares, never a second one. The handler does real,
non-fabricated work (an HTTP reachability check, not an AI call — "durable execution" and
"AI-authored output" are different concerns), emits real heartbeats, attaches real evidence/output,
and advances the item to `in_review`. **Honest limitation**: a real, separate OS subprocess running
`node worker/index.mjs` was found to hang indefinitely on its first outbound `fetch()` call in this
sandbox (reproduced twice, with a 90-second timeout) — a sandbox networking constraint on nested
child processes, not a defect in the worker code (the same code runs fine as a normal CLI process
outside this sandbox; `node worker/index.mjs --once` in local mode works here too). The test
(`scripts/e2e_hierarchy_durable_worker_test.mjs`, 14/14 checks) therefore imports and calls the
real, unmodified `handlers.hierarchy_work_item_check` and `buildStore()` in-process instead of
spawning a subprocess — genuinely proving the queue, the real `claim_next_job()` SQL function, the
handler logic, and idempotent redelivery, but not proving a separate long-lived worker OS process
specifically inside this sandbox. Recorded here rather than glossed over.

**Full Digital Headquarters screens** — 14 real, API-backed pages now exist under
`/dashboard/command/*`, all reachable through Nova Command's own visible sub-navigation (not just
by typing a URL), each still gated by the real `command.view`/`command.owner` permissions:
`Command` (home), `Organization` (map), `Companies` + `CompanyDetail` (also the Venture Lab screen —
`/ventures` reuses `Companies`, a real, deliberate reuse since a venture already is a
`portfolio_entities` row, not a near-duplicate page), `Executives`, `Committees` +
`CommitteeDetail`, `Workforce`, `WorkerDesk` (identity, mission, contract, current assignment,
evidence/outputs, escalation path, status history, Pause/Resume/Suspend/Reinstate/Request-review
controls — "Reassign" and "Reduce authority" are not dedicated one-click controls yet, noted
honestly on the page itself), `Meetings` (Meet Now / Committee Room), `Governance` (escalations,
kill switches), `Approvals` (pending policy versions with the real reauth flow built in),
`Reports`, `Activity` (a real merged feed across decisions/work items/ventures/meetings, filterable),
`Incidents` + `IncidentDetail` (severity/detection/affected systems/containment/recovery, a real
`committee_meetings.incident_details` JSONB column). `npm run build` compiles cleanly.

**Live browser acceptance — the real gap from 2026-09-28 is closed.** The prior report said "no
browser-automation tool is available" — that was checked and was wrong, per this session's explicit
instruction to inspect the existing harness first rather than assume. `scripts/testenv/devharness.mjs`
(real Vite + real API handlers, in-process + real local Postgres/PostgREST) and
`scripts/e2e_sales_browser_test.mjs` already existed and were reused as the pattern. Playwright
itself was not installed as a package, but its Chromium browser WAS already cached on this machine
(`chromium-1243`) from an earlier session — `npm install --save-dev playwright` installed the
matching version with **zero browser download**, confirmed by launching it. New
`scripts/e2e_hierarchy_browser_test.mjs`: **22/22 checks — 20 real passes, 2 honest skips** (a
test-adapter model response linked to a transcript statement, and preserved model disagreement —
both explicitly not built, logged as SKIP, never faked as PASS). Real screenshots captured for
Command Center, Organization, Company/Venture detail, Committees, Committee Room entry, Workforce,
Worker Desk (idle/working/stale-heartbeat/task-evidence/suspended), the open Committee Room with a
recorded decision and action item, Reports, Governance/kill-switch, cross-company denial, and mobile
layout — saved locally in this session's scratchpad (not committed to the repo; hand them to Isaac
directly if he wants to see them, or re-run the script to regenerate them anywhere this repo runs).
Three real bugs were caught and fixed only because this test genuinely ran against a real browser:
a mock-response helper mixing up a `.status()` method with a `.status` property (silently made
several status-code assertions always false), an append-only-table violation in the original test
design (heartbeat "staleness" was simulated with an UPDATE, which `worker_heartbeats`'s own
append-only trigger correctly refuses), and a stale work item being reused across two unrelated test
steps producing the wrong HTTP status. None of these were guessable from code review alone.

**Runner/process hygiene**: `scripts/verify_sales_team_e2e.mjs` was rewritten — sequential (was
already sequential, now explicit about it), a real per-suite timeout (120s, not 900s) that force-kills
the whole process tree on expiry (not just the immediate child), a `TIMEOUT` status reported
separately from an assertion `FAIL`, the run stops on a genuine assertion failure rather than
grinding through remaining suites, and a Windows-specific orphan-reaping sweep runs after every
suite (kills only `postgres.exe`/`postgrest.exe` processes under this repo's `.testenv` path whose
parent process no longer exists — never a real user Postgres instance). This was driven by a real,
reproducible bug: `e2e_sales_closing_test.mjs` (pre-existing, unrelated to this build) passed all 97
of its own checks but never exited on its own, hanging the aggregate run for up to 15 minutes before
the old 900s-per-suite timeout would have caught it — the same "all checks passed, process didn't
exit" pattern already fixed in the hierarchy suites earlier, now fixed there too with the same
`process.exit()` safety net. A real orphaned-process leak (from an much earlier, already-reported-on
run) was found and manually cleaned up in the process of diagnosing this.

**What remains genuinely not done from the 16-item follow-up request**: Model Council
provider/test-adapter integration (item 8) — not built at all, by design (no real credentials, no
fabricated dialogue); the fuller Meeting Engine experience — ask-one/ask-all/challenge-a-metric/
request-scenarios as distinct operations (item 9) — Meet Now, the transcript, evidence board,
decisions, and action items are real and tested, but those specific finer-grained interaction verbs
are not implemented as separate ops; worker/department/company check-ins and immediate high/critical
alerts (item 10) — only the existing Daily/Weekly brief exists; real cost accounting with
ceilings/simulated-labeling (item 11) — the schema columns exist (`work_items.cost_cents`,
`committee_meetings.cost_cents`, `model_runs`) but nothing writes a real or simulated cost anywhere,
so they stay honestly at 0; production deployment (item 15's plan is written —
`docs/NOVA_HIERARCHY_STAGING_PLAN.md` — but zero steps in it have been executed).

## 2026-09-28 — Phases B, C, D, and the Meeting Engine: locally verified

All of the following were built, tested against a real local disposable PostgreSQL + PostgREST
(`scripts/testenv/`), and confirmed passing individually. No production/staging Supabase changes
were made. No real communications were sent. No money moved. No AI provider integration exists —
Model Council seats remain deliberately inert and reserved.

| Layer | Migration | API | Unit tests | E2E tests |
| --- | --- | --- | --- | --- |
| Phase B — Registry | `hierarchy-01-registry...sql` | `api/_hierarchy/registry.js` (resource `hierarchy`) | part of 75/75 in `unit_hierarchy_rules_test.mjs` | 44/44 `e2e_hierarchy_registry_test.mjs` |
| Phase C — Governance | `hierarchy-02-governance...sql` | `api/_hierarchy/governance.js` (resource `governance`) | part of 75/75 | 42/42 `e2e_hierarchy_governance_test.mjs` |
| Phase D — Work & Reporting | `hierarchy-03-work-and-reporting...sql` | `api/_hierarchy/workitems.js` (resource `workitems`) | part of 75/75 | 45/45 `e2e_hierarchy_workitems_test.mjs` |
| Meeting Engine | `hierarchy-04-meetings...sql` | `api/_hierarchy/meetings.js` (resource `meetings`) | part of 75/75 | 22/22 `e2e_hierarchy_meetings_test.mjs` |

That is **153 real-database checks** across the four hierarchy e2e suites, plus **75 pure-logic
checks** with zero I/O, all wired into `scripts/verify_sales_team_e2e.mjs` and
`scripts/verify_local_all.mjs`. A full run of `npm run verify:sales-e2e` (all 14 suites, hierarchy
+ every pre-existing Sales Team suite) passed at **818 checks, 0 failures** the run immediately
after Phase D landed; each hierarchy suite has since been re-verified individually after every
subsequent change (Meeting Engine, kill-switch enforcement) rather than re-running the full
aggregate every time, per the instruction to build vertically and avoid repeated re-audits of
unchanged code.

A **supervised demonstration script**, `scripts/demo_hierarchy_supervised.mjs`, walks the entire
vertical in one run against Nova-owned test data in the same local, disposable environment: create
a worker → bring it to active → assign and start a real work item → truthful heartbeat → evidence
→ output → review by a different account (self-review blocked) → complete → raise an escalation →
route it worker→manager→executive→ceo_twin→owner (skipping the reserved Aura seat) → resolve it →
open a real committee meeting (Meet Now) with an honest participant list → ask a question and
record a decision in the persisted transcript → create an action item with a real DRI/deadline →
close the meeting → generate a real Daily Brief and Weekly Packet from verified database figures →
engage a kill switch on the worker → **prove the real handler refuses to assign it new work or let
it report itself as working** → disengage and confirm normal operation resumes. 30/30 steps pass.
Run it with `node scripts/demo_hierarchy_supervised.mjs`.

### Owner interface (screens)

Five real, API-backed React pages exist under `/dashboard/command` (gated by the real
`command.view`/`command.owner` permissions from the migration, via `RequirePermission`):

- `/dashboard/command` (`src/pages/dashboard/Command.jsx`) — portfolio, positions (with honest
  reserved/vacant/filled badges), workers.
- `/dashboard/command/workforce` (`Workforce.jsx`) — every worker's real status and **truthful live
  presence**, reading `workitems?op=worker-presence` per worker (server re-derives "working" from a
  real recent heartbeat tied to a genuinely in-progress work item — never a stored flag).
- `/dashboard/command/meetings` (`Meetings.jsx`) — Meet Now / Open Incident, a live Committee Room
  view (participants with real availability, persisted transcript with an input to add entries,
  evidence board, action items, close-meeting with a required summary).
- `/dashboard/command/governance` (`Governance.jsx`) — escalations (route/resolve) and kill switches
  (engage/disengage) by scope.
- `/dashboard/command/reports` (`Reports.jsx`) — generate and view Daily/Weekly briefs, each figure
  shown with its source table and verification state.

**Verification limitation, stated plainly**: `npm run build` compiles cleanly and every screen
calls the same handlers proven correct by the e2e suites above, but no browser-automation tool is
available in this environment, so these screens have **not** been visually clicked through in a
running browser. That is a real gap between "compiles and calls tested APIs" and "browser-verified
UI" — it is called out here rather than glossed over. See "What genuinely remains" below.

## What "locally verified" means here, precisely

Every migration/rule/API above has been run against a real, disposable PostgreSQL + PostgREST
instance — not Supabase, not production. Auth/Storage/Resend are Node stand-ins in that
environment. This proves the SQL, RLS default-deny posture, append-only triggers, and handler logic
are internally correct; it does not prove anything about the live Supabase project, real user
sessions, or production RLS policies until the same migrations are applied there and re-verified.

## A real bug this session's testing caught (worth recording)

`CREATE TABLE IF NOT EXISTS meetings` in the first draft of the Meeting Engine migration silently
did nothing, because a *different* `meetings` table already exists (`supabase/schema-update.sql`,
the client-facing "book a meeting" feature) with an incompatible shape — the new code then queried
nonexistent columns (`status`, `meeting_type`, `agenda`) and crashed. This was only caught by
actually running the real e2e test against real Postgres, not by code review. Fixed by renaming the
whole Meeting Engine table family to `committee_meeting*`. Recorded in the migration file's own
header so nobody rediscovers this the hard way.

## What genuinely remains (not started, no code exists)

These are large, separate efforts. Nothing here should be read as partially built:

- **Full Digital Headquarters home / interactive org map / individual Worker Desk detail page /
  activity timeline / incidents list view** — the 5 screens above are real but do not cover the
  entire 14-route surface the "NOVA DIGITAL HEADQUARTERS" prompt describes (Companies, Executives,
  Committees as dedicated pages, a per-worker Worker Desk with its own URL, an org-chart
  visualization, a global activity feed).
- **Model Council live comparison / any AI provider integration** — no ChatGPT/Claude/Gemini API
  call exists anywhere in this codebase. The three Model Council positions stay `is_reserved = true`
  and cannot be assigned a worker (enforced, tested). A transcript entry can never be attributed to
  them either (enforced, tested — see `add-transcript-entry`'s participant-availability check).
  "Model disagreement" is therefore not fabricated anywhere; the schema supports recording it once a
  real integration exists.
- **Autonomous / scheduled execution** — every state transition in this build happens through an
  authenticated API call (a human or a supervised script). Work items are not wired into the
  existing `jobs` lease/retry queue for unattended background execution; there is no heartbeat
  emitted by anything other than an explicit `heartbeat` call. "Durable" here means real persisted
  Postgres state with an append-only history, not autonomous operation.
- **Nova Venture Lab lifecycle beyond a stage field** — `portfolio_entities.venture_stage` and
  `venture_stage_events` exist and are tested, but there is no Idea→...→Kill *state machine*
  (any stage can be set to any other, by design, treating it as an owner/venture-council judgment
  call rather than a rigid pipeline) and no experiment-specific data model (budget tracking beyond
  the honest `budget_status` placeholder, zero-cost validation records, demand-signal evidence).
- **Authority Matrix runtime enforcement outside the hierarchy module itself** — the matrix is
  stored, versioned, and approvable, and `authoritySufficient()` exists for future callers, but no
  OTHER handler (proposals, payouts, documents) consults it; those enforce their own,
  independently-written authority checks, as they did before this build.
- **Cost tracking beyond the schema** — `model_runs.work_item_id` and `work_items.cost_cents` exist,
  but nothing writes a real cost anywhere (no provider calls happen), and `committee_meetings.cost_cents`
  is always 0. The columns are real and ready; the values are honestly empty.
- **The remainder of the "FINAL ADDENDUM"** — that message was cut off by a 50,000-character limit
  after "...HR addresses staffing, " (mid-sentence, inside "Meeting Behavior"). Whatever requirements
  follow that point were never received and are not reflected here.
- **Browser-verified UI** — see the "Owner interface" section above.

## Owner actions required before governance genuinely governs anything

1. Write and approve the real CEO Twin policy content (`hierarchy?op=save-ceo-twin-policy` →
   `approve-ceo-twin-policy`, by a *different* owner-level account than the one who drafted it —
   self-approval is now server-blocked) — currently an empty, honestly-`draft` shell.
2. Review and approve (or amend) the default Authority Matrix (`hierarchy?op=approve-authority-matrix`)
   — currently `pending_approval`, not yet governing anything.
3. Decide whether/when to begin filling `crystal-clear`, `aura`, and `nova-venture-lab` with real
   facts (name, legal structure, market) — all three remain intentionally `planned` placeholders.
4. Apply all four `supabase/hierarchy-0{1,2,3,4}-...sql` migrations to the real Supabase project (in
   order) before any of this is more than a local simulation, and re-run the e2e suites against a
   staging copy if one becomes available.
