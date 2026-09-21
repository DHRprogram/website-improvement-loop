# Frontend Master Loop

**Version:** 1.0.0
**License:** MIT

A fully autonomous frontend redesign loop for Claude Code. Operates in
strangler, greenfield, bluegreen, or design-system mode. Runs R0 through R10
without stopping — unless a Hard Stop Trigger fires.

---

## How It Works

The skill runs as a **16-phase autonomous pipeline** coordinated by 22 specialized
agents. Each phase has a specific job, a verification checklist, and a set of
safety guards. After Phase 0 (Approval Harvest), the loop runs without asking
permission unless something goes badly wrong.

```
User calls /web-improvement-loop:frontend
  │
  ▼
P0 — Approval Harvest         Ask ALL questions at once. Lock answers.
P1 — Composition Registry     Scan repo. Map phases to skills/agents.
  │
  ▼  (autonomously from here)
R0  Preflight                 Validate environment, tools, backup, git branch.
R1  Preservation              Screenshot every route. Record metrics.
R2  Spec Extraction           Parse codebase. Extract routes, API, data flow.
R3  Data Contract Freeze      Lock schema + API shape. No changes allowed.
R4  Golden Tests              Create visual/content/API comparison tests.
R5  Design System             Extract tokens. Build new design system.
R6  Backend Rebuild           Implement new backend (data-contract compliant).
R7  Frontend Rebuild          Implement new frontend (design-system compliant).
R8  Strangler Migration       Route-by-route migration behind feature flags.
R8.5 Parity Gates             A11y, SEO, i18n, analytics, integrations, o11y.
R8.7 Load + Chaos + Backup    Load test staging. Run chaos drill. Verify backup.
R9  Canary Cutover            Paced 1-5-25-50-100% rollout.
R9.5 Post-Cutover Monitor     Watch SLOs for 24h. Report anomalies.
R10 Cleanup                   Remove flags, old infrastructure, temp files.
  │
  ▼
  FINAL_REPORT.md written
```

### Agent Model

22 agents (A0-A30 + AX) each own a specific concern. The orchestrator (A0)
sequences them. Key parity agents verify the new system matches the old:

| Agent | Role |
|-------|------|
| A0 Orchestrator | State machine, phase transitions, HST detection, rollback |
| A11 Preservation | Screenshot + snapshot capture |
| A12 Spec Extraction | AST analysis, component/route/API inventory |
| A13 Design System | Token extraction, component specs |
| A14 Backend Rebuild | New backend implementation |
| A15 Frontend Rebuild | New frontend implementation |
| A16 Migration Router | Feature flag management, route migration |
| A17 Golden Tests | Visual + content + API parity tests |
| A18 Data Migration | Migration scripts (never auto-run) |
| A19 Cutover/Rollback | Canary ladder, instant rollback |
| A20 Observability Parity | Logging, metrics, tracing, alerting |
| A21 Security Parity | Vulnerability scan, auth comparison |
| A22 A11y Parity | Axe-core, keyboard nav, contrast |
| A23 SEO Parity | Meta tags, structured data, Core Web Vitals |
| A24 i18n Parity | Locales, translations, RTL |
| A25 Analytics Parity | Tracking events, analytics config |
| A26 Integrations Parity | Third-party integrations |
| A27 Cost Analyst | Cost delta tracking, budget alerts |
| A28 ADR Scribe | Architecture Decision Records |
| A29 Comms Lead | Status broadcasts, HST alerts |
| A30 Chaos/Load | Load tests, chaos drills |
| AX Approval Harvester | P0 question form, APPROVALS.json |

### Guard System

15 bash-based safety guards run after every guarded phase:

- **no-prod-touch.sh** — Detects production hostnames in DATABASE_URL or config
- **no-schema-change.sh** — Verifies DATA_CONTRACT.json hash hasn't drifted
- **no-secret-commit.sh** — Scans staged files for 20+ secret patterns
- **golden-tests-must-pass.sh** — Validates R4 test results
- **security-gate.sh** — Blocks on high/critical findings
- **perf-budget.sh** — Enforces bundle size / latency budgets
- **a11y-gate.sh** — Blocks on critical a11y violations
- **seo-gate.sh** — Verifies meta tags and structured data
- **i18n-parity.sh** — Checks all locales present
- **analytics-parity.sh** — Verifies event coverage
- **integrations-parity.sh** — Confirms third-party integrations
- **flag-safety.sh** — Checks feature flag consistency
- **backup-drill.sh** — Validates backup restore < 10 min
- **cost-delta.sh** — Alerts on budget overrun
- **observability-parity.sh** — Checks logging/metrics/tracing

