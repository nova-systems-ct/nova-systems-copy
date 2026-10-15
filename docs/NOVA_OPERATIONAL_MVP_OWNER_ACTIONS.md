# Nova Operational MVP — owner actions (one prioritized list)

Nothing below has been done. Each item is a separate approval or configuration only Isaac can give.

## Urgent (security and availability) — updated 2026-10-15
0. ~~Pay the overdue Vercel invoice~~ — done; both domains answer 200 again (verified 2026-10-15).
1. **Decide the GitHub repository's visibility.** `nova-systems-ct/nova-systems-copy` is **public**: code, security
   reports, the prepared production patch and prospect lists are readable by anyone. No secrets were found in its
   history. To make it private: GitHub → repository → Settings → General → Danger Zone → Change visibility → Private.
   Reversible; Vercel's Git integration keeps working for a private repository on the team plan.
2. **Disable nova-wave-one's 9 cron jobs** (verified ENABLED on 2026-10-15; the nightly job texts/emails every lead
   without an SMS-consent check). Vercel → project nova-wave-one → Settings → Cron Jobs → Disable Cron Jobs.
   This stops only the schedules; nova-systems.agency keeps serving. Rollback: the same button (Enable). The saved
   definitions are in `docs/evidence/wave-one-crons-2026-10-15.json`. (Attempted from the session; blocked by the
   permission system, so it needs you.)
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

## Before any real customer
6. **Create a staging Supabase project** and run the installation sequence there first.
   Put its keys in a local `.env.staging` file or the Vercel *Preview* environment yourself — never paste them in chat. The free Supabase plan allows two active projects; check whether that would add a charge before creating it.
7. **Choose and approve the worker host** (it must run continuously; it is not started anywhere).
8. **Twilio:** buy or assign a Nova test number; complete A2P 10DLC registration; point the webhooks; provide the Nova-owned test phones for `OPS_SEND_ALLOWLIST`.
9. **Approve real prices** for each service (one price list for Nova itself too — owner decision #8). Draft prices are never quoted.
10. **Have an attorney review the customer agreement template** and the privacy/terms text. Approval in the app is a business approval only.
11. **Decide who receives customer deposits.** Options: the business's own Stripe account (connection not built), or deposits off. Nova's test account is for Nova TEST businesses only; live payments stay disabled.
12. **Approve the AI voice disclosure wording** and whether the voice assistant should be offered at all in the first pilots.
13. **Missed-call text policy:** the default texts only callers with recorded consent. Any broader policy needs legal review and your written attestation in Settings.
14. **Attribution method, Nova fee and labor baseline** for the weekly report — or leave them blank and the report says "not calculable".

## Commercial and sales
15. **Testimonials:** provide written permission for each quote, or keep them off the site (they are removed from the homepage).
16. **/onboard packages** list unapproved prices and an AI phone agent that is not live; decide whether to keep that page published.
17. **Salespeople:** resolve classification, compensation, agreements and training before anyone sells (no unpaid arrangement is assumed lawful).
18. **Business cards / brochure:** confirm your title, the phone number and email to print, the QR destination, and the printer's specifications. Nothing has been ordered.
   Logo: the site's `public/logo.png` is 256 px (not print quality). `Downloads/Luxury gold Nova Systems logo.png` is 1672×941 px (enough for a brochure panel at print resolution) but is a raster with a different tagline ("Revenue & Intake Infrastructure"). Confirm it is the approved lockup, or supply a vector (SVG/AI/EPS/PDF). No vector file was found on this computer.
19. **Prospect lists:** approve who calls which list; no list is permission to call, text or email.
