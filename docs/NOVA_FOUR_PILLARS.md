# How Nova earns its first customer and does the work

Isaac Nova • operating specification and acceptance checklist • November 27, 2026

Nova runs customer-facing work for a business under that business’s name. A customer can ask for a service, see the terms, reserve an opening, and receive an invoice. The owner can see what happened and step in. Nova uses AI for language and preparation. The business’s approved records control commitments, capacity and money.

**First install to sell.** the web front desk for one service and one crew. The first customer should be able to complete the same job twice with different customers without an engineer, a database console or Isaac filling in hidden steps. Each additional channel earns its own demonstration before it appears on a proposal.

## The four pillars

| Pillar | Customer question | What Nova delivers | Acceptance evidence |
|---|---|---|---|
| Tell | Where are we losing people or money? | A dated baseline, the specific leak, its evidence, its uncertainty and the worker that could fix it | Source export or documented test, denominator and reviewed finding |
| Fix | Who is going to do the job? | A front desk, estimator, scheduler, billing and dispatch workers operating in the client’s own account | A customer makes a request and the agreed work, time, invoice, payment history and owner handoff appear in one record |
| Recover | What can still be saved? | Follow-up on a quiet quote, open balance, missed inquiry or returning customer where contact is permitted | A saved reason, permitted recipient, approved message, stop condition and provider result |
| Prove | What changed and what was collected? | Comparable measurements and reconciled job records; weekly owner view and monthly retest | Matched periods, source IDs, both denominators and receipts labeled by origin |

Demand is part of acquiring and converting customers. Revive is the recovery worker. Proof is the results desk. Sentry monitors worker health and exceptions across all four.

## Build and installation order

| Step | Who does the work | Action | Keep as proof |
|---|---|---|---|
| 1. Set up one business | Isaac and onboarding worker | Approve the registration, assign the legitimate owner, configure the brand, time zone, service area, reply address, calendar, handoff contact and allowed channels. Use a dedicated staging organization first. | Owner login, correct business on refresh, second organization unable to read the first |
| 2. Authorize the baseline | Owner and auditor | Agree on the period, locations, local hours, channels, permission to use records, and which customer-style tests are allowed. Prefer completed weeks. | Permission reference, source name, date range, missing records |
| 3. Measure the loss | Audit worker and tester | Import the records below, log observable customer tests, review conflicting evidence, choose one material leak. | One-page result with measured counts and a recommended worker |
| 4. Configure one service | Business owner | Set a real price or select quote by owner, approve agreement wording and deposit, publish actual available times, specify who does physical work and who takes exceptions. | Exact price, approved wording, availability and escalation route |
| 5. Run the paying-customer journey | Customer, Nova workers and crew | Submit, qualify, quote, sign, handle a deposit if required, book, assign, complete with evidence, invoice, reconcile the balance and provide a receipt. | One request ID tying the whole sequence together |
| 6. Exercise failures | Operator | Try an unknown price, changed terms, repeated message, occupied slot, partial payment, opt-out, human takeover and an unconnected channel. | Same customer and ledger after retry, a specific owner decision where needed |
| 7. Turn on permitted recovery | Owner and finance worker | Choose the first recovery type and channel. Check consent, customer identity, the reason the item is still open, and the send allowance just before dispatch. | Approved work, provider acceptance, delivery where available, no duplicate |
| 8. Close the loop | Analyst and owner | Review job records weekly and repeat the audit using the original measurement definitions monthly. | Report, open exceptions, the next improvement and person responsible |
| 9. Repeat for a second business | Installer | Install from the client’s approved facts and provider accounts. Repeat the same walkthrough as their customer. | No cross-business facts, contacts, sender identities, documents or funds |
| 10. Sell and run the proven package | Sales worker, COO and Isaac | Show the actual journey, prepare a scoped proposal with approved pricing, obtain acceptance, assign installation, and measure the client’s first completed job. | Demonstration, accepted proposal, installation receipt and first reconciled job |

The staging acceptance run and the first authorized production run are separate milestones. A card test in a provider sandbox demonstrates the integration. A paid production job requires its own authorized payment record. Record manual cash/check receipts separately throughout.

## Tell — how the audit gets useful numbers

