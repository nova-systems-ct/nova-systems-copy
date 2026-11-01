# Nova hosted readiness — 1 November 2026

## Follow-up: staging provisioning completed after owner authorization

This update supersedes the earlier migration approval blocker below. Isaac explicitly handed over setup authority while prohibiting spending.

- Applied 44 of the 46 canonical migration entries to `nova-staging`, plus one narrow application-function hardening migration. The two Crystal Clear entries were excluded because that company remains paused. Removed the Crystal Clear portfolio seed from the hierarchy migration; no Crystal tables or portfolio entity were created.
- Verified 195 public tables, all with RLS enabled. Created Nova Systems' organization and linked its portfolio entry; no owner Auth user or membership has been created yet.
- Restricted `claim_next_job` to `service_role`, verified `anon=false`, `authenticated=false`, `service_role=true`. Fixed the 11 function search-path warnings and removed anonymous execution of the three membership RPCs. Retained authenticated/service-role membership checks.
- Remaining advisor findings: 142 informational RLS-without-policy notices on server-managed tables; the `btree_gist` extension in public; three authenticated security-definer helper warnings. These are disclosed, not called a clean security audit. No policy was broadly opened to silence an advisor.
- Created six preview-only, `mvp/operational` branch variables in Vercel: `VITE_SUPABASE_URL`, the compatible public `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SALES_EMAIL_MODE=dry_run`, `WAVE1_SEND_ENABLED=false`, `NOVA_AI_PAID_CALLS=disabled`. No production environment values changed. No service-role secret was copied from production.
- Supabase Chrome sign-in was submitted through the secure authentication interface. It stopped at an hCaptcha human-verification challenge; sign-in is not confirmed. The browser is a separate cloud browser, not Isaac's physical laptop session.
- Added `scripts/testenv/verify_release_privileges.sql` for repeatable read-only checks against the installed database.
- Code changes remain on `codex/render-demo`; this branch's Vercel auto-deploy is disabled in `vercel.json` so a review push does not publish an incomplete setup. Other branch deployment settings are unchanged.

### Exact next handoff

1. Complete the human-verification challenge in this conversation's Chrome handoff. Do not paste credentials into chat.
2. Finish staging-only server credentials through a secure configuration flow. Create the required buckets through the Storage API/dashboard: private `nova-vault`, private `ops-private`, private `portfolios`, and public `portfolio` only for intended marketing assets. The older installation document omitted `ops-private`; current agreement/photo code requires it. Verify private bucket access restrictions before uploading anything.
3. Create the Nova application owner account for `isaac@nova-systems.app` using a secure invitation/account-setup flow, verify the identity, and attach its real Auth UUID to the Nova owner membership. Isaac enters any new password himself. No fabricated Auth database rows or shared temporary password.
4. Complete a dedicated preview session secret, cron secret and correct app base URL. Choose a commercially permitted hosting plan/provider without purchasing anything here. No 24/7 free worker is promised.
5. Rebuild staging only after configuration is complete; run the full owner/customer/worker/device gate below. The existing Vercel preview has not been rebuilt with the new settings and is not claimed ready.

No money was spent, provider calls enabled, real outreach sent, subscription changed, or production database modified.

Baseline inspected: `ae045c4` on `mvp/operational`. This review was performed in a separate Codex workspace, not on Isaac's Windows laptop. This document is also the handoff for the next coding session; no message was sent to Claude.

## Release decision

**Not ready for owner acceptance online.** A Vercel build being READY and `/login` returning HTTP 200 do not establish that authentication, database writes, research, PDFs or workers work online.

| Area | Evidence from this review | Remaining release requirement |
| --- | --- | --- |
| Code | Production build and lint succeed | Re-run after subsequent changes |
| Local verification | 29 suites pass; renderer suite skips because Chromium is unavailable | Install and launch the supported browser; run its network-isolation tests |
| Vercel preview | Existing preview for `ae045c4` serves `/login` with HTTP 200 | Add staging-only backend configuration, rebuild, then test authenticated flows |
| Supabase staging | `nova-staging`, `ubjnddxmdaxnbpzcmxnc`: only the first of 46 migrations applied; no owner account | Approved ordered migration, storage setup, owner identity and membership |
| Supabase production | Legacy `nova_system`, `xizmgruvuazmummotzkp`, inspected read-only | Separate migration/backup plan; do not target it during staging setup |
| Background work | Scheduled role and queue logic exists in code | A running worker host, correct staging target, heartbeat and restart tests |
| Browser/device testing | No browser installation in this workspace; browser download failed | Real browser journeys followed by Isaac's physical iPad check |
| Hosting cost | Owner's last instruction is a zero-budget setup, with Vercel downgraded to Hobby | Confirm a commercially permitted host/plan; no purchases or upgrades authorized here |

