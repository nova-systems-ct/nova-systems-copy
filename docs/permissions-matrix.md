# Nova Systems — Permissions Matrix

**Date:** 2026-09-20. Live state, verified. See `data-model.md` for the underlying schema.

| Role | overview.view | intelligence.view | growth.view | execution.view | companies.view | admin.view | members.* | locations.* | documents.* | billing.* | settings.* |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `nova_super_admin` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ view+manage | ✓ view+manage | ✓ view+manage | ✓ view+manage | ✓ view+manage |
| `nova_admin` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ view+manage | ✓ view+manage | ✓ view+manage | ✓ view+manage | ✓ view+manage |
| `nova_auditor` | ✓ | ✓ | – | – | ✓ | – | – | – | view only | – | – |
| `nova_marketing` | ✓ | – | ✓ | – | ✓ | – | – | – | view only | – | – |
| `nova_sales` | ✓ | – | ✓ | – | ✓ | – | – | – | view only | – | – |
| `nova_developer` | ✓ | ✓ | – | ✓ | ✓ | ✓ | – | – | view only | – | view only |
| `client_owner` | ✓ | ✓ | ✓ | ✓ | ✓ | **–** | – | – | – | – | – |
| `client_admin` | ✓ | ✓ | ✓ | ✓ | ✓ | **–** | – | – | – | – | – |
| `client_marketing` | ✓ | – | ✓ | – | – | – | – | – | – | – | – |
| `client_employee` | ✓ | – | – | ✓ | – | – | – | – | – | – | – |
| `client_viewer` | ✓ | – | – | – | – | – | – | – | – | – | – |

**Bold `–`** on `client_owner`/`client_admin`'s `admin.view` = the Stage 4.1 fix (previously `✓`,
removed 2026-09-13/14 because `admin.view` gates Nova's own Invoices/Contracts/Nova Vault/
Documents pages, none of which are organization-scoped).

## What each permission actually gates today

Only 6 keys are checked by any frontend code (confirmed by grepping `src/App.jsx` for
`permission=`): `overview.view`, `intelligence.view`, `growth.view`, `execution.view`,
`companies.view`, `admin.view`. Every `members.*`/`locations.*`/`documents.*`/`billing.*`/
`settings.*` key exists as reference data only — nothing reads them. **Do not grant these to any
client-facing role** until a real per-organization-scoped feature exists to back them (see
`architecture.md` ADR-3).

## Known accepted gap, not yet fixed

`growth.view` and `intelligence.view` still gate some Nova-only, non-organization-scoped pages:
Referrals, Wave One, Blog, Portfolio, Newsletter (under Growth); Intake Forms (under
Intelligence). Isaac explicitly instructed not to remove these two permissions from client roles
without a concrete security issue — the fix, when it happens, should be organization-scoping
those specific child pages, not stripping the permission client roles legitimately need.

## Enforcement layers (defense in depth, all real)

1. Auth: `useAuthGuard` — must have a real Supabase session.
2. Org membership: `is_org_member()` — must have an active row for that specific organization.
3. Permission: `has_permission()` / client-side `hasPermission()` from `OrgContext` — role must
   carry the specific permission, checked against the real DB-stored role every time, never a
   client-supplied claim.
4. RLS: every tenant-scoped table's SELECT policy independently enforces #2 — frontend permission
   checks are UX (hide/restrict), not the actual security boundary.

Verified empirically (`scripts/e2e_org_isolation_test.mjs`, real throwaway users): direct
role-escalation writes are rejected (no UPDATE policy exists for `authenticated`); forged
organization-id filters return zero rows; `has_permission()` reflects only the real stored role.
