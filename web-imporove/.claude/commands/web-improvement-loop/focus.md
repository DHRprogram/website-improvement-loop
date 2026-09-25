---
description: Show or switch the active focus mode
argument-hint: "[full|design|bugs|perf|a11y|security|seo|frontend|backend|redesign]"
allowed-tools: Read, Write, Edit, Bash(git:*)
model: claude-opus-4-5
---

You are `/web-improvement-loop:focus`.

## With no argument — show the active focus

```bash
node skills/website-improvement-loop/scripts/focus-resolver.mjs --list
node skills/website-improvement-loop/scripts/state-manager.mjs read
```

Print the active focus from `STATE.md`, then the full mode table:

| mode | subagents | primary metric |
|------|-----------|----------------|
| full | S1–S10 | rubric_total |
| design | S2,S3,S5,S10 | design_system_violations |
| bugs | S1,S6 | runtime_errors |
| perf | S4 | bundle_kb |
| a11y | S3,S5 | axe_critical |
| security | S8 | xss_risks |
| seo | S7 | meta_coverage |
| frontend | S2,S3,S4,S5,S7,S10 | rubric_total |
| backend | S1,S6,S8,S9 | runtime_errors |
| redesign | S1,S2,S5,S8,S9 | parity_violations |

If `STATE.md` does not exist yet, say so and print the table with "active: none".
Do not create state from a read-only command.

## With an argument — switch the focus

```bash
node skills/website-improvement-loop/scripts/focus-resolver.mjs --focus=<mode>
node skills/website-improvement-loop/scripts/state-manager.mjs update --set-focus=<mode>
```

Report the new subagent list and primary metric. Changing focus does NOT reset
`iteration_count`, the baseline, or the findings queue — it changes what the
next iteration looks for.

## Invalid mode

Print the valid list and exit 1. Never fall back to `full` silently: a typo
that quietly becomes a 10-agent run is a surprise, and surprises in an
autonomous loop are how budget gets spent.

## Arguments

`$ARGUMENTS`
