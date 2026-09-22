# Security Overview — Reference Guide

## No Direct Production Database Access

No agent, service, or worker has credentials for a production database. The `DATABASE_URL` environment variable is configured in `.env.example` only with placeholder values. When Skill B runs `--mode=build`, it creates service databases that are local to docker-compose (postgres:alpine image), never pointing at any production instance. Any migration is written as an Alembic script but never auto-run without explicit human approval.

## Sandbox Isolation

Every sandbox container enforces these security controls:

| Control | Value | Purpose |
|---------|-------|---------|
| network_disabled | True | Blocks all outbound network access |
| read_only | True | Root filesystem mounted read-only |
| cap_drop | ALL | Drops all Linux capabilities |
| mem_limit | 1g | Hard memory ceiling prevents DoS |
| tmpfs | /workspace | Temporary writable area |

After every run the container is always removed (never left orphaned). The cleanup function is called as part of the same async flow as the run, not as a background task that could be skipped.

## Secret Management

All secrets enter services exclusively through `.env` files loaded via `python-dotenv`. No secret is ever:

- Printed to stdout/stderr
- Stored in git history
- Logged by the structured logger
- Passed as a query parameter or URL segment

The `OPENROUTER_API_KEY` flows into `llm_client.py` where it appears in the Authorization header; the log record stores only a truncated hash (`OPENROUTER_API_KEY=<hash>`), never the key itself.

## Audit Logging

Every LLM call produces one audit log entry containing:

| Field | Description |
|-------|-------------|
| timestamp | ISO-8601 UTC |
| agent_id | Which agent made the call |
| task_id | Associated task ID |
| prompt_hash | SHA-256 of the full prompt text |
| tokens_in / tokens_out | Token counts |
| cost_usd | Calculated cost |
| latency_ms | Time to first token + time to complete |
| correlation_id | Propagated from parent request |
| model | Model identifier used |

Audit entries are written to `artifacts/agent-team-orchestrator/audit.log.jsonl` and are immutable (append-only).

## Correlation ID Propagation

The `X-Correlation-Id` header is generated once at the gateway on inbound requests and attached to:

- Every outgoing HTTP call (FastAPI, Django, Celery)
- Every Redis Streams message metadata
- Every log line across all services
- Every OpenTelemetry span attribute

If no `X-Correlation-Id` is present in an inbound request, the gateway generates one using UUID4 before forwarding.

## Draft PR Only Policy

The git_bridge service calls `GithubRepository.create_pull()` with `draft=True` on every invocation. It contains no code paths that:

- Call `pull_request.merge()`
- Push directly to the main branch
- Force-push any existing ref
- Delete any remote branch

Merge decision is manual only: a human reviews the draft PR and approves through the control_room UI before any merge happens.

## Role-Based Permissions

Each role is assigned an `allowed_paths` glob list that limits which files the agent can write:

| Role | allowed_paths scope |
|------|--------------------|
| designer | CSS/design/static assets only |
| frontend | Frontend source and component files |
| backend | Backend source, migrations, shared contracts |
| qa | tests/ directory only |
| security | Read-only on most paths, write only to reports |
| devops | Infrastructure config, docker-compose, CI pipelines |
| reviewer | Read-only, outputs JSON approval report |

All path validation happens client-side in `agent_runtime/path_validator.py` before any file write is attempted. A violation halts the task immediately and fires HST-B03.
