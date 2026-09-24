# Nova Pilot — Requirements, Location, Verification, Result

Source: MASTER EXECUTION ORDER (Audit → Sales → Wave One → Installation → Real Verification), 2026-09-24.
Companion docs: `NOVA_PILOT_INSTALLATION.md`, `NOVA_PILOT_ACCEPTANCE_RESULTS.md`, `NOVA_PILOT_OWNER_ACTIONS.md`.

**How to read the status column.** Five separate facts, never merged into one "done":
**C** code implemented · **D** database/storage configured · **T** automated tests passed · **P** deployed and connected · **E** end-to-end verified with real providers/data.
As of this writing **no migration has been applied to any database, nothing new is deployed, and no provider is connected for this work.** Every row below is therefore at most `C` + `T` (logic proven against in-memory stand-ins); `D`, `P`, `E` are all "no". No completion percentages are given because none would be honest.

Verification key: `unit_*` = pure logic; `handlers/api` = the real request handlers run against an in-memory PostgREST stand-in; `pg-mem` = migration SQL parsed and executed in an emulator (not real Postgres). None of these touch a real database or provider.

## §4 Owner access
| Requirement | Where | Verification | Result | Remaining |
|---|---|---|---|---|
| Owner sign-in, recovery, session persistence, org, admin permissions, sign-out | `src/pages/Login.jsx`, `api/_auth.js`, `has_permission()` | `e2e_login_path_test` (12/12) and `e2e_api_client_auth_test` (22/22) use a **throwaway** account against the live project | Throwaway account passes. **Isaac's own account is NOT verified**: this environment has no credential for it, and the earlier block on `isaac@nova-systems.app` is a Supabase-dashboard-side email rejection, not application code | Isaac signs in with `isaac_0427@icloud.com` and runs the checklist in `NOVA_PILOT_OWNER_ACTIONS.md` §A, or fixes the dashboard email setting |
| Never grant owner from a browser-supplied email | `api/_auth.js` derives identity from the verified bearer token only | `e2e_api_client_auth_test` | Pass (throwaway) | — |

## §5 Real Nova Audit
| Requirement | Where | Verification | Result |
|---|---|---|---|
| Intake → case with org-scoped business/order references | `handleAuditCases` (`api/client.js`) | `unit_audit_handlers_test` — a case cannot reference another org's business | C, T |
| Business identity resolution: candidates, never auto-merge | `handleCrmBusinesses` (search returns candidates) | Existing behavior; search only | C (no dedicated test) |
| Public-source research with source, retrieval time, confidence | `api/_auditResearch.js`, `audit research` op | `unit_audit_rules_test` (53): SSRF guard (localhost, RFC1918, metadata IP, DNS-rebinding style, redirect-to-internal, credentials, odd ports), size cap, extraction on fixtures, absence recorded as low-confidence with a limitation | C, T. **Not exercised against a live website in this environment** |
| Owner-supplied evidence for what public web cannot show; never infer missed calls / lost revenue | Findings type `unknown`; evidence rows accept owner-provided observations; research output never mentions revenue | `unit_audit_rules_test` (no evidence record contains revenue/loss claims) | C, T |
| Every finding: source, time, evidence, fact/inference/estimate/unknown, confidence, action, review status | `api/_auditRules.js` `validateFinding`; findings columns in the CRM/audit migration | `unit_audit_rules_test`, `unit_audit_handlers_test` — an observed fact without evidence, or citing another org's evidence, is rejected | C, T |
| Financial estimates: ranges + assumptions, never "recovered revenue" | `validateFinding` + prohibited-claim scan | 53 + 39 checks | C, T |
| Versioned drafts; approval bound to current version; reject superseded/unauthorized | `handleAuditReports`: readiness check (required sections, reviewed findings), content SHA-256 bound at approval, compare-and-set approve | `unit_audit_handlers_test`: incomplete → 422 with problems; older version → 409; re-approve → 400; prohibited claim → 422 | C, T |
| Delivery records approver/deliverer, only approved current unchanged content; "delivered" needs confirmation | `handleAuditDeliveries` | Tests: cross-org report id → 404, draft → 409, edited-after-approval → 409, delivered without confirmation → 400 | C, T |
| Cannot skip clock start / approval / delivery via status change | `checkStatusTransition` | Tests | C, T |
| 24–72h timing tracking, pauses, no artificial delay | `api/_auditClock.js` | `unit_audit_clock_test` 13/13 | C, T |
| Real audit run for Nova itself | — | **Not done.** Blocked on the migration being applied | Owner action |

