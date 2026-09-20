# Nova Systems — Implementation Status

**Last updated:** 2026-09-20. Maintained alongside `current-state-audit.md` — that document
explains *what exists*; this one tracks *what's done, what's blocked, and what's next*.

## Completed and verified (uncommitted, working tree)

| Area | Status | Verification |
|---|---|---|
| Public site content honesty pass (pricing, careers, about) | Done | `npm run build` clean |
| Real Supabase auth, guard, callback, reset-password | Done | Mocked Playwright, 10/10; real login-flow logic |
| Nova HQ six-area shell | Done | Mocked Playwright, 10/10 |
| Multi-org/RBAC foundation + Stage 4.1 permission fix | Done | Live real-user RPC tests, 4/4 + 2/2; real isolation test, 8/8 |
| Stage 5 real-data plumbing (schema written) | **Blocked** | Migration not yet applied to production — see below |
| Overview/Leads/Tasks real-data pages | Built, mocked-verified | 7/7 mocked; live-verified once migration runs |

## Blocked — needs Isaac

1. **Stage 5 database migration** ("STAGE 5 — NOVA RUNS NOVA" section of
   `supabase/schema-update.sql`) not yet run in the Supabase SQL Editor. I have no DDL execution
   path in this environment (confirmed: no direct Postgres connection string, no `exec_sql`-style
   RPC exposed). Once run, `Leads`/`Tasks`/`Overview` should work against real data with no
   further code changes.
2. **Decision D1** (`current-state-audit.md` §1) — whether to discard the uncommitted
   hero/nav/footer/home changes and restore the committed video hero as the Phase 1 recovery
   baseline, or keep the current static version.
3. Supabase Auth's Site URL/redirect allowlist (external dashboard config) — still unverified,
   flagged every stage since Stage 2.
4. `growth.view`/`intelligence.view` gating some Nova-only, non-organization-scoped pages —
   accepted risk per Isaac's explicit instruction, needs resolving before any real client org.

## Not started (large scope, this prompt's Sections 6, 9–13)

Sales Academy content/certificates, 24/7 voice agent, Company 002 naming + platform, Zion Studio,
Nova social/content engine beyond the existing blog, Revenue Lab, Integration Center registry,
agent governance framework. See `product-requirements.md` for the full mapping.

## Environment variables in use (names only)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`,
`DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, `VITE_CALCOM_URL`. `VITE_CLAUDE_API_KEY` is referenced
in `Documents.jsx` but **not set anywhere** — do not set it without first fixing that file to stop
calling Anthropic directly from the browser (see audit §6).

## Rollback notes

Nothing in this work has been committed or deployed. All of Stages 1–5 plus Phase 0 documentation
is uncommitted working-tree state. To roll back entirely: `git checkout -- <file>` per file, or
review with `git status`/`git diff` before any broader discard — the unrelated pre-existing
changes (hero/nav/footer/notify.js/etc., see audit §1) would also be affected by a blanket
discard, so do not run a repo-wide `git checkout .` without reviewing what that would take with it.

## Next recommended vertical slice

Pending Isaac's input on Decision D1, the next slice is **Phase 1 homepage/positioning rework**:
restore the video hero from HEAD (if D1 resolves that way), rewrite homepage copy to the
diagnostic-first framing this prompt specifies, add `/how-nova-works` and `/business-diagnostic`
pages, and reconcile primary navigation. This is scoped, safe, additive, and doesn't depend on the
Stage 5 migration or any of the large not-yet-started systems.
