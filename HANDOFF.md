# Handoff — 2026-11-14

## Where the work is

- Branch: `claude/launch-recovery-20261114`, built on `codex/launch-recovery-20261113` (741aafa).
- **Not pushed.** This workspace has no push access to the repository. The commits exist only here and in the patch file given to Isaac: `nova-on-recovery-branch.patch`.
- To apply: `git checkout codex/launch-recovery-20261113 && git checkout -b claude/launch-recovery-20261114 && git am nova-on-recovery-branch.patch`
- Nothing was deployed. Nothing was applied to any database. No money was spent.

## Commits on top of the recovery checkpoint

1. Close open invoice, email and upload endpoints.
2. Add the per-business messaging agent (SMS slice).
3. Reposition the site as a service business with an eight-service catalog.

## Migrations

- New and NOT applied anywhere: `supabase/business-agents-migration-standalone.sql`. Run after `voice-agent-migration-standalone.sql`. Safe to re-run.
- Already in production (do not reapply): `20261114001055_launch_recovery_studio.sql`, `20261114001136_executive_background_scheduler.sql`.

## Read next

`BUILD_STATUS.md`, `TEST_RESULTS.md`, `INTEGRATION_STATUS.md`, `COST_BLOCKERS.md`, `SERVICE_CATALOG.md`, then `docs/handoffs/2026-11-14-launch-recovery.md`.

## Owner actions

1. GitHub: install the Claude GitHub App on `nova-systems-ct`, or apply the patch by hand.
2. Twilio: sign in so the credentials and campaign status can be checked. Do not resubmit the campaign.
3. Supabase: make the `nova-intake-files` bucket private.
4. Confirm the Vercel plan.

## First next action

Push this branch. Then compare the production migration history with the repository, deploy to a preview pointed at staging, and submit one real request through `/services` → `/service-request`.

## Prompt for the next assistant

"Read HANDOFF.md and BUILD_STATUS.md on branch claude/launch-recovery-20261114 of nova-systems-ct/nova-systems-copy. Spend $0. Verify the branch is pushed; if not, apply nova-on-recovery-branch.patch. Run npm run lint, npx vite build and npm run verify:local. Then continue with the first row in BUILD_STATUS.md that is not VERIFIED, starting with section B: re-run the request-to-appointment journey end to end on the local PostgREST runtime, then carry the service-business wording to Contact, Pricing and Footer."
