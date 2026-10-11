NOVA — PRODUCT-ONLY MASTER EXECUTION PROMPT

September 23, 2026 · Isaac Nova · Supersedes earlier website-first execution orders

1. Your assignment

Act as the lead implementation engineer for the existing Nova Systems repository. Build the complete product scope defined below, repair dashboard access first, preserve functioning work, and continue through every independent task without asking whether to continue after each module. Deliver a reviewable application, repeatable client installation system, and one consolidated production setup package.

THIS IS AN IMPLEMENTATION REQUEST. Do not return only architecture diagrams, scaffolds, mock dashboards, agent prompts, or a new list of future tasks. Implement actual domain logic, persistence, authorization, user interfaces, workflows, integrations, tests, and operating instructions. If external access prevents completion of a particular operation, record the exact blocker and continue everything that does not depend on it.

Do not modify Nova's public marketing website. No homepage redesign, video replacements, navigation rearrangement, marketing copy rewrite, portfolio redesign, public legal-page rewrite, or public SEO rollout. Do not build a separate public website for Crystal yet. These tasks are deferred. Authentication screens and protected application routes are in scope. Preserve existing public forms and their contracts; backend fixes and explicit product transaction surfaces are in scope, but do not redesign their public presentation. Build marketing content and publishing adapters inside the product; leave public Nova website publication disabled until separately authorized.

The goal is to operate Nova with its own software first, then install the same modules for Crystal/Company 002 and other authorized businesses. Isaac needs products he can demonstrate and, once their activation gates pass, install for clients: Nova Audit, Wave One, call answering, phone workflows, CRM, scheduling, follow-up, customer reactivation, operational workflows, and marketing automation.

2. Priority, source rules, and honest completion

Instruction priority: Isaac's latest product-only request, this prompt, verified repository facts, then the attached historical company context. Historical website-first sequencing, navy styling, and fictional-Zion descriptions do not control this build. Product UI uses black #0A0A0A, white #FAFAFA, restrained gold #C9A84C. Preserve existing public website styles without touching them.

Zion IS Isaac, represented by his existing character because he does not show his face on camera. Zion documents Isaac's real life, college, work, business-building, successes, setbacks, and goal of becoming a millionaire. Do not invent a fictional life or require face-camera content.

Read the attached source Pasted markdown (2).md as historical context, retaining every product requirement and explicitly deferring website-only requirements. If other audit blueprints exist in the repository, inspect and reconcile them; do not pretend an unavailable document was read.

Use separate statuses: not started; in development; locally verified; staging verified; waiting on owner/provider; ready for installation; installed; live verified. A pushed commit is not a completed deployment; a provider adapter is not a connected account; a missing migration is not a passing test. Demo data must remain in an explicitly labeled isolated demo organization.

The instruction to keep working authorizes sustained engineering within available permissions. It does not override access controls, rejected approvals, missing credentials, spending authorization, contractual decisions, or provider requirements. Do not invent credentials or circumvent these boundaries. Queue blocked external actions and continue independent implementation. If execution/session limits are reached, leave an exact resumable checkpoint, not a false claim of background work or completion.

3. Inspect and preserve the existing implementation

Inspect current branch, uncommitted changes, remote history, deployed revision if accessible, framework, API routes, database migrations, RLS, storage, queues, providers, environment configuration and tests. Preserve user work, existing accounts and production records. No destructive reset or blanket recreation.

Latest supplied developer reports, which you must verify rather than assume:

Canonical Supabase Auth, organization_members-based membership and organization isolation reportedly exist; earlier org isolation 8/8 and API authorization 22/22 checks reportedly passed against the existing system.

Six-hub HQ, permission-based navigation, organization switcher, real Overview/Leads/Tasks queries and real /welcome and /intake writes reportedly exist.

Login is currently broken according to Isaac. Earlier report identified Vercel Production VITE_SUPABASE_URL pointing to a dashboard URL instead of API URL https://xizmgruvuazmummotzkp.supabase.co. Confirm actual project and configuration; do not assume this is the only cause.

Academy commit fed0a6f and hiring commit 69fef38 reportedly pushed. Academy has ten programs, 20 lessons, 50 questions, server grading, practical review in programs 6/7, critical question handling in program 10, certificates and public verification. Hiring uses candidate/staff roles and canonical auth; old insecure endpoint reportedly returns 410.

Academy and hiring migrations reportedly remain unapplied. Files: supabase/academy-migration-standalone.sql and supabase/hiring-workflow-migration-standalone.sql. New tests reportedly fail on missing schema. Inspect current state before reapplying or regenerating.

Storage buckets portfolios, portfolio and nova-vault were reportedly absent. Determine actual consumers and required access before provisioning. Never infer public/private status from a bucket name.

Newsletter.jsx, Documents.jsx, Jobs.jsx and Invoices.jsx have previously reported defects. Determine actual current status and whether Jobs means recruitment or service jobs.

