# Nova Pilot — Owner Actions (one consolidated list)

Everything below needs an account, permission or decision that **cannot be done from the development environment** (no DDL credential for the database, no dashboard access, no authority to create paid resources). Nothing here has been done. Do them in this order; each section says what unblocks.

Nothing is enabled silently: live texting stays **off** until you set one environment variable yourself (§E).

## A. Verify your own owner account (Master order §4)
Unproven: only a throwaway test account has been verified end to end. The known blocker for `isaac@nova-systems.app` is a **Supabase Dashboard–side email rejection** (Authentication → check the "email_address_invalid" rejection: allowed email domains / SMTP / restrictions), not an application bug. `isaac_0427@icloud.com` is the account whose membership is confirmed correct.
1. Open the live site → Login → sign in as yourself.
2. Refresh the page — you must stay signed in.
3. Confirm the organization switcher shows the organization you expect, and Admin appears in the nav (admin permission).
4. Use password recovery once (email arrives, link works, new password signs in).
5. Sign out → the dashboard must redirect to login.
Report which step fails, with the exact message. Do not give anyone else owner access by email address alone.

## B. Push and deploy
The last commits are local. `git push origin main` (this environment's push was blocked by its permission classifier and was not bypassed). Vercel then deploys. A push is not a deployment of the database changes below.

## C. Database — run in the Supabase SQL Editor, in this order
**Before anything:** take a backup (Dashboard → Database → Backups; on plans without backups, export the tables you care about). Several files are *additive* but two touch existing live tables (`blog_posts`, `marketing_brands`) — additive is not the same as safe.

Run the standalone files exactly in the order of `docs/FINAL_INSTALLATION.md` §2 (1–13), then:
- **#14 `supabase/wave1-pilot-migration-standalone.sql`** — depends on #3 (`crm-order-audit`) and #8 (`durable-jobs`).
- **LAST: `supabase/zz-public-schema-lockdown-standalone.sql`** — enables row-level security and revokes `anon` access on all 71 tables the migrations create. **Important:** 47 of those tables never enabled RLS themselves; Supabase's default grants would have let anyone holding the public (browser) key read or write them. Do not skip this file.

Notes:
- `crm-order-audit-migration-standalone.sql` was **edited** after earlier reports (new finding/report/delivery/deal columns, proposals, activities). Run the current file. It has never been applied anywhere, so there is no upgrade path to worry about.
- Each file is idempotent (`IF NOT EXISTS`), but two behaviors were **not proven by the local emulator (pg-mem)**: rerunning `CREATE TABLE IF NOT EXISTS` and the cause of one batched-`ADD COLUMN … DEFAULT` backfill discrepancy. Run each file once, in order, and stop at the first error message.
- After the lockdown file: verify from a terminal (do not paste the key anywhere) that the public key can no longer read a locked table — expected result is an error such as *permission denied*, **not** rows:
  `curl -s "$SUPABASE_URL/rest/v1/audit_evidence?select=id&limit=1" -H "apikey: $ANON_KEY"`
- Then run the e2e scripts listed in `FINAL_INSTALLATION.md` §6. They currently fail fast ("table not found"), which is the correct result until the migrations exist. Only a passing e2e run counts as database verification.

## D. Storage buckets (Supabase → Storage)
Create `portfolios` (private), `nova-vault` (private), `portfolio` (public). Details in `FINAL_INSTALLATION.md` §3.

## E. Deployment environment variables
**Vercel (web/API):** `WAVE1_PUBLIC_BASE` = `https://nova-systems.app` (the exact canonical host Twilio will call; webhooks refuse all traffic if unset), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (used to verify webhook signatures), `CALCOM_API_KEY` (optional), existing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. Server-only — never a `VITE_` variable.
**Worker (Fly.io or equivalent — see `FINAL_INSTALLATION.md` §4):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `WAVE1_PUBLIC_BASE`. Leave **`WAVE1_SEND_ENABLED` unset** until an installation has passed its acceptance checks (Installation doc step 10); setting it to `true` is the single act that permits real texts. Email sequences likewise stay dry-run without `SEQUENCE_SEND_ENABLED=true`.
Local `.env.local` already holds Twilio, Deepgram, ElevenLabs, Resend, Stripe and Cal.com-URL values — **not verified valid or connected**; no call to any of them was made from this work. Rotate any key that has ever been pasted into a chat or committed.

## F. Accounts and provider registration (new spend = your decision)
| Item | Why | Notes |
|---|---|---|
| Worker host (e.g. Fly.io) | Follow-ups, scheduled jobs | Small always-on machine; you approve the payment method |
| Twilio number + messaging registration | Real calls and texts | Registration (A2P 10DLC or current equivalent) can take time and be rejected — **check Twilio's current requirements yourself**; the system tracks status but cannot obtain it |
| Cal.com account + API key + event type | Real availability/booking | Optional; without it use request-only appointments |
| Vercel plan | Confirm the plan and the 12-function limit still hold | Currently exactly 12 top-level functions |
| Social/other platform developer apps | Not required for pilots | Deferred per the order |

## G. Business/legal decisions only you can make
- An **attorney-reviewed pilot agreement and terms** (this system stores a version label and acceptance evidence; it has no agreement text and labels nothing legally approved).
- Who pays provider costs for each pilot (required field before go-live).
- Product **pricing approval**: proposals cannot carry a price until a product has `pricing_approved = true` in the catalog. Nothing is priced by default.
- Messaging wording for each client (reviewed by that owner).
- Call recording/retention rules if you ever add recording (none exists).
- The Academy 80% pass threshold and Zion character assets (unrelated to pilots; still open).

## H. After the above — first runs
1. Internal test organization: run the full installation on a **Nova-owned** test business (Journey J) and the acceptance checklist; capture evidence in `NOVA_PILOT_ACCEPTANCE_RESULTS.md`.
2. Real Nova audit on Nova itself (Intelligence → Audit): create a case, run the public-page review, add owner-supplied evidence, write findings, approve, record delivery.
3. Only then install the first external pilot per `NOVA_PILOT_INSTALLATION.md`.
