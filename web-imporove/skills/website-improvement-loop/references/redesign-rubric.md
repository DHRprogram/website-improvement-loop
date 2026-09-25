# Redesign Rubric

A redesign is judged on one thing above all others: did the product still work
the same afterwards? Everything else is negotiable against that.

Total: 100 points. A redesign ships at **>= 85 with no dimension at 0**.

## The Nine Dimensions

| Dimension | Weight | Question |
|---|---:|---|
| Preservation fidelity | 25 | Did observable behaviour survive the migration? |
| Spec compliance | 15 | Was the agreed specification built? |
| Design system coherence | 10 | Does the new UI follow one system? |
| Backend correctness | 15 | Is the server side right, under the same contract? |
| Frontend quality | 10 | Is the client implementation sound? |
| Accessibility | 5 | Is it usable with a keyboard and a screen reader? |
| Performance | 5 | Is it no slower? |
| Migration safety | 10 | Could each step be reversed? |
| Rollback readiness | 5 | Can we go back, quickly and for certain? |

### Preservation Fidelity — 25

The heaviest weight, deliberately. A redesign that looks better and silently
drops a feature is a net loss, however good the screenshots.

Checks:
- Every route in the pre-migration contract still resolves, to the same class of
  content.
- Every form still submits the same fields and still accepts the same input.
- Auth still gates the same routes, for the same roles.
- No user-visible string was dropped without an explicit decision.
- Redirects are correct: an old URL lands somewhere real, never a 404.
- Data written before the migration is still readable after it.

Each failed check costs 5 points. A lost feature is automatic disqualification
regardless of score elsewhere.

### Spec Compliance — 15

Measured against the signed spec, not against the implementation. The spec is
the contract; drift in either direction counts.

- Every "in scope" item shipped: 1 point each.
- Every "out of scope" item stayed out: 1 point each.
- Deviations are written down and approved: 2 points each, or 0 if undeclared.

### Design System Cohesence — 10

- One spacing scale, no off-scale values: 3
- One type scale, limited weights: 2
- Colour used by role, not by hex literal: 2
- Component anatomy consistent across the app: 2
- The new system is documented: 1

### Backend Correctness — 15

- The data contract is frozen and unchanged: 5
- Response shapes match the frozen contract exactly: 4
- Error responses keep their original status codes and shapes: 3
- No N+1 introduced on an existing path: 2
- Migrations are reversible: 1

### Frontend Quality — 10

- No state derived in an effect that could be derived during render: 3
- No stale closure on a live value: 2
- Keys are stable, not array indices, on reorderable lists: 2
- Errors surface to the user, not only to the console: 2
- Unmount cleanup where it is needed: 1

### Accessibility — 5

- Zero critical axe violations on migrated routes: 2
- Full keyboard path through every migrated flow: 2
- Focus is managed on route change and modal open/close: 1

This dimension is only 5 points because a11y is a **gate, not a score**: one
critical violation blocks the cutover outright, whatever the total.

### Performance — 5

- Bundle did not grow against baseline: 2
- LCP did not regress: 2
- No new render-blocking resource: 1

### Migration Safety — 10

- Each step independently revertible: 3
- Feature flags default to the old path: 2
- Shadow/dual-run comparison where data is written: 2
- Rollback tested, not just documented: 3

### Rollback Readiness — 5

- The rollback command is written down and has been run once: 2
- Recovery time is known and within SLA (< 5 min for a revert): 2
- Someone other than the author has read the plan: 1

## Verdict

| Score | Verdict |
|---|---|
| >= 85, no dimension at 0, no critical a11y violation | **Ship** |
| 70–84 | **Not ready** — iterate, or ship dark with flags off |
| 50–69 | **Failed** — the migration is doing more harm than the redesign |
| < 50 | **Revert** and start over with a narrower scope |

A 0 in any dimension is disqualifying regardless of total. A redesign that
scores 0 on preservation has not improved anything, however it scores elsewhere.

## Scoring Procedure

1. Freeze the pre-migration contract: `data-contract-freeze.mjs`.
2. Capture behaviour: `preservation-capture.mjs`.
3. Migrate under flags: `migrate-route.mjs`.
4. Run the golden tests: `golden-test-runner.mjs`.
5. Score each dimension, citing the artefact that justifies the number.
6. Any dimension you cannot evidence scores 0. An unevidenced dimension is not
   a pass; the whole point of the rubric is that it is falsifiable.

## Anti-Patterns This Rubric Rejects

| Anti-pattern | Why it fails |
|---|---|
| "It's a total rewrite" | Preservation is measured on behaviour, not on code shape. |
| Screenshot comparison as evidence | A screenshot proves appearance, not behaviour. |
| Raising the score by deleting a check | The removed check is the regression. |
| Shipping with flags on but unverified | Unverified is not dark. |
| Treating a11y as a 5-point tradeoff | It is a gate. |