The previous report said 12 of 12 available Vercel functions were used. Verify actual current plan/build constraints before adding handlers; do not blindly hard-code an outdated provider limit.

Create a requirement matrix with ID, source, module, dependency, current evidence, acceptance test, status and blocker. Preserve working subsystems and extend them. Do not rebuild the Academy merely because this prompt lists its requirements.

4. First task: restore real dashboard login

Trace login end to end: input → Supabase request → verified identity/session → membership → permission evaluation → protected dashboard. Check production vs preview vs local configuration, intended Supabase project, paired public client key, callback allowlist, email links, session handling, account state, memberships, API authorization and deployment revision. Never log passwords, secret keys, bearer tokens or reset links.

Fix code/configuration through authorized access immediately where possible. If only Isaac can change Vercel configuration, record the exact field, expected value, target environment and rebuild requirement in the consolidated setup package; keep building against a correctly configured local/test environment. Do not bypass auth with localStorage, shared credentials, hidden backdoors or fake sessions so the dashboard appears to work.

Preserve existing accounts. Account setup/reset must occur through secure invitation or recovery. Do not ask Isaac to paste his password. Test owner login, wrong password, recovery, expired invite, refresh, logout, session expiry, missing membership, revoked role and organization switching. MFA and recovery for privileged users need an explicit supported flow. Separate successful sign-in from successful authorization.

Minimum proof: authorized test user reaches a real protected workspace, refresh retains an appropriate session, direct forbidden routes deny access, reset works in the tested environment, and cross-organization access fails. Production login stays pending until demonstrated on production.

5. Build continuously; batch production setup at the end

Maintain schema changes alongside code and test them during development on a disposable local Supabase/test database or authorized staging environment. Isaac's request to batch production setup does NOT mean writing months of untested SQL or deferring integration testing until the final day.

For each feature, implement schema/RLS/storage policy, API/domain logic, UI, tests, observability and install dependencies together. When a production action is blocked, finish the locally testable implementation and move to the next dependency-ready task. Use realistic test adapters for unavailable providers, clearly marked; these cannot satisfy live-provider acceptance.

Prepare ONE final install package containing ordered migrations, storage setup/policies, environment inventory, provider setup, OAuth steps, worker/cron configuration, deployment sequence, smoke tests and recovery instructions. It may contain multiple ordered files; do not flatten everything into one unsafe transaction or include destructive statements simply for convenience.

Production changes happen in a coordinated final activation window under appropriate authorization. Do not deploy schema-dependent code over the functioning production app prematurely. Use feature flags and compatible migrations. Fixing the existing login path is the initial exception where authorized configuration repair can restore current access without waiting for new modules.

6. Shared architecture and product data

One identity system, membership model, permission service, organization context, CRM domain, communication history, workflow runtime, integration registry, approval service, file service and audit log. Add industry-specific modules as extensions, not separate copied applications.

Every tenant-owned object needs enforced organization scope. Every mutation needs server-side authorization. Apply RLS where appropriate; service-role handlers must still enforce user and tenant authorization. Check object-level authorization, not only permission to call an endpoint. Agent tool authorization must use the same controls.

Core domains: users/memberships; businesses/contacts/leads/deals; orders/entitlements/installations; diagnostics/evidence/findings/reports; communications/calls/messages/consents; calendars/bookings; projects/tasks/jobs; proposals/agreements/invoices/payments; employees/applicants/training; brands/journals/content/assets/publications; agents/runs/approvals/workflows; connections/events/audit logs.

Use stable IDs, foreign keys, meaningful uniqueness constraints, integer money units with currency, timezone-aware timestamps, versioned policies/configuration and explicit state transitions. Unknown and zero must remain distinct. Use transactional outbox/events for reliable side effects. Store credentials as secure references, not in browser configuration or tenant-readable tables. Sanitize rich content and protect fetchers from internal-network/SSRF access.

Every module must have list/search/filter, detail, creation/editing where appropriate, authorization, meaningful loading/empty/error states, validation, audit history, pagination, retry handling, and real data after reload. No decorative buttons leading nowhere.

7. Split owner dashboard and role workspaces

At /dashboard, Isaac sees Run Nova and Run Companies prominently, plus Zion Studio, Revenue Lab, Approvals, Integrations and Installation Center. Shared header shows current organization, user, notifications and permission-filtered search. Company switching updates caches, data, tools, queues and permissions—not just a logo. Avoid copying stale data between workspaces.

Nova's six hubs:

Hub

Working modules

Overview

New leads, assigned work, upcoming meetings, audit deadlines, calls needing attention, verified revenue/costs where available, errors and approvals

Intelligence

Audit Orders, Evidence, Findings, Recommendations, Reports, baselines/results, knowledge and monitoring

Growth

CRM, pipelines, outreach, meetings, proposals, hiring/Academy, content calendar, campaigns and attribution

Execution

Projects, tasks, service orders, installations, workflows, agent runs, incidents and deliverables

Companies

