---
description: Run only Phase B — 12 synthetic user tests including axe-core a11y audit
argument-hint: "[--persona P01|P02|...|P11|all] [--headless]"
allowed-tools: Read, Write, Bash(node:*), Bash(npx:*), Bash(git:*)
model: claude-sonnet-5
---

You are the test-only subcommand of the web-improvement-loop family.

Execute only Phase B (Test) of the pipeline:
1. Read skills/website-improvement-loop/references/personas.md.
2. Run 10 demographic personas through Chrome with visible UI interactions.
3. Run 1 adversarial chaos tester.
4. Run 1 axe-core accessibility auditor.
5. Aggregate findings into artifacts/.
6. Do NOT modify source files — testing only.
7. Do NOT proceed to improve, ideate, or build phases.
