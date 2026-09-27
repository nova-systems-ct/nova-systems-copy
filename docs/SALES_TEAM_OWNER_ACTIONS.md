# Nova Sales Team platform — owner actions checklist

Nothing below is optional if you want real representatives to use this. Each item is a deliberate decision the code will not make
for you — every one is currently pending/unapproved by design.

## Before installing anywhere (see `SALES_TEAM_INSTALLATION.md`)
- [ ] Create an isolated Supabase project/branch and a Vercel preview for the first install. Do not run migrations on production first.
- [ ] Decide the migration order/timing and who runs it (SQL editor, top to bottom, §2 of the installation doc).

## Content and policy approvals (all seeded as pending/draft — reps and clients see the honest "not approved" state until you act)
- [ ] **Academy passing policy** — Sales Team → Academy → Passing policy. The 80%/3-attempts figure was only ever a proposal; set and approve your own.
- [ ] **Academy content review** — Sales Team → Academy → Content approval, program by program (10 programs, 50 lessons). I wrote it in your voice from the brief; you own final sign-off.
- [ ] **Activation policy** — Sales Team → Settings. Which programs/documents are required, and the operational setup checklist items.
- [ ] **Commission plan** — Sales Team → Commissions → Plan. There is no default rate anywhere in the system; nothing calculates until you write and approve one.
- [ ] **Agreement text** — Sales Team → Agreements, for each of Working Agreement, Compensation Schedule, Confidentiality, Acceptable Use. Templates start empty; paste your (legally reviewed, if you want that) text, confirm you reviewed it, then approve. Unreviewed text can never be sent.
- [ ] **Product pricing & readiness** — Sales Team → Catalog. Every offering starts as Draft with no price; reps cannot propose anything until you set a price and mark it Available for Sale (or approve a specific pilot/custom scope).
- [ ] **Nova Audit turnaround** — Sales Team → Catalog → Audit terms. The 24–72 hour figure from the original brief was never approved; reps are told nothing until you approve exact wording.

## Provider setup (all optional — the platform works honestly without them, just with fewer automated features)
- [ ] **Resend** — set `RESEND_API_KEY`, `SALES_FROM_EMAIL`; add the Resend webhook (`email.sent/delivered/bounced/complained`) pointed at `/api/stripe`; set `RESEND_WEBHOOK_SECRET`. Until then, `SALES_EMAIL_MODE=dry_run` keeps every send recorded but not sent.
- [ ] **Going live with email** — set `SALES_EMAIL_MODE=live` and `SALES_EMAIL_ALLOWLIST` first to a short list of your own addresses; watch Sales Team → Settings → Email delivery; widen only when you trust it.
- [ ] **Stripe (client payments)** — set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; add the webhook. A `sk_live_…` key is refused unless you also set `SALES_ALLOW_LIVE_STRIPE=yes` — a deliberate extra step so a live key can't go live by accident.
- [ ] **Stripe Connect payouts** — set `SALES_PAYOUTS_MODE=provider` once you're ready; otherwise you record each payout yourself with evidence (still fully functional, just manual).
- [ ] **Storage** — confirm the `portfolios` bucket exists and is private (résumés).
- [ ] **Auth redirect** — add `<APP_BASE_URL>/apply/continue` to Supabase Auth → allowed redirect URLs.

## Legal / compliance (I did not invent any of this — you or counsel decide)
- [ ] Confirm worker classification (commission-only representative) and whatever tax/1099 handling applies — not implemented or assumed anywhere.
- [ ] Confirm the privacy notice text (`api/_sales/hiringRules.js` `PRIVACY_NOTICE_VERSION` is marked `-draft`) and the e-sign consent wording (`documentRules.js`/`proposalRules.js`, also marked draft) before real applicants/clients see them.
- [ ] Decide whether the agreement templates need outside legal review before approval.

## Operational
- [ ] Start the background worker (`node worker/index.mjs --enqueue-sales-maintenance` once, then keep it running) so invitations/documents/proposals expire, emails retry, and commissions become eligible automatically. Without it, use the manual "Run maintenance now" button in Settings.
- [ ] Decide who holds `nova_sales_manager` and `nova_finance` roles before you invite anyone real.
- [ ] Do a full run-through yourself with a Nova-owned test email/application/lead/client, exactly like the automated journeys did, before telling any real person this is ready.

## What I will not do without you
- Apply any migration to production.
- Send a real invitation, application-confirmation or proposal email to a real person.
- Set `SALES_EMAIL_MODE=live`, add a real Stripe key, or enable `SALES_PAYOUTS_MODE=provider`.
- Approve any policy, price, agreement text or commission rate — those are marked pending precisely so a person decides them.
