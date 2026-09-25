---
description: Show current loop status, iteration count, queue depth and metric deltas
argument-hint: "[--json]"
allowed-tools: Read, Bash(git:*), Bash(node:*)
model: claude-opus-4-5
---

You are `/web-improvement-loop:status`. Read-only. This subcommand never
changes a file, never advances an iteration and never stops the loop.

## What to read

```bash
node skills/website-improvement-loop/scripts/state-manager.mjs read
ls artifacts/website-loop/findings/ 2>/dev/null
ls metrics/ 2>/dev/null
git log --oneline -20
```

## What to print

1. **Active focus** and its subagent list.
2. **Iteration** `n / max`, plus the stop-condition reason if the loop is done.
3. **Queue** — open findings by severity, `P0` first. Read the count from
   `QUEUE.json`; if it does not exist, say "no queue yet" rather than guessing.
4. **Metrics** — baseline vs current vs delta, for every key in the baseline.
   Lower is better for `bundle_kb`, `lcp_ms`, `cls_score`, `axe_critical`,
   `lint_errors` and `type_errors`; higher is better for `test_pass_rate` and
   `meta_coverage`. Print the direction next to each so a reader never has to
   guess whether a change was good.
5. **Recent commits** on the `loop/*` branch, newest first.
6. **Reverted** count and the one-line reason for the last revert.

## --json

Print the raw state object from `state-manager.mjs read` and nothing else, so
the output can be piped.

## Arguments

`$ARGUMENTS`
