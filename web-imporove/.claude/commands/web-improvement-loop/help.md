---
description: Show the subcommands, focus modes and flags of the web-improvement-loop family
argument-hint: ""
allowed-tools: Read, Bash(node:*)
model: claude-opus-4-5
---

You are `/web-improvement-loop:help`.

The A–E pipeline is stack-agnostic. Every subcommand resolves its target with
`measure.sh . --stack-only` and routes off the result — see
`references/targets.md` for the routing table.

## Subcommands

| Subcommand | Description | Example |
|------------|-------------|---------|
| `/web-improvement-loop:full` | Full pipeline A→B→C→D→E plus Regression Guard | `:full --focus=full --max-iterations 10` |
| `/web-improvement-loop:improve` | Phase A only — 10-agent parallel improvement loop | `:improve --focus=bugs` |
| `/web-improvement-loop:test` | Phase B only — 12 personas + axe | `:test --parallel 3` |
| `/web-improvement-loop:ideate` | Phase C only — product pitches | `:ideate --count 8` |
| `/web-improvement-loop:build` | Phase E only — build approved features | `:build --idea ideas/001.md` |
| `/web-improvement-loop:redesign` | Full-site redesign, Strangler Fig, R0→R10 | `:redesign --mode=strangler` |
| `/web-improvement-loop:regression` | Regression Guard — verify no metric degraded | `:regression --tolerance 5` |
| `/web-improvement-loop:report` | Write `FINAL_REPORT.md` and the HTML report | `:report --html` |
| `/web-improvement-loop:focus` | Show or switch the active focus mode | `:focus design` |
| `/web-improvement-loop:status` | Show iteration, queue and metric deltas | `:status --json` |
| `/web-improvement-loop:stop` | Stop the loop, persist state, print resume command | `:stop --reason=ship-it` |
| `/web-improvement-loop:help` | This table | `:help` |
| `/agent-team` | Multi-service multi-agent platform (separate skill) | `/agent-team --mode=run` |

## Focus modes

| Mode | Subagents | Primary metric |
|------|-----------|----------------|
| `full` | S1–S10 | `rubric_total` |
| `design` | S2,S3,S5,S10 | `design_system_violations` |
| `bugs` | S1,S6 | `runtime_errors` |
| `perf` | S4 | `bundle_kb` |
| `a11y` | S3,S5 | `axe_critical` |
| `security` | S8 | `xss_risks` |
| `seo` | S7 | `meta_coverage` |
| `frontend` | S2,S3,S4,S5,S7,S10 | `rubric_total` |
| `backend` | S1,S6,S8,S9 | `runtime_errors` |
| `redesign` | S1,S2,S5,S8,S9 | `parity_violations` |

## The 10 subagents

S1 Bug Hunter · S2 Design Critic · S3 UX Auditor · S4 Perf Engineer ·
S5 A11y Auditor · S6 Test Guardian · S7 SEO Auditor · S8 Security Scanner ·
S9 Architecture Reviewer · S10 Mobile Auditor

## Global flags

`--focus=MODE` · `--agents=S1,S2,...` · `--max-iterations N` ·
`--min-severity P0|P1|P2|P3` · `--dry-run` · `--resume` · `--fast` ·
`--ghost` · `--spotlight URL` · `--parallel N` · `--budget N`

## Notes

- Detected stacks: `nextjs`, `vite`, `node`, `django`, `python`, `go`, `rust`,
  `jvm`, `php`, `ruby`, `dotnet`, `generic`. Unknown stacks fall back to the
  generic rubric.
- Phase D is a hard stop. Phase E builds only what was approved.
- The Stop Hook is active during every loop run: exit 2 continues, exit 0 stops.
- DB schema, auth, payments and infra always require explicit user approval.
