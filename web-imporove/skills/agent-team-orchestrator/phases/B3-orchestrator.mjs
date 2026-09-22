# Phase B3: Orchestrator

Implement the Queen orchestrator service (Django + Celery) — the brain that parses plans, assigns tasks to agents, tracks progress, and enforces phase dependencies.

## Purpose

The orchestrator is the single point of control for agent teamwork. It receives task specifications from planning, routes them to the appropriate agent services based on role matching, monitors execution via the event bus, and advances or rolls back phases based on task results. Idempotency dedup prevents duplicate task execution when retries occur.

## Timing

Runs after B2 completes (all services up). Must validate its own idempotency path before B4 (memory) begins writing retrievable state. Blocks B5-B7 until this confirms correct routing behavior.

## Inputs

- `plan.json` from P1
- `shared/event_bus.py` from B1
- `shared/contracts.py` Goal, TaskSpec models from B1
- Docker Compose stack from B2 (orchestrator container running)

## Outputs

- Celery beat schedule mapping each build phase to a periodic task check
- Task routing logic: maps agent_role strings (designer/frontend/backend/qa/security/devops/reviewer) to corresponding service endpoints
- Dedup guard: checks `(task_id, idempotency_key)` pair against a Redis set; if present, marks the task as "already executed" with result cached
- Progress tracker: maintains per-task status in PostgreSQL via Django ORM models
- Phase gate validator: prevents moving from phase N to N+1 unless all tasks in phase N have status=completed

## Steps

1. Define Django models: `TaskRecord(id, task_id, goal_id, agent_role, description, status, outputs_json, created_at, completed_at, idempotency_key)` and `PhaseGate(phase_name, completed_at, validation_errors_json)`.
2. Configure Celery broker (Redis URL from environment) and backend (PostgreSQL dsn).
3. Create Celery beat entries: one entry per build phase (B1 through B12) polling every 30 seconds for pending tasks assigned to that phase.
4. Implement task router: function receiving a TaskSpec, checking which agent_role it belongs to, calling that agent's service endpoint with the task payload, then monitoring the returned task ID on the event bus.
5. Implement idempotency dedup guard: before routing any task, compute `(task_id, idempotency_key)` and check Redis `SET task:dedup:{task_id}:{idempotency_key}` with TTL = total budget hours in seconds. If key already exists, return the cached result immediately instead of re-routing.
6. Implement progress tracker: on every TaskResult event received from the event bus, update the corresponding TaskRecord in PostgreSQL with new status, outputs, and completion timestamp.
7. Implement phase gate: function that queries all TaskRecords belonging to a given phase, verifies they are all completed (or no Tasks exist), and writes a PhaseGate record with current timestamp. On failure, returns list of incomplete task IDs.
8. Run syntax check: `python -m py_compile` on all newly written models and views.
9. Publish `ORCHESTRATOR_READY` event.

## Checklist

- [ ] Django models defined: TaskRecord (all six fields listed above), PhaseGate (three fields)
- [ ] TaskRecord.status field uses ChoiceField with values: pending, routed, executing, completed, failed, cancelled
- [ ] Celery broker configured from CELERY_BROKER_URL environment variable
- [ ] Celery backend configured from CELERY_RESULT_BACKEND environment variable
- [ ] Beat schedule has one entry per build phase (B1-B12), each with interval_seconds=30
- [ ] Router function maps all seven agent_role values to their respective service URLs
- [ ] Router raises ValueError for unknown agent_role strings
- [ ] Dedup guard checks Redis key `task:dedup:{task_id}:{idempotency_key}` before routing
- [ ] Dedup guard sets TTL on dedup key equal to remaining budget hours converted to seconds
- [ ] Dedup guard returns cached result dict containing status, outputs, duration_seconds when key exists
- [ ] Progress tracker updates TaskRecord from TaskResult events without duplicating rows
- [ ] Phase gate function queries by phase name prefix (B1_, B2_, etc.) and filters by status != completed
- [ ] Phase gate returns empty error list when all tasks completed, non-empty list otherwise
- [ ] All Python files pass py_compile validation
- [ ] ORCHESTRATOR_READY event published to event bus

## Rollback

If the orchestrator detects circular dependencies between phases (a phase references itself or creates a cycle), halt all phase advancement, publish `PHASE_DEPS_INVALID` event with the dependency graph as detail, and alert the human operator. Do not proceed past B3 until the plan's dependency graph is corrected. Delete any partially-created PhaseGate records for unvalidated phases.
