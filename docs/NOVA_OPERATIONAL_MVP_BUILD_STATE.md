# Nova Operational MVP — build state (2026-10-13)

Working copy: `C:\Users\NVUBCrosbyUBMS07\nova-mvp-work` (outside OneDrive, local Git, **no remote**), branch `mvp/operational`.
Baseline: nova-systems-copy at `b144f7d` (branch `repair/security-2026-09-30`), copied without Git metadata or env files.
Nothing has been pushed, deployed, or applied to any production or staging database.

## Commits
| Commit | Content |
|---|---|
| `3d1306b` | Baseline copy |
| `86dafd4` | Ops schema, rules, journey service, messaging, Harvest, Sentry, reports, voice, API, worker; core journey tests |
| `3a5232b` | Harvest/Sentry/voice/scheduler acceptance; lease renewal; idempotent turns and holds; deferrals |
| `79c5cae` | Operations UI (owner/client workspace, customer signing/deposit page); fixes: recovery-link sign-in bypass, org switch, inbox render race; dead fake-data CRM store removed |
| `88f0f5a` | Audit: intake, clock policy, test plan, benchmarks, software review, scenarios, finding details, composed report, exact-version PDF, secure client link |
| `f132593` | Website (four pillars, availability statement, honest claims); lockdown list; regression runners; four MVP docs |
| `5971471` | Business card + brochure proofs |
| `c2274e4` | Prospect lists A–D, outreach playbook, sales playbook, acceptance screenshots |
| (this doc) | Build state, acceptance, checkpoint |

## Reuse map
| Area | Reused as-is | Repaired / extended | Built new |
|---|---|---|---|
| Auth & roles | Supabase Auth, `useAuthGuard`, `has_permission`, org memberships | `AuthCallback` + `supabaseClient.authRedirect` (recovery-link bypass fixed); `OrgContext.load(preferId)` | `ops.view/manage/configure` permissions |
| Messaging | wave1 SMS: signed Twilio webhooks, consent (`evaluateSendEligibility`), STOP, quiet hours | inbound SMS → `ops_conversation_turn` job; STOP cancels queued items; `TWILIO_API_BASE` | `api/_ops/messaging.js` (transactional vs consent-required, allowlist, kill switch) |
| Queue/worker | `jobs`, `claim_next_job`, dead letter | lease renewal (`renewLease`), heartbeat | recurring slot jobs (Sentry 5 min, scoreboard hourly) |
| Payments | `api/stripe.js` signature verification | ops deposit handler first | Stripe-hosted deposit checkout, refunds, payment-without-booking escalation |
| Audit | `audit_cases/findings/deliveries`, research fetcher (SSRF-safe), clock | approval gate requires new finding fields; mark-ready requires approved clock policy | intake, test plan, competitors, software, scenarios, compose, PDF, secure link (`audit-02` migration) |
| Sales Team / CRM | whole platform (leads import, academy, commissions…) | — | prospect CSVs that pass its validator |
| Schema | migration manifest, lockdown file | lockdown covers new tables | `ops-01` migration (17 tables + `ops_hold_slot`) |
| Website | layout, nav, legal pages | Home (testimonials/pricing preview removed), Intake ("100% secure" removed), Onboard (phone agent labeled pilot), Login copy | `FourPillarsSection`, `AvailabilitySection` |

## Deferred / not built
- Connected Stripe accounts for paying deposits into a client's own Stripe (decision needed: owner action 11).
- Cal.com live verification (adapter exists; no key).
- Real-provider (staging) verification of anything — no staging project exists.
- Email notification of the audit report link is manual.
- The 10 product modules marked "not started" in `docs/requirement-matrix.md` outside this MVP's scope (Crystal, Zion Studio, Integration Center, etc.).

## Known defects / risks
- Full aggregate e2e runs are not yet clean on this computer: one or two suites stall or crash per run, a different suite each time; every suite passes alone. See `NOVA_OPERATIONAL_MVP_ACCEPTANCE.md` → "Aggregate-run instability".
- The unexplained pushes to GitHub on the original repository are unresolved (see owner actions).
- `public/logo.png` is 256 px — too small for the printed brochure cover.
