# Complete Command Tutorial

## Web Improvement Loop — Full Command Reference

This document provides detailed usage instructions for every command in the
/web-improvement-loop family.

---

## Table of Contents

1. [frontend — Master Redesign Loop](#1-frontend--master-redesign-loop)
2. [full — Complete Pipeline](#2-full--complete-pipeline)
3. [improve — Website Audit & Improvement](#3-improve--website-audit--improvement)
4. [test — Synthetic User Testing](#4-test--synthetic-user-testing)
5. [ideate — Product Feature Ideas](#5-ideate--product-feature-ideas)
6. [build — Approved Features](#6-build--approved-features)
7. [regression — Metrics Guard](#7-regression--metrics-guard)
8. [report — Final Report](#8-report--final-report)
9. [help — Reference](#9-help--reference)
10. [Workflows & CI](#10-workflows--ci)
11. [Troubleshooting](#11-troubleshooting)
12. [FAQ](#12-faq)

---

## 1. frontend — Master Redesign Loop

### Overview
The most powerful command. It executes a 16-phase autonomous frontend+backend
redesign. After Phase 0 collects all your approvals, it runs without asking
permission until completion or a Hard Stop Trigger fires.

### Prerequisites

Before running, ensure you have:
- Node.js >= 18
- A git repository (any branch — the skill creates its own)
- Staging database URL (export DATABASE_URL or set in .env)
- A feature flag provider (Unleash, Flagsmith, GrowthBook — or env-based flags)
- APM stack (OpenTelemetry, Datadog, New Relic — recommended)
- Backup target (S3, GCS — recommended for cutover)

### Usage Examples

```bash
# Basic strangler migration (old system runs alongside new)
/web-improvement-loop:frontend --mode=strangler

# Scoped to specific routes
/web-improvement-loop:frontend --mode=strangler --routes=/dashboard,/profile,/settings

# Resume after interruption
/web-improvement-loop:frontend --resume

# Read-only audit (no changes, phases P0 through R4 only)
/web-improvement-loop:frontend --dry-run

# Skip canary cutover (requires manual switch)
/web-improvement-loop:frontend --no-cutover

# Greenfield project (no existing frontend)
/web-improvement-loop:frontend --mode=greenfield

# Design-system only mode (no migration)
/web-improvement-loop:frontend --mode=design-system

# Full non-interactive mode with inline answers
/web-improvement-loop:frontend --answers='{"scope":{"mode":"strangler","routes":"all"},"autonomy":{"authorized":true}}'
```

### Phase-by-Phase Walkthrough

#### P0 — Approval Harvest
You will be asked 5 groups of questions:
1. **Scope**: mode (strangler/greenfield/bluegreen/design-system), routes, locales
2. **Constraints**: staging DB, backup, flag provider, APM
3. **Budgets**: max cost delta (default 20%), max downtime, error budget
4. **Autonomy**: authorize autonomous execution, canary consent, cleanup
5. **Risk acknowledgements**: migrations not auto-run, cutover is paced

Answer once. The skill locks your answers and never asks again.

#### P1 — Composition Registry
The skill scans your entire repo for reusable assets — other skills, agents,
scripts, commands, workflows. Each phase maps to the best available asset.

#### R0 — Preflight
Validates environment: node version, git status, tool availability, backup
connectivity, production isolation. Creates the redesign branch.

#### R1 — Preservation
Captures screenshots of every route at desktop and mobile viewports. Records
HTML snapshots, API responses, Lighthouse metrics, and asset inventory (CSS,
JS, images with content hashes).

#### R2 — Spec Extraction
Parses your existing codebase to extract component inventory, route tree,
API contracts, data flow, style architecture, and import graph. Uses AST
analysis (ts-morph, babel, esprima).

#### R3 — Data Contract Freeze
Snapshots your current DB schema and API shape. Writes DATA_CONTRACT.json.
After this phase, no code may alter the schema or API without re-approval.
Drift detection runs continuously.

#### R4 — Golden Tests
Creates visual, content, and API parity test suites comparing old vs new.
Uses pixel-level screenshot diffing, text content comparison, and response
shape validation. Threshold: 2% diff (configurable via --threshold).

#### R5 — Design System
Extracts existing design tokens (colors, typography, spacing). Generates a
new design system with token architecture, component specifications, and
documentation. Three-layer tokens: primitive, semantic, component.

#### R6 — Backend Rebuild
Implements the new backend with full data contract compliance. Generates API
routes, database access layer, authentication, authorization, middleware,
rate limiting, structured error handling, and input validation.

#### R7 — Frontend Rebuild
Implements the new frontend using the design system. Covers all page
components, state management, client routes, form handling, responsive
breakpoints, loading states, and error boundaries.

#### R8 — Strangler Migration
Route-by-route migration behind feature flags. Each route is migrated
independently:
1. Health-check old route
2. Toggle feature flag to new
3. Health-check new route
4. Run parity checks
5. Mark route migrated

Never migrates two routes at once.

#### R8.5 — Parity Gates
Runs all parity checks on migrated routes:
- a11y (axe-core, keyboard nav, color contrast)
- SEO (meta tags, structured data, sitemaps, Core Web Vitals)
- i18n (all locales, RTL, pluralization)
- analytics (all tracking events)
- integrations (third-party services)
- observability (logging, metrics, tracing, alerts)

#### R8.7 — Load + Chaos + Backup
- Load test staging at 1x, 5x, 10x baseline traffic
- Chaos drill: kill backend, inject latency, exhaust DB pool, CPU/memory stress
- Verify backup restore completes within 10 minutes

#### R9 — Canary Cutover
Paced rollout: 1% -> 5% -> 25% -> 50% -> 100%.
Each step monitors SLOs for 5 minutes before proceeding. Any SLO breach
triggers immediate rollback.

#### R9.5 — Post-Cutover Monitor
24-hour monitoring window. Watches error rates, latency, and all migrated
routes. Generates anomaly report.

#### R10 — Cleanup
Removes feature flags for fully migrated routes. Deletes old route code.
Removes temporary files. Archives migration logs.

### Hard Stop Triggers

The loop halts immediately on:

| ID | Condition | Action |
|----|-----------|--------|
| HST-01 | Golden test fails after 3 self-heal attempts | Rollback route |
| HST-02 | SLO error budget > 25% during canary | Rollback canary step |
| HST-03 | Security high/critical vulnerability | Report, stop |
| HST-04 | Data Contract drift detected | Rollback to freeze |
| HST-05 | Cost delta > approved budget | Report, stop |
| HST-06 | Production DB touch detected | Abort immediately |
| HST-07 | Secret leak in staged files | Block commit |
| HST-08 | Backup restore > 10 minutes | Report degraded |
| HST-09 | Chaos drill causes SLO breach | Stop, investigate |
| HST-10 | A11y critical violation | Block migration |

### Resume Protocol

If the session is interrupted mid-phase:

```bash
/web-improvement-loop:frontend --resume
```

The skill reads artifacts/redesign/STATE.json, finds the last completed phase,
and continues from the next one. Phase 0 is NOT re-asked (unless APPROVALS.json
is missing). Phase 1 is NOT re-run unless --rescan is given.

### Rollback

```bash
# Immediate flag flip (< 5 seconds)
# Or revert commit (< 5 minutes)
# Or restore from backup (< 10 minutes)
```

See skills/frontend-master-loop/references/rollback-playbook.md for the
complete playbook.

---

## 2. full — Complete Pipeline

Runs phases A through E in sequence.

```bash
/web-improvement-loop:full
/web-improvement-loop:full --iterations 15
```

### Phase A — Audit & Improve
Analyzes codebase, identifies issues, runs improvement iterations.
Each iteration: measure -> improve -> measure -> compare delta.

### Phase B — User Testing
Launches 12 Chrome sessions with different personas:
- 10 demographic personas (age, locale, tech-savviness)
- 1 adversarial chaos tester (rapid clicking, form spam)
- 1 axe-core accessibility auditor

### Phase C — Ideation
Generates product feature pitches based on app analysis.
Output: IDEA_PITCHES.md with structured feature descriptions.

### Phase D — Review (PAUSES)
Presents ideas to you for approval. You select which to build.

### Phase E — Build
Implements approved features to Product Quality Bar.

---

## 3. improve — Website Audit & Improvement

```bash
# Basic usage
/web-improvement-loop:improve

# Specify iteration count
/web-improvement-loop:improve --iterations 10

# Focus on specific area
/web-improvement-loop:improve --focus performance
/web-improvement-loop:improve --focus accessibility
/web-improvement-loop:improve --focus seo
/web-improvement-loop:improve --focus all
```

### What it does
1. Analyzes your codebase for issues (performance, a11y, SEO, code quality)
2. Runs improvement iterations — each one fixes issues and measures impact
3. Reports delta for each metric after every iteration

### Metrics tracked
- Lighthouse performance score
- Lighthouse accessibility score
- Lighthouse SEO score
- Bundle size
- Total page weight
- Request count
- API latency (p50/p95)
- Error rates

---

## 4. test — Synthetic User Testing

```bash
# Run all personas
/web-improvement-loop:test

# Specific persona group
/web-improvement-loop:test --persona all
/web-improvement-loop:test --persona demographic
/web-improvement-loop:test --persona adversarial
/web-improvement-loop:test --persona a11y
```

### Personas

| # | Persona | Behavior |
|---|---------|----------|
| 1 | New visitor | First visit, explores navigation |
| 2 | Returning user | Login, check saved data |
| 3 | Mobile user | Touch interactions, small viewport |
| 4 | Power user | Keyboard shortcuts, fast navigation |
| 5 | Non-tech user | Reads everything, slow clicks |
| 6 | International | RTL language, expects locale |
| 7 | Screen reader | Uses VoiceOver/NVDA |
| 8 | Low vision | Zoomed in, high contrast |
| 9 | Slow connection | Patience, waits for loading |
| 10 | Admin | Complex workflows, data management |
| 11 | Adversarial | Rapid clicking, form spam, edge cases |
| 12 | axe-core | Automated a11y audit |

---

## 5. ideate — Product Feature Ideas

```bash
# Generate 5 (default) feature ideas
/web-improvement-loop:ideate

# Generate specific count
/web-improvement-loop:ideate --count 10

# Focus on specific area
/web-improvement-loop:ideate --focus monetization
/web-improvement-loop:ideate --focus engagement
/web-improvement-loop:ideate --focus retention
```

Output file: IDEA_PITCHES.md in the project root.
Each pitch includes: problem, solution, target users, market size,
implementation complexity, estimated effort.

---

## 6. build — Approved Features

```bash
# Build a specific idea
/web-improvement-loop:build --idea ideas/custom-reporting.md

# Build multiple ideas (comma-separated)
/web-improvement-loop:build --idea ideas/search.md,ideas/export.md
```

This command pauses and asks for confirmation before making any changes.

---

## 7. regression — Metrics Guard

```bash
# Run regression against last known baseline
/web-improvement-loop:regression

# Specify a custom baseline file
/web-improvement-loop:regression --baseline ./previous-metrics.json

# Set custom thresholds
/web-improvement-loop:regression --threshold-bundle 5 --threshold-latency 10
```

Exits with code 0 if all metrics within threshold, 1 if any regressed.

---

## 8. report — Final Report

```bash
/web-improvement-loop:report
```

Generates FINAL_REPORT.md with:
- Summary of all changes
- Before/after metrics (bundle size, Lighthouse scores, latency)
- Routes migrated
- Issues fixed
- Recommendations for future work

---

## 9. help — Reference

```bash
/web-improvement-loop:help
```

Prints the command reference inline. Same content as this section.

---

## 10. Workflows & CI

### frontend-loop-gate.yml (manual dispatch only)

CI gate for the frontend master loop. Never runs automatically.

```bash
# Trigger from GitHub UI:
# Actions -> Frontend Master Loop Gate -> Run workflow
# Inputs: mode, routes, no_cutover, dry_run
```

Steps:
1. Checkout with full depth
2. Setup Node.js
3. Install dependencies
4. Lint all JSON files (JSON.parse)
5. Lint all bash scripts (bash -n)
6. Lint all Node scripts (node --check)
7. Run dry-run verification
8. Validate package.json
9. Upload artifacts

### regression.yml

Runs on push to main. Executes regression checks.

---

## 11. Troubleshooting

### "Command not found: /web-improvement-loop:..."

**Cause**: The `.claude/commands/web-improvement-loop/` directory is missing or
not discovered.

**Fix**:
```bash
# Check if directory exists
ls -la .claude/commands/web-improvement-loop/

# If missing, copy from repo
mkdir -p ~/.claude/commands/web-improvement-loop
cp -r .claude/commands/web-improvement-loop/* ~/.claude/commands/web-improvement-loop/
```

### "Skill not found: frontend-master-loop"

**Cause**: Skill not installed in ~/.claude/skills/.

**Fix**:
```bash
cp -r skills/frontend-master-loop ~/.claude/skills/
```

### "APPROVALS.json not found"

Run Phase 0 first with --answers or interactive mode:
```bash
/web-improvement-loop:frontend --answers='{"scope":{"mode":"strangler","routes":"all"},"autonomy":{"authorized":true}}'
```

### "Golden test failed after 3 attempts"

This triggers HST-01. Options:
1. Review golden-tests report
2. Fix the underlying mismatch
3. Update baseline if the new behavior is intended
4. Run again with adjusted threshold

### "DATABASE_URL points to production"

This triggers HST-06. The guard checks for "prod", "production", "aws.com" in
the database URL. Set DATABASE_URL to a staging database before running.

### "STATE.json corruption"

If STATE.json is malformed, restore from last checkpoint:
```bash
node scripts/state-manager.mjs checkpoint restore
```

Or delete STATE.json and start fresh (Phase 0 is re-asked).

---

## 12. FAQ

**Q: Can I run frontend on my production site?**
A: The skill detects and refuses to run against production databases (HST-06).
Only run with a staging database.

**Q: How long does a full redesign take?**
A: Highly variable. R0-R4: 15-30 min. R5: 30 min. R6: 30m-4h. R7: 30m-4h.
R8-R10: 1-3h. Total: 3-12h for a small app, longer for complex.

**Q: What happens if my session times out mid-phase?**
A: Use --resume to continue from the last completed phase. STATE.json is
written atomically after every phase.

**Q: Can I stop mid-execution?**
A: Yes — Ctrl+C stops the current phase. Use --resume to continue later.
Or use --no-cutover to skip R9 if you want to cut over manually.

**Q: Does it write to production?**
A: Never. Guards prevent production DB access, secret commits, and force
pushes. All changes go to a new branch (redesign/<mode>/<timestamp>).

**Q: Can I use it for backend-only redesign?**
A: Yes — use --mode=backend. It will skip R7 (frontend) but keep all backend
phases and data migration.

**Q: What if I don't have a feature flag provider?**
A: Use --mode=bluegreen with env-based flags. Create an ENV var like
ROUTE_DASHBOARD=old|new and toggle it manually.

**Q: Can I customize the guard thresholds?**
A: Yes — edit the script or pass parameters. For example:
--threshold=<n> for golden tests, --max-delta=<n> for cost delta.
