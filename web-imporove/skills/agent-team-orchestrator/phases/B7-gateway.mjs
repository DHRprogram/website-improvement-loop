# Phase B7: Gateway

Implement the API gateway service (Django + DRF) that provides a unified REST interface for all agent operations, query interfaces, and status reporting.

## Purpose

Serve as the single entry point for external tools to interact with the agent team. Accepts goal submissions, queries task progress, retrieves results, manages budgets, and serves human-facing APIs. All other services hide behind this gateway which handles authentication, rate limiting at the per-client level, and request validation.

## Timing

Runs after B3 (orchestrator models) are defined and B6 (git bridge) establishes branch tracking. Must be operational before B8 (control room) so the HTMX dashboard has an API to call.

## Inputs

- `shared/contracts.py` Goal, TaskSpec, TaskResult, Artifact, ApprovalRequest, BudgetSnapshot models from B1
- `shared/rate_limiter.py` per-process-group limiter from B1
- Django ORM models from B3 (TaskRecord, PhaseGate)
- Git bridge PR status endpoint from B6

## Outputs

- DRF routers for GoalsViewSet, TasksViewSet, ResultsViewSet, ApprovalsViewSet, BudgetViewSet
- Authentication via API key in X-API-Key header (no JWT — simpler for machine-to-machine)
- Per-client rate limiting applied at the gateway layer using shared/rate_limiter.py
- Swagger/OpenAPI documentation generated at /docs
- Prometheus metrics exported at /metrics including request counts, error rates, latency histograms

## Steps

1. Define Django REST Framework serializers for each model: GoalSerializer (all fields except created_at which is auto-populated), TaskSerializer with nested AgentRoleField restricted to allowed roles, ResultSerializer with nested ArtifactListField.
2. Create DRF ViewSet classes:
   - GoalsViewSet: list(), create(), retrieve(), destroy() — only approved users can create goals
   - TasksViewSet: list(filterable by goal_id, agent_role, status), retrieve()
   - ResultsViewSet: list(filterable by task_id), retrieve()
   - ApprovalsViewSet: create() for submitting new approval requests, list() showing current pending/approved/rejected approvals
   - BudgetViewSet: retrieve() returning current BudgetSnapshot, update() for manual adjustment
3. Implement API key authentication class: reads X-API-Key header, looks up the key in an APIKey Django model table, attaches the corresponding user object to the request. Reject with HTTP 401 if key missing or invalid.
4. Apply per-client rate limiting middleware: extract client identifier from API key, call shared.rate_limiter.RateLimiter(client_id).check(). If exceeded, return HTTP 429 with Retry-After header set to next retry window in seconds.
5. Add exception handlers catching PermissionDenied, TaskNotFound, ValidationError, mapping them to appropriate HTTP status codes (403, 404, 422) with JSON error bodies containing error code and detail message.
6. Wire OpenAPI schema generation using drf-spectacular library, serving at /docs route.
7. Wire Prometheus metrics using prometheus-django-middleware on /metrics route counting http_requests_total by method+path+status, http_request_duration_seconds histogram, celery_tasks_active gauge.
8. Run syntax check: py_compile on all views and serializers.
9. Publish GATEWAY_READY event.

## Checklist

- [ ] Five ViewSets implemented: Goals, Tasks, Results, Approvals, Budget
- [ ] GoalsViewSet supports CRUD; only authenticated users can POST/create
- [ ] TasksViewSet list accepts filter parameters: goal_id, agent_role, status
- [ ] AgentRoleField restricts to exactly seven valid values
- [ ] ResultsViewSet list accepts task_id filter
- [ ] ArtifactListField serializes arrays of {path, type, size_bytes, checksum_sha256}
- [ ] ApprovalsViewSet create accepts requester, resource, action, reason; returns approval ID
- [ ] BudgetViewSet retrieve returns current snapshot with total_cap, spent_usd, remaining_usd
- [ ] API auth reads X-API-Key header, validates against APIKey model, sets request.user
- [ ] Invalid or missing API key returns HTTP 401 Unauthorized
- [ ] Rate limiting middleware checks per-client using shared/rate_limiter.RateLimiter
- [ ] Rate limit exceeded returns HTTP 429 with Retry-After header (integer seconds)
- [ ] Exception handlers map PermissionDenied->403, TaskNotFound->404, ValidationError->422
- [ ] Error responses use consistent format: {"error": "code", "detail": "human message"}
- [ ] OpenAPI docs served at /docs using drf-spectacular
- [ ] Prometheus metrics served at /metrics with http_requests_total counter and duration histogram
- [ ] All Python files pass py_compile validation
- [ ] GATEWAY_READY event published to event bus

## Rollback

If API key authentication conflicts with existing authentication mechanisms in the host project, disable the gateway temporarily, log the conflict under topic `gateway.auth_conflict`, and alert the operator. The gateway can still accept unauthenticated requests in this mode but must include warning headers in every response indicating the system is operating without access control. Do not proceed past B7 until either authentication works correctly or the operator explicitly opts into no-auth mode with documented acknowledgment.
