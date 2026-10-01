# Nova security repair and reproducible build — 2026-09-30

Branch `repair/security-2026-09-30`, local only. Nothing was pushed, deployed or applied to any real
database. **Production is not protected by these changes until the approvals in section 1 are given
and carried out.** Local tests passing says nothing about the live systems.

Source: the reality audit in `nova-audit-2026-09-30` (findings F-01 to F-41).

## 1. Approvals requested (each is a separate, concrete action)

| # | Action | Why | Reversible? |
|---|---|---|---|
| A1 | **URGENT.** Disable the 9 cron jobs of Vercel project nova-wave-one (Settings → Cron Jobs → Disable). | The "decommissioned" app still runs nightly jobs against the production database with live Twilio, Resend and Stripe credentials (F-06). | Yes, same switch. |
| A2 | Turn on Vercel Authentication for **all** nova-wave-one deployments, including nova-systems.agency. | Stops its public API from acting on the shared production database. | Yes. |
| A3 | Take a Supabase backup, then apply `supabase/security-repair-2026-09-30-production-patch-standalone.sql` to production (or to a staging copy first, if one is created). | Closes anonymous read/write of 15 tables, cross-organization reads of organizations/memberships, platform-job reads, and the public intake bucket (F-02, F-34, F-16). | Additive. Rollback is a narrower added policy, never re-opening access. |
| A4 | Apply `supabase/security-repair-2026-09-30-columns-standalone.sql` to production. | The repaired code records payment provenance and signing evidence in these columns. | Additive columns only. |
| A5 | After review, deploy this branch to nova-systems.app (after A3 and A4). | Moves the code fixes for F-03, F-04, F-05, F-08, F-16, F-22–F-24, F-26, F-33, F-35, F-36 to production. | Yes, redeploy the previous build. |
| A6 | Rotate credentials in the order given in `docs/SECURITY_CREDENTIALS_AND_LEGACY_PAUSE_PLAN_2026-09-30.md` (A1 first). | F-01: several keys are on disk; some were disclosed in a chat transcript. | No. Each rotation is its own approval. |
| A7 | Decide the self-approval policy (owner decision #23). | Approvals are now organization-bound, but whether an author may approve their own item is a business rule the code must not invent (F-22). | — |
| A8 | Decide whether to remove `overview.view` / `growth.view` from the `nova_sales` role in production. Check query #7 of the metadata check shows whether they are present. | F-17. The sales-team migrations that remove them are not applied in production yet. | Yes. |

Effects to expect from A3: the nova-wave-one dashboard reads several `nova_ai_*` tables directly from
the browser. After A3 those counters show zero. Its server functions use the service role and keep
working. nova-systems.app does not read those tables from the browser.

## 2. Production database patch

Files, in order:

1. `supabase/security-repair-2026-09-30-production-patch-standalone.sql` (A3).
2. `supabase/security-repair-2026-09-30-columns-standalone.sql` (A4).
3. Verification, read-only: `supabase/checks/security-metadata-check.sql`. It reads catalog metadata
   only, never customer rows.

Prerequisites, checked by the patch itself: the `organizations` and `organization_members` tables and
the `is_org_member(uuid)` function must exist. Otherwise the patch stops with an error and changes nothing.

Proof (local disposable PostgreSQL only): `scripts/e2e_production_patch_test.mjs` rebuilds the broken
production state, confirms the exposure, applies the patch twice and checks the results. It covers
anonymous denial, cross-organization denial, applicant denial and preserved member and service-role
access. It also covers the refusal to half-apply, the metadata answers and the columns migration.

## 3. What changed

The tests listed in section 4 verify each item below locally.

- **F-03 public client actions.** The onboarding save is insert-only, the plan price is set by the
  server, the organization is fixed, and browser-asserted payment-to-account was retired.
  The client list needs Nova staff.
- **F-04 email relays.** The invoice email is staff and organization only. Recipient, amount, link and
  PDF come from stored records. The contact and demo forms reply only to the submitter and strip links.
  All mail goes through one sender whose address can point at a local stand-in.
- **F-05 payment authority.** Amounts come from stored records. "Paid" needs a signed Stripe event that
  matches the mode, currency, amount, status, record and organization. Duplicate events are
  acknowledged and ignored. A transient error lets the retry through. Owner-recorded payments need
  evidence and are labelled `owner_recorded`. Live Stripe stays blocked.
- **F-08, F-22, F-23, F-24 isolation.** Updates are filtered by the owning organization and cannot
  re-home rows. Approvals are checked against the item's organization. Permissions come only from
  Nova roles for Nova resources. The browser loads only the caller's own memberships. Vault links
  are signed only for the stored path.
- **F-16 uploads.** A short-lived, signed upload token is required. The file type is checked from the
  bytes, the size is capped and names are random. Files are read only through 5-minute signed links
  for staff. A submission can attach only its own uploads.
- **F-17, F-18, F-34 database.**
  - The schema file no longer re-grants rep-wide access.
  - Platform jobs are service-role only.
  - A base file creates the three tables production had before this repository.
  - The marketing migration works on an empty database.
  - The lockdown covers the remaining tables.
  - One ordered manifest, `supabase/migration-manifest.json`, builds an empty database with zero SQL
    errors, and the whole manifest can be re-run.
- **F-21, F-28 tools.** The worker no longer reads `.env.local` and refuses a remote database unless
  `NOVA_WORKER_TARGET_REF` names it. Its URL check uses the same SSRF protection as audit research.
  Real-database scripts read a separate staging env file and never run against the production or old
  project. QA and seed scripts fail closed.
- **F-26 contract signing.** The signature is bound to a hash of the exact text. Links expire after
  7 days. The PNG is validated, the server builds the PDF, and a conditional update makes signing
  happen once.
- **F-27 test tooling.**
  - Failing suites now exit non-zero; a dependency hook used to force exit 0.
  - Finished suites no longer hang on open child pipes.
  - pg-mem is declared, and all 12 schema validators run.
  - The aggregate runner runs every suite with bounded timeouts and reports PASS, FAIL, SKIP or TIMEOUT.
  - The hiring concurrency test proves the winner's password works and the loser's does not.
  - The browser check waits for its text.
  - Screenshot paths are portable.
  - A bootstrap stub that hid the real invoice, client and contract columns from every test was removed.
- **F-33** Draft posts are not readable by slug. **F-35** Owners are protected from admins, nobody can
  deactivate themselves, and the last owner cannot be demoted. **F-36** Sign-in, invitation and
  proposal links are no longer stored in the database.

## 4. Verification

The clean-checkout run used commit `6ce1d1b`, exported with `git archive` into an empty folder with no
`.env.local`. Dependencies came from `npm ci`, and no Supabase variables were set.

| Step | Result |
|---|---|
| `npm ci` | passed |
| `vite build` | passed |
| `node scripts/verify_local_all.mjs`, 23 logic and schema suites with no database | 23 PASS |
| `node scripts/verify_sales_team_e2e.mjs`, 24 suites on a disposable database, including 2 browser suites | 24 PASS, 0 FAIL, 0 SKIP, 0 TIMEOUT; 1,212 checks |

Key suites from that run:

| Suite | Checks |
|---|---|
| Security personas: anonymous, applicant, representative, staff, other-org staff, owner | 90/90 |
| Production patch on a reproduced production-like broken state | 32/32 |
| Strict clean install from the manifest | 17/17 |
| Hiring, including the concurrency proof | 76/76 |
| Sales browser suite, including F5 | 49/49 |

The local test tooling in `.testenv/` (embedded PostgreSQL and the PostgREST binary) is set up per machine,
as described in docs/SALES_TEAM_INSTALLATION.md. It is not part of the repository.

An earlier clean-checkout run, before the final two commits, had two failures. The clean-install suite
hit a cold PostgREST start beyond 60 seconds, so the wait is now 120 seconds. The journeys suite ended
silently once and passed in 5 later runs. The cause was not identified. The runner now reports the exit
code and first error line if that happens again.

Commits on `repair/security-2026-09-30` (local only, not pushed):

| Commit | Content |
|---|---|
| `08a7eac` | Shared org-access and email helpers; public forms reply only to the submitter (F-04) |
| `2601f23` | Organization and role isolation (F-08, F-22 org binding, F-23, F-24, F-33, F-35) |
| `712e507` | Authoritative payments and server-built invoice email (F-03, F-04, F-05) |
| `26c8e58` | Private intake uploads, bound contract signatures, no stored sign-in links (F-16, F-26, F-36) |
| `cf1e92e` | Worker and scripts fail closed (F-21, F-28) |
| `cfc4d24` | Production patch, repair columns, strict clean install (F-02, F-17, F-18, F-34) |
| `0dfffdb` | Honest exit codes, bounded runner, persona security suite (F-27) |
| `5d2823d` | First version of this report and the credential/legacy plan |
| `06002b6` | LF line endings for every checkout, which the clean-checkout run required |
| `6ce1d1b` | Prompt runner reporting; longer PostgREST cold start |

## 5. Still open

- F-01: rotation not done (A6). F-02: patch prepared, not applied (A3). F-06, F-07: legacy services still live or unknown (A1, A2).
- F-11, F-12, F-13, F-14, F-15, F-19, F-20, F-25, F-29, F-30, F-31, F-32, F-37, F-39, F-40, F-41:
  outside this repair's scope. They are product, content or policy work.
- F-21 (second half): email sequences still never advance.
- F-22 (second half): self-approval policy (A7).
- The DNS-rebinding window in the public-page fetch remains a known, small risk.
