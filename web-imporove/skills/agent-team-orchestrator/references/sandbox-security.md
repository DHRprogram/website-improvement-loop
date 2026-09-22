# Sandbox Security Model

Agent tasks execute inside ephemeral Docker containers that enforce strict
isolation. The sandbox service (`services/sandbox/`) is the only component that
creates containers; all others communicate with it over HTTP.

---

## Container Creation Parameters

Every container created by `sandbox.docker_api.run_task()` uses these defaults:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `network_disabled` | `True` | No outbound network access; prevents data exfiltration |
| `read_only` | `True` | Root filesystem is immutable; agents cannot modify system binaries |
| `cap_drop` | `["ALL"]` | All Linux capabilities dropped; no privilege escalation |
| `mem_limit` | `"1g"` | 1 GB memory ceiling; prevents resource exhaustion / OOM kills |
| `tmpfs` | `{"workspace": "rw,size=512m"}` | Temporary writable workdir mounted at `/workspace`; cleared after run |
| `security_opt` | `["no-new-privileges:true"]` | Prevents setuid/setgid abuse |

---

## Work Directory Isolation

Agents write exclusively to `/workspace` (the tmpfs mount). After the command
finishes, the sandbox captures stdout/stderr and exits. The entire container is
scheduled for removal within five seconds via the cleanup background task.

**Never** configure the sandbox to use bind mounts for directories outside the
temporary workspace — that would give the agent visibility into host state.

---

## Network Policy

`network_disabled=True` means the container cannot:

- Reach OpenRouter, GitHub, or any external API
- Connect to the shared PostgreSQL or Redis backends
- Scan internal ports for lateral movement attempts

If a task genuinely needs network access (e.g., fetching a npm package during a
build), the container creator must call `run_task(network_disabled=False)`, but
this bypass should be rare and logged for audit.

---

## Memory Limits

The 1 GB hard cap per container applies even if the host has more RAM available.
Celery workers that submit very large tasks should chunk them to stay within
this bound. Agents exceeding ~80 % of the limit should receive a warning event
before hitting the OOM killer.

---

## Container Lifecycle

1. **Create** — Docker Engine creates the container with the parameters above.
2. **Run** — The specified command executes inside the container.
3. **Collect** — On exit, the sandbox captures `stdout` + `stderr` and the
   exit code. Pass/fail is determined by the exit code unless the caller
   provides custom validation logic.
4. **Remove** — The container is immediately removed (`auto_remove=True`). No
   orphaned containers persist across calls.
5. **Cleanup sweep** — A periodic background task removes stale containers older
   than the timeout window (default 300 s) as a belt-and-suspenders measure
   in case the main remove step fails.

---

## Audit Trail

Every container run logs:

- `correlation_id` — Propagated from the gateway request header.
- `task_id` — Originating task from the orchestrator.
- `agent_id` — Which agent triggered this sandbox invocation.
- `exit_code` — Command result.
- `duration_ms` — Wall-clock time.

These logs flow through OpenTelemetry to the collector endpoint configured in
`.env.example`.
