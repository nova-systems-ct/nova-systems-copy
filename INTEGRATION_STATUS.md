# Integration status

Last checked in this session: 2026-11-14. "Not rechecked" means the state is carried from `docs/handoffs/2026-11-14-launch-recovery.md` and was not observed again.

| Provider | State | Evidence / exact blocker |
|---|---|---|
| GitHub (push) | WAITING FOR ACCESS | Push from this workspace is refused: the Claude GitHub App is not installed on `nova-systems-ct`. Work is saved as a patch file handed to the owner. |
| Twilio (calls, SMS) | WAITING FOR ACCESS | Owner's Chrome was not signed in to Twilio on 2026-11-13 (redirected to login). Saved credentials last returned HTTP 401 (not rechecked). |
| SMS campaign registration | WAITING FOR PROVIDER | Not rechecked. Do not resubmit: a resubmission may carry a fee. |
| Supabase production / staging | WAITING FOR ACCESS | No database access from this workspace. Migration history was not inspected. |
| Vercel deployment | WAITING FOR ACCESS | Deployed commit not inspected. |
| Email | BUILT BUT UNVERIFIED | Domain verified per handoff; delivery never verified. Not rechecked. |
| Apple / Google sign-in | NOT CONNECTED | Disabled per handoff. Not rechecked. |
| Instagram, Facebook, TikTok, YouTube | NOT CONNECTED | No connected accounts per handoff. TikTok business messaging is not offered to US-registered accounts. |
| Apple Messages for Business, RCS | NOT BUILT | Requires provider approval; costs not confirmed. |
| Voice provider | NOT BUILT | ElevenLabs Agents selected for testing on its free minutes; no account created, no adapter written. |
