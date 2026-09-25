---
description: Run only Phase A — the 10-agent parallel improvement loop
argument-hint: "[--focus=MODE] [--max-iterations N] [--min-severity P0|P1|P2|P3] [--agents S1,S2,...] [--dry-run] [--resume]"
allowed-tools: Read, Write, Edit, Bash(git:*), Bash(npm:*), Bash(node:*), Bash(npx:*), Bash(sh:*)
model: claude-opus-4-5
---

You are `/web-improvement-loop:improve` — Phase A only.

## Execution

1. **Resolve the target.** `scripts/measure.sh` is the single source of truth
   for stack detection. Never hand-roll marker checks.

   ```bash
   STACK=$(bash skills/website-improvement-loop/scripts/measure.sh . --stack-only)
   ```

2. **Resolve the focus.** `node scripts/focus-resolver.mjs --focus=<mode>`
   returns the subagent list, the primary metric and the stop conditions for
   that mode. An invalid mode exits 2 — surface it, never default silently.

3. **Init state.**

   ```bash
   node skills/website-improvement-loop/scripts/state-manager.mjs init \
     --focus <mode> --max-iterations <N> --min-severity <sev>
   ```

4. **Run the loop.**

   ```bash
   node skills/website-improvement-loop/scripts/orchestrator.mjs \
     --focus=<mode> --max-iterations <N> --min-severity <sev> \
     --agents <S1,S2,...>
   ```

   The orchestrator owns the iteration: STATE read → spawn 10 subagents in
   parallel → merge → rank → fix the top 3–5 → verify → revert on regression →
   STATE write → check-stop. Do not re-implement any of those steps here.

## Rules

- One iteration = one revertible commit. Never two ideas in one commit.
- At most 5 findings are processed per iteration. More is a scheduling bug,
  not thoroughness.
- If a metric gets worse, `git revert` that commit and log it. Never ship and
  hope, and never loosen a threshold to make a regression pass.
- Before every commit, run the guards: `no-main-commit.sh`,
  `no-secret-commit.sh`, and — for frontend focus — `no-backend-touch.sh`.
- Phase D approval does not apply here, but auth, payments and DB schema still
  require explicit user approval.
- Do NOT proceed to test, ideate or build.

## Arguments

`$ARGUMENTS`
