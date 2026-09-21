# Phase 1 — Composition Registry

## Purpose
Scan the entire repository for reusable assets (skills, agents, scripts, commands, workflows, references) and build a structured registry that maps every phase to the best available asset.

## Scan Algorithm
1. Recursively walk all directories under skills/, .claude/, workflows/, .github/workflows/.
2. For each file, detect kind by path pattern:
   - skills/*/SKILL.md -> skill
   - skills/*/agents/*.md -> agent
   - skills/*/scripts/*.mjs -> node_script
   - skills/*/scripts/*.sh -> bash_script
   - skills/*/references/*.md -> reference
   - .claude/commands/**/*.md -> command
   - .claude/agents/**/*.md -> agent
   - workflows/**/*.yml -> workflow
   - .github/workflows/*.yml -> workflow
3. Parse YAML frontmatter from each .md file for name, description, inputs, outputs.
4. Extract callable_via from frontmatter or infer from path.
5. Rank candidates for each phase (R0..R10) by:
   - name/description keyword match (70%)
   - path proximity to phase scope (20%)
   - freshness (10%)
6. If no external match is found for a phase, use the internal agent in agents/.
7. Write registry with stable schema.

## Inputs
- Repo filesystem at project root.
- Existing skill/agent/command/workflow files.

## Outputs
- `artifacts/redesign/COMPOSITION_REGISTRY.json`:
  ```json
  {
    "scanned_at": "2026-09-21T12:00:00Z",
    "total_assets": 42,
    "phases_mapped": {
      "R1": { "primary": { "id": "my-existing-preservation-skill", "kind": "skill", "path": "skills/..." }, "fallback": { "id": "A11", "kind": "agent", "path": "agents/A11-preservation.md" } },
      ...
    },
    "assets": [
      { "id": "unique-id", "kind": "skill|agent|script|command|workflow|reference", "path": "relative/path", "description": "...", "inputs": [], "outputs": [], "callable_via": "/command or npx or node or bash" }
    ]
  }
  ```

## Verification Checklist
1. Registry file passes JSON.parse.
2. total_assets >= 1 (at minimum our own agents are found).
3. Every phase R0..R10 has a mapped entry (primary or fallback).
4. Every asset entry has id, kind, path, description.
5. No path outside repo root.

## Mapping Rules
- R1 Preservation: look for browser/playwright/screenshots skills first.
- R2 Spec Extraction: look for code-analysis/ast/parser skills first.
- R3 Data Contract Freeze: look for database/orm/migration skills first.
- R4 Golden Tests: look for test/e2e skills first.
- R5 Design System: look for design-system/token skills first.
- R6 Backend: look for backend/api skills first.
- R7 Frontend: look for frontend/component skills first.
- R8 Migration: look for strangler/routing skills first.
- R8.5 Parity: look for a11y/seo/i18n/analytics skills.
- R8.7 Chaos: look for load-test/chaos skills.
- R9 Canary: look for deploy/canary skills.
- R9.5 Monitor: look for observability/apm skills.
- R10 Cleanup: internal agent.

## Failure Modes
- Zero assets found -> use internal agents only. Warn user.
- Phase with no suitable asset -> use internal fallback. Log warning.
- Malformed frontmatter in .md file -> skip file, log error.
