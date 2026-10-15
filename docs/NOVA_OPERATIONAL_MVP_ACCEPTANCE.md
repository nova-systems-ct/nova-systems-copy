# Nova Operational MVP — acceptance evidence (2026-10-13)

**Scope of every result below: local only.** Real local PostgreSQL (embedded) + PostgREST, the real API handlers,
the real worker and a real Chromium browser. Supabase Auth/Storage, Twilio, Stripe and Resend are **local stand-ins**.
Passing these tests is not Supabase, Twilio or Stripe test-mode verification, and not deployment verification.

| Level | Result |
|---|---|
| Built | yes — all pillars and screens below |
| Locally tested | yes — results below |
| Real staging provider verified | **no** — no staging project exists (owner action 6) |
| Production verified | **no** |

## Clean-checkout verification (§17)
Export of the final commit `44a62af` (`git archive`, no `.git`, no env files) into `C:\Users\NVUBCrosbyUBMS07\nova-clean-check-44a62af`, then:

| Step | Command | Result |
|---|---|---|
| Lockfile install | `npm ci` | pass |
| Build | `npm run build` | pass |
| Lint | `npm run lint` | pass (0 errors) |
| Unit + schema checks | `node scripts/verify_local_all.mjs` | 24/24 suites PASS (incl. lockdown check) |
| All integration/e2e suites incl. browser | `node scripts/verify_sales_team_e2e.mjs` | **27 PASS, 0 FAIL, 2 TIMEOUT** (1,355 checks passed). `e2e_ops_harvest_test` and `e2e_hierarchy_meetings_test` printed nothing before the 420 s limit; re-run alone in the same checkout they passed 20/20 and 25/25 in about 20 s each. **The aggregate run is not a clean pass** — see "Aggregate-run instability". |
| Secrets in tracked files | pattern scan (Stripe/Twilio/Resend/Anthropic/AWS keys, JWTs, private keys) | 0 matches |
| Secrets in browser bundle | same patterns + `service_role` over `dist/` (199 files) | none found |
| Env files tracked | `git ls-files` for `.env*` | only `.env.example` |

## Journeys (§16)
| | Requirement | Evidence (suite → checks) |
|---|---|---|
| **A** | Audit: isolated test business, public/authorized evidence, findings, labeled scenarios, report, exact-version approval, PDF download, secure delivery, client sees only the approved report | `e2e_audit_report_delivery_test` (30), `e2e_audit_engine_test` (30), browser screens 10–11 |
| **B** | Core: form and SMS inquiry → reply → qualification → deterministic price → availability → hold/booking → exact-terms signature → Stripe test checkout → verified webhook → one order + fulfillment task → owner/client screens | `e2e_ops_core_journey_test` (67 + live-key check), `e2e_ops_browser_test` (30); voice tested separately in `e2e_ops_sentry_voice_test` (36) — the form test does not prove voice |
| **C** | Harvest: missed call → eligible follow-up → reply → booking; mixed-permission import; only approved eligible records; suppressed blocked; opt-out after enqueue sends nothing; neutral review/referral; truthful outcome | `e2e_ops_harvest_test` (20), `e2e_ops_core_journey_test` (follow-up/referral) |
| **D** | Sentry: stop worker → incident → alert (stand-in email) → recover → queue resumes without duplicates; weekly report from persisted events, reconciled; Sunday 18:00 across DST | `e2e_ops_sentry_voice_test` (36), `unit_ops_rules_test` (56), core test reconciliation check |

## Security and failure cases (§16 E)
| Case | Proven in |
|---|---|
| Anonymous cannot read private records | `e2e_security_personas_test`, `e2e_schema_lockdown_test` (48), `e2e_ops_core_journey_test` |
| Client A cannot access client B | `e2e_ops_core_journey_test` (isolation section), `e2e_security_personas_test`, `e2e_audit_report_delivery_test` |
| Rep cannot read unassigned/private client data | `e2e_security_personas_test`, `e2e_sales_pipeline_catalog_test` |
| User cannot promote themselves | `e2e_ops_core_journey_test`, `e2e_security_personas_test` |
| Suspended user cannot continue protected actions | `e2e_hierarchy_registry_test`, `e2e_sales_documents_activation_test`, `e2e_sales_journeys_test` |
| Forged Twilio/Stripe callback rejected | `e2e_ops_core_journey_test`, `e2e_ops_sentry_voice_test`, `e2e_security_personas_test` |
| Missing webhook configuration fails closed | `e2e_ops_core_journey_test` (Stripe secret and Twilio token removed → callbacks refused, nothing changes), `unit_wave1_api_test` (preflight flags it) |
| Duplicate callback cannot duplicate booking/order/payment | `e2e_ops_core_journey_test`, `e2e_ops_harvest_test`, `e2e_security_personas_test` |
| Failed processing remains retryable | `e2e_ops_sentry_voice_test` (crash → re-run, no duplicate), `e2e_security_personas_test` |
| Customer/model cannot invent a price | `unit_ops_rules_test`, `e2e_ops_core_journey_test` (discount request) |
| Prompt injection cannot invoke unauthorized tools | `unit_ops_rules_test`, `e2e_ops_core_journey_test` |
| Two simultaneous customers cannot take one slot | `e2e_ops_core_journey_test` (database exclusion constraint; one wins) |
| Provider timeout does not become success | `e2e_ops_core_journey_test` |
| Opt-out blocks queued sends | `e2e_ops_harvest_test`, `e2e_ops_core_journey_test` |
| No permanent private-document URLs | `e2e_ops_core_journey_test` (5-minute signed link), `e2e_security_personas_test` |
| Missing consent blocks reactivation | `e2e_ops_harvest_test` |
| Live payment gate blocks live keys | `e2e_ops_core_journey_test` (live key refused before any checkout; live-mode event ignored), `e2e_sales_commissions_test` |
| Dashboard URL does not bypass login | `e2e_ops_browser_test` (deep link → login; sign-out blocks dashboard) |
| Recovery link cannot be reused | `e2e_ops_browser_test` |
| Audit fetch rejects private/internal addresses | `unit_audit_rules_test` |
| Report changes invalidate old approval | `e2e_audit_report_delivery_test` |
| Report totals do not double-count | `unit_ops_rules_test`, `e2e_audit_report_delivery_test` |
| Kill switch prevents new side effects | `e2e_ops_core_journey_test` |