Nova, Crystal and client workspaces; locations, contacts, subscriptions/modules and access

Admin

People/roles, integrations, documents, billing signals, commissions, policies, budgets, audit logs and settings

Role experiences: sales reps see assigned leads/outreach/meetings/training/own commissions; sales managers see authorized team pipelines/reviews; analysts see assigned cases/evidence/report review; marketing sees allowed brands/content/campaigns; operations sees jobs/resources/tasks; support sees assigned conversations and limited customer context; finance sees authorized invoice/payment/expense/commission records; developers see assigned technical tasks/health without unrestricted secrets. Applicants see only their own application/onboarding/assigned Academy work. Clients see their own orders, required inputs, approved reports, agreements, invoices and support.

Global oversight must respect actual client authorization. Personal Zion records are private by default. Consolidated financial displays cannot mix currencies, personal net worth and business revenue as if interchangeable.

8. Product catalog, orders and installable packages

Create a versioned product catalog with internal names, scope, prerequisites, available capabilities, pricing configuration pending approval, contract template reference, configuration schema, supported integrations, readiness state and installation checklist. Offer modules individually or in approved bundles. A diagnostic must not be technically required to purchase an independently supported call/CRM product; recommendations can also originate from an audit.

Order states: draft → scoped → awaiting acceptance/payment if required → accepted → waiting for inputs → ready for work → in progress → review → delivered/installed → monitoring/support → closed. Include pause, cancellation, refund/dispute tracking where applicable. A sale, an invoice and a settled payment are separate events.

Each order stores organization/customer, selected product/version, agreed scope, price/currency, agreement version, payment condition, owner, inputs, dates, deadlines, state history and installation link. Unknown pricing must not be invented; support editable drafts with commercial activation blocked until approved. Capture scope changes and acceptance of revised terms.

Catalog modules: Nova Audit Digital; Nova Audit 360; Wave One communications/CRM bundle; AI receptionist; missed-call response; CRM/pipelines; scheduling/reminders; follow-up; Nova Revive; reviews/reputation; marketing/content; business monitoring; physical-service operations. These are implementation groupings, not confirmed historical commercial tiers. Reconcile existing product definitions rather than silently overwriting them.

9. Nova Audit and the 24–72-hour order queue

Provide manual order creation for networking leads and existing /welcome and /intake integration without modifying the public pages. Resolve business identity from name, website and location. Show ambiguous matches for selection; never combine similarly named firms. Track entity aliases, confirmed website/location, branches, evidence and confidence.

Audit pipeline: accepted scope → required inputs/access → ready timestamp → source research → evidence → findings → priorities → report draft → human QA → approved version → delivery → customer decisions → optional implementation → outcome tracking.

Record target duration per order, clock basis (elapsed/business hours as explicitly agreed), timezone, start condition, due time, pause/resume events and reasons, original deadline and changes. Show waiting-for-client, queue time, active work, reviewer wait, at-risk and overdue distinctly. Do not silently extend deadlines or reset the clock. Do not delay a completed audit artificially to fill 24 hours. The 24–72-hour target is scoped remote work after prerequisites; 360/on-site work uses separate agreed timing.

Research areas: business identity/locations; website functionality and usability; contact routes; search/listing consistency; public reviews and patterns; social presence; customer journey; booking/follow-up; competitors with inclusion rationale; visible offerings/pricing where published; authorized internal CRM/call/sales/financial metrics. Source providers must be permitted and technically accessible. No promise to know everything on the internet, private finances, hidden operations or unavailable sources.

Build bounded research jobs with budget, depth/page limits, rate control, deduplication, fresh/stale timestamps, failed-source logs and source coverage report. Record unavailable/blocked/not tested separately from negative findings. No bypassing logins or intrusive scans, test bookings, real purchases, calls or customer-facing form submissions without authorization.

Evidence record: source, capture date, business/location, method, observation, permitted snapshot/file, author/agent, source quality, confidence and privacy level. Findings link evidence and separate observation, inference, estimate and recommendation. Contradictory sources remain visible. Revenue-loss ranges require actual inputs, assumptions and formula; never invent a dollar figure from a broken form alone.

Recommendations show expected mechanism, impact estimate, effort/cost range, dependencies, owner, uncertainty and proposed verification. Prioritization is transparent, coverage-aware and configurable. No mysterious AI score for unavailable data.

Report builder: branded black/white/gold PDF and secure client view; scope, methodology, executive summary, evidence-backed findings, priorities, limitations, source appendix and next steps. Render/inspect before approval. Store immutable approved versions; edited versions require new review. Delivery records distinguish requested, provider accepted, delivered where available and failed.

Convert an approved recommendation to a scoped installation/project, retaining the evidence and decision history. Outcome records preserve baseline/comparison periods, denominators, intervention date and confounders. Do not label correlations as proved causal recovery.

10. Wave One — complete communications-to-CRM package

