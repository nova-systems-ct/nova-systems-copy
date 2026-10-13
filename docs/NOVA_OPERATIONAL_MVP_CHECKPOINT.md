# Nova Operational MVP — checkpoint (2026-10-13)

## Where things stand
- **Built and locally verified:** the inquiry-to-paid-job journey (text/form → qualification → approved price → booking →
  e-signed agreement → Stripe test deposit → fulfillment → completion → follow-up/referral → Sunday report), the Nova Audit
  (evidence → report → exact-version PDF → secure client link), Harvest, Sentry, the voice receptionist, and the owner,
  client and customer screens (desktop and phone). Evidence: `NOVA_OPERATIONAL_MVP_ACCEPTANCE.md`.
- **Not verified on any real provider or staging system.** None exists yet.
- **Launch materials prepared, not used:** website update (not deployed), card and brochure proofs (`collateral/`, not printed),
  prospect lists A–D (`prospects/`, nobody contacted), sales playbook (`docs/NOVA_SALES_PLAYBOOK.md`, draft).
- **Location:** `C:\Users\NVUBCrosbyUBMS07\nova-mvp-work`, local commits only, no remote. Nothing pushed or deployed.

## Exact next task
Isaac works through `NOVA_OPERATIONAL_MVP_OWNER_ACTIONS.md` items 1–5 (Vercel billing, wave-one crons, production
security patch, the unexplained pushes, credential rotation). Once a staging Supabase project exists (item 6), run
`NOVA_OPERATIONAL_MVP_INSTALLATION.md` sections 1–9 there and record real-provider results in the acceptance document.

## How to resume
```
cd C:\Users\NVUBCrosbyUBMS07\nova-mvp-work
npm ci
node scripts/verify_local_all.mjs          # unit + schema checks
node scripts/verify_sales_team_e2e.mjs     # every e2e suite, incl. ops, audit and browser
node scripts/e2e_ops_browser_test.mjs      # just the screens (screenshots under %TEMP%\nova-test-shots\ops)
```
To move the work into the GitHub repository later: only after the push source is resolved, and with Isaac's approval
for that push.
