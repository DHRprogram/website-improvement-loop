# Website Improvement Loop

A Claude Code skill that audits your website codebase, improves it over 10 measurable iterations, runs 12 synthetic users through Chrome, ideates and pitches product features, and builds them to a strict quality bar.

## What It Does

- **Phase A** — 10 iterations of codebase improvement with before/after metrics
- **Phase B** — 12 synthetic user tests via Chrome (10 demographic personas + adversarial chaos tester + axe-core accessibility auditor)
- **Phase C** — Product feature ideation (15–25 ideas → 8–12 pitches)
- **Phase D** — User approval gate
- **Phase E** — Build approved ideas to Product Quality Bar
- **Regression Guard** — CI gate preventing metric degradation

## Who Is It For

Developers who want to systematically improve a website: fix bugs, find UX issues, test accessibility, and turn an MVP into a real product.

## Prerequisites

- Node.js 18+
- Playwright (`npx playwright install --with-deps chromium`)
- Chrome DevTools MCP or Playwright MCP configured in your Claude Code MCP servers

## Installation

```bash
# Copy this skill to your Claude Code skills directory
cp -r skills/website-improvement-loop ~/.claude/skills/
```

Or symlink:
```bash
ln -s $(pwd)/skills/website-improvement-loop ~/.claude/skills/
```

## MCP Configuration

Add to your `~/.claude/settings.json` or project `.claude/settings.json`:

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

A sample `.mcp.json` is included in the skill directory.

## Usage

Invoke the skill in Claude Code:

```
/improve-site
```

Or run phases manually:

```bash
# Phase A — measure baseline
bash skills/website-improvement-loop/scripts/measure.sh baseline

# Phase B — run accessibility audit
node skills/website-improvement-loop/scripts/user-test/run-axe.mjs https://example.com / /about /contact

# Aggregate findings
node skills/website-improvement-loop/scripts/user-test/aggregate-findings.mjs

# Save baseline
node skills/website-improvement-loop/scripts/user-test/baseline-save.mjs

# Check regression
node skills/website-improvement-loop/scripts/user-test/baseline-check.mjs
```

## Regression Guard & CI

Add the workflow file `.github/workflows/regression.yml` to your project:

```yaml
# See the file in this skill for full configuration
```

Set repository secrets:
- `STAGING_URL` — your staging environment URL

The regression gate runs every PR and blocks merges if metrics degrade.

## Directory Structure

```
skills/website-improvement-loop/
├── SKILL.md                    # Skill definition
├── README.md                   # This file
├── LICENSE                     # MIT License
├── CHANGELOG.md               # Keep a Changelog format
├── .gitignore
├── package.json
├── .mcp.json                   # Sample MCP config
├── scripts/
│   ├── measure.sh             # Metrics snapshot
│   ├── user-test/
│   │   ├── aggregate-findings.mjs  # Findings aggregation
│   │   ├── run-axe.mjs            # Accessibility audit
│   │   ├── baseline-save.mjs      # Save regression baseline
│   │   ├── baseline-check.mjs     # Check regression
│   │   └── findings.schema.json   # JSON Schema for findings
│   └── ci/
│       └── regression-gate.sh     # CI regression gate
├── references/
│   ├── misuse-checklist.md
│   ├── ideas.md
│   ├── idea-pitch-format.md
│   ├── product-quality-bar.md
│   ├── personas.md
│   ├── user-test-protocol.md
│   ├── adversarial-playbook.md
│   ├── a11y-audit.md
│   └── final-report-template.md
├── examples/
│   ├── persona-01.example.json
│   ├── persona-11.example.json
│   └── BASELINE.example.json
└── .mcp.json
```


## Post-Install



## License

MIT. See LICENSE file.

## Contributing

Before submitting PRs, run verification:

```bash
cd skills/website-improvement-loop
npm run verify
```

This runs all 12 validation checks: JSON parse, bash syntax, Node syntax, YAML validation, and secret scanning.

[CHANGELOG.md](CHANGELOG.md) | [Issues](https://github.com/USER/website-improvement-loop/issues)
