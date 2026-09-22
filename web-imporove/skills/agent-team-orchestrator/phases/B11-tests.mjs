# Phase B11: Tests

Implement the complete test suite covering contracts validation, rate limiting, event bus operations, sandbox wrapper, Queen plan parsing, agent runtime path validation, observability instrumentation, and end-to-end integration scenarios.

## Purpose

Ensure every contract is type-checked, every boundary condition is covered, every security guard functions correctly under adversarial input, and the full pipeline (goal submit -> agent execution -> result retrieval) works as an integrated flow. Tests run in CI before any build phase artifact is committed.

## Timing

Runs after B10 (observability) confirms all services emit correct telemetry. Tests must verify telemetry generation before B12 (bring-up report) consumes those metrics for the final summary.

## Inputs

- All services implemented in B1-B10
- Docker Compose stack running with postgres and redis available for test fixtures
- pytest installed as a dev dependency in pyproject.toml [project.optional-dependencies]
- pytest-django plugin configured for Django service tests
- pytest-asyncio configured for async event bus and agent runtime tests

## Outputs

- `tests/test_contracts.py` — validates all Pydantic model schemas
- `tests/test_rate_limiter.py` — validates token bucket sliding window behavior
- `tests/test_event_bus.py` — validates publish/subscribe/ack semantics
- `tests/test_sandbox_wrapper.py` — validates container lifecycle with mocked docker
- `tests/test_queen_plan_parsing.py` — validates plan JSON acceptance and rejection
- `tests/test_agent_runtime.py` — validates path enforcement and resource limits
- `tests/test_observability.py` — validates trace and metric emission
- Integration test suite: end-to-end goal submission through result retrieval
- Test coverage report: minimum 80% line coverage across all packages

## Steps

1. Write `tests/test_contracts.py`:
   - Goal model: test valid creation with all fields, test missing required title field raises ValidationError, test priority enum values (low/normal/high/critical only).
   - TaskSpec model: test valid creation, test invalid agent_role raises ValidationError, test empty accepted_criteria list raises ValidationError.
   - TaskResult model: test success case with null error, test failure case with non-null error string.
   - Artifact model: test size_bytes must be >= 0, test checksum_sha256 must be 64 hex characters.
   - ApprovalRequest model: test required approver identity, test approved_at auto-populated on approval.
   - BudgetSnapshot model: test spent_usd <= total_cap constraint enforced.

2. Write `tests/test_rate_limiter.py`:
   - Create RateLimiter instance with custom limit of 5 requests per 30 seconds using Redis test fixture.
   - Verify first 5 check() calls return True.
   - Verify 6th call returns False (rate limited).
   - Wait 31 seconds and verify check() returns True again (window slid).
   - Verify two different process groups have independent counters.
   - Verify backoff duration follows exponential pattern: 500ms, 1000ms, 2000ms, 4000ms, 8000ms.

3. Write `tests/test_event_bus.py`:
   - Start two subscriber groups listening to topic "test.messages".
   - Publish message with payload {"data": "hello"}.
   - Verify group A received the message via its async generator.
   - Verify group B also received the same message (independent consumer groups).
   - Acknowledge the message from group A; verify it is removed from pending set.
   - Verify group B still receives the unacknowledged message when iterating its generator.
   - Test subscribe with no matching messages returns empty generator immediately.

4. Write `tests/test_sandbox_wrapper.py`:
   - Mock the docker.Client class using unittest.mock.patch.
   - Test create_container with all required parameters (memory_limit="1g", cap_drop=["ALL"], network_disabled=True, read_only=True).
   - Verify the mock was called with exactly these parameters.
   - Test delete_container verifies container_id exists before calling remove().
   - Test delete_container sets force=True to ensure cleanup even if container still has processes running.
   - Test get_container_logs returns the stdout/stderr combined output string.