First find the existing Wave One definition and implementation. Until reconciled, use this explicit requested engineering scope: capture inbound inquiries, track answered/missed calls, route and respond under policy, create/update CRM records, assign follow-up, book permitted appointments, notify responsible staff, and measure response/conversion. This is not permission to rename existing products or invent commercial promises.

Wave One installation must include: organization/location settings; phone/forwarding setup; business hours/timezone/holidays; approved knowledge base; inbound agent configuration; human transfer/fallback; lead capture; missed-call callback or consent-eligible message; conversation timeline; CRM pipeline; calendar connection; follow-up rules; notifications; consent/suppression; reporting; cost limits; tests; pause and uninstall controls.

Missed-call flow: verify provider event → deduplicate by call ID → resolve organization/location → associate contact cautiously → create call outcome → check allowed response channel → send only an approved eligible response or assign callback → alert owner → stop redundant sequence if customer replies/books → measure elapsed time to meaningful response. Do not treat an inbound phone number as blanket marketing consent.

Include manual human handoff and a unified inbox for phone, voicemail, email and SMS where connected. Display actual provider capability; unsupported messaging channels use a documented manual path, not fake delivery. Track unread/assigned/resolved/snoozed states and ownership collisions. Keep transcript summaries distinct from original records.

Wave One acceptance: an authorized test call reaches the right company, a simulated/real approved missed call creates exactly one follow-up, an eligible message or callback is logged, a booking confirms only after calendar success, staff receive appropriate notification, and dashboard totals reconcile to the originating events.

11. 24/7 AI call agents and phone systems

Build per-organization inbound answering, approved FAQs, lead qualification, scheduling, existing-customer routing, warm transfer, after-hours capture, voicemail/callback and escalation. Outbound AI campaigns are separately configured and activation-gated; do not turn them on by default.

Phone configuration: provider/account, number ownership, number/location routing, forwarding/porting prerequisites, business hours, holiday exceptions, ring/overflow rules, transfer destinations, wait limit, voicemail, emergency script, language/voice, disclosure/recording policy, transcript retention, concurrency, spend cap and health. Do not purchase/port numbers without authorization.

Call flow: authenticate webhook → create scoped session → automated-assistant greeting and approved disclosures → identify intent → retrieve approved current knowledge → collect minimum information → confirm critical details → execute narrowly permitted tools → verify outcomes → recap → store outcome and next action. Caller ID alone does not authenticate access to private account information.

Typed tools: get_business_information; create_or_update_lead; find_slots; hold_slot where supported; confirm_booking; reschedule/cancel with appropriate verification; request_transfer; create_callback; record_consent; log_outcome. Each has schema, tenant scope, permission, idempotency, result contract and failure behavior. Never expose raw SQL, arbitrary HTTP or unrestricted code execution to the call agent.

Handle interruption/barge-in, silence/noise, ambiguous names/emails, DTMF when supported, unsupported language, caller asking for a person, unavailable humans, dropped calls, duplicate/out-of-order events and provider outages. Never invent a booking, price, discount, policy, service coverage, refund or emergency dispatch. If a tool fails or outcome is unknown, explain limitation and create an actionable callback rather than claim success.

Separate inbound answering, outbound calling, recording and transcription policies. Build current-law/provider-review gates without inventing legal conclusions. A declined recording choice must follow the configured alternative. Sensitive topics and emergency language use reviewed escalation paths. Secure recordings/transcripts; restrict staff access and deletion/retention.

Use an appropriate hosted voice runtime verified for persistent audio connections; do not assume existing short-lived API handlers can host them. Provider adapters should support the selected actual stack, not every conceivable vendor. Twilio/speech providers are candidates until inspected. Measure latency, call failures, transfers, bookings, unanswered callbacks, costs and QA samples. Define pilot targets before declaring readiness.

12. CRM, funnels, calendars and automation

One shared CRM with configurable pipelines for Nova sales, client sales, Crystal service jobs and other approved industries. 'All CRMs' means reusable CRM capabilities and selected working connectors, not copies of every commercial CRM in existence.

Contacts/accounts/leads: searchable lists, detail timelines, source/UTM or manual networking source, owner, consent, location, activities, documents, notes, duplicate review, next action and authorized import/export. Protect CSV exports and imports; support field mapping, validation preview, duplicate report, reversible imports and formula-injection defenses.

Deal pipeline: New → Assigned → Attempted → Connected → Qualified → Discovery → Proposal → Accepted → Payment condition satisfied → Onboarding, with lost/disqualified/nurture/paused. Store stage history and explicit criteria. Reply, acceptance, settled payment and service delivery must not be inferred from generated summaries.

Outreach: approved templates, permitted audience, sender identity, time windows, maximum attempts, stop-on-reply/booking/opt-out, bounce handling, suppression and human takeover. Authenticate senders and verify actual delivery status where supported. No unauthorized real outreach during development.

