# Nova operating playbooks — version 2026-11-04.1

The product definition is in `api/_hierarchy/playbooks.js` and the five executive playbooks are visible in Executive desk. Every role names its mission, inputs, executable jobs/tools, evidence, escalation and authority boundary. Titles do not grant authority. Isaac remains CEO and owner.

## Executives

| Role | Real work | Required proof | Authority boundary |
|---|---|---|---|
| Isaac’s decision assistant | Reviews saved executive results, priorities and blockers; produces a decision brief | Referenced task records and unresolved decision | Decision support; no impersonation, ownership change, signing, spending or customer contact |
| Executive assistant | Orders owner decisions, customer escalations, website inquiries, overdue and blocked work; in-app alerts | Source record, age, next owner action | In-app routing only |
| COO | Assigns supported tasks, holds unfinished/missing prerequisites, retries eligible maintenance once, flags missing proof | Task/job transitions and evidence | Never automatically retries uncertain sends, charges or bookings |
| CFO | Reconciles dated balances, commitments, recorded debits and monthly budgets; publishes costs/free alternatives | Source/date, atomic approval result, provider reference | Zero spending remains locked; missing/stale funds and unknown prices block approval |
| CMO | Proposes Revive from actual stalled records, reports recorded outcomes, proposes only owner-set test budgets | Cohort, permission and campaign receipts | Proposals do not launch a campaign or authorize spend |

Each run is a queue job linked to one business-scoped work item, with evidence, output, status history, playbook version and model state. Restart/replay must not duplicate schedules or side effects. Company, worker, global and provider stop controls apply.

## Operational workers

| Registered capability | Entry and real action | Evidence and exception rule |
|---|---|---|
| Inquiry/booking | Receives a configured inbound turn; follows approved services, prices, agreement and calendar | Save each state transition. Unsupported requests, missing prerequisites and human takeover stop automation |
| Follow-up/Revive | Receives a scheduled eligible follow-up | Recheck consent, suppression, reply, booking, quiet hours and pause before dispatch; ambiguous outcomes need reconciliation |
| Demand outreach | Executes only an owner-approved campaign through supported channels | Track audience/source, offer, limits, receipt and stop conditions; no invented sales/ROI |
| Audit evidence | Reads bounded public sources; runs owner-authorized scoped tests only with an activated channel | Record source/time/identity, distinguish unknowns, hypotheses and measured facts; human approval before delivery |
| Monitoring | Checks queue/workflow health and opens incidents | A heartbeat is not proof a customer was served; do not mark a resolution without a re-check |
| Reporting | Computes scoreboards and overdue checks from saved records | No synthetic customers, money or conversions; every denominator and unknown stays visible |
| Marketing publishing | Processes approved content/sequence jobs for supported connected accounts | Account OAuth/permissions, approval, rights and receipts required; content publishing does not establish social DM support |

These workers have code-backed capabilities; registration alone does not connect a provider, create a funded plan or certify the business's installation. Unregistered workers must not appear as working employees. Scale queue throughput/capacity deliberately rather than creating decorative thousands of worker records.

## LLM reasoning and company learning

Deterministic execution stays responsible for arithmetic, state, authorization and side effects. Optional inference can summarize and propose next actions/lessons; it cannot directly call execution tools. Default mode is off. The job still saves its measured result when a model is unavailable.

- Local option: run an installed, downloaded Ollama model on the same server with Ollama cloud features disabled (`OLLAMA_NO_CLOUD=1` on the Ollama process). Configure `NOVA_ROLE_MODEL=local`, `NOVA_LOCAL_MODEL` and `NOVA_LOCAL_MODEL_OFFLINE_CONFIRMED=true` only after verifying offline operation. Nova checks local model metadata and refuses remote/cloud models. No paid fallback is attempted. A laptop/container must remain available; an ephemeral coding session is not a permanent model host.
- Hosted option: requires a new spending authorization, `NOVA_SPENDING_LOCK=disabled`, enabled paid calls, an approved model price and an atomic budget for `executive:<organization UUID>`. Hosted prompts receive allowlisted counters/states, not raw financial/customer/task/memory text. Keep keys server-side. No hosted inference was used for acceptance.
- Learning: a generated lesson is a proposal. An authorized owner reviews the exact saved task output. Atomic promotion stores a new organization/role-scoped memory version, retaining the latest eight reviewed lessons. Historical approval identity prevents replay even after a lesson leaves the active window. Expired or other-company memory is excluded.
- This is reviewed operational memory, not retraining model weights or pretending the model becomes an employee with unrestricted power.

Official offline-model reference: https://docs.ollama.com/faq and https://github.com/ollama/ollama/blob/main/envconfig/config.go

## Administrative habits

Before a material action: check the customer problem, evidence, smallest useful next action, supported tool, authority, cost, scope, recovery and success condition. Apply engineering, customer, offer, delegation, finance and security perspectives; do not invent a conversation or endorsement from a public figure.

Owner/admin access uses the existing authenticated permission system. A model cannot create an administrator, widen its permissions, approve itself, release spending or make a binding commitment. A company or worker stop control must be honored before work begins. Never place credentials in a playbook, memory, report, browser variable, repository or notification.

Completion requires a real result and evidence. If a provider login, fee, approval, device, legal detail or native build is missing, record the specific blocker and a free operational fallback. Do not turn “not checked” into “missing,” “prepared” into “submitted,” “queued” into “working,” or “provider accepted” into “delivered.”


## 5 November workforce release

All 13 executable capabilities now have versioned operating instructions: mission, inputs, jobs, proof, escalation and shared spending/privacy boundaries. The Workers page has searchable collapsed worker cards, saved reporting lines and a separate Executive desk. `Install Nova workforce` initializes the existing Nova Operations profile, preserves registered-worker pauses, creates missing workers idempotently and seeds Nova-only monitoring/reporting. Unknown hours, services, agreements and rewards are not invented.

Each capability has a distinct LLM profile and an actual bounded optional reasoning path through the shared job runner. Five executives retain their organization-scoped approved memory. Specialist advisory receives only an allowlisted workflow state, never customer message text or arbitrary job instructions. Monitoring/reporting receive bounded scalar metrics. These are separate instructions and context, not 13 separately trained or self-modifying models. Model output cannot change a transport result or authorize actions.

`NOVA_WORKER_MODEL_<CAPABILITY_KEY_UPPERCASE>` and `NOVA_WORKER_MODEL_NAME_<CAPABILITY_KEY_UPPERCASE>` override global model selection. Local inference remains fixed to loopback Ollama, downloaded-model verification and offline confirmation. No hosted free LLM account is connected; all deployed reasoning stays off and paid fallback stays blocked. Do not present configured profiles as active inference.

Nova-only monitoring (`nova_monitoring_review`, five minutes) checks current overdue jobs and expired leases independently of the seven-day report window. Reporting (`nova_reporting_snapshot`, hourly) saves actual counts, not invented revenue. Completion and the single recurring successor are committed atomically against the current live owned lease. A pause defers the original task without consuming retries; a canceled or expired claimant cannot create its next run. Legacy global/client operations handlers are unchanged. Free hosting cannot promise uninterrupted 24/7/365 availability.
