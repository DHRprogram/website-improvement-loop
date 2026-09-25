# Priority Formula

Every finding gets one number. That number decides what the loop works on next,
so the formula is fixed, public, and never adjusted to favour a convenient
result.

## The Formula

```
priority = severity_weight × impact ÷ effort
```

The result is a score, not a rank. Scores are comparable across agents, runs,
and iterations because all three inputs come from fixed tables below.

## Severity Weight

| Severity | Weight | Meaning |
|---|---:|---|
| P0 | 1000 | Data loss, auth bypass, money moved wrong, site down for everyone |
| P1 | 300 | Core task broken for a large group, no workaround |
| P2 | 100 | Core task degraded, workaround exists but costs time |
| P3 | 30 | Polish, consistency, latent risk |

P0 dominates by design. A P0 with `effort=5` scores 200; a P3 with `effort=1`
scores 30. No amount of cheapness lets a cosmetic issue outrank a data-loss
bug, and that is intentional.

## Impact (1–5)

How many people this hurts, and how hard.

| Value | Meaning |
|---:|---|
| 1 | One user, cosmetic, or a hypothetical path nobody reaches |
| 2 | A narrow slice of users, or frequent users hitting it once |
| 3 | A common path for a meaningful share of traffic |
| 4 | Most users hit it, or a revenue/retention path is damaged |
| 5 | Everyone, every session, or the product cannot be used |

## Effort (1–5)

| Value | Size | Typical shape |
|---:|---|---|
| 1 | S | Single file, no new deps, no test rewrite. Hours. |
| 3 | M | A few files, or a test suite needs new cases. About a day. |
| 5 | L | Cross-cutting, migration, or new infrastructure. Days. |

The scale is S=1, M=3, L=5. There is no 2 or 4 — the middle is deliberately
vague, and splitting it invents precision the estimate does not have.

## Worked Examples

| Finding | Sev | Impact | Effort | Score | Reading |
|---|---|---:|---:|---:|---|
| Checkout double-charges on retry | P0 | 5 | 3 | 1667 | First. Nothing else matters until money is correct. |
| Session survives logout | P0 | 4 | 1 | 4000 | Highest score in the queue. P0/impact 4, and it is one line. |
| Button colour fails contrast | P2 | 3 | 1 | 300 | Cheap and visible, but not blocking anyone. |
| Whole design system drifts | P2 | 4 | 5 | 80 | Real reach, too expensive to do now. Correctly deferred. |
| Hero image 2.4 MB on mobile | P1 | 4 | 1 | 1200 | Outranks most P2s despite being "just performance". |
| 40 unused exports | P3 | 2 | 3 | 20 | Bottom of the queue. Good first cleanup, poor use of an iteration. |

Read the last two rows together. A P1 that is one line of work outranks a P2
that takes a week. Severity is the leading term, but effort is a real divisor
and the loop will spend an iteration on the cheap P1 first.

## Ties and Ordering

Ties are broken in this order, highest first:

1. Higher severity.
2. Higher impact.
3. Lower effort.
4. Files already touched this iteration — batching a second change into a file
   the loop is already editing is cheaper than opening a new one.
5. Agent id, ascending. Deterministic, so two runs over the same findings
   produce the same queue.

Rule 4 is why the queue is a list and not a set: order carries information.

## The Five-Finding Cap

Each iteration takes at most **five** findings from the top of the queue
(`MAX_FINDINGS_PER_ITERATION`). Two reasons, both practical:

- Five fixes in five files is one reviewable, revertible commit. Fifty is not.
- More than five means later fixes were chosen without seeing the effect of the
  earlier ones. The loop stops, measures, and re-ranks with real numbers.

If the queue holds twelve P2s, the loop does eleven P2s over three iterations.
It does not one-shot the whole queue.

## Worked Queue

Given these three findings:

```
F-S1-0001  P0  checkout double-charge   impact 5  effort 3  -> 1667
F-S4-0002  P1  2.4 MB hero on mobile    impact 4  effort 1  -> 1200
F-S3-0003  P2  low-contrast button      impact 3  effort 1  ->  300
```

The iteration takes all three, in that order, and the commit message records
the ranking so a reviewer can see the loop was not arbitrary.

## Why Not a Weighted Sum

A weighted sum (`0.5×severity + 0.3×impact + 0.2×effort`) lets a large impact
buy down a P0. `0.5×1000 + 0.3×1 + 0.2×1` puts a total data-loss bug below a
medium-impact P3. Multiplication does not: severity is a gate, then impact and
effort order what survives the gate.

## What Changes the Score

Only new evidence. Not:

- how interesting the bug is
- which agent found it (S1 is not privileged)
- how long it has been open
- how easy it would be to demo

A finding's score changes when its severity, impact, or effort is
**re-measured**, and the reason is recorded in the finding. Editing a score to
move a card is the one thing the Regression Guard treats as a regression.
