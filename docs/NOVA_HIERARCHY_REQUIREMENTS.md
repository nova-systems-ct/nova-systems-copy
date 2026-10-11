# Nova Organizational Hierarchy — requirements & reuse map (Phases B–D + Meeting Engine)

Source: Isaac Nova's "MASTER EXECUTION PROMPT — NOVA ORGANIZATIONAL HIERARCHY AND AUTONOMOUS
OPERATING FOUNDATION" (2026-09-27/28), plus the "NOVA DIGITAL HEADQUARTERS" and "FINAL ADDENDUM"
follow-ups (the addendum's text was cut off mid-section by a 50,000-character message limit; only
the received portion is reflected here).

This document records what Phase A (inspection) found already exists, what was deliberately
reused rather than duplicated, and what Phases B (Registry), C (Governance), D (Work & Reporting)
and the Meeting Engine shipped on 2026-09-28, followed by a 2026-09-29 continuation that fixed a
real single-owner self-approval deadlock, gave Venture Lab a real enforced lifecycle, made the
Authority Matrix genuinely enforceable (not just stored), integrated the canonical durable job
queue, built the remaining Digital Headquarters screens (14 real pages, all reachable through Nova
Command's own navigation), and proved the whole thing with a real, passing, 22-check live-browser
acceptance suite with real screenshots. See `NOVA_HIERARCHY_BUILD_STATE.md`'s 2026-09-29 section for
the full detail and exact test counts, and its "what remains genuinely not done" list for the
honest boundary (Model Council provider integration, the finer-grained meeting interaction verbs,
check-ins/alerts, real cost accounting, and production deployment — a written, unexecuted plan only).

## Reused, not duplicated

| Master-prompt concept | Reused mechanism | Where |
| --- | --- | --- |
| Identity for a human worker | `auth.users` (Supabase Auth) — a worker's `staff_user_id` IS a real account id, never a second identity table | `workers.staff_user_id` |
| Membership / role that already exists (Isaac as `nova_super_admin`) | `organization_members` | seed condition in the migration |
| Permission gating | `permissions` / `role_permissions` / `requireStaff` | new `command.view` / `command.owner` keys |
| Audit trail | `sales_audit_log` (append-only) | every hierarchy write calls the shared `audit()` helper — no second audit-log table |
| Versioned policy with draft → pending_approval → approved → retired, one-approved-per-key | `sales_config` (the exact pattern already used for the Academy passing policy and the commission plan) | new keys `ceo_twin_policy`, `authority_matrix`, `model_council` |
| Escalation destination (Level 5/6, "route to Isaac's Approval Inbox") | `approval_requests` (existing Approval Inbox) | not yet wired into a hierarchy write path — see Build State |
| Durable work-item execution | the existing `jobs` queue | not yet extended for hierarchy work items — see Build State |
| API surface / Vercel function cap | `api/_sales/index.js`'s existing `registerSalesResource`/dispatch table | resource `hierarchy`, dispatched from `api/client.js` with zero new top-level functions |

## What Phase A found (inspection)

- No pre-existing organizational-hierarchy, portfolio, position, or worker table existed anywhere
  in the schema before this migration — Phase B's tables are genuinely new, not a rename of
  something else.
- `sales_config`'s versioned-policy pattern (draft/pending_approval/approved/retired, partial
  unique index enforcing one `approved` row per key) was confirmed by direct read of
  `supabase/sales-team-01-access-and-hiring-migration-standalone.sql` to be generic enough to
  reuse verbatim for CEO Twin policy, the Authority Matrix, and Model Council configuration —
  no new versioned-config mechanism was written.
- `api/_sales/index.js`'s `TABLE` dispatch object was confirmed to be a plain resource registry
  despoite its path (used already for `apply`, `hiring`, `documents`, `salesteam`, `leads`,
  `catalog`, `proposals`, `clientproposal`, `salespay`, `commissions`, `notifications`) — adding a
  `hierarchy` entry required zero new Vercel functions, consistent with the 12-function cap.
