# Capability status — 2026-10-31 (commit after `2a86124`)

Three columns only: **executable** (code runs and is tested on local staging), **needs credentials / owner action**
(code exists; a provider account, certificate or decision is missing), **unbuilt**. Nothing here is hosted or live.

| Area | Executable (local) | Needs credentials / owner action | Unbuilt |
|---|---|---|---|
| Audit research | Public pages incl. JavaScript-built sites (guarded headless browser), identity verdict before evaluation, email DNS, OpenStreetMap identity/competitors, re-check of recorded findings, luxury PDF → Vault | Vercel read access to re-check production-hosting findings | Listing/review APIs (Google, Yelp, Facebook), search ranking, ads, social engagement |
| Install Systems | Six-module catalog, own-audit recommendations, provisioning with exact outcomes, retry, turn off/on, Nova's own install | DNS records, review-request wording, live channels, Revive campaign approval | — |
| Workforce | Executive assistant, COO, CFO, CMO: recurring and on-demand tasks with history, review, escalation (in app); expense chain CMO → CFO → owner → recorded | Owner's playbook values (limits, budgets), a current balance for the CFO | Bank/accounting connection (none; funds stay "unknown" without an entered balance) |
| Revive | SMS reactivation campaigns (`api/_ops/harvest.js`): eligibility re-checked at send, stop-on-reply/opt-out, approval snapshot; dry run | Twilio A2P 10DLC, `WAVE1_SEND_ENABLED`, owner approval of each campaign | Email Revive journeys |
| Acquisition / Harvey | — | Model-provider account choice (not the personal login), authenticated sending domain | Harvey sidecar adapter (decision recorded: `docs/HARVEY_INTEGRATION_DECISION.md`), cold-email outreach, prospect cohort |
| Social publishing | Adapters for Meta, LinkedIn, TikTok, YouTube with readiness (`api/_socialAdapters/*`, `unit_social_adapters_test`) | Each platform's app review and account connection | — |
| Loyalty | Append-only ledger: earn per completed job, reverse on refund, redeem at threshold, FIFO expiry (`api/_ops/loyalty.js`) | — | POS sync, contactless terminals |
| Apple Wallet / Google Wallet | Readiness check names the missing items (`walletReadiness`) | Apple Developer Pass Type ID + certificate; Google Wallet issuer account | Pass signing and the pass web service; Google Wallet passes |
| Apple Messages / Android messaging | Setup path documented (`docs/APPLE_MESSAGES_PAY_WALLET_SETUP.md`) | Apple Messages for Business onboarding via a messaging service provider; Google RBM agent | Both channel adapters |
| Payments | Stripe Connect code paths (local stand-ins in tests) | Stripe keys and webhook secrets | Apple Pay domain verification |
| Zion video | Zion Studio journal/facts (private, author-scoped) | — | Video job pipeline (brief → assets/script → provider/cost → generation → render/retry → storage → export); no provider chosen |
| Public website | Current site code in the repository | **Owner decision**: `CLAUDE.md` forbids changing the public marketing site, while the 2026-10-30 brief asks to reposition it; not changed until Isaac confirms which rule wins | Repositioned public pages |
| Hosted iPad access | LAN mode for development only (sign-in required; Supabase not exposed through the app) | Hosted staging database (Supabase plan/invoice), Vercel login and Preview variables, worker host | Hosted deployment and physical-iPad checks with the laptop off |
