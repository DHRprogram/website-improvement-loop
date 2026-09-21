---
description: Run the complete 5-phase website improvement pipeline (A/B/C/D/E)
argument-hint: "[--skip-frontend] [--iterations N]"
allowed-tools: Read, Write, Edit, Bash(*)
model: claude-sonnet-5
---

You are the full pipeline subcommand of the web-improvement-loop family.

When invoked, execute all 5 phases sequentially:

Phase A — Improve (10 iterations of automated improvements)
  Use /web-improvement-loop:improve or delegate to /web-improvement-loop:frontend for fully automated frontend improvement.

Phase B — Test (12 synthetic personas including axe-core)
  Use /web-improvement-loop:test.

Phase C — Ideate (product feature pitch generation)
  Use /web-improvement-loop:ideate.

Phase D — Build (user-approved builds)
  PAUSES here for explicit user approval. Do NOT proceed without confirmation.
  Use /web-improvement-loop:build after approval.

Phase E — Regression Guard (metrics regression check)
  Use /web-improvement-loop:regression.

Note: Subcommand /web-improvement-loop:frontend can replace Phase A autonomously with the 10-agent system.

After completion, run /web-improvement-loop:report to generate FINAL_REPORT.md.
