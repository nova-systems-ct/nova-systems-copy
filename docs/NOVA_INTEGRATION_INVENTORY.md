# Nova integration and API-key inventory (from the code, 2026-10-18)

Built by searching every environment variable the code reads (`api/`, `worker/`, `src/`), plus the code's own
registry (`api/integrations.js`). "What you already have" comes from the production variable **names** recorded on
2026-10-17 (`docs/evidence/nova-live-audit-2026-10-17.json` → `hosting.production_variable_names`) and a public DNS
check on 2026-10-18; values were never read. The Vercel CLI is logged out on this computer, so the list could not be
re-read today.

**Where secrets go:** Vercel → project **nova-systems-copy** → Settings → Environment Variables (choose **Preview** for
staging tests, **Production** only when you go live), and the worker host's secret store. Browser-visible values start
with `VITE_` and must never be secret keys. Never paste keys into chat.

**Today on Vercel:** Production has `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, plus
`CLIENT_SESSION_SECRET`, `CRON_SECRET`, `VITE_RESEND_TO` (these three are **not read by the current code** — leftovers).
**Preview has none.** No Stripe, Cal.com or worker variables exist anywhere.

## Tier 1 — minimum to test Audit, CRM, booking and real email
| # | Service | Variables the code expects | What you need / where to get it | Where to set it | Required? | You have it? | Cost / approval | Test that proves it |
|---|---|---|---|---|---|---|---|---|
| 1 | **Supabase** (database, login, file storage) | server: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Project URL + **legacy JWT** `anon` and `service_role` keys (not `sb_publishable`/`sb_secret`): supabase.com → project → Settings → API → "Legacy API keys" | Vercel (Preview = staging project's keys; Production = production's). Service-role key never in a `VITE_` variable | **Required** | Production: yes. Staging: **no** — blocked by the overdue invoice | Invoice to pay; a second project may cost money — check plan first | T1: sign in on the Preview link; Operations loads with no "not configured" message |
| 2 | **Database schema** | — | The 38 files in `supabase/migration-manifest.json`, in order | Supabase SQL editor (staging first) | **Required** | Local only | none | Install Systems runs without "table missing" errors |
| 3 | **Vercel** (hosting) | `APP_BASE_URL` (the site's own URL, used in emailed links) | Already have the account/project; Vercel → Deployments shows the Preview URL | Vercel, Preview + Production | **Required** | Project yes; `APP_BASE_URL` **no** | Current plan | Links in emails open the right site |
| 4 | **Resend** (email) | `RESEND_API_KEY`, `SALES_EMAIL_MODE` (`dry_run` default / `live`), `SALES_EMAIL_ALLOWLIST` (test recipients), optional `SALES_FROM_EMAIL` (default `Nova Systems <noreply@nova-systems.app>`) | resend.com → API Keys; Domains → nova-systems.app must be **Verified** | Vercel | **Required for real email** | Key exists in Production. DNS: Resend's DKIM record is published, but the `send.nova-systems.app` MX + SPF records are **missing**, so the domain is likely not verified. `SALES_EMAIL_MODE` not set → every email is dry-run | Free tier exists (check current limits) | T2: book on /book with your own email → email arrives; Admin → notifications shows "sent", not "dry run" |

With Tier 1 done you can test: the full audit (case, clock policy, findings, report, PDF, client link by email), CRM and
leads, the web booking journey with emailed customer link, Demand and Revive previews, Academy, My work.

## Tier 2 — needed for texting, follow-ups and phone
| # | Service | Variables | What / where | Set where | Required? | You have it? | Cost / approval | Test |
|---|---|---|---|---|---|---|---|---|
| 5 | **Background worker** (text replies, follow-ups, Revive, escalations, weekly report, monitoring) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NOVA_WORKER_TARGET_REF` (= the Supabase project ref it may process — a safety lock), optional `WORKER_ID`, `WORKER_HOST`, `WORKER_POLL_INTERVAL_MS`, `SEQUENCE_SEND_ENABLED` | Choose a host that runs `node worker/index.mjs` 24/7 (e.g. Fly.io, Railway, Render) | Host's secret store | **Required for anything after the first reply** | **No** | Few dollars/month — your approval | T10: Operations → Monitoring shows the worker heartbeat; stopping it raises an alert |
| 6 | **Twilio** (SMS + calls) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `WAVE1_PUBLIC_BASE` (public site URL for webhooks), `WAVE1_SEND_ENABLED=true` (texts are dry-run otherwise), `OPS_SEND_ALLOWLIST` (only these numbers get texts while testing), optional `ISAAC_ALERT_PHONE` (default +1 203-706-0504) | twilio.com → Console (SID + token); Phone Numbers; **Messaging → A2P 10DLC** brand + campaign registration (required for US texting; days–weeks) | Vercel **and** worker host | Required for SMS/phone | Credentials exist in Production (working? unverified). Number, A2P status, webhooks: **unknown** | Number rental + per-message/minute + A2P registration fees — your approval | T3: text the number → reply with services and real times. T4: missed call → one text (consented numbers only) |
| 7 | **AI phone receptionist** | Twilio as above; webhook "A call comes in" → `https://<site>/api/client?resource=ops&op=voice-inbound`; an **active voice configuration with your approved disclosure script** (in the app). Speech uses **Twilio's own** speech recognition and Polly voice — no extra provider | — | Twilio console + app | Optional | **No** (voice config not active anywhere) | Twilio per-minute | T5: call → disclosed AI answers, captures the request, offers times or hands to you |
| 8 | **Anthropic** (AI) | `ANTHROPIC_API_KEY`; for understanding customer messages also `OPS_MODEL_ENABLED=true`, optional `OPS_MODEL_ID` (default `claude-haiku-4-5-20251001`), `OPS_MODEL_MAX_CALLS` | console.anthropic.com → API keys | Vercel + worker | Optional (the booking engine works without it; it also drafts proposals/contracts) | Key exists in Production | Usage-based | A free-text text message ("can you clean my car Tuesday") picks the right service |

