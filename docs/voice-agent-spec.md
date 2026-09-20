# Nova Systems — Voice Agent Spec

**Date:** 2026-09-20. **Status: not started.** No telephony webhook handler, call-session model,
or voice provider integration exists in this repo. `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/
`TWILIO_PHONE_NUMBER`/`DEEPGRAM_API_KEY`/`ELEVENLABS_API_KEY` env var names exist but are not
wired to any code path in `nova-systems-copy` (worth checking whether they're used in
`nova-wave-one`, which does reference a Nova Voice engine per its own README — see
`project_nova_wave_one` memory — before assuming a from-scratch build is needed).

## Where the actual spec lives for now

The master prompt's Section 10 is the requirement of record: call modes (inbound receptionist,
after-hours, FAQ, qualification, scheduling, status lookup, warm transfer, callback/ticket,
emergency escalation), the required call flow (greeting → disclosure/consent → intent → knowledge
retrieval → confirmation → authorized actions → recap/close), business-hours/fallback behavior,
and the explicit constraints (never invent prices/availability/commitments, never take unhosted
payment data, never cross-tenant leak, always honor suppression).

## Before this becomes a real spec

1. Confirm whether `nova-wave-one`'s existing Nova Voice engine (per that repo's README, backend
   built but the real-time audio loop needs a Render.com deployment + `RENDER_STREAM_URL`) is a
   reuse candidate, a decommissioned dead end, or something in between — this matters a lot for
   scope, since a working backend already existing changes the build from "from scratch" to
   "port and adapt," the same pattern already used for auth (Stage 2) and the org/RLS foundation
   (Stage 4).
2. Decide real vs. sandboxed launch gating explicitly before any real phone number is connected —
   this prompt's own Section 10.5 requires synthetic test-call scenarios and a kill switch before
   public launch, which is good discipline to hold to given how much can go wrong (a caller
   getting an invented price quote, a cross-tenant data leak, a botched emergency escalation).

## Explicitly not claimed

No call has ever been handled by this system. No disclosure/consent flow has been built or
reviewed. This document does not imply any of Section 10's requirements have been met.
