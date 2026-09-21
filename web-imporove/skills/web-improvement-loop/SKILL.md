---
name: web-improvement-loop
description: >-
  Parent skill for the web-improvement-loop namespaced slash command family.
  Coordinates subcommands for automated frontend improvement, synthetic user
  testing, ideation, build, regression guard, and master redesign loop.
---

# Web Improvement Loop

Parent skill for the web-improvement-loop family of namespaced slash commands.

## Subcommands

| Subcommand | Description | Automation |
|------------|-------------|------------|
| /web-improvement-loop:full | Complete 5-phase pipeline A-E | Pauses at D |
| /web-improvement-loop:improve | Phase A only | Semi-automated |
| /web-improvement-loop:test | Phase B — 12 user tests | Semi-automated |
| /web-improvement-loop:ideate | Phase C — feature pitches | Semi-automated |
| /web-improvement-loop:build | Phase E — approved features | Requires approval |
| /web-improvement-loop:frontend | **Master redesign loop** — autonomous R0..R10 | **Autonomous** |
| /web-improvement-loop:regression | Regression guard | Automated |
| /web-improvement-loop:report | Generate FINAL_REPORT.md | Automated |
| /web-improvement-loop:help | Subcommand reference | Instant |

## Risk Warning — frontend subcommand

The /web-improvement-loop:frontend subcommand uses the frontend-master-loop
skill which runs autonomously through 16 phases including backend rebuild,
strangler migration, and canary cutover.

**Requirements before use:**
- Staging database URL
- Feature flag provider
- Backup target confirmed
- APM/observability stack (recommended)

**Up-front approval:** Phase 0 collects ALL user decisions before any work.
After approval, the skill runs until completion or Hard Stop. Never run on
production without explicit approval.

## Breaking Change (v0.5.0)

The frontend subcommand now delegates to the master redesign loop skill.
All previous functionality preserved via other subcommands.
