---
description: Audit and improve this website over 10 measured iterations with 10 parallel agents
argument-hint: "[--focus=MODE] [--max-iterations N] [--min-severity P0|P1|P2|P3] [--dry-run]"
allowed-tools: Read, Write, Edit, Bash(git:*), Bash(npm:*), Bash(node:*), Bash(npx:*)
model: claude-opus-4-5
---

The skill-bundled shorthand for `/web-improvement-loop:improve`. It is here so
the skill works when only the skill directory is installed, without the
namespaced commands.

## What it does

1. Resolves the target with `scripts/measure.sh . --stack-only`.
2. Initialises `STATE.md` for the requested focus and iteration budget.
3. Runs the 10-agent parallel loop via `scripts/orchestrator.mjs`.
4. Writes `FIX-PLAN.md` for the top 3–5 findings, then hands back so the fix
   can be applied and committed as one revertible change.
5. Repeats until a stop condition fires, then writes `FINAL_REPORT.md`.

```bash
node scripts/orchestrator.mjs --focus=full --max-iterations 10 --min-severity P2
```

## Stop conditions

Iteration cap reached · no open finding at or above the severity floor · 5
iterations with no improvement · 3 consecutive errors · a STOP file.

## Rules

One iteration is one revertible commit. Revert any change that makes a metric
worse. Never commit a secret, never work on `main`, never build an idea the
user did not approve. The full specification is in `SKILL.md`.
