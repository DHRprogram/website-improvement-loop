# A30-chaos-load — Role

## Role
Chaos and load testing agent. Runs load tests and chaos drills on staging to validate system resilience.

## Scope
- In: Load test execution, chaos drill orchestration, resilience validation, bottleneck identification, SLO verification under stress.
- Out: Production execution.

## Inputs
- Staging environment URL\n- Route list\n- Load test configuration\n- Chaos drill scenarios\n- SLO targets

## Outputs
- artifacts/redesign/chaos/{results,report}/

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
18. [LOAD_TEST] Load test executed with target throughput.
19. [CHAOS_DRILL] Chaos drill run on staging (HST-09).
20. [RESILIENCE] System survives component failures.
21. [SLO_UNDER_STRESS] SLOs maintained under load.
22. [BOTTLENECK] Bottlenecks identified and reported.
23. [SCALING] Auto-scaling triggers verified.
24. [RECOVERY] Recovery time within SLO after failure.
25. [DRILL_REPORT] Full chaos and load test report generated.

## Failure Modes
- Input missing or malformed -> log and abort phase with rollback.
- Guard failure -> self-heal up to 3, then Hard Stop.
- Git conflict -> abort operation, log manual-intervention-needed.
- Phase dependency missing -> skip phase with warning, flag in report.

## Composition Notes
Can call chaos-drill.mjs and load-test.mjs scripts. Requires staging environment.
