# Nova Product Build — State Checkpoint

Last updated: 2026-09-23, after commit `69fef38` plus the login-path verification work below
(pending commit). Written per the master execution prompt's §23 requirement to maintain a real,
resumable checkpoint rather than claim unattended progress across a session boundary this
environment cannot actually cross.

## Where this build actually is

This is a genuinely large scope — 24 sections describing what amounts to a full multi-tenant
SaaS platform. It has not been built in one pass, and claiming otherwise would violate the master
prompt's own explicit instructions ("do not return... a new list of future tasks" as a substitute
for implementation, but also never claim completion without evidence). See
`docs/requirement-matrix.md` for the full module-by-module status. In short: the identity/tenancy
foundation, the dashboard shell, the Sales Academy, and the hiring pipeline are real and either
live-verified or locally-verified-and-waiting-on-owner-setup. The Audit engine, Wave One (as
actually specified in §10), voice agents, CRM pipelines, Installation Center, Crystal, Zion
Studio, marketing automation, Integration Center, and durable worker infrastructure have not been
started.

## This session's real work (2026-09-23)

1. **Restored confidence in the login path at the system level** — not by re-asserting an
   unverified theory, but by re-checking from scratch per the master prompt's explicit
   instruction not to assume the earlier VITE_SUPABASE_URL diagnosis was the only cause:
   - Confirmed (again) production URL/CSP/anon-key are all correct.
   - Wrote `scripts/e2e_login_path_test.mjs` (new, permanent, re-runnable) — 12/12 passing
     against the live database: wrong-password rejection, real session issuance, session
     persistence, sign-out, a user with zero organization memberships provably has zero access
     (via `is_org_member()`/`has_permission()` called as that real user, not service-role), a
     *revoked* membership (`status != 'active'`) also provably has zero access despite a real
     row existing, and a control case (active membership) passes both checks — proving the
     revocation checks aren't just always returning false.
   - Ran a real Playwright browser session against **live production**
     (`https://nova-systems.app/login`) with a throwaway owner-role test account: real sign-in
     reached `/dashboard`, rendered real content, survived a page refresh without bouncing to
     `/login`, an unauthenticated direct hit to `/dashboard/admin` correctly redirected to
     `/login`, and zero console errors throughout. This is real, live, browser-level evidence,
     not a mocked test.
   - **Conclusion**: the login/authorization system itself works correctly, end to end, for any
     correctly provisioned account. Isaac's specific inability to log in is a separate, already
     root-caused issue: his `isaac@nova-systems.app` address is rejected by Supabase's own
     `/auth/v1/recover` endpoint (`email_address_invalid`) for reasons only visible in the
     Supabase Dashboard's Auth settings — not a DNS problem (the domain has a valid MX record),
     not a code problem, not fixable from this environment. His `isaac_0427@icloud.com` address
     successfully received a real reset email in an earlier session.
2. **Wrote `docs/requirement-matrix.md`** — module-level status against verified evidence, per
   §3's explicit requirement.
3. **Wrote this checkpoint document** — per §23's explicit requirement.

## What was deliberately NOT attempted this session

Sections 8-19 (Audit engine, Wave One-as-specified, voice agents, CRM, Installation Center,
Crystal, Zion Studio, marketing automation, Integration Center, durable workers) were not
started. Each is a substantial, independent domain — the Audit engine alone needs a real schema
for cases/evidence/findings/recommendations/reports that doesn't share much structure with
anything currently in this database. Starting any of them shallowly in the remaining space of one
session would produce exactly the "scaffold with no real domain logic" the master prompt
explicitly prohibits. Real progress on the next module needs its own properly-scoped session.

## Exact next task

Per §23's dependency order, item 2 ("shared tenancy, data contracts, event/job foundations,
private storage and test database") is largely already satisfied by the existing
organizations/organization_members/permissions foundation (R03) — the one genuinely open piece of
"foundations" work is **private storage** (R09: the three missing buckets) and an **event/job
foundation** (R19: this app has zero worker/queue infrastructure today, which sections 8, 10, 11,
16, and 17 all depend on for anything that can't complete inside one HTTP request).

Recommended next session's concrete task: **resolve R09 (buckets) and R02 (Isaac's account) with
Isaac directly** — both are pure owner-action blockers with nothing left for this environment to
investigate — then begin **R10, the Nova Audit domain model** (§8), since it's the next
dependency-ordered module (§23 step 4) and the current `/business-diagnostic` page is
marketing-copy-only with no real backing schema.

## Owner-action items currently blocking further automated progress

1. **Run two SQL migration files** in the Supabase SQL Editor (both reviewed for safety — every
   statement is additive, `IF NOT EXISTS`/`ON CONFLICT`, zero destructive statements):
   - `supabase/academy-migration-standalone.sql`
   - `supabase/hiring-workflow-migration-standalone.sql`
2. **Create three Storage buckets** (this session's own permission system blocked me from doing
   this directly — flagged as a shared-resource modification, not bypassed):
   - `portfolios` — **private**, ~5MB file size limit (resumes/application uploads)
   - `nova-vault` — **private**, ~10MB file size limit (invoices, signed contracts, generated
     documents — this bucket is used by `api/_vaultStorage.js` and currently constructs a public
     URL that will need to become a signed URL once the bucket is actually private; that specific
     follow-up code change has NOT been made yet and should happen in the same session as bucket
     creation, not before)
   - `portfolio` — **public**, ~5MB file size limit (marketing case-study images, intentionally
     public)
3. **Investigate `isaac@nova-systems.app`'s Supabase Auth rejection** in Dashboard →
   Authentication → Email / URL Configuration, or use `isaac_0427@icloud.com` (already has a
   working reset path) going forward.
4. **Formally approve or reject the 80% Academy quiz-passing threshold** — currently a proposed
   default in `api/academy.js`'s `SCORE_THRESHOLD_PERCENT` constant.
5. **Reconcile the "Wave One" name collision** (R06 vs. R11 in the requirement matrix) before any
   work on §10 begins — the existing `WaveOne.jsx` page and the master prompt's Wave One
   communications bundle are different things sharing a name.
6. **Supply Zion's existing character reference assets** before any Zion Studio rendering work
   can begin (§16 explicitly requires this — building a new character would violate the
   instruction to preserve the existing one).

After the SQL files run, `node scripts/e2e_academy_auth_test.mjs` and
`node scripts/e2e_hiring_workflow_test.mjs` give real, immediate pass/fail evidence for R07/R08.