## Changes made in this review

1. Fixed the home greeting's placeholder-name match. A control character had replaced the intended regular-expression word boundary, so `Local Test Owner` could be greeted as `Local`. The helper now suppresses placeholder names and retains real first names; nine test cases cover this behavior.
2. Corrected local verification reporting. Missing Chromium now exits the renderer suite with code 3. The runner separates PASS, SKIP, FAIL and TIMEOUT and exits 3 when verification is incomplete. A regression test runs actual child processes, including the old exit-zero skip behavior. It failed before the fix and passed afterward.

These changes do not provision hosted accounts or enable outreach.

## Supabase approval boundary

Automatic approval review rejected applying `supabase/schema-update.sql` to staging because it contains broad persistent table, seed-data, backfill and access-policy changes. No alternate execution path was attempted. The remainder of the ordered migration sequence is not applied.

The concrete approval needed is: **Apply `supabase/schema-update.sql` and the remaining ordered migrations in `supabase/migration-manifest.json` to `nova-staging` (`ubjnddxmdaxnbpzcmxnc`) only.** The canonical manifest contains 46 entries; 45 remain after the base identity migration. Do not apply this sequence to the existing production database as if it were empty.

After approval:

1. Reconfirm staging project ID, current migration history and ordered manifest; stop on an unexpected schema difference or migration error.
2. Apply via the migration API in order. Record each successful version, and re-check tables, policies and advisors. Do not report “connected” after only writing environment variables.
3. Create/configure required private storage buckets with tenant-safe policies using the installation documentation.
4. Establish Isaac's application login for `isaac@nova-systems.app`, verify the email as required, and associate the verified Auth user UUID with Nova's owner membership. Supabase dashboard login and Nova app login are separate identities. Never infer ownership from a matching display name or client-editable metadata.
5. Set the password through a secure account setup flow; do not put passwords, service keys or signing private keys into chat, source control or client-side variables.

## Security observations

Staging advisors reported only three informational “RLS enabled, no policy” findings on the three empty base tables. This means normal client access is denied without policies; it is not evidence that those tables are publicly readable.

Production advisors reported:

- 42 tables with RLS enabled and no policies (informational; check intended access before changing).
- One trigger function, `nova_ai_audits_set_reference_number`, with a mutable search path. Prepare a narrow, reviewed search-path fix that qualifies its sequence name.
- Three security-definer membership/permission helpers executable by `anon`, and the same three executable by `authenticated`. Their definitions were inspected: they use `auth.uid()`, active membership checks and a fixed public search path. The warnings alone do not prove privilege escalation. Confirm policy dependencies and intended grants before revoking execution; indiscriminate revocation can break RLS.
- Leaked-password protection is disabled. Determine availability on the actual account plan and configure through the Auth settings if supported.

No production grants, functions or Auth settings were changed.

Advisor references:

- https://supabase.com/docs/guides/database/database-linter
- https://supabase.com/docs/guides/database/postgres/row-level-security

The deployed CSP still permits inline script and eval and allows browser connections to some provider APIs. Review actual browser dependencies before tightening it. Never place Anthropic, Resend or Supabase service-role secrets in `VITE_` variables. The local Windows firewall commands from `docs/LOCAL_STAGING.md` still require an administrator on Isaac's laptop; this workspace cannot verify or change that firewall.

## Product critique and acceptance target

Evaluate the product through customer value, execution reliability, economics and usability. Do not impersonate named entrepreneurs or claim they reviewed it.

- **Value:** Each audit must surface a specific observed problem, a source, a timestamp and a useful next action. Public evidence can demonstrate a broken booking path or compare published offers. It cannot establish exact lost revenue without the relevant operational records. Keep measured, inferred and unavailable information distinct.
- **Execution:** A module that registers a worker or creates a repair task is not necessarily an installed repair. Show prerequisites, actual changes, acceptance evidence and an undo/disable control. Do not label tasks created as problems resolved.
- **Economics:** Cost per research run, retry limits and spending approvals must remain visible. A clock displaying hundreds of hours is a deadline calculation, not proof of paid AI usage. Establish actual provider usage before attributing costs.
- **Usability:** Make the owner's primary path sign in → start five-detail audit → inspect evidence → draft report → generate PDF → reopen from Vault. Keep executive configuration and other setup away from that primary path. Every action card must open its relevant task or explain the missing prerequisite.
- **Real work:** The executive roles currently schedule/check/propose/escalate work. That is not yet an autonomous company, connected bank account, working social outreach adapter or printer integration.
- **Sweet Bella:** The first client acceptance slice should prove a real menu update on the existing TV hardware, a bilingual order saved once and printed through a verified compatible POS/printer integration, and an owner-approved menu. Do not promise that arbitrary printers or all social channels are already supported.

