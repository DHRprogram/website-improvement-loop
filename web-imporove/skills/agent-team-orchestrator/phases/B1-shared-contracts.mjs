# Phase B1: Shared Contracts

Establish the shared Python module layer — Pydantic models, event bus contract, role prompts, rate limiter interface, and LLM client abstraction. This is the foundation all services depend on.

## Purpose

Create type-safe contracts that every service uses. If contracts change, downstream services get compile-time errors instead of silent runtime failures. The event bus provides publish/subscribe/ack semantics so agents communicate asynchronously with guaranteed delivery tracking.

## Timing

First build phase (B1). Runs after P1 produces `plan.json`. All subsequent build phases (B2-B12) read from this shared module. Must complete before B2 (services setup).

## Inputs

- `plan.json` from P1
- `templates/python/shared/` template files
- Codebase analysis output from P1 architecture scan

## Outputs

- `shared/__init__.py` — package exports
- `shared/contracts.py` — Pydantic models (Goal, TaskSpec, TaskResult, Artifact, ApprovalRequest, BudgetSnapshot)
- `shared/event_bus.py` — async publish/subscribe with ack tracking
- `shared/rate_limiter.py` — Redis sorted-set sliding window rate limiting
- `shared/llm_client.py` — OpenRouter client with exponential backoff
- `shared/logging.py` — structured JSON logging with correlation IDs
- `shared/role_prompts.py` — ROLE_PROMPTS dict for all agent roles

## Steps

1. Copy `templates/python/shared/` into the working `shared/` directory.
2. Review and adapt `contracts.py` models to match the scope defined in `plan.json`. Add or remove fields as needed; never use placeholder types.
3. Ensure `event_bus.py` implements three primitives: `publish(topic, payload)` writes to Redis stream, `subscribe(topic, group, consumer)` creates a consumer group and returns an async generator yielding messages, `ack(message_id)` removes acknowledged messages from the pending set.
4. Implement `rate_limiter.py` with Redis sorted sets keyed by `rate_limit:{process_group}`. Default limit: 20 requests per 60-second sliding window. On rejection (429), log a warning, apply exponential backoff starting at 500ms doubling up to 8 seconds, then retry the request through the caller's queue mechanism.
5. Implement `llm_client.py` wrapping OpenRouter API calls. On 429 (too many requests), apply exponential backoff (initial 1s, multiplier 2, max retries 5). On 5xx, apply same backoff with longer initial delay (2s). Every call records an audit entry with correlation-id header value, model used, tokens consumed, latency, and success status.
6. Implement `logging.py` using Python's `logging` module configured to emit JSON lines via a custom `JSONFormatter` class. Every log record includes: timestamp (ISO 8601 UTC), level, logger name, message, process group, correlation-id (from environment or generated UUID), and a structured `extra` dict.
7. Populate `role_prompts.py` with ROLE_PROMPTS dict containing keys: `designer`, `frontend`, `backend`, `qa`, `security`, `devops`, `reviewer`. Each value is a multi-line string defining that role's responsibilities, boundaries, and expected output format.
8. Run `python -m py_compile` on every `.py` file to verify syntax.
9. Write `DEPENDENCIES_BUILT` event to the event bus.

## Checklist

- [ ] All six shared modules compiled successfully (no syntax errors)
- [ ] Goal model has title, description, target, priority, created_at fields
- [ ] TaskSpec model has id, goal_id, agent_role, description, accepted_criteria, status fields
- [ ] TaskResult model has task_id, status, outputs, artifacts, duration_seconds, error fields
- [ ] Artifact model has path, type (file/dir), size_bytes, checksum_sha256 fields
- [ ] ApprovalRequest model has requester, resource, action, reason, approved_by, approved_at fields
- [ ] BudgetSnapshot model has total_cap, spent_usd, remaining_usd, last_updated fields
- [ ] EventBus.publish() accepts topic string and any JSON-serializable payload
- [ ] EventBus.subscribe() returns an async generator yielding (message_id, payload) tuples
- [ ] EventBus.ack() removes message_id from pending acknowledgments
- [ ] RateLimiter.check() returns True if within quota, False if exceeded
- [ ] RateLimiter default is 20 requests per 60-second sliding window per process group
- [ ] On 429/rejection, backoff starts at 500ms and doubles up to 8 seconds max
- [ ] LlmClient calls have exponential backoff on 429 (1s initial) and 5xx (2s initial)
- [ ] LlmClient audit log entries include correlation-id, model, tokens, latency, success
- [ ] JSON formatter outputs valid JSON lines with ISO 8601 timestamps
- [ ] Correlation ID propagated via X-Correlation-Id header context variable
- [ ] ROLE_PROMPTS dict has exactly seven role keys, each non-empty string
- [ ] No secrets, tokens, or API keys in source code (environment variables only)

## Rollback

If any shared module fails compilation, delete the module, revert to the template version, fix the issue locally, then recompile. Do not proceed to B2 until all six modules pass py_compile. Log the compilation failure in the event bus under topic `shared.build_failure` with the error output and filename.
