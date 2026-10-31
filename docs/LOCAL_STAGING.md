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
  http://127.0.0.1:44324). Nothing is sent to a real mailbox.
- **Supabase Studio** (tables, users, storage): http://127.0.0.1:44323.
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

## iPad / phone on the same Wi-Fi (in-person audits and demos) — added 2026-10-25
`localhost` on the iPad means the iPad. To reach the laptop, start the app in Wi-Fi mode:

```
node scripts/local/staging.mjs serve --lan
```
It prints the address to type on the iPad, e.g. `http://10.0.0.82:5180` (the laptop's Wi-Fi address can change).

**What the iPad can reach — verified 2026-10-25 through the Wi-Fi address:** only the Nova app. The Nova API answers
401 without sign-in; sign-in works (200); the app forwards only Supabase sign-in (`/auth/v1`) and row-level-security
reads (`/rest/v1`); requests carrying the service-role key are refused (403); Supabase administration
(`/auth/v1/admin`) is refused (403); Studio, the database and the mail inbox are not served on this port. The API itself
stays on the laptop. No service-role key is ever sent to the browser.

**Close the existing exposure first (administrator, one time).** Docker publishes local Supabase on every network
interface (Studio 44323, database 44322, API 44321, mail 44324, analytics 44327) and the "Docker Desktop Backend"
firewall rule allows inbound traffic on **Public** networks — this Wi-Fi is classed Public. The Supabase CLI has no
option to bind to localhost only. (The ports moved from 5432x to 4432x on 2026-10-31: after a reboot Windows reserved
54256–54355 for its network address translation, so Docker could not publish 5432x. A block rule created earlier for
54321-54327 no longer covers anything; create the one below.) In **PowerShell → Run as administrator**:
```
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
New-NetFirewallRule -DisplayName "Nova local Supabase - block network access" -Direction Inbound -Protocol TCP -LocalPort 44320-44329 -Action Block -Profile Any
New-NetFirewallRule -DisplayName "Nova local staging - iPad on private Wi-Fi" -Direction Inbound -Protocol TCP -LocalPort 5180 -Action Allow -Profile Private
```
Checked 2026-10-31 without administrator rights: no Nova rule exists, Wi-Fi is classed Public, and ports 44321-44324 and
44327 are published on 0.0.0.0. Setting Docker's default bind address (`"ip": "127.0.0.1"` in `~/.docker/daemon.json`)
does **not** take effect with this Docker Desktop (a test container still bound 0.0.0.0 after a full stop/start), so it
was reverted; the firewall rule is the fix. After running the commands, `node scripts/local/staging.mjs check` (and
`serve --lan`) prints "the Nova firewall block rule covers 44320-44329"; until then they print a warning. To confirm by
hand: `Get-NetFirewallRule -DisplayName "Nova*" | Get-NetFirewallPortFilter | Select-Object LocalPort`.
The block rule does not affect the laptop's own access (Windows does not filter loopback). Only mark a network Private
if it is your own (home/office), never public Wi-Fi. Undo with
`Remove-NetFirewallRule -DisplayName "Nova local Supabase - block network access"` (and the same for the 5180 rule).

**On the iPad:** Safari → the printed address → sign in → Share → **Add to Home Screen** (opens full screen with the
Nova mark). Safari shows "Not Secure" because this is plain `http` on your own network; passwords travel unencrypted
over the Wi-Fi, so use it only on a network you trust, with the local test accounts.

**Limits (honest):** no offline mode — if the Wi-Fi drops, unsaved typing in an open form stays on screen but cannot be
saved until the connection returns; nothing is queued. The laptop must stay awake with `serve --lan` running. Links in
local-inbox emails point at the Wi-Fi address while `--lan` is used.

**Checks only you can do on the device:** photo/file upload from the camera, the on-screen keyboard covering fields,
portrait and landscape, touch targets, Home Screen launch, and what happens when you switch Wi-Fi off mid-form.
