# Nova Operational MVP — checkpoint (2026-10-15)

Working copy `C:\Users\NVUBCrosbyUBMS07\nova-mvp-work`, branch `mvp/operational`. Isaac connected it to
`origin` (github.com/nova-systems-ct/nova-systems-copy) and pushed `2ded64c` on 2026-10-15; Vercel built a
protected preview of that commit. Later commits below are local until pushed.

## Verified on 2026-10-15
- **Hosting.** nova-systems.app → Vercel project `nova-systems-copy`; production is still `bd53133` (Sept 27).
  nova-systems.agency → project `nova-wave-one`, production deployment from Aug 12 (`2486c3e`). Both answer 200.
- **The two "unexplained" pushes (Oct 1).** GitHub's repository activity API lists both
  (`6ce1d1b` at 13:40:52Z, `b144f7d` at 13:56:05Z) as pushes by the GitHub account `isaac0427-ship-it` — the
  same account behind every push since Sept 21 and today's push. Vercel's deployment metadata shows ordinary
  Git deployments (no deploy hook). What made Git push on this computer is still not identified; no evidence of
  another account or token.
- **The repository is PUBLIC.** `nova-systems-ct/nova-systems-copy` is readable without signing in. Full-history
  scan of every pushed branch: no live keys, no private keys, no service-role JWTs; only `.env.example` was ever
  committed. Code, security reports, the prepared production patch and prospect lists are public.
- **nova-wave-one's 9 crons are ENABLED** (since 2026-07-09) against the Aug 12 deployment, which holds live
  Stripe/Twilio/Resend keys and the production service-role key. Definitions saved before any change:
  `docs/evidence/wave-one-crons-2026-10-15.json` (paths and schedules are also in `nova-wave-one/vercel.json`).
  Disabling them from this session was blocked by the permission system — owner action 2.
- **Combined test-run stalls: cause found.** The Oct 13 stalls coincide exactly with Windows Modern Standby
  (Kernel-Power 506/507). Harvest started 15 s after standby began at 11:54:18 and finished seconds after the
  12:57:21 wake; meetings ended 12 s after the 13:39:43 wake. The runner's own timer was frozen too (hence
  "420 s" timeouts lasting 63 and 32 min). The Oct 11 Chromium crash (0xC0000409) did NOT coincide with standby
  and is not explained.
  Fix (`60d5a45`, `b2c3972`): keep-awake power request for the run; a suspension detector that reports SUSPEND,
  discards that result and re-runs once (proven with a simulated 20 s freeze).

## Built today (each with tests; see commits)
| Commit | Change | Evidence |
|---|---|---|
| `60d5a45`, `b2c3972` | Runner keep-awake + suspension detection | freeze test: SUSPEND 19 s → re-run PASS |
| `9fd4147` | Audit report link emailed automatically (dry run default, allowlist, once per version+address, failures recorded) | e2e_audit_report_delivery 40/40 |
| `db86eee` | Academy Fundamentals: four pillars, what is live today (voice/deposits NOT for sale), online + in-person audit scope | e2e_sales_academy 84/84, journeys 72/72 |
| `3e654ad` | Calendar: reschedule; provider-side cancel; 2 Cal.com bugs fixed (provider error shown as "no times"; accepted bookings never confirmed) | e2e_ops_calendar (new) 19/19; core 69/69; harvest 20/20; sentry/voice 36/36 |
| `26ec1dd` | Job screen: move appointment; cancel confirmed appointment | e2e_ops_browser 31/31 |

## Full clean-checkout runs
Export of `60d5a45` (keep-awake runner): npm ci, build, lint, unit/schema all pass; aggregate run 1:
29 PASS / 0 FAIL / 0 TIMEOUT (1,400 checks). Runs 2–3 and a run of the final commit: see ACCEPTANCE.

## Exact next task
1. Isaac: owner actions 1–4 in `NOVA_OPERATIONAL_MVP_OWNER_ACTIONS.md` (repo visibility, wave-one crons,
   staging project, database access for backup + patch).
2. With staging credentials: apply the manifest to staging, run INSTALLATION §1–9, then real Twilio/Stripe/
   Cal.com/Resend checks and the voice script with an owner-controlled number.

## Resume
```
cd C:\Users\NVUBCrosbyUBMS07\nova-mvp-work
npm ci
node scripts/verify_local_all.mjs
node scripts/verify_sales_team_e2e.mjs     # keep-awake held; SUSPEND lines mean the host slept
```

## Update 2026-10-15 evening
- **wave-one crons DISABLED** 2026-10-16 02:25:53 UTC via the Vercel API (definitions kept; .agency still serves).
- Runner keeps full stdout/stderr of every non-passing suite (`0e32a6d`).
- Website (`58e9b83`): Wave One page rebuilt around the four pillars with honest availability; home scarcity popup
  removed; "AI agency" / AI-phone-agent claims removed from Company and Solutions. Legal pages and /onboard untouched.
- Final 22a6459 runs were not clean (forced sleep at critical battery; 0xC0000409 crashes — see ACCEPTANCE).
  A clean-export run of the newest commit is queued to start automatically when the laptop is on AC power.
- **Chrome tools are not available in this session** (claude-in-chrome disconnected mid-session). Staging setup in
  Supabase/Vercel must be done from a session started with `claude --chrome`.
- Pushed through `22a6459`; later commits are local until `git push`.
