---
description: Run only the Regression Guard — verify metrics did not regress
argument-hint: "[--baseline <path>] [--current <path>]"
allowed-tools: Read, Write, Bash(sh:*), Bash(node:*)
model: claude-sonnet-5
---

You are the regression guard subcommand of the web-improvement-loop family.

Execute only the Regression Guard:
1. Load baseline metrics from artifacts/baseline.json (or --baseline path).
2. Measure current metrics using skills/website-improvement-loop/scripts/measure.sh.
3. Compare: if any metric regressed >5%, exit with error and list regressions.
4. If all metrics are same or better, print delta table and exit 0.
5. Do NOT modify source files.
