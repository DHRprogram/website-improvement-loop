---
description: Multi-service multi-agent orchestration platform built in Python/Django. Queen orchestrator plans tasks, agents execute in sandboxes, human approves before merge. Stops only on Hard Stop Triggers.
argument-hint: "[--mode=build|run|status] [--goals=<json>] [--budget=<usd>] [--resume]"
---

You are /web-improvement-loop:agent-team.

IMPORTANT PATH: The skill is at {cwd}/skills/agent-team-orchestrator/

## Overview

This skill builds and runs a multi-agent orchestration platform consisting of 7
services plus shared libraries. A Queen orchestrator receives goals, plans tasks
via LLM, dispatches to specialized agents running in sandboxed containers, and
requests human approval before merging via draft PRs.

## Invocation

1. Check if {cwd}/services/ already exists (from --mode=build):
   - If YES: start services with docker-compose up
   - If NO: run --mode=build first
2. Invoke the skill via reading {cwd}/skills/agent-team-orchestrator/SKILL.md directly
3. Or use the orchestrator script:
   node {skill_dir}/scripts/run-agent-team.mjs --dry-run

## Arguments (from $ARGUMENTS)

  --mode=MODE              build | run | status (default run)
  --goals=JSON             JSON string of goal(s) to process
  --budget=USD             Max token cost in USD (default 50)
  --resume                 Resume from last STATE.json checkpoint
  --dry-run                Validate config + show plan without executing

## Architecture

### Services
| Service | Stack | Purpose |
|---------|-------|---------|
| gateway | Django + DRF | Public API, JWT auth |
| control_room | Django + HTMX | Admin UI dashboard |
| orchestrator | Django + Celery | Queen orchestrator |
| agent_runtime | Python async | Task execution workers (3 replicas) |
| sandbox | FastAPI + Docker | Isolated task execution environment |
| memory | Django + pgvector | Semantic memory store |
| git_bridge | FastAPI + PyGithub | Draft PR creation |

### Shared Libraries
| Library | Description |
|---------|-------------|
| contracts.py | Pydantic models (Goal, TaskSpec, TaskResult, etc.) |
| event_bus.py | Redis Streams pub/sub with ack |
| rate_limiter.py | Redis sorted-set sliding window |
| llm_client.py | OpenRouter client with retry + audit log |
| role_prompts.py | Role-specific prompts for each agent type |
| logging.py | Structured JSON logging |

### LLM Configuration
- Provider: OpenRouter
- Model: qwen/qwen3.8-27b:free
- Fallback: OPENROUTER_FALLBACK_MODEL env var
- Retry: exponential backoff on 429/5xx
- Auth: OPENROUTER_API_KEY from env (never logged)

### Queen Planning Prompt
The Queen converts user goals into a JSON plan:
```json
{
  "tasks": [
    {
      "title": "...",
      "description": "...",
      "role": "designer|frontend|backend|qa|security|devops|reviewer",
      "depends_on": [],
      "priority": "low|normal|high|critical",
      "allowed_paths": ["src/**"],
      "token_budget": 5000
    }
  ]
}
```

