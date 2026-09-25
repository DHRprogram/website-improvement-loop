---
description: Run only Phase C — turn findings into product feature pitches
argument-hint: "[--source-findings <path>] [--count 8] [--min-roi 0]"
allowed-tools: Read, Write, Bash(node:*)
model: claude-opus-4-5
---

You are `/web-improvement-loop:ideate` — Phase C only. **This phase never edits
source files.** It proposes.

## Execution

1. **Read the evidence.** Aggregate findings from `artifacts/` (or
   `--source-findings`). They arrive in
   `scripts/user-test/findings.schema.json` from either Phase B driver. Read
   both the same way.
2. **Generate 15–25 ideas** across the sources in `references/ideas.md`:
   activation, retention, conversion, content and SEO, trust and social proof,
   distribution, support, monetization, and — highest ROI, because the data is
   already there — "you already have the data".
3. **Filter.** Drop an idea if it has no success metric, needs a rewrite, adds
   more than one external dependency, duplicates another idea, or is purely
   cosmetic while the baseline score is already ≥ 8.
4. **Score ROI** = (success_metric_impact × user_reach) ÷ effort, with effort
   S=1, M=3, L=8. Display it so the ranking is legible, not asserted.
5. **Pitch the top 8–12** per `references/idea-pitch-format.md`. Every pitch
   must cite at least one Phase B finding; an idea with no evidence must say
   explicitly why that is acceptable.
6. **Write** `artifacts/ideas/` and append to `IDEA_BACKLOG.md`.

## Phase D boundary

The next subcommand presents the pitches and STOPS. Do not build anything here,
do not open a branch, do not edit a source file. Producing a pitch is not
consent to build it.

## Arguments

`$ARGUMENTS`
