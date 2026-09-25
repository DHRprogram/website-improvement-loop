---
description: Run automated 10-agent frontend-only improvement loop
argument-hint: "[--focus=design|perf|a11y|seo|mobile] [--max-iterations N] [--min-severity P0|P1|P2|P3] [--dry-run] [--agents S1,S2,...]"
allowed-tools: Read, Write, Edit, Bash(git:*), Bash(npm:*), Bash(node:*), Bash(npx:*)
model: claude-opus-4-5
---

You are `/web-improvement-loop:frontend` — the frontend-only improvement loop.

Same architecture as `/web-improvement-loop:full`, with one difference that is
not optional: **frontend scope only**. The `no-backend-touch.sh` guard runs
before every commit and blocks any change under `server/`, `api/`, `backend/`,
`db/`, `migrations/`, `prisma/`, `models/`, or any `*.sql`, `schema.*`,
`migrate.*` file.

Canonical spec: `skills/website-improvement-loop/SKILL.md`.

## Default focus

`design` — the default focus mode for this subcommand. Resolve the active
focus with:

```bash
node skills/website-improvement-loop/scripts/focus-resolver.mjs --focus=design
```

`design` runs S2 (Design Critic), S3 (UX Auditor), S5 (A11y Auditor) and
S10 (Mobile Auditor). Override with `--focus` or an explicit `--agents` list.

## Execution

1. Resolve the target: `bash skills/website-improvement-loop/scripts/measure.sh . --stack-only`
2. Create branch `loop/<timestamp>`.
3. `node scripts/state-manager.mjs init --focus <mode> --max-iterations <N> --min-severity <sev>`
4. Run `node scripts/orchestrator.mjs --focus=<mode> --max-iterations <N> --min-severity <sev> --agents <list>`.
5. After the loop: `bash scripts/guards/no-backend-touch.sh`, then the
   Regression Guard, then `FINAL_REPORT.md`.

The Stop Hook stays active for the whole run. It exits 2 to continue and 0 to
stop. Never disable it.

## Per-iteration summary

| iter | focus | agents | findings | fixed | reverted | metric_delta |
|------|-------|--------|----------|-------|----------|--------------|

## Arguments

`$ARGUMENTS`

- `--focus=design|perf|a11y|seo|mobile` — default `design`
- `--agents=S1,S2,...` — explicit subagent list, overrides `--focus`
- `--max-iterations N` — default 10
- `--min-severity P0|P1|P2|P3` — default P2
- `--dry-run` — plan only, touch nothing
