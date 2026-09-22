# Hard Stops Guide — HST-B01 through HST-B06

Hard stops are automatic shutdown triggers that prevent runaway agents from
causing damage or spending beyond budgets. Each stop has a defined trigger
condition, detection mechanism, response procedure, and rollback step.

---

## HST-B01: Secret Leak Detected

**Trigger:** Any generated file contains patterns matching known secrets
(AKIA..., ghp_, gho_, sk-, OPENROUTER_API_KEY=non-placeholder).

**Detection:** `scripts/guards/no-secrets.sh` runs as a pre-commit guard on
every draft PR submission. It greps staged/unstaged files under
`skills/agent-team-orchestrator/` for secret patterns. Exit 1 = abort immediately.

**Response:**
1. Cancel the active agent run.
2. Purge the offending artifact from any temporary storage.
3. Log incident with correlation ID and agent ID.
4. Notify the human operator via the control room dashboard.

**Rollback:** Revert the last git commit by the offending agent using the
draft PR's HEAD; delete the branch. Restart the task only after the prompt is
reviewed and sanitized.

---

## HST-B02: Per-Agent Budget Exceeded

**Trigger:** An agent's accumulated LLM token spend exceeds its per-agent
budget cap (`PER_AGENT_BUDGET_USD`, default $20).

**Detection:** `shared.llm_client.LLMClient` tracks every API call's cost in
USD. After each call, `UsageTracker.check_cap(agent_id)` compares cumulative
cost against the configured cap. When exceeded, emits a `budget.exceeded`
event.

**Response:**
1. Immediately block further LLM calls for the affected agent.
2. Mark the running task as `failed` with reason `budget_exceeded`.
3. Do not attempt retries for this task.
4. Record the event in the budget tracker's alerts list.

**Rollback:** No code revert needed — the agent stopped mid-task. If the task
was partially complete, review artifacts and decide whether to allocate more
budget or split into smaller tasks.

---

## HST-B03: Path Violation — Agent Wrote Outside Allowed Paths

**Trigger:** Agent runtime reports modified files outside the task spec's
`allowed_paths` glob patterns.

**Detection:** `shared.path_validator.validate_paths(changed_paths, allowed_paths)`
runs after every sandbox collection. Raises `ValueError` if any path fails to
match all allowed patterns. The error blocks the task result from being published.

**Response:**
1. Halt the agent immediately.
2. Revert any out-of-bounds changes via the sandbox's temporary workspace cleanup.
3. Flag the agent's role prompt for review — likely an instruction ambiguity.
4. Escalate to a human reviewer before reassigning.

**Rollback:** Discard the agent's entire output for that task. Reset the task
to `PENDING` status and re-dispatch with a clarified prompt.

---

## HST-B04: Sandbox Container Failure (Multiple Consecutive)

**Trigger:** Three consecutive sandbox runs fail for the same task within one
agent's lifetime.

**Detection:** `agent_runtime.worker.Worker` maintains a failure counter per
task. On each sandbox failure, the counter increments. At threshold (3), the
worker publishes a `task.failed` event with `error="consecutive_sandbox_failures"`.

**Response:**
1. Stop all worker replicas temporarily.
2. Inspect the last container's stdout/stderr logs for the failure pattern.
3. Check if the issue is environmental (missing dependency, Docker socket issue)
   or content-related (invalid command, corrupted input).
4. Fix root cause; restart workers.

**Rollback:** If the issue was environmental, no code revert needed. If the
issue was content-based, revert the latest committed change and retry.

---

## HST-B05: LLM Provider Down (Persistent 5xx)

**Trigger:** Five consecutive HTTP 5xx responses from the OpenRouter API (or
configured primary provider) within a two-minute window.

**Detection:** `shared.llm_client.LLMClient._request()` counts consecutive 5xx
errors. On hitting the threshold, it automatically switches to
`OPENROUTER_FALLBACK_MODEL` and emits a warning log entry. If the fallback also
fails, all LLM calls in that process group are blocked.

**Response:**
1. All agents in the affected process group switch to the fallback model.
2. If fallback also fails, mark current tasks as `BLOCKED`.
3. Notify human operator that LLM service is degraded.
4. Retry switching back to primary model every five minutes.

**Rollback:** No code revert needed. Once the primary provider recovers,
agents resume normal operation. Track cost delta between models for audit.

---

## HST-B06: Global Budget Cap Exceeded

**Trigger:** Aggregate spend across all agents exceeds
`BUDGET_CAP_USD` (default $100).

**Detection:** `scripts/guards/budget-cap.sh` checks cumulative spent vs. cap
on each scheduling cycle. The orchestrator's `usage_tracker.py` reads global
state from Redis after each completed task. When projected spend exceeds the
cap, the scheduler blocks new dispatches.

**Response:**
1. Reject all new task dispatches immediately.
2. Gracefully drain running agents — let them finish current LLM calls but do
   not start new ones.
3. Publish a summary of total spend, per-agent breakdown, and remaining work.
4. Require explicit human approval to allocate additional budget.

**Rollback:** Completed tasks stand as-is. Unstarted tasks remain in PENDING
status until budget is approved. Draft PRs already opened require manual merge
by a human operator.

---

## Hard Stop Registry Table

| Code | Condition | Auto-Remediation | Human Required |
|------|-----------|------------------|----------------|
| HST-B01 | Secret leak | Block commit | Yes — prompt review |
| HST-B02 | Per-agent budget exceeded | Block agent LLM | No — auto-block |
| HST-B03 | Path violation | Revert out-of-bounds | Yes — re-prompt |
| HST-B04 | 3 consecutive sandbox failures | Halt workers | Yes — environment fix |
| HST-B05 | Persistent LLM 5xx | Switch fallback model | Partial — confirmation |
| HST-B06 | Global budget exceeded | Stop new dispatches | Yes — budget approval |

All hard stop events are logged with full context and persisted to the
control room's audit trail for post-mortem review.
