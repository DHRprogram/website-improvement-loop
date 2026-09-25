---
name: website-improvement-loop
description: >-
  A complete website improvement system: audits, improves over 10 measurable
  iterations, runs 12 synthetic users through Chrome (10 demographic personas
  + 1 adversarial chaos tester + 1 axe-core accessibility auditor) using only
  visible UI, ideates and pitches product features that turn an MVP into a
  real product, and after explicit user approval builds them to a strict
  Product Quality Bar. Includes a 10-agent parallel architecture, Stop
  Hook-driven self-evolving loop, STATE.md external memory, Focus Modes,
  Regression Guard, HTML report, CI gate, and a Redesign subcommand with
  Strangler Fig migration. Use when asked to improve a site, review the
  codebase, run user tests, make it a real product, redesign a site, or
  run repeated improvement cycles.
---

# Website Improvement Loop

## 1. The five phases

| Phase | Name | Does | Gate |
|-------|------|------|------|
| A | Improve | 10 iterations, 10 subagents in parallel, measured before/after | Regression Guard |
| B | Test | 12 personas through a real browser, visible UI only | P0/P1 escalated |
| C | Ideate | 15–25 ideas distilled to 8–12 evidence-backed pitches | — |
| D | Approve | Present pitches, record the answer verbatim | **HARD STOP** |
| E | Build | Approved ideas only, to the Product Quality Bar | Regression Guard |

Phase D is a hard stop. A high ROI score is not consent.

## 2. Three-layer architecture

```
L1  Orchestrator      scripts/orchestrator.mjs — owns the iteration
                     STATE read → spawn → merge → rank → fix → verify → write
L2  Subagents        agents/S1..S10 — 10 read-heavy auditors, parallel per
                     iteration, each with isolated context and one narrow job
L3  Guards + Metrics hooks/, scripts/guards/, scripts/measure.sh — the only
                     things allowed to say "no"
```

Each layer has exactly one job. The orchestrator never audits, an agent never
commits, and a guard never fixes. A finding that reaches the orchestrator has
already been deduplicated and ranked.

### The 10 subagents

| # | Agent | Owns | Primary metric |
|---|-------|------|----------------|
| S1 | Bug Hunter | logic bugs, races, runtime errors, dead code | `runtime_errors` |
| S2 | Design Critic | design-system conformance, spacing, typography, colour | `design_system_violations` |
| S3 | UX Auditor | loading/empty/error states, microcopy, flow | `ux_state_gaps` |
| S4 | Perf Engineer | bundle, LCP, CLS, INP, re-render, lazy loading | `bundle_kb` |
| S5 | A11y Auditor | axe-core, keyboard, focus, contrast, ARIA | `axe_critical` |
| S6 | Test Guardian | coverage, flaky tests, untested critical paths | `critical_path_coverage` |
| S7 | SEO Auditor | meta, Open Graph, heading order, structured data | `meta_coverage` |
| S8 | Security Scanner | XSS, CSRF, secrets in client bundles, validation gaps | `xss_risks` |
| S9 | Architecture Reviewer | coupling, duplication, dead code | `coupling_violations` |
| S10 | Mobile Auditor | responsive layout, touch targets, overflow, breakpoints | `responsive_violations` |

All 10 run in parallel every iteration. A focus mode runs a subset; the full
mode runs all 10.

## 3. Guardrails

1. Never commit, print, echo or log a secret, token or key.
2. Never work on `main` or `master`. Never force-push or rewrite shared history.
3. One iteration = one revertible commit. Never bundle two ideas.
4. Process at most 5 findings per iteration.
5. If a metric gets worse, revert that commit. Never loosen a threshold to
   make a regression pass.
6. Never change auth, payments or DB schema without explicit user approval.
7. Never delete user data or run a destructive migration.
8. If the build or tests fail and cannot be fixed within 10 minutes, revert.
9. Respect the project's existing design system, naming and folder structure.
   If no test or build exists, create a smoke test before changing anything.
10. Never write outside the project root. Never fabricate a measurement — a
    tool that is absent reports `null`, which is not the same as zero.

## 4. Setup questions (ask once)

1. Target user, in one sentence?
2. Primary business goal — signup, revenue, retention, something else?
3. Constraints and budget: framework lock-in, deadline, brand rules,
   must-keep features, and the Phase E spend cap in USD?
4. Which changes are allowed to touch auth, payments or DB schema?
5. `BASE_URL` for browser testing?
6. Is login required, and under which ENV var name? (Name only — never the
   value.)

Skipped answers become explicit assumptions in `AUDIT_BASELINE.md`. They never
block the run.

## 5. Phase A — Improve

### A0 Recon

Write `AUDIT_BASELINE.md`: stack, structure, routes, components, API layer,
data models, assets, i18n, tests, CI, build and run commands, plus a metrics
snapshot.

```bash
STACK=$(bash scripts/measure.sh . --stack-only)
bash scripts/measure.sh baseline > metrics/baseline.json
```

`measure.sh` is the single source of truth for stack detection. Never
re-implement marker-file checks.