## Browser checks and screenshots (§17)
`e2e_ops_browser_test` drives real screens at desktop and phone sizes: sign-in, deep link, refresh, sign-out,
access denial, empty states, owner workspace, customer signing/deposit page on a phone, weekly report, monitoring,
client audit report on a phone. Every record shown is a labeled Nova TEST record.
Screenshots: `docs/acceptance-screenshots/01-businesses.png` … `11-audit-scenarios.png`.

## Known issue during the full regression
In the 2026-10-12 full run, `e2e_ops_browser_test` exited with Windows code 0xC0000409 (a crash inside the
browser process) before printing a result; it is recorded as FAIL for that run. Re-run alone: 30/30 passed.

## Aggregate-run instability (unresolved)
Three full aggregate runs on this computer each had one or two suites stall or crash — **a different suite each time**:
- 2026-10-12 (working copy): `e2e_ops_browser_test` crashed inside Chromium (0xC0000409).
- 2026-10-13 (`c2274e4` export): `e2e_sales_pipeline_catalog_test` began receiving 401 from the local auth stand-in partway through, crashed, then hung. Re-run alone three times: 92/92 each time.
- 2026-10-13 (`44a62af` export): `e2e_ops_harvest_test` and `e2e_hierarchy_meetings_test` stalled with no output; stopping them took 63 and 32 minutes instead of seconds. Re-run alone: pass.

Every suite passes alone and the stalls move between suites, which points at the local test environment (embedded
PostgreSQL on Windows across ~30 sequential suites, or the computer sleeping) rather than product code. That is a working
explanation, not a proven root cause. Mitigation in `44a62af`: every e2e suite force-exits after printing its result, so a
crash no longer hangs until the timeout. Next step: run the aggregate on a machine that cannot sleep (or in CI) and capture
the auth stand-in's log at the first 401.

## 2026-10-15 — standby diagnosis, fix, and repeat runs
Cause of the Oct 13 stalls: Windows Modern Standby froze the suites (Kernel-Power 506/507 times match each stall).
Runner now holds a keep-awake request and reports host suspension as SUSPEND (re-run once; never counted as PASS).

| Clean export | Run | Result |
|---|---|---|
| `60d5a45` | 1 | 29 PASS, 0 FAIL, 0 TIMEOUT (1,400 checks) |
| `60d5a45` | 2 | 29 PASS, 0 FAIL, 0 TIMEOUT (1,400 checks) |
| `60d5a45` | 3 | 29 PASS, 0 FAIL, 0 TIMEOUT (1,400 checks) |
| `22a6459` (adds calendar suite) | 1 | 29 PASS, 1 FAIL, 1 SUSPEND — battery hit critical (Kernel-Power 524) and Windows forced sleep at 15:22:40; the suite after wake (`e2e_hierarchy_registry_test`) crashed 0xC0000409; alone: 49/49 |
| `22a6459` | 2 | 28 PASS, 2 FAIL — `e2e_sales_closing_test` and `e2e_hierarchy_browser_test` crashed 0xC0000409 with no suspension |

**Unresolved: intermittent 0xC0000409 process crashes.** Different suites each time; each passes alone. This laptop's
Windows Error Reporting shows kernel crashes (blue screens) on 2026-06-15, 07-21, 08-29, 09-24, 09-27, 09-29 and 10-08
with bug checks 0x1E/c000001d (illegal instruction), 0x3B, 0x7E, 0x7F and 0x101 (CLOCK_WATCHDOG_TIMEOUT), plus
watchdog live-kernel reports. That pattern points at machine instability (hardware, firmware or a driver), which would
also explain random user-mode fast-fail crashes — a working explanation, not proven. Next: run the aggregate on another
machine or in CI, and run Windows Memory Diagnostic / check Dell BIOS and driver updates on this laptop.