Calendar engine: services, duration, resources, availability, timezones/DST, buffers, minimum notice, holiday closure, holds/expiry, rescheduling/cancellation rules and race-safe final confirmation. Verify provider state and reconcile ambiguous timeouts before retrying. Test double booking and disconnected calendars.

Workflow builder: versioned templates with trigger, eligibility/filter, action, delay, branch, timeout, retry and escalation. Begin with reliable predefined flows; do not require an elaborate visual editor before workflows work. Every run shows steps, inputs, results, errors, next retry, approvals and cancellation. Support replays without duplicate external side effects.

Templates: new lead assignment; missed-call response; discovery reminders; permitted no-response follow-up; audit inputs reminder; deadline escalation; proposal reminder; job reminders; completion thank-you; configured post-job review request; recurring-service reminder; dormant-customer reactivation. A 14-day post-job review can be a configurable template, not an assumed universal policy. Stop schedules when records close, consent changes or an organization disconnects.

External CRM connectors need field mapping, source-of-truth ownership, stable provider IDs, sync direction, conflict resolution, deletion behavior and health. Implement selected providers supported by existing code/confirmed needs; registry entries for other vendors must say not implemented.

13. Installations, customer provisioning and repeatable delivery

Installation Center is mandatory. For each customer choose modules/template version, confirm authorized organization, collect location/contact/service rules, assign users, connect providers, import approved data, configure policies, run sandbox tests, review costs, obtain activation authority, then activate and monitor.

Installation state: draft → prerequisites missing → configured → test-ready → tests failed/passed → awaiting activation → active → degraded/paused → offboarded. Track product version, configuration version, installer, owner, permissions, environment, dependencies, tests/evidence and rollback. An unconnected adapter is not ready for customer installation.

Provide exportable configuration templates with secrets omitted; changes create versions. Prevent tenant data or credentials leaking when cloning a template. Include dependency checks, per-module entitlements, usage limits, supported services, human support contacts, and revalidation after updates.

Build one-click or guided scoped pause for calls/messages/agents/publishing; define offboarding and number/provider ownership consequences, data export and retention. Do not delete client records as a side effect of cancellation. Upgrade one pilot installation before broad rollout and maintain backward compatibility.

Installation acceptance requires two independent test organizations with different users, numbers/calendar accounts or sandbox equivalents, policies and sample records; prove isolation through UI, direct API and background jobs. Demonstrate repeatable configuration without editing source code per customer.

14. Nova running Nova, then Crystal, then additional companies

Nova is the first real pilot: inquiry → CRM assignment → discovery → order/agreement → audit → review/report → recommendation → approved Wave One/CRM installation → support → measured outcome. Include recruitment, training, projects, actual invoice/payment signals and owner daily briefing. Use authorized real data only after activation gates; demos remain labeled.

Crystal/Company 002 reuses the platform, with provisional internal name until Isaac approves replacement. No public website work now. Physical-service modules: customers/properties; approved service catalog and areas; quote inputs/photos; versioned estimate rules/add-ons; customer acceptance; scheduling; worker assignment; travel/route considerations; equipment/supplies; before/after documentation; job checklist; completion approval; invoice/payment; feedback; recurring service and cost-based profitability.

Services, prices, worker model, insurance and legal ownership are not established by a software template. Keep unknowns configurable and block external promises pending confirmation. Workers see only assigned jobs and necessary customer details. An AI cannot declare physical completion without actual authorized completion evidence.

Additional companies use templates and isolated modules; onboarding another company should not require a fork of the app. Authorized external clients and owned ventures are different relationship types.

15. Hiring and Academy — finish reported work, do not restart

Inspect reported commits and migration/test files. Retain ten actual programs, lessons, quiz material, enrollment and practical-review logic. Verify answer-key isolation and server-side grading rather than trusting hidden UI. Test passing/failing/critical failures, retakes, duplicate submissions, manager reviews, certificate issuance/revocation and minimal public verification.

Hiring flow: received application → administrator review/interview → decision → secure canonical invitation → applicant/candidate membership → assigned Academy → practical approval → working agreement status → separate administrator activation. Candidate access must be self-scoped even when internal organization membership is used. Do not grant all staff privileges to candidates. Avoid leaking other enrollments, applications, notes or files.

Account migration must preserve prior applications and safely link verified identities; retiring an insecure endpoint does not automatically migrate users. Admins cannot bypass agreement/training requirements silently. Keep 80% as a proposed configurable threshold pending Isaac's approval. Compensation rules and classification remain approved-business inputs, not guesses.

Private uploads need actual buckets/policies, file validation, permitted MIME/size, scanning hook, signed downloads and retention. Map all existing consumers before bucket changes. Public portfolio assets must not share public access with resumes/contracts/invoices. Include storage in the final install package and use local buckets to test now.

16. Zion Studio — real journal to character video

Create a Daily Journal accepting text or optional voice notes: date, what Isaac did, time spent, wins/setbacks, lessons, next plan, supporting records, private facts and allowed disclosures. Retrieve existing character references and preserve them. Missing references block rendering, not development of the Studio. Do not design a new personality as if approved.

