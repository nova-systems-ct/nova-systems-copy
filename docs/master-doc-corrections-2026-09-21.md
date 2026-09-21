# Corrections to the 2026-09-20/21 "Nova Systems Claude Code Master Build Prompt"

Paste this alongside the foundation document when handing it to another conversation (e.g.
ChatGPT) for engineering-plan generation. It exists so that conversation doesn't start from stale
brand direction or re-propose work that already shipped. Everything below reflects the real state
of the `nova-systems-copy` repository as of 2026-09-21, not intent or memory.

## 1. Brand color — Section 3 of the master doc is superseded

The master doc specifies navy `#04112B` + gold `#C9A84C` + white + black as the palette. That was
correct as of 2026-09-20. On 2026-09-21, Isaac issued an explicit "FINAL EXECUTION ORDER" repair
directive reversing it:

> COLORS: BLACK, WHITE, AND GOLD ONLY — remove navy/blue backgrounds/gradients/accents/
> component-states throughout website, login, dashboards.

This is implemented and live (commits `6aeddfb`, `e3abc6a`): `NAVY` is now a value-level alias for
`BLACK` (`#0A0A0A`) in `src/lib/theme.js` and `tailwind.config.js`, so every existing consumer of
the navy token renders black. The real palette going forward is:

- Black `#0A0A0A`
- White `#FAFAFA`
- Gold `#C9A84C`
- No navy, no blue, anywhere in the product — including hover/focus/loading/mobile states.

Any engineering plan generated from the master doc should use this palette, not Section 3's.

## 2. Hero and login video — final, non-negotiable assignment

Per Isaac's explicit, twice-confirmed decision (overriding an earlier engineering judgment call
about source resolution/theme):

- **Login page**: `src/assets/video 2.mp4` only. No rotation, no alternate videos.
- **Homepage hero**: `src/assets/video 3.mp4` only. No rotation, no alternate videos.
- Both used exactly as supplied, not re-encoded, not substituted for a "better" pair.

Implemented in `src/pages/Login.jsx` and `src/components/home/HeroSection.jsx` (commit `e3abc6a`).
A new poster (`src/assets/hero-poster-v3.jpg`) was extracted directly from `video 3.mp4` to match.

## 3. What's already real (do not re-propose as new work)

- Canonical Supabase Auth (email/password + reset), zero localStorage auth bypass anywhere in the
  codebase — confirmed via a permanent, re-runnable regression script
  (`scripts/e2e_api_client_auth_test.mjs`, 22/22 passing).
- RLS-enforced multi-tenant organization isolation — confirmed via a second permanent script
  (`scripts/e2e_org_isolation_test.mjs`, 8/8 passing, including a direct role-escalation write
  attempt that the database itself rejects, not just the UI).
- Six-hub Nova HQ (Overview/Intelligence/Growth/Execution/Companies/Admin), permission-gated nav,
  organization switcher.
- `/welcome` and `/intake` write real Supabase rows and were verified end-to-end against the real
  configured providers (not mocked).
- Overview/Leads/Tasks dashboard pages run off real, organization-scoped Supabase queries — not
  the `crmStore.js` localStorage fakes that originally seeded them.
- As of 2026-09-21: Jobs/JobDetail (applicant status, notes, interview scheduling), Invoices and
  Documents (client/lead name resolution), and Newsletter (subscribers, send history) were also
  corrected from fake/localStorage-only data to real, persisted Supabase data. Newsletter's
  backing tables (`newsletter_subscribers`, `newsletter_sends`) are written to
  `supabase/schema-update.sql` but require Isaac to run them manually in the Supabase SQL editor
  before that page will show real data in production — same pattern as every other schema change
  in this project.
- base44-builder's competing, non-functional auth scaffolding (dead imports to nonexistent
  modules) has been removed from the repository.

## 4. Still genuinely open — the master doc's framing is accurate here

- **Production login is still broken.** Root cause confirmed: the Vercel Production environment
  variable `VITE_SUPABASE_URL` is set to a Supabase *dashboard* URL, not the API URL
  (`https://xizmgruvuazmummotzkp.supabase.co`). This can only be corrected from Isaac's own Vercel
  access — not something any tooling in this repository can fix. No CSP weakening was done to work
  around it, per explicit instruction.
- `DocumentGeneratorModal.jsx` still references the old fake `crmStore` data layer, but it is
  confirmed dead code (not imported by any route or page) — flagged, not deleted without asking.
- Sales Academy, the 24/7 voice/call agent, Zion Studio, the Integration Center, Revenue Lab, and
  Company 002 are all still unbuilt. The master doc's phased framing for these (Phase 3, 6, 7, 8, 9
  in its own numbering) is accurate and should be preserved in any generated plan — these require
  pricing, legal, provider, and naming decisions that cannot be invented on the codebase's behalf.
- base44-builder's GitHub write-access to this repository has not been disconnected — that is a
  manual step in GitHub/base44's own settings, outside what this environment can do.
- Zion's correction (a real, existing character-based profile documenting Isaac's actual life and
  path to becoming a millionaire — not a separate fictional entertainment identity) is noted as
  context; no code in this repository currently depends on the old framing, so there is nothing to
  correct there, only to remember going forward.

## 5. How to use this document

Treat Sections 1–2 above as authoritative corrections overriding the corresponding sections of the
master build prompt. Treat Section 3 as "already done" to exclude from a generated backlog.
Treat Section 4 as the real, current backlog — worth carrying into any generated engineering plan
essentially unchanged, since it already reflects verified repository state rather than assumption.