Preserve Nova's existing approved logo and black, white and gold palette (`#0A0A0A`, `#FAFAFA`, `#C9A84C`), with clear hierarchy and fewer competing actions. No visual redesign is claimed by this review.

## End-to-end gate before Isaac tests

Run against staging with outbound sending and paid AI disabled first:

1. **Owner:** sign in with the real owner identity; check correct name, business and role; sign out and sign back in.
2. **Audit:** five inputs, persistent save, refresh, interrupted research/retry, evidence provenance, identity confirmation, understandable unavailable-data states.
3. **Report:** generate draft PDF, inspect every rendered page, reopen the same saved version from the private Vault after a fresh session; test download on physical iPad.
4. **Customer:** correct private link, approved menu/pricing, inquiry → service → time → agreement; retries and double taps create one record. Keep payments and sending in test mode until specifically enabled.
5. **Worker:** enqueue a real isolated test job; verify one persisted result, pause/resume, retry limits, restart recovery and no duplicate execution. A schedule row alone is not a successful run.
6. **Security:** no-session denial, expired-session denial, cross-organization denial through both API and database/storage; validate private report links and browser-reader network protection.
7. **Devices:** phone 390px, iPad portrait/landscape, laptop 1440px and 1080p/4K display checks. Check keyboard, touch targets, focus, overflow, loading/empty/error states and PDF opening. Use a dedicated TV presentation/menu view rather than exposing the owner's private dashboard.
8. **Soak:** only after these pass, run the hosted worker and staged business flow for 24 hours with heartbeat, job history, error and cost monitoring. Report interruptions honestly.

The disposable PostgreSQL/PostgREST harness is not installed in this workspace. Its older migration list also lacks `ops-09-worker-capabilities-migration-standalone.sql`; repair and execute it before claiming its browser suite passed here. Do not change this list without exercising the resulting database and affected worker screens.

## Apple Wallet and Messages setup

Wallet loyalty passes and Apple Messages for Business are different integrations. The likely intended acronym “MSP” means Messaging Service Provider, not a Wallet certificate.

For standard Wallet loyalty passes with an active Apple Developer membership:

1. Open Certificates, Identifiers & Profiles → Identifiers → add a Pass Type ID (for example, an identifier chosen for Nova's loyalty pass).
2. Create a certificate signing request securely and retain its private key in the signing environment.
3. Under Certificates, create a Pass Type ID certificate, associate the identifier, upload the CSR, and download the issued certificate.
4. Configure server-side signing with the certificate, its matching private key and Apple's required intermediate certificate. Keep private keys out of the frontend and git.
5. Implement generation of the signed `.pkpass`, then verify installation on an actual iPhone and test updates/redemption against real saved loyalty data. A branded image is not a working pass. NFC/contactless loyalty has additional Apple requirements; a barcode pass does not establish NFC approval.

Official instructions: https://developer.apple.com/help/account/capabilities/create-wallet-identifiers-and-certificates/

Pass construction: https://developer.apple.com/documentation/walletpasses/building-a-pass

For Messages for Business, use Apple Business Register and the selected provider's documented onboarding. A Developer membership alone does not make Nova an approved MSP. No MSP application or Wallet certificate was created during this review.

Provider onboarding example: https://learn.microsoft.com/en-us/dynamics365/customer-service/administer/configure-apple-messages-for-business-channel

## Hosting and cost

The connected Vercel app works, but CLI login in this workspace was not confirmed: its token polling was blocked by network policy. Do not report the CLI as authenticated or attempt a network-policy bypass.

Vercel Hobby is restricted to personal, non-commercial use; Nova's business site needs a permitted plan/host. A free Render web service sleeping when idle is not a 24/7 background worker. Do not purchase an upgrade, promise free always-on service, or start live paid calls just to clear this gate.

- https://vercel.com/docs/limits/fair-use-guidelines
- https://render.com/docs/free

No production deployment, database migration beyond the earlier base migration, live outreach, paid provider call or subscription purchase was performed by this review.
