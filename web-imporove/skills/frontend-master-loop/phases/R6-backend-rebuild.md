# R6 — Backend Rebuild

## Purpose
Rebuild backend routes using strangler pattern or greenfield approach while preserving data contract from R3.

## Inputs
- API_ENDPOINTS.json from R2
- DATA_CONTRACT_FROZEN from R3
- Backend source code

## Outputs
- New backend files (on redesign branch)
- artifacts/redesign/backend/ROUTE_MIGRATION_LOG.json

## Steps
1. For each API endpoint, create backend handler:
   - Implement request parsing and validation.
   - Implement business logic (mirror existing).
   - Implement response formatting.
   - Unit test each handler.
2. Run data contract guard after each route.
3. Run preservation comparisons.
4. Log each route as migrated.

## Verification Checklist (15+)
1. Every endpoint from R2 now has a new implementation.
2. Request shapes match data contract.
3. Response shapes match data contract.
4. Status codes match existing API.
5. Auth/security controls mirrored.
6. Rate limiting preserved.
7. Unit tests pass for each handler.
8. Data contract drift guard passes.
9. No production DB touch (guard).
10. Error handling matches (same status codes + messages).
11. Input validation preserved.
12. Logging/monitoring hooks included.
13. CORS setup preserved.
14. Content-type headers preserved.
15. All handlers can be toggled via feature flag.

## Failure Modes
- Complex business logic -> map all branches, test each.
- Missing documentation -> reverse engineer from existing code.
- Data contract drift detected -> HST-04.
