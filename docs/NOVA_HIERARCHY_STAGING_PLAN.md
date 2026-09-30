# Nova Organizational Hierarchy — staging deployment plan

Status: **not started**. Nothing below has been executed. This is the plan, not a record of
completed steps. Do not apply these migrations directly to production as the next action — staging
comes first, every time.

## Why staging first

Everything in `docs/NOVA_HIERARCHY_BUILD_STATE.md` is **locally verified**: proven against a real,
disposable PostgreSQL + PostgREST instance that exists only for the duration of a test run. It has
never touched Supabase, never touched a real user session, and never been checked against
production's actual RLS policies, actual role assignments, or actual data volume. Local verification
is real evidence the code is internally correct — it is not evidence about the live system.

## Deployment order

1. **Back up production.** A full Supabase database backup/snapshot, taken and confirmed restorable,
   before any schema change touches it. This is Isaac's action (Supabase dashboard or CLI) — nothing
   here does this automatically.
2. **Create an isolated Supabase staging project.** A separate project, not a schema/branch inside
   the production project, so a staging mistake cannot touch production data or production RLS.
3. **Create a Vercel preview/staging deployment** pointed at the staging Supabase project's URL and
   service-role key (separate environment variables from production).
4. **Apply migrations 01–04 in order, to staging only:**
   - `supabase/hierarchy-01-registry-migration-standalone.sql`
   - `supabase/hierarchy-02-governance-migration-standalone.sql`
   - `supabase/hierarchy-03-work-and-reporting-migration-standalone.sql`
   - `supabase/hierarchy-04-meetings-migration-standalone.sql`
   - Re-run `supabase/zz-public-schema-lockdown-standalone.sql` last (safe to rerun — see its own
     header), so the new tables added to its coverage list actually get their REVOKEs applied.
   - Verify with `node scripts/check_migration_lockdown.mjs` before applying, and by inspecting the
     staging project's table list after.
5. **Verify authentication and owner permissions on staging**, not assumed: confirm a real
   `nova_super_admin` staff account can sign in, reaches `/dashboard/command`, and that a
   `client_owner` account genuinely cannot (the same check the browser suite's #20 proves locally —
   re-prove it against the real Supabase Auth this time).
6. **Run browser acceptance against staging.** `scripts/e2e_hierarchy_browser_test.mjs` is written
   against the local disposable harness; running the equivalent flow against staging means either
   adapting the harness to point at the staging URL/keys, or (more realistically for a first pass) a
   manual click-through of the same 22-point checklist against the real staging deployment. Either
   way, this has not been done — it is the next real gate, not a formality.
7. **Run database security checks on staging**: confirm RLS truly blocks cross-tenant reads with the
   real anon key (not just the local stub's anon key), confirm the service role key is never exposed
   to the browser bundle, confirm every new table appears in a real `pg_policies`/grants inspection
   matching what the lockdown script intended.
8. **Verify the rollback procedure.** Every migration here is additive (no DROP/TRUNCATE/DELETE), so
   the honest rollback is: stop routing traffic to the new screens/resources (a Vercel env var or
   route-level flag), not a destructive down-migration. Confirm this is actually true on staging
   before relying on it — e.g., disabling the `hierarchy`/`governance`/`workitems`/`meetings`
   resources in `api/_sales/index.js`'s dispatch table and redeploying should cleanly return 404s
   without touching any other resource.
9. **Record staging results** — pass/fail on every item above, with the actual evidence (screenshots,
   query output), in an update to this file or a new `NOVA_HIERARCHY_STAGING_RESULTS.md`. Status
   vocabulary applies: only call something "staging verified" once it has actually run there.
10. **Only then prepare a separate production change plan**, listing the exact migrations, the exact
    Vercel env vars to add, and the exact owner actions from
    `docs/NOVA_HIERARCHY_BUILD_STATE.md`'s "Owner actions" section — presented to Isaac for explicit
    approval before anything touches production. This build does not authorize itself.

## What "ready for installation" will mean here

Per `CLAUDE.md`'s status vocabulary, this work reaches "ready for installation" only once steps 1–9
above are complete and recorded — not at the point migrations exist and pass locally. It is
currently **not started** on that scale; "locally verified" is the accurate, current status.
