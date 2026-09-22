# Phase P1: Planning

Transform approved goals into an executable plan with architecture decisions, agent assignments, and budget allocation.

## Purpose

Produce a deterministic execution plan that every agent can follow without ambiguity. Assign roles, set budgets per agent, define dependency chains between phases B1-B12, and establish the quality gates between each build phase.

## Timing

Runs after P0 produces `approvals.json`. Produces `plan.json` consumed by all subsequent build phases. Blocks on queen validation.

## Inputs

- `approvals.json` from P0
- `goals-resolved.json` from P0
- Project codebase (for context-aware planning)
- Queen orchestrator role prompt (`agents/Q0-queen-orchestrator.md`)

## Outputs

- `plan.json` — structured execution plan with phases, assignments, budgets
- `budget-allocation.json` — per-agent spend limits derived from overall cap
- `DEPENDENCIES_RESOLVED` event on event bus

## Steps

1. Queen parses `approvals.json` to extract scope, deliverables, quality bar.
2. Analyze the target codebase to identify affected modules, files, and integration points.
3. Design the architecture: component breakdown, data flow, API contracts, state management strategy.
4. Map each deliverable to one or more agents based on skill requirements.
5. Set per-agent budgets as a fraction of the total budget (frontend gets 40%, backend 30%, design 15%, QA/security/devops share remaining 15%).
6. Define build-phase dependencies (B1 must complete before B2, etc.).
7. Identify shared interfaces: contracts.py definitions, event topics, rate limit tiers.
8. Validate plan internally: check no circular dependencies, all deliverables covered, budget sum <= total cap.
9. Present plan summary to human operator for final sign-off.
10. Write `plan.json` and `budget-allocation.json` with full details.
11. Publish `DEPENDENCIES_RESOLVED` event and proceed to B1.

## Checklist

- [ ] All approved deliverables mapped to implementation steps
- [ ] Architecture document includes component diagram (text representation)
- [ ] Data model changes enumerated with migration plan
- [ ] API contracts defined for new endpoints (request/response shapes)
- [ ] Agent assignments cover every deliverable with explicit ownership
- [ ] Per-agent budgets computed and sum verified against total cap
- [ ] Build-phase dependency graph validated (DAG, no cycles)
- [ ] Quality gates defined for each build phase (what "done" means)
- [ ] Rollback criteria specified for each build phase
- [ ] Plan presented to human operator with summary of trade-offs
- [ ] `plan.json` written with complete phase descriptions and acceptance criteria
- [ ] `budget-allocation.json` written with per-agent caps and cumulative tracker setup
- [ ] `DEPENDENCIES_RESOLVED` event published with plan reference ID

## Rollback

If P1 fails (invalid plan detected during internal validation), clear `plan.json`, return to step 1 with updated codebase analysis. If operator rejects the presented plan, collect feedback and restart from step 1. Log rejection reason in `plan.json` with a `rejected_at` timestamp. Never proceed to build phases without valid `plan.json`.