### State Management

Every phase transition writes artifacts/redesign/STATE.json atomically.
This enables resume (--resume continues from last phase), rollback to
any checkpoint, and observability status inspection.

```json
{
  "version": "1.0.0",
  "mode": "strangler",
  "status": "running",
  "phases": {
    "R0": { "status": "complete", "completed_at": "..." }
  },
  "completed_phases": ["R0"],
  "current_phase": null,
  "start_time": "2026-09-21T12:00:00Z",
  "hst_fired": null
}
```

### Hard Stop Triggers

The loop halts immediately if any of these 10 triggers fire:

| ID | Trigger | Detection |
|----|---------|-----------|
| HST-01 | Golden test fails after 3 retries | golden-test-runner.mjs |
| HST-02 | SLO error budget > 25% during canary | canary.mjs |
| HST-03 | Security high/critical vulnerability | security-gate.sh |
| HST-04 | Data Contract drift | no-schema-change.sh |
| HST-05 | Cost delta > approved max | cost-delta.sh |
| HST-06 | Production DB touch detected | no-prod-touch.sh |
| HST-07 | Secret leak in staged files | no-secret-commit.sh |
| HST-08 | Backup restore > 10 min | backup-drill.sh |
| HST-09 | Chaos drill causes SLO breach | chaos-drill.mjs |
| HST-10 | A11y critical violation on migrated route | a11y-gate.sh |

---

## The Four Pillars

### 1. Approval Harvest (P0)
Before ANY work begins, the user answers EVERY question in a single form.
Scope, constraints, budgets, autonomy level, and risk acknowledgements are
collected once and locked. Never asked again unless scope changes.

### 2. Composition Registry (P1)
The skill scans the entire repository for reusable assets and maps every
phase to the best available asset. Reuse over reinvention.

### 3. Autonomous Execution Loop (AEL)
Phases execute sequentially without human intervention. After each phase, a
verifier runs. On PASS: continue. On FAIL: self-heal up to 3 attempts, then
Hard Stop. Never asks "continue?" between phases.

### 4. Hard Stop Triggers (HST)
Ten triggers that halt immediately, roll back, report, and wait for user input.

## Iron Rules

R1: Never commit secrets/tokens/keys.
R2: No incomplete files — no TODO, no placeholder.
R3: Never touch production DB. Never auto-run migrations.
R4: Never force push, never rebase main, never amend pushed commits.
R5: All changes in a new branch. Never commit to main.
R6: All bash: set -euo pipefail + must pass bash -n.
R7: All Node: ESM + must pass node --check.
R8: All JSON: must pass JSON.parse.
R9: All YAML: must be valid.
R10: Preservation baseline captured BEFORE any change.
R11: Every change rollback-able in <5s (flag flip) or <5min (revert).
R12: If a Golden Test fails, redesign halts and reports.
R13: Data Contract (DB schema + API shape) is frozen after R3.

## Invocation

```
/web-improvement-loop:frontend --mode=strangler
/web-improvement-loop:frontend --mode=strangler --routes=/dashboard,/profile
/web-improvement-loop:frontend --resume
/web-improvement-loop:frontend --dry-run
/web-improvement-loop:frontend --no-cutover
/web-improvement-loop:frontend --mode=greenfield
```

### Arguments

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| --mode | strangler, greenfield, bluegreen, design-system | strangler | Redesign strategy |
| --routes | comma-separated list | all | Routes in scope |
| --resume | — | off | Resume from STATE.json |
| --no-cutover | — | off | Skip canary cutover (R9) |
| --dry-run | — | off | Read-only audit (P0 through R4 only) |
| --answers | JSON string | — | Inline approval answers (non-interactive) |

## Requirements

- Node.js >= 18
- Git repository (branch-based workflow)
- Feature flag provider (Unleash, Flagsmith, GrowthBook, or env-based)
- Staging database (for migration mode)
- APM/observability stack (recommended)
- Backup target (recommended)
- Status page (recommended for cutover)

## Installation

```bash
cp -r skills/frontend-master-loop ~/.claude/skills/
```

Then invoke with /web-improvement-loop:frontend.

## Safety

This skill can autonomously modify your codebase. Always review
APPROVALS.json before granting autonomy. The skill NEVER:
- Touches production databases
- Auto-runs database migrations
- Force pushes or rewrites git history
- Continues past a Hard Stop without user input
- Asks "continue?" between phases

## Repository

Pushed to: https://github.com/DHRprogram/website-improvement-loop
Release: v1.0.0 (tag + GitHub Release)
