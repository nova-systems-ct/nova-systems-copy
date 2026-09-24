# Nova Systems — Project Instructions

**Canonical product specification**: [`NOVA_PRODUCT_ONLY_MASTER_EXECUTION_PROMPT.md`](NOVA_PRODUCT_ONLY_MASTER_EXECUTION_PROMPT.md)
(24 sections, Isaac Nova, 2026-09-23). This is the authoritative source for product scope — read it
directly rather than relying on a conversation summary, which is lossy across context compaction.

**Live status tracking**: [`docs/requirement-matrix.md`](docs/requirement-matrix.md) maps each
requirement ID to its source section, dependencies, current evidence, and status.
[`docs/PRODUCT_BUILD_STATE.md`](docs/PRODUCT_BUILD_STATE.md) is the narrative checkpoint —
chronological work log, exact next task, and the owner-action checklist.

**Runtime/hosting decisions**: [`docs/RUNTIME_HOSTING_RECOMMENDATION.md`](docs/RUNTIME_HOSTING_RECOMMENDATION.md).

**Consolidated installation package**: [`docs/FINAL_INSTALLATION.md`](docs/FINAL_INSTALLATION.md) —
migration manifest with dependencies, storage bucket policies, hosting/worker deployment, provider
authorization checklist, test commands, and rollback steps. This is what to hand Isaac for one
coordinated activation session, not `docs/PRODUCT_BUILD_STATE.md` (which is the narrative log).

## Standing rules (see the master prompt for full detail)

- Do not modify the public marketing website (homepage, nav, legal pages, public SEO). Product
  dashboard/auth work is in scope.
- Implementation requests only — no scaffolds, mock dashboards, or future-task-lists as a
  substitute for real domain logic.
- Status vocabulary: not started / in development / locally verified / staging verified /
  waiting on owner-provider / ready for installation / installed / live verified. A pushed commit
  is not a deployment; a provider adapter is not a connected account; a missing migration is not a
  passing test.
- Never invent credentials, bypass access controls, or claim a blocked production test passed.
- Every tenant-owned object needs enforced organization scope and server-side, object-level
  authorization — not just permission to call the endpoint.
- Unknown pricing, legal conclusions, insurance, or business policy must never be invented — leave
  configurable and blocked pending confirmation.
- Vercel plan is currently 12/12 top-level `api/*.js` functions used — fold new resources into
  existing files via `?resource=`/`?op=` dispatch rather than adding new top-level functions.
