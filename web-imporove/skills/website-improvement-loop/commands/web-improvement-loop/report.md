---
description: Generate FINAL_REPORT.md and the HTML report from loop artifacts
argument-hint: "[--artifacts-dir artifacts] [--html]"
allowed-tools: Read, Write, Bash(node:*)
model: claude-opus-4-5
---

You are `/web-improvement-loop:report`. Read-only apart from the two report
files it writes.

## Execution

1. Read every artifact from `--artifacts-dir`, defaulting to `artifacts/`.
2. Pick the template that matches what is actually on disk:
   - `artifacts/website-loop/` present → `skills/website-improvement-loop/references/final-report-template.md`
   - `artifacts/frontend-loop/` present → `skills/frontend-master-loop/references/final-report-template.md`
3. Fill every section with real data from disk: iteration count, findings by
   severity, fixes shipped, reverts and their reasons, metric before/after,
   persona friction, pitches, approved ideas, and known limitations.
4. **Omit a section only when the run genuinely did not produce it**, and say
   which section and why. An empty section labelled "no data" is honest; a
   filled-in guess is a defect.
5. With `--html`, also render the HTML report via
   `scripts/html-report.mjs`.

## Rules

- Never modify source files.
- Never restate a number that is not in an artifact. If a metric was never
  measured, print "not measured", not a plausible value.
- Record every baseline change with date, reason and who approved it.

## Arguments

`$ARGUMENTS`
