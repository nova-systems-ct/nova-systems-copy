# Nova Systems — Legal and Policy Matrix

**Date:** 2026-09-20. Engineering-level inventory, not legal advice. Every "requires attorney
review" item below genuinely needs one — this document organizes what exists and what's missing,
it does not certify compliance.

## What exists today (`/terms`, `/privacy`, `/service-agreement`)

- **Terms** (`Terms.jsx`) — Services, Payment Terms (50/50 split), Cancellation (10-day review +
  admin fee), IP, Liability, Governing Law (Connecticut), Contact. Dated Jan 1 2026.
- **Privacy** (`Privacy.jsx`) — Info Collected, Use, SMS/Email/TCPA consent language, Data
  Storage (via Supabase), **named third-party services list** (Twilio, Resend, Stripe,
  Anthropic/Claude, Google, Supabase), Opt-Out, Retention, Contact.
- **Service Agreement** (`ServiceAgreement.jsx`) — Parties ("Nova Systems LLC"), Scope, Payment
  Schedule, Revisions, Timeline, Client Responsibilities, Termination, Confidentiality,
  Independent Contractor status.

All three share `LegalPageLayout.jsx`, no duplicates found, mature-reading content. **Not
independently re-verified this session** for accuracy against current practice (e.g., does the
third-party list in Privacy still match what's actually integrated — Twilio/Stripe are present in
env vars but not confirmed live-wired everywhere the policy implies).

## Legally required — needs verification against actual jurisdiction/practice

- TCPA/consent language accuracy for the real current SMS/call/email behavior (most of that
  behavior doesn't exist yet — voice agent, SMS automation — so today's consent language may be
  broader than current practice, or may need updating once those features ship).
- Recording/transcription disclosure — **not applicable yet**, no voice agent exists.
- Diagnostic engagement agreement — does not exist as a distinct document from the general
  Service Agreement; this prompt's Section 15 wants one. **REQUIRED**.
- Independent contractor classification language (Service Agreement has some) — this prompt's
  Section 51 (from the earlier Stage 4 context) explicitly warns against assuming payment method
  determines legal classification; worth attorney review before any Sales Academy/commission
  structure goes live.
- Applicant privacy (careers/`applications` data) — not covered by the general Privacy Policy
  explicitly; **REQUIRED** if Academy/recruitment expands.

## Contractually advisable

- Monitoring/analytics agreement for any client whose systems Nova connects to (Integration
  Center, when built).
- Communication consent versioning (the Privacy policy has consent language but no evidence of a
  timestamped/versioned consent record being stored per submission — worth checking `/welcome`'s
  actual write path once re-pointed locally, audit §6).

## Optional best practice

- Cookie/tracking disclosure — not confirmed whether analytics/tracking scripts are even present
  on the public site; if none exist, no disclosure is needed yet, but should be re-checked before
  adding any.
- Accessibility statement — not present as a standalone page.

## Explicitly flagged for attorney review (not to be resolved by code alone)

Sales compensation/commission legal structure, Company 002's business structure/insurance/
licensing once named, employment vs. contractor classification for Academy graduates, AI/
automation disclosure requirements for the eventual voice agent and diagnostic-report generation,
industry-specific rules for whatever verticals Company 002 ends up serving.

## No public claim policy (already largely honored)

Stage 1 already removed several unsupported claims (fake pricing tiers, "Fortune 500 technology,"
unrealistic C-suite job listings). The remaining public site should continue to follow: no
customer/result/statistic/team-size/partnership/credential/price/turnaround/guarantee/location/
integration/capability claim without a source or explicit approval state — this is a standing
constraint on all future public-page copy, not a one-time fix.
