# Credential Rotation Plan

Prepared 2026-09-20 as part of the mandatory credential reset. This document never contains an
actual credential value — only names, purposes, and instructions. Isaac generates and installs
every replacement value himself, directly in each provider's dashboard and in Vercel/local secret
storage; nothing here asks for a key to be pasted into chat, a file, or a commit.

**How to use this**: work down the table once, provider by provider. For each row: generate the
new credential in that provider's dashboard, put it where the "Install into" column says, update
anything the "Dependent URLs/config" column lists, then run the check in "Verify" before moving on.
Don't move old credentials aside "just in case" inside a tracked file — put the new value directly
into the real secret store (Vercel env vars, local `.env.local`) and revoke the old one at the
provider once the new one verifies.

**Inventory completeness (2026-09-20)**: the 8 providers in this document — Supabase, Stripe,
Resend, Anthropic, Twilio, Google, ElevenLabs, Deepgram — are the complete, real list of external
services this codebase connects to. Verified by: every `process.env.*`/`import.meta.env.*`
reference across `api/` and `src/` (no undocumented env var reads anywhere), `package.json`'s
dependency list (no other provider SDK installed), and a repo-wide search for OAuth flows,
additional webhook/signing secrets, and common CRM/social/calendar integration names (Calendly,
Facebook, Instagram, LinkedIn, HubSpot, Zapier, Mailchimp) — none found beyond the public,
non-secret social profile links already in the footer and the public `VITE_CALCOM_URL` booking
link. If a new integration is added later, add it here in the same pass.

**Live status without leaving the app**: `/dashboard/integrations` (staff, admin-only) is a real
Integration Center — for each provider it shows whether its env vars are present and, on demand
(a button, never automatic), runs one real check against that provider's own API and reports
Tested / Degraded / Not Connected. It never displays a credential value. Use it to confirm each
step below actually took effect instead of re-deriving status by hand.

---

## Master status table — all 8 providers, every tracked dimension

One row per credential (not per provider, where a provider has more than one) so nothing gets
collapsed into a single "done" checkbox that actually hides several separate facts. "✅" means that
specific, narrow thing is independently confirmed true — never inferred from a different column.

| Credential | In local `.env.local` | In Vercel (any env) | Found in source/Git history/bundle/logs | Provider-side revoked | Replacement installed | Replacement tested |
|---|---|---|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ set, active | ❓ unknown — check Vercel | ❌ not found anywhere (verified) | N/A — not being revoked yet, see hold note below | ❌ not started | ❌ not started |
| `VITE_SUPABASE_ANON_KEY` | ✅ set, active | ❓ unknown — check Vercel | ✅ present in bundle **by design** — public/safe, not a leak | N/A | ❌ not started | ❌ not started |
| `TWILIO_ACCOUNT_SID` | 🔲 cleared 2026-09-20 | ❓ unknown — check Vercel | ❌ not found in source/Git/bundle; **chat-exposed** 2026-09-20 (see URGENT) | ❌ **not done** | ❌ not started | ❌ not started |
| `TWILIO_AUTH_TOKEN` | 🔲 cleared 2026-09-20 | ❓ unknown — check Vercel | ❌ not found in source/Git/bundle; **chat-exposed** 2026-09-20; also independently invalid against Twilio's own API | ❌ **not done** | ❌ not started | ❌ not started |
| `TWILIO_PHONE_NUMBER` | 🔲 never set locally | ❓ unknown — check Vercel | ❌ not found anywhere | N/A — not secret, a phone number | ❌ not started | ❌ not started |
| `RESEND_API_KEY` | 🔲 cleared 2026-09-20 (found already invalid) | ❓ unknown — check Vercel | ❌ not found anywhere | N/A — not confirmed exposed, just confirmed dead | ❌ not started | ❌ not started |
| `ANTHROPIC_API_KEY` | 🔲 never set locally | ❓ **unknown — the highest-priority Vercel check, see below** | ❌ not found in current source/Git/bundle; **historical exposure via `VITE_CLAUDE_API_KEY` unresolved** (see note) | N/A | ❌ not started | ❌ not started |
| `STRIPE_SECRET_KEY` | 🔲 cleared 2026-09-20 (found already expired, live-mode) | ❓ unknown — check Vercel | ❌ not found anywhere | N/A — not confirmed exposed, just confirmed dead | ❌ not started | ❌ not started |
| `VITE_STRIPE_PUBLISHABLE_KEY` | ✅ set (unchanged — public by design) | ❓ unknown — check Vercel | ✅ present in bundle **by design** — this is what a publishable key is for | N/A | ❌ not started | ❌ not started |
| `STRIPE_WEBHOOK_SECRET` | 🔲 never set locally | ❓ unknown — check Vercel | ❌ not found anywhere | N/A | ❌ not started (this is a first-time setup, not a rotation) | ❌ not started |
| `GOOGLE_API_KEY` | 🔲 cleared 2026-09-20 (found still active, unused in code) | ❓ unknown — check Vercel | ❌ not found in source/Git/bundle; **chat-exposed** 2026-09-20 | ❌ **not done** | N/A — unused; skip unless a feature needs it | N/A |
| `ELEVENLABS_API_KEY` | 🔲 cleared 2026-09-20 | ❓ unknown — check Vercel | ❌ not found anywhere; **chat-exposed** 2026-09-20; also independently invalid | ❌ **not done** | N/A — feature not built | N/A |
| `DEEPGRAM_API_KEY` | 🔲 cleared 2026-09-20 | ❓ unknown — check Vercel | ❌ not found anywhere; **chat-exposed** 2026-09-20; also independently invalid | ❌ **not done** | N/A — feature not built | N/A |

