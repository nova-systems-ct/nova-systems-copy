# Nova defect and acceptance list (repair brief §5)

One list linking each owner symptom to route, reproduction, root cause, fix and evidence. Started 2026-10-26.
Kinds: **confirmed** = reproduced here · **reported** = owner-reported, not yet reproduced · **setup** = missing
configuration · **unbuilt** = feature not built. Status: open / fixed (local) / verified (local) / blocked.
"Verified (local)" means local Supabase on this laptop, never hosted.

| # | Symptom (owner words) | Route | Kind | Root cause | Fix | Evidence | Status |
|---|---|---|---|---|---|---|---|
| 8 | "Failed to send contract: local api error" | /dashboard/contracts → New contract → Send | confirmed (API 500 reproduced as owner) | `handleCreate` returned `contentHash`/`signatureHash`, defined only in `handleSign`: every send threw **after** inserting the row, so the owner saw an error while a pending contract was saved; each retry added another | handler rewritten: drafts (save, reopen), idempotent send from a draft, gated email with recorded delivery status, inline errors that keep input, drafts hidden from /sign | `scripts/local/e2e_contract_composer_test.mjs` 17/17 (commit 3a1550b) | verified (local) |
| 8a | Signed-contract "Download" did nothing | /dashboard/contracts | confirmed (code) | link pointed at an internal `vault:` path | staff-only `contracts?action=pdf` streams the Vault file (works over the iPad Wi-Fi route) | same test file covers composer; PDF route covered in the PDF test below | fixed (local) |
| 8b | Contract email ignored dry-run | api/contracts.js | confirmed (code) | sent through Resend whenever a key existed, regardless of `SALES_EMAIL_MODE` | uses the gated email policy (dry run, allowlist, local inbox copy) | composer test: delivery `dry_run`, one local-inbox copy | verified (local) |
| 8c | Two pending contracts Isaac entered (isaac.nova@ctstate.edu, hag@icloud.com) | contracts table | confirmed | created by the crash above; his screen said "failed" | **kept** (real records); they appear as "Awaiting signature" | — | owner to decide |
| 3 | Audit notes/input not saving | /dashboard/audit/:id | confirmed (code + data) | (a) the add-form clears typed text even when the save fails; (b) intake fields, report sections, compose text live only in the tab and are lost on tab switch/reload, with no saved/unsaved state; (c) three empty duplicate Nova cases (Oct 17, 19, 25) show audits being re-created | see audit repair below | — | open |
| 2 | Audit clock confusing / unresponsive | /dashboard/audit/:id header | confirmed (code) | "Start Clock (Inputs Confirmed)" calls `mark-ready`, which refuses without an approved policy and received inputs; the refusal shows as a browser alert, while policy and inputs live in another tab | — | — | open |
| 5 | PDF generation/download fails | /dashboard/audit/:id Report / Compose & deliver | confirmed (code) | two different PDF paths; both export **approved only** (Isaac's report is a draft → no button anywhere); browser jsPDF path expects text but composed reports hold objects; server path returns base64 opened as a `data:` link (unreliable in iPad Safari); nothing is stored in the Vault | — | — | open |
| 5a | Evidence photo view on iPad | /dashboard/audit/:id/capture | confirmed (code) | returns a Supabase storage URL; the iPad Wi-Fi route only serves the app | — | — | open |
| 6 | Unexpected "Crystal Clear" company | Companies / hierarchy | confirmed | seeded by `hierarchy-01` migration as a *planned* placeholder, from the 2026-09-23 brief ("Crystal/Company 002, provisional name") | not deleted; to be labelled as a placeholder and hideable | — | open |
| 6a | Test audits crowd views, cannot be removed | /dashboard/audit | confirmed | 14 "LOCAL TEST …" cases; no archive | — | — | open |
| 1 | Greeting says "Local"; cluttered figures; action cards do nothing | /dashboard | reported | — | — | — | open |
| 7 | Requests/Operations duplicate menus, unclear fields | /dashboard/ops … | reported | — | — | — | open |
| 9 | Workforce shows no workers, no add path | /dashboard/workers | reported | — | — | — | open |
| 10 | Training cannot be entered | /dashboard/academy | reported | — | — | — | open |
| 11 | Intelligence, case studies, Growth, Execution, Companies, Sales team, Admin purpose | various | reported | — | — | — | open |
| 12 | Cross-device layout; sidebar "More" overlaps section labels | sidebar | confirmed (screenshot 2026-10-26) | — | — | — | open |

## Non-defect findings recorded
- Local Wi-Fi address changed from 10.0.0.82 to 10.248.227.106 (hotspot); the server prints the current one at start.
- AI spending guard added (milestone 3): see `api/_aiSpend.js`; test `scripts/local/e2e_ai_spend_guard_test.mjs` 13/13.
