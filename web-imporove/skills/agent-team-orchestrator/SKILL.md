---
name: agent-team-orchestrator
description: Full orchestration system for multi-agent software teams with Queen orchestrator, sandboxed execution, budget tracking, and approval gates.
version: 1.0.0
---

# Agent Team Orchestrator Skill

Orchestrate a team of specialized agents working together on software improvements. A Queen orchestrator coordinates design, frontend, backend, QA, security, DevOps, and reviewer agents through a structured phase-based workflow.

## Quick Start

### Run an Agent Team Session

```bash
node skills/agent-team-orchestrator/scripts/run-agent-team.mjs --goal "Improve checkout page conversion" --mode run
node skills/agent-team-orchestrator/scripts/run-agent-team.mjs --dry-run        # Validate without executing
```

### Build Mode (--mode=build)

When running in build mode, the skill copies templates from `templates/python/` into their final locations:

```bash
node scripts/run-agent-team.mjs --mode build
```

This creates the following directories at runtime:
- `shared/` — contracts, role prompts, event bus, rate limiter, LLM client, logging
- `services/gateway/` — Django + DRF API gateway
- `services/control_room/` — Django + HTMX control dashboard
- `services/orchestrator/` — Django + Celery task orchestration
- `services/agent_runtime/` — Python async workers with sandbox isolation
- `services/sandbox/` — FastAPI container management (Docker API)
- `services/memory/` — Django + pgvector semantic search
- `services/git_bridge/` — FastAPI PR automation
- `tests/` — test suite

### Budget Tracking

```bash
node scripts/budget-tracker.mjs --status   # Current spend vs limits
node scripts/budget-tracker.mjs --reset     # Reset counters after a session
```

### Goal Parser

Parse natural language goals into structured task specifications:

```bash
node scripts/goal-parser.mjs "Redesign the dashboard with dark mode support"
```

### State Management

Persist and restore team state across sessions:

```bash
node scripts/state-manager.mjs save           # Save current state
node scripts/state-manager.mjs restore        # Restore previous state
node scripts/state-manager.mjs status         # View current state
```

## Architecture

### Phases

| Phase | File | Purpose |
|-------|------|---------|
| P0 | P0-approval-harvest.md | Harvest explicit approvals before any work begins |
| P1 | P1-planning.md | Plan architecture, assign agents, set budgets |
| B1-B12 | Build phases B1-B12 | Sequential implementation stages |

### Agents

Each agent has a dedicated role prompt in `agents/Q*-*.md`:

- **Q0 Queen** — Orchestrator that parses plans, assigns tasks, monitors progress
- **Q1 Designer** — UI/UX design and component specifications
- **Q2 Frontend** — HTML/CSS/JS implementation
- **Q3 Backend** — API, data model, business logic
- **Q4 QA** — Test strategy, test cases, quality assurance
- **Q5 Security** — Threat modeling, vulnerability assessment
- **Q6 DevOps** — Deployment, monitoring, infrastructure
- **Q7 Reviewer** — Code quality review and feedback
- **QX Budget Guard** — Monitors budget usage and halts when limit is reached

### Templates

Templates are stored under `templates/python/` and copied by the skill during build mode. They include:

- Shared Python modules with Pydantic models
- Full Django services (gateway, control_room, orchestrator, memory)
- FastAPI services (sandbox, git_bridge)
- Async agent runtime workers
- Docker Compose with postgres (pgvector), redis, otel-collector
- Complete test suites

## Guard Scripts

Shell guards enforce safety policies before and during execution:

- **no-secrets.sh** — Prevent committing secrets/tokens to version control
- **sandbox-network-off.sh** — Verify sandbox containers have no external network access
- **allowed-paths.sh** — Validate agents only operate within permitted paths
- **budget-cap.sh** — Enforce spending limits per session
- **llm-fallback.sh** — Ensure fallback LLM provider exists when primary fails
- **draft-pr-only.sh** — Force all Git PRs to open as drafts

## References

See `references/` for detailed documentation:

- `event-topics.md` — Event bus topic registry
- `role-prompts-guide.md` — How agent role prompts are structured
- `sandbox-security.md` — Sandbox isolation guarantees
- `idempotency.md` — Task deduplication and retry semantics
- `queen-prompt-guide.md` — Queen orchestrator prompt patterns
- `rate-limiting.md` — Token bucket and sliding window strategies
- `observability-guide.md` — Metrics, tracing, and alerting
- `security-overview.md` — Defense-in-depth architecture
- `deployment-guide.md` — Service deployment and configuration
- `hard-stops-guide.md` — Conditions that halt execution immediately

## Examples

Example JSON files in `examples/` demonstrate the expected schemas:

- `APPROVALS.example.json` — Approval request/response format
- `PLAN.example.json` — Generated project plan structure
- `TASK_RESULT.example.json` — Agent task result envelope
- `GOALS.example.json` — Structured goal specification
- `BUDGET.example.json` — Budget snapshot format
- `STATE.example.json` — Runtime state representation

## MCP Configuration

`.mcp.json` declares the tool namespace for integration with Claude Code's MCP system.

## Dependencies

Pin all versions in `pyproject.toml`. The editable `shared/` install provides contracts, event bus, rate limiting, and LLM client utilities to all services.

## License

MIT — see LICENSE.