5. Write `tests/test_queen_plan_parsing.py`:
   - Valid plan JSON: test that parse_plan() accepts a well-formed plan with phases array, agent_assignments dict, budget_allocation object. Returns parsed PlanData.
   - Missing required fields: test that absent phases key raises ValueError with descriptive message.
   - Invalid phase names: test that unknown phase name strings are rejected (must match B1-B12 or P0-P1 pattern).
   - Budget validation: test that sum of agent budgets exceeds total cap is rejected.
   - Malformed JSON: test that invalid JSON strings raise json.JSONDecodeError.
   - Extra fields: test that unknown keys in phase objects are silently ignored (forward compatibility).

6. Write `tests/test_agent_runtime.py`:
   - Create an AgentRuntime with allowed_paths = ["/workspace/src"].
   - Verify a file operation targeting "/workspace/src/main.py" succeeds.
   - Verify a file operation targeting "/workspace/config/secrets.json" raises PermissionDenied because it falls outside allowed_paths.
   - Verify absolute paths starting with "/" outside the workspace prefix are always rejected.
   - Test shell command execution respects the same path restrictions (cannot use cp/mv/rsync to access disallowed files).
   - Test container resource limit verification: verify that requested memory does not exceed the 1GB maximum.

7. Write `tests/test_observability.py`:
   - Start a Django test client making requests to various endpoints.
   - Verify http_requests_total counter increases by one for each request.
   - Verify http_request_duration_seconds histogram receives a sample for each request.
   - Verify X-Correlation-Id header appears in response headers for every endpoint.
   - Verify new requests without an incoming correlation-id get a generated UUID.
   - Verify subsequent spans within the same request share the same trace ID.

8. Write `tests/integration/test_pipeline.py`:
   - Submit a simple goal through the gateway POST /api/goals/.
   - Verify the goal is created and returns a goal_id.
   - Verify the orchestrator routes a corresponding task (check TaskRecord status transitions: pending -> routed -> executing).
   - Wait for task completion (poll with retry up to 60 seconds).
   - Verify TaskResult status is completed and artifacts list is populated.
   - Verify the git bridge created a branch and opened a draft PR.
   - Verify the result is retrievable via GET /api/results/?task_id={id}.

9. Run the full test suite: `pytest tests/ --cov=. --cov-report=term-missing --tb=short` and verify coverage meets the 80% threshold.

## Checklist

- [ ] test_contracts.py covers all six Pydantic models with validation tests
- [ ] Goal model rejects missing title field with ValidationError
- [ ] TaskSpec model rejects invalid agent_role strings
- [ ] BudgetSnapshot enforces spent_usd <= total_cap constraint
- [ ] Rate limiter allows exactly the configured number of requests per window
- [ ] Rate limiter blocks requests exceeding the configured limit
- [ ] Rate limiter windows slide correctly after elapsed time
- [ ] Multiple process groups have independent rate counters
- [ ] Exponential backoff doubles correctly from 500ms base
- [ ] Event bus publishes deliver to all subscribing consumer groups independently
- [ ] Event bus ack removes only from the acknowledging group's pending set
- [ ] Sandbox create passes all six security parameters to Docker API
- [ ] Sandbox delete uses force=True for guaranteed removal
- [ ] Queen parser accepts valid plans and rejects malformed ones
- [ ] Queen parser rejects budgets summing above total cap
- [ ] Queen parser ignores unknown keys in phase objects
- [ ] Path validation allows operations within allowed_paths
- [ ] Path validation rejects operations outside allowed_paths
- [ ] Shell commands cannot bypass path restrictions via symlink traversal
- [ ] Observability middleware generates correlation IDs on missing requests
- [ ] Trace propagation links gateway span to agent execution span
- [ ] Prometheus counters and histograms increment correctly
- [ ] Integration pipeline test flows: goal submit -> task route -> result retrieve -> PR open
- [ ] Full test suite achieves at least 80% line coverage across all packages

## Rollback

If any individual test fails, fix the root cause in the affected source file and re-run only that test file plus any tests that depend on the same module (identified by import graph analysis). Do not suppress failing tests with markers or skip annotations — every assertion must pass. If the integration pipeline test fails due to timeout (task did not complete within 60 seconds), increase the timeout parameter but investigate whether the root cause is slow LLM responses or a stuck Celery worker, then fix accordingly. Never proceed past B11 until all tests pass at 80%+ coverage.
