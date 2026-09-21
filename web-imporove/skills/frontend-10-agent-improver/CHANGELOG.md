# Changelog

## 0.1.0 (2026-09-21)

### Added
- Initial release of the frontend-10-agent-improver skill.
- 10 specialized agents (A1-A10) for comprehensive frontend auditing and improvement.
- A0 Orchestrator for loop management, finding ranking, and git operations.
- Execution loop: audit -> merge -> rank -> fix -> verify -> revert if worse -> log.
- Frontend rubric with 10 dimensions weighted to 100 points.
- Guard scripts: no-backend-touch, no-secret-commit.
- Measurement script for bundle size, build time, test pass rate, type/lint errors.
- Finding schema (draft-07 JSON Schema).
- Merge and rank scripts with deduplication and priority scoring.
- Example findings, state, and queue files.
- Full reference documentation (rubric, severity guide, guardrails, report template).

### Notes
- Invoked via /web-improvement-loop:frontend slash command.
- Part of the web-improvement-loop namespaced command family.
