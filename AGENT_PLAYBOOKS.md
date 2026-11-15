# Agent playbooks — the customer journey

Code: `api/_journey.js`. Tables: `supabase/customer-journey-migration-standalone.sql`. Tests: `scripts/unit_journey_test.mjs`. Status: VERIFIED LOCALLY. Not deployed, not applied to any database.

These four agents are fixed rules over saved records. They do not call an AI model, and they do not send anything through a paid provider. Each step either completes and leaves a record, or stops and names who it is waiting for. One shared rule: an agent never invents a price, a discount, agreement wording or a payment.

| Agent | Does | Works from | Produces | Stops and hands to |
|---|---|---|---|---|
| Front desk | Takes the first contact from any channel; finds or creates the customer; works out the service; books or moves the appointment | `crm_contacts`, `crm_deals`, `business_services`, `voice_calendar_slots` | Contact, deal, journey, booked slot | Customer when the service is unclear; staff when no open times exist; owner when email and phone match two different people |
| Contracts | Issues the quote; applies an approved offer; records acceptance and the agreement | `business_services` (approved price and wording), `business_offers` | Quote, accepted agreement | Owner when the price or the wording is not approved (`approval_requests`) |
| Accounting | Issues the deposit and balance invoices; records payments; issues receipts | Journey totals | Invoices, receipts | Customer for payment. Records only what a person or a verified provider event reports |
| Finance | Lists what is owed; prepares follow-up; writes the owner report | Journey events and documents | Receivables list, owner report | Nobody for follow-up unless the customer agreed to be contacted |

Stages: inquiry → qualified → quoted → agreed → deposit due → scheduling → scheduled → fulfilled → balance due → paid → closed (or cancelled).

Permissions: customer steps need the private link token issued at first contact (only its hash is stored). Staff steps need a staff session and permission in that organization; prices, offers, agreement wording and payments need owner-level permission.

Controls: a person can take over any journey (`pause`), after which the agents do nothing until `resume`. Repeated first contacts, repeated payment references and repeated steps are no-ops.

Costs: none. No model, message, call or payment provider is used by these agents.

## Not built

- Sending the customer anything by text, email or direct message. The customer sees each step on the `/start` page; outbound messages are recorded as "not sent" until a channel is connected.
- Taking payment online for a client business. Payments are entered by the business ("entered by a person"); the provider-verified path exists in the rules but nothing calls it yet.
- Wiring real social events (comment, like, follow) into `handleChannelTrigger`. The rule is tested with fixtures; no social account is connected, and TikTok does not offer business messaging to US accounts.
- The owner's dashboard screen for journeys, services and offers (the API exists: `/api/client?resource=journey`).
- AI-written replies inside the journey. The per-business text agent (`api/_businessAgent.js`) is separate and not yet joined to it.
- The executive roles in the owner brief (CEO, chief of staff, COO, CMO, CFO) are not documented here.
