# Nova staging handoff — 1 November 2026

## Current result

A free hosted testing preview is live at https://nova-staging-demo.onrender.com/login . It is not production and is not fully accepted end to end. The production domain and production database are unchanged.

- Source branch: `codex/render-demo`; draft review: https://github.com/nova-systems-ct/nova-systems-copy/pull/1 .
- Render service: `nova-staging-demo`, `srv-dbjq50nlk1mc73a0cvb0`, Virginia, compute plan **free**, one instance, automatic deploys off.
- Workspace: the owner's only Render workspace, `My Workspace`, `tea-d95q6c8k1i2s73ag79kg`.
- Staging Supabase: `nova-staging`, `ubjnddxmdaxnbpzcmxnc`.
- Production Supabase `xizmgruvuazmummotzkp` was not modified.

## Completed and checked

### Database and access

44 of the 46 canonical migration entries are applied, plus a narrow application-function hardening migration (45 history entries). The two Crystal Clear migrations and its portfolio seed remain excluded because that company is paused.

All 195 public tables have RLS enabled. `claim_next_job` is executable by `service_role`, not by `anon` or `authenticated`. Eleven application-function search paths are fixed. Anonymous access to the membership RPCs is revoked; signed-in membership checks remain available. `scripts/testenv/verify_release_privileges.sql` passed against staging.

Remaining advisor findings are disclosed: 142 informational server-managed tables with RLS but no policy; `btree_gist` in public; three authenticated security-definer membership helpers. These are not a clean security audit. No broad policy was added to silence a warning.

The Nova Systems organization exists. `isaac_0427@icloud.com` has an Auth record (owner-selected sign-in email; business contact remains isaac@nova-systems.app) and its real UUID is linked to Nova's `nova_super_admin` membership. The owner has now completed activation and password setup; Auth reports a confirmed email and a successful sign-in. No password or invitation token is in this document or git.

A synthetic release-QA Auth account was created for testing. Automated review rejected granting it a global administrator membership. No membership was granted, and that QA account was subsequently disabled. Do not enable it or grant it broad access to bypass this boundary; use the owner's approved account or request a specifically scoped test role.

### Storage

Created and read back through the Storage API:

| Bucket | Public | File limit |
| --- | --- | --- |
| nova-vault | false | 10 MiB |
| ops-private | false | 10 MiB |
| portfolios | false | 5 MiB |

A synthetic non-customer storage check uploaded successfully with the server credential; the public read URL was refused. The public marketing `portfolio` bucket was not created. Do not make client documents public.

### Hosting

Vercel's `mvp/operational` preview branch has staging frontend and server configuration, including a server-only service credential. Production variables were not changed. Vercel browser passkey sign-in was not confirmed, but the authenticated connector successfully saved the configuration.

The free Render preview runs the same built Vite frontend and existing API handlers through `scripts/hosting/server.mjs`. The adapter limits request bodies, preserves raw webhook bytes, parses JSON/form bodies, blocks internal helper routes and private files, applies security headers and excludes the preview from search indexing. Its tests cover encoded asset names such as the Nova logo. `APP_BASE_URL` uses Render's documented service URL at startup.

Render and Vercel preview settings keep paid AI, email, SMS and sequence sending off. Provider keys for charging, phone and outbound email were not copied into Render. The configured session and cron secrets are staging-specific.

Supabase Auth's site URL is the Render staging origin. Its redirect allowlist contains only the staging callback and the two configured reset/dashboard query variants. No arbitrary external redirect wildcard was added.

### Product and documents

- Corrected the owner greeting's placeholder-name bug.
- Corrected the verifier so skipped browser tests cannot be reported as passing.
- Revised Privacy, Terms and Cookie Policy to match actual collection, provider use, browser sessions/drafts and consent behavior. The optional inquiry checkbox explicitly covers marketing email. Removed blanket form-submission consent to promotional calls/texts and unverified default fees.
- Improved legal-page typography, narrow-screen header layout, keyboard focus and printing. These pages are visually checked at the cloud browser's current size, not every device size.
- Notices can reduce ambiguity; they do not guarantee immunity from lawsuits. Engagement-specific terms, actual retention procedures, permitted marketing and any recording workflow still need appropriate legal review before activation. Do not claim statutory compliance merely because a policy page exists.

