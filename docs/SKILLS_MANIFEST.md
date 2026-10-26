# Nova project skills: install manifest

Installed 2026-10-26 by Claude Code, per the owner brief of 2026-10-25. Each skill was copied
as a whole folder from a shallow clone in `C:\Users\NVUBCrosbyUBMS07\skill-sources\` (outside the
repo, outside skill discovery). Commits are the `git rev-parse HEAD` of each clone. No hashes of
individual files are claimed. No global install, no CLI installer, no settings or hooks merged.

| Skill (in `.claude/skills/`) | Source repo | Commit | Source path | License | Local changes |
|---|---|---|---|---|---|
| frontend-design | github.com/anthropics/skills | dbd4588f9e1033efb41dad4bef2f7947c8993d44 | skills/frontend-design | Apache-2.0 (LICENSE.txt in folder) | none |
| webapp-testing | github.com/anthropics/skills | dbd4588f9e1033efb41dad4bef2f7947c8993d44 | skills/webapp-testing | Apache-2.0 (LICENSE.txt in folder) | none. Python examples kept as reference only; Nova uses its existing Node Playwright scripts |
| systematic-debugging | github.com/obra/superpowers | 2ce8aa15d05bd57213e6f746f953aafb7ded7a8b | skills/systematic-debugging | MIT (repo LICENSE copied in) | none |
| verification-before-completion | github.com/obra/superpowers | 2ce8aa15… | skills/verification-before-completion | MIT | none |
| test-driven-development | github.com/obra/superpowers | 2ce8aa15… | skills/test-driven-development | MIT | none |
| requesting-code-review | github.com/obra/superpowers | 2ce8aa15… | skills/requesting-code-review | MIT | none |
| supabase | github.com/supabase/agent-skills | c9be0e931b7930f7d02126d04774d904c381e7d7 | skills/supabase | MIT (repo LICENSE copied in) | none |
| supabase-postgres-best-practices | github.com/supabase/agent-skills | c9be0e93… | skills/supabase-postgres-best-practices | MIT (declared in SKILL.md) | none |
| web-design-guidelines | github.com/vercel-labs/agent-skills | 063bee94c3f4df8453406c830b0a7df0f2860278 | skills/web-design-guidelines | MIT (README) | none. Fetches its rules from raw.githubusercontent.com/vercel-labs/web-interface-guidelines at use time |
| impeccable | github.com/pbakaus/impeccable | f75ee2a201cefd39c3bd54cf0ac1f141d82119e2 | .claude/skills/impeccable (v4.7.1) | Apache-2.0 (LICENSE + NOTICE copied in) | **Hooks not installed.** Upstream `.claude/settings.json` runs its launcher on SessionStart, every Edit/Write and Stop; skipped to avoid per-edit overhead. The launcher downloads a checksum-verified engine binary only if run; not run yet. Role: refinement (critique, polish, typography, error states) after frontend-design. Owner palette #0A0A0A / #FAFAFA / #C9A84C overrides any palette advice |
| product-marketing, customer-research, copywriting, cro, cold-email, marketing-ideas, events, referrals | github.com/coreyhaines31/marketingskills | e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b | skills/<name> (all eight exist under these exact names) | MIT (repo LICENSE copied in) | none. Load only in the marketing phase |

## Prepared but not installed into Nova

- **Roast Room** (github.com/nateherkai/roast-room, commit e40f40652d5690c4d9f928c4794c673a99f2cd0e, MIT) lives in its
  own clone at `C:\Users\NVUBCrosbyUBMS07\skill-sources\nateherkai_roast-room`. Entry point: `npm start` there
  (room at http://localhost:4730), then `claude` in that folder and `/roast-room <decision>`. Readiness: Node 24 meets
  its Node >= 20 requirement; `node --check app/server.mjs` passes. **Not run.** Its smoke test
  (`npm run smoke`) and the room server's council code call `api.anthropic.com` with `ANTHROPIC_API_KEY`, which is API
  billing, not the Claude subscription, despite the README's "no API key needed". Confirm which path pays before any run.
  Advisors are simulated viewpoints, not real people, and are not evidence that software works.
- **Agency Agents** (github.com/msitarzewski/agency-agents, commit b37b5bb33b78f2c1d6567d98e25ca818e3259219, MIT):
  `testing/testing-reality-checker.md` reviewed as reference only. Not installed; its Laravel commands and grading
  rules do not apply to Nova.
- **Not installed:** gstack, activepieces, xyflow (only if a real UI need appears), ccusage.

## Discovery verification

Checked 2026-10-26 with Claude Code 2.1.310 (VS Code extension binary), signed in to claude.ai (Pro), no
`ANTHROPIC_API_KEY` in the environment.
- A fresh headless session started in this repo listed all 18 skill names above and correctly did not list a
  made-up control name.
- The same kind of fresh session invoked `verification-before-completion` through the Skill tool and returned its
  first heading, "Verification Before Completion".
- The installing session itself could **not** invoke them ("Unknown skill") because it was started in the home folder.
  Resume action: open a new Claude Code session with `nova-mvp-work` as the workspace folder.

Skill use per milestone is recorded in the checkpoint.
