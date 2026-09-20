# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-09-20

### Added

- Phase A — Improve: 10 iterations of codebase improvement with before/after measurement and rubric scoring
- Phase B — Synthetic User Testing: 12 personas through Chrome including 10 demographic personas, adversarial chaos tester (P11), and axe-core accessibility auditor (P12)
- Phase C — Ideate: 15–25 ideas distilled to 8–12 pitches with evidence from user testing
- Phase D — Approval: User review gate with explicit approval before building
- Phase E — Build: Build approved ideas to Product Quality Bar with verification loop
- Regression Guard: CI gate that prevents metric degradation
- AUXILIARY_BASELINE.md: Project reconnaissance and baseline scoring
- IMPROVEMENT_LOG.md: Append-only log of all changes across iterations
- IDEA_BACKLOG.md: Backlog of all ideas generated
- IDEA_PITCHES.md: Formatted pitches ready for user review
- APPROVED_IDEAS.md: Record of user-approved ideas with scope
- BUILD_LOG.md: Ship log for each built idea
- FINAL_REPORT.md: Comprehensive final report with before/after comparison
- USER_TEST_REPORT.md: Synthesis of all synthetic user testing
- scripts/measure.sh: Metrics snapshot script for before/after comparison
- scripts/user-test/aggregate-findings.mjs: Aggregation of persona findings
- scripts/user-test/run-axe.mjs: Accessibility audit runner using axe-core
- scripts/user-test/baseline-save.mjs: Save regression baseline
- scripts/user-test/baseline-check.mjs: Check regression against baseline
- scripts/user-test/findings.schema.json: JSON Schema for persona findings
- scripts/ci/regression-gate.sh: CI regression gate script
- references/misuse-checklist.md: Comprehensive misuse detection checklist
- references/ideas.md: Idea generation prompts across 9 business areas
- references/idea-pitch-format.md: Standardized pitch format
- references/product-quality-bar.md: Quality bar for shipping ideas
- references/personas.md: 12 complete synthetic user personas
- references/user-test-protocol.md: Detailed testing protocol
- references/adversarial-playbook.md: 40 attacks in 6 groups
- references/a11y-audit.md: Accessibility audit specification
- references/final-report-template.md: Template for final report
- examples/persona-01.example.json: Example persona output
- examples/persona-11.example.json: Example adversarial persona output
- examples/BASELINE.example.json: Example baseline file
- .mcp.json: Sample MCP server configuration
- .github/workflows/regression.yml: CI workflow for regression gate
- .claude/commands/improve-site.md: Claude Code slash command
