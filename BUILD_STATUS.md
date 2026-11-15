# Build status

Updated 2026-11-14 against `Nova_Master_Build_Prompt.md`. Statuses: VERIFIED LIVE / VERIFIED LOCALLY / BUILT BUT UNVERIFIED / WAITING FOR ACCESS / WAITING FOR PROVIDER / BLOCKED BY COST / NOT BUILT. Nothing in this file is VERIFIED LIVE: this session had no production, staging, deployment or push access. Older requirement-level detail is in `docs/requirement-matrix.md`.

| Brief section | Requirement | Status | Evidence | Next action |
|---|---|---|---|---|
| A | Invoice cannot be marked paid by a short payment; amounts set by server | VERIFIED LOCALLY | `scripts/unit_security_endpoints_test.mjs` | Deploy, then pay a test invoice in Stripe test mode |
| A | Invoice email requires a staff session | VERIFIED LOCALLY | same | Deploy |
| A | Public upload limited to safe file types | VERIFIED LOCALLY | same | Make `nova-intake-files` private (owner, Supabase) |
| A | Legacy pages that kept passwords in the browser removed | VERIFIED LOCALLY | build, route list | Deploy |
| A | Login without endless spinner, session timeouts | BUILT BUT UNVERIFIED | recovery checkpoint code; not exercised here | Test against staging with a disposable account |
| A | Organization isolation for the per-business agent | VERIFIED LOCALLY | `scripts/unit_business_agent_test.mjs` | Apply migration to staging and repeat with real RLS |
| A | Source and database compatible | WAITING FOR ACCESS | Database is ahead of deployed main per handoff; not inspected | Compare migration history before any deploy |
| B | Customer care: text to a business number answered as that business | VERIFIED LOCALLY | same test, 31 checks | Needs Twilio access, budget approval, migration applied |
| B | Web request → saved request → reserved appointment | BUILT BUT UNVERIFIED | Existing flow; not re-run here | Run the PostgREST end-to-end suite |
| B | Full chain to agreement, payment, fulfilment, owner report | NOT BUILT | — | Build after the request flow is re-verified |
| C | Service-business positioning on the homepage | VERIFIED LOCALLY | headless browser run, `TEST_RESULTS.md` | Deploy; Contact, Pricing, Footer and other pages still use older wording |
| C | Service catalog with honest availability and a working request action | VERIFIED LOCALLY | `scripts/unit_service_catalog_test.mjs`, `/services` | Submit one real request per service on staging |
| C | Owner dashboard that answers "what is happening" | NOT BUILT this session | — | — |
| D | Executive roles, durable queue | BUILT BUT UNVERIFIED | recovery checkpoint; applied to production per handoff | Re-run its suite; `AGENT_PLAYBOOKS.md` not written |
| D | Two brand campaign packs with playable videos | NOT BUILT | Studio exists; no packs produced here | — |
| E | Live channels | WAITING FOR ACCESS / BLOCKED BY COST | `INTEGRATION_STATUS.md`, `COST_BLOCKERS.md` | Owner signs in to Twilio |
| E | Voice for client businesses | NOT BUILT | Provider selected only | Write adapter after reading provider docs |
| F | Apple, Google, Wallet, mobile | NOT BUILT this session | iOS branch not inspected | Inspect `codex/nova-owner-ios-20261113` |
| G | Deployment verification | WAITING FOR ACCESS | — | Needs push access and the Vercel deployment |
