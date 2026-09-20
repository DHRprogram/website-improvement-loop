# Website Improvement Loop

A Claude Code skill that audits, improves, tests, and builds websites — with 25 enhancements including synthetic user testing, adversarial attacks, accessibility audits, and a regression guard.

## Quick Install

**One command:**
```bash
curl -fsSL https://raw.githubusercontent.com/DHRprogram/website-improvement-loop/main/install.sh | bash
```

**Manual:**
```bash
# 1. Clone the skill
git clone https://github.com/DHRprogram/website-improvement-loop.git ~/.claude/skills/website-improvement-loop

# 2. Symlink the slash command
mkdir -p ~/.claude/commands
ln -sf ~/.claude/skills/website-improvement-loop/commands/improve-site.md ~/.claude/commands/improve-site.md

# 3. Install dependencies
cd ~/.claude/skills/website-improvement-loop
npm install --no-audit --no-fund

# 4. (Optional) Add MCP config for browser testing
# Add to ~/.claude/settings.json or .claude/settings.json:
```

## MCP Setup (Required for Phase B)

Add to your settings:
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--browser", "chrome"]
    }
  }
}
```

## Usage

1. Open Claude Code in your project directory
2. Run `/improve-site`
3. Answer the 4 setup questions
4. The skill runs automatically through all 5 phases

## What It Does

| Phase | Description |
|-------|-------------|
| **A** — Improve | 10 iterations of codebase improvement with before/after scoring |
| **B** — Test | 12 synthetic personas through Chrome (10 demographic + adversarial + a11y) |
| **C** — Ideate | 15–25 product ideas, distilled to 8–12 pitches with ROI ranking |
| **D** — Approve | User reviews pitches and selects what to build |
| **E** — Build | Builds approved ideas to Product Quality Bar |

## Features

- 25 enhancements: `--fast`, `--parallel N`, `--dry-run`, `--ghost`, `--spotlight`, `--budget`, `--resume`
- Regression Guard: prevents metric degradation across builds
- CI integration via GitHub Actions (copy `examples/github-workflow.yml`)
- HTML report with Chart.js visualizations
- Slack/Telegram webhooks for P0 alerts
- Multi-project baseline support
- Auto-revert on score regression

## Files

```
39 files in the skill directory:
  SKILL.md, README.md, LICENSE, CHANGELOG.md, .gitignore, package.json, .mcp.json, install.sh
  commands/improve-site.md
  scripts/measure.sh, scripts/trend-chart.mjs, scripts/init.mjs, scripts/html-report.mjs
  scripts/dedup-findings.mjs, scripts/changelog-gen.mjs, scripts/visual-diff.mjs, scripts/form-fuzzer.mjs, scripts/cron-check.sh
  scripts/ci/regression-gate.sh
  scripts/user-test/aggregate-findings.mjs, run-axe.mjs, baseline-save.mjs, baseline-check.mjs, findings.schema.json
  references/ (10 files)
  examples/ (4 files)
  checkpoints/
```

## Uninstall

```bash
rm -rf ~/.claude/skills/website-improvement-loop
rm -f ~/.claude/commands/improve-site.md
```

## License

MIT
