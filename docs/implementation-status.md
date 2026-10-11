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

---

## Update 2026-09-23 — Nova Sales Academy (master prompt Section 6) — STATUS: PARTIAL

Built the full ten-program Nova Sales Academy: real schema (`academy_programs`, `academy_lessons`,
`academy_quiz_questions`, `academy_enrollments`, `academy_quiz_attempts`, `academy_certificates`,
plus a new `academy.view` permission — all appended to `supabase/schema-update.sql`, **not yet
applied to production**, same manual-SQL-editor-run pattern as every other schema change in this
project), a new `api/academy.js` serverless function (12th of Vercel Hobby's 12-function cap — no
headroom left for a future 13th top-level file without consolidating into an existing one), and
three dashboard pages (`Academy.jsx` self-service list, `AcademyProgram.jsx` lesson/quiz/
certificate flow, `AcademyAdmin.jsx` practical-review oversight) plus a public
`VerifyCertificate.jsx` page.

Real, substantive content for all ten required programs (Nova Fundamentals, Prospecting and
Qualification, Cold Emailing, Cold Calling, Cold Messaging, In-Person Sales, Discovery and
Diagnostic Selling, Follow-Up and Scheduling, CRM and Data Protection, Ethics/Commission/Final
Assessment) — 20 lessons with real learning objectives/examples/exercises, 50 quiz questions with
explanations, seeded via generated SQL INSERTs (not hand-typed, to keep escaping correct).
Programs 6/7 (In-Person Sales, Discovery and Diagnostic Selling) are flagged `requires_practical`
— quiz-passing alone routes them to `awaiting_practical_review`, not `completed`, until an admin
approves. Program 10 (Ethics) is flagged `critical_compliance` with every quiz question marked
`critical` — missing even one forces manual review regardless of overall score, per the master
prompt's "critical compliance failures can require manual review."

**Built against the canonical identity system** (Supabase Auth + `organization_members`), not the
separate, pre-existing, already-flagged-insecure applicant-portal localStorage scheme
(`ApplicantLogin.jsx`/`ApplicationStatus.jsx`, deferred since Stage 2) — that system was
deliberately NOT touched or extended here; fixing it is a separate task. Enrollment ties to a real
`staff_user_id`, meaning today the Academy is usable by any existing authenticated Nova staff
member (an admin can enroll someone else via the `enroll` action); the full apply → hire → invite
→ activate-as-rep pipeline that would let a brand-new outside candidate reach the Academy on their
own does not exist yet and was explicitly out of scope for this slice.

**Security-relevant gap found and fixed during build, not after**: the first draft gated
self-service actions with "any active staff member," not `academy.view` specifically — meaning a
client-org role with no Academy access would still reach real Academy data through the raw API,
even though the Growth-hub nav link is correctly hidden from them. Fixed before shipping: every
self-service action now requires `academy.view` server-side, verified by a new permanent test
(`scripts/e2e_academy_auth_test.mjs`).

**Grading is entirely server-side.** `academy_quiz_questions.correct_index`/`explanation` are
never sent to the client, and there is deliberately no RLS SELECT policy on Academy tables for
`authenticated` — the API's service-role-backed dispatcher is the only access path, mirroring how
the pre-existing `applications` table (holding sensitive applicant PII) is already handled.
Certificates re-verify eligibility server-side at issuance time regardless of what the client's
local state claims.

**Verified**: `npm run build`/`lint` clean; both pre-existing permanent regression suites
unaffected (`e2e_org_isolation_test.mjs` 8/8, `e2e_api_client_auth_test.mjs` 22/22). The new
`scripts/e2e_academy_auth_test.mjs` (auth gating for every action + the full enroll → grade →
complete → certificate → verify flow + the critical-compliance-forces-review path + admin
practical-review approval + a self-approval rejection check) was written and run — it fails fast
with a clear, correct error (`academy_programs` table not found) rather than silently no-op'ing,
because the migration has not been applied yet. This is the same PARTIAL pattern Stages 4 and 5
went through: everything that doesn't require the live migration is built, code-reviewed, and
build-verified; the grading/certificate logic itself has NOT been exercised against a live
database and cannot honestly be called PASS until Isaac runs the migration and this test is
re-run.

**Pending Isaac**: run the "Nova Sales Academy" section of `supabase/schema-update.sql` (tables +
`academy.view` permission + all ten programs' seed content) in the Supabase SQL Editor, then
`node scripts/e2e_academy_auth_test.mjs` for real evidence before this moves from PARTIAL to PASS.
The 80% quiz-passing threshold (`SCORE_THRESHOLD_PERCENT` in `api/academy.js`) is a proposed
default per the master prompt, not yet formally approved as final.
