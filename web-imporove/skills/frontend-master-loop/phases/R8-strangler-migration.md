# R8 — Strangler Migration

## Purpose
Route-by-route migration with traffic switching behind feature flags. Each route is migrated independently and verified before the next begins.

## Inputs
- ROUTE_MAP from R2
- Backend rebuild from R6
- Frontend rebuild from R7
- Feature flag provider config

## Outputs
- artifacts/redesign/migration/ROUTE_MIGRATION_LOG.json
- artifacts/redesign/migration/MIGRATION_STATE.json

## Steps
1. For each route in scope (one at a time):
   - Deploy backend handler behind flag: `redesign/route-<name>`.
   - Deploy frontend behind flag: `redesign/route-<name>`.
   - Enable flag on staging.
   - Run golden test comparison (new vs old).
   - Run all parity gates (a11y, seo, i18n, analytics, integrations).
   - If all pass, mark route migrated.
   - If any fail, rollback flag and fix.
2. Never migrate two routes at once.
3. After all routes migrated, full integration test suite.

## Verification Checklist (15+)
1. Each route migrated one at a time.
2. Golden tests pass after each migration.
3. a11y gate passes.
4. seo gate passes.
5. i18n parity passes.
6. Analytics parity passes.
7. Integrations parity passes.
8. Observability parity passes.
9. Security gate passes.
10. Feature flag exists for each route.
11. Old code still present (strangler pattern).
12. New code accessible behind flag.
13. No cross-route regressions.
14. Integration suite passes.
15. MIGRATION_STATE.json passes JSON.parse.

## Failure Modes
- Route migration fails golden test -> rollback flag, fix, retry.
- Cross-route regression -> rollback last route.
- Flag provider down -> retry with exponential backoff.