## Tier 3 — payments and later
| # | Service | Variables | What / where | Required? | You have it? | Cost / approval | Test |
|---|---|---|---|---|---|---|---|
| 9 | **Stripe** (deposits, invoices, sales payments) | `STRIPE_SECRET_KEY` (`sk_test_…` first), `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` (client-owned deposits), browser `VITE_STRIPE_PUBLISHABLE_KEY`; safety switches `SALES_ALLOW_LIVE_STRIPE` (must be `yes` before a live key is used), `SALES_PAYOUTS_MODE=provider` (rep payouts; off by default) | dashboard.stripe.com (test mode) → Developers → API keys; Webhooks → endpoint `https://<site>/api/stripe`; Connect → enable | Optional — **not needed for Nova on Nova** (Nova's audit call is free) | **No** | Stripe fees per charge; Connect approval | A test deposit with card 4242… → job shows "deposit paid" only after Stripe's event |
| 10 | **Cal.com** (outside calendar) | `CALCOM_API_KEY`, optional `CALCOM_API_BASE`; browser `VITE_CALCOM_URL` (a booking link on /welcome) | cal.com → Settings → Developer → API keys | Optional — Nova's own calendar already works | **No** | Plan-dependent | Booking appears in Cal.com and in Nova; moving it in one updates the other |
| 11 | **Monitoring alerts** | `OPS_ALERT_EMAIL`, `OPS_ALERT_SMS_TO` (SMS alert sending is **not implemented** — recorded only), `OPS_KILL_SWITCH=true` pauses all texts and payments | — | Optional | No | none | Stop the worker → alert email arrives |
| 12 | **Website demo limits** | `DEMO_IP_SALT`, `DEMO_MAX_PER_IP_PER_DAY` (default 5), `DEMO_MAX_PER_DAY` (default 300) | any random string for the salt | Optional | No | none | /demo runs; the 6th try from one address in a day is refused |
| 13 | **Social channels** | `OAUTH_REDIRECT_BASE`, `LINKEDIN_CLIENT_ID`, `GOOGLE_CLIENT_ID` (YouTube), `META_APP_ID` (Instagram/Facebook), `TIKTOK_CLIENT_KEY` | Each platform's developer portal | **Not implemented** beyond building the sign-in link (no callback, no posting) | No | Platform approvals | — |
| 14 | **Google** | `GOOGLE_API_KEY` | — | **Not used by any feature** (registry says so) | No | — | — |
| 15 | **ElevenLabs, Deepgram** | `ELEVENLABS_API_KEY`, `DEEPGRAM_API_KEY` | — | **Not implemented** ("reserved"); the phone receptionist uses Twilio speech instead | No | — | — |
| 16 | **Apple** Messages / Pay / Wallet | `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT_P12_BASE64`, `APPLE_PASS_CERT_PASSWORD`, `APPLE_WWDR_CERT_BASE64` (readiness check only) | `docs/APPLE_MESSAGES_PAY_WALLET_SETUP.md` | **Not implemented** (only the rewards ledger is) | No | Apple Developer fee — approval | — |
| 17 | **Vapi** | — | — | **Not in this code** — your separate sales-training project | — | — | — |

Leftover Production variables not used by the current code: `CLIENT_SESSION_SECRET`, `CRON_SECRET`, `VITE_RESEND_TO`
(delete them after go-live, or keep until the old site is replaced).

## Activation order (one service at a time, each proven before the next)
1. **Supabase staging** (Tier 1 #1–2) → test: sign in on Preview.
2. **Vercel Preview variables** (#1, #3, `SALES_EMAIL_MODE=dry_run`) → redeploy → test: /book booking saved; email shows "dry run".
3. **Resend** (#4): finish domain verification (add the missing `send` MX and SPF records Resend shows), then
   `SALES_EMAIL_MODE=live` + `SALES_EMAIL_ALLOWLIST=<your email>` → test T2. **Stop here and run real audits and
   prospect conversations** (validate demand) before paying for anything in Tier 2–3.
4. **Worker host** (#5) — only when you are ready to test texting.
5. **Twilio** (#6) — start A2P registration early (it is slow and free to start), turn on texting once approved.
6. **AI receptionist** (#7, #8) — after you approve the disclosure wording.
7. **Stripe** (#9) — only when a pilot business takes deposits.

## Validating demand before spending on optional integrations
Tier 1 costs at most the Supabase plan. Without Twilio, Stripe or a worker you can already:
- run the **Demand** campaign WUETJW by phone and in person (your own phone, recorded in Nova) and offer the free audit;
- deliver real **audits** with emailed report links;
- take bookings through **/book** with emailed confirmations.
Measure: prospects contacted → audits booked → audits delivered → businesses that ask for the Agents. Buy Twilio and the
worker when businesses ask for texting and phone coverage; add Stripe when the first pilot wants deposits.
