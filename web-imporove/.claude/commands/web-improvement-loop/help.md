---
description: Show available subcommands of the web-improvement-loop family
argument-hint: ""
allowed-tools: Read
model: claude-haiku-4-5
---

You are the help subcommand of the web-improvement-loop family.

Print the following table:

| Subcommand | Description | Example |
|------------|-------------|---------|
| /web-improvement-loop:full | Run complete 5-phase pipeline (A->B->C->D->E) | :full --skip-frontend |
| /web-improvement-loop:improve | Run only Phase A - 10 improvement iterations | :improve --iterations 10 |
| /web-improvement-loop:test | Run only Phase B - 12 synthetic user tests | :test --persona all |
| /web-improvement-loop:ideate | Run only Phase C - generate product pitches | :ideate --count 5 |
| /web-improvement-loop:build | Run only Phase E - build approved features | :build --idea ideas/001.md |
| /web-improvement-loop:frontend | **Automated** 10-agent frontend-only improvement | :frontend --max-iterations 50 |
| /web-improvement-loop:regression | Regression Guard - verify metrics | :regression |
| /web-improvement-loop:report | Generate FINAL_REPORT.md from artifacts | :report |
| /web-improvement-loop:help | Show this help table | :help |

Notes:
- :frontend runs fully autonomously with no human intervention.
- :full pauses at Phase D for explicit user approval before building.
- All subcommands respect the no-backend guardrail.
- Run /web-improvement-loop:report after any pipeline run.
