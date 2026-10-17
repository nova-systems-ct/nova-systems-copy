# Nova — authoritative checkpoint (2026-10-17)

One current record. Earlier dated notes live in git history (`git log -p -- docs/NOVA_OPERATIONAL_MVP_CHECKPOINT.md`).
Product authority: the owner's master execution prompt of 2026-10-17 (Triangle of Nova: Audit, Agents, Demand;
Revive and Sentry underneath).

## Source and environments
| Item | State |
|---|---|
| Repository / branch | `nova-mvp-work`, branch `mvp/operational`, remote github.com/nova-systems-ct/nova-systems-copy — **public** (verified 2026-10-17) |
| Pushed to GitHub | owner pushes; check `git status -sb` for local commits not yet pushed |
| Production (nova-systems.app) | `main@bd53133` (2026-09-27): old site; /demo and /book "Page not found"; no Stripe, worker or texting configuration |
| Vercel Preview (mvp/operational) | builds, but has no database variables → /demo answers "We couldn't start your demo" |
| Hosted staging | blocked (overdue Supabase invoice) |
| **Local staging** | real Supabase in Docker; app http://localhost:5180 — `docs/LOCAL_STAGING.md` |
| Runtime | use **Node 22 LTS** locally: Node 24.15 on Windows aborts (libuv assertion, exit 0xC0000409) under network load — 40/40 crashes vs 0/20 in the same reproduction |
| nova-wave-one crons | disabled since 2026-10-16 02:25 UTC (re-verified 2026-10-17) |

## Gates (master prompt §3)
| Gate | Status | Evidence |
|---|---|---|
| A — internal foundation | **locally verified**: auth, roles, recovery, isolation; owner home leads with the product; Nova runs on Nova (full Operations tabs) | `scripts/local/e2e_local_staging_test.mjs` 31/31; `scripts/local/e2e_owner_walkthrough_test.mjs` 19/19 |
| B — full audit on Nova | **public evidence + hosting configuration**: 7 evidenced findings, financial impact unknown, draft report awaiting owner approval. Private records, a live inquiry and a live call were not tested (need owner go-ahead) | `docs/evidence/nova-live-audit-2026-10-17.json`; `scripts/local/record_nova_audit.mjs` |
| C — install and operate on Nova | **partial, locally verified**: Install Systems plan from the audit — 8 of 14 components done, including a controlled TEST inquiry → quote; public /book form → real time → signature → confirmed booking | walkthrough 19/19; Operations → Install Systems |
| D — Demand + staff readiness | training rewritten for the triangle (pending owner content review); **Demand campaign workflow not built**; no outreach | `e2e_sales_academy_test` 84/84 |
| E — verified operation | full clean-export runs under Node 22 — see ACCEPTANCE | — |
| F — public presentation | triangle homepage, /book, /demo, owner home rebuilt **locally**; not deployed | — |

## Not verified with any real external provider
Twilio voice and SMS, external email delivery, Stripe test payments (Connect built; no keys locally), Cal.com, Apple
Messages for Business / Apple Pay / Wallet, social channels, hosted worker.

## Next implementation task
Nova Demand campaign workflow on the existing campaign / CRM / prospect infrastructure (campaign with offer, audience,
sources, approval, attribution and outcome states; research and preparation only — no outreach without approval).
