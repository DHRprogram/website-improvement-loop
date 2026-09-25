---
description: Run the Regression Guard — verify no metric degraded
argument-hint: "[--baseline <path>] [--current <path>] [--tolerance 5]"
allowed-tools: Read, Write, Bash(sh:*), Bash(node:*), Bash(npm:*), Bash(npx:*)
model: claude-opus-4-5
---

You are `/web-improvement-loop:regression`. This subcommand is read-only. Its
job is to catch a degradation, not to negotiate with it.

## Execution

1. **Load the baseline** from `artifacts/baseline.json` (or `--baseline`).
2. **Measure current**:

   ```bash
   bash skills/website-improvement-loop/scripts/measure.sh . > artifacts/current.json
   ```

   `measure.sh` detects the stack and emits only the keys that apply to it. It
   is the single source of truth for detection — do not hand-roll marker
   checks.
3. **Compare** every key present in BOTH files.
   - Skip any key whose value is `null` in either file. `null` means the tool
     is absent, not that the score is perfect. A fabricated zero would make
     every guard pass silently.
   - Lower is better: `bundle_kb`, `lcp_ms`, `cls_score`, `axe_critical`,
     `axe_serious`, `lint_errors`, `type_errors`.
   - Higher is better: `test_pass_rate`, `meta_coverage`.
   - Any comparable metric worse by more than `--tolerance` percent (default
     5) is a FAIL. List every offender with before, after and the delta.
4. **All same or better** → print the delta table and exit 0.
5. **On FAIL**, list the regressions and stop. Do not modify source files; the
   fix is to revert or repair, and that is a decision, not a side effect of
   running a guard.

## Re-baselining

Re-baselining requires explicit user approval. Never loosen a threshold to make
a regression pass, and never re-baseline automatically — a baseline that moves
whenever the numbers look bad measures nothing.

## Arguments

`$ARGUMENTS`
