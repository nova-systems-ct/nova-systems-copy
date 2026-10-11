# Credential rotation plan and legacy-service pause plan (2026-09-30)

Prepared during the security repair. **Nothing in this document has been done.** Every step that
rotates a key, changes a hosting setting or pauses a service needs Isaac's approval of that exact step.
No secret value appears here. Credentials are named by variable name and location only.

## 1. Classification

The four categories are:

- **Local only**: the value is in a git-ignored file on this computer and in the hosting provider's
  secret store.
- **Transcript-disclosed**: the repository itself records that the value was pasted into an AI chat
  transcript.
- **Browser/committed**: the value was compiled into a public browser bundle or committed to git.
- **Unknown**: the value's exposure cannot be determined from here.

| Credential (variable name) | Where it lives today | Category | Who uses it | Priority |
|---|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` (project `xizmg…`) | nova-systems-copy/.env.local, nova-wave-one/.env.local (same value), Vercel env of **both** projects | Local only, but shared by two apps including the legacy one | Every API handler of nova-systems.app and nova-systems.agency, all wave-one crons | 1 |
| `STRIPE_SECRET_KEY` (live) | nova-wave-one/.env.local, Vercel env of nova-wave-one | Local only (live secret on disk) | nova-wave-one only; nova-systems.app has no Stripe secret | 1 |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | nova-wave-one/.env.local; Vercel env of both projects | **Transcript-disclosed** (recorded in api/integrations.js) | wave-one crons (nightly revive), nova-systems.app intake SMS | 1 |
| `GOOGLE_API_KEY` | nova-wave-one/.env.local; Vercel env of nova-wave-one | **Transcript-disclosed** | nova-wave-one | 2 |
| `ELEVENLABS_API_KEY` | nova-wave-one/.env.local; Vercel env of nova-wave-one | **Transcript-disclosed** | nova-wave-one | 2 |
| `DEEPGRAM_API_KEY` | nova-wave-one/.env.local; Vercel env of nova-wave-one | **Transcript-disclosed** | nova-wave-one | 2 |
| `RESEND_API_KEY` | nova-wave-one/.env.local; Vercel env of both projects; nova-jobs/.env (a separate key) | Local only (nova-jobs copy: unknown) | All outgoing email from both domains | 2 |
| `ANTHROPIC_API_KEY` | nova-wave-one/.env.local; Vercel env of nova-systems-copy | Local only | AI document generation | 3 |
| `CRON_SECRET`, `CLIENT_SESSION_SECRET` | Vercel env of both projects; nova-wave-one/.env.local | Local only | Cron authentication, legacy client sessions | 3 |
| Service-role key of project `mokyq…` (old nova-jobs) | nova-jobs/.env | Unknown (the project was described as compromised) | nova-jobs, if deployed anywhere | 2 |
| `VITE_ADMIN_PASSWORD` (nova-jobs) | nova-jobs/.env **and compiled into nova-jobs/dist** | **Browser/committed**: treat as public | nova-jobs admin page | 1 if nova-jobs is deployed |
| `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY` | Browser bundles | Public by design | Browsers | No rotation needed; protected by the database patch |

## 2. Rotation sequence (each step needs approval; do them in this order)

1. **Pause nova-wave-one first** (approval A1 below). Rotating the shared Supabase and Twilio keys while
   wave-one still runs either breaks it noisily or, if wave-one gets the new value, keeps it running.
2. **Twilio**: in the Twilio console, create a secondary Auth Token, put it in nova-systems-copy's
   Vercel env only, redeploy, confirm one test SMS to the owner's own phone, then promote it and
   revoke the old token. Do not give wave-one the new token.
3. **Stripe live secret**: in the Stripe dashboard, roll the secret key and set no live key anywhere
   until live charges are approved. nova-systems.app does not need it today.
4. **Supabase service role (xizmg…)**: roll the JWT secret/service key in the Supabase dashboard,
   set the new value in nova-systems-copy's Vercel env only, redeploy, then run
   `supabase/checks/security-metadata-check.sql` and a dashboard sign-in. Rolling the JWT secret also
   signs every user out once. Schedule it.
5. **Google, ElevenLabs, Deepgram**: revoke at each provider. Only wave-one uses them.
6. **Resend**: create a new key scoped to sending only, set it in nova-systems-copy, revoke the old
   one and the separate nova-jobs key.
7. **Anthropic, CRON_SECRET, CLIENT_SESSION_SECRET**: rotate in Vercel. Rotating the client session
   secret logs out any legacy client sessions.
8. **nova-jobs / project mokyq…**: decide whether anything still uses it. If not, pause the
   Supabase project (reversible) rather than delete it. Treat the admin password as public.
9. Only after every provider shows the old value revoked: remove the stale copies from the local
   `.env.local` files. This plan does not delete files; that is a separate approval.

After each step, record the date and who did it. Never paste a key into a chat, a document or a commit.

## 3. Legacy pause plan (reversible)

Live state, verified read-only on 2026-09-30 through the Vercel API (names and metadata only):

- **nova-wave-one** (nova-systems.agency) is deployed from commit `2486c3e`. It defines **9 cron
  jobs**, including the nightly lead "revive" job that sends texts and emails. Its production env
  holds the shared Supabase service role, Twilio, Resend and a live Stripe secret.
- **nova-systems-copy** (nova-systems.app) is deployed from commit `bd53133`. It has no Stripe secret
  and no webhook secret, so its legacy Stripe paths already refuse.
- **nova-jobs** is not a project in this Vercel team. Whether it is deployed anywhere is unknown.

Pause steps for nova-wave-one, in order of preference:

1. **Disable its crons** (approval A1). In Vercel, open Project nova-wave-one, then Settings, then Cron
   Jobs, then Disable. This is reversible with the same switch and stops the nightly texts and emails
   immediately. Nothing is deleted.
2. **Protect the deployment** (approval A2). Turn on Vercel Authentication for all deployments,
   including the custom domain, so nova-systems.agency stops serving its public API. This is
   reversible.
3. Optional: remove nova-systems.agency's production env values only after step 2 of the rotation
   sequence. That step is not reversible without the values, so it comes last.

Rollback for both pause steps is to flip the same switch back. No data, project or deployment is deleted.