Examples such as 'worked three hours,' 'signed two clients,' or 'gave a professor a pamphlet' are not established facts until Isaac confirms the event. Distinguish submitted proposal, signed agreement and received payment. Never manufacture business success, wealth, college experiences, customer quotes or relationships to meet a posting target.

Pipeline: journal → confirmed facts/privacy → story angle → hook/script → storyboard → approved character assets/voice → video rendering → editing/subtitles/music rights → factual/visual checks → ready batch notification → Isaac approval → schedule/publish or export → provider confirmation → analytics.

Daily target 7–10 videos is configurable capacity, not guaranteed output. One real event can support a recap, lesson, process explanation or reflection but not fictional new events. Track unique stories versus platform variants. If facts or quality are insufficient, produce fewer or request input. Validate words like 'today' against publication date.

Studio tabs: Journal, Ideas, Scripts, Production, Review, Calendar, Published, Analytics, Revenue and Profile Bible. Video record includes fact sources, script/version, character reference version, voice/asset rights, storyboard, provider IDs, cost, final video, thumbnail, captions, platform variant, disclosure, destination account, QA results, approval version, schedule, publish ID and metrics freshness.

Review card offers playable preview and exact caption/account plus Approve, Request Changes, Reject, Download, Schedule. Material revisions invalidate approval. Default notifications batch ready work; failures/disconnects are actionable. Private customer/professor details require appropriate disclosure permission. Clearly distinguish avatar/dramatization from real footage.

Goal tracking distinguishes revenue, costs, profit, collected cash and personal net worth. Personal assets/liabilities stay private. Do not assert millionaire progress from views or pipeline value. Sponsorship/affiliate opportunities require eligibility, rights, disclosure and authorized agreements.

17. Autonomous marketing and content operations

Build a persistent marketing engine, not a button that generates one caption. Per brand configure audience, positioning, approved claims/assets, channels, voice, prohibited topics, cadence, budget, approval/autonomy policy, destination accounts and success metrics. Nova and Zion can discuss the same real company-building work but publish intentionally different content.

Workflow: audience/question research → topic clusters and duplicate review → calendar → briefs → scripts/articles/visuals/videos → source/fact checks → platform adaptations → quality/rights checks → approval or valid standing policy → scheduled publication → confirmed delivery → analytics → proposed improvements.

Support TikTok, Instagram, LinkedIn, YouTube and Facebook as target channels with provider adapters. Verify account/API capabilities before saying auto-publishing is supported. If an actual platform requires manual posting or approval, provide downloadable media/copy and track that handoff honestly. Build newsletter subscribers/preferences/suppression and approved campaigns; do not send real campaigns in development.

Blog/SEO engine in scope: topic intent, questions/keywords, content drafts, sources, editorial review, metadata, internal-link suggestions, canonical slug proposals, article versions, Search Console/analytics adapters and conversion reporting. Public website redesign, page publication and sitemap changes are deferred; content can be approved and queued/exported for later publication. Do not let a Website Agent change the public site during this build.

Autonomy settings: observe; draft; per-action approval; bounded execution under an explicit standing policy. Standing policies specify company/channel, allowed content/actions, spend/frequency limits, audience restrictions, review exceptions, validity and kill switch. Unknown policy means draft-only. Isaac's Zion final-video approval remains required unless he explicitly changes it. Never equate 'full autonomous marketing' with unlimited spending or permission to invent claims.

Automate scheduling, retries, eligible routine updates, analytics and approved content distribution within policy. Pause on opt-out, account disconnect, policy conflict, cost cap, repeated failure or anomalous output. Ads require approved budget/campaign authority; do not launch them from a research suggestion.

18. Revenue, support and agent responsibilities

Implement shared services or deterministic workflows where adequate, with one agent runtime for tasks needing model reasoning. Each logical role needs inputs, tools, outputs, tenant scope, policy, budget, failure handling, sources and evaluations:

Capability

Inputs → result

Mandatory boundary

Diagnostic Research

Permitted sources → evidence/draft findings

Source traceability and human report review

Revenue Intelligence

Actual calls/leads/deals/payments → leakage hypotheses

No unsupported recovered-revenue claims

Revenue Opportunity

Market evidence → costed experiment proposals

No spend/account/contract action without authority

Nova Revive

Eligible dormant contacts → approved reactivation

Suppression, stop-on-reply, measured attribution

Reviews/Reputation

Permitted reviews → themes, responses, tasks

No fake reviews or concealment of unhappy feedback

Voice/Email/SMS

Approved conversation context → reply/task/booking

Channel permissions, identity checks and escalation

Sales/Qualification

Lead facts → next steps, draft follow-up/proposal

No invented research, prices or commitments

Scheduling

Availability/rules → provider-confirmed booking

Conflict checks and safe retries

Operations/Support

Orders/jobs/incidents → assignments and resolution tracking

No invented completion or unauthorized dispatch

