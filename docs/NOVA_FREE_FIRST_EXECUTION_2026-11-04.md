# Nova free-first execution — 4 November 2026

## Authority and scope

Isaac authorizes repairs, public website changes, role playbooks, supported integrations, free application preparation/submission and staging deployment. No purchases, charged registrations, paid model/phone/message calls or subscription upgrades. This supersedes the older public-site restriction. Applications may describe only implemented/tested capabilities. An account login, binding agreement, fee, unavailable permission or missing native binary is a named blocker, not a fabricated submission.

Starting source: `9ca4c4670efbc64b126c299676507107c525c1d9`, tree `b8ee7af6ad35be137144cf59d7416ed82ae9068f`. Working branch: `codex/free-first-completion-20261104`. The current pass has not merged production `main`.

## Implemented repairs

- **Audit lifecycle:** waived checks no longer prevent a scoped investigation finishing; the all-excluded report gate stays intact. Only the Nova owner can approve a report or publish/revoke delivery links. Drafts bind to the active finding revision, including withdrawal of an active finding. Rejected historical findings no longer prevent a fresh workspace draft from being approved. Failed finding reads block approval.
- **Evidence quality:** broken customer paths withdraw an unreviewed proposal after a positively observed repair. Reviewed wording is preserved; healthy → broken restores the current problem, unavailable becomes not rechecked, and fresh evidence is linked. Automated journey findings now participate in the explicit re-check action.
- **PDF/Vault/client:** client PDF uses the canonical black/white/gold renderer. Investigation coverage, exclusions and customer paths survive delivery, as do legacy tests, financial scenario inputs/results, software inventory and competitor evidence. Client web view uses a shared section registry. Content fingerprints/private approved-version link checks remain.
- **Installer:** unknown/failed email DNS checks remain blocked. A provision step says done only when its checks positively verify SPF and DMARC. Creating a tracked task does not claim a website defect is repaired.
- **Public requests:** chat captures all five answers in the right fields, validates email and prevents duplicate final taps. Contact/demo submissions save to Nova's real scoped inbox, with an in-app alert. The absent `demo_requests` table is no longer used. Email-disabled mode still retains actionable requests. The owner can mark read or manually replied; Nova does not claim a message was sent.
- **Login/navigation:** one actual staff/client sign-in, preserved safe destination/query/hash, guarded failure handling and an old Workforce URL redirect. Accessible, bounded public mobile navigation. The desktop sidebar's inline display override was removed and it collapses below 1024px rather than squeezing the workspace. Search Console setup button opens the integration center.
- **Finance:** invalid/future/stale balances and invalid money/policy values do not authorize spending. Available cash subtracts commitments and debits recorded since the balance. Monthly checks include commitments. A server-only organization lock rechecks approval atomically; owner UI cannot release the server spending lock. Recording an expense uses the same lock.
- **Provider cost guard:** default global spending lock blocks paid model/phone/email dispatch. One model reservation permits one attempt; ambiguous failures never retry under that reservation. Duplicate request IDs are refused atomically even across purposes. UTF-8 byte-based estimation replaces an English-character average. Incomplete/cache usage remains unknown and keeps conservative commitment. Sending flags stay off/dry-run on staging.
- **Work execution:** executive roles honor target-company and shared-worker stops, scoped/missing prerequisites and role/assignment identity. Blocked jobs resume the same task. HTTP and long workers share recurrence semantics and role/business/cadence identity. Startup does not multiply chains or let a pending manual one-shot suppress recurrence.

## Real role work and playbooks

Five code-backed roles: Isaac's decision assistant, executive assistant, COO, CFO and CMO. The new decision assistant reviews saved executive results; it does not impersonate Isaac or sign/spend/contact people. Every role saves its playbook version, measured result, evidence and model state. Executive desk shows playbooks, exact output source/date, bounded queued-job polling and review controls.

Optional model reasoning is implemented and **off by default**. Local downloaded/offline models can provide advisory text; remote/cloud models and paid fallback are refused. Hosted inference stays behind spending/price/budget gates and receives allowlisted counters/states, not raw balance/customer/task/memory prose. No live hosted or local model inference was used in this acceptance run.

Learning means owner-reviewed operational memory, not model weight training. A saved proposal can be promoted atomically into business/role-scoped, versioned, expiring memory. The latest eight lessons remain chronological; replaying an evicted source task does not promote it twice. Unreviewed suggestions cannot alter policy or execution permissions.

The CFO's handler produces and saves a capability cost/prerequisite/free-alternative report as actual work output. The register itself grants zero spending authority, preserves unknown prices and separates code, account activation, review and provider receipts. No fictitious thousands of employees were created.

Detailed contracts: `docs/NOVA_WORKER_OPERATING_PLAYBOOKS.md`.

