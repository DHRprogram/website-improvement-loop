# STATE.md Schema

STATE.md is the loop's external memory. It survives across iterations, across
context windows, and across sessions, so it is the only thing that can be
trusted when a session ends mid-run.

Location: `artifacts/website-loop/STATE.md`

## Shape

YAML frontmatter, then a flat mirror section. The frontmatter is read by
Node; the flat section exists because `hooks/check-stop.sh` is a shell script
that must not depend on a YAML parser.

```markdown
---
loop_id: loop-20260925T081400Z
started_at: '2026-09-25T08:14:00Z'
updated_at: '2026-09-25T09:02:31Z'
active_focus: design
max_iterations: 10
min_severity: P2
iteration_count: 3
no_improvement_streak: 0
consecutive_errors: 0
stopped: false
stop_condition: none
stop_reason: ''
findings:
  open: -1
  fixed: 0
  reverted: 0
  blocked_backend: 0
baseline:
  bundle_kb: 412
  lcp_ms: 2400
  a11y_violations: 14
current:
  bundle_kb: 388
  lcp_ms: 2210
  a11y_violations: 6
deltas:
  bundle_kb: -24
  lcp_ms: -190
  a11y_violations: -8
focus_history:
  - { iteration: 1, focus: full }
  - { iteration: 2, focus: design }
lessons_learned:
  - 'Lighthouse ran in CI but not locally; the difference is a cold cache.'
  - 'Reverting F-S1-0001 restored the metric, so the fix was the cause.'
---

# Loop State

<!-- The block below is a mirror, written by formatState(). Edit the
     frontmatter through state-manager.mjs, never by hand: a hand edit that
     desynchronises the two halves makes the stop hook disagree with the
     orchestrator. -->

- iteration_count: 3
- max_iterations: 10
- open_findings: -1
- consecutive_errors: 0
- no_improvement_streak: 0
- stopped: false
```

## Field Reference

| Field | Type | Default | Meaning |
|---|---|---|---|
| `loop_id` | string | `loop-<timestamp>` | Identity of this run. Used in commit messages. |
| `started_at` | ISO-8601 | now | Never changes. |
| `updated_at` | ISO-8601 | now | Written on every save. |
| `active_focus` | enum | `full` | One of the ten focus modes. |
| `max_iterations` | int 1–1000 | 50 | Hard budget. |
| `min_severity` | P0–P3 | `P2` | Findings below this are not queued. |
| `iteration_count` | int | 0 | Completed iterations. |
| `no_improvement_streak` | int | 0 | Consecutive iterations with no metric movement. |
| `consecutive_errors` | int | 0 | Reset by any successful iteration. |
| `stopped` | bool | `false` | Set by `--stopped`; cleared by `--resume`. |
| `stop_condition` | enum | `none` | Which of the five fired. |
| `stop_reason` | string | `''` | Human-readable explanation. |
| `findings.open` | int | `-1` | Open above the severity floor. `-1` = unmeasured. |
| `findings.fixed` | int | 0 | Fixed and verified. |
| `findings.reverted` | int | 0 | Fixed, then reverted by the Regression Guard. |
| `findings.blocked_backend` | int | 0 | Needs backend work; deferred, not dropped. |
| `baseline` | map | `{}` | Metrics before the run. Never recomputed. |
| `current` | map | `{}` | Metrics now. |
| `deltas` | map | `{}` | **Derived**: `current - baseline`. Never hand-entered. |
| `focus_history` | list | `[]` | When the focus changed. |
| `lessons_learned` | list | `[]` | Append-only. |

## Invariants

1. **`deltas` is derived, never written.** `state-manager.mjs update`
   recomputes it from `baseline` and `current` on every save. A hand-entered
   delta is a stale delta, and a stale delta makes the Regression Guard pass on
   a regression.
2. **`findings.open` is `-1` until measured.** See the unmeasured sentinel in
   `stop-conditions.md`.
3. **`baseline` is immutable after init.** Re-baselining mid-run makes the run's
   own improvements invisible, which defeats the purpose of measuring them.
   Use `--set-baseline` only when starting a new loop.
4. **The two halves are written together.** `formatState()` emits the mirror
   from the same object it serialises, so they cannot drift.
5. **A missing key means default, not zero.** Absent metrics resolve to the
   documented default; absent *measurements* resolve to `null`, never `0`.
6. **STATE.md is committed.** R4 requires one revertible commit per iteration,
   and the state is what makes a revert meaningful — without it, rolling back
   the code leaves the loop claiming a fix that no longer exists.

## Reading and Writing

```sh
node scripts/state-manager.mjs init --focus=design --max-iterations 10
node scripts/state-manager.mjs read
node scripts/state-manager.mjs read --json | jq .findings.open
node scripts/state-manager.mjs update --iteration-done --finding-fixed
node scripts/state-manager.mjs update --set-metric bundle_kb:388 --set-metric lcp_ms:2210
node scripts/state-manager.mjs update --error --add-lesson "reverted: the fix caused the regression"
node scripts/state-manager.mjs update --stopped --stop-condition=iteration_cap
node scripts/state-manager.mjs update --resume
```

`update` is the only supported writer. It recomputes deltas, clamps counters to
sane ranges, deduplicates lessons, and keeps the mirror in step.