Start with the client’s business question. For a shop that misses callers on jobs, use its inbound phone export, verify what its provider considers an answered call, and test the number during and outside published hours. A call marked “completed” may have reached voicemail. A click on a phone number tells you someone clicked. Neither establishes a conversation or a sale.

| Leak | Evidence to collect | Measure and customer test | Fix to demonstrate |
|---|---|---|---|
| Missed calls | Inbound call IDs and dispositions, permitted callback records | Live-answer count divided by known inbound outcomes. Count unknowns separately. Check one unanswered call against the callback log. | Business-specific phone answering and missed-call rescue |
| Slow replies | Inbound and first meaningful outbound timestamps in the same thread | Median and slowest typical response by channel, with unanswered threads shown separately. Send a permitted test question. | Shared inbox and front desk |
| After-hours demand | Events in the business’s local time, holiday and opening hours | Count inquiries outside those hours and their outcomes. Test after closing. | After-hours intake and booking |
| Quotes that go quiet | Dated estimates with stable quote IDs, status at cutoff | Accepted / issued with known outcome, age of outstanding estimates, and a sample of time to first quote. | Approved estimate and follow-up worker |
| Missing follow-up | CRM history, delivery attempts and opt-outs | Eligible unanswered inquiries with no follow-up. Keep refused or suppressed contacts outside the opportunity count. | Revive and staff escalation |
| Hard booking | Public booking path, slot inventory and booking record | Try a real available time with permission, count steps, confirm the reservation, release any test booking. | Live calendar and confirmation |
| No-shows and cancellations | Bookings, attendance and cancellation reasons | Eligible bookings, attended, canceled and no-show. Distinguish a missed reminder from a missed appointment. | Reminders and rebooking |
| Money owed | Invoice amounts, balances, credits and receipts at cutoff | Amount still outstanding, age, disputes and partial payments. Verify a sample against the ledger. | Billing and individually approved reminders |
| Customers who stopped returning | Last completed service and owner-set normal return interval | Count due customers without a new request. Exclude opt-outs from outreach. | Come-back worker |
| Reviews and complaints | Public reviews, private ratings, owner responses and dates | Count reply coverage and response time. Count a private rating and a posted public review separately. | Neutral review request and owner reply draft |
| Incorrect listings | Owner-approved name, hours, number, location and URLs | Compare the public Google, Apple and other relevant listings against the approved facts. Save the URL and date for each discrepancy. | Owner-authorized correction |
| Broken website handoff | Mobile page, buttons, form, destination inbox and saved CRM record | Follow the submission to a staff-visible record and a reply. A success screen alone cannot show delivery. | Web front desk and CRM handoff |

**Three evidence streams.** A dated public observation can show a broken link or conflicting opening hours. An authorized tester can measure what happened to one call or form. Owner-authorized records can measure volume across a defined period. A missing source is an explicit unknown. Keep one finding for a missed customer even if a phone, web and message record all describe the same incident.

**Importing actual records.** In the dashboard, open the audit case and choose **Customer tests → Business records and results**. Name the source account and the permission reference. Use the business’s local calendar and a complete export for the chosen dates. The file picker discards unrelated columns before transmission. The server saves aggregate measures, source, dates and audit provenance. It does not retain individual call IDs, caller numbers or invoice rows in that evidence record. Keep the original in the owner’s approved record system for a recheck.

| Export | CSV headings | Definition |
|---|---|---|
| Calls | `id,date,direction,outcome` | One stable ID per call, inbound/outbound, person/assistant/missed/voicemail/unknown; completed alone maps to unknown |
| Quotes | `id,date,status` | Issued in the period, accepted/open/declined/expired/unknown as of its end; exclude drafts |
| Invoices | `id,date,total_cents,outstanding_cents` | USD invoices issued in the period, whole cents and balance as of period end; exclude voids and credit notes |

Each date is YYYY-MM-DD. Use the same source name on a retest. Identical rows with the same ID count once. Conflicting rows reject the file. A repeated import leaves one evidence record. Different measurements for an already saved source and period require a documented correction. Provider exports with different column layouts must first be mapped to these headings. The importer cannot infer whether an operator left part of an export out.

