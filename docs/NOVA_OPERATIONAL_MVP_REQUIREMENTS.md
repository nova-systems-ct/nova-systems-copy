# Nova Operational MVP — requirements checklist

Source: "MASTER EXECUTION PROMPT — NOVA SYSTEMS OPERATIONAL MVP" (Isaac Nova, 2026-10-11).
Working copy: `C:\Users\NVUBCrosbyUBMS07\nova-mvp-work` (local Git, no remote). Status words:
**locally verified** (real local PostgreSQL + real handlers/worker/browser, providers are stand-ins) ·
**blocked** (needs an owner action or provider account) · **not built**.
Nothing here is staging- or production-verified.

| # | Requirement | Implementation | Verification | Status | Remaining prerequisite |
|---|---|---|---|---|---|
| §4 | Inspect repo, reuse map, missing files | Reuse map in `NOVA_OPERATIONAL_MVP_BUILD_STATE.md` | clean-install test, clean-checkout build | locally verified | — |
| §6 | Supabase Auth sign-in/out, session refresh | `Login.jsx`, `useAuthGuard`, auth stand-in refresh route | `e2e_ops_browser_test` (deep link → login; sign-out blocks dashboard) | locally verified | Real Supabase Auth URL/redirect settings (owner action 4) |
| §6 | Password recovery, single-use links | `AuthCallback.jsx` + `supabaseClient.authRedirect` (fixed: recovery link used to sign in without a password change) | browser: recovery → set password → new password works; reused link refused | locally verified | Supabase redirect URL allow-list |
| §6 | No dashboard by URL, no localStorage/metadata role bypass | `useAuthGuard`, server `requireStaff`/`has_permission`; dead fake-data CRM store removed | browser + `e2e_security_personas_test` | locally verified | — |
| §6 | Roles: owner, operator, sales, client owner/staff, customer link | `ops.view/manage/configure` permissions; customer token pages | `e2e_ops_core_journey_test` isolation section | locally verified | — |
| §6 | Tenant scope on every record; jobs recheck at execution | `organization_id` on all ops tables; every handler filters by org; worker re-reads live state | core/harvest/sentry tests | locally verified | — |
| §6 | Private files via short-lived links | signed PDF stored in private bucket `ops-private`, 5-minute links | core test (PDF via 5-min link) | locally verified | Create private bucket `ops-private` (owner action 3) |
| §6 | SSRF-safe public fetch | existing `_auditResearch.js` (reused) | `unit_audit_rules_test` | locally verified | — |
| §7 | Audit intake, reviewer, deadline terms | `audit-02` migration, `api/_auditExtra.js` intake | `e2e_audit_report_delivery_test` | locally verified | Apply migrations |
| §7 | Owner-approved 48–72h clock policy before clock start | `validateClockPolicy`, mark-ready gate | audit tests | locally verified | — |
| §7 | Active tests only with written permission; no fake urgent identities; no repeated/competitor contact; closed-hours not scored | `checkTestEntry`, `interpretTest` | audit acceptance test | locally verified | — |
| §7 | ≤3 competitors with rationale and evidence kind | `audit_competitors` | audit acceptance test | locally verified | — |
| §7 | Software review from owner data only, no auto-cancel | `audit_software_items` | audit acceptance test | locally verified | — |
| §7 | Financial scenarios with labeled sources, no double counting, gross vs contribution, "verified" only from records | `computeScenario`, `totalScenarios` | audit acceptance test | locally verified | — |
| §7 | Findings: period, impact, financial status, limitations, implementability, owner decision | `audit_findings` columns + approval gate | `unit_audit_rules_test`, audit tests | locally verified | — |
| §7 | Report: summary, appendix, prioritized recommendation; PDF of exact approved version; changes invalidate approval | `compose`, `renderReportPdf`, hash checks | audit acceptance + browser | locally verified | — |
| §7 | Secure client delivery; states generated → approved → available → notified → confirmed | `publish`/`report-view`, delivery columns | audit acceptance + browser (client page on phone) | locally verified | Email notification of the link is manual (no automatic send) |
| §8 | Inquiry via SMS and web form, persisted, deduplicated | wave1 handlers + `ops_conversation_turn` job | core test | locally verified | Twilio number + webhooks (owner action 6) |
| §8 | Inquiry via voice (real AI receptionist on Twilio Voice) | `api/_ops/voice.js` (`<Gather>` speech/keypad, disclosure, consent to text link, transfer) | `e2e_ops_sentry_voice_test` | locally verified · **blocked live** | Twilio Voice number, webhook URL, owner-approved disclosure |
| §8 | Manual takeover/reply pauses automation | `conversation-reply`, takeover flag | browser + core | locally verified | — |
| §8 | Model only for bounded extraction; no prices/discounts/availability/payment claims; injection-safe | `api/_ops/model.js` (allowlist, timeout, cap), `rules.decide` | unit + core (injection, discount) | locally verified | `ANTHROPIC_API_KEY` + `OPS_MODEL_ENABLED` (optional) |
| §8 | Approved, versioned pricing; unknown scope → owner quote; terms snapshotted | `ops_price_rules`, `computeQuote`, `owner-quote` | unit + core | locally verified | Owner-approved real prices (owner action 9) |
| §8 | One calendar: availability, timezone/DST, duration, buffers, holds, expiry, conflicts, no double booking | Nova calendar + DB exclusion constraint; Cal.com adapter for provider-confirmed booking | unit + core (simultaneous hold → one wins) | locally verified (Nova calendar) · Cal.com **blocked** | Cal.com API key + event types, if chosen |
| §8 | Versioned agreement, e-sign consent, hash binding, signed copy, re-sign on change | `ops_agreements`, `customerSign` | core + browser | locally verified | Attorney review of agreement text (owner action 10) |
| §8 | Stripe-hosted deposit, server amount, idempotency, verified webhook, duplicates, refunds; live disabled | `customerDepositCheckout`, `applyOpsStripeEvent` | core + browser | locally verified · **blocked live** | Stripe test keys + webhook secret on staging; funds-recipient decision |
| §8 | Latency measured, not promised | `trigger_at`/`submitted_at` on messages | core test measures first response | locally verified (local only) | Real-provider measurement on staging |
| §9 | Missed call → one consent-checked follow-up; answered calls skipped | wave1 (reused) + ops engine continuation | harvest test | locally verified | Messaging registration (A2P) |
| §9 | Reactivation: import preview, consent-only, owner approval, spacing, budget, STOP after enqueue, reply/booking/active-request stops | `api/_ops/harvest.js` | harvest test | locally verified | — |
| §9 | Neutral review request to all; referral independent; codes credited once | `sendFollowup`, `ops_referrals` | core test | locally verified | Review URL, approved referral terms |
| §10 | Monitoring: heartbeat, queue delay, dead letters, delivery failures, payment backlog, config, model | `api/_ops/sentry.js`, worker heartbeat | sentry test | locally verified | Worker deployment (owner action 7) |
| §10 | Incidents: dedupe, paced alerts, acknowledge/resolve with evidence | `ops_incidents`, `alertDue` | sentry test | locally verified | `OPS_ALERT_EMAIL` + Resend |
| §10 | Sunday 18:00 local scoreboard, DST-correct, immutable, reconciled, honest attribution/ROI | `api/_ops/reports.js`, `buildScoreboard` | unit + core + sentry tests | locally verified | Owner opt-in number; attribution method if wanted |
| §11 | Durable queue: atomic claims, leases + renewal, crash recovery, backoff, dead letter, idempotency, kill switch | existing queue + lease renewal + `OPS_KILL_SWITCH` | sentry test (crash → re-run, no duplicate) | locally verified | — |
| §12 | Separate state machines + transition log | `MACHINES`, `ops_transitions` | unit + browser timeline | locally verified | — |
| §12 | Install from empty DB; upgrade path | `migration-manifest.json`; production patch | `e2e_clean_install_test`, `e2e_production_patch_test` | locally verified | Staging copy of production schema for upgrade test |
| §13 | Owner, client and sales screens with real actions | `src/pages/dashboard/ops/*`, audit tabs, existing Sales Team | `e2e_ops_browser_test` (desktop + phone) | locally verified | — |
| §14 | Website: four pillars, availability, human escalation, data practices, no invented claims | `FourPillarsSection`, `AvailabilitySection`, `Home.jsx`, login copy | build + review | built (not deployed) | Owner review; legal review of privacy text |
| §15 | No fake data in production screens | test business flag, TEST badges, dead fake CRM removed | browser | locally verified | — |
| §16 | Acceptance A–E | see `NOVA_OPERATIONAL_MVP_ACCEPTANCE.md` | — | locally verified (with stand-ins) | Staging verification |
| §17 | Clean checkout, build, lint, regressions, browser, secrets scan | see acceptance doc | — | locally verified | — |
| §18 | Installation sequence + readiness matrix | `NOVA_OPERATIONAL_MVP_INSTALLATION.md`, `..._READINESS.md` | — | prepared | Owner approvals |
| §19 | Business cards + six-panel brochure proofs | `collateral/` (HTML source, review + print-layout PDFs, `PREPRINT_CHECKLIST.md`) | rendered and visually checked | proofs prepared, not printed | Confirm title/phone/email/QR destination; vector logo; printer specs |
| §20 | Prospect lists A–D | `prospects/` (XLSX + 4 CRM CSVs, playbook, source notes) | source URLs per row; CSVs pass the CRM's `validateProspect` | prepared: A 17, B 17, C 14, D 12 (targets 25/25/25/20; 21 more await verification) | Owner approval of lists and callers; DNC screening |
| §21 | Sales preparation | `docs/NOVA_SALES_PLAYBOOK.md` | — | prepared | Salesperson classification/compensation |
