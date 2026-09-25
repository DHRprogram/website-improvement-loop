# Idea Pitch Format

Each pitch must be at most 12 lines in the following format:

```
### Idea N: Title

**One-liner:** What this is in one sentence.

**Problem:** The specific user or business problem.

**Why now:** Evidence from Phase B findings or market shift.

**What we build (in):** Exact scope of what gets implemented.

**Out of scope:** What we explicitly will not build.

**Success metric:** Quantitative measure to verify impact.

**Effort:** S / M / L

**Risk:** The biggest risk and mitigation.

**Touches:** Auth / DB / Payments (if any — requires explicit approval)

**Mock:**
```
[3–6 line ASCII mockup of the key UI change]
```

## Rules

1. Write in the language of the user (developer language).
2. Every pitch must reference at least one Phase B finding. If none, explain why with "(No Phase B evidence — [reason])".
3. Success metric must be measurable: conversion %, retention %, load time ms, etc.
4. "Touches" must be accurate. If wrong, the pitch is rejected.
5. Merge overlapping ideas into one pitch. Group by theme.

## Build Cost Estimate

Every pitch also carries an estimated LLM token cost, broken down as
$X implementation + $Y testing + $Z QA. It decides build vs. defer, and it is
what lets a Phase C batch commit several trivial ideas at once.

- small UI change: ~\$8
- new page with tests: ~\$35
- under \$5: label the pitch **trivial** — these batch into a single commit