**When to use dollars.** Three customer-style tests and the owner’s weekly inquiries, average job value and close rate are needed for the existing modeled range. The current test calculator uses half the observed unanswered share for the low case and the observed share capped at 90% for the high case. It models gross opportunity. To estimate contribution, use the owner’s gross margin separately. For example, 20 inquiries per week × 4.33 weeks × 25–50% missed × 25% closing × $250 per job gives approximately **$1,353–$2,706 per month**. Six deliberately selected tests are a small sample. A $500 unpaid balance is a receivable, and the same $500 must not also be added as a lost sale. No receipt means no claim that Nova collected this amount.

## Fix — the installable workers

| System numbers from the master | Worker and operating behavior | Acceptance test for a client |
|---|---|---|
| 1, 2, 28 | Registration, owner’s Business Desk, install controls. Approve membership, configure offers, switch on individual channels and assign the human fallback. | Owner saves terms and sees only their business. An installer can reproduce the setup. |
| 3, 4, 5, 27 | CRM, request page, branded business page and web chat. Record the source, match identity inside the business, create the deal, retain the conversation. | Submit from a customer device, then find the same inquiry and its next action in the desk. |
| 6, 29 | Front desk and language assistant. Resolve the service and answer approved questions. Route ambiguous requests to a named person. Fixed workflow can run with model spending at zero. | Ask an approved question and an unknown one, ask for a human, duplicate a submission and switch tenants. |
| 7, 21 | Estimating, agreements and offers. Apply only approved prices and offers. Show exact terms before acceptance. A change requires fresh review. | Change approved wording while a quote is open. The old submission produces no agreement. The signed document matches the displayed text. |
| 8, 11 | Scheduling and receptionist. Offer real slots in the business’s time zone. Reserve once, handle a change, route emergencies or uncertain details to staff. | Two requests for the same slot yield one booking. A real client number must pass a separate call and handoff test. |
| 9, 16, 17 | Billing, email and card collection. Issue a deposit or balance, identify the merchant, record receipts with source and reference, calculate the remaining balance. | A $199 test job with a $50 deposit and another $99 payment has $50 outstanding. A bank-confirmed payment has a provider reference. |
| 10, 12, 13, 14, 15 | SMS, Apple Messages, RCS, WhatsApp, Facebook and Instagram. Identify account and business, save the inbound message once, run the same worker and record provider outcomes. | Send from a customer-controlled account, receive a permitted reply, match both in the correct tenant. Verify suppressions and handoff. |
| 18, 19, 20 | Wallet passes, review and Revive workers. Passes link to appointments. Feedback can reach the owner. Recovery sends require permission and an open opportunity. | Install a real pass on a supported device. Give a low rating, verify the same public-review option as a high rating, opt out and verify suppression. |
| 22, 23 | Evidence-based audit and weekly scorecard. Start with a baseline, retest, and reconcile inquiry, quote, booking, fulfillment and receipt records. | Trace each reported result to evidence and match periods before reporting a change. |
| 24, 25, 26 | Dispatch, pay split and books. Assign a worker, save completion evidence, calculate the approved split on receipts and export the books. | Crew sees only its job. Compare the monthly invoice and payment export against the ledger. A recorded split does not move money. |

**One customer’s path.** A customer contacts the business. The front desk records the source, resolves the service and checks owner-approved facts. A missing price enters the owner’s queue. With an approved price, the quote includes total, deposit and exact agreement wording. A customer signs the displayed version or receives an updated quote. After a required deposit is recorded the customer can book a real opening. The crew gets the assignment and marks completion with evidence. Billing issues the balance and records receipts. Finance counts open cash separately from collected cash. At every stage the owner can see who owes the next action.

**Channel release sheet**