**Real defects found and fixed while doing this** (all pre-existing, in code that earlier reports called complete): delivery accepted any report id from any org; findings could cite another org's evidence; `update-status` could jump a case to approved/delivered with no report or delivery; approval had no readiness check and no content binding; recommendations could link to another case's finding.

## §6 Sales and pilot workflow
| Requirement | Where | Verification | Result |
|---|---|---|---|
| Pipeline stages prospect → … → results review → won/extended/closed | `crm_deals.stage` CHECK; `api/_crmSales.js` | `unit_crm_sales_test` (51) | C, T |
| Owner, next action, follow-up date, notes/tasks/reminders, discovery answers | `deal-plan`, `activities` ops; columns in migration | Tests incl. overdue and "no next action" pipeline lists | C, T |
| Win/loss reasons required | `checkDealStageChange` | Tests | C, T |
| Versioned proposals; acceptance requires evidence; **no hardcoded prices** | `proposals` op | Tests: price refused unless the product is `pricing_approved`; stale version cannot be sent/accepted | C, T |
| `pilot_agreement` stage needs an accepted proposal | `handleCrmDeals` | Test | C, T |
| Pilot record, lifecycle, go-live gates, cost payer, rollback/offboarding, outcome + reason | `pilots` op in `api/_wave1Api.js`; `pilots` table | `unit_wave1_api_test` (44) | C, T |
| Testimonial permission separate, per-use, evidenced, not required | `pilot-permissions` op | Tests: new pilot has none; granting `quotation` does not grant `video`; "everything" rejected; not gated on agreement | C, T |
| Reviewable agreement templates, **not labeled legally approved** | Only `agreement_version` + evidence fields exist | — | **Not built.** No template text has been written. Drafting legal language is not something this system should invent; an attorney-reviewed template must be supplied and stored as a reviewable version |
| Configurable product catalog, no hardcoded prices/commissions/guarantees | `products` table + `pricing_approved` | Proposal test | C, T. Catalog has one placeholder row; no prices |
| Owner pipeline UI | `src/pages/dashboard/Sales.jsx` (Growth → Sales & Contacts) | `ui_smoke_mocked` (mocked backend) | C; UI rendered against mocked API only — never against the real API |

## §7 CRM
| Requirement | Where | Verification | Result |
|---|---|---|---|
| Org-scoped contacts, normalized phone/email, source, consent with source+timestamp | `crm_contacts` + wave1 columns; `api/_wave1.js` | `unit_crm_sales_test`, `unit_wave1_*` | C, T |
| Dedupe candidates; **reviewable** merge that preserves opt-outs | `contacts-duplicates`, `contacts-merge` (dry-run first; suppression applied to survivor before anything moves; consent carried only for the same number) | Tests | C, T. Merge is not one DB transaction (PostgREST); steps are ordered and re-runnable |
| Search, pagination, import (never grants consent), export (formula-injection safe) | `contacts` GET, `contacts-import`, `contacts-export` | Tests | C, T |
| Audit history | `crm_activities` note written on merge; deal `stage_history` | Tests | Partial: no general field-level change history |
| Source event ids prevent duplicate leads on retry | `wave1_source_events` unique key | `unit_wave1_handlers_test` | C, T |
| Fixed: cross-org update/re-home of contacts and businesses; partial update reset `do_not_contact` | `handleCrmContacts/Businesses` | Tests + a mutation check (removing the org filter makes the tests fail) | C, T |

