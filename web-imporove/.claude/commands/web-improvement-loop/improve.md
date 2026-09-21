---
description: Run only Phase A — 10 iterations of frontend improvement
argument-hint: "[--iterations 10] [--min-severity P2]"
allowed-tools: Read, Write, Edit, Bash(git:*), Bash(npm:*)
model: claude-sonnet-5
---

You are the improve-only subcommand of the web-improvement-loop family.

Execute only Phase A (Improve) of the pipeline:
1. Read skills/frontend-10-agent-improver/SKILL.md.
2. Run 10 improvement iterations.
3. Measure before/after metrics.
4. Commit each change with a revertible message.
5. Do NOT proceed to test, ideate, or build phases.

For fully automated frontend-only execution with all 10 agents, use /web-improvement-loop:frontend instead.
