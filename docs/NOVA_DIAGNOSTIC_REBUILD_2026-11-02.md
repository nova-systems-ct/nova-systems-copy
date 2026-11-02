# Nova Audit diagnostic rebuild — 2 November 2026

Owner direction: build the real 24–72-hour audit before the demo. Investigate across industries, inspect existing systems before replacing them, gather useful public evidence, execute authorized customer tests and support optional in-person observation. Never manufacture problems, successful activity or revenue figures.

## Implemented

- Protected Investigation workspace in the existing app. Persisted in `audit_cases.intake.investigation`, through authenticated organization/case guards. Existing accounts, report storage and client records are preserved.
- Explicit 24–72 calendar-hour scope; preparation does not start the clock. Start requires a matching approved elapsed-hour policy and the existing case clock started. Original deadline and effective clock remain distinguishable.
- Baseline, 24-hour and 48-hour public checks when those offsets fit the agreed window. Durable jobs, idempotent enqueue repair, one research run per attempt, cancellation, explicit retries and preserved attempt history.
- Questions cover acquisition, cost/revenue evidence, identity, website, social, reputation, news, competitors, existing systems/handoffs and retention. Manufacturing adds RFQ/specification/production/delivery checks. Optional in-person checks share the case; this is not a safety inspection.
- GDELT public-news discovery (bounded query, three-month index window, ten candidates). Source matches remain unconfirmed candidates, not facts about the business. Empty results do not prove absence of coverage. Access failures remain visible.
- Discovered social links, email addresses and phone numbers from the business website become candidates. Scheme-less social links are normalized. Private/literal-IP candidates are refused. A candidate does not authorize contact.
- Confirmed public source URLs can be queued and read through the guarded crawler. Source text is untrusted data; it cannot authorize tools. Analyst review records identity, relevance and uncertainty before investigation completion.
- Phone/email/form/SMS/social test planning includes documented permission, exact destinations, expiry, daily destination/channel limits and truthful identity. Competitors are researched from public sources, not actively contacted.
- Executable Resend email and Twilio phone transports with owner approval bound to the exact destination/content/language, a versioned conservative maximum cost and an atomic approved budget reservation. Default sending is OFF. Unknown pricing or budget blocks dispatch.
- Phone tests are capped at 60 seconds, announce automated authorized testing, and support English or Spanish. Speech collection requires separately recorded transcription permission. This is a bounded diagnostic call, not a complete conversational receptionist.
- Intent is persisted before dispatch. Accepted/uncertain provider attempts never automatically re-send on job replay. Ambiguous failures require reconciliation. Provider acceptance is not delivery or useful response.
- Twilio callbacks require both an expiring case/task/attempt-bound HMAC and the provider signature. Resend callbacks enter only through the existing Svix-verified webhook. Signed reply aliases route incoming email to the exact case/test; incoming mail remains unclassified until reviewed.
- Response-observation jobs preserve provider evidence after the configured window. Automated acknowledgements, voicemail/speech and delivery receipts do not establish useful human help. Analyst-reviewed results store actual timestamps and response intervals. Historical tests can be documented after permission expires, without authorizing a new send.
- Evidence-linked DRAFT diagnoses for reviewed in-hours unanswered samples and explicit observed issues. These describe a single test/observation, not a business-wide failure rate or a financial loss. Financial impact remains unknown without operating records.
- Coverage distinguishes checked, blocked, incomplete, awaiting review and explicitly excluded. Exclusions never count as checked. An evidenced clean investigation can be approved with no findings; an empty/all-excluded investigation cannot.
- Report/PDF/Vault snapshots include investigation coverage, source evidence, timings and exclusions. Synthetic QA fixtures were isolated outside git, not inserted into customer audits.
- Concurrent intake/detail saves protect investigation state with the case timestamp. Robots.txt requests use the network/redirect guard; robots-disallowed starting URLs are not fetched.
- Optional packaged Chromium provider for the hosted renderer, pinned in the lockfile. Mandatory request interception, GET-only policy, private-network checks and dead proxy remain in place. Local launcher configuration tests are separate from an actual browser launch.

## Scheduled runtime

`api/integrations?op=audit-queue-tick` is a bounded receiver for audit jobs only. It requires a fresh HMAC, explicit project target and an enable flag; consumed nonces are durable receipts. It claims one due job, renews its lease and preserves cancellation when recording completion/failure. Registered worker holds and paused audit clocks prevent execution.

Staging extensions `pg_cron` and `pg_net` were installed through migration `20261102120119_nova_audit_on_demand_scheduler_extensions.sql`. The matching scheduler secret was stored in Supabase Vault without printing or committing it. The cron command is in `NOVA_AUDIT_SCHEDULER_SETUP.sql`; it checks for actual due/recoverable audit work before issuing a request. It is not a keepalive and does not create an always-on free worker. Included service quotas and cold starts still apply.

Provider-owned pg_net ACLs retained default database-role grants despite REVOKE attempts. The design therefore puts no reusable credential in the HTTP request queue: requests contain only expiring HMACs, and replayed nonces are refused. Vault decrypted secrets are not readable by anon/authenticated. Do not expose the net schema through the Data API.

Render environment was merged, not replaced: explicit staging target, bounded receiver enabled, packaged Chromium selected, and `NOVA_AUDIT_SEND_ENABLED=false`. No paid provider budget or send activation was created.

## Verification and limits

Local: domain/service tests against an isolated PostgREST boundary and injected providers. Covers permission withdrawal/expiry/destinations, response timing, replay, provider receipts, source discovery, callback signatures, budgets, cancellation, organization denial and honest approval. Build and lint pass. The aggregate verification reports its renderer skip explicitly; this container has no working default Chromium installation. Packaged launch options are tested without claiming a browser run.

PDF layout QA used a clearly marked synthetic fixture. Four rendered pages were inspected; long check headings were corrected to short labels plus wrapped question text. This proves layout handling, not buyer value or a real diagnosis.

Deployment, receiver smoke checks, scheduler activation, hosted renderer acceptance and full multi-day observation must be recorded separately below. A commit or cron definition alone is not operational proof.

Still requires live activation/acceptance:

- Real email sender and receiving domain, signed webhooks and a controlled authorized test.
- Phone provider/caller ID and applicable test/transcription policy, then a controlled authorized call.
- Automated form submission and social DM test transports are NOT implemented; those are analyst tasks.
- Broader listing/review/search data beyond the implemented sources; platform access can remain unavailable.
- Human factual/report review, industry-specific refinements, actual connected records for financial diagnosis.
- Physical iPad acceptance and a genuine 24–72-hour investigation; neither is implied by accelerated fixtures.

## Owner path after staging deployment

1. Open Audits → a case → Investigation. Choose duration and Prepare.
2. In Clock & policy, approve the matching calendar-hour scope, record prerequisites and start the existing case clock.
3. In that same section, record actual business test permission, destinations, expiry, evidence and any transcription permission.
4. Start the investigation. Review discovered candidates and add confirmed sources. Add scoped customer tests and optional in-person checks.
5. Automatic phone/email tests require a separate owner approval and provider gates; current server sending remains disabled. Do not enter a spend approval under the current no-spend instruction.
6. Review provider/source evidence and record actual results. Resolve blocked checks or document exclusions.
7. Submit for review, review proposed findings, draft a fresh report and inspect its PDF/Vault version before approval.

## Staging acceptance record

Pending deployment verification at this checkpoint. No production change or real customer contact is claimed.