## Verification evidence and limits

- Build and lint pass.
- 30 local suites pass; one renderer suite is skipped. A Chromium package was obtained but its process crashes in this container. Its temporary Playwright-path links were removed; no passing browser-security result is claimed.
- Node host adapter: 11 checks pass, including encoded image filenames (the first hosted visual inspection exposed and reproduced that defect before the fix).
- Hosted `/healthz`, `/login`, `/privacy` and `/terms` respond 200. Deployment `dep-dbjrq849v7es73avlto0` of `4d5b089` is live; the logo loads with a nonzero natural width (256 px). Screenshot: `docs/qa/hosted-login-2026-11-01.jpg`.
- Unauthenticated audit API responds 401; `/api/_auth` and `/.env` respond 404.
- A hosted page responding 200 is not proof of the authenticated audit/PDF/worker journey.

## Owner's immediate handoff

1. Owner activation and fresh hosted sign-in are verified. Use isaac_0427@icloud.com with the password you selected; this app account is separate from the Supabase dashboard account. Do not put passwords or one-time links in chat.
2. The existing audit now has saved details, sourced evidence, draft report v1 and a private PDF visible in the Vault after reload. Report approval, physical-device PDF opening, client-role isolation and sign-out/reopen acceptance remain pending.
3. Verify on the physical iPad, including keyboard, touch, PDF opening and hotspot access.

## Remaining engineering/provider work

- Run authenticated owner, client and organization-isolation tests against staging after account activation; add a narrowly scoped test persona only with approved permissions.
- Finish demo-workspace setup and actual queued-worker acceptance. No continuously running worker has been deployed by this change. A queue or a schedule record is not a worker run.
- Free Render web services sleep after 15 minutes without inbound traffic, may take about a minute to wake and have monthly quotas. They are for testing, not a 24/7 production promise. Included build/bandwidth usage may incur overage charges where a payment method exists; verify workspace billing caps before broader/public promotion. No paid compute plan or upgrade was selected.
- Public-first audit research must distinguish observed, inferred and not checked. Public sources cannot establish exact lost revenue without relevant operating data.
- Apple Wallet signing is **not implemented**: `walletReadiness()` explicitly returns false. The owner needs the Pass Type ID, signing certificate/private key and Apple intermediate certificate in secure server configuration, then actual signing/update/redemption implementation and a physical iPhone test. Developer membership alone is insufficient to claim a functioning pass.
- Apple Messages for Business is separate from Wallet. MSP/provider onboarding and business approval are not complete. No Apple submission or paid provider purchase was made.
- Social, telephony/printer and video integrations are not live merely because adapter code exists. Sweet Bella requires its actual TV/POS/printer models, menu approval and provider acceptance tests.
- Full dashboard redesign, TV presentation view and all-device visual review are not complete.
- Production rollout, production migrations and a 24-hour soak test remain undone.

## References

- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://render.com/docs/free
- https://vercel.com/docs/limits/fair-use-guidelines
- https://developer.apple.com/help/account/capabilities/create-wallet-identifiers-and-certificates/
- https://developer.apple.com/documentation/walletpasses/creating-a-store-card-pass
- https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- https://portal.ct.gov/ag/sections/privacy/the-connecticut-data-privacy-act

No money was intentionally spent, no paid provider calls enabled, no customer outreach sent, and nothing was deployed to the production domain.

## Account setup follow-up — 1 November, evening

- Confirmed through staging Auth that Isaac's app identity has no password, no confirmed email and no prior sign-in. This is separate from his Supabase dashboard login.
- Tried the supported Admin invitation email to the owner only; Auth returned HTTP 400 `email_address_invalid`. Auth logs confirm rejection. No successful email delivery is claimed. Public DNS does publish a Google MX for nova-systems.app; that does not prove the mailbox exists or establish the rejection's cause. Do not repeatedly resend or disable confirmation to get around this.
- Fixed invitation routing into password setup, prevented reset-page redirect loops, and hid the password form when no session exists. Added seven routing checks, including recovery and hostile external destinations.
- Sign-in now trims the email (never the password), distinguishes unconfirmed setup from invalid credentials, and recovers its controls after network errors. Password-reset requests show a busy state.
- Login, legal and password-setup screens share approved Nova logo artwork; the placeholder letter N is removed. Full dashboard design review remains incomplete.
- Apple CSR and a truthful registration preparation record are in `docs/apple/`. Nothing was submitted to Apple; its Developer portal requires sign-in. Do not upload the CSR before securing its private key. Android/Apple channel implementations remain incomplete.