- `api/_auth.js`'s `requireStaff(req, res, permission)` already returns `{id, email, roles}` for
  any active, permitted member — reused as-is for `command.view`/`command.owner` gating.

## What Phase B (Registry) actually shipped

- `supabase/hierarchy-01-registry-migration-standalone.sql` — additive migration (zero DROP /
  TRUNCATE / DELETE): `portfolio_entities`, `portfolio_status_events` (append-only),
  `org_units`, `positions`, `workers`, `worker_status_events` (append-only),
  `executive_assignments`, `model_runs` (usage ledger, unused until a real Model Council
  integration exists). RLS enabled on all 8 tables with no policies (API-only access, matching the
  Sales Team pattern), and all 8 added to `zz-public-schema-lockdown-standalone.sql`'s coverage
  list (`node scripts/check_migration_lockdown.mjs` passes).
- Seed data: Isaac seeded as the real `owner` position holder **only if** a real `nova_super_admin`
  membership already exists (never invents an account); the Aura Control Seat and the three Model
  Council seats (ChatGPT/Claude/Gemini) seeded `is_reserved = true` with a real, honest
  `reserved_reason` and an `executive_assignments` row of `fill_type = 'reserved'` — the API
  refuses to ever assign a worker to a reserved position (proven in the e2e test below); CEO Twin
  position seeded `vacant`, its policy seeded as an entirely empty `draft` `sales_config` row
  (Isaac must write the real content); the default Authority Matrix from the master prompt's
  action→authority table seeded `pending_approval` (not treated as governing until an explicit
  owner approval); Model Council config seeded `draft` with every provider `enabled: false` and no
  API keys ever stored in that record; 21 illustrative, fully-editable `org_units`
  (departments/shared-services/committees) — nothing in the API hard-codes this list, matching the
  master prompt's explicit "configurable, not a fixed enum" instruction; `crystal-clear`, `aura`,
  `nova-venture-lab` portfolio entities seeded `planned` with no invented facts (name, service
  catalog, legal structure are explicitly undecided).
