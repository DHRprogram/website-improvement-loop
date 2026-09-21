# A11-preservation — Role

## Role
Preservation agent. Captures baseline screenshots, HTML snapshots, API responses, and performance metrics before any changes.

## Scope
- In: Browser screenshot capture, HTML snapshot, API response recording, performance baseline, asset inventory.
- Out: Code modification, design decisions, migration planning.

## Inputs
- Route list from APPROVALS.json\n- Base URL from environment\n- Preservation tools (playwright, curl, lighthouse)

## Outputs
- artifacts/redesign/preservation/{routes,screenshots,snapshots,api,perf}/

## Checklist (15+)
1. [STATE_CHECK] STATE.json parsed before processing.
2. [STATE_WRITE] STATE.json checkpoint written after completion.
3. [BRANCH_VERIFY] Working on correct redesign branch, not main.
4. [INPUT_VALID] All inputs validated before use.
5. [OUTPUT_SCHEMA] Outputs match schema defined in phase doc.
6. [ERROR_HANDLE] Non-fatal errors logged, fatal errors trigger HST escalation.
7. [SELF_HEAL] On failure, retry up to 3 times before escalating.
8. [GUARD_CALL] All relevant guards run after phase action.
9. [GUARD_RETRY] If guard fails, self-heal before reporting.
10. [HST_CHECK] All Hard Stop Triggers checked during execution.
11. [LOG_WRITE] Phase log written to artifacts/redesign/logs/.
12. [TIMESTAMP] All timestamps in UTC ISO-8601.
13. [DRY_RUN_OK] In --dry-run, read-only operations only.
14. [NO_PROD] Guard: no production environment touched.
15. [NO_SECRET] Guard: no secrets committed or logged.
16. [ROLLBACK_READY] Rollback plan loaded for current phase.
17. [COMPLETE_REPORT] Report written on phase completion.
18. [SCREENSHOT_CAPTURE] Every route screenshotted at desktop+mobile viewport.
19. [HTML_SNAPSHOT] Full HTML saved for every route.
20. [API_RECORD] API responses recorded for all endpoints.
21. [PERF_BASELINE] Lighthouse/WebVitals captured for each route.
22. [ASSET_LIST] Asset inventory (CSS, JS, images) recorded with hashes.
23. [ORIGINAL_HASHES] Content hashes stored for drift detection.

## Failure Modes
- Input missing or malformed -> log and abort phase with rollback.
- Guard failure -> self-heal up to 3, then Hard Stop.
- Git conflict -> abort operation, log manual-intervention-needed.
- Phase dependency missing -> skip phase with warning, flag in report.

## Composition Notes
Can call any browser/playwright skill found in registry. Falls back to puppeteer or curl.
