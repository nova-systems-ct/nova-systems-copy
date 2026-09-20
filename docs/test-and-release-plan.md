# Nova Systems — Test and Release Plan

**Date:** 2026-09-20.

## What exists today

**Pattern 1 — mocked-Supabase Playwright** (throwaway, `playwright-core` installed/removed with
`--no-save` every time, never touches `package.json`/lockfile): intercepts `/auth/v1/*` and
`/rest/v1/*` REST calls with realistic fake responses so real frontend code (auth guard, org
context, permission gating, page rendering) runs against controlled data with zero live network
calls. Used across Stages 2–5 for: login/logout/session-persistence flows, HQ nav rendering,
permission-gated routing, org switcher behavior, empty-state rendering. Not checked into the
repo — written fresh, run, deleted each time (matches this prompt's caution against committing
provider secrets/test scaffolding casually, and keeps the repo clean of one-off scripts).

**Pattern 2 — permanent real-database e2e scripts** (`scripts/e2e_*.mjs`, checked into the repo):
create real throwaway Supabase Auth users and organizations via the admin API, sign in with real
passwords (never the service-role key, so RLS applies exactly as production would), verify the
actual security property, then delete everything in a `finally` block regardless of outcome.
`scripts/e2e_org_isolation_test.mjs` is the canonical example — 8 real checks covering cross-org
read isolation, forged-filter attacks, role-escalation write attempts, and permission-tampering
resistance.

Both patterns require manual invocation (`node scripts/...`) — no CI wiring exists.

## Gap against this prompt's Section 16 categories

| Category | Status |
|---|---|
| Unit tests (validation, state transitions, permission helpers) | Not present as a formal suite — permission logic is covered indirectly by the e2e scripts, not unit-tested in isolation |
| Database/RLS tests | **Covered** — `e2e_org_isolation_test.mjs` |
| API integration tests (forms, uploads, invitations, webhooks) | Not present |
| End-to-end user-journey tests | Partially covered ad hoc (login→HQ→permission-gated pages); no visitor→lead→diagnostic or candidate→account→training journeys exist because those systems aren't built |
| Accessibility checks | Not present |
| Responsive visual checks | Not present |
| Performance budgets / Core Web Vitals | Not present |
| Security checks (dependency audit, secret scan, upload abuse, rate limiting, XSS/SSRF, webhook spoofing, prompt injection) | Not present as automated checks; individual issues have been found and reported through manual investigation (e.g., the dormant `VITE_CLAUDE_API_KEY` exposure risk in `Documents.jsx`) |
| Failure/resilience tests (expired tokens, provider outage, duplicate webhooks, rollback) | Not present |

## Recommendation

Don't build a full CI/test-automation platform speculatively — most of the missing categories
apply to systems (voice agent, payments-at-scale, webhooks) that don't exist yet. As each new
system is built per the phased plan, its slice should ship with the e2e-script pattern already
established (real data, real cleanup, no live side effects on production business data) rather
than deferring testing to "later." CI wiring (running the mocked-Playwright pattern automatically
on push) is a reasonable, low-cost improvement to propose once Phase 1 work begins — flagged as
**PROPOSED**, not started.

## Release gate (informal, currently followed)

Every stage this session shipped with: `npm run build` clean, relevant mocked/live tests passing,
a git-status check confirming no unrelated file got touched, and an honest PASS/PARTIAL report
distinguishing what was actually verified from what's pending external action (a SQL migration
run, a manual Supabase config change). Continue this discipline — it's the reason the "PARTIAL,
not PASS" pattern in `implementation-status.md` is trustworthy rather than optimistic.
