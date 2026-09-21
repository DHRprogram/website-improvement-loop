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
