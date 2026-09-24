# Nova Pilot — Installation Procedure

Purpose: install Wave One (missed-call follow-up, two-way text, website form, appointments, CRM, results) for one business **by configuration only** — no custom code and no new migration per client.

**Status of this procedure: written, NOT yet executed.** No migration has been applied, no provider is connected, and no step below has been run against real infrastructure. Steps marked ⚠ are known unverified. Where a provider's current rules matter (messaging registration, pricing), check the provider's own console — this document does not assert them.

Companion: `NOVA_PILOT_OWNER_ACTIONS.md` (one-time platform setup, in order), `NOVA_PILOT_ACCEPTANCE_RESULTS.md` (what has and has not been proven).

## Part 0 — One-time platform setup (do once, before any client)
See `NOVA_PILOT_OWNER_ACTIONS.md` §B–§F. Nothing in Part 1 works until the migrations are applied, the deployment has `WAVE1_PUBLIC_BASE` set, and the worker is running.

## Part 1 — Installing a client (repeat per business)

Use a **separate test organization first** (Journey J), then the real client. Do everything as a signed-in staff user with `admin.view` on the client's organization. All screens are under Growth.

1. **Client organization.** Companies → create/select the client's organization. Switch to it in the org switcher (top left). Every page below acts on the *current* organization only.
2. **Pilot record.** Growth → **Pilots** → New pilot. Then Overview:
   - Agreement: record the version of the attorney-reviewed template you used and how acceptance was evidenced. This system contains **no** agreement text and labels nothing legally approved.
   - Plan: baseline period (the weeks *before* go-live you will compare against), pilot period, who pays provider costs (required before go-live), support contact, rollback plan, offboarding plan.
3. **Phone number.** In Twilio, obtain/select the business number. **Messaging registration** (A2P 10DLC or whatever Twilio currently requires for US business texting) is a provider process that can take days-to-weeks and can be rejected. Record its real status in Messaging & Booking → Setup. Do not enable live sending before it says *approved*.
4. **Messaging & Booking → Setup.** Fill in: business timezone (blank blocks all automated sends), the number in E.164, quiet hours, frequency limits, business hours as the owner states them, **the missed-call text wording the owner has reviewed**, one human escalation contact **with a phone number** (calls are forwarded to it), provider registration status, and (optional) the Cal.com event type id.
5. **Twilio webhooks** (use the exact canonical host — Twilio does not follow redirects, and the signature covers the exact URL):
   - Voice → "A call comes in" → Webhook, HTTP POST: `https://nova-systems.app/api/client?resource=wave1&op=voice-inbound`
   - Messaging → "A message comes in" → Webhook, HTTP POST: `https://nova-systems.app/api/client?resource=wave1&op=sms-inbound`
   - Outbound delivery status is requested per message by the sender (StatusCallback → `…&op=sms-status`); nothing to configure.
   - The call-result callback (`…&op=call-status`) is supplied inside the forwarding instructions; nothing to configure.
6. **Website form** (optional). Setup → Website contact form → Create token, then have the client's site POST to the URL shown. The phone number in a form does not grant text consent; only the explicit consent checkbox field does.
7. **Cal.com** (optional). Requires `CALCOM_API_KEY` on the deployment (one Nova-controlled Cal.com account; per-client Cal.com accounts would need secret storage that does not exist yet). Put the event type id in Setup. Availability/booking then work from Messaging & Booking → Appointments; without it, use "Request only" and staff confirmation.
8. **Preflight.** Pilots → the pilot → Install & acceptance. Read every line: `fail` must be fixed; `unknown` (worker running, provider webhook registration) must be verified by hand and cannot be ticked by the system. Note `live sends enabled` is *supposed* to fail until you deliberately turn sending on (step 11).
9. **Seed the checklist**, then run each supervised acceptance test **with the owner watching** and record what was observed as evidence:
   - controlled inbound call reaches the right business; missed leg creates the right CRM record;
   - eligible missed call produces exactly one follow-up (with sending still off you will see a "dry run — not sent" message — that is the correct proof of the rule, not of delivery);
   - a reply appears in Conversations and stops automation;
   - STOP suppresses the contact and blocks later sends (including one already queued);
   - booking confirms only when the scheduling source confirms; a duplicate request does not double-book;
   - human takeover works; organization and channel pause switches work (test them, then tick the go-live "pause switch tested" item);
   - the client organization cannot see another organization's data (sign in as a client-role user and try).
10. **Go-live approval.** Owner approves; record it. Pilots → Overview → Move status through `agreed → onboarding → active`. The server refuses `active` until: agreement accepted with evidence, provider-cost payer set, and every acceptance/go-live check has evidence.
11. **Turn live sending on** *only after* step 10, deliberately: set `WAVE1_SEND_ENABLED=true` on the **worker** environment and restart it. This is the only switch that lets a real text leave. It is global to the worker; per-organization and per-channel pause switches still apply on top.
12. **Support & rollback.** Confirm the support contact with the owner. To stop immediately: Setup → Pause ALL automation (takes effect on the next job run, since eligibility is re-checked at send time). To remove the business entirely: clear the Twilio webhooks, set the pilot to `closed` with a reason, export contacts (Sales & Contacts → Export CSV), and follow the offboarding plan.

## Known limits that affect installation (be honest with the client)
- **No AI voice agent.** Calls are forwarded to a human; only an unanswered forward becomes a missed call. `docs/voice-agent-spec.md` describes a future agent; it is not built or connected.
- No delivery of appointment reminders, no manual reply from the inbox, no report renderer, no worker heartbeat/alerting, no usage/spend metering.
- Quiet-hours follow-ups are deferred to the end of quiet hours (up to three deferrals), not sent immediately.
- Merge/dedupe, import and export are staff-driven; nothing merges automatically.
- All of this is unproven against real providers until the acceptance tests in step 9 are run.
