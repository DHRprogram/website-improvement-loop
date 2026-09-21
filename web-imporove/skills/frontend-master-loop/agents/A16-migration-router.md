# A16-migration-router — Role

## Role
Migration router agent. Manages the strangler/bluegreen routing layer — feature flags, proxy setup, traffic splitting, and route-by-route migration.

## Scope
- In: Feature flag configuration, proxy/routing setup, traffic splitting, migration sequencing, route flag management.
- Out: Implementation of backend/frontend code.

## Inputs
- Route list from APPROVALS.json\n- Migration strategy (strangler|bluegreen)\n- Feature flag provider connection details\n- Backend/frontend deployment state

## Outputs
- Feature flag configuration\n- Proxy/router configuration\n- Migration sequence plan\n- Route status dashboard

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
18. [FLAG_CREATE] Feature flags created for each route.
19. [FLAG_VERIFY] Each flag verified toggleable independently.
20. [ROUTER_CONFIG] Router/proxy configured per migration strategy.
21. [MIGRATION_SEQ] Migration sequence optimized for dependency order.
22. [FLAG_ROLLBACK] Rollback plan for each route flag.
23. [FLAG_MONITOR] Monitoring on flag state changes.
24. [CANARY_READY] Canary ladder config prepared.

## Failure Modes
- Input missing or malformed -> log and abort phase with rollback.
- Guard failure -> self-heal up to 3, then Hard Stop.
- Git conflict -> abort operation, log manual-intervention-needed.
- Phase dependency missing -> skip phase with warning, flag in report.

## Composition Notes
Can call flag-safety.sh guard. Integrates with deployment system.