Finance Monitoring

Verified records → reconciliation/anomaly summaries

No unrestricted transfers/refunds/bank edits

Content/SEO/Video

Approved brand and sources → reviewed assets

Rights, factual claims, budget and publishing policy

Website Monitoring

Permitted health checks → incident/recommendation

Read-only for public website in this scope

QA/Security

Test/output evidence → findings

Do not present self-review as independent certification

Revenue Lab records hypotheses, audience, evidence, setup cost estimates, approved budget, test period, measurement/stop criteria, actual revenue/costs and continue/revise/stop decisions. Support multiple experiments without automatically launching all ideas. No millionaire outcome guarantee.

19. Integrations, approvals and business controls

Integration Center records provider, organization, account identity, supported/unsupported operations, scopes, secret reference, environment, connection state, last successful test/sync, expiry, errors, webhook health and usage. States: not implemented; not connected; authorization required; connected; operation-tested; degraded; disconnected. 'Connected' is not proof every action works.

Use secure OAuth/state, refresh, encrypted secret storage, signature verification, idempotent webhooks, replay control, rate-limit handling, backoff and reconciliation. Restrict tools per agent and tenant. Distinguish provider app approval, user authorization and business approval. Never solicit passwords in intake forms.

Approval Inbox unifies reports, proposals, exceptions, content, spending, installations and consequential actions. Store exact action/content version, company, destination/audience, requester, cost, evidence, policy, approver, expiry/revocation and outcome. Recheck authority and unchanged content immediately before execution. Editing approved content requires new approval unless the standing policy explicitly covers that change.

Build in-product operational policy controls for consent, suppression, recording, retention, refunds/cancellation requests, contract versions, data access/export/deletion requests, and staff agreements. Public legal-page editing is deferred. Record current legal/provider verification tasks in activation gates; do not invent universal legal rules or publish unreviewed contract terms. Unknown applicable policy blocks the affected external action, not all unrelated coding.

20. Durable runtime, safety and reliability

The system must run on hosted infrastructure when Isaac's laptop, browser and coding session are closed. Choose deployment-compatible queues/workers for scheduled workflows, audit research, media rendering and live voice. Inspect actual hosting limits and document any additional runtime requirement in the final package. Do not hide a required worker behind a serverless function that cannot support its lifetime.

Jobs require durable status, leases/locks, checkpoint/retry, timeout, cancellation, bounded concurrency, idempotency and dead-letter review. Secrets are not job payloads. Untrusted web/email/document/transcript content cannot override system or tool policy. Protect file access, uploads, tenant caches and callback endpoints.

Track costs by organization/provider/agent/workflow; distinguish estimates from delayed bills. Enforce call duration, render retries, concurrency and budget caps; include global and per-company pause. No paid pilot beyond authorized limits.

Monitor login errors, API failures, lost/failed submissions, queue age, delivery failures, phone health, provider sync, storage errors and cost anomalies. Assign a human incident owner and escalation. Preserve audit trails with minimal sensitive content. Use backup/restore procedures, retention and isolated restoration tests. Missing storage must cause an honest actionable error, never a success toast.

21. Test while building; review everything together

Isaac wants a consolidated final review, not zero testing until the end. Maintain tests during development and fix regressions as they appear. Test local migrations against a fresh schema and an upgrade fixture matching existing structure. Verify policies, grants, triggers, functions and constraints; IF NOT EXISTS and absence of DELETE alone do not prove compatibility or security.

Use automated unit/domain, RLS/API authorization, integration, browser, webhook/retry, concurrency, accessibility and relevant performance checks. Distinguish simulator, sandbox-provider and live-provider evidence. Tests must preserve intended behavior; fix code or legitimate test defects with explanation, not assertions merely to turn failures green.

Required acceptance journeys:

ID

Journey

Evidence

T01

Login/reset → real owner dashboard → refresh/logout

Correct environment/session/membership; no bypass

T02

Company switch + forbidden direct API/file/job access

No cross-tenant data or permissions

T03

Manual/existing form lead → intake → audit order → evidence/report → approval/delivery

Durable linked records; truthful deadline/coverage

T04

Approved recommendation → Wave One installation

Scoped versioned configuration and prerequisites

T05

Inbound/missed call → CRM → permitted response → appointment/handoff

Single outcome per call; actual confirmation or honest fallback

T06

CRM follow-up → reply/opt-out → stop

No subsequent prohibited queued send

T07

Two callers book same slot; timeout/retry

No duplicate booking; reconciled outcome

T08

Application/invite → Academy → practical review → agreement → admin activation

Candidate isolation; server grading; no self-activation

T09

Private resume/contract/report upload/download

Persistence, authorization, expiry and failure handling

T10

Crystal quote → booking → assignment → completion → invoice/feedback

No invented prices/completion/payment

T11

Confirmed Zion journal → real character asset/video pipeline → Isaac approval

Fact provenance, asset references, costs and version binding

T12

