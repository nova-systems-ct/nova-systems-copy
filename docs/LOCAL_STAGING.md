# Local staging (real Supabase in Docker, on this computer)

Use this while hosted staging is unavailable. It runs real Supabase Auth, Postgres, PostgREST, Storage and a local
mail inbox in Docker on 127.0.0.1. It never touches production or any hosted project, and nothing in it belongs in
Vercel. **Passing here is not hosted readiness** — hosted staging and production still need their own runs.

## One-time setup (Isaac)
This computer has neither WSL 2 nor Docker (checked 2026-10-16; virtualization is enabled in firmware; ~23 GB free —
Docker Desktop plus the Supabase images take roughly 6–8 GB).

1. Start → type **PowerShell** → right-click → **Run as administrator**, then:
   ```powershell
   wsl --install --no-distribution
   ```
   Restart the computer when it finishes.
2. In the same kind of administrator PowerShell:
   ```powershell
   winget install -e --id Docker.DockerDesktop
   ```
   Open Docker Desktop once, accept its terms, and keep the default **WSL 2** engine. Docker Desktop is free for
   personal use and for businesses under 250 employees and under $10 million revenue; no paid plan is needed.

## Start it
```powershell
cd C:\Users\NVUBCrosbyUBMS07\nova-mvp-work
node scripts/local/staging.mjs check       # Docker running?
node scripts/local/staging.mjs up          # starts Supabase; writes .env.local-staging (git-ignored)
node scripts/local/staging.mjs migrate     # applies supabase/migration-manifest.json in order
node scripts/local/staging.mjs provision   # test owner, representative, Nova org, demo workspace
node scripts/local/staging.mjs serve       # open http://localhost:5180
node scripts/local/staging.mjs worker      # (second terminal) background worker
```
- **Test accounts:** `owner@nova-local.test` and `rep@nova-local.test`. Their generated passwords are in the
  git-ignored file `.env.local-staging-accounts` in the repository folder — open it locally; never paste it anywhere.
- **Password-recovery emails** go to the local mail inbox (Mailpit), shown by `supabase status` (usually
  http://127.0.0.1:54324). Nothing is sent to a real mailbox.
- **Supabase Studio** (tables, users, storage): http://127.0.0.1:54323.
- Stop with `node scripts/local/staging.mjs down` (the data volume is kept).

## What it configures
- Buckets (`supabase/config.toml`): private `nova-vault`, `ops-private`, `nova-intake-files`, `portfolios`;
  public `portfolio` (website case-study images).
- Auth: self-signup off (staff are provisioned); minimum password length 10; redirects to http://localhost:5180.
- Keys: the legacy JWT `anon` / `service_role` keys (the backend sends the key as a Bearer token); the script refuses
  to continue if the stack does not provide them, and refuses any non-127.0.0.1 address.
- Email stays in dry-run (`SALES_EMAIL_MODE=dry_run`), texting off (`WAVE1_SEND_ENABLED=false`), Stripe not set.

## Real providers (optional, sandbox only)
Not configured by default. To test Stripe test mode locally, add `STRIPE_SECRET_KEY=sk_test_…` to
`.env.local-staging` yourself and forward webhooks with the Stripe CLI
(`stripe listen --forward-to localhost:5180/api/stripe`, which prints a `whsec_…` to add as `STRIPE_WEBHOOK_SECRET`).
Live keys are refused by the code.