### A1 Baseline scoring

Score 0–10 across nine weighted dimensions:

| # | Dimension | Weight |
|---|-----------|--------|
| 1 | Correctness & bugs | 20 |
| 2 | Performance / CWV | 15 |
| 3 | Accessibility | 15 |
| 4 | SEO & metadata | 10 |
| 5 | UX & conversion | 10 |
| 6 | Code quality | 10 |
| 7 | Security & privacy | 10 |
| 8 | Resilience | 5 |
| 9 | Mobile & responsive | 5 |

`rubric_total` = Σ(score × weight) ÷ 10.

### A2 The loop

```bash
node scripts/orchestrator.mjs --focus=full --max-iterations 10 --min-severity P2
```

Each iteration: AUDIT → RANK → PLAN → IMPLEMENT → VERIFY → LOG → SCORE.

**Priority** = `severity_weight × impact ÷ effort`

| Severity | Weight | Meaning |
|----------|--------|---------|
| P0 | 1000 | blocking: data loss, security hole, unusable |
| P1 | 300 | critical: main flow broken for many users |
| P2 | 100 | major: real friction on a secondary path |
| P3 | 30 | minor: polish |

`impact` is 1–5, `effort` is 1–5 (S=1, M=3, L=5). Top 3–5 per iteration.

If a metric does not improve, revert and move on. Do not retry the same
approach twice on the same finding.

### A3 Rubric and artifacts

Artifacts: `AUDIT_BASELINE.md`, `IMPROVEMENT_LOG.md`, `IDEA_BACKLOG.md`,
`metrics/*.json`, `artifacts/website-loop/STATE.md`.

## 6. Phase B — Synthetic user testing

12 personas: 10 demographic (P01–P10), 1 adversarial chaos tester (P11),
1 axe-core accessibility auditor (P12). Full definitions in
`references/personas.md`; protocol in `references/user-test-protocol.md`.

**Non-negotiable protocol rules:**

- Click only visible elements: button, link, input, select, checkbox, tab, menu.
- Select only by role, text or accessible label.
- Enter only from `BASE_URL`; navigate only by clicking visible links.
- Forbidden: `goto` on a deep URL, `page.evaluate`, DOM surgery, CSS
  selectors, XPath, overlay removal, synthetic event dispatch.
- If a task cannot be completed through the visible UI, that is a finding with
  severity ≥ P2 — not permission to bypass the UI.
- Fresh isolated browser context per persona; screenshot every step; close the
  context afterwards.
- Respect persona patience. A loader that outlasts it is a finding.

P12 runs axe over the site. Any `critical` violation is a P0 and halts the
phase. P11 attacks from `references/adversarial-playbook.md`; any reproducible
S0 halts the phase and escalates to the user immediately.

Output: `USER_TEST_REPORT.md` with the executive summary, theme table, per-
persona summaries with verbatim quotes, top 10 friction points, adversarial
results, axe results, and a section on what was **not** tested and why.

## 7. Phase C — Ideate

Sources: activation, retention, conversion, content and SEO, trust and social
proof, distribution, support, monetization, and "you already have the data"
(highest ROI, because the data exists already).

Drop an idea if it has no success metric, needs a rewrite, adds more than one
external dependency, duplicates another, or is purely cosmetic while the
baseline is already ≥ 8.

`ROI` = (success_metric_impact × user_reach) ÷ effort, effort S=1 M=3 L=8.

Pitch the top 8–12 per `references/idea-pitch-format.md`. Every pitch cites at
least one Phase B finding. Then STOP.

## 8. Phase D — Approval (hard stop)

Ask exactly four questions:

1. Which ideas should be built? (numbers, "all", or "none")
2. Which should be changed or merged?
3. If only a few, in what order?
4. Build constraints — auth? DB? payments?

Record the response verbatim in `APPROVED_IDEAS.md` with a timestamp. Edit no
source file in this phase.

## 9. Phase E — Build

Every shipped idea must clear the full Product Quality Bar
(`references/product-quality-bar.md`): UI/UX, all six states (loading, empty,
error, success, offline, slow), accessibility, measured performance
before/after, real copy, an analytics event for the success metric, SEO for
new routes, server-side validation and authz, tests, docs, and a one-commit
rollback. An unmet clause means the idea is not done.

Per idea: PLAN → BASELINE → IMPLEMENT → VERIFY → SHIP-LOG → CONFIRM. After
each, re-run the 3 most relevant personas and the Regression Guard.

When all ideas are done, re-run the Phase A rubric and write `FINAL_REPORT.md`.

## 10. Focus modes