Marketing schedule → policy check → sandbox/authorized publication → metrics

Correct brand/account; retry reconciliation

T13

Client installation cloned from template

No copied tenant data/secrets; second-tenant isolation

T14

Disconnect/revoke/budget cap/outage → pause/escalate

No unauthorized residual job execution

T15

Backup restore + migration upgrade + production smoke checklist

Recovery evidence and version match

Provide an isolated networking demo with labeled synthetic data, reset script and no real outbound actions. Include an audit walkthrough, a CRM lead flow, Wave One/call demonstration, Crystal job workflow and Zion preview. If a demo uses a simulator, show that fact; do not imply live telephone service from an animation.

22. Consolidated final installation package

Deliver docs/FINAL_INSTALLATION.md with exact ordered steps generated from the actual implementation, not invented SQL in this prompt. Include:

Target project/environment verification, current revisions, backup/recovery prerequisites.

Migration manifest with filenames, checksums, dependencies, required privileges, existing-schema checks, validation queries, partial-failure handling and applied-version tracking. Integrate pending Academy/hiring migrations without duplicate/conflicting operations.

Bucket/consumer matrix with private/public setting, file types/size, RLS/policies, signed access and retention; protect historical files.

Environment variable inventory by frontend/server/worker, required/optional status, provider source, environment, safe setup instructions and secret handling. No committed live credentials.

Auth URL/callback/sender setup, verified owner membership, invitations and privileged recovery steps.

Phone/calendar/email/social/AI provider connections, account/app approvals, numbers, webhooks, test destinations and expected cost. Clearly mark actions Isaac must authorize or perform.

Worker/queue/scheduler hosting, deployment commands, start/stop/health checks and concurrency budgets.

Policy/business settings: confirmed product scope/prices, support contacts, service areas/hours, disclosures/consent, retention, Academy threshold/agreements, Zion assets/voice and marketing permissions.

Deployment sequence: compatible schema/storage/config → backend/workers → app → smoke tests → selective module activation. Keep existing app working if a later step fails.

Commands for all real tests, expected success criteria, test-account cleanup and rollback/forward-repair steps.

Nova pilot activation → Crystal pilot → new-client installation checklist; all with accountable signoff and support handoff.

Produce one owner-action checklist grouped by account so Isaac can complete setup in a coordinated session. Do not repeatedly interrupt him for each new migration. Never claim SQL alone can complete OAuth, provider approval, phone provisioning or legal decisions. Once the setup is completed, run actual integration/live acceptance and resolve defects before declaring production readiness.

23. Execution order and session continuity

Execute in dependency order, continuing all safe available work:

Inventory/checkpoint and restore login path.

Shared tenancy, data contracts, event/job foundations, private storage and test database.

Complete split dashboard, real CRM and order management.

Complete audit orders, 24–72-hour tracking, evidence/report/delivery.

Build integration/approval/installation foundations and Wave One.

Build voice/phone, calendar, messaging, follow-up, review and reactivation capabilities.

Operate the Nova pilot locally/staging and complete Academy/hiring integration.

Build Crystal's operational workspace and repeatable client provisioning.

Build Zion Studio and full marketing workflow/SEO drafts/revenue experiments.

Complete reliability/security regression, final integrated review/demo and consolidated installation package.

After owner setup/activation authorization, verify production and repair remaining defects.

These are implementation dependencies, not permission to stop after item one or to push half-finished modules live. If one item is externally blocked, continue independent parts. Never mark an unfinished module complete simply because its route exists.

Maintain docs/PRODUCT_BUILD_STATE.md, requirement matrix, decisions, test evidence, migration manifest and exact next command/task. Update after each meaningful slice. At a forced context/session boundary, save the checkpoint and explain the genuine limitation; resume from it when execution continues. A prompt cannot remove platform/session limits and must not claim to run unattended after its process ends.

24. Final deliverables and exit criteria

Deliver implemented product code, versioned migrations/policies, repeatable installation templates, operational provider adapters, durable workers, test suites/results, owner/operator instructions, isolated networking demo, product readiness matrix and one consolidated install package.

For EACH sellable module state: features actually implemented; locally tested operations; provider-tested operations; live-tested operations; prerequisite accounts/assets/approvals; installation steps; support/cost limits; known limitations. Label Ready to demonstrate, Ready to install and Live verified separately. Do not promise customers unsupported or unactivated features.

Final owner review must let Isaac navigate the split dashboard, inspect audit orders, examine CRM/call workflows, review Zion content, inspect marketing automation, operate a Crystal test job and see exactly what remains blocked. Every metric has real provenance or a clear demo label. Every external action is authorized. Every unfinished requirement has a concrete blocker and next step.

Start now. Read this entire prompt and relevant source context, inspect the actual project, repair dashboard access, and implement the full product scope. Keep the public website unchanged. Continue until all authorized non-blocked work is implemented and verified, then hand Isaac the single precise activation package for the remaining owner-controlled setup.