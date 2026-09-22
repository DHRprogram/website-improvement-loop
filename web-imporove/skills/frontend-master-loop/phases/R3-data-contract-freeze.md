# R3 — Data Contract Freeze

## Purpose
Pin the database schema and API shape. Write data contract document. Guard against drift through the rest of the redesign.

## Inputs
- DATA_CONTRACT_SPEC.json from R2
- Database URL (staging)
- API endpoint definitions

## Outputs
- artifacts/redesign/data-contract/DATA_CONTRACT_FROZEN.json
- artifacts/redesign/data-contract/SCHEMA_SNAPSHOT.sql (if relational)
- artifacts/redesign/data-contract/API_SHAPE.yaml

## Steps
1. Snapshot current DB schema (psql --schema-only or sqlite3 .schema).
2. Catalog all tables, columns, types, constraints, indexes, foreign keys.
3. Catalog all API endpoints: method, path, request/response shapes, status codes.
4. Write frozen data contract document.
5. Install guard: no-schema-change.sh is now active.
6. Any PR that changes DB schema or API contract without re-freeze is blocked.
7. Log R3 completion.

## Verification Checklist (15+)
1. Every table in public schema cataloged.
2. Every column typed and nullable documented.
3. Primary keys identified for every table.
4. Foreign key relationships mapped.
5. All API endpoints cataloged with method + path.
6. Request body shape documented for POST/PUT/PATCH.
7. Response shape documented for every endpoint.
8. Status codes documented.
9. Auth requirements per endpoint documented.
10. Rate limits documented (if any).
11. Database enum values documented.
12. Indexes documented.
13. SCHEMA_SNAPSHOT.sql passes `psql -f` (no syntax errors).
14. API_SHAPE.yaml passes yaml validation.
15. DATA_CONTRACT_FROZEN.json passes JSON.parse.

## Failure Modes
- DB unreachable -> use R2 extracted schema, log warning.
- API shape ambiguous -> document known routes, flag unknowns.
- Schema changes during redesign -> HST-04 if guard detects drift.

## Checklist
1. Full database schema exported from staging.
2. API request/response schemas documented per endpoint.
3. Migration scripts written (up + down) for any pending changes.
4. Data contract diffed against baseline — zero unexpected drift.
5. Schema locked via migration constraint or feature flag.
6. API versioning pinned; breaking changes rejected.
7. Sample payloads validated against schema.
8. Backward compatibility audit passed for all public endpoints.
9. Contract violations would cause build failure (CI integration).
10. Rollback migration verified independently.
11. No DDL changes approved without DBA sign-off.
12. Index strategies documented for performance-sensitive tables.
13. Foreign key constraints verified for referential integrity.
14. Enum/value-set changes reviewed for backward compatibility.
15. Data contract frozen file committed to redesign branch.

## Rollback
- Unfreeze by running rollback migration (down script).
- Restore previous schema version from pre-R3 backup.
- If rollback migration fails, restore from database backup and halt with HST-04.
