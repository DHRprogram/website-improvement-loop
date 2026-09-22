# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of agent-team-orchestrator skill (v1.0.0)
- P0 approval harvest phase with structured consent ledger
- P1 planning phase with architecture design and budget allocation
- B1 through B12 build phases covering shared contracts through bring-up reporting
- Nine agent role definitions: queen, designer, frontend, backend, QA, security, DevOps, reviewer, budget guard
- Eight CLI scripts: run-agent-team, plan-validation, goal-parser, budget-tracker, hard-stop-detector, state-manager, compose-validator, approval-verifier
- Six safety guard shell scripts: no-secrets, sandbox-network-off, allowed-paths, budget-cap, llm-fallback, draft-pr-only
- Template Python services: gateway, control_room, orchestrator, agent_runtime, sandbox, memory, git_bridge
- Shared Python modules: contracts, event bus, rate limiter, LLM client, logging, role prompts
- Docker Compose stack with PostgreSQL/pgvector, Redis, OTEL collector
- Ten reference documents covering event topics, role prompts, sandbox security, idempotency, observability, and more
- Six example JSON schemas for approvals, plans, task results, goals, budgets, and state

### Security
- All secrets stored as environment variables; none hardcoded in source
- Sandbox containers enforce network_disabled, read_only_rootfs, cap_drop=ALL
- Git bridge opens draft PRs only; never auto-merges
- Path validation prevents agents from accessing files outside allowed scope