| Channel | Free route or working surface to demonstrate first | Evidence required before offering live operation |
|---|---|---|
| Website and embedded chat | Hosted request page and the installed client-site widget | A new visitor can reach the correct business, complete a request and see the human response |
| Phone and SMS | Simulated routing and messaging with the gates off | Client number, valid credentials, correct campaign status where required, billing authorization if a test costs money, real call/reply, missed-call and opt-out test. The existing SMS registration is read-only. |
| Facebook and Instagram | Authorized account connection, shared inbox and owner-approved offer workflow | Correct Page or professional account, webhook permission and app review where requested, actual inbound and reply receipts |
| WhatsApp | Business sender setup and the web request link | Approved sender and permitted conversation or template; real delivery and opt-out where relevant |
| TikTok | Existing Nova inbox sync/outbound adapter and a separate video-publishing adapter; a profile can link to the web front desk | Eligible authorized account, approved scope, actual incoming message and matched reply. Organic video posting and DMs require separate verification. |
| Google Search and Maps | Verified Business Profile can expose a booking link and, for eligible profiles, SMS or WhatsApp | Test the actual button on the business profile. Legacy native Google Business Profile chat was retired. |
| Android RCS | Business-agent registration and webhook adapter; standard web request link while pending | Verified agent, carrier/provider release for the target region and receipt on a supported Android device |
| Apple Messages for Business | Customer-initiated conversation after business and provider setup | Approved business identity and routing through the approved provider; test on a real Apple device |
| Email | Transactional quote, invoice, reminder and weekly report workflows | Authorized sender, business reply address, tenant match, inbox receipt and verified reply handling. Outgoing delivery alone does not establish incoming email intake. |
| Reviews and lead sites | Staff review drafts, owner-managed listing or link to the front desk | Authorized listing or supported lead-site integration, real inbound, and acknowledgement. Private feedback and business reply drafts are separate from public posts. |
| Apple/Google sign-in, wallets and apps | Web access during provider setup | Callback and account-link tests, installable pass on a device, approved app build and store release where applicable. Show the exact tested device and action. |

