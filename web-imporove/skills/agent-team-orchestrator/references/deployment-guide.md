# Deployment Guide

## Prerequisites

- Python 3.11 or higher
- Docker Engine 24+ with Compose v2
- Redis 7+
- PostgreSQL 15+ (or use pgvector image for embedding support)

## Step-by-Step Setup

### 1. Clone and Enter Repository

```bash
git clone <repo-url> web-platform
cd web-platform
```

### 2. Install Shared Library

```bash
pip install -e shared/
```

This makes all modules under `shared/` importable as top-level packages from any service.

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in real values:
- `OPENROUTER_API_KEY` — your OpenRouter API key
- `GITHUB_TOKEN` — personal access token with repo scope
- `SECRET_KEY` — Django secret key (generate via `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`)
- Any other variables your environment needs

### 4. Start Infrastructure

```bash
docker compose up -d postgres redis otel-collector prometheus grafana
```

Wait until health checks pass:

```bash
docker compose ps --filter status=running
```

Expected running services before application startup: `postgres`, `redis`.

### 5. Run Database Migrations

```bash
cd services/orchestrator && python manage.py migrate
cd ../memory && python manage.py migrate
cd ../gateway && python manage.py migrate
cd ../control_room && python manage.py migrate
```

Each service manages its own migrations independently. No cross-service migration orchestration exists.

### 6. Start Application Services

```bash
docker compose up -d
```

Or run locally for development:

```bash
# Terminal 1: Gateway
cd services/gateway && uvicorn main:app --reload --port 8000

# Terminal 2: Orchestrator + Celery worker
cd services/orchestrator && celery -A tasks worker --loglevel=info
cd services/orchestrator && uvicorn main:app --reload --port 8002

# Terminal 3: Control Room
cd services/control_room && uvicorn main:app --reload --port 8003
```

### 7. Run Smoke Test

```bash
pytest tests/smoke_test.py --verbose
```

All smoke tests must pass before considering the deployment healthy.

### 8. Verify Health Endpoints

```bash
curl http://localhost:8000/health
curl http://localhost:8002/health
curl http://localhost:8003/health
curl http://localhost:8004/health
```

Each should return `{"status": "ok"}` with HTTP 200.

## Known Limitations

- No production database support; only local dev databases
- No auto-scaling; replica count is fixed by docker-compose configuration
- OpenRouter rate limits apply per-key regardless of model tier
- Sandbox requires Docker socket access on the host machine (`unix:///var/run/docker.sock` mapping)
- No horizontal pod autoscaling; scaling is manual via docker-compose replicas
