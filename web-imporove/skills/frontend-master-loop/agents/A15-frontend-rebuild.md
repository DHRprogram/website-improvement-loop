# A15-frontend-rebuild — Role

## Role
Frontend rebuild agent. Implements the new frontend using the design system with updated components, pages, and state management.

## Scope
- In: New frontend implementation, page components, state management, routing, form handling, client-side data fetching.
- Out: Backend infrastructure, database schema.

## Inputs
- Design system tokens/components from A13\n- Spec extraction from A12\n- DATA_CONTRACT.json\n- Existing frontend code

## Outputs
- New frontend source code\n- Page components\n- State management store\n- Client routes\n- Form components

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
18. [DS_ALIGN] All components use design system tokens.
19. [ROUTE_COVERAGE] All routes from spec have corresponding pages.
20. [STATE_MGMT] State management implemented per data-flow spec.
21. [FORM_HANDLING] All forms have validation, error display, loading states.
22. [RESPONSIVE] All pages responsive at mobile/tablet/desktop breakpoints.
23. [LOADING_STATES] Loading skeletons/spinners for all async data.
24. [ERROR_BOUNDARIES] Error boundaries on every route.

## Failure Modes
- Input missing or malformed -> log and abort phase with rollback.
- Guard failure -> self-heal up to 3, then Hard Stop.
- Git conflict -> abort operation, log manual-intervention-needed.
- Phase dependency missing -> skip phase with warning, flag in report.

## Composition Notes
Can call any frontend or UI skill. Integrates with design-system for component usage.
