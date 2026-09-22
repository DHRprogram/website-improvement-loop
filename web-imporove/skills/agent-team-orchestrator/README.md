# Agent Team Orchestrator

A full orchestration system for multi-agent software teams. Queen orchestrator coordinates design, frontend, backend, QA, security, DevOps, and reviewer agents through structured phases with sandboxed execution, budget tracking, approval gates, and observability.

## Quick Start

```bash
# Dry run — validate without executing
node scripts/run-agent-team.mjs --dry-run

# Run a session
node scripts/run-agent-team.mjs --goal "Improve checkout conversion" --mode run

# Build mode — copies templates into final locations
node scripts/run-agent-team.mjs --mode build
```

## Architecture

```
Queen Orchestrator
  ├── Designer (Q1)       → UI specs, color tokens, layout definitions
  ├── Frontend (Q2)       → HTML/CSS/JS implementation
  ├── Backend (Q3)        → Django models, API endpoints, migrations
  ├── QA Engineer (Q4)    → Test plans, pytest files, coverage analysis
  ├── Security Auditor (Q5) → Threat models, vulnerability scans
  ├── DevOps (Q6)         → Dockerfiles, CI workflows, monitoring rules
  └── Reviewer (Q7)       → Code quality review, regression assessment
          ↑
     Budget Guard (QX)   → Real-time spend monitoring, hard stop enforcement
```

## Phases

| Phase | Description |
|-------|-------------|
| P0 | Approval harvest — lock scope, budget, quality bar |
| P1 | Planning — architecture, agent assignments, budgets |
| B1 | Shared contracts — Pydantic models, event bus, rate limiter, LLM client |
| B2 | Services setup — Docker Compose stack, health checks |
| B3 | Orchestrator — task routing, idempotency, phase gates |
| B4 | Memory — pgvector semantic search for past learnings |
| B5 | Agent runtime — sandboxed task execution with path validation |
| B6 | Git bridge — feature branches, draft PRs only |
| B7 | Gateway — unified REST API via Django DRF |
| B8 | Control room — HTMX dashboard for human monitoring |
| B9 | Remaining roles — designer/frontend/backend/QA/security/devops/reviewer services |
| B10 | Observability — OTEL tracing, Prometheus metrics |
| B11 | Tests — full test suite with coverage targets |
| B12 | Bring-up report — readiness verdict with evidence |

## Guard Scripts

Shell guards enforcing safety policies:

- `no-secrets.sh` — prevents committing secrets/tokens
- `sandbox-network-off.sh` — verifies sandbox containers have no external network
- `allowed-paths.sh` — validates agents stay within permitted paths
- `budget-cap.sh` — enforces spending limits
- `llm-fallback.sh` — ensures fallback provider when primary fails
- `draft-pr-only.sh` — forces draft PRs only

## Directory Structure

```
skills/agent-team-orchestrator/
├── SKILL.md              # Skill definition
├── README.md             # This file
├── LICENSE               # MIT License
├── CHANGELOG.md          # Version history
├── .gitignore
├── .mcp.json             # MCP server configuration
├── pyproject.toml        # Python dependencies
├── docker-compose.yml    # Service definitions
├── .env.example          # Environment variables
├── phases/               # Phase documentation and execution scripts
├── agents/               # Agent role definitions and prompts
├── scripts/              # CLI tools and automation scripts
│   ├── guards/           # Shell-based safety guards
├── references/           # Detailed documentation
├── examples/             # Example JSON schemas
└── templates/            # Runtime-generated service templates
    └── python/           # Copied to final locations during --mode=build
```

## License

MIT — see LICENSE.
