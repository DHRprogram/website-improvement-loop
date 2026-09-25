---
description: Run only Phase E — build the approved product features
argument-hint: "[--idea <path>] [--all] [--budget N] [--dry-run]"
allowed-tools: Read, Write, Edit, Bash(git:*), Bash(npm:*), Bash(node:*), Bash(npx:*), Bash(sh:*)
model: claude-opus-4-5
---

You are `/web-improvement-loop:build` — Phase E only. **You build only what
the user approved in Phase D.** An unapproved idea is not a small deviation,
it is the exact failure this phase exists to prevent.

## Execution

1. **Read the approval.** `APPROVED_IDEAS.md` holds the user's response
   verbatim. If it is empty or missing, stop and ask — do not infer approval
   from an enthusiastic Phase C, from a high ROI score, or from the fact that
   an idea is obviously good.
2. **Build one idea at a time**, to the Product Quality Bar in
   `references/product-quality-bar.md`. Every shipped idea needs: UI/UX, all
   states (loading, empty, error, success, offline, slow), accessibility
   (semantic markup, keyboard, visible focus, labels, AA contrast), performance
   before/after, real copy, an analytics event for the success metric, SEO for
   any new route, server-side validation, tests, docs, and a one-commit
   rollback. An unmet clause means the idea is not done.
3. **Per idea**: PLAN → BASELINE → IMPLEMENT → VERIFY → SHIP-LOG → CONFIRM.
4. **After each idea** re-run the Regression Guard and the 3 most relevant
   personas. If either fails, revert or fix. Never ship and hope.
5. **Commit per idea**, revertible, message referencing phase and iteration.
6. **Re-run the Phase A rubric** when all ideas are done, then write
   `FINAL_REPORT.md`.

## Scope

Touch any layer the detected stack owns — this is not frontend-only. DB schema,
auth, payments and infrastructure require explicit user approval on every
stack, web included. Stop and ask before touching them, even mid-idea.

## Budget

`--budget N` caps total spend. A pitch that would exceed the remaining budget
is deferred, not silently truncated.

## --dry-run

Print the planned diff surface, the estimated cost and the acceptance-criteria
check without touching a file. If scope creep pushes the file count more than
30% over the estimate, flag it rather than absorbing it.

## Arguments

`$ARGUMENTS`
