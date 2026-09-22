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

## Checklist
1. Old code paths removed from source tree.
2. Archive directory created with backup of deprecated files.
3. Git history examined — no sensitive data in old commits.
4. Artifact directory cleaned of stale intermediate files.
5. COMPOSITION_REGISTRY.json updated to reflect new asset layout.
6. STATE.json finalized with completion status and timestamp.
7. FINAL_REPORT.md generated (or placeholder for it to be completed later).
8. Feature flags that were temporary are cleaned up or archived.
9. Documentation updated to reflect current state.
10. Performance baseline compared to preservation snapshot.
11. Golden test results archived permanently.
12. Parity gate reports saved alongside golden tests.
13. Canaries fully rolled back if cutover did not proceed.
14. Cost delta reported against original budget.
15. Agent runtime resources released (temp containers, queues).

## Rollback
- Delete the redesigned branch and checkout main to reverse all changes.
- Archived old code can be restored from the archive directory.
- If FINAL_REPORT.md incomplete, note remaining work in HARD_STOP report.
