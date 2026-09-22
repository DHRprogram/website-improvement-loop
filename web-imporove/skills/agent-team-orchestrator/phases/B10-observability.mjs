# Phase B10: Observability

Implement structured observability across all services using OpenTelemetry tracing, Prometheus metrics, and centralized logging to enable debugging agent behavior across container boundaries.

## Purpose

When agents fail silently in a distributed system (container crashes, LLM timeouts, rate limit storms), operators need visibility into what happened. This phase wires up trace propagation from gateway through orchestrator to each agent sandbox, collects quantitative metrics per service, and ensures every log line carries a correlation ID so a single request's journey is reconstructable from logs alone.

## Timing

Runs after B3-B9 (all services implemented). Must complete before B11 (tests) because test assertions will verify that traces are being emitted correctly.

## Inputs

- OTEL collector running in Docker Compose stack from B2
- All eight services deployed and reporting to OTEL endpoints
- Structured logger from shared/logging.py producing JSON lines with correlation-id field

## Outputs

- Trace context propagation middleware injected into every Django service and FastAPI service
- Prometheus metric definitions exported by every service at /metrics
- Jaeger-compatible distributed tracing showing full request paths from gateway through each agent execution
- Log aggregation configuration sending all JSON log streams to a single index
- Dashboard-ready metrics definitions for Grafana queries

## Steps

1. Configure OpenTelemetry SDK init in every service: set tracer provider with resource attributes including service_name, deployment_environment, and process_group. Attach span processor using BatchSpanProcessor sending to OTEL collector gRPC endpoint http://otel-collector:4317.
2. Implement trace propagation middleware in Django services: an Middleware class that extracts X-Correlation-Id from incoming requests, creates a Span with name "gateway.request" containing request method and path as attributes, injects the correlation ID into any outgoing HTTP calls via WSGI instrumentation, and ends the span on response completion. Record response status code and duration in span attributes.
3. Implement equivalent middleware in FastAPI services using a custom middleware function that extracts or generates a correlation ID, creates a Span, attaches it to the request state object for downstream handlers to use, and propagates it in response headers as X-Correlation-Id.
4. Define Prometheus metric collectors in each service: Counter(http_requests_total) with labels method/path/status_code, Histogram(http_request_duration_seconds) with buckets [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0], Gauge(celery_tasks_active) showing currently executing Celery tasks, Gauge(sandbox_containers_current) showing active sandbox containers.
5. Instrument the event bus publisher and subscriber: measure publish latency per topic, count messages per topic group, track acknowledgment timeout rate. Record these as Prometheus histograms and counters.
6. Configure rate limiter metrics: expose gauges for current token counts per process group, counters for total_allowed and total_denied, histogram for backoff durations when rejections occur.
7. Wire the OTEL collector docker-compose.yml service with jaeger-query exporter enabled (endpoint: jaeger:14268) and console exporter for local development visibility. The console exporter prints sampled traces to stdout so operators can verify tracing works without running Jaeger UI.
8. Add health check enrichments: modify each service's /health endpoint to include otel_status field reporting whether the tracer provider is configured and connected (connected/disconnected/partial). Return HTTP 503 if disconnected for more than 60 seconds.
9. Run syntax check on all instrumented Python files.
10. Publish OBSERVABILITY_READY event.

## Checklist

- [ ] OpenTelemetry SDK initialized in all eight services with consistent resource attributes
- [ ] Tracer provider uses BatchSpanProcessor sending to http://otel-collector:4317 gRPC
- [ ] Django middleware extracts X-Correlation-Id from request or generates UUID if absent
- [ ] Django span records request method, path, status_code, duration as attributes
- [ ] Outgoing HTTP calls propagate X-Correlation-Id header automatically
- [ ] FastAPI middleware creates and attaches correlation ID to request.state object
- [ ] FastAPI responses include X-Correlation-Id header set to the request's value
- [ ] Every service defines http_requests_total Counter with method, path, status_code labels
- [ ] Every service defines http_request_duration_seconds Histogram with correct bucket boundaries
- [ ] Every service defines celery_tasks_active Gauge (where Celery is used)
- [ ] Every service defines sandbox_containers_current Gauge (where sandbox is used)
- [ ] Event bus measures publish latency per topic as a histogram
- [ ] Event bus tracks acknowledgment timeout events as a counter
- [ ] Rate limiter exposes token_count gauge per process group
- [ ] Rate limiter exposes allowed/denied counters and backoff_duration histogram
- [ ] OTEL collector configured with both Jaeger exporter and console exporter
- [ ] Console exporter prints sampled traces to stdout for verification
- [ ] Health endpoints include otel_status field (connected/disconnected/partial)
- [ ] Services return HTTP 503 from /health when OTEL disconnected > 60 seconds
- [ ] All instrumented Python files pass py_compile validation
- [ ] OBSERVABILITY_READY event published to event bus

## Rollback

If the OTEL collector fails to receive traces (network unreachable between services and collector), continue operation but set otel_status=disconnected on every /health call which triggers HTTP 503. Operators will see degraded observability but functionality remains intact. Log the connection failure under topic `observability.otel_failure` with the collector address and error message. Do not proceed past B10 until at least one trace spans from the gateway through one completed agent task end-to-end (verifiable via the console exporter output).
