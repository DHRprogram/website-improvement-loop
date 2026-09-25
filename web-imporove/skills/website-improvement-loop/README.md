# website-improvement-loop

Audits a website, improves it over measurable iterations with 10 parallel
subagents, tests it with 12 synthetic browser users, pitches product features,
and — only after you say yes — builds them against a strict quality bar.

The loop is self-evolving. A Stop Hook returns exit code 2 to keep Claude
working, so the audit continues across iterations until the work is actually
done, and stops on one of five measured conditions.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/DHRprogram/website-improvement-loop/main/install.sh | bash
```

From a checkout:

```bash
bash skills/website-improvement-loop/install.sh
```

The installer copies the skill to `~/.claude/skills/website-improvement-loop`,
installs the commands to `~/.claude/commands/web-improvement-loop/`, and backs
up anything it replaces to a timestamped `.bak`. It never deletes an existing
install. Restart Claude Code afterwards.

## MCP setup

The skill works without MCP. With it, agents can call the project's own tooling
instead of shelling out. `.mcp.json` is installed only if you do not already
have one.

```bash
claude mcp add website-loop -- node ~/.claude/skills/website-improvement-loop/scripts/mcp-server.mjs
```

The agent runner is separate and optional. Without one, the loop reports an
empty result and says so — it never invents findings to look busy.

```bash
export WIL_AGENT_RUNNER=claude   # any command accepting -p <prompt> --output-format json
```

## The five phases

| Phase | Name | What happens |
|---|---|---|
| A | Improve | 10 subagents audit in parallel. Findings are deduped, ranked, and the top 5 become `FIX-PLAN.md`. |
| B | Test | 12 synthetic personas drive the real UI. Only what a user can see. Friction is scored, not asserted. |
| C | Ideate | Phase B evidence becomes 12-line product pitches, each with a metric, an effort estimate, and what it touches. |
| D | Approve | Hard stop. Four questions. Nothing is built until you answer. |
| E | Build | The approved pitches, against the quality bar, with the Regression Guard watching every commit. |

## The 10 subagents

| Agent | Role |
|---|---|
| S1 | Bug Hunter |
| S2 | Design Critic |
| S3 | UX Auditor |
| S4 | Perf Engineer |
| S5 | A11y Auditor |
| S6 | Test Guardian |
| S7 | SEO Auditor |
| S8 | Security Scanner |
| S9 | Architecture Reviewer |
| S10 | Mobile Auditor |

All ten are read-only. They report findings; the orchestrator applies fixes, so
every iteration stays revertible.

## Subcommands

| Command | Does |
|---|---|
| `/web-improvement-loop:full` | The whole A–E pipeline. Start here. |
| `/web-improvement-loop:frontend` | Frontend only. Backend guarded out. |
| `/web-improvement-loop:redesign` | Strangler migration under the redesign rubric. |
| `/web-improvement-loop:improve` | Phase A alone. |
| `/web-improvement-loop:test` | Phase B alone. |
| `/web-improvement-loop:ideate` | Phase C alone. |
| `/web-improvement-loop:build` | Phase E alone. |
| `/web-improvement-loop:focus [mode]` | Show or switch focus mode. |
| `/web-improvement-loop:status` | Current state, iteration count, queue depth. |
| `/web-improvement-loop:stop` | Stop the loop and print the resume command. |
| `/web-improvement-loop:regression` | Compare the last commit against baseline. |
| `/web-improvement-loop:report` | Render the final report. |
| `/web-improvement-loop:help` | Everything above, in short form. |

## Focus modes

A focus mode selects which subagents run, which metric is primary, and how eager
the loop is to stop. It never widens the safety envelope.

| Mode | Agents | Primary metric | Floor |
|---|---|---|---|
| `full` | S1–S10 | `weighted_findings_open` | P2 |
| `design` | S2,S3,S5,S10 | `design_system_violations` | P2 |
| `bugs` | S1,S6,S9 | `p0_p1_open` | P1 |
| `perf` | S4,S10 | `perf_regressions` | P2 |
| `a11y` | S5,S3,S2 | `a11y_violations` | P2 |
| `security` | S8,S9 | `security_findings_open` | P1 |
| `seo` | S7,S4 | `seo_defects` | P3 |
| `frontend` | S2,S3,S4,S5,S10 | `frontend_quality_score` | P2 |
| `backend` | S1,S8,S9 | `backend_findings_open` | P2 |
| `redesign` | S2,S3,S5,S9 | `preservation_delta` | P2 |

`focus.md` with no argument lists them. An unknown mode is refused rather than
silently falling back to `full`.

## Redesign

Redesign is a migration, not a rewrite. The strangler pattern grows the new
system around the old one, route by route, behind feature flags that default to
the legacy path.

```bash
node scripts/data-contract-freeze.mjs --project=.          # freeze what exists
node scripts/preservation-capture.mjs --project=. --base-url=http://localhost:3000
node scripts/migrate-route.mjs --project=. --route=/about --flag=about_new --step=1 --yes
node scripts/rollback.mjs --project=. --route=/about --reason="error rate"
```

Rollback is a flag flip: under 5 seconds, against a 5-minute `git revert`.
Steps run in traffic-ascending order, so the first cutover lands on a low-risk
route and a router bug is found on `/about` rather than on checkout. Step 5
cannot run until a lower step is migrated.

The rubric scores preservation fidelity at 25 of 100, deliberately the heaviest
weight. A redesign that looks better and silently drops a feature is a net loss.

## Regression Guard

Every iteration must improve the metric it targeted. A commit that regresses
one is reverted automatically, and the lesson is written into `STATE.md`.

| Guard | Blocks | Exit |
|---|---|---|
| `no-secret-commit.sh` | A credential in the staged diff. Prints the file, never the value. | 1 |
| `no-main-commit.sh` | A commit to `main`, `master`, `prod` or `release`. | 1 |
| `no-backend-touch.sh` | Server, API, schema, migration or `.sql` in a frontend run. | 1 |
| `no-prod-touch.sh` | A production connection target anywhere. | 1 |
| `no-schema-change.sh` | A data-contract change with no approval record. | 1 |
| `golden-tests-must-pass.sh` | A failing golden test on a migrated route. | 1 |
| `metric-must-improve.sh` | A metric that moved the wrong way. | 1 |

A metric that cannot be measured is reported as `null` and skipped — never as
`0`, and never as a pass. A fabricated zero is worse than a missing number,
because it makes the guard green.

## CI

| Workflow | Trigger | Does |
|---|---|---|
| `regression.yml` | `pull_request` | Accessibility, aggregation, baseline comparison. |
| `frontend-loop.yml` | `schedule`, `workflow_dispatch` | The frontend loop at `--focus=design`. |
| `frontend-loop-gate.yml` | `workflow_dispatch` only | The frontend master loop, by hand. |
| `redesign-gate.yml` | `workflow_dispatch` only | Pre-flight for a migration. Never automatic. |
| `vibe-forge-nightly.yml` | `schedule`, `workflow_dispatch` | A measurement sweep. Pushes nothing. |

`redesign-gate.yml` has no `push` and no `schedule` trigger on purpose. Routing
that runs unattended is how a migration takes production down at 3am.

## HTML report

```bash
node scripts/html-report.mjs artifacts/USER_TEST/AGGREGATE.json artifacts/REPORT.html
```

Renders persona results, the attack summary, accessibility findings and the
friction heatmap. It refuses to render without real input rather than producing
an empty report that looks like a pass.

## Webhooks

Post the final report to Slack or Telegram by setting one variable. No webhook
URL is ever committed.

```bash
export WIL_SLACK_WEBHOOK="https://hooks.slack.com/services/REDACTED"
export WIL_TELEGRAM_WEBHOOK="https://api.telegram.org/botREDACTED/sendMessage?chat_id=REDACTED"
node scripts/html-report.mjs --notify
```

Both are off unless the variable is set. A webhook failure is logged and does
not fail the run — a report that could not be posted is not a failed audit.

## Self-checks

```bash
cd skills/website-improvement-loop
npm run verify   # JSON.parse, bash -n, node --check
npm test         # stop-hook, guards, measure, report, migration
```

These run against throwaway fixtures, not against your project, so they are safe
to run at any time.

## Example runs

```bash
/web-improvement-loop:full --focus=design
/web-improvement-loop:frontend --focus=a11y --min-severity P1
/web-improvement-loop:redesign --mode=strangler --no-cutover
/web-improvement-loop:focus perf
/web-improvement-loop:full --ghost --dry-run
```

## Safety

- Never commits a secret, token or key.
- Never runs against `main` or a production database.
- One revertible commit per iteration.
- Never fabricates a measurement.
- Never touches auth, payments or a database schema without explicit approval.
- Never deletes user data.

## Layout

```
commands/     13 Claude Code slash commands
agents/       S1–S10 auditor definitions
hooks/        Stop Hook + check-stop
scripts/      orchestrator, resolver, metrics, guards, self-checks
references/   19 documents: personas, adversarial playbook, priority formula,
              stop conditions, state schema, redesign rubric, strangler
              pattern, data-contract rules, golden tests, rollback playbook
examples/     11 example artifacts
```

## Documentation

`SKILL.md` is the full specification: all five phases, the 10 subagent
definitions, the STATE.md schema, the Stop Hook contract, the redesign phases
R0–R10, and the non-goals.

## License

MIT.
