# Observability Guide

Every service in the platform emits structured logs, distributed traces, and
prometheus-style metrics. This document describes how each signal works and
which metrics are exposed.

---

## Structured Logging

All log records are JSON-formatted and written to stdout (captured by Docker)
and optionally rotated files via `logging.RotatingFileHandler`. Each record
carries these standard fields:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | ISO 8601 | When the event occurred |
| `level` | string | DEBUG / INFO / WARNING / ERROR / CRITICAL |
| `service` | string | Name of the service emitting the log |
| `message` | string | Human-readable description |
| `correlation_id` | string | X-Correlation-Id from the original HTTP request |
| `task_id` | string | UUID of the originating task, if applicable |
| `agent_id` | string | ID of the agent involved, if applicable |

Log levels filter: DEBUG in development, INFO in production. Warnings and above
are always captured. Errors include a traceback field.

---

## Metrics Endpoints

Every service exposes `/metrics` at HTTP port `${SERVICE_HTTP_PORT}`.
Formats are Prometheus exposition. Below are the metric names and descriptions.

### Gateway Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `requests_total` | counter | `method`, `endpoint`, `status` | Total HTTP requests handled |
| `request_duration_seconds` | histogram | `endpoint` | Request processing latency |
| `errors_total` | counter | `code` | Error responses by HTTP status code |

### Orchestrator Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `tasks_total` | counter | `status`, `role` | Tasks created by status and role |
| `tasks_failed` | counter | `reason` | Failed tasks grouped by failure reason |
| `dag_ready_tasks` | gauge | — | Tasks currently waiting on dependencies |

### Agent Runtime Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `llm_tokens_total` | counter | `model`, `direction` | Tokens sent/received by model |
| `llm_cost_total` | counter | `model` | Cumulative USD cost by model |
| `llm_latency_seconds` | histogram | `model` | LLM API call latency distribution |
| `sandbox_runs_total` | counter | `status` | Sandbox executions (pass/fail) |
| `tasks_completed_total` | counter | `role` | Successfully completed agent tasks |

### Git Bridge Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `pr_created_total` | counter | `draft` | Pull requests opened (always draft=true) |
| `pr_review_comments_total` | counter | — | Comments left by reviewers |

---

## OpenTelemetry Trace Propagation

Trace contexts propagate via the `traceparent` W3C trace context header and
the custom `X-Correlation-Id` header. The chain:

```
Gateway (OTel middleware)
  → Orchestrator (Celery task spans)
    → Agent Runtime (LLM call span)
      → Sandbox (HTTP client span)
        → Git Bridge (PR creation span)
```

Each service instruments:
- FastAPI apps: `opentelemetry-instrumentation-fastapi`
- Django apps: `opentelemetry-instrumentation-django`
- HTTP client calls: `httpx` instrumentation
- Redis operations: `redis` instrumentation
- Celery tasks: automatic span per task

---

## X-Correlation-Id Propagation

The `X-Correlation-Id` header (UUID v4, generated once at the gateway) flows
through every service layer. Middleware extracts it at the HTTP boundary, adds
it to every structured log record, and propagates it to downstream HTTP calls
via the same header. In Celery tasks, the correlation ID is serialized into
the task payload so it survives the broker round-trip.

Correlation IDs enable tracing a single human-request through the entire
architecture for debugging or audit purposes.

---

## Health Checks

Every service exposes `/health`:

| Endpoint | Returns on Success |
|----------|-------------------|
| `/health` | `{"status": "ok", "version": "x.y.z"}` |
| `/health/db` | Connection test to PostgreSQL |
| `/health/redis` | PING/PONG test to Redis |
| `/metrics` | Prometheus-format scrape endpoint |

Docker Compose healthchecks probe `/health` every 30 seconds with a 10-second
timeout and 3-retry grace period.
# Observability — Reference Guide

## OpenTelemetry Trace Propagation

Every service exports traces using the opentelemetry SDK. Traces are forwarded to the otel-collector service via OTLP gRPC on port 4317.

### Trace Context

Trace context is propagated across all inter-service calls using W3C TraceContext (traceparent header). The X-Correlation-Id header carries a per-request UUID that is also embedded in every log line and span attribute.

### Structured JSON Logs

Every log record follows this schema:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| timestamp | string | yes | ISO-8601 UTC timestamp |
| level | string | yes | DEBUG/INFO/WARN/ERROR |
| service | string | yes | Service name identifier |
| correlation_id | string | yes | Per-request UUID |
| task_id | string | no | Associated task ID |
| agent_id | string | no | Agent that performed action |
| message | string | yes | Human-readable log message |

### Metrics Endpoint

Every service exposes a `/metrics` endpoint returning Prometheus-format counters:

| Metric | Type | Description |
|--------|------|-------------|
| tasks_total | counter | Total tasks dispatched |
| tasks_failed | counter | Tasks that ended in failure |
| llm_tokens_total | counter | Total tokens consumed by LLM calls |
| llm_cost_total_usd | gauge | Cumulative LLM cost in USD |
| sandbox_runs_total | counter | Total sandbox container executions |
| pr_created_total | counter | Total draft PRs opened |

### Prometheus Configuration

The docker-compose.yml mounts prometheus.yml into the otel-collector service with scrape configs for each service on port 9090/metrics.
