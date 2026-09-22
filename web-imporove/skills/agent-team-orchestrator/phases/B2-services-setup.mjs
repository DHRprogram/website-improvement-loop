# Phase B2: Services Setup

Initialize all service containers from templates, configure Docker Compose, validate networking and resource constraints before any agent runtime starts.

## Purpose

Create the infrastructure foundation — database (PostgreSQL with pgvector), cache (Redis), OpenTelemetry collector, and all eight service containers. Validate that each container has correct network isolation, resource limits, and shared volume mounts before proceeding.

## Timing

Runs after B1 completes successfully. All services must be up and health-checking before B3 (orchestrator) begins routing tasks.

## Inputs

- `shared/` module from B1
- `templates/python/services/` template directories
- `docker-compose.yml` skill-level root file
- `pyproject.toml` from root

## Outputs

- Service codebases copied into `services/{gateway,control_room,orchestrator,agent_runtime,sandbox,memory,git_bridge}/`
- Docker Compose stack with 10+ services running
- Health check endpoints verified for every service
- Network topology validated (services can talk; sandboxes cannot reach external networks)

## Steps

1. Copy each `templates/python/services/{name}/` directory into its corresponding `services/{name}/` location.
2. Update `django-settings.py` or equivalent config files in each Django service to reference Redis host, Postgres credentials, and OTEL collector endpoint from environment variables.
3. For Django services, run `python manage.py check --deploy` to validate production settings without deploying.
4. For FastAPI services, import the application module to verify no import errors at startup.
5. Update `pyproject.toml` with service-specific dependencies beyond what `shared/` provides.
6. Start the Docker Compose stack: postgres with pgvector extension enabled, redis with persistence disabled (in-memory only).
7. Run OTEL collector with a simple console exporter configuration.
8. For each service, start it and wait for its `/health` or `/metrics` endpoint to return HTTP 200.
9. Validate sandbox container policy: network_disabled=True, read_only_rootfs=True, cap_drop=ALL, memory limit set, temp workdir configured at /workspace.
10. Verify git bridge opens draft PRs only — confirm PR creation mode is DRAFT by checking the API call parameters.
11. Publish `SERVICES_STARTED` event on the event bus.

## Checklist

- [ ] All eight service codebases copied and present in their respective directories
- [ ] PostgreSQL container running with pgvector extension loaded (EXTENSION "pgvector"; verifies)
- [ ] Redis container running with no-persistence mode (APPENDONLY no, SAVE "")
- [ ] OTEL collector running with console exporter, accepting traces from all services
- [ ] Gateway service (Django + DRF) responding on /health with HTTP 200
- [ ] Control room service (Django + HTMX) responding on /health with HTTP 200
- [ ] Orchestrator service (Django + Celery) responding on /health with HTTP 200
- [ ] Agent runtime service responding on /health with HTTP 200 (all replicas)
- [ ] Sandbox service (FastAPI + Docker API) responding on /health with HTTP 200
- [ ] Memory service (Django + pgvector) responding on /health with HTTP 200
- [ ] Git bridge service (FastAPI + PyGithub) responding on /health with HTTP 200
- [ ] Every service exposes /metrics endpoint returning Prometheus-format metrics
- [ ] Every service accepts and propagates X-Correlation-Id header through request chain
- [ ] Sandbox templates enforce network_disabled=True in container create parameters
- [ ] Sandbox templates enforce volumes read-only mount of root filesystem
- [ ] Sandbox templates include cap_drop=[ALL] in container create parameters
- [ ] Sandbox templates include mem_limit="1g" in container create parameters
- [ ] Sandbox templates set working_dir=/workspace for agent tasks
- [ ] Sandbox templates include always_remove=true for post-task cleanup
- [ ] Git bridge configured to open_pull_request(mode=DRAFT) — never auto-merge
- [ ] pyproject.toml includes editable install of shared/ (-e . in [project].dependencies or setup.cfg)
- [ ] docker-compose.yml declares postgres, redis, gateway, control_room, orchestrator, agent_runtime (x3 replicas), sandbox, memory, git_bridge, otel-collector services
- [ ] No secrets visible in docker-compose.yml (credential refs use ${ENV_VAR} syntax only)
- [ ] SERVECES_STARTED event published to event bus

## Rollback

If any service fails to start or health check returns non-200, stop the entire stack with `docker compose down`, inspect the failing service's logs, fix the issue locally (either code bug or configuration error), restart the stack, and re-run the health checks. Log failures under topic `service.start_failure` in the event bus with service name, exit code, and log tail.
