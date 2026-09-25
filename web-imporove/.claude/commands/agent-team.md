---
description: Multi-service multi-agent orchestration platform built in Python/Django. Queen orchestrator plans tasks, agents execute in sandboxes, human approves before merge. Stops only on Hard Stop Triggers.
argument-hint: "[--mode=build|run|status|logs|stop] [--goals=<json>] [--budget=<usd>] [--service=name] [--resume]"
---

You are /web-improvement-loop:agent-team.

IMPORTANT PATH: The skill is at {cwd}/skills/agent-team-orchestrator/
Template Python code is at {cwd}/skills/agent-team-orchestrator/templates/python/
Orchestrator script is at {cwd}/skills/agent-team-orchestrator/scripts/run-agent-team.mjs

## Invocation

Run with one of these modes (from $ARGUMENTS):

  --mode=build    Scaffold shared/, services/*, tests/, docker-compose.yml, pyproject.toml, .env.example into templates/python/
  --mode=run      Start all services via docker compose up -d, process goals from GOALS.json
  --mode=status   Show active goals, task counts, budget usage, pending approvals
  --mode=logs     Tail service logs: --service=name (gateway|control_room|orchestrator|agent_runtime|sandbox|memory|git_bridge)
  --mode=stop     Gracefully stop all services via docker compose down

Arguments:
  --mode=MODE              build | run | status | logs | stop (default run)
  --goals=JSON             JSON goal(s) to add: {"goal":"...","roles":["backend"],"budget":30}
  --budget=USD             Max token cost in USD (default 50)
  --resume                 Resume from last STATE.json checkpoint
  --service=NAME           Service name filter for --mode=logs
  --dry-run                Validate configuration without executing

## Architecture

### Services (docker compose)
| Service       | Stack        | Port | Purpose                          |
|---------------|--------------|------|----------------------------------|
| gateway       | Django + DRF | 8000 | Public REST API                  |
| control_room  | Django + HTMX| 8001 | Admin dashboard UI               |
| orchestrator  | Django + Celery| 8002 | Queen LLM planner              |
| agent_runtime | FastAPI x3   | 8003 | Async worker pool                |
| sandbox       | FastAPI      | 8004 | Isolated Docker container exec   |
| memory        | FastAPI      | 8005 | pgvector semantic search         |
| git_bridge    | FastAPI      | 8006 | Draft PR creation                |
| postgres      | PostgreSQL   | 5432 | DB + pgvector extension          |
| redis         | Redis 7      | 6379 | Event bus (Streams) + rate limit |

### Shared Libraries
| Library          | Description                                |
|------------------|--------------------------------------------|
| contracts.py     | Pydantic models (Goal, TaskSpec, etc.)     |
| event_bus.py     | Redis Streams pub/sub with ack             |
| rate_limiter.py  | Redis sorted-set sliding window            |
| llm_client.py    | OpenRouter client with fallback model      |
| role_prompts.py  | Role prompts for designer/frontend/etc.    |
| logging.py       | Structured JSON log formatter              |

### LLM Config
- Provider: OpenRouter (qwen/qwen3.8-27b:free)
- Fallback: OPENROUTER_FALLBACK_MODEL env var
- Retry: exponential backoff on 429/5xx
- Audit: every call logged with correlation ID

## Execution Flow

```
User Goal -> Gateway POST /api/goals
    -> Orchestrator (Queen) parses goal -> JSON plan
    -> Builds DAG in Postgres
    -> Publishes task.assigned via Redis Streams
        -> agent_runtime worker picks up task
            -> Loads role prompt + memory context
            -> Calls OpenRouter within token_budget
            -> Writes files within allowed_paths
            -> Runs tests in sandbox containers
            -> Publishes task.completed
        -> git_bridge opens DRAFT PR
        -> Human reviews in control_room UI
            -> If approve: merge PR
            -> If reject: feedback loop to agent
```

## Mode Details

### --mode=build
Copies templates/python/ into place:
1. Scaffolds shared/ with all 6 library files
2. Creates services/{name}/ directories with full setup
3. Writes pyproject.toml, docker-compose.yml, .env.example
4. Creates tests/ with unit + integration test files
5. Generates README.md with setup instructions

Run: `node skills/agent-team-orchestrator/scripts/run-agent-team.mjs --mode=build`

### --mode=run
Starts the full platform:
1. Loads GOALS.json or accepts --goals=JSON
2. Queen receives goal events, plans tasks as JSON DAG
3. Dispatches to agent_runtime workers
4. Workers execute in sandbox containers
5. Results published to Redis Streams
6. Draft PRs opened for human approval

Check if services/ exists; if not, run --mode=build first.
Then: `docker compose -f skills/agent-team-orchestrator/docker-compose.yml up -d`

### --mode=status
Shows current state:
```bash
curl http://localhost:8000/health    # gateway health
curl http://localhost:8001/health    # control_room health
cat artifacts/agent-team-orchestrator/STATE.json
```
Also checks: active goals, running tasks, budget usage, pending approvals.

### --mode=logs --service=gateway
Tail logs from a specific service:
```bash
docker compose -f skills/agent-team-orchestrator/docker-compose.yml logs -f --tail=50 <service>
```
If --service is omitted, shows aggregated summary of all services.

### --mode=stop
Gracefully stops all services:
```bash
docker compose -f skills/agent-team-orchestrator/docker-compose.yml down
# Also cleans sandbox containers
docker rm -f $(docker ps -aq --filter "label=com.agent_team.sandbox" 2>/dev/null) 2>/dev/null || true
```

## Security Constraints
- No agent has direct production DB access
- Sandbox containers: network_disabled=True, read_only rootfs, cap_drop=ALL, mem_limit=1g
- All writes go through draft PRs, never direct push
- Audit log every LLM call with correlation ID

## Hard Stop Triggers (HST-B01..B06)
- B01: LLM provider persistent failure after fallback
- B02: Sandbox attempted network access
- B03: Agent wrote outside allowed_paths
- B04: Approval required but not granted
- B05: Budget cap exceeded
- B06: Secret leak detected

## Artifacts Directory
All outputs to artifacts/agent-team-orchestrator/:
- APPROVALS.json (SHA-256 locked user answers)
- COMPOSITION_REGISTRY.json (reusable assets scan)
- STATE.json (phase state machine, HST tracker)
- GOALS.json, PLAN.json, TASK_RESULT.json
- BUDGET.json (per-agent tracking, alerts)
- HARD_STOP_*.md (trigger reports)
- FINAL_REPORT.md (completion report)

## Guardrails
- Never commit secrets or print API keys
- Never touch production DB or auto-run migrations
- Never force push or rebase main
- All work through draft PRs, human must approve
- Every action idempotent (task_id + idempotency_key dedup)
- Budget cap enforced at every LLM call level
