# Web Improvement Loop

Repository of Claude Code skills for automated website improvement, redesign, testing, and product development.

**Repository**: `DHRprogram/website-improvement-loop`
**Latest release**: [v1.0.0](https://github.com/DHRprogram/website-improvement-loop/releases/tag/v1.0.0)

---

## Quick Start

```bash
# Install any skill:
cp -r skills/<skill-name> ~/.claude/skills/

# Then invoke in Claude Code:
/<command-family>:<subcommand> --flags
```

---

## Command Family: `/web-improvement-loop`

All commands under this family:

| Command | Description | Level |
|---------|-------------|-------|
| `frontend` | Master autonomous redesign loop (16 phases, 22 agents) | **Fully autonomous** |
| `full` | Complete 5-phase pipeline (A through E) | Pauses at D |
| `improve` | Phase A: website audit + improvement | Semi-automated |
| `test` | Phase B: 12 synthetic user tests | Semi-automated |
| `ideate` | Phase C: product feature pitches | Semi-automated |
| `build` | Phase E: build approved features | Requires approval |
| `regression` | Metrics regression check | Automated |
| `report` | Generate FINAL_REPORT.md | Automated |
| `help` | Show this reference | Instant |

---

## frontend — Master Redesign Loop

The flagship skill. 16-phase autonomous frontend+backend redesign with zero
human-in-the-loop after approval. 94 files, 22 agents, 15 guards.

```
/web-improvement-loop:frontend --mode=strangler
/web-improvement-loop:frontend --mode=strangler --routes=/dashboard,/profile
/web-improvement-loop:frontend --resume
/web-improvement-loop:frontend --dry-run
/web-improvement-loop:frontend --no-cutover
```

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `--mode` | strangler, greenfield, bluegreen, design-system | strangler | Redesign strategy |
| `--routes` | comma-separated list | all | Routes in scope |
| `--resume` | — | off | Resume from STATE.json |
| `--no-cutover` | — | off | Skip canary cutover (R9) |
| `--dry-run` | — | off | Read-only audit (P0 through R4 only) |

### Phases

| Phase | Name | Duration |
|-------|------|----------|
| P0 | Approval Harvest — all questions asked once | 5 min |
| P1 | Composition Registry — scan repo for assets | 30s-2 min |
| R0 | Preflight — validate env, tools, backup | 1 min |
| R1 | Preservation — screenshot every route | 5-15 min |
| R2 | Spec Extraction — parse codebase, extract API | 2-5 min |
| R3 | Data Contract Freeze — lock schema+API | 1 min |
| R4 | Golden Tests — visual/content/API parity | 5-10 min |
| R5 | Design System — extract tokens, build components | 10-30 min |
| R6 | Backend Rebuild — new backend implementation | 30m-4h |
| R7 | Frontend Rebuild — new frontend implementation | 30m-4h |
| R8 | Strangler Migration — route-by-route behind flags | 1-5m/route |
| R8.5 | Parity Gates — a11y, seo, i18n, analytics, o11y | 5-15 min |
| R8.7 | Load + Chaos + Backup — staging resilience | 10-30 min |
| R9 | Canary Cutover — 1/5/25/50/100% rollout | 30m-2h |
| R9.5 | Post-Cutover Monitor — watch SLOs for 24h | 24h |
| R10 | Cleanup — remove flags, old infra | 5-15 min |

### Requirements
- Node.js >= 18, Git, feature flag provider, staging DB, APM (recommended)

### Safety
NEVER touches production DB, never auto-runs migrations, never force pushes.

See skills/frontend-master-loop/README.md for full docs (94 files, 22 agents, 15 guards).

---

## full — Complete 5-Phase Pipeline

Runs the full A to E improvement cycle:

```
/web-improvement-loop:full
/web-improvement-loop:full --iterations 15
```

| Phase | What it does |
|-------|-------------|
| A | Analyze codebase, identify issues, improve iteratively |
| B | Run 12 synthetic users through Chrome |
| C | Ideate product feature pitches |
| D | (Pauses) Present ideas for user approval |
| E | Build approved features to Product Quality Bar |

---

## improve — Phase A: Website Audit

Analyzes and improves the codebase over 10 measurable iterations:

```
/web-improvement-loop:improve
/web-improvement-loop:improve --iterations 10
/web-improvement-loop:improve --focus performance
```

Each iteration measures and reports deltas.

---

## test — Phase B: Synthetic User Testing

Runs 12 synthetic user personas through Chrome:

```
/web-improvement-loop:test
/web-improvement-loop:test --persona all
/web-improvement-loop:test --persona adversarial
```

| Persona group | Count | Focus |
|---------------|-------|-------|
| Demographic personas | 10 | Real user behavior patterns |
| Adversarial chaos tester | 1 | Edge cases, rapid clicking |
| axe-core auditor | 1 | WCAG accessibility |

---

## ideate — Phase C: Product Feature Ideas

Generates product feature pitches that turn an MVP into a real product:

```
/web-improvement-loop:ideate
/web-improvement-loop:ideate --count 5
```

Output: IDEA_PITCHES.md with structured feature descriptions, market analysis,
and implementation complexity estimates.

---

## build — Phase E: Approved Features

Builds user-approved features to a strict Product Quality Bar:

```
/web-improvement-loop:build --idea ideas/custom-reporting.md
```

This command pauses for approval before making changes.

---

## regression — Metrics Guard

Prevents metrics from getting worse. Run before/after any change:

```
/web-improvement-loop:regression
/web-improvement-loop:regression --baseline ./previous-metrics.json
```

Checks bundle size, Lighthouse scores, API latency, and more.

---

## report — Generate Final Report

Produces FINAL_REPORT.md with all changes, metrics, and outcomes:

```
/web-improvement-loop:report
```

---

## help — Command Reference

Shows this documentation inline:

```
/web-improvement-loop:help
```

---

## Skills in This Repository

| Skill | Directory | Version |
|-------|-----------|---------|
| frontend-master-loop | skills/frontend-master-loop/ | v1.0.0 |
| website-improvement-loop | skills/website-improvement-loop/ | latest |
| frontend-10-agent-improver | skills/frontend-10-agent-improver/ | legacy |
| web-improvement-loop (parent) | skills/web-improvement-loop/ | v0.5.0 |

### frontend-master-loop (v1.0.0)
The most advanced skill. 22 agents with 15+ checklist items each, 15 bash safety
guards, 14 Node.js ESM scripts (all pass node --check), 16 redesign phases,
persistent state with resume. Full autonomous execution.

### website-improvement-loop
The foundational improvement skill. 10 iterations of analysis + improvement,
12 synthetic user tests, product ideation, and feature building. Powers the
improve, test, ideate, build, full, regression, and report commands.

### frontend-10-agent-improver
Legacy 10-agent frontend improver. Superseded by frontend-master-loop.

### web-improvement-loop (parent)
Parent skill that organizes the namespace. v0.5.0.

---

## Architecture

```
.claude/commands/web-improvement-loop/
  frontend.md  ->  skills/frontend-master-loop/
  full.md      ->  skills/website-improvement-loop/
  improve.md   ->  skills/website-improvement-loop/
  test.md      ->  skills/website-improvement-loop/
  ideate.md    ->  skills/website-improvement-loop/
  build.md     ->  skills/website-improvement-loop/
  regression.md -> skills/website-improvement-loop/
  report.md    ->  skills/website-improvement-loop/
  help.md      ->  inline reference

.github/workflows/
  frontend-loop-gate.yml   CI gate (manual dispatch only, never auto-run)
  frontend-loop.yml        Full pipeline workflow
  regression.yml           Regression CI

skills/
  frontend-master-loop/        v1.0.0 - 94 files, 22 agents
  website-improvement-loop/    Foundational improvement skill
  frontend-10-agent-improver/  Legacy (v0.x)
  web-improvement-loop/        Parent skill, v0.5.0
```

---

## Installation

```bash
# Clone
git clone https://github.com/DHRprogram/website-improvement-loop.git
cd website-improvement-loop

# Install skills
cp -r skills/frontend-master-loop ~/.claude/skills/
cp -r skills/website-improvement-loop ~/.claude/skills/

# Copy commands to global
mkdir -p ~/.claude/commands/web-improvement-loop
cp .claude/commands/web-improvement-loop/*.md ~/.claude/commands/web-improvement-loop/

# Invoke
/web-improvement-loop:help
```

---

## Automation Levels

| Level | Description | Commands |
|-------|-------------|----------|
| Fully autonomous | No human in loop | frontend, regression, report, help |
| Semi-automated | Some checks/stops | improve, test, ideate |
| Requires approval | Paused until confirmed | build |

The frontend master loop collects ALL approvals up-front in Phase 0, then runs
through 16 phases autonomously. It only stops on Hard Stop Triggers.

---

## License

MIT
