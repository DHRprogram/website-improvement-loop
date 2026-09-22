# Agent Team Orchestrator — README

## Quick Start

### Prerequisites
- Python 3.11+
- Docker + Docker Compose v2
- Redis 7+ running locally or via docker-compose

### One-command build

```bash
# Install dependencies
pip install -e shared/

# Copy and configure environment
cp .env.example .env

# Start infrastructure
docker compose up -d postgres redis

# Run tests
python -m pytest tests/ -v
```

### Full platform launch

```bash
docker compose up -d
```

This starts all services: gateway (port 8000), control_room (port 8001), 
orchestrator/celery (port 8002), agent_runtime x3 replicas, sandbox (port 8004), 
memory (port 8005), git_bridge (port 8006).

### Health checks

All services expose `/health` endpoints:
```bash
curl http://localhost:8000/health    # gateway
curl http://localhost:8001/health    # control_room
curl http://localhost:8002/health    # orchestrator
curl http://localhost:8004/health    # sandbox
curl http://localhost:8005/health    # memory
curl http://localhost:8006/health    # git_bridge
```

## Architecture Overview

```
User → Gateway (DRF/JWT) → Orchestrator (Queen/Celery)
                                    ↓
                              Task DAG → Agent Runtime (async workers)
                                                ↓
                                         Sandbox (Docker) → Tests
                                                ↓
                                          Git Bridge → Draft PR
                                                      ↓
                                               Human Approval (Control Room UI)
```

The Queen planner receives goals, decomposes them into tasks with roles,
dependencies, and token budgets. Each worker fetches its role prompt from
`shared.role_prompts`, calls OpenRouter within the budget, writes only to
allowed paths (validated by `path_validator`), runs tests in a sandboxed
container, then publishes results via Redis Streams event bus. All changes
go through DRAFT PRs — humans approve via the control room dashboard before
any merge.

## Configuration

Copy `.env.example` to `.env` and fill in:
- `OPENROUTER_API_KEY` — your OpenRouter key (required)
- `GITHUB_TOKEN` — GitHub personal access token with repo scope
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection URL

See `.env.example` for all available variables (23 total).

## Testing

```bash
# All tests
python -m pytest tests/ -v

# Specific test categories
python -m pytest tests/test_contracts.py        # Contract validation
python -m pytest tests/test_rate_limiter.py     # Rate limiter behavior
python -m pytest tests/test_event_bus.py        # Pub/sub patterns
python -m pytest tests/test_sandbox.py          # Container execution
python -m pytest tests/test_queen_plan.py       # Plan parsing
python -m pytest tests/test_path_validation.py  # Path security
python -m pytest tests/smoke_test.py            # End-to-end integration
```

Smoke test mocks all external services and verifies the full flow:
Goal → Queen plan → Task dispatch → Sandbox execution → Draft PR creation.

## Known Limitations

### Security & Production Readiness
- **No production database support** — databases are configured for local development only
- **No auto-scaling** — replica counts are fixed by docker-compose configuration
- **OpenRouter rate limits apply** — the per-key limit depends on your OpenRouter tier
- **Sandbox requires Docker socket** — the sandbox service needs `unix:///var/run/docker.sock` mounted on the host machine
- **No authentication hardening** — JWT middleware is scaffold-level; production deployments should add API keys, OAuth2, or SAML

### Platform Capabilities
- **No CI/CD pipeline automation** — pipelines exist as YAML but require manual activation
- **No secret rotation** — secrets loaded once at startup from .env files
- **Limited rollback automation** — rollback procedures documented but not fully automated beyond git revert
- **Single-region deployment** — architecture targets single-region; multi-region requires additional configuration
- **No built-in monitoring dashboards** — Prometheus scraping enabled but Grafana dashboards not included

### Development Constraints
- **Python version locked to 3.11+** — older versions unsupported due to type annotation requirements
- **PostgreSQL required** — no MySQL or SQLite fallback tested
- **OpenRouter primary provider** — other providers require code changes to llm_client.py

## Hard Stop Triggers (HST-B01..B06)

| Trigger | Condition | Response |
|---------|-----------|----------|
| HST-B01 | LLM provider persistent failure after fallback switch | Halt all task dispatch, alert human operator |
| HST-B02 | Sandbox attempted network access | Kill container, audit logs, block this agent |
| HST-B03 | Agent tried to write outside allowed_paths | Reject write, report violation, halt task |
| HST-B04 | Human approval required but not yet granted | Block merge, wait indefinitely until approved |
| HST-B05 | Budget cap exceeded (tokens or cost) | Disable new task dispatch, review spend with human |
| HST-B06 | Secret leak detected in staged files | Block commit, sanitize file, re-approve |

## Service Ports Summary

| Service | Port | Purpose |
|---------|------|---------|
| Gateway | 8000 | Public API (REST/JSON) |
| Control Room | 8001 | HTMX admin dashboard |
| Orchestrator | 8002 | Celery worker coordination |
| Agent Runtime | 8003 | Async worker pool (x3 replicas) |
| Sandbox | 8004 | Isolated container execution |
| Memory | 8005 | pgvector semantic search |
| Git Bridge | 8006 | GitHub PR automation |
| Prometheus | 9090 | Metrics collection |
| OTLP Collector | 4317 | Distributed tracing |
