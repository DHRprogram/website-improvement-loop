# Stop Conditions

The loop runs unattended. It therefore needs a stopping rule that is decided
before the run starts, not one invented when the run gets boring.

## The Five Primary Conditions

`hooks/check-stop.sh` evaluates these in order and stops at the first match.

| # | Condition | Test | Why it exists |
|---|---|---|---|
| 1 | STOP sentinel | `artifacts/website-loop/STOP` exists | A human asked it to stop. Nothing outranks this. |
| 2 | Iteration cap | `iteration_count >= max_iterations` | A hard budget, so cost is bounded even if work keeps appearing. |
| 3 | Nothing in scope | `open_findings == 0` | The queue above `min_severity` is empty; there is nothing left to do. |
| 4 | Plateau | `no_improvement_streak >= 5` | Five iterations produced no metric movement. More iteration is not producing more value. |
| 5 | Repeated failure | `consecutive_errors >= 3` | Three failures in a row means something is broken, not that there is work left. |

## Exit Codes

| Code | Meaning | Effect |
|---:|---|---|
| 0 | Stop | Claude ends the turn. |
| 2 | Continue | Claude must keep working. The reason goes to stderr. |

Any other code from the check script is treated as a failure to decide, and
the loop **fails open** — exit 0. A guard that cannot parse its own state must
not wedge the session. The failure is still logged so a broken state file is
visible rather than silent.

## The Unmeasured Sentinel

`open_findings` is `-1` on a fresh state, meaning *not yet measured*.

Zero would mean "measured, and nothing is open". On a fresh state that is
indistinguishable from a finished loop, so the hook would declare victory
before a single agent had run. The condition is therefore:

```sh
[ "$OPEN" -ge 0 ] && [ "$OPEN" -eq 0 ]
```

A negative count is not an empty queue. It is an unmeasured one, and it does
not stop the loop.

## Per-Focus Stop Conditions

`focus-resolver.mjs` emits a `stop_conditions` block. A focus mode tightens the
primary conditions; it never loosens them.

| Mode | Primary metric | Severity floor | Stop threshold | Extra stop rule |
|---|---|---|---|---|
| full | weighted_findings_open | P2 | 5 iterations, no improvement | also stops on 3 consecutive iterations with zero new findings |
| design | design_system_violations | P2 | 3 iterations, no improvement | stops when violations stop decreasing for 3 runs |
| bugs | p0_p1_open | P1 | 3 iterations, no improvement | stops immediately if a P0 reappears after being fixed |
| perf | perf_regressions | P2 | 4 iterations, no improvement | stops if bundle grows for 2 consecutive runs |
| a11y | a11y_violations | P2 | 3 iterations, no improvement | stops when axe violation count reaches 0 |
| security | security_findings_open | P1 | 3 iterations, no improvement | stops if any P0 security finding appears; a human is required |
| seo | seo_defects | P3 | 4 iterations, no improvement | stops when the defect list is empty |
| frontend | frontend_quality_score | P2 | 4 iterations, no improvement | stops on 2 consecutive build failures |
| backend | backend_findings_open | P2 | 4 iterations, no improvement | stops if migration state becomes ambiguous |
| redesign | preservation_delta | P2 | 6 iterations, no improvement | never stops on metrics alone if a cutover is pending; requires a human |

## Rules

1. **The cap always applies.** A focus mode may lower the iteration budget; it
   can never raise it above `max_iterations`.
2. **A human may always stop.** Writing `STOP` works at any moment, including
   mid-iteration. It is checked first for exactly that reason.
3. **Resume is explicit.** `/web-improvement-loop:stop` writes the sentinel;
   `/web-improvement-loop:focus` or `state-manager.mjs update --resume`
   removes it. There is no automatic recovery.
4. **Stopping is not failure.** Exit 0 with a reason is a normal outcome, and
   the reason is written into STATE.md and the final report.
5. **No metric is not a pass.** A condition that would need a metric the project
   cannot measure is reported as unmeasured, and the loop keeps running. It
   never converts a missing measurement into a green result.
