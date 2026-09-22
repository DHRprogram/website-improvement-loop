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

## Steps
1. Walk the repository tree recursively for skills/, .claude/, workflows/, .github/workflows/.
2. Classify each file by kind using the path pattern rules above.
3. Parse YAML frontmatter from every .md file found.
4. Extract callable_via from frontmatter or infer from file extension.
5. Build the assets array with id, kind, path, description, inputs, outputs.
6. Rank candidates per phase using keyword match (70%), path proximity (20%), freshness (10%).
7. Assign internal agent fallbacks where no external match exists.
8. Write COMPOSITION_REGISTRY.json with scanned_at timestamp.
9. Validate registry passes JSON.parse and has total_assets >= 1.
10. Verify every phase R0..R10 has a mapped entry in phases_mapped.

## Checklist
1. Registry file passes JSON.parse.
2. total_assets >= 1 (at minimum our own agents are found).
3. Every phase R0..R10 has a mapped entry (primary or fallback).
4. Every asset entry has id, kind, path, description.
5. No path outside repo root.
6. Frontmatter parsing succeeds for all scanned .md files.
7. Assets list deduplicated by path.
8. Skilled entries include callable_via field.
9. Script entries include language hint (node/shell).
10. Workflow entries validated against schema.
11. Ranking scores computed consistently per phase.
12. Internal agent fallbacks cover all unmapped phases.
13. COMPOSITION_REGISTRY.json written to artifacts/redesign/.
14. State.json updated with P1 completion record.
15. Audit log entry created with scan timestamp and asset count.

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

## Rollback
- P1 writes no code changes; reversal means deleting COMPOSITION_REGISTRY.json.
- If registry is corrupt, clear it and re-run composition-scan.mjs --rescan.
- On repeated failure after 3 attempts, halt with HST report.
