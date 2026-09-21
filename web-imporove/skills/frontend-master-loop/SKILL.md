---
name: frontend-master-loop
description: >-
  Master frontend redesign loop with up-front approval harvest, cross-skill
  composition registry, and fully autonomous execution until completion.
  Operates in strangler/bluegreen/greenfield/design-system modes. Stops only
  on Hard Stop Triggers. Supports resume via persistent STATE.json. v1.0.0.
license: MIT
version: 1.0.0
---

# Frontend Master Loop — SKILL

## Overview

When the user runs `/web-improvement-loop:frontend`, this skill takes control
of the full redesign pipeline. It asks every question ONCE in Phase 0, scans
the repo for every reusable asset in Phase 1, then executes R0..R10
autonomously. It NEVER asks "should I continue?" between phases. It ONLY
stops on Hard Stop Triggers. It ALWAYS resumes from STATE.json.

## The Four Pillars

### Pillar 1 — Approval Harvest (P0)
Before ANY work, the user answers every question in a single structured form
grouped into Scope, Constraints, Budgets, Autonomy, and Risk sections.
Answers are written to `artifacts/redesign/APPROVALS.json` and LOCKED. Any
later change requires explicit re-approval.

### Pillar 2 — Composition Registry (P1)
The skill scans the entire repo for skills, agents, scripts, commands,
workflows, and references. It builds
`artifacts/redesign/COMPOSITION_REGISTRY.json` with entries that map every
phase to the best available asset. Reuse over reinvention.

### Pillar 3 — Autonomous Execution Loop (AEL)
R0 → R1 → R2 → ... → R10 execute sequentially. After each phase, the
verifier runs. On PASS: append to STATE.json and continue. On FAIL:
self-heal up to 3 attempts, then Hard Stop. No human-in-the-loop between
phases unless an HST fires.

### Pillar 4 — Hard Stop Triggers (HST)
Ten triggers that halt the loop immediately, roll back the current
route/phase, write a detailed report, and wait for user input.

## Iron Rules

R1.  Never commit secrets/tokens/keys. Never print GH_TOKEN.
R2.  No file may be incomplete. No placeholders, no incomplete sections, no ellipsis.
R3.  Never touch production DB. Never auto-run migrations. Never delete data.
R4.  Never force push, never rebase main, never amend pushed commits.
R5.  All changes in a new branch. Never commit to main.
R6.  All bash: set -euo pipefail + must pass bash -n.
R7.  All Node: ESM + must pass node --check.
R8.  All JSON: must pass JSON.parse.
R9.  All YAML: must be valid.
R10. Preservation Baseline captured BEFORE any change.
R11. Every change rollback-able in <5s (flag flip) or <5min (revert).
R12. If a Golden Test fails, redesign halts and reports.
R13. Data Contract (DB schema + API shape) is frozen after R3.

## Phase List

| Phase | Name | Description |
|-------|------|-------------|
| P0 | Approval Harvest | Collect all user answers once. Write APPROVALS.json. |
| P1 | Composition Registry | Scan repo, build registry, map phases to assets. |
| R0 | Preflight | Validate env, tools, access, backups. |
| R1 | Preservation | Screenshot every route, capture metrics baseline. |
| R2 | Spec Extraction | Extract data contracts, component tree, route map. |
| R3 | Data Contract Freeze | Pin DB schema + API shape. Guard from drift. |
| R4 | Golden Tests | Record route-by-route golden tests (visual + behavioral). |
| R5 | Design System | Build/apply design tokens and component library. |
| R6 | Backend Rebuild | Rebuild backend routes using strangler/bluegreen. |
| R7 | Frontend Rebuild | Rebuild frontend routes using new design system. |
| R8 | Strangler Migration | Route-by-route migration with traffic switching. |
| R8.5 | Parity Gates | Run all parity gates (a11y, seo, i18n, analytics, integrations). |
| R8.7 | Load + Chaos + Backup | Load test, chaos drill, backup restore drill. |
| R9 | Canary Cutover | Paced rollout 1%->5%->25%->50%->100%. |
| R9.5 | Post-Cutover Monitor | 72h monitoring window. Error budget tracking. |
| R10 | Cleanup | Remove old code, archive artifacts, final report. |

## Agent Roster