### Agent Roles
| Role | Allowed Paths | Constraints |
|------|---------------|-------------|
| designer | src/frontend/**/*.css, public/assets/* | WCAG 2.2 AA, color contrast |
| frontend | src/frontend/**/*.tsx, public/components/* | React hooks rules, accessibility |
| backend | src/backend/**/*.py | Django ORM rules, no raw SQL without review |
| qa | tests/, playwright/ | Coverage >=80%, regression-only |
| security | ** | OWASP Top 10, no secrets in code |
| devops | docker-compose.yml, .github/workflows/* | Never touch prod DB |
| reviewer | ** | Returns {"approved": bool, "issues": [...]} |

## Security Constraints
- No agent has direct production DB access
- Sandbox containers have network_disabled=True, read_only rootfs, cap_drop=ALL
- All writes go through draft PRs, never direct push to main
- Audit log every LLM call with correlation ID
- All secrets loaded from .env, never logged or printed

## Rate Limiting
- Redis sorted-set sliding window
- Default: 20 requests per 60 seconds per process group
- On 429: backoff and requeue (never drop)
- On persistent failure: switch to fallback model

## Hard Stop Triggers (HST-B01..B06)
B01: LLM provider persistent failure after fallback switch
B02: Sandbox attempted network access
B03: Agent tried to write outside allowed_paths
B04: Human approval required but not yet granted
B05: Budget cap exceeded (tokens or cost)
B06: Secret leak detected in staged files

## Build Mode (--mode=build)
When invoked with --mode=build, the skill:
1. Scaffolds shared/ with all 6 library files
2. Creates all 7 service directories with full Django/FastAPI setup
3. Writes pyproject.toml with pinned dependencies
4. Writes docker-compose.yml with all services
5. Writes .env.example with all required variables
6. Creates tests/ directory with unit + integration tests
7. Generates Django migrations where applicable
8. Writes README.md with setup instructions and known limitations

## Run Mode (--mode=run)
When invoked with --mode=run:
1. Loads GOALS.json from artifacts/agent-team-orchestrator/
2. Queen receives goal.created events
3. Plans tasks, builds DAG
4. Dispatches task.assigned to agent_runtime
5. Workers execute in sandbox containers
6. Results sent as task.completed events
7. Review requested -> human approve/reject
8. Draft PR opened for approved changes

## Status Mode (--mode=status)
Shows current state:
- Active goals and tasks
- Budget usage
- Agent health
- Pending approvals
- Recent hard stop triggers

## Execution Flow

```
User Goal -> Gateway POST /api/goals
    -> Orchestrator (Queen) parses goal -> JSON plan
    -> Builds DAG in Postgres
    -> Publishes task.assigned
        -> agent_runtime worker subscribes task.assigned
            -> Loads role prompt + memory context
            -> Calls OpenRouter with token budget
            -> Writes files within allowed_paths
            -> Sends files to sandbox for tests
            -> Publishes task.completed with artifacts
        -> git_bridge opens DRAFT PR
        -> Human reviews -> approve/reject
            -> If approve: merge PR
            -> If reject: send feedback to agent
```

## Artifacts Directory
All outputs written to artifacts/agent-team-orchestrator/:
- APPROVALS.json
- COMPOSITION_REGISTRY.json
- STATE.json
- GOALS.json
- PLAN.json
- TASK_RESULT.json
- BUDGET.json
- HARD_STOP_*.md
- FINAL_REPORT.md

## Guardrails
- Never commit secrets. Never print API keys.
- Never touch production DB. Never auto-run migrations.
- Never force push, never rebase main.
- All work through draft PRs, human must approve before merge.
- Every action idempotent (task_id + idempotency_key dedup).
- All writes tracked in structured logs with correlation IDs.
- Budget cap enforced at every LLM call level.

## Non-Goals
- Production deployment automation (manual gate required)
- Infrastructure provisioning outside docker-compose
- Direct database modifications on production servers
- Auto-scaling decisions without human input
- Third-party integrations beyond OpenRouter, GitHub, Redis, PostgreSQL

## Resume Protocol
1. STATE.json lives at artifacts/agent-team-orchestrator/STATE.json
2. Each phase/approval appends its record before moving forward
3. If interrupted, re-invoke with --resume
4. Load STATE.json, find last completed milestone, continue from next
5. Approvals are NOT re-requested unless they expired

## Final Report Schema
Written to artifacts/agent-team-orchestrator/FINAL_REPORT.md on completion. Sections:
1. Executive Summary
2. Goals Processed
3. Tasks Completed vs Failed
4. Budget Usage (total tokens, total cost, per-agent breakdown)
5. PRs Created and Merged
6. All Hard Stop Reports (if any fired)
7. Agent Performance Summary
8. Lessons Learned

## Invocation Examples

```
/web-improvement-loop:agent-team --mode=build
/web-improvement-loop:agent-team --mode=run --goals='{"goal":"Build auth microservice","roles":["backend","qa","security"]}'
/web-improvement-loop:agent-team --mode=status
/web-improvement-loop:agent-team --resume --budget=100
/web-improvement-loop:agent-team --dry-run
```
