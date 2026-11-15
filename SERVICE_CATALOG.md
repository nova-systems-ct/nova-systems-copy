# Nova service catalog

Source of truth: `src/lib/serviceCatalog.js` (rendered on the homepage and `/services`). Edit that file, not this one; `scripts/unit_service_catalog_test.mjs` checks the catalog, the request form and the server stay in step.

No prices are published. Every service is "priced by quote once we agree on the work" until Isaac confirms pricing.

| Service | What Nova handles | Availability shown to customers | What actually fulfils it today |
|---|---|---|---|
| Customer care | Receive inquiries, answer approved questions, collect details, pass on exceptions | Ready to start (website requests); phone and text confirmed per business | Web request form saves the request and a follow-up task. Per-business text agent is VERIFIED LOCALLY only. No live phone or text. |
| Scheduling | Published times, single reservation, confirmation, changes | Ready to start | Request form reserves a published slot and gives a calendar file. Text reminders need the SMS account. |
| Sales support | Qualification, approved quotes, follow-up, lead status | Scoped with you first | CRM and follow-up tasks exist; quoting from an approved catalog is manual. |
| Marketing | Plans, scripts, content, video, review | Scoped with you first | Owner-only content studio produces drafts. Publishing is not connected. |
| Daily operations | Assignments, deadlines, handoffs, completion records | Scoped with you first | Executive mission queue exists for Nova itself; not offered per client. |
| Administration | Forms, documents, approved messages, recurring tasks | Scoped with you first | Intake forms and document storage exist; delivered by hand. |
| Finance support | Invoice tracking, confirmed payments, reminders, accountant exports | Scoped with you first | Invoices and Stripe records exist for Nova; not offered per client. |
| Business improvement | Evidence-based review, fixes, re-check | Ready to start | Audit workspace with evidence-linked findings. |

Request action for every service: `/service-request?service=<key>`. The form selects the closest saved choice and writes the service name into the customer's note, so it works with the production database as it is.
