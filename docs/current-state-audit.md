# Nova Systems — Current-State Audit

**Date:** 2026-09-20
**Scope:** `nova-systems-copy` repo (nova-systems.app, the canonical domain per the 2026-09-12
architecture reversal — see `project_nova_master_context_2026_09` memory). This audit reflects
work verified live through Stages 1–5 of a prior, narrower authorization sequence, plus a fresh
inspection specifically for this Phase 0.

**Verification key:** VERIFIED EXISTING (proved by code + a real test/live check this session) ·
REQUIRED (requested, not yet built) · PROPOSED (recommended, needs approval) · UNVERIFIED (claim
not yet checked).

---

## 1. Git / repository state

- **Repo:** `C:\Users\NVUBCrosbyUBMS07\nova-systems-copy`, pushed to
  `github.com/nova-systems-ct/nova-systems-copy` (main branch), deployed via Vercel.
- **Last commit:** `2026-08-03`, "Fix website content per audit: dead nav link, hero CTA, footer,
  FAQ copy." Everything from Stage 1 onward this session (auth rebuild, HQ shell, RBAC, Stage 5
  data plumbing) is **uncommitted working-tree changes**, not yet committed.
- **Unrelated pre-existing uncommitted changes** were already present in the working tree before
  this session's Stage 1 began (not introduced by this work). Inspected each this session:
  - `HeroSection.jsx`/`Home.jsx`/`Navbar.jsx`/`Footer.jsx`/`ConnecticutMap.jsx` — **the committed
    HEAD version has the approved cinematic video-led hero** (split diagonal panel,
    `video3.mp4`/`video4.mp4`, gold divider line, "NOVA SYSTEMS" eyebrow). **The uncommitted
    working-tree version replaces it with a static-image hero** ("Fix Revenue Leaks. Automate
    Systems. Scale Your Business." + `hero-visual.jpg`, no video) and simplified nav/footer. This
    directly matters for Phase 1 — see Decision D1 below.
  - `api/client.js` — small, unrelated fix: updates the Claude model string to `claude-sonnet-5`
    and fixes response parsing for its new `thinking`-block-first content shape. Safe, keep.
  - `vercel.json` — CSP `connect-src` allowlist adds `https://nova-wave-one.vercel.app` (supports
    `/welcome`'s current cross-origin POST there). Safe, keep, though see item 4 below.
  - `api/notify.js` — 147 lines removed, 6 added. Not yet read in depth this session — **UNVERIFIED**,
    flagged for Phase 1 review before assuming it's dead-code cleanup.
  - `.gitignore` — adds `.vercel`. Safe.
  - Deleted `src/pages/RequestAudit.jsx` (224 lines) — superseded by the `/request-audit → /welcome`
    redirect already in `App.jsx`. Safe.
  - New untracked files: several PNG/JPG assets, `src/components/home/{AuditCTA,HeroMetrics,
    ProcessSection,ServiceGrid,WaveOneFeature,WhyNovaSection}.jsx`, `scripts/qa-test-application.mjs`.
    Not yet individually reviewed — **UNVERIFIED**.
- **This session's own uncommitted work** (Stages 1–5, not yet committed): see §3–7.
- **No destructive git operations have been run.** Nothing has been reset, cleaned, or force-pushed.

**Decision D1 (blocks Phase 1 hero work only):** the master prompt asks to "recover the approved
older video-led design... in Git history." That design is sitting in HEAD right now — it wasn't
lost, it's just been superseded by uncommitted working-tree changes that move toward a simpler
static hero. Two paths: (a) discard the uncommitted hero/nav/footer/home changes and restore HEAD's
video hero as the recovery baseline, then apply the video quality/performance fixes Section 3
of the earlier master prompt already specified (poster frame, compression, reduced-motion, no
layout shift); or (b) treat the uncommitted static version as the more recent intentional direction
and NOT revert it. **Recommend (a)** — it's literally what "recover from Git history" means, and
the static version reads as an incomplete, abandoned in-progress edit (missing the trust-badge
row content, references a `HeroMetrics` component with no confirmed design intent). Not reverted
without confirmation — this discards uncommitted work, which needs an explicit yes.

---

## 2. Domain / brand architecture

- **Canonical:** `nova-systems.app`. **Decommissioning:** `nova-systems.agency` (`nova-wave-one`
  repo) — deployment retirement only, repo kept as reference. Confirmed by Isaac 2026-09-12,
  reversing an earlier (2026-07-31) plan that had it the other way around.
- **Brand colors:** public site keeps its existing black + `#D4A030` gold (confirmed intentional,
  not a bug — Isaac confirmed 2026-09-12). Navy `#04112B` + gold `#C9A84C` is scoped to the Nova
  HQ dashboard shell only (built Stage 3/4). The new master prompt's Section 3 restates the same
  navy/gold palette for "the approved direction" — **read as confirming the HQ-only scope already
  in place**, not requesting a public-site repaint; flagged as UNVERIFIED if Isaac means otherwise.
- **Mars Hill Apologetics** — separate Supabase project entirely, not part of this repo's data at
  all. The one legitimate named client example.

---

## 3. Authentication — VERIFIED EXISTING (Stage 2)

- Real Supabase `signInWithPassword` in `Login.jsx`, replacing a prior `.agency` hand-off.
- `useAuthGuard.js` (real `getSession()`/`onAuthStateChange`, no localStorage fallback), ported
  from `nova-wave-one`'s hardened pattern.
- `AuthCallback.jsx`/`ResetPassword.jsx` — real magic-link/password-recovery flow.
- `DashboardLayout.jsx`'s old `localStorage['nova_crm_auth']` bypass **removed entirely** — this
  was a real, confirmed vulnerability (any browser could set the flag and get in), fixed and
  regression-tested repeatedly (7 rounds of live/mocked verification across Stages 2–5).
- No service-role key in the client bundle — verified via `dist/` grep, every stage.
- **Still open:** Supabase Auth's Site URL/redirect allowlist in the dashboard (external config,
  can't verify from code) — UNVERIFIED, flagged every stage, never confirmed by Isaac.
- `ClientLogin.jsx` — honest "portal being rebuilt" state (Stage 2 decision: the old client-side
  password-hash check had no real session and nowhere to land; rebuilding it properly is bigger
  scope than a login page). Matches this prompt's Section 5 requirement for "client owner/client
  employee" identity — **REQUIRED, not yet built**, see §9.
- `/employee-dashboard`, `/applicant-login`, `SetPassword.jsx` (its own separate, also-insecure
  localStorage token scheme) — **UNVERIFIED/REQUIRED**, flagged every stage, never addressed.
  Directly relevant to this prompt's recruitment/Academy requirements (§9 below).

## 4. Nova HQ shell — VERIFIED EXISTING (Stage 3)

Six top-level areas: Overview, Intelligence, Growth, Execution, Companies, Admin — replacing a
flat ~11-item sidebar. Every existing working page preserved at its original route, nested under
its new parent area rather than deleted. Shell chrome (sidebar/topbar) uses navy/gold; the ~11
legacy subpages (Jobs, Invoices, Contracts, Referrals, Wave One, Nova Vault, Blog, Documents,
Newsletter, Portfolio, Intake Forms) kept their original black/gold styling — a deliberate scoping
decision to avoid an unrequested full re-theme.

## 5. Multi-company / RBAC — VERIFIED EXISTING (Stage 4/4.1)

- Real `organizations`/`organization_members` tables (originally created by `nova-wave-one`'s
  2026-08-12 migration, confirmed live via PostgREST OpenAPI introspection — not assumed from any
  repo's `schema.sql`, which has been proven wrong before).
- **Identity model (Isaac's explicit correction, 2026-09-13):** every real authenticated user is
  `member_type='staff'`; business relationship = role + organization membership, nothing else.
  No `org_user` type — that approach was proposed, then explicitly rejected and removed.
- `permissions`/`role_permissions` tables, ~16 permission keys, real per-organization RLS via an
  `is_org_member()`/`has_permission()` SECURITY DEFINER function pair.
- **Stage 4.1 fix:** `client_owner`/`client_admin` had `admin.view` (exposing Nova's own
  Invoices/Contracts/Nova Vault/Documents pages) — removed, along with every other
  not-yet-tenant-scoped permission grant those roles had. Verified live with real throwaway
  Supabase Auth users: `client_owner`/`client_admin` → `admin.view = false`;
  `nova_super_admin`/`nova_admin` → unaffected.
- **Real cross-tenant isolation test exists and passes**: `scripts/e2e_org_isolation_test.mjs`
  (permanent, not throwaway — creates + cleans up real throwaway orgs/users, currently 8/8).
- **Known accepted risk, not fixed, documented every stage:** `growth.view`/`intelligence.view`
  still gate some Nova-only, non-organization-scoped child pages (Referrals, Wave One, Blog,
  Portfolio, Newsletter under Growth; Intake Forms under Intelligence) — Isaac explicitly said not
  to remove these two permissions without a concrete security issue, distinguishing this from the
  `admin.view` finding. Must be resolved (via organization-scoping those child pages) before any
  real client organization exists.
- **Known accepted risk, inherited from `nova-wave-one`, not touched:** `organization_members`'s
  blanket "any staff row reads every org" policy — empirically tested (not assumed) to NOT leak in
  the current live state, but the underlying policy design still grants it; narrowing it needs
  coordinated testing with `nova-wave-one` since that app depends on the current behavior.

## 6. Real vs. fake data, page by page — VERIFIED EXISTING (Stage 5 audit + fixes)

A dedicated survey (this session) found `DashboardHome.jsx`/Overview was **100% localStorage-only
fake data** (`crmStore.js` — hardcoded fictional clients "Flow Barbershop"/"TRIO Upward Bound" and
leads "La Cazuela"/"Angelina's Pizza"/etc.). This was previously mischaracterized as real in an
earlier memory entry; corrected here. Full page-by-page finding:

| Page | Status | Note |
|---|---|---|
| `DashboardHome.jsx` (Overview) | **Fixed this session** | Rewritten on real `leads`/`intake_submissions`/`contracts`/`client_invoices`/`nova_tasks`/`referral_tracking` queries |
| `Newsletter.jsx` | **FAKE**, not fixed | 100% `crmStore`/localStorage; no real subscriber table exists |
| `Documents.jsx` | **FAKE**, not fixed | `crmStore` entity pickers + calls `api.anthropic.com` directly from the browser via `VITE_CLAUDE_API_KEY` — confirmed that var is never set (no live secret leak today), but a real dormant risk; a working server-side equivalent (`api/client.js`'s unused `resource=documents` handler) already exists and should be used instead |
| `Invoices.jsx` | **Real invoices, fake client names** | `client_invoices` table is real; client-name resolution uses fake `crmStore` |
| `Jobs.jsx`/`JobDetail.jsx` | **Real reads, fake writes** | Reads real `applications`; every status/note edit only persists to `localStorage`, invisible cross-device |
| `IntakeForms.jsx` | **Real but orphaned + mislabeled** | Top section reads real `intake_requests`, whose only writer (`api/book-meeting.js`) is called from nowhere in the current frontend; UI text incorrectly claims it's fed by `/welcome` |
| `Blog.jsx`, `Referrals.jsx`, `Contracts.jsx`, `NovaVault.jsx`, `Portfolio.jsx` | **Real, clean** | Fully wired to real tables, no issues found |
| `Leads.jsx`, `Tasks.jsx` | **New, real** (Stage 5) | Built this session directly on real `leads`/`nova_tasks` |

**`/welcome` currently cross-posts to `https://nova-wave-one.vercel.app/api/nova-audit`** — a
different Vercel project, on the domain being decommissioned. The only reason real `leads` rows
exist at all is that endpoint apparently also writes to the shared Supabase project. This is the
single highest-priority "form persistence" fragility in the whole system per this prompt's own
Section 4.4 and Section 20 requirements — **REQUIRED** to re-point locally.

**Real production data is genuinely sparse** (read actual row content, not just counts): the one
real `leads` row is Isaac's own test submission; the one real `contracts` row is literally named
"QA Test Client — DELETE ME"; `nova_crm_contacts`'s 3 rows are automated cold-scan artifacts from
`nova-wave-one`'s Voice/Audit engines with no real business info attached.
`intake_submissions`/`client_invoices`/`clients`/`meetings`/`nova_tasks`/`referral_tracking`/
`portfolio` are all empty (0 rows). `blog_posts` has 35 real rows. This is an honest green-field
state, not something to route around.

## 7. Public website content — VERIFIED EXISTING (Stage 1)

- Pricing rewritten from fake fixed tiers ($1,000/$1,500/Custom) to diagnosis-first, scope-based
  copy.
- Company/About page's "Fortune 500 technology... built for every business" claim removed.
- Careers' 4 revenue-share-only C-suite listings (CTO/COO/CPO/CFO) removed; the 3 real roles
  (Sales Rep, Content Creator, Lead Gen) this prompt's earlier version also called for were
  already present.
- **Legal pages** (`/terms`, `/privacy`, `/service-agreement`) — mature, non-duplicated, dated
  Jan 1 2026, share one `LegalPageLayout`. Not re-verified against this prompt's much larger
  legal-matrix requirements yet — see `docs/legal-and-policy-matrix.md`.
- **Nav** is already close to this prompt's Section 4.1 target (Home/Solutions/Pricing/
  Company/Careers/Insights/Portfolio/Welcome/Login) — not yet reconciled against the exact
  "How Nova Works / Business Diagnostic / Results / Insights / About / Contact / Careers / Login"
  structure requested here. **REQUIRED**: nav restructure + new `/how-nova-works`,
  `/business-diagnostic` pages don't exist yet.
- **Homepage copy** doesn't yet match this prompt's exact requested framing (evidence-based
  diagnostic-first positioning, "Investigate → Diagnose → Prioritize → Fix → Measure," diagnostic
  scope options). Current copy ("Fix Revenue Leaks. Automate Systems. Scale Your Business.") is
  the older Nova-Systems-as-full-service-agency framing this prompt explicitly wants replaced.
  **REQUIRED**, tied to Decision D1 above.

## 8. Systems described in this prompt that do not exist yet at all

Everything in Sections 6 (Recruitment/Academy learning content beyond the existing careers
listings), 9 (Voice/Call Agent), 10 in detail, 11 (Company 002/Crystal Clear), 12 (Zion Studio,
Nova social engine, SEO content pipeline beyond the existing working blog, Revenue Lab), 13
(Integration Center registry) is **REQUIRED, not started**. None of this is fabricated or
partially faked in the current codebase — it's simply not built. No dashboards, tables, or UI
exist for any of it. This audit does not invent status for systems that don't exist.

## 9. Recruitment/Academy — partial existing surface, large gap

- Real `applications` table exists (careers applicants), real read path in `Jobs.jsx` (see §6 for
  the write-path bug).
- No training-program content, quiz engine, certificate generation, or applicant learning
  dashboard exists. **REQUIRED**, ten full programs per Section 6 — substantial content-authoring
  + engineering effort, not started.
- No formal candidate lifecycle state machine beyond the raw `applications.status` field.

## 10. Testing infrastructure — VERIFIED EXISTING (established this session)

- Pattern: throwaway `playwright-core` (installed/removed with `--no-save`, never touches
  `package.json`/lockfile) for mocked-Supabase UI verification; permanent `scripts/e2e_*.mjs`
  files for real-database tenant-isolation/permission tests (create real throwaway Supabase Auth
  users + orgs, verify, clean up).
- No CI pipeline wiring found for these — they're run manually. **REQUIRED** if continuous
  verification is wanted (this prompt's Section 16 asks for automated coverage across many more
  categories than currently exist: RLS/db tests exist in the `e2e_*` scripts; unit,
  accessibility, performance-budget, and most security-category tests do not).

## 11. Infrastructure / hosting — UNVERIFIED against this prompt's Section 4 requirements

Current deployment is standard Vercel serverless functions (`api/*.js`) — no durable queue,
background-job runner, or long-running audio-session infrastructure exists. This prompt's Section
4 (hosted runtime, durable queues, monitoring, backups/DR, cost controls) describes requirements
for future systems (voice agent, Zion content pipeline) that don't exist yet — **PROPOSED**,
correctly scoped to when those systems are actually built, not urgent now.

---

## Summary: what's real right now

A secure, tested, real-data-backed foundation exists for: authentication, multi-tenant
organization/role/permission architecture with RLS, a coherent six-area HQ shell, and a genuine
(if sparse) leads/intake/tasks/revenue data layer. The public website has had a first honesty pass
(pricing, careers, about copy) but not the deeper positioning/navigation rework this prompt
describes. Recruitment has a real applicant table with a write-path bug. Everything else in this
prompt's very large scope — Academy, voice agent, Company 002, Zion Studio, Revenue Lab,
Integration Center — has zero implementation today.
