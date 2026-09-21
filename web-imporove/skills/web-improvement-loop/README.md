# Web Improvement Loop

Namespaced slash command family for Claude Code. Provides automated website
improvement through multiple specialized subcommands.

## Installation

```bash
# Copy the skills
cp -r skills/frontend-10-agent-improver ~/.claude/skills/
cp -r skills/web-improvement-loop ~/.claude/skills/

# Copy the slash commands
mkdir -p ~/.claude/commands/web-improvement-loop
cp .claude/commands/web-improvement-loop/*.md ~/.claude/commands/web-improvement-loop/
```

## Subcommands

| Command | Description | Example |
|---------|-------------|---------|
| /web-improvement-loop:full | Full 5-phase pipeline | `/web-improvement-loop:full` |
| /web-improvement-loop:improve | Phase A only | `/web-improvement-loop:improve --iterations 10` |
| /web-improvement-loop:test | Phase B only | `/web-improvement-loop:test --persona all` |
| /web-improvement-loop:ideate | Phase C only | `/web-improvement-loop:ideate --count 5` |
| /web-improvement-loop:build | Phase E only | `/web-improvement-loop:build --idea ideas/001.md` |
| /web-improvement-loop:frontend | Master redesign loop -- 16 phases, autonomous, 22 agents | `/web-improvement-loop:frontend --mode=strangler --resume` |
| /web-improvement-loop:regression | Metrics regression check | `/web-improvement-loop:regression` |
| /web-improvement-loop:report | Generate final report | `/web-improvement-loop:report` |
| /web-improvement-loop:help | Show this help | `/web-improvement-loop:help` |

## Automation Levels

- **Fully automated** (no human in loop): :frontend, :regression, :report, :help
- **Semi-automated** (some checks/stops): :improve, :test, :ideate
- **Requires approval**: :build (paused until user confirms)

## Breaking Change

v0.2.0 removed the old `/improve-site` command. Use namespaced commands instead.

## Changelog

See CHANGELOG.md for version history.