| Agent | Role |
|-------|------|
| A0 | Orchestrator — loop, state, git, HST detection |
| A11 | Preservation — screenshots, baseline metrics |
| A12 | Spec Extraction — data contracts, component tree |
| A13 | Design System — tokens, library, theme |
| A14 | Backend Rebuild — route-by-route backend |
| A15 | Frontend Rebuild — route-by-route frontend |
| A16 | Migration Router — strangler routing, flags |
| A17 | Golden Tests — per-route visual + behavioral |
| A18 | Data Migration — schema migration scripts |
| A19 | Cutover & Rollback — canary, flag flip, revert |
| A20 | Observability Parity — metrics, traces, logs |
| A21 | Security Parity — auth, sast, vuln scan |
| A22 | A11y Parity — WCAG 2.2 AA, axe-core |
| A23 | SEO Parity — meta, structured data, sitemap |
| A24 | i18n Parity — locale preservation, translation |
| A25 | Analytics Parity — events, tracking, dashboards |
| A26 | Integrations Parity — API contract, webhooks |
| A27 | Cost Analyst — cost delta tracking, budget guard |
| A28 | ADR Scribe — architecture decisions |
| A29 | Comms Lead — status updates, escalation |
| A30 | Chaos & Load — chaos drills, load testing |
| AX | Approval Harvester — P0 question form |

## Guard Roster

| Guard | File | Purpose |
|-------|------|---------|
| G01 | guards/no-prod-touch.sh | Detect production DB access |
| G02 | guards/no-schema-change.sh | Detect data contract drift |
| G03 | guards/no-secret-commit.sh | Scan staged files for secrets |
| G04 | guards/golden-tests-must-pass.sh | Enforce golden test pass |
| G05 | guards/security-gate.sh | High/critical vuln detection |
| G06 | guards/perf-budget.sh | Performance budget check |
| G07 | guards/a11y-gate.sh | WCAG 2.2 AA compliance |
| G08 | guards/seo-gate.sh | SEO metadata completeness |
| G09 | guards/i18n-parity.sh | i18n coverage parity |
| G10 | guards/analytics-parity.sh | Analytics events parity |
| G11 | guards/integrations-parity.sh | Integration contract parity |
| G12 | guards/flag-safety.sh | Feature flag absence check |
| G13 | guards/backup-drill.sh | Backup restore drill |
| G14 | guards/cost-delta.sh | Cost delta budget check |
| G15 | guards/observability-parity.sh | Metrics/traces/logs parity |

## Invocation Examples

```
/web-improvement-loop:frontend --mode=strangler --routes=/dashboard,/profile
/web-improvement-loop:frontend --mode=greenfield --no-cutover
/web-improvement-loop:frontend --resume
/web-improvement-loop:frontend --dry-run
```

## Non-Goals

- Running production migrations (scripted only, never auto-run)
- Deleting old code or data (manual approval required)
- Production cutover without explicit canary consent
- Changing infrastructure, CI/CD, or deployment systems
- Redesigning things outside the agreed scope

## Hard Stop Triggers (Summary)

HST-01: Golden Test fails after 3 self-heal attempts.
HST-02: SLO error budget consumption >25% during canary.
HST-03: Security gate finds high/critical vulnerability.
HST-04: Data Contract drift detected.
HST-05: Cost delta > approved max.
HST-06: Attempt to touch production DB.
HST-07: Secret leak detected in staged files.
HST-08: Backup restore drill fails (restore >10 min).
HST-09: Chaos drill causes SLO breach on staging.
HST-10: A11y gate finds critical violation on migrated route.

## Resume Protocol

1. STATE.json lives at artifacts/redesign/STATE.json.
2. Each phase appends its completion record before moving to next.
3. If interrupted, re-invoke with --resume. Load STATE.json, find last
   completed phase, start from next uncompleted phase.
4. P0 approval is NOT re-asked on resume unless APPROVALS.json is missing.
5. P1 is NOT re-scanned on resume unless --rescan flag given.

## Final Report Schema

Written to artifacts/redesign/FINAL_REPORT.md on completion. Sections:
1. Executive Summary
2. Mode, Routes, Scope
3. Phase-by-Phase Results
4. Preservation Delta (before/after screenshots + metrics)
5. Golden Test Results
6. Parity Gate Results
7. Canary Summary
8. Cost Delta
9. All Hard Stop Reports (if any fired)
10. Rollback Actions Taken
11. Remaining Work
