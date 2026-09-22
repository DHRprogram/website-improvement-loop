# Phase B5: Agent Runtime

Implement the async agent worker service that executes tasks inside sandboxed containers with path validation, budget tracking, and forced cleanup.

## Purpose

Each agent (frontend, backend, QA, etc.) runs as an isolated Python process inside a Docker container with strict resource limits, no external network, read-only filesystem (except writable /workspace), and automatic teardown after task completion. This prevents agents from consuming unbounded resources or accessing sensitive data outside their scope.

## Timing

Runs after B4 (memory) is ready so agents can retrieve relevant past learnings. Must validate path enforcement before B6 (git bridge) begins creating PRs.

## Inputs

- `shared/event_bus.py` from B1
- `shared/contracts.py` TaskSpec, TaskResult, Artifact models from B1
- `shared/rate_limiter.py` from B1
- Sandbox service from B2 running on localhost:9090
- Memory service from B4 available at http://memory:8003

## Outputs

- Async worker implementation accepting TaskSpecs from Celery queue
- Path validation guard checking every file operation against an allowed_paths list
- Container lifecycle manager requesting create/run/teardown from sandbox service
- Budget tracker per-task reporting tokens used, duration, files changed
- Result publisher sending completed TaskResults back to event bus

## Steps

1. Define worker function `run_task(task_spec)` that receives a TaskSpec deserialized from the Celery message body.
2. Extract the target repository root and allowed_paths from task_spec.metadata.allowed_paths (default: [task_spec.goal_id]). Each path must be a relative path within the workspace — absolute paths are rejected.
3. For every file_read, file_write, edit_file, or shell command executed during the task, verify the target path starts with one of the allowed_paths prefixes. Raise PermissionDenied error immediately if any access falls outside the allowed set. Log the violation with full path for audit.
4. Call sandbox service POST `/api/v1/containers/create` with parameters derived from task_spec.agent_role: image pulled from registry, memory limit 1GB, CPU limit 0.5 cores, read_only_rootfs=True, cap_drop=ALL, network_disabled=True, workdir=/workspace mounted as rw volume.
5. Inside the sandbox, initialize a working directory by cloning the repository into /workspace using git clone --depth=1 to minimize I/O.
6. Execute the agent's task payload (a prompt string) via the LLM client, streaming output to /workspace/output.log. Stream includes X-Correlation-Id header propagated from the orchestrator.
7. After execution completes (or fails), compute a diff summary: number of files added, modified, deleted. Calculate token usage from the LLM audit log entries associated with this correlation-id.
8. Call sandbox service POST `/api/v1/containers/{id}/delete` to remove the container and its volume. Set always_remove=true in the call to enforce cleanup.
9. Construct a TaskResult with fields: task_id (matching input), status ("completed" or "failed"), outputs (dict with key="output_log", value=path="/workspace/output.log"), artifacts (list of Artifact objects for each changed file), duration_seconds, error (null if success).
10. Publish the TaskResult to the event bus under topic `task.completed:{task_id}`.
11. Publish `RUNTIME_READY` event.

## Checklist

- [ ] Worker function accepts TaskSpec with all required fields populated
- [ ] allowed_paths extracted from task_spec.metadata dict with default=[goal_id]
- [ ] Every file operation validates path prefix against allowed_paths before proceeding
- [ ] Absolute paths outside allowed set raise PermissionDenied (not swallowed silently)
- [ ] Violations logged with full path, task_id, agent_role for audit trail
- [ ] Sandbox create request sets memory_limit="1g" and cpu_shares=512
- [ ] Sandbox create request sets read_only_rootfs=True and cap_drop=["ALL"]
- [ ] Sandbox create request sets network_disabled=True preventing all outbound traffic
- [ ] Sandbox create request mounts workdir=/workspace as read-write volume
- [ ] Repository cloned into /workspace using git clone --depth=1 shallow checkout
- [ ] Agent prompt executed via shared/llm_client with X-Correlation-Id propagation
- [ ] Output streamed to /workspace/output.log during execution
- [ ] Diff summary computed by comparing pre/post workspace state
- [ ] Token usage aggregated from llm_client audit log matching this correlation-id
- [ ] Container teardown calls delete endpoint with force=true for guaranteed cleanup
- [ ] Post-teardown verification confirms container removed (inspect returns NotFound)
- [ ] TaskResult constructed with correct fields matching Pydantic contract schema
- [ ] TaskResult published to event bus topic pattern task.completed:{task_id}
- [ ] Rate limiter checked before each LLM call in the agent loop
- [ ] RUNTIME_READY event published to event bus

## Rollback

If path validation detects an attempt to access a disallowed path, terminate the agent task immediately, capture the current output log, mark the task as failed with error="PermissionDenied: attempted access to {path}", publish the result to the event bus, and tear down the sandbox. Do not allow partial file writes from a blocked agent. Log the incident under topic `security.path_violation` for review. If container teardown fails (container still running), force-remove it via the sandbox service DELETE endpoint and retry up to three times before halting the entire runtime.
