# Nova Systems — Architecture

**Date:** 2026-09-20.

## Stack

React 18.2 + Vite 6.1 (client), Vercel serverless functions under `api/*.js` (server), Supabase
Postgres + Auth + Storage (data/identity), Stripe (payments, partially wired), Resend (email),
Twilio (SMS, present but not fully wired), Anthropic (AI document/audit generation, server-side
in most places — see ADR-3), React Router 6.26, TanStack Query, Tailwind + shadcn/Radix.

One shared Supabase project (`xizmgruvuazmummotzkp`) across `nova-systems-copy` (`.app`,
canonical) and `nova-wave-one` (`.agency`, being decommissioned but not deleted — still a source
of reusable patterns).

## Key architecture decisions (ADRs)

**ADR-1: Real users are `member_type='staff'`, always.**
Decision: no separate `org_user`/`client_account`-as-Auth-user type. Every real Supabase Auth
login — Nova staff and client-side people alike — gets a `staff_user_id` membership row; the
business relationship (Nova admin vs. client owner vs. client employee) is entirely role +
organization-membership driven.
Why: an earlier design added a third `org_user` member_type for single-org-scoped client access.
Isaac explicitly rejected it: "Do not introduce a third member_type merely to rename the identity
concept." The simpler model (one identity path, role/org membership carries all the meaning) is
what's live.
Consequence: the pre-existing `organization_members` blanket "any staff row reads every org"
policy (inherited from `nova-wave-one`) still technically applies to every real user, including
client-side ones. Empirically tested to not currently leak (only one real org exists), but this
is a real, documented, accepted risk until either that policy is narrowed or every client-facing
page becomes properly organization-scoped. See audit §5.

**ADR-2: Reuse and extend `nova-wave-one`'s `organizations`/`organization_members` schema rather
than build parallel tables.**
Why: `nova-wave-one` already built this (2026-08-12), and it's live with real Nova data
(`organizations`/`organization_members`/`organization_settings`/`organization_integrations`).
Recreating it would either conflict or silently no-op (`CREATE TABLE IF NOT EXISTS`).
Consequence: this repo's migrations are careful, additive extensions verified against the live
PostgREST OpenAPI schema before being written — never assumed from either repo's `schema.sql`,
which has been proven wrong against production at least twice in this project's history.

**ADR-3: Permission-gate by area, not by fine-grained feature, until a feature is actually
organization-scoped.**
Why: `overview.view`/`intelligence.view`/`growth.view`/`execution.view`/`companies.view`/
`admin.view` are the only permission keys any frontend code checks. More granular keys
(`documents.view`, `billing.view`, etc.) exist as reference data but are deliberately NOT granted
to client-facing roles, since none of them have a real per-organization-scoped data path behind
them yet — granting the permission before the data is scoped is exactly the trap Stage 4.1 fixed
once (`admin.view` on `client_owner`/`client_admin`).
Consequence: new features should default to the coarser area-level permission unless/until they
build real per-org data scoping, at which point a finer permission becomes meaningful.

**ADR-4: No DDL execution path from the agent side.**
This environment has a Supabase service-role key (REST/PostgREST access — reads, writes, RPC
calls) but no direct Postgres connection string and no `exec_sql`-style RPC. Schema changes
(`CREATE TABLE`, `ALTER TABLE`, `CREATE POLICY`, `CREATE FUNCTION`) must be written to
`supabase/schema-update.sql` and run manually by Isaac in the Supabase SQL Editor. This is a real,
confirmed constraint (tested directly, not assumed) — plan implementation sequencing around it:
write the schema, build the application code that depends on it defensively (graceful failure if
the column/table doesn't exist yet), and clearly flag the pending manual step.

## Data flow (current, real)

```
/welcome  --(cross-origin POST, being decommissioned domain)-->  nova-wave-one's audit endpoint
                                                                          |
                                                                          v
                                                                   Supabase `leads`
/intake --(local API, api/business-intake.js)--> Supabase `intake_submissions`
                                                          |
Nova HQ (nova-systems.app, authenticated) <--- RLS-scoped queries --- Supabase (shared project)
```

## Frontend routing/permission pattern

`App.jsx` defines routes; dashboard routes are wrapped `<RequirePermission permission="X.view">`.
`OrgContext.jsx` (React context) resolves the caller's real organization memberships + role +
permission bundle via RLS-scoped Supabase queries on mount, exposes `hasPermission()`,
`currentOrg`, `setCurrentOrg` (fails closed against any org id not actually server-returned).
`DashboardRoot.jsx` wraps `DashboardLayout` in `OrgProvider` as its own lazy chunk, specifically so
`supabase-js` never bloats the eagerly-loaded homepage bundle (verified: adding the whole Stage
4/5 org/permission layer grew the main homepage chunk by ~1KB, not the ~200KB `supabase-js`
dependency).

## Testing pattern established this session

- Mocked-Supabase Playwright (`playwright-core`, installed/removed with `--no-save`, never
  touches `package.json`) for frontend logic verification with zero live network calls.
- Permanent `scripts/e2e_*.mjs` files (checked into the repo, not throwaway) for real-database
  verification: create real throwaway Supabase Auth users/orgs via the admin API, sign in with
  real passwords (not the service-role key), verify RLS/permissions for real, delete everything
  in a `finally` block regardless of pass/fail.
