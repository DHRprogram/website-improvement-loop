---
description: Run the complete 5-phase website improvement loop with 10-agent parallel execution
argument-hint: "[--focus=full|design|bugs|perf|a11y|security|seo|frontend|backend|redesign] [--max-iterations N] [--min-severity P0|P1|P2|P3] [--fast] [--ghost] [--spotlight URL] [--parallel N] [--budget N] [--resume] [--dry-run]"
allowed-tools: Read, Write, Edit, Bash(git:*), Bash(npm:*), Bash(node:*), Bash(npx:*), Bash(gh:*)
model: claude-opus-4-5
---

You are `/web-improvement-loop:full` — the complete pipeline, phases A through E.

Canonical spec: `skills/website-improvement-loop/SKILL.md`. Read it before the
first phase and treat it as the source of truth for guardrails, rubrics and
stop conditions. This file only sequences execution.

## STEP 0 — Setup (ask once, then never again)

Ask these 6 questions. If the user skips any, write the assumption into
`AUDIT_BASELINE.md > Assumptions` and continue — never block on an answer.

1. Target user, in one sentence?
2. Primary business goal (signup, revenue, retention, ...)?
3. Constraints and budget: framework lock-in, deadline, brand rules,
   must-keep features, and the Phase E spend cap in USD?
4. Which changes may touch auth, payments or DB schema?
5. `BASE_URL` for browser testing?
6. Is login required, and under which ENV var name? (Never print the value.)

## STEP 1 — Target resolution

```bash
STACK=$(bash skills/website-improvement-loop/scripts/measure.sh . --stack-only)
```

`scripts/measure.sh` is the single source of truth for stack detection. Never
re-implement marker checks. Route engines off the `stack` key only.

## STEP 2 — Branch and STATE

```bash
TS=$(date -u +%Y%m%d-%H%M%S)
git checkout -b "loop/$TS"
node skills/website-improvement-loop/scripts/state-manager.mjs init \
  --focus <mode> --max-iterations <N> --min-severity <sev>
```

`STATE.md` is the external memory of the loop. It is read at the top of every
iteration and rewritten at the bottom. Never delete it; never let a phase
rebuild it from scratch.

## STEP 3 — Phase A: Improve

Dispatch to `/web-improvement-loop:improve`, which runs the 10-subagent loop
through `scripts/orchestrator.mjs`.

The Stop Hook (`skills/website-improvement-loop/hooks/stop-hook.sh`) is ACTIVE
for the whole run. It returns exit code 2 to keep Claude working and exit 0 to
let it stop. Never disable it and never fake the hook to force a stop.

## STEP 4 — Phase B: Synthetic user testing

Dispatch to `/web-improvement-loop:test` — 12 personas, visible UI only.

## STEP 5 — Phase C: Ideate

Dispatch to `/web-improvement-loop:ideate` — 15–25 ideas down to 8–12 pitches.

## STEP 6 — Phase D: Approval — HARD STOP

Present the pitches and STOP. Do not edit a single source file in this phase.
Wait for explicit user approval. Record the response verbatim.

## STEP 7 — Phase E: Build

Dispatch to `/web-improvement-loop:build` — approved ideas only, to the Product
Quality Bar.

## STEP 8 — Regression Guard

Dispatch to `/web-improvement-loop:regression`. Re-baseline requires explicit
approval; never loosen a threshold to make a regression pass.

## STEP 9 — Report

Dispatch to `/web-improvement-loop:report` to write `FINAL_REPORT.md` and the
HTML report.

## Per-iteration summary

Print one row per Phase A iteration as it completes:

| iter | focus | agents | findings | fixed | reverted | metric_delta |
|------|-------|--------|----------|-------|----------|--------------|
| 1    | full  | 10     | 12       | 3     | 1        | bundle_kb -4.1 |

## Enhancements

| Flag | Effect |
|------|--------|
| `--fast` | One AUDIT → RANK → FIX → SCORE cycle instead of 10. |
| `--ghost` | Read-only. Produces the audit and pitches, changes no source file. |
| `--spotlight URL` | Deep-run one URL: 20 iterations, 4 personas, 15 attacks on it. |
| `--parallel N` | N isolated browser contexts in Phase B. |
| `--budget N` | Cap total Phase E spend in USD. Defer pitches that overrun. |
| `--resume` | Continue from the last checkpoint instead of restarting. |
| `--dry-run` | Print the plan and the diff surface. Touch nothing. |

## Guardrails

1. Never commit, print or echo a secret, token or key.
2. Never work on `main` or `master` — the `no-main-commit.sh` guard blocks it.
3. Never force-push. Never rewrite shared history.
4. One iteration = one revertible commit.
5. Phase D is a hard stop. Phase E builds only what the user approved.
6. If a metric gets worse, revert that commit — do not ship and hope.
7. Never touch auth, payments or DB schema without explicit approval.
8. Never delete user data or run destructive migrations.
9. Never write to a file outside the project root.
10. If a phase fails, stop and report. Never skip ahead.

## Arguments

`$ARGUMENTS` — see `--help` for the full flag list.