## Public design

Home now presents four connected capabilities: Audit, Core (existing Agents), Harvest (existing Demand) and Revive. The page is shorter, uses black/white/gold, a clear public-first audit entry and fewer primary links. The existing owner-supplied hero video/logo remain. Unsupported popularity/experience promises were removed from relevant sales copy. Public contact and login support use `isaac@nova-systems.app` and the supplied business phone.

## Verification evidence

- Baseline before repairs: 45 local suites passed, one browser suite skipped.
- Current: **53 local suites pass with packaged Chromium enabled**, no skipped suite. Includes actual headless-browser source isolation (10 checks), role reasoning/privacy, spending, audit quality/re-check, navigation and schema checks.
- **43/43 audit delivery acceptance checks** on real isolated PostgreSQL/PostgREST and real API handlers: scope, permissions, evidence, scenarios, both report composition paths, owner approval, PDF, private client link and tamper/revoke/tenant denial. Auth/email are local stand-ins.
- **90/90 security persona checks** with real isolated PostgreSQL/PostgREST; external email is a local stand-in and Stripe is never contacted.
- **17/17 clean-install checks**; all 47 manifest files also reapply cleanly.
- Real isolated PostgreSQL concurrency tests pass: duplicate AI dispatch, simultaneous financial approvals, no-spend lock, debits, dates, tenant denial, service-only grants, ten memory promotions and evicted replay.
- Full local browser/API/database/queue acceptance passes: actual five-answer chat → owner inbox; deep login destination; all five role handlers; no duplicate output on replay; stop/dependency/role isolation; restart recurrence; CFO report; desktop, iPad portrait/landscape and phone layouts.
- Lint, production build and whitespace check pass. The expected local stand-ins never count as connected-provider acceptance. Screenshots were inspected; an actual iPad/iPhone remains an owner/device acceptance step.
- Read-only review found and corrected source-hash parity, returned path failures, legacy PDF omissions, recurrence duplication, company stop scope, learning ordering/replay, output/task mismatch, invisible public inquiries and responsive-sidebar defects. No named public figure or outside company endorsed/reviewed the work.

## Staging deployment checkpoint

Additive migration `supabase/migrations/20261104134533_nova_execution_safety.sql` applied successfully to staging project `ubjnddxmdaxnbpzcmxnc`. The four intended functions exist and authenticated/anonymous callers cannot execute financial approval or learning promotion directly. No business data was deleted or test data inserted into hosted staging.

Existing Render staging service: `nova-staging-demo`, `srv-dbjq50nlk1mc73a0cvb0`, free plan, `https://nova-staging-demo.onrender.com`, manual deployment from `codex/render-demo`. Explicit zero-spend, models-off and sends-off/dry-run flags were merged without replacing existing secrets. Code publication/deploy receipts and a fresh staged CFO run are the next verification step; do not infer them from the local checks above.

Security advisor context: 142 server-only tables intentionally have RLS without client policies. Three authenticated SECURITY DEFINER warnings refer to the intentional membership/permission/owner predicates (`has_permission`, `is_org_member`, `is_platform_owner`); do not blindly revoke them and break authorization. Existing `btree_gist` schema placement needs dependency-aware hygiene, and leaked-password protection is not enabled in the provider settings. No claim of a complete penetration test or legal certification is made.

## Incomplete capabilities / applications

No external application was submitted. Apple Developer was opened and showed its sign-in form; no credentials were entered. Existing Wallet signing material was not regenerated or exposed. Twilio registration can incur automatic fees and remains blocked under zero spending.

Prepared use cases, public contact details, sample operational messages, exact blockers, official provider references and channel coverage are in `docs/NOVA_FREE_FIRST_APPLICATION_PACKETS_2026-11-04.md`.

The following are **not** finished merely by adding credentials:

- Signed native iOS/Android builds and App Store/Play review; the responsive web app is the available mobile path.
- Social DM/comment-to-conversion implementations and provider approval across Meta/TikTok/LinkedIn; existing publishing adapters are not messaging agents.
- Apple Messages for Business / Android RCS live adapters and launch review.
- Automatic Apple pass updates/APNs and Google Wallet REST balance updates; current builders issue dated snapshots.
- General arbitrary-client one-click integration with every POS, printer, TV and legacy system; each needs its supported interface and physical acceptance.
- Unsupervised cold-email prospecting/sending, connected live voice, and live video production. No campaign was launched or person contacted.
- Continuous always-on free hosting, production-domain migration and connected-provider/device acceptance. A free preview can sleep; local tests are not a production SLA.

Ariova/the renamed marketing company, Crystal Clear and Aura remain separate; no new deployment, shared policy or commercial claim was made for them in this pass. This is a verified engineering release candidate, not a “90–95% of every promised product is complete” claim.