## §8 Inbound calls
| Requirement | Result |
|---|---|
| Runtime chosen: **Twilio Voice forwarding to a human** (`voice-inbound` webhook: signed, per-number org routing, ring timeout, result callback). Unanswered forward → CRM record + one eligible follow-up | C, T (`unit_wave1_handlers_test`: forged 403, forwarded, answered ≠ missed, `DialCallStatus` no-answer = missed, no target → honest message + recorded miss, unowned number not forwarded). **Not built:** a conversational AI voice agent (answering from approved info, intake, booking by voice, transfer, voicemail, recording retention). `docs/voice-agent-spec.md` and the `voice_*` schema (migration #11) describe it; provider keys exist locally but nothing has been connected or called. **Do not claim a working voice agent.** |

## §9 Two-way SMS and missed calls
| Requirement | Where | Verification | Result |
|---|---|---|---|
| Signed webhooks fail closed; replay/duplicate safe | `api/_wave1.js`, `_wave1Handlers.js` | 29 + 29 checks: forged signature 403, no config 503, replay deduped | C, T |
| Missed-call follow-up: one job per CallSid; eligibility re-checked at **execution**; STOP blocks an already-queued job | `runMissedCallFollowup`, worker `wave1_missed_call_followup` | Handler tests | C, T |
| Consent source+timestamp; no text just because a number exists; STOP wins; quiet hours/timezone; frequency; staff takeover | `evaluateSendEligibility` | Logic tests | C, T |
| Dry-run ≠ sent; provider-accepted ≠ delivered; ambiguous outcome reconciled, never auto-retried | `classifySendOutcome`, message states | Tests | C, T |
| Live send | Off unless `WAVE1_SEND_ENABLED=true` | — | Deliberately disabled |
| Quiet-hours deferral | A missed call inside quiet hours is scheduled for the first moment quiet hours end (DST-correct), re-checked when it runs, deferred at most 3 times, then recorded as blocked | Logic + handler tests | C, T |
| Provider registration (A2P 10DLC or equivalent) | Tracked in `provider_registration`; preflight fails until `approved` | — | Owner action; verify Twilio's current requirements yourself |
| Delivery-status callbacks (ordered, de-duplicated, forged/wrong-org rejected; carrier opt-out 21610 suppresses); inbox + settings + takeover UI | `handleSmsStatus`; `PilotConsole.jsx` | Handler tests; mocked UI | C, T. **Not built:** sending a manual reply from the inbox; template library UI (one missed-call template field only) |

## §10 Forms, calendar, follow-ups
| Requirement | Result |
|---|---|
| Public form intake with token, honeypot, explicit-checkbox consent, double-submit protection, CORS for client sites | C, T (`form-intake`) |
| Real calendar integration (Cal.com): availability, booking, cancel, sync, conflicts, duplicate prevention; never "confirmed" unless the source says `accepted` | C, T against a Cal.com stand-in (`api/_calcom.js`, `appointments`/`availability` ops). Endpoint paths/versions were checked against Cal.com's published reference and the host answers; **a real API key has never been used**. **Not built:** reschedule, a webhook receiver (state is refreshed by *Sync*; a raw request body is not available in the consolidated Vercel function), per-client Cal.com accounts (needs secret storage that does not exist). Requires `CALCOM_API_KEY` |
| Durable follow-up workflows | Job queue exists (migration #8, unit-tested); only the missed-call job is wired |

## §11 Durable execution and operator view
| Requirement | Result |
|---|---|
| Leases, retries, backoff, dead-letter, idempotency | C, T — `unit_job_queue_*` 27 checks; Postgres `claim_next_job()` **not executed on real Postgres** |
| Operator view | Partial API (`operator` op): problem messages, failed/dead jobs, upcoming appointments, pause state. **Explicitly not available:** integration health, usage/spend, failed handoffs, worker liveness (the response says so). UI: Messaging & Booking → Operator view (mocked-UI verified only), which lists what is not available rather than implying all-clear |

## §12 Installation Center
| Requirement | Result |
|---|---|
| Repeatable workflow, preflight, supervised acceptance, go-live approval, pause switches | Preflight + 19-item checklist + server-enforced go-live gate + org/channel pause: C, T (API). Existing `Installations` UI/API (migration #6) is separate. Checklist/preflight UI: Pilots → Install & acceptance (mocked-UI verified only). Journey J (new installation without code) is not proven |

## §13 Database and deployment
| Requirement | Result |
|---|---|
| One ordered manifest with dependencies | `FINAL_INSTALLATION.md` updated: migration #14 (Wave One) and a final lockdown script |
| SQL reviewed for permissions | **Finding: 47 of 71 migration-created tables never enabled RLS.** Supabase grants new tables to `anon`, whose key ships in the browser bundle. Fixed by `zz-public-schema-lockdown-standalone.sql` (RLS on + revoke anon + revoke writes from `authenticated`), covered by `check_migration_lockdown.mjs`. **Not yet run against the real database** |
| Vercel 12/12 cap | Still 12 top-level functions; everything folded into `api/client.js` |

## §15 Pilot results
API `pilot-results`: baseline vs pilot period, real vs test excluded, requested vs confirmed appointments, missing period ≠ zero, and an explicit `not_measured` list (verified revenue, qualified leads, first-response time). Tested (C, T). Dashboard tab + `.txt` export + interview prompts exist in `Pilots.jsx` (mocked-UI verified only). No PDF export.

## Not built in this pass (do not represent as done)
Conversational AI voice agent · Cal.com reschedule/webhook/per-client accounts · manual reply from the inbox · appointment reminders · audit report document renderer and real report email delivery · sales-handoff automation from audit to proposal · agreement templates (legal) · worker heartbeat / integration-health / usage-spend metering · general CRM change history · storage-bucket isolation tests · any live or provider verification.
