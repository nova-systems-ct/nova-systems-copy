# Nova Systems — Agent Governance

**Date:** 2026-09-20. **Status: not started.** No agent runtime, tool adapter, policy engine,
queue, or Approval Inbox exists in this repo today. This document is a placeholder pointing at
the requirement, not a design — writing a real governance spec before any agent exists would be
speculative fiction dressed as architecture.

## Where the actual spec lives for now

The master prompt's Section 9 ("Agent framework and unified Approval Inbox") is the requirement
of record: operating modes (Observe / Recommend / Draft / Execute-after-approval / Bounded
autonomy), per-agent definition fields (purpose, owner org, allowed inputs/tools, prohibited
actions, approval policy, budget/rate limits, evaluation cases), and the Approval Inbox's
required fields (organization, requester/agent, immutable content/version, target, evidence,
risk, cost, expiration, rollback).

## What should happen before this document becomes real

1. Build the smallest deterministic-workflow version of ONE real agent use case (candidate: the
   diagnostic evidence-gathering step, since `docs/data-model.md`'s diagnostic domain doesn't
   exist yet either — this and the Nova Audit engine (`product-requirements.md` §8) should
   probably be designed together, not agent-framework-first).
2. Only generalize into a shared runtime once there are 2–3 real agents that actually need shared
   plumbing — building the framework before any consumer exists risks guessing wrong about what
   the abstraction needs to support.

## Explicitly not claimed

No agent currently has a permission scope, budget, or log, because no agent exists. Any dashboard
or UI element implying otherwise would be exactly the "fake dashboard" this prompt's introduction
explicitly forbids.
