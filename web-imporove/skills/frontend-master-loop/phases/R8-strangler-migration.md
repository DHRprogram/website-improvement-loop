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

## Checklist
1. Strangler proxy configured with traffic routing rules.
2. Route-by-route mapping from legacy to new implemented.
3. Feature flags control traffic direction per route.
4. Session persistence maintained during cutover.
5. Cache invalidation coordinated between old and new systems.
6. Redirects configured for migrated routes (SEO safe).
7. Load balanced between legacy and new instances.
8. Metrics collected separately for old vs new route serving.
9. Synthetic monitoring validates both paths simultaneously.
10. Rollback procedure tested for individual route migration.
11. DNS TTL reduced ahead of cutover (TTL < 60s).
12. Rate limiter shared between legacy and new instances.
13. Audit log captures which version served each request.
14. Migration progress tracked in STATE.json phase status.
15. All routes successfully migrated or explicitly deferred.

## Rollback
- For any single route: flip its feature flag, routing reverts to legacy instantly.
- Full rollback: set all stragger flags to legacy, wait for DNS propagation.
- If both old and new have bugs on same route, deploy hotfix to legacy first.
