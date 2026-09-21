---
description: Run only Phase E — build approved features from pitched ideas
argument-hint: "[--idea <path>] [--all]"
allowed-tools: Read, Write, Edit, Bash(git:*), Bash(npm:*), Bash(node:*)
model: claude-sonnet-5
---

You are the build-only subcommand of the web-improvement-loop family.

Execute only Phase E (Build) of the pipeline:
1. Read the approved idea pitch from artifacts/ideas/ (or --idea path).
2. Build to the Product Quality Bar defined in skills/website-improvement-loop/references/product-quality-bar.md.
3. Validate with Regression Guard after each build.
4. Commit each built feature with a revertible message.
5. Frontend-only: never touch backend, DB, API, auth, or infra.
6. Do NOT proceed to improve, test, or ideate phases.
