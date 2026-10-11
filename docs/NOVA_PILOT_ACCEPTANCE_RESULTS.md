# Nova Pilot — Acceptance Results (journeys A–J)

Last updated: 2026-09-24. **Every result below is from an in-memory simulator, an emulator, or a mocked browser backend. None is a provider test and none is a deployed test.** Per the master order, a mocked test proves logic only, and a fail-fast "table not found" is never counted as a pass.

## Evidence classes (kept separate)
| Class | Meaning | What exists |
|---|---|---|
| **Logic** | Pure functions | `unit_wave1_test` 31 · `unit_audit_rules_test` 53 · job-queue 27 · audit clock 13 · social 12 · email sequences 12 |
| **Handler simulation** | Real request handlers against an in-memory PostgREST/repo stand-in | `unit_wave1_handlers_test` 48 · `unit_wave1_api_test` 64 (incl. Cal.com stand-in) · `unit_audit_handlers_test` 39 · `unit_crm_sales_test` 51 |
| **Schema emulation** | Migration SQL run in pg-mem (not real Postgres) | wave1 16 · crm/audit 8 · durable jobs 4 · marketing 12 |
| **Static** | `check_migration_lockdown` — every migration-created table is RLS-enabled or in the lockdown file | pass |
| **Mocked UI** | Real pages in a real browser, all network mocked | `ui_smoke_mocked` 28 |
| **Live database** | Migrations applied, e2e scripts pass | **none — nothing applied** |
| **Provider** | Real Twilio / Cal.com / Resend traffic | **none** |
| **Deployed** | Running on Vercel/worker with real webhooks | **none** |

Run everything without a database or network: `npm run verify:local` (16 suites). UI smoke: `PLAYWRIGHT_PATH=… node scripts/ui_smoke_mocked.mjs` with `npm run dev` running.

A mutation check was done once to confirm the CRM tests can fail: removing the organization filter from the contact/business update path made exactly the two isolation tests fail.

## Journeys
Legend: ✅ logic proven in simulation · ◐ partly · ❌ not built · ⛔ not proven (needs live systems)

| # | Journey | Simulation result | Live/provider result |
|---|---|---|---|
| A | **Audit**: intake → research → findings → report → approve → deliver → handoff | ✅ Case with org-checked references; SSRF-guarded public-page research producing evidence with source/time/confidence and low-confidence absences; evidence-linked findings incl. `unknown`; estimates only as ranges with assumptions; prohibited claims ("recovered revenue", guarantees) refused; approval blocked with an itemised problem list; approval bound to a content hash; superseded/edited/draft reports cannot be delivered; "delivered" needs a confirmation; cross-org report/evidence/finding ids rejected; status cannot jump past clock/approval/delivery. **Not built:** report document renderer, real email delivery, sales handoff automation | ⛔ Research never run against a live site; nothing run on a database. **No real audit of Nova has been produced.** |
| B | **Sales**: prospect → … → pilot → paid/extended/closed | ✅ Stages, mandatory win/loss reasons, next-action/overdue/no-next-action views, notes/tasks/reminders, versioned proposals (no invented prices; acceptance needs evidence; `pilot_agreement` needs an accepted proposal), pilot record with server-enforced go-live gate, separate testimonial permissions | ⛔ |
| C | **Inbound call** | ◐ Signed voice webhook forwards to a human with a ring timeout; only an unanswered forward (`DialCallStatus`) becomes a missed call; no target → honest message + recorded missed call; unknown number not forwarded. ❌ **No AI voice agent**, no scheduling by voice, no voicemail | ⛔ No call has ever reached this code |
| D | **Missed call → SMS** | ✅ One follow-up per CallSid; eligibility re-checked at execution; no consent / suppressed / paused / staff-takeover / replied / already-booked all block; quiet hours defer (≤3) instead of dropping; dry-run recorded as not sent; provider-accepted ≠ delivered; ambiguous timeout never auto-retried; delivery callbacks ordered and de-duplicated; forged webhooks 403; fail-closed when unconfigured | ⛔ No text was sent or received; registration status unknown |
| E | **Opt-out** | ✅ STOP suppresses and beats everything, **including an already-queued job**; only START/UNSTOP re-subscribe ("YES" does not — a real bug fixed); carrier opt-out (21610) suppresses; suppression survives a contact merge; imports never grant consent | ⛔ |
| F | **Booking** | ✅ (Cal.com stand-in) confirmed only when the scheduling source says `accepted`; `pending` stays requested; availability checked; duplicate slot refused; ambiguous write is not confirmed or retried; failed cancel is not recorded as cancelled; manual requests need a recorded confirmation note. ❌ No webhook receiver for Cal.com changes (poll via *Sync*), no reschedule, no reminders | ⛔ No real Cal.com call; endpoint paths were checked against Cal.com's published reference and the API host was confirmed reachable, but a real key has never been used |
| G | **Human handoff** | ◐ Staff takeover stops automation (tested); call forwarding to the escalation contact (tested). ❌ No transfer-failure records, no manual reply from the inbox | ⛔ |
| H | **Isolation** | ✅ Simulated: webhooks route by owned number, forms by token; org B cannot read/alter org A's pilots, checklist, permissions, appointments, contacts, deals, proposals, activities, audit evidence/findings/reports/deliveries; contact/business updates cannot cross or re-home orgs (real defects fixed). Real-database RLS: `e2e_org_isolation_test` passes (8/8) for the **existing** tables only | ⛔ New tables: RLS unproven until applied. **Storage-bucket isolation not tested** |
| I | **Failure recovery** | ✅ Lease expiry reclaim, retry backoff, dead-letter, replay-safe webhooks, interrupted-merge re-run design | ⛔ Real Postgres `claim_next_job()` never executed; no worker running; no alerting |
| J | **New installation by an installer, no code** | ◐ Everything an installer needs is configuration (settings, token, checklist, gates) and the doc exists. Not exercised end to end | ⛔ **Not done.** Requires a separate test organization on a migrated database |

## Defects found by this work (all fixed in code; none deployed)
1. Delivery could be recorded against any organization's report id.
2. Findings could cite another organization's evidence; recommendations could link another case's finding.
3. Case status could be set to `approved`/`delivered` with no approved report or delivery, or skip the clock start.
4. Report approval had no readiness check and no content binding.
5. Updating a CRM contact or business by id had no organization filter (and rewrote `organization_id`).
6. Any contact/business edit silently reset `do_not_contact` and consent flags and blanked omitted fields.
7. Deals/contacts could reference another organization's businesses/contacts/leads.
8. The reply "YES" cleared an opt-out and granted SMS consent.
9. Missed calls forwarded via `<Dial>` would never have been detected (parent status is `completed`).
10. Form tokens used `Math.random`.
11. **47 of 71 migration-created tables had no row-level security** (anon-readable/writable under Supabase default grants).

## Known open items (not bugs — not built)
Listed in `NOVA_PILOT_REQUIREMENTS.md` ("Not built in this pass").

## Conclusion — ready for pilots?
**No.** Ready for the *owner to begin the installation sequence*: the code path for the pilot exists and its rules are tested in simulation, but no database migration is applied, no provider is connected, no call/text/booking has occurred, no real audit has been run, and owner sign-in for Isaac's own account is unverified. What is ready is the work list in `NOVA_PILOT_OWNER_ACTIONS.md`; after §C–§F, the acceptance checklist in the Installation doc is what will convert these ✅/⛔ into evidence.
