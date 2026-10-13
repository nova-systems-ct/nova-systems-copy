# Nova Operational MVP — owner actions (one prioritized list)

Nothing below has been done. Each item is a separate approval or configuration only Isaac can give.

## Urgent (security and availability)
1. **Pay the overdue Vercel invoice** (team nova-systems1). Both nova-systems.app and nova-systems.agency return "402 Payment Required" since 2026-10-03.
2. **Disable nova-wave-one's 9 cron jobs** and protect its deployment (security report approvals A1/A2). It shares the production database and holds live Twilio, Resend and Stripe keys.
3. **Apply the production security patch** after a backup (security report A3), then the repair columns (A4).
4. **Resolve the unexplained GitHub pushes.** Investigation (2026-10-11): both pushes came from Git on this computer with upstream tracking set; no Git hook, alias, Claude Code hook, scheduled task, VS Code Git action or other Claude session ran them. GitHub's own record (Settings → Security log, or the repository's push events) will name the actor and the app or token. Until resolved, this work stays in the remote-less copy `nova-mvp-work`.
5. **Rotate credentials** in the order of `docs/SECURITY_CREDENTIALS_AND_LEGACY_PAUSE_PLAN_2026-09-30.md` (in the original repository).

## Before any real customer
6. **Create a staging Supabase project** and run the installation sequence there first.
7. **Choose and approve the worker host** (it must run continuously; it is not started anywhere).
8. **Twilio:** buy or assign a Nova test number; complete A2P 10DLC registration; point the webhooks; provide the Nova-owned test phones for `OPS_SEND_ALLOWLIST`.
9. **Approve real prices** for each service (one price list for Nova itself too — owner decision #8). Draft prices are never quoted.
10. **Have an attorney review the customer agreement template** and the privacy/terms text. Approval in the app is a business approval only.
11. **Decide who receives customer deposits.** Options: the business's own Stripe account (connection not built), or deposits off. Nova's test account is for Nova TEST businesses only; live payments stay disabled.
12. **Approve the AI voice disclosure wording** and whether the voice assistant should be offered at all in the first pilots.
13. **Missed-call text policy:** the default texts only callers with recorded consent. Any broader policy needs legal review and your written attestation in Settings.
14. **Attribution method, Nova fee and labor baseline** for the weekly report — or leave them blank and the report says "not calculable".

## Commercial and sales
15. **Testimonials:** provide written permission for each quote, or keep them off the site (they are removed from the homepage).
16. **/onboard packages** list unapproved prices and an AI phone agent that is not live; decide whether to keep that page published.
17. **Salespeople:** resolve classification, compensation, agreements and training before anyone sells (no unpaid arrangement is assumed lawful).
18. **Business cards / brochure:** confirm your title, the phone number and email to print, the QR destination, and the printer's specifications. Nothing has been ordered.
19. **Prospect lists:** approve who calls which list; no list is permission to call, text or email.
