# Composition Registry Guide

Phase 1 scans the repo for every reusable asset and maps them to phases.

## Scan Targets
- skills/*/SKILL.md (skill definitions)
- skills/*/agents/*.md (agent definitions)
- skills/*/scripts/*.mjs (Node scripts)
- skills/*/scripts/*.sh (Bash scripts)
- .claude/commands/**/*.md (slash commands)
- .claude/agents/**/*.md (Claude agents)
- .github/workflows/*.yml (GHA workflows)

## Ranking
Assets are ranked by keyword match to phase name, path proximity, and freshness.
If no external asset matches, the internal agent is used as fallback.
