# A0 — Orchestrator

## Role
Lead agent of the frontend improvement loop. Manages the 11-step execution cycle, ranks findings from all agents, makes git decisions, decides when to revert, and produces RUN_LOG.md.

## Inputs
- Findings array from A1..A10 (each conforming to finding-schema.json)
- STATE.json from artifacts/frontend-loop/
- MEASUREMENTS.json from measure-frontend.sh
- Git status

## Outputs
- Ranked QUEUE.json and QUEUE_TOP.json (top 3-5 findings)
- Git commits or reverts
- RUN_LOG.md appended per iteration
- STATE.json updated
- FINAL_REPORT.md on termination

## Ranking Algorithm

priority = severity_weight x impact / effort

| Field | Range | Description |
|-------|-------|-------------|
| P0 severity_weight | 1000 | App-breaking or data-loss issue |
| P1 severity_weight | 300 | Critical UX or a11y blocker |
| P2 severity_weight | 100 | Major degredation |
| P3 severity_weight | 30 | Minor enhancement |
| impact | 1-5 | User or business impact |
| effort | 1-5 | (S=1, M=3, L=5) |

## Decision Rules

1. Max 5 findings per iteration.
2. One finding per commit — never mix two findings from different agents in one commit.
3. Conflict: higher severity wins. If same severity, higher priority wins.
4. If a fix invalidates another open finding, remove the invalidated finding from queue.
5. If verify-change.sh exits 2 (metric regressed), run: git revert --no-edit HEAD
6. If verify-change.sh exits non-zero (build/lint/test fail), run: git revert --no-edit HEAD and fix the fix_sketch.

## Git Branch Management

- Create branch: frontend-loop/<YYYY-MM-DD-HHmm>
- Each commit message: "frontend-loop: [A<N>] <short-title> (metric: <name> <before>-><after>)"
- Never merge to main, never push
- Stash user work before starting: git stash push -m "frontend-loop-stash-<timestamp>"

## RUN_LOG.md Format

```markdown
## Iteration <N> (<YYYY-MM-DD HH:mm>)

### Agent: A<N> — <Finding Title>
- Severity: P<N> (weight: <W>)
- Metric: <name> <before> -> <after> (delta: <+-x%>)
- Commit: <abbreviated_hash>
- Verdict: PASS | REVERTED | BLOCKED_BACKEND
- Duration: <seconds>s
```

## Failure Modes

- Stale git index: run git status before each audit.
- Empty findings from all agents: treat as stop condition 3.
- Blocked finding (needs backend): set status=blocked_backend, skip, log.
- Revert conflict: abort revert, log as manual-intervention-needed.
