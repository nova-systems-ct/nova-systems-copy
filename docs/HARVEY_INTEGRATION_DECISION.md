# Harvey integration — decision record (2026-10-31)

Owner brief 2026-10-30 §9. Status: **decided, not built**. Nothing from Harvey runs, sends or is installed.

## What was verified (source inspection of the pinned commit, not a runtime test)
- Repository `https://github.com/ethanplusai/harvey`, commit `4237f07f5873e270c362b43aec76e60fc4faa9cf`
  (2026-10-27), package `0.3.0`, `requires-python >=3.11`, **MIT** (© 2026 Ethan Rogers). Not the unrelated
  `ma-serra/harvey` legal skill.
- `harvey/codex.py` `require_supported_platform()` refuses everything except macOS and Linux ("isn't supported on
  Windows yet. Use the Claude provider there"); `SUPPORTED_CODEX_VERSIONS = ("0.159.3",)` refuses any other Codex CLI.
- `harvey/claude_runtime.py` handles Windows (`claude.cmd` shims), so the Claude provider is the Windows-native path.
- Own senders exist: `harvey/agents/sender.py` with `integrations/gmail.py`, `microsoft.py`, `smtp_mail.py`,
  `instantly.py`; `harvey.yaml` defaults `provider: "gmail"`. These would compete with Nova's queue.
- Ships `Dockerfile` (`python:3.12-slim`, Playwright Chromium, non-root user) and `docker-compose.yml`.
- This laptop: Windows 11, Docker Desktop with a Linux engine (`linux/amd64`); WSL 2 holds only Docker's own
  distribution (no Ubuntu); Python 3.14 on Windows.

## Decision
**Isolated Linux sidecar (Docker), behind an authenticated adapter; Nova remains the only sender.**
- Harvey runs in its own container from the pinned commit (its Dockerfile, unmodified checks), on an internal Docker
  network with no published port; only Nova's adapter talks to it, with a per-deployment secret.
- Harvey does research, personalization and drafts. Its sender agent and every mail provider stay disabled; drafts
  and suppression results come into Nova and go out only through Nova's queue (consent, suppression, quiet hours,
  daily caps, stop-on-reply, kill switch, idempotent sends). No second sender.
- Authoritative records: Nova owns company/prospect identity (tenant-scoped), evidence, sequences, send eligibility,
  sender account, outbox ids, provider results, replies, opt-outs and bookings. Harvey's ids are stored on Nova records
  for reconciliation only.
- Model provider: the Codex provider is OS-supported inside the Linux container but needs Codex CLI 0.159.3 and a Codex
  login; the Claude provider needs a Claude login. Either login is an owner decision; Isaac's personal login must not
  serve client tenants, and usage counts against provider quotas (not zero-cost).

Rejected: native Windows Codex (refused by Harvey; checks must not be disabled); porting components now (larger, and
loses upstream fixes); running Harvey's own sender (competes with Nova's queue).

## What is needed before building
1. Owner: choose the model provider and supply a dedicated account (not the personal login) — and confirm its terms
   allow this use. 2. Owner: an authenticated sending domain for Nova's queue (`send.nova-systems.app` records are still
   missing). 3. Then: build the adapter (research/draft requests, result import, id mapping) with tests against a
   stand-in sidecar, and a container smoke test at the pinned commit. Outreach to real prospects needs a concrete
   owner-approved campaign policy; old approvals are never reused.