Provider references: [Google Business Profile contact options](https://support.google.com/business/answer/3039617?hl=en) · [Google’s retirement notice](https://support.google.com/business/answer/14919056?hl=en) · [TikTok Business Messaging API](https://ads.tiktok.com/resources/help/article/marketing-api?lang=en) · [Apple customer messaging](https://support.apple.com/en-us/102053).

## Recover — who gets contacted, why, and when the worker stops

| Trigger | Action | Stop or handoff |
|---|---|---|
| Eligible missed inquiry | Acknowledge on the permitted channel and offer the request link or human callback | Reached, refused, suppressed, claimed by staff, duplicate or out of the permitted messaging window |
| Quiet quote | Check at days 2, 7 and 30. Refer to the customer’s existing quote with the approved terms. | Accepted, declined, canceled, paused, expired, already contacted at that step or day 30 reached |
| Customer past the normal return interval | Find the last completed service, check for an active request and offer a real opening or approved incentive | New request, opt-out, active job, no valid channel or the offer stops being valid |
| Open appointment, cancellation or no-show | Match eligible customers to actual capacity, allow only one booking; ask a person to handle disputed attendance | Slot filled or withdrawn, customer declines, consent unavailable. Standalone cancellation/no-show recovery still needs its client pilot. |
| Balance still open | After seven days from issue, the owner can approve one balance reminder in Business Desk → Money owed. Before a send the worker checks the current ledger, pause, recipient, email consent and sending connection again. | Fully paid, disputed/paused, consent withdrawn, invoice void, duplicate or ambiguous provider outcome. No late fee or collections threat is generated. |
| Unhappy customer | Draft a private response and assign a call to the owner. The owner reviews public wording. | Owner resolves, customer declines contact, or policy calls for specialist handling |

An outbound attempt, provider acceptance, delivery, customer response, new job and collected receipt are different events. Older untagged returns cannot substantiate recovered revenue. A tracked return requires a sent outreach reference plus the same contact and tenant. Report the subsequent linked receipts by source. Even a linked receipt does not establish that a customer would never have returned independently.

## Prove — what the owner can check

1. Freeze the baseline. Save metric, definition, period, source account, denominator and unknowns. Use business-local dates, including holidays.
2. Show the weekly operational counts. Break inquiries down by channel, show quotes issued and accepted, bookings, completed jobs, amounts owed, money collected, unresolved feedback and open decisions. Separate provider-confirmed receipts from entries made by staff.
3. Use two complete windows of equal length from the same source. One synthetic test with 4 of 10 calls answered before and 8 of 10 afterward yields a change of **40 percentage points**. Unknown outcomes or an empty denominator suppress the trend. Season, staffing and campaign changes belong beside any claim about cause.
4. Reconcile claims. A click logs interest. An accepted quote logs intent. Booking logs capacity. Crew completion logs work. Only a receipt enters collected cash. Net profit additionally needs labor, equipment, refunds and channel cost data.
5. Deliver the owner’s summary and keep exceptions visible. The owner should be able to open one example behind a total and say what happened without asking an engineer. Monthly retests currently require an operator to supply the next complete export or run the test.

## How AI helps sell and run Nova

| Role | Real work product | Decision that stays with a person |
|---|---|---|
| Sales assistant | Triage a permitted inbound inquiry, identify the pain, draft one relevant question, name the evidence needed, propose the appropriate demonstration and save the draft on that thread. The zero-cost path uses explicit rules. | Approve the offer, price and external outreach. A stop request ends selling. An upset prospect or request for a person goes to staff. |
| Account executive | Use the CRM to qualify owner, business size, volume, affected channel, impact, decision maker and timing. Prepare a narrowly scoped proposal for a demonstrated installation. | Accept contractual terms, discounts, exceptions and financial commitments. |
| CMO / Flair / Zion | Turn an actual, permitted job into a short video, a post and a link that identifies the campaign. Attach a source to every lead. Zion represents Isaac’s real work. Measure inquiries, booked jobs and receipts per campaign. | Approve the source material, consent, brand, channel visibility, account connection and publication. Monthly views alone are insufficient to claim sales. |
| COO / installer | Provision the organization, load approved service facts, run acceptance tests, watch the worker queue, route failed deliveries to a person, handle escalations and document each handoff. | Activate the client, release a provider channel and approve the production rollout. |
| CFO | Reconcile receipts, open balances, provider costs and the owner’s pay-split rule. Flag unconfirmed payments and prevent spend above the approved allowance. | Change the zero-dollar limit, buy, transfer funds, issue refunds or approve payroll. |
| Isaac / executive committee | Review the exceptions, approve the next action and see its outcome in the work log. | Decide which verified package to sell, to whom and at what price. |

**First sales conversation.** “When someone asks for a quote while your team is on a job, who answers, and how do you know whether they ever booked?” Show their answer as a live workflow using one service they recognize. Use an authorized audit to establish their baseline. Only after a hosted customer test passes, quote the install and the ongoing operating work at Isaac’s approved price. Never use a synthetic scorecard as a customer testimonial.

## Release evidence and remaining gates

The existing [detailing demo](https://nova-systems.app/b/nova-demo) and [website chat](https://nova-systems.app/chat?b=nova-demo) are available on production. The demo has five approved services and one scheduled demo request. The recovery branch contains the operators, protected screens, local tests and adapters. See [the release evidence for this build](FOUR_PILLAR_ACCEPTANCE.md), [the detailed requirement matrix](requirement-matrix.md) and [the existing installation reference](FINAL_INSTALLATION.md). Run `npm ci --ignore-scripts`, `npm run lint`, `npx vite build` and `npm run verify:local`.

| Owner or account | Single activation step | Pass condition |
|---|---|---|
| Staging hosting and identity | Bind the staging server credential only to the recovery preview, redeploy, then sign in as the designated staging owner and as a customer in a fresh browser. | Valid session after refresh, correct business and tenant separation; one full hosted web job without operator SQL. |
| Isaac as product owner | Approve the first real client service, price or quote-only policy, deposit, wording, covered hours, handoff and channels. | Only approved facts appear on the client’s request page and signed agreement. |
| Email and provider accounts | Connect one approved channel at a time and validate the recipient-side result. Verify current quota and any fee before dispatch. | One permitted inbound and outbound action, linked delivery and opt-out test. Any charge keeps that channel paused under the current budget. |
| Cards, finance and operations | Verify the client’s merchant in test mode, exercise partial/duplicate payment and refund/dispute handling and reconcile the signed events to invoices. | Invoice balance, receipts and accounting export agree. Any production charge requires separate authorization. |
| Commercial hosting and operations | Verify the production host supports the intended commercial use within the authorized budget. Identify who owns on-call, failed jobs and monthly retests. | Installation can run while the owner’s laptop is closed; backups and a recovery exercise are documented. |
| Production | Isaac separately approves production after staging acceptance. Repeat with the real business and monitor a first consented customer job. | Customer confirms completion, owner confirms the ledger and approved channel, and Nova has permission to use any public proof. |

Other brands can use the same product with separate tenants and sender identities. Nova is the first installer. Crystal Clear remains paused for Isaac’s Enfield partner decision. Flair can later operate the acquisition channel. Aura’s personal-device work and NovaCo’s ownership decisions are separate deliverables.
