# Incident Summary — Unauthenticated Data Exposure, 2026-09-20

Prepared for Isaac Nova. No credential or password-hash values appear anywhere in this document.

## What happened

During a security audit of `api/` (prompted by Isaac's credential-reset directive), five endpoints
were found with no authentication at all, despite returning or mutating data that should have been
staff-only:

1. `api/intake.js` `applications` (GET) — returned every job applicant's full record, including
   their `password_hash` (an unsalted SHA-256 hash of their applicant-portal password).
2. `api/intake.js` `clients` (GET) — returned the entire `clients` table.
3. `api/contracts.js` `create`/`list` (POST/GET) — returned/created contract records including
   client details.
4. `api/waves-intake.js` `list`/`update-status`/`set-spots` — returned/mutated Wave One applicant
   data and program configuration.
5. `api/notify.js` `client-message` — accepted a caller-supplied recipient email address and sent
   mail from Nova's own account with no authentication (an open relay).

All five have been fixed and re-tested against the live database with a real staff session — see
`docs/api-security-audit.md` for the endpoint-by-endpoint detail and `git log` for the individual
commits.

## Affected data categories

- Job applicant PII: name, email, phone, position, status, cover letter, references (name/phone/
  email), resume filename, portfolio links, work history free-text answers, **and password_hash**.
- Client PII: whatever `clients` table columns exist (business/contact information collected
  during the `/welcome` → `/onboard` flow).
- Contract records: client name, contract type, dates, status.
- Wave One applicant PII: name, phone, email, company, industry, revenue range, notes.

## Exposure window

**Not established with precision.** These endpoints had no authentication from whenever each was
originally written through 2026-09-20, when they were found and fixed in this session. The exact
commit each endpoint was introduced in can be found with `git log --follow` on each file if a
precise window is needed; that lookup was not performed as part of this summary since the more
urgent question — whether any real data was actually exposed — has a direct answer below.

## What was actually exposed — checked directly against the live database

This is the most important finding: **the vulnerability was real, but almost nothing real was
behind it.**

| Table | Row count (checked 2026-09-20) | Finding |
|---|---|---|
| `applications` | **0** | No applicant accounts exist. No real password hash was ever exposed by this endpoint — there was nothing in the table to return. |
| `clients` | **0** | No real client records exist. |
| `contracts` | **1** | One row, `client_name: "QA Test Client — DELETE ME"` — a test record from prior QA work, not a real client. Not yet cleaned up; low priority, flagged here rather than deleted without a separate confirmation, consistent with the same "controlled, narrowly-scoped cleanup" standard applied to other test records this session. |
| `wave_one_applications` | **table doesn't exist** | Separate finding, not an exposure — see below. |

**Conclusion: no real applicant, client, or Wave One applicant data was exposed through any of
these vulnerabilities**, because none of that data exists in the live database yet. This was
checked by direct query against each table, not inferred.

## Was the applicant password-hashing system itself compromised?

No accounts exist to compromise. The underlying design (client-computed, unsalted SHA-256,
compared server-side, real account-existence enumeration by the `no_account`/`wrong_password`
response split) remains a real architectural weakness independent of this incident — flagged in
`docs/api-security-audit.md` as a "flagged, not fixed" item for the eventual real
`api/intake.js` `check-applicant` applicant identity system. Since zero real accounts exist, there
is nothing to reset, no session to invalidate, and no unsalted hash to avoid migrating — the
directive's caution against migrating insecure hashes into a new system doesn't have a concrete
case to apply to yet. When real applicant accounts start existing, that system should move to
Supabase Auth (matching every other real identity in this platform) rather than being extended.

## Separate, unrelated finding from the same investigation

While checking these four tables directly, found that `api/waves-intake.js` has referenced a table
named `wave_one_applications` that has never existed in this Supabase project. Every real
`/waves/form` submission has silently failed to save while still returning a success response to
the applicant. This is not a security exposure (nothing was leaked — the opposite: nothing was
even recorded) but is a real, ongoing data-loss bug, now fixed in code and pending a migration —
see the dedicated commit and `supabase/schema-update.sql`.

## Unresolved questions

- **Legal/notification obligations**: whether this incident triggers any breach-notification
  requirement is a question for qualified legal review, not something resolved by this summary or
  by the fact that no real data was ultimately exposed. Flagging per Isaac's explicit instruction
  not to assume a patch eliminates that question.
- **Precise exposure window**: not established (see above) — available if needed via `git log
  --follow` on each affected file.
- **Whether these endpoints were ever actually deployed to production with real traffic reaching
  them**: this environment has no Vercel deployment-log access to check. If `nova-systems.app` was
  live and these routes were reachable, the vulnerability existed in production for however long
  that deployment was live, even though — per the direct table checks above — nothing real was
  behind it to take.

## Access logs

No access logs were available to this session (no Vercel log access, no separate WAF/CDN log
source identified in this codebase). If Vercel's own request logs retain history for this project,
that would be the place to check for any actual exploitation attempts against these five endpoints
before the fix — not done here.
