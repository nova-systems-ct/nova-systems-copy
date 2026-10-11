# Nova Audit + Wave One MVP — Installation

**Status: not started.** Nothing below has been executed against staging or production. This is
the plan, assembled from what `docs/NOVA_MVP_ACCEPTANCE.md` confirmed exists and what it confirmed
is missing — not a copy of an old plan.

This document is scoped to the MVP journey (login → business intake → Nova Audit → report →
proposal → client acceptance → installation → operation → measurement). For Wave One (A)'s
per-client configuration steps (phone number, Twilio webhooks, messaging setup), see
`docs/NOVA_PILOT_INSTALLATION.md` — that procedure is still accurate for the lead-capture/call/SMS
product and is not repeated here.

## Part 0 — Before any of this: close the security gaps

Do not proceed past Part 1 until `docs/NOVA_MVP_OWNER_ACTIONS.md` §A (the RLS/isolation migration)
is authorized and applied to whatever environment Part 1 targets. Applying migrations to
production with known PII-exposure gaps unresolved would violate the standing "never weaken
security to make a workflow pass" / "never test by writing to production" rules this build
operates under.

## Part 1 — Environment

1. **Local first.** Everything in the acceptance matrix marked "Locally tested" ran against
   `scripts/testenv/`'s real, disposable PostgreSQL + PostgREST — not Supabase. Continue using this
   as the primary evidence class for any new work (per the master prompt's own instruction).
2. **Staging second.** A separate Supabase project (not a schema/branch inside production),
   separate Vercel preview deployment, separate env vars — mirroring the same discipline
   `docs/NOVA_HIERARCHY_STAGING_PLAN.md` already lays out for the paused hierarchy phase. Apply
   migrations there first, always.
3. **Production last**, and only with Isaac's explicit, per-change authorization — never as the
   first place a migration or a live-provider call is tried.

## Part 2 — Migrations, in dependency order

Migrations already written but not applied anywhere reachable, relevant to this MVP:

1. Whatever base schema the audit engine (`businesses`/`audit_cases`) and CRM
   (`crm-order-audit-migration-standalone.sql`) depend on — see `docs/FINAL_INSTALLATION.md` §2 for
   the full, still-accurate ordered list; this document does not re-derive it.
2. `supabase/installation-center-migration-standalone.sql` — real state machine, schema-validated
   (pg-mem) but never executed against a live Postgres. Apply to staging, then run
   `scripts/e2e_installation_center_test.mjs` for the first time it will have ever actually run
   successfully or failed on real behavior rather than a missing table.
3. **New, not yet written**: the RLS-tightening migration for Gaps A-2/A-3/A-4
   (`docs/NOVA_MVP_OWNER_ACTIONS.md` §A). Write it, review it with Isaac, apply to staging, verify
   with a real anon-key read attempt against each newly-locked table (expect a permission error,
   not rows) before it ever reaches production.
4. `supabase/zz-public-schema-lockdown-standalone.sql` — rerun last, safe to rerun, so newly-added
   tables actually get their `anon`/`authenticated` grants revoked.

## Part 3 — Verification before calling anything "staging verified"

- Re-run `scripts/e2e_org_isolation_test.mjs` fresh against the staging Supabase project (its 8/8
  pass is currently a 2026-09-23 self-reported result against local Postgres, not independently
  re-run this session and never run against real Supabase Auth).
- Confirm the newly-tightened RLS policies with a real anon-key `curl` against each table in Gap
  A-3's list — expect `permission denied`, not data.
- Click through the real Audit → report → proposal → acceptance → Installation Center screens as
  a real staged user, not just via API test scripts — the master prompt explicitly requires
  browser-tested, screenshotted evidence on desktop and mobile, labeled mocked- vs. real-provider.
- Confirm the client-facing order/installation status portal exists before claiming the
  "client acceptance → operation" leg of the journey is usable — it does not exist today
  (`docs/NOVA_MVP_ACCEPTANCE.md` §4).

## Part 4 — What "ready for installation" means here

Per this document's own status vocabulary (Not built / Built / Locally tested / Staging verified /
Production verified — the MVP-specific, shorter vocabulary, not CLAUDE.md's 8-term one): nothing
in this document reaches "Staging verified" until Part 3 is complete and recorded with real
evidence (screenshots, query output, curl results), and nothing reaches "Production verified"
until Isaac has explicitly authorized and observed a production run. A passing local test or a
clean build is neither.
