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
4. Add the customer journey: four agents from first contact to closed job, the `/start` customer page, and `AGENT_PLAYBOOKS.md`.
5. Add Nova Audit customer-style tests, Nova Revive, Nova Proof and industry packs.
6. Make intake uploads private; allow the staging database in the browser security policy.
7. Make `/start` each business's lead page.
8. Add the owner's Business desk (`/dashboard/business`): prices, offers, customers, money owed, come-back list, results, assistant details.
9. Add business registration (`/register` public page, `/dashboard/registrations` approval screen) and the `business.manage` permission for client owners.
10. Add the conversation worker: a customer is taken through the journey by message, by fixed rules, with no model call. Text messages to a business number use it when the business has published services.

## Migrations

- New and NOT applied anywhere: `supabase/business-agents-migration-standalone.sql`. Run after `voice-agent-migration-standalone.sql`. Safe to re-run.
- New and NOT applied anywhere: `supabase/customer-journey-migration-standalone.sql`. Run after `crm-order-audit-migration-standalone.sql` and `voice-agent-migration-standalone.sql`. Safe to re-run.
- New and NOT applied anywhere: `supabase/revive-proof-migration-standalone.sql`. Run after `customer-journey-migration-standalone.sql`, then re-run the lockdown file. Safe to re-run.
- New and NOT applied anywhere: `supabase/business-registration-migration-standalone.sql`. Run after `revive-proof-migration-standalone.sql`, then re-run the lockdown file. Safe to re-run. Adds `business_registrations` and the `business.manage` permission (granted to nova_super_admin, nova_admin, client_owner, client_admin). **Until it is applied, saving prices, offers, payments and assistant details returns 403 for everyone**, because those actions now require `business.manage`.
- Already in production (do not reapply): `20261114001055_launch_recovery_studio.sql`, `20261114001136_executive_background_scheduler.sql`.

## Read next

`BUILD_STATUS.md`, `TEST_RESULTS.md`, `INTEGRATION_STATUS.md`, `COST_BLOCKERS.md`, `SERVICE_CATALOG.md`, then `docs/handoffs/2026-11-14-launch-recovery.md`.

## Owner actions

1. GitHub: install the Claude GitHub App on `nova-systems-ct`, or apply the patch by hand.
2. Twilio: sign in so the credentials and campaign status can be checked. Do not resubmit the campaign.
3. Supabase: the `nova-intake-files` bucket does not exist in staging or production (checked 2026-11-14), so intake uploads currently fail. Create it as a PRIVATE bucket. The code now stores files under unguessable paths and opens them only through the staff-only `business-intake?action=file-url` link, which expires after five minutes.
4. Vercel plan is Hobby (confirmed 2026-11-14). Vercel limits Hobby to non-commercial use; moving to a paid plan is an owner decision and a cost.

## First next action

Push this branch. Apply the four new migrations to staging in the order above. Open `/register`, submit a registration for Crystal Clear and one for Flare, approve both at `/dashboard/registrations`, then set real prices at `/dashboard/business` and open each business's `/start?org=<id>` link. Then compare the production migration history with the repository, deploy to a preview pointed at staging, and submit one real request through `/services` → `/service-request`.

## Prompt for the next assistant

"Read HANDOFF.md and BUILD_STATUS.md on branch claude/launch-recovery-20261114 of nova-systems-ct/nova-systems-copy. Spend $0. Verify the branch is pushed; if not, apply nova-on-recovery-branch.patch. Run npm run lint, npx vite build and npm run verify:local. Then continue with the first row in BUILD_STATUS.md that is not VERIFIED, starting with section B: re-run the request-to-appointment journey end to end on the local PostgREST runtime, then carry the service-business wording to Contact, Pricing and Footer."
