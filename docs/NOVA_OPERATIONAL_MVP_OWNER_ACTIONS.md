# Nova Operational MVP — owner actions (one prioritized list)

Nothing below has been done. Each item is a separate approval or configuration only Isaac can give.

## Urgent (security and availability) — updated 2026-10-15
0. ~~Pay the overdue Vercel invoice~~ — done; both domains answer 200 again (verified 2026-10-15).
1. **Decide the GitHub repository's visibility.** `nova-systems-ct/nova-systems-copy` is **public**: code, security
   reports, the prepared production patch and prospect lists are readable by anyone. No secrets were found in its
   history. To make it private: GitHub → repository → Settings → General → Danger Zone → Change visibility → Private.
   Reversible; Vercel's Git integration keeps working for a private repository on the team plan.
2. ~~Disable nova-wave-one's 9 cron jobs~~ — **done 2026-10-16 02:25:53 UTC** through the Vercel API (project-level cron switch, `PATCH /v1/projects/prj_rtU7PJD1cQsmdo2iIVVlAFmAEcAO/crons {"enabled":false}`), on Isaac's 2026-10-15 instruction. All 9 definitions remain; nova-systems.agency still serves. Rollback: Vercel → nova-wave-one → Settings → Cron Jobs → Enable (or the same call with `true`). Snapshot: `docs/evidence/wave-one-crons-2026-10-15.json`.
3. **Give the session database access for a backup and the security patch**, or run them yourself: Supabase →
   project → Database → Backups (confirm a recent backup exists), then apply
   `supabase/security-repair-2026-09-30-production-patch-standalone.sql` and the columns file in the SQL editor
   after staging passes (item 6). The session could not read local credential files (blocked).
4. **The October 1 pushes are explained as far as GitHub records go:** GitHub's activity log attributes both to
   your account `isaac0427-ship-it` (same as all other pushes, including the one you made today). Check
   github.com → Settings → Security log for 2026-10-01 13:40–13:57 UTC to see which app/token (e.g. Git Credential
   Manager, VS Code) carried it. If you don't recognize it, revoke that token.
5. **Rotate credentials** in the order of `docs/SECURITY_CREDENTIALS_AND_LEGACY_PAUSE_PLAN_2026-09-30.md`. Also change
   the password you pasted into the Claude chat on 2026-10-15 (treat it as exposed).

## Login on the preview link (diagnosed 2026-10-15)
"Login is not configured" comes from `src/pages/Login.jsx` when `src/lib/supabaseClient.js` gets no
`VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` at build time. In Vercel project **nova-systems-copy** both are set for
**Production only**, so every **Preview** build (e.g. `mvp/operational` @ 22a6459,
nova-systems-copy-git-mvp-operational-nova-systems1.vercel.app) is built without them. Production (nova-systems.app,
`main` @ bd53133) and nova-systems.agency both contain the values and do not show this message.
Server variables are Production-only too (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, …), so a preview's API would fail
even after login. Fix = give Preview its own (staging) values for, at minimum:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (browser, rebuilt on deploy), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`APP_BASE_URL`, `SALES_EMAIL_MODE=dry_run` — then Redeploy the preview. Do not copy the production service-role key to Preview.

## Before any real customer
6. **Create a staging Supabase project** and run the installation sequence there first.
   Put its keys in a local `.env.staging` file or the Vercel *Preview* environment yourself — never paste them in chat. The free Supabase plan allows two active projects; check whether that would add a charge before creating it.
7. **Choose and approve the worker host** (it must run continuously; it is not started anywhere).
8. **Twilio:** buy or assign a Nova test number; complete A2P 10DLC registration; point the webhooks; provide the Nova-owned test phones for `OPS_SEND_ALLOWLIST`.
9. **Approve real prices** for each service (one price list for Nova itself too — owner decision #8). Draft prices are never quoted.
10. **Have an attorney review the customer agreement template** and the privacy/terms text. Approval in the app is a business approval only.
11. ~~Decide who receives customer deposits~~ — **decided 2026-10-16: each client's own connected Stripe account; Nova bills its fees separately.** Built as Stripe Connect direct charges (test mode). To use it: in Stripe (test mode) enable Connect for Nova's account; add a **Connect** webhook endpoint `https://<deployment>/api/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, and put its signing secret in Vercel as `STRIPE_CONNECT_WEBHOOK_SECRET` (separate from `STRIPE_WEBHOOK_SECRET`); have each business connect its account, then enter its `acct_…` id in the business's Settings → Payments (Nova asks Stripe to confirm it is connected and can take charges). Live use stays blocked until you approve it.
12. **Approve the AI voice disclosure wording** and whether the voice assistant should be offered at all in the first pilots.
13. **Missed-call text policy:** the default texts only callers with recorded consent. Any broader policy needs legal review and your written attestation in Settings.
14. **Attribution method, Nova fee and labor baseline** for the weekly report — or leave them blank and the report says "not calculable".

## Website demo and search (added 2026-10-16)
D1. **Set up the demo workspace once** (after the demo migration is applied in that environment): signed in as the Nova owner, call `POST /api/client?resource=demo&op=setup` (or ask Claude Code to run it with your session). It creates the DEMO workspace with made-up prices and a demo agreement approved under your name. Until then the site shows the worker half as "not available" — never simulated.
D2. **Optional variables:** `OPS_ALERT_EMAIL` (who is told when a demo finishes; still dry-run until `SALES_EMAIL_MODE=live`), `DEMO_IP_SALT` (any random string), `DEMO_MAX_PER_IP_PER_DAY` (default 5), `DEMO_MAX_PER_DAY` (default 300).
D3. **nova-systems.agency** still serves the old Wave One site (title "Nova Wave One", no description or canonical, no robots.txt) and is indexable — likely part of why search results describe an agency. Decide: redirect it to https://nova-systems.app (Vercel → nova-wave-one → Settings → Domains → Redirect), or keep it and accept a separate listing.
D4. **Google Search Console** (no access from this session): after the corrected site is deployed to production, verify https://nova-systems.app, submit https://nova-systems.app/sitemap.xml, and use URL Inspection → Request indexing for /, /demo, /waves, /solutions. Search results update on Google's schedule; nothing can force immediate re-indexing or control third-party AI summaries.

## Commercial and sales
15. **Testimonials:** provide written permission for each quote, or keep them off the site (they are removed from the homepage).
16. **/onboard packages** list unapproved prices and an AI phone agent that is not live; decide whether to keep that page published.
17. **Salespeople:** resolve classification, compensation, agreements and training before anyone sells (no unpaid arrangement is assumed lawful).
18. **Business cards / brochure:** confirm your title, the phone number and email to print, the QR destination, and the printer's specifications. Nothing has been ordered.
   Logo: the site's `public/logo.png` is 256 px (not print quality). `Downloads/Luxury gold Nova Systems logo.png` is 1672×941 px (enough for a brochure panel at print resolution) but is a raster with a different tagline ("Revenue & Intake Infrastructure"). Confirm it is the approved lockup, or supply a vector (SVG/AI/EPS/PDF). No vector file was found on this computer.
19. **Prospect lists:** approve who calls which list; no list is permission to call, text or email.