- `api/_hierarchy/rules.js` — pure logic (no I/O): the worker state machine
  (`draft→onboarding→training→restricted→active→suspended→inactive`, matching the master prompt's
  transition table exactly), `assignmentProblems()` (the concrete, testable form of "a reserved
  position may never be assigned a worker" and "a suspended/draft worker cannot hold a position"),
  self-approval detection, an authority-matrix label→level lookup that fails closed to owner-only
  on an unrecognized label, CEO Twin policy normalization and a real readiness check (an
  entirely-empty policy is never reported as ready to govern anything).
- `api/_hierarchy/registry.js` — real HTTP handlers (portfolio list/create/status-change, org-unit
  create, position create, worker create/status-change, executive assignment, CEO Twin policy
  read/save/approve, Authority Matrix read/save/approve, Model Council config read), dispatched via
  `registerSalesResource`-style entry in `api/_sales/index.js`'s `TABLE`, resource key `hierarchy`.
  Every write requires `command.owner`; reads require `command.view`.
- `scripts/unit_hierarchy_rules_test.mjs` — 36 pure-logic checks, all passing.
- `scripts/e2e_hierarchy_registry_test.mjs` — 43 checks against a real local PostgreSQL +
  PostgREST (disposable, not Supabase/production), all passing, including: the migration applies
  cleanly against a database that already has a real org and a real `nova_super_admin` (the
  realistic deployment order); the reserved Aura Control Seat is refused a worker assignment by the
  real handler, and the database still shows it reserved afterward; a non-owner cannot reach the
  assignment endpoint at all; the worker state machine is enforced end to end through the real
  handler with a real audit trail; a suspended worker cannot be (re-)assigned to hold a position; a
  duplicate active `staff_user_id` on a second worker record is rejected; CEO Twin policy and the
  Authority Matrix require a real, explicit, non-self, non-automated owner approval (no `confirm`
  flag → refused; a non-owner → 403); the append-only trigger genuinely refuses a direct
  `UPDATE ... worker_status_events` even at the database layer; cross-org / anonymous reads are
  refused by RLS, not just handler-code filtering.

## Phases C, D, and the Meeting Engine (also shipped 2026-09-28)

Built directly on top of Phase B, same session, same reuse discipline:

- **Phase C — Governance** (`hierarchy-02-governance...sql`, `api/_hierarchy/governance.js`,
  resource `governance`): worker operating contracts (versioned, same draft/pending/approved/retired
  pattern as `sales_config`, self-approval blocked), `decision_records` (a new, narrow, append-only
  table — deliberately NOT a duplicate of `sales_audit_log`, which stays the generic technical
  trail), the escalation chain (Worker→Manager→Executive→CEO Twin→Aura[skipped while
  inactive]→Owner, real routing/resolution, self-resolution blocked), kill switches at 5 scopes
  (global/portfolio_entity/org_unit/worker/model_provider) that **genuinely block** work assignment
  and "working" heartbeats once engaged (not just recorded — enforced in Phase D's handlers). Also
  retrofitted server-enforced self-approval protection onto Phase B's CEO Twin/Authority Matrix
  approval endpoints, a real gap this phase's requirements surfaced. 42/42 e2e checks.
- **Phase D — Work & Reporting** (`hierarchy-03-...sql`, `api/_hierarchy/workitems.js`, resource
  `workitems`): a real work-item state machine (draft→assigned→in_progress↔blocked→in_review→
  approved/rejected→completed, plus cancelled/failed/retry), evidence/output/review records
  (append-only outputs and reviews — a correction is a new row, never an edit), self-review blocked,
  truthful worker presence (`isWorkerActuallyWorking()` re-derives "working" from a real recent
  heartbeat tied to a genuinely in-progress work item — never a stored flag), a Venture Lab stage
  field on `portfolio_entities` with append-only `venture_stage_events`, a real Daily/Weekly Owner
  Brief generator that builds every figure from a live database query at generation time (never a
  stored narrative), and versioned `operational_memory` with real provenance (source_type/source_id)
  and honest expiration. 45/45 e2e checks.
- **Meeting Engine** (`hierarchy-04-meetings...sql`, `api/_hierarchy/meetings.js`, resource
  `meetings`): Meet Now / Open Incident opens a real, persisted `committee_meetings` row with an
  honestly-loaded participant list (available/unavailable/reserved/vacant, computed from real
  position/worker/kill-switch state — never fabricated or silently dropped) and a real agenda built
  from actually-unresolved prior action items and open escalations. A persisted, append-only
  transcript; a statement can never be attributed to a reserved/vacant seat's occupant, because
  there isn't one — the concrete enforcement of "no fabricated AI participation" until a real Model
  Council integration exists. An evidence board and action items with a real DRI and deadline.
  Closing requires a real summary and is permanent. Table names are `committee_meeting*` because a
  different `meetings` table already existed for the client-facing "book a meeting" feature — a real
  collision the e2e test caught, documented in the migration file. 22/22 e2e checks.
- **Owner interface**: five real screens under `/dashboard/command/*`
  (`Command.jsx`, `Workforce.jsx`, `Meetings.jsx`, `Governance.jsx`, `Reports.jsx`), each calling the
  handlers above, gated by the real `command.view`/`command.owner` permissions. `npm run build`
  compiles cleanly; **no browser-automation tool exists in this environment**, so these have not
  been visually clicked through — stated plainly, not glossed over.
- **Supervised demonstration**: `scripts/demo_hierarchy_supervised.mjs` runs the entire vertical
  end to end against Nova-owned test data in the same local, disposable environment — including
  proving a kill-switch-paused worker is genuinely refused new work and cannot report itself as
  working. 30/30 steps pass.

See `NOVA_HIERARCHY_BUILD_STATE.md` for the full test-count table and the precise, current boundary
of what remains not started (full 14-route Digital Headquarters, live AI provider integration,
autonomous/scheduled execution, Authority Matrix enforcement inside other handlers, and the
unreceived remainder of the "FINAL ADDENDUM").