Owner selected isaac_0427@icloud.com for app access. Auth Admin updated the existing UUID without confirming its email, then accepted the invitation-send request. Membership remains attached to the original UUID; delivery and activation still need verification. No new password was generated or printed.

Deployment `dep-dbjsr37lk1mc73a748s0`, source `511d943`, is live. Verified the signed-out `/reset-password` page shows the invitation requirement, no password fields, and a successfully loaded Nova logo. Screenshot: `docs/qa/password-setup-guard-2026-11-01.jpg`. Build and lint pass; 31 local suites pass and one renderer suite remains skipped. Authenticated acceptance is still blocked on owner activation.

Apple sign-in advanced through password entry to two-factor verification, but Apple rejected the supplied code. No successful Developer dashboard access or Apple submission is claimed. The owner handoff is on that verification screen; request a fresh code there.

## Hosted owner acceptance — evening follow-up

The owner activated isaac_0427@icloud.com and set a password. Auth confirms verified email, a password and a sign-in. A fresh secure browser sign-in reached the protected owner workspace with the expected owner role and Isaac greeting.

Using the existing Nova case `ba992b1a-eb9d-49a0-be95-12f2e46bd37f` (not a duplicate): saved the owner's stated goal; drafted report v1 from real saved research; generated and stored its draft PDF; reloaded and verified the details/report/PDF remained. Nova Vault lists the same private document `e74cfe09-1c76-4936-95ce-f101956f0185`, 56,856 bytes, v1 draft. A server-side download from private storage matches its recorded size and parses as five PDF pages. No report was approved or sent.

The browser download event returned a path whose file did not exist; its blob PDF preview is blocked by the cloud browser URL policy. Do not bypass this restriction or claim browser/iPad PDF opening passed. The private-storage download and offline rendering are separate evidence. Visual spacing looked questionable in the local render, but operator inspection showed correct zero body tracking; the initial spacing-leak diagnosis was wrong and no rendering fix was made. Added a PDF-operator regression check (four checks) to protect that behavior. Visual acceptance remains pending.

Three public research runs already existed before this acceptance: 42 historical evidence records, 2 proposed DNS findings; report selection uses the latest run plus cited older evidence (16 records), rather than counting all historical records as new proof. JavaScript rendering is unavailable on the host; competitor discovery is unavailable for the entered industry. No paid research was enabled.

Apple owner access and membership are verified; Nova Rewards Pass Type ID registered. Certificate issuance remains pending. Automatic review rejected transferring the encrypted CSR private key plus password to Render without specific authorization; no transfer occurred. See docs/apple/NOVA_APPLE_ACTIVATION.md for the exact approval boundary.

Final checks in this follow-up: 32 local suites pass and one renderer suite is skipped. Unauthenticated audit-PDF and Vault requests return 401; a public read of the actual saved report object is refused. No report/client links were published, no external campaign sent and no paid provider enabled.

## Current handoff — owner requested pause for Gemini review

The owner explicitly authorized storing the encrypted Apple CSR private key and its password on Render's nova-staging-demo service. The two server environment variables were merged successfully; existing settings were preserved. No secret values are in this checkpoint or git. No certificate was issued.

Isaac reports that dashboard functions remain broken, audit findings are insufficient, and the PDF looks acceptable but is not compelling enough to a buyer. Successful login/persistence/PDF generation must not be described as a complete or sellable audit. Hosted research currently lacks JavaScript rendering, broader business-listing sources and competitor coverage for the entered industry. Two DNS findings do not establish a compelling diagnosis of lost customers or revenue.

Stop additional changes and Apple submissions here. Await the owner's Gemini response, explain it in plain English, distinguish observed defects from unsupported criticism, and use verified code/research evidence to prioritize a useful, sellable audit. Do not invent Gemini's feedback before receiving it. Paid calls, paid plans and outbound campaigns remain off.