| Mode | Subagents | Primary metric | Secondary metrics |
|------|-----------|----------------|-------------------|
| `full` | S1–S10 | `rubric_total` | all |
| `design` | S2,S3,S5,S10 | `design_system_violations` | `spacing_inconsistencies`, `typography_violations` |
| `bugs` | S1,S6 | `runtime_errors` | `logic_bugs`, `race_conditions` |
| `perf` | S4 | `bundle_kb` | `lcp_ms`, `cls_score`, `inp_ms` |
| `a11y` | S3,S5 | `axe_critical` | `axe_serious`, `contrast_failures` |
| `security` | S8 | `xss_risks` | `csrf_risks`, `secrets_in_client` |
| `seo` | S7 | `meta_coverage` | `og_coverage`, `heading_order_violations` |
| `frontend` | S2,S3,S4,S5,S7,S10 | `rubric_total` | `bundle_kb`, `axe_critical` |
| `backend` | S1,S6,S8,S9 | `runtime_errors` | `coupling_violations`, `critical_path_coverage` |
| `redesign` | S1,S2,S5,S8,S9 | `parity_violations` | `runtime_errors`, `axe_critical` |

```bash
node scripts/focus-resolver.mjs --focus=design   # subagents + metrics
node scripts/focus-resolver.mjs --list           # all modes
```

An unknown mode exits 2. It never falls back to `full`.

## 11. The Stop Hook

`hooks/stop-hook.sh` runs on every Claude stop. It reads `STATE.md` and decides
whether the loop is finished.

```
exit 0  -> the loop is done, Claude may stop
exit 2  -> work remains, Claude must continue
```

`hooks/check-stop.sh` returns 0 when **any** of these hold:

| Condition | Test |
|-----------|------|
| Iteration cap | `iteration_count >= max_iterations` |
| Nothing left | no open finding at or above `min_severity` |
| Plateau | 5 consecutive iterations with no metric improvement |
| Repeated failure | 3 consecutive iterations that errored |
| Human stop | `artifacts/website-loop/STOP` exists |

The hook is advisory, not magic: it cannot make Claude continue forever if the
work is genuinely impossible. That is what the 3-consecutive-error condition is
for.

## 12. STATE.md schema

`STATE.md` is the loop's external memory. It is read at the top of every
iteration and rewritten at the bottom. Never delete it; never let a phase
rebuild it from scratch.

```yaml
---
iteration_count: 7
max_iterations: 10
min_severity: P2
active_focus: full
baseline:
  rubric_total: 6.2
  bundle_kb: 412
  axe_critical: 3
current:
  rubric_total: 7.4
  bundle_kb: 388
  axe_critical: 0
deltas:
  rubric_total: 1.2
  bundle_kb: -24
  axe_critical: -3
findings:
  open: 4
  fixed: 11
  reverted: 2
  blocked_backend: 0
no_improvement_streak: 0
consecutive_errors: 0
lessons_learned:
  - "Bundle drop came from dropping the date library, not from tree-shaking."
stop_condition: none
stop_reason: ""
stopped: false
last_updated: 2026-09-25T08:14:03Z
---
```

Manage it with:

```bash
node scripts/state-manager.mjs init   --focus=full --max-iterations 10 --min-severity P2
node scripts/state-manager.mjs read
node scripts/state-manager.mjs update --iteration-done --finding-fixed
```

## 13. Regression Guard

```bash
bash scripts/verify-change.sh <metric> <lower|better|higher>
bash scripts/guards/metric-must-improve.sh <metric> <before> <after>
```

Compares only keys present in both snapshots. A `null` in either is skipped —
`null` means the tool is absent, and a fabricated `0` would make every guard
pass silently. Re-baselining requires explicit approval and is recorded with
date, reason and approver.

## 14. Redesign (R0 → R10)

`/web-improvement-loop:redesign`. Modes: `strangler` (default), `greenfield`,
`bluegreen`, `design-system`.

| Phase | Name | Output |
|-------|------|--------|
| R0 | Preflight | `REDESIGN_BRIEF.md` — is a redesign even correct? |
| R1 | Preservation Harness | `PRESERVATION.json` — current behaviour, captured |
| R2 | Spec extraction | `SPEC.md` — behaviour derived from code |
| R3 | Data Contract Freeze | `DATA_CONTRACT.json` — pinned, read-only afterwards |
| R4 | Golden Tests | `GOLDEN/` — green against the OLD system first |
| R5 | Design system | `DESIGN_SYSTEM.md` + tokens |
| R6 | Backend rebuild | new service, own tests |
| R7 | Frontend rebuild | new UI against R5 and R6 |
| R8 | Strangler migration | routes move one at a time behind a flag |
| R9 | Canary cutover | **requires explicit user approval** |
| R10 | Cleanup | **requires explicit user approval** |

A golden test that was never green against the old implementation is not a
golden test. At every point from R8 on, rollback is one flag flip.

## 15. Non-goals

- **Not a security audit.** S8 catches the obvious client-side holes; it is not
  a penetration test and does not replace one.
- **Not a rewrite.** Phase A improves the code that exists. Use
  `/web-improvement-loop:redesign` when replacement is the actual answer.
- **Not a substitute for a human product decision.** Phase C proposes; a person
  decides.
- **Not offline-capable.** Phase B needs a real browser. Without one, it stops
  and says so rather than simulating results.
- **Not a CI replacement for tests.** The Regression Guard blocks degradation;
  it does not write your test suite.
- **Not multi-tenant.** One project, one branch, one loop at a time.
