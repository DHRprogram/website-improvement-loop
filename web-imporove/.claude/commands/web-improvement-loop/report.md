---
description: Generate FINAL_REPORT.md from loop artifacts
argument-hint: "[--artifacts-dir artifacts/frontend-loop]"
allowed-tools: Read, Write
model: claude-sonnet-5
---

You are the report subcommand of the web-improvement-loop family.

Generate FINAL_REPORT.md:
1. Read all artifacts from artifacts/frontend-loop/ (or --artifacts-dir path).
2. Use skills/frontend-10-agent-improver/references/final-report-template.md as template.
3. Fill every section with actual data from STATE.json, QUEUE.json, RUN_LOG.md.
4. Write to artifacts/frontend-loop/FINAL_REPORT.md.
5. Do NOT modify source files.
