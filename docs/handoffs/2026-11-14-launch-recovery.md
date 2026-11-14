# Nova recovery checkpoint — November 14, 2026

Owner paused implementation to prepare a handoff for another coding assistant. This is an unfinished checkpoint, not a launch-readiness certification.

## Current owner direction

Position Nova as a service business that takes care of customer service, operations, marketing and administration. AI is a means of delivery. Use concrete customer outcomes and black/white/gold luxury design. Do not promise services that cannot actually be fulfilled. No spending is authorized.

## Base and environment

- Repository: nova-systems-ct/nova-systems-copy.
- Base main: ea94b47ae266baac71f6b1db28a70450dc2b1307.
- Handoff branch: codex/launch-recovery-20261113.
- Production site: https://nova-systems.app.
- Production Supabase: xizmgruvuazmummotzkp; staging: ubjnddxmdaxnbpzcmxnc. Keep them separate.
- Native iOS work is on codex/nova-owner-ios-20261113. Inspect its diff; it includes older auth files which must not overwrite newer fixes.

## Changes in this checkpoint

- Owner-only CMO studio uses the existing content_assets/content_ideas/marketing_brands schema, supports four-platform drafts, video scene plans, edits, approval invalidation, sourced manual metrics, and separate brands.
- Optional on-device model writes captions. The normal pack builder is a template, not model inference. Platform publishing is not connected.
- Executive missions can be queued durably and processed without an open browser. The database steps are deterministic; they do not train or run independent LLMs. Local model proposals require the browser.
- Session and request timeouts reduce infinite loading.
- Audit fetch reads are bounded, stalled bodies time out, access challenges are not audited, and JavaScript shells require a rendered-browser review.
- Cream editorial service section added to the existing black/gold homepage. Latest service-business repositioning has NOT yet been implemented across the site.
- Vertical browser video rendering has brand labels and improved text wrapping. Final rendering outcome was not observed before the task paused.

## ALREADY APPLIED to production — do not reapply blindly

- 20261114001055_launch_recovery_studio.sql.
- 20261114001136_executive_background_scheduler.sql.
- pg_cron job nova-executive-background runs every minute, bounded to three queued missions per tick; no provider, model, message, or payment calls.
- Cron run observed succeeded at 2026-11-14 00:12 UTC.
- No mission was newly queued in production by this work.
- New functions are SECURITY INVOKER, service-role-only. Direct anonymous/authenticated table access is revoked for studio records.
- Frontend/API code in this checkpoint has NOT been deployed by this work. The database is ahead of deployed main.

## Verified

- Local PostgreSQL/PostgREST end-to-end company operations suite passed after the studio migration and API work: owner/organization isolation, CRM/booking, audit evidence, private media, spending limits, signed webhook fixtures, duplicate handling, executive handoffs, saved drafts, revision conflicts, manual metrics, paused/concurrent queue execution.
- Audit rule/research checks: 57/57 passed with injected network/DNS fixtures.
- Spending-policy and channel-provider unit suites passed; no provider contacted.
- Production build passed before the final video text-wrapping adjustment; rerun build/lint on the exact checkout.
- Browser fixture: studio loaded, four drafts saved, and drafts persisted after reload. This was a disposable test account, not the owner login or a live provider delivery test.
- Standalone e2e_api_client_auth_test.mjs was not run successfully: it requires .env.local and failed immediately before executing. Do not obtain production secrets merely to run it; use a disposable test harness.
- Security advisor: existing warnings remain for mutable function search paths, legacy callable SECURITY DEFINER functions, and leaked-password protection. New private queue reports informational RLS-with-no-policy because clients are deliberately denied.

## Last observed blockers — recheck through read-only diagnostics

- Production Twilio credentials returned HTTP 401. No working live call/SMS delivery verified.
- Apple and Google Supabase login providers were disabled.
- Email provider accepted credentials and had a verified domain; delivery not verified.
- nova_provider_connections had no connected channel records. Connected marketing service also reported social accounts unauthenticated.
- No paid calls, texts, ads, hosted model or video-generation jobs were purchased or started.
- Existing Apple Wallet setup pass is an artifact; device acceptance, pass lifecycle and production enrollment are not proven.
- Do not submit paid SMS registrations, buy memberships, enable overages, or assume existing plan/credit usage is free.

## Resume

1. Inspect this branch and latest main; preserve unrelated changes and reconcile migrations by version/name.
2. Run focused tests and inspect the revised studio/video UI.
3. Implement the owner's service-business positioning and finish executable customer journeys.
4. Reconnect only through authorized provider flows. Show submitted, approved, connected, and live-tested as separate states.
5. Save a verified release branch, exact tests, deployment URLs, real delivery receipts and unresolved blockers. Never call this checkpoint fully launched.
