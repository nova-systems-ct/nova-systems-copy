# Nova Systems — Product Requirements Traceability

**Date:** 2026-09-20. Maps the "Nova Systems — Claude Code Master Build Prompt" (and its "Final
Addendum," which was pasted truncated — see note at the end) to current status. Labels:
**VERIFIED EXISTING** / **REQUIRED** / **PROPOSED** / **UNVERIFIED**, per the prompt's own scheme.

| # | Section | Status | Note |
|---|---|---|---|
| 1 | Mission/product definition | VERIFIED EXISTING (partial) | Diagnosis-first positioning exists in Stage 1's pricing/about copy; homepage hero still reads as a full-service agency, not diagnostic-first. See audit §7, Decision D1. |
| 2.1 | Repository/deployment discovery | VERIFIED EXISTING | This document set + `current-state-audit.md` is that discovery, built from real verification across Stages 1–5 plus fresh Phase 0 checks, not re-derived from scratch. |
| 2.2 | Execution behavior (small slices, reuse, org-scoping, RLS, feature flags, no secrets, tests, status docs) | VERIFIED EXISTING | This is exactly the discipline Stages 1–5 followed: additive migrations, live-verified before/after, real e2e tests, no committed secrets, honest PARTIAL statuses reported when something couldn't be verified. |
| 3 | Brand/visual system (navy/gold tokens, hero video quality, accessibility) | VERIFIED EXISTING (HQ) / REQUIRED (public site polish) | Navy/gold confirmed scoped to HQ only (Isaac, 2026-09-12). Public site keeps black/gold. Semantic design tokens don't exist yet (colors are per-file constants) — REQUIRED if wanted. Hero video recovery is Decision D1. |
| 4.1–4.4 | Public website structure, homepage sequence, required pages, forms | PARTIAL | Nav/pages exist but don't match this prompt's exact structure (`/how-nova-works`, `/business-diagnostic` don't exist). `/welcome` works but cross-posts off-domain (audit §6). `/intake` is real and working. |
| 5 | Auth, tenancy, authorization | VERIFIED EXISTING | Stages 2 and 4/4.1, live-tested repeatedly. Client-owner/employee experience not fully built (`ClientLogin.jsx` is an honest placeholder). |
| 6 | Recruitment / Sales Academy | PARTIAL | Real `applications` table + read path exist (with a write-path bug). Ten training programs, quiz engine, certificates: REQUIRED, not started — substantial scope. |
| 7 | Nova Command Center / workspaces | PARTIAL | Six-hub HQ shell exists and matches this prompt's structure closely (Overview/Intelligence/Growth/Execution/Companies/Admin). Role-specific employee workspaces beyond the permission-gated nav: REQUIRED, not built. Commission support: REQUIRED. |
| 8 | Nova Audit / Business Diagnostic engine | REQUIRED, not started | No diagnostic case/evidence/finding domain model exists. `Leads`/`Tasks` (Stage 5) are adjacent but not this. |
| 9 | Agent framework / Approval Inbox | REQUIRED, not started | Nothing built. |
| 10 | 24/7 Voice/Call Agent | REQUIRED, not started | Twilio/Deepgram/ElevenLabs env vars exist (names only, confirmed unset/unused) but no call-handling code exists in this repo. |
| 11 | Company 002 (Crystal Clear successor) | REQUIRED, not started | No naming-decision workflow, no separate site, no workspace. |
| 12 | Growth Engine / Zion Studio / SEO / Revenue Lab | PARTIAL | `blog_posts` (35 real rows) is a genuinely working, clean CMS — the SEO/Insights foundation exists. Zion Studio, social engine, Revenue Lab: REQUIRED, not started. |
| 13 | Integration Center | REQUIRED, not started | No registry exists. Individual point integrations (Stripe partially, Resend, Anthropic server-side) exist ad hoc, not through a unified registry with status/health tracking. |
| 14 | Data architecture | VERIFIED EXISTING (foundation) | See `data-model.md`. Identity/tenancy + Stage 5's real operating tables exist. Recruitment/Academy, Diagnostics, Execution-beyond-tasks, Communications, Company 002, Content, Revenue, Platform (agents/policies/integrations) domains: REQUIRED. |
| 15 | Legal/privacy/safety/truthful claims | PARTIAL | See `legal-and-policy-matrix.md`. |
| 16 | Testing and release gates | PARTIAL | See `test-and-release-plan.md`. |
| 17 | Phased delivery order (Phase 0–10) | Phase 0 in progress (this document set) | Phases 1–10 not started under this prompt's numbering. Note: Stages 1–5 from an earlier, narrower authorization sequence already cover real ground that overlaps Phases 1–4 (auth, HQ shell, RBAC, some real data) — don't re-do it, extend it. |
| 18 | Required deliverables (docs list) | This document set | `agent-governance.md`/`voice-agent-spec.md` are stubs (nothing built yet to document in detail) rather than fabricated design documents. |
| 19 | Definition of success | Aspirational, tracked via the above | Most bullets require systems not yet built (diagnostic linking claims to evidence, agent permission logs, call-agent fallback, external service status display). Auth/tenancy/RLS bullets are already true today. |

## Addendum sections (truncated — only what was actually received)

| # | Section | Status | Note |
|---|---|---|---|
| 1 | Requirements traceability checklist | This table | |
| 2 | Exact website copy and assets | REQUIRED, not started | No visitor-facing copy draft exists beyond what's already live. Asset inventory (approved logos/videos/rights) not compiled. |
| 3 | Decision/owner-setup register | Started | See `implementation-status.md` "Blocked — needs Isaac" — should be consolidated into a dedicated register as this grows. |
| 4 | Hosted runtime / durable queues / monitoring / backups | PROPOSED, correctly deferred | Not needed until voice agent / Zion pipeline are actually built (`architecture.md` §11 note). |
| 5 | Environment separation | PARTIAL | `.env.local` holds live production credentials (confirmed, documented in earlier project memory) — no dev/staging separation exists. REQUIRED if wanted, real infra work. |
| 6 | Backups/DR | UNVERIFIED | Supabase's own backup posture not independently checked this session. |
| 7 | Monitoring/human ownership | REQUIRED, not started | No alerting/on-call system exists. |
| 8 | Cost controls | REQUIRED, not started | No usage/cost tracking exists (nothing to track yet — no agents running). |
| 9 | Onboarding/offboarding | PARTIAL | `clients` table + Stage 5 scoping exist; no formal workflow. |
| 10 | Financial/contract record integrity | PARTIAL | `client_invoices`/`contracts` tables exist, real but sparse; no payment-status verification workflow beyond what Stripe's own dashboard provides. |
| 11 | Notification delivery/preferences | REQUIRED, not started | No notification center exists. |
| 12+ | (message was truncated mid-section 12, "Consistent states and duplicate prevention") | **UNKNOWN** | I do not have the rest of the addendum. If there's more content beyond section 12, I haven't seen it — ask Isaac to re-paste the remainder if it should inform Phase 0/1 work. |

## How to use this document

Re-run this mapping whenever a phase completes — flip statuses forward, never silently. If a
status looks stale (this document ages the same way `schema.sql` did), re-verify against the
actual repo/live system rather than trusting the table.
