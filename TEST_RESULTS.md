# Test results

Date: 2026-11-14. Environment: isolated Linux workspace, Node 22, no production or staging access. Branch `claude/launch-recovery-20261114`.

| Command | Result |
|---|---|
| `npm run lint` | Passed, no errors |
| `npx vite build` | Passed |
| `npm run verify:local` | All 27 suites passed (logic and schema syntax only) |
| `node scripts/unit_security_endpoints_test.mjs` | 14/14 |
| `node scripts/unit_business_agent_test.mjs` | 31/31 |
| `node scripts/unit_service_catalog_test.mjs` | 12/12 |
| `supabase/business-agents-migration-standalone.sql` on a throwaway local PostgreSQL 16 | Applied twice cleanly; unique and check constraints rejected bad rows; RLS on for all three tables |
| `node scripts/unit_journey_test.mjs` | 54/54. Five deliberately broken rules (price approval, payment de-duplication, offer approval, agreement approval, completion evidence) each made the suite fail |
| `supabase/customer-journey-migration-standalone.sql` on a throwaway local PostgreSQL 16 | Applied twice cleanly; duplicate first contact, deposit above price, discount above 100% and unknown stage were rejected; RLS on for all five tables |
| Headless Chrome on `/start` served with the real journey handler and an in-memory store | Customer completed: request → quote with 5% offer → typed-name acceptance → deposit invoice → time chosen → booked → balance invoice → closed. Reload kept their place. No page errors. Payments and completion were entered from the server side, as a business would |
| `node scripts/unit_revive_proof_test.mjs` | 51/51. Seven deliberately broken rules (opt-out, consent, crediting unsent messages, sent without a provider reference, estimate from two tests, cross-business data) each made the suite fail |
| `supabase/revive-proof-migration-standalone.sql` on a throwaway local PostgreSQL 16 | Applied twice cleanly; "sent" without a provider reference and "blocked" without a reason were rejected |
| Headless Chrome against `vite preview` | Home shows 8 service cards; card opens `/services#scheduling`; `/services` shows 8 sections with 8 request links; `/solutions` resolves; request form preselects the service and notes it; no horizontal overflow at 390px |

## Not run or not verified

- Nothing was tested against production or staging: no live login, no live request, no live booking.
- `scripts/e2e_company_operations_test.mjs` and the other PostgREST end-to-end suites were not run (they need the local test runtime; not set up here).
- The browser check used a stubbed availability response; the request form was not submitted.
- No real text, call, email or payment was sent or taken.
- Keyboard navigation and screen-reader behaviour of the new pages were not checked beyond focus styles being present.