Legend: ✅ confirmed done/true · 🔲 confirmed NOT present (a deliberate, checked state — not "unknown") ·
❌ confirmed not done · ❓ genuinely unknown from this environment, needs Isaac to check directly ·
N/A doesn't apply to this credential.

**No OAuth grants, refresh tokens, or service-account credentials exist in this codebase** —
confirmed by the inventory-completeness search above (no OAuth flow, no `client_secret`/
`refresh_token` field anywhere outside Stripe's own unrelated `client_secret` naming for Payment/
Setup Intents, which is Stripe's standard client-safe per-transaction token, not an OAuth secret).
Every one of the 8 providers here authenticates with a single long-lived API key/token pair. If
that changes — e.g. a future Google OAuth integration for something beyond the current unused Maps
key — add its grant/refresh-token handling to this table under its own row, not folded into an
existing one.

---

## URGENT — act on these now, don't wait for the full post-build rotation

Clearing a value out of local `.env.local` and a provider revoking/rotating a credential are two
different, separate actions — clearing the local file only stops *this machine* from being able to
use it; the credential itself is still live at the provider until you act there directly. The same
goes for an API request coming back 401/invalid: that tells us the value we tried is no longer
accepted right now, not that anyone deliberately revoked it — it could just as easily mean it was
already rotated for an unrelated reason, or was never the right value to begin with. Neither local
clearing nor a 401 is a substitute for actually revoking it at the provider.

Four credentials were printed into this Claude Code session's own chat transcript on 2026-09-20
(before this security review began) and should be treated as compromised regardless of what any
validity check says. Each of the six states below is a genuinely separate fact — doing one does
not imply any of the others, and this table only checks a box once that specific, distinct action
is actually confirmed:

| Credential | Removed from source code | Removed from local `.env.local` | Removed from Vercel env config | Revoked by provider | Replaced with new credential | Tested with replacement |
|---|---|---|---|---|---|---|
| Twilio Account SID + Auth Token | N/A — never hardcoded in source, only referenced by name | ✅ done 2026-09-20 (value blanked, variable name kept) | ❓ unknown — needs Isaac to check Vercel directly | ❌ **not done — needs Isaac's action in Twilio Console** | ❌ not done | ❌ not done |
| Google API Key | N/A — never hardcoded in source | ✅ done 2026-09-20 | ❓ unknown — needs Isaac to check Vercel directly | ❌ **not done — needs Isaac's action in Google Cloud Console** | ❌ not done | ❌ not done |
| ElevenLabs API Key | N/A — never hardcoded in source | ✅ done 2026-09-20 | ❓ unknown — needs Isaac to check Vercel directly | ❌ **not done — needs Isaac's action in ElevenLabs dashboard** | ❌ not done | ❌ not done |
| Deepgram API Key | N/A — never hardcoded in source | ✅ done 2026-09-20 | ❓ unknown — needs Isaac to check Vercel directly | ❌ **not done — needs Isaac's action in Deepgram Console** | ❌ not done | ❌ not done |

Provider-side action for each, once you're ready:
- **Twilio**: Console → Account → API keys & tokens → regenerate the Auth Token (invalidates the
  exposed one immediately; the Account SID itself isn't separately rotatable, but is only useful
  paired with a valid token).
- **Google**: Cloud Console → APIs & Services → Credentials → delete this key (confirmed unused in
  code — see the Integration Center note below — so there's no integration to break by removing it
  outright rather than rotating it).
- **ElevenLabs**: dashboard → Profile → API Keys → revoke.
- **Deepgram**: Console → API Keys → revoke.

I have no provider-dashboard access from this environment — every "not done" row above requires
your direct action; I cannot check or change provider-side state myself. The new
Integration Center (`/dashboard/integrations`, staff admin-only) reflects local/Vercel
configuration state and can run a real on-demand check against each provider's own API — use its
"Test Connection" button after each step above to see the result change in real time, without ever
displaying the credential itself.

### Also check now: Vercel's stored environment variables

I have no Vercel dashboard access either, so I can't see what's actually configured there —
including for prior deployments. Please check directly, for all three Vercel environments
(Production, Preview, Development), since a value can differ per environment:

1. Vercel project → Settings → Environment Variables — confirm which of `TWILIO_ACCOUNT_SID`,
   `TWILIO_AUTH_TOKEN`, `GOOGLE_API_KEY`, `ELEVENLABS_API_KEY`, `DEEPGRAM_API_KEY` are set there,
   for which environment(s), and whether the values match the ones cleared locally (if they're the
   same values, they're exposed the same way; if they differ, this local exposure doesn't extend to
   production, but the values found invalid against each provider's own API might still need
   attention for a different reason — see the "Local validity" notes throughout this document).
2. Also worth checking on the same screen: `ANTHROPIC_API_KEY` and whether a `VITE_CLAUDE_API_KEY`
   variable exists or ever existed (Vercel's environment-variable history/audit log, if available,
   is the only way to check whether it was ever set in the past, not just now) — this is the
   remaining open question from the original client-side-key exposure investigation.
3. Vercel project → Deployments → (older deployments) — build logs occasionally echo environment
   variable names during the build step; worth a scan for any of the above names appearing
   alongside a real-looking value, though Vercel redacts recognized secret patterns from logs by
   default.

None of this requires pasting a value anywhere — just visually confirming what's configured and
where, and taking the revoke/regenerate action directly in each provider's own interface.

---

## Status legend

- **Exposure**: `clean` (no evidence of exposure found), `chat-exposed` (a real value was printed
  into this Claude Code session's transcript on 2026-09-20 during the earlier /welcome-testing
  work — before the credential-security review that produced this document), `unknown` (can't be
  ruled out from this environment — e.g. no Vercel dashboard access here).
- **Local validity** (as of 2026-09-20, tested directly against each provider's own API, values
  never printed): `active`, `invalid/expired`, `not set locally`, `not tested` (no safe/cheap way
  to test without a real side effect, e.g. sending a real SMS).

---

## 1. Supabase

| Credential | Purpose | Install into | Dependent config | Verify | Confirm old is revoked |
|---|---|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side full-DB-access key used by every `api/*.js` function | Vercel production env vars + local `.env.local` | None (no webhook/redirect URL tied to this) | Run `node scripts/e2e_api_client_auth_test.mjs` and `node scripts/e2e_org_isolation_test.mjs` — both must pass against the live project | In Supabase dashboard → Project Settings → API, regenerating the service role key immediately invalidates the old one; there is no separate "confirm" step |
| `VITE_SUPABASE_ANON_KEY` | Client-side public key (safe to expose — RLS is the real boundary) | Vercel production env vars + local `.env.local` | None | Load the site, confirm login/dashboard still work | Same as above — Supabase only lets one anon key exist at a time per the new "publishable key" model |
| Supabase Auth email templates / SMTP (if custom) | Password reset, magic link, invite emails | Supabase dashboard → Authentication → Email Templates | Redirect URLs in each template must point at `nova-systems.app`, not a stale domain | Trigger a real password reset and confirm the email arrives with a working link | N/A — not a rotatable secret, just a config check |

**Exposure**: clean (not chat-exposed, not found in git history; the value is used constantly by
this session's own live testing, which is expected and does not print it).
**Local validity**: active (confirmed working via the two e2e scripts above, run 2026-09-20).
**Note**: this is the single most load-bearing credential in the whole platform — every
dashboard resource, RLS policy, and this session's own test scripts depend on it. Per Isaac's
explicit instruction, **do not rotate this until a controlled replacement procedure is ready and
its impact is understood** — regenerating it invalidates the old key immediately with no grace
period, which would break every live `api/*.js` function and this session's own test scripts at
once if done without a plan for the cutover. Rotate it **last**, once every other rotation is
proven working, and immediately re-run both e2e scripts after rotating it. The public
`VITE_SUPABASE_ANON_KEY` is safe to expose by design (RLS is the real access boundary, not
secrecy of this key) and is not "a secret" merely because it appears in browser code — it does not
carry the same do-not-rotate-casually caution as the service-role key above.

---

## 2. Twilio

| Credential | Purpose | Install into | Dependent config | Verify | Confirm old is revoked |
|---|---|---|---|---|---|
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` | Sends the "new lead" SMS alert from `api/welcome.js` to `ISAAC_ALERT_PHONE` | Vercel production env vars + local `.env.local` | None (no webhook currently wired to Twilio in this repo) | Submit a real `/welcome` test lead and confirm the SMS actually arrives on your phone (this session can only confirm Twilio *accepted* a send request, never that a device received it) | In Twilio Console → Account → API keys & tokens, the "Auth Token" has a one-click regenerate; the old token stops working the moment you do |
| `TWILIO_PHONE_NUMBER` | The "From" number for the alert SMS | Vercel production env vars + local `.env.local` | Not a secret (a phone number), but must be a number your Twilio account actually owns | Same test as above | N/A |

**Exposure**: `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` — **chat-exposed** this session.
**Local validity**: `TWILIO_AUTH_TOKEN` — invalid (confirmed via a direct call to Twilio's own
account-lookup API, which returned 401). Whichever token is currently live in Vercel production,
if different from local, is unverified from here.
**`TWILIO_PHONE_NUMBER`**: not set locally at all — meaning the SMS-send branch in
`api/welcome.js` is a silent no-op in local/dev testing today (the code checks for all three
Twilio vars before attempting a send). Whether it's set in Vercel is unknown from here.

---

## 3. Resend

| Credential | Purpose | Install into | Dependent config | Verify | Confirm old is revoked |
|---|---|---|---|---|---|
| `RESEND_API_KEY` | Sends lead confirmation, invoice, and payment-received emails (`api/welcome.js`, `api/notify.js`, `api/stripe.js`) | Vercel production env vars + local `.env.local` | Sending domain (`nova-systems.app`) must stay verified in Resend's dashboard — a key rotation alone doesn't affect this | Send a real test email through one of the flows above and confirm it arrives (again: this session can only confirm Resend *accepted* the send) | In Resend dashboard → API Keys, delete the old key after the new one verifies — Resend does not auto-expire old keys |

**Exposure**: clean (not chat-exposed; not found in git history).
**Local validity**: invalid (confirmed via a direct call to Resend's own email-list API, which
returned "API key is invalid").

---

## 4. Anthropic

| Credential | Purpose | Install into | Dependent config | Verify | Confirm old is revoked |
|---|---|---|---|---|---|
| `ANTHROPIC_API_KEY` | Server-side document generation (`api/client.js` → `resource=documents`, called from the Nova HQ Documents tool) | Vercel production env vars + local `.env.local` | None | Sign in as a staff user with `admin.view` and generate a real test document from `/dashboard/documents` | In Anthropic Console → API Keys, delete the old key once the new one verifies |

**Exposure**: clean — confirmed via full git-history scan that no real Anthropic key was ever
committed to this repo. The now-removed client-side `VITE_CLAUDE_API_KEY` code path (fixed
2026-09-20, see `src/pages/dashboard/Documents.jsx`'s history) means this can no longer leak into
the browser bundle even if it were set as a `VITE_`-prefixed variable in the future — the working
integration reads `ANTHROPIC_API_KEY` server-side only, and there is no `VITE_ANTHROPIC*` or
`VITE_CLAUDE*` variable anywhere in the codebase to accidentally revive that path.
**Local validity**: not set locally at all — document generation is currently a hard failure in
local/dev testing (`api/client.js` returns a clear "ANTHROPIC_API_KEY not configured" error rather
than crashing or silently doing nothing, which is the correct fail-safe behavior). Whether it's
set in Vercel production, and whether it was ever set there historically, is unknown from this
environment — the Documents.jsx code path capable of leaking it client-side existed in committed
history from 2026-06-09 onward, so if a real key was ever added as `VITE_CLAUDE_API_KEY` in Vercel
during that window, it would have shipped to the browser. There is no way to check Vercel's
historical env var configuration from here — **this specific question can only be answered by
checking the Vercel dashboard's environment variable history/audit log directly.**

---

## 5. Stripe

| Credential | Purpose | Install into | Dependent config | Verify | Confirm old is revoked |
|---|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | Creates Checkout sessions for invoices and the `/onboard` payment flow (`api/stripe.js`, `api/_stripe.js`) | Vercel production env vars + local `.env.local` | None directly, but must be the **same mode** (live vs. test) as `VITE_STRIPE_PUBLISHABLE_KEY` below, or checkout will fail confusingly | Create a real test invoice, click "Pay Now," confirm the Stripe Checkout page loads | In Stripe Dashboard → Developers → API Keys, roll the secret key — old one stops working immediately |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Client-side Stripe.js initialization | Vercel production env vars + local `.env.local` | Must match the secret key's mode (live/test) | Same checkout test as above | Publishable keys aren't really "secret," but roll it alongside the secret key so both are current |
| `STRIPE_WEBHOOK_SECRET` | Verifies that `checkout.session.completed`/`payment_intent.succeeded` webhook calls really came from Stripe | Vercel production env vars + local `.env.local` | **The webhook endpoint URL must be registered in Stripe Dashboard → Developers → Webhooks, pointed at `https://nova-systems.app/api/stripe` (no query string — `api/stripe.js` routes to the webhook handler based on the presence of Stripe's `stripe-signature` header, not a `?resource=` param, confirmed by reading its `handler()` export directly)** | Trigger a real test-mode payment and confirm the webhook fires and the invoice/client row updates | In Stripe Dashboard → Webhooks, deleting/recreating the endpoint issues a new signing secret; the old one becomes worthless the moment the endpoint is deleted |

**Exposure**: clean — not chat-exposed, not found in git history.
**Local validity**: `STRIPE_SECRET_KEY` is confirmed **expired** (a direct call to Stripe's own
`/v1/account` endpoint returned `api_key_expired`) — it is a **live-mode** key, not test-mode.
`STRIPE_WEBHOOK_SECRET` is **not set at all**, locally or (as far as this session found) anywhere
referenced outside `process.env` — see the code fix below.
**Code fix already made (2026-09-20)**: `api/stripe.js`'s webhook handler previously *skipped
signature verification and still processed the event* whenever `STRIPE_WEBHOOK_SECRET` was unset —
meaning anyone who knew or guessed a real `invoice_id`/`client_id` could POST a forged
`checkout.session.completed` payload and have it marked Paid for free, with a real "payment
received" email sent to the customer and a real "invoice paid" alert sent to Isaac, none of it
backed by an actual Stripe transaction. It now returns `503` and refuses to process **any**
webhook event when the secret is absent, instead of the previous fail-open behavior. **This means
Stripe webhooks are non-functional until `STRIPE_WEBHOOK_SECRET` is set** — expected and correct,
but worth knowing before assuming invoice payments will auto-mark-paid in production right now.

---

## 6. Google (Maps/Geocoding)

| Credential | Purpose | Install into | Dependent config | Verify | Confirm old is revoked |
|---|---|---|---|---|---|
| `GOOGLE_API_KEY` | **Not currently used anywhere in this codebase** — present in `.env.local` but no `api/*.js` or `src/*` file references it | N/A unless/until a feature is built that needs it | N/A | N/A | If nothing will use this soon, simplest containment is deleting the key in Google Cloud Console rather than rotating it — regenerate only when a real feature needs it |

**Exposure**: **chat-exposed** this session.
**Local validity**: active (confirmed via a real, harmless Geocoding API call). Since it's unused
in code, the practical risk is limited to whatever APIs are enabled on it in Google Cloud Console —
worth checking there directly what scopes/APIs this key can call, given it's confirmed live and
was chat-exposed.

---

## 7. ElevenLabs / Deepgram (Nova AI voice agent — not yet built)

| Credential | Purpose | Install into | Dependent config | Verify | Confirm old is revoked |
|---|---|---|---|---|---|
| `ELEVENLABS_API_KEY` | Reserved for the not-yet-built voice-agent feature (see `docs/voice-agent-spec.md` — honestly documented as not started) | N/A until that feature is authorized and built | N/A | N/A | **Still needs Isaac to revoke it directly in the ElevenLabs dashboard** (see the URGENT section above) — a 401 on a test request is not the same as confirmed-revoked; when this feature is actually built, generate a fresh key rather than assuming this one is safely dead |
| `DEEPGRAM_API_KEY` | Same — reserved for the same not-yet-built feature | N/A | N/A | N/A | **Still needs Isaac to revoke it directly in the Deepgram console** — same caveat as ElevenLabs |

**Exposure**: both **chat-exposed** this session — see the URGENT section above for the required
action. **Local validity**: both return 401 when tested, but that only means today's test request
was rejected, not that the credential has been provider-side revoked. These guard a feature that
doesn't exist in the codebase yet (`api/nova-ai/` was
confirmed not present). Generate real credentials only when that build is actually authorized.

---

## 8. Vercel

| Credential | Purpose | Install into | Dependent config | Verify | Confirm old is revoked |
|---|---|---|---|---|---|
| Vercel account/team access (not a repo-stored credential — no `VERCEL_TOKEN` found anywhere in this repo or `.env.local`) | Deploying this project, managing its env vars | N/A — this is dashboard/CLI login, not a file-stored secret | N/A | N/A | If you ever generated a personal Vercel CLI token for scripting/CI, check Vercel Account Settings → Tokens directly — none is referenced anywhere in this repo, so there's nothing here to rotate |

**Exposure**: N/A — nothing repo-stored to expose. `.vercel/repo.json` (gitignored) only contains
the project and org IDs, which are identifiers, not secrets.

---

## 9. Not yet integrated (no credential exists in this repo to rotate)

CRM, calendar (beyond the public `VITE_CALCOM_URL` booking link, which is not a secret), storage
beyond Supabase Storage, analytics, and social-media platforms have no credentials anywhere in
this codebase — nothing to inventory or rotate here because nothing is built yet. Flag this row
again the moment any of those integrations gets authorized and built.

---

## Suggested order for installing FRESH replacement credentials (the full pre-production reset)

This is separate from — and comes after — the URGENT revocations above. Revoking a chat-exposed
credential is about shutting a door; installing its permanent replacement is part of the full
reset Isaac is doing once the platform is otherwise built. Don't treat completing this section as
a substitute for the URGENT section — do that first, regardless of where this list stands.

1. **Stripe** (already-expired live key — least disruptive to rotate since nothing currently works
   with it; also set `STRIPE_WEBHOOK_SECRET` for the first time now that the webhook fails closed
   without it).
2. **Resend** and **Twilio** (both already return invalid/401 on a test request against their own
   provider APIs — see the "Local validity" note under each provider section for exactly what that
   does and doesn't confirm; Twilio is additionally in the URGENT section above and needs a
   dashboard revoke regardless of this step).
3. **Anthropic** (currently unset locally; confirm Vercel's actual state directly first).
4. **Google / ElevenLabs / Deepgram** (all three are in the URGENT section above — revoke first;
   generate real replacements only once/if each feature they support is actually being built).
5. **Supabase** last, once everything else is proven working post-rotation — re-run
   `scripts/e2e_api_client_auth_test.mjs` and `scripts/e2e_org_isolation_test.mjs` immediately
   after, since the whole platform depends on this one. Per Isaac's explicit instruction, do not
   rotate this one until a controlled replacement procedure is ready and its impact — active
   sessions, any code path relying on the current key — is understood.

## After installing each replacement

- Update the corresponding line in local `.env.local` (name already present; only the value
  changes) and in Vercel's project environment variables (Production — and Preview/Development if
  you use those for testing).
- Do not commit `.env.local` — it's already gitignored (`.gitignore` lines 2-4, 31).
- Re-run this repo's `scripts/e2e_*.mjs` test scripts where applicable before considering a
  rotation "done."
- Come back to this file and note the rotation date next to the relevant provider so there's a
  record of when each credential was last replaced.
