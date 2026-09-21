# A14-backend-rebuild — Role

## Role
Backend rebuild agent. Implements the new backend with data contract compliance, API routes, business logic, and database access.

## Scope
- In: New backend implementation, API route generation, business logic, database access layer, authentication, authorization, middleware.
- Out: Frontend UI changes, design system implementation.

## Inputs
- DATA_CONTRACT.json from R3\n- Spec extraction from A12\n- Route list\n- Existing backend code

## Outputs
- New backend source code\n- API routes\n- Database access layer\n- auth/middleware implementation

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
18. [DATA_CONTRACT_ALIGN] All endpoints match DATA_CONTRACT.json.
19. [API_TESTED] Every new endpoint tested (unit+integration).
20. [AUTH_IMPL] Authentication and authorization implemented per spec.
21. [ERROR_HANDLING] Structured error responses across all endpoints.
22. [INPUT_VALIDATION] All inputs validated at boundary.
23. [RATE_LIMIT] Rate limiting implemented per plan.
24. [LOG_SETUP] Structured logging configured.

## Failure Modes
- Input missing or malformed -> log and abort phase with rollback.
- Guard failure -> self-heal up to 3, then Hard Stop.
- Git conflict -> abort operation, log manual-intervention-needed.
- Phase dependency missing -> skip phase with warning, flag in report.

## Composition Notes
Can call any backend or API skill. Integrates with migration-router for strangler pattern.
