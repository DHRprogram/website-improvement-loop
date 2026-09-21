# R10 — Cleanup

## Purpose
Remove old code, archive artifacts, and write the final report. Only runs if auto-cleanup was approved in P0 (D4).

## Inputs
- All previous phase outputs
- APPROVALS.json (D4 auto-cleanup consent)

## Outputs
- artifacts/redesign/FINAL_REPORT.md

## Steps
1. Verify auto-cleanup consent from P0.
2. List old code files eligible for removal.
3. Verify no traffic routes to old code.
4. Remove old code files.
5. Archive all artifacts to final location.
6. Write FINAL_REPORT.md using final-report-template.md.
7. Set STATE.json status = "complete".

## Verification Checklist (15+)
1. Auto-cleanup consent verified.
2. Cutover verified at 100% before removal.
3. Old code eligibility reviewed.
4. No production traffic to old code.
5. Old code removed.
6. Artifacts archived.
7. FINAL_REPORT.md written.
8. All phases documented in report.
9. Preservation delta included.
10. Golden test results included.
11. Canary summary included.
12. Hard stops documented (if any).
13. Remaining work documented.
14. STATE.json set to complete.
15. Report includes recommended next actions.

## Failure Modes
- No auto-cleanup consent -> leave old code, log warning.
- Old code still receiving traffic -> abort cleanup.
- FINAL_REPORT.md template missing -> write minimal version.
