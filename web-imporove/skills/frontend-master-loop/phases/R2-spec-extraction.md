# R2 — Spec Extraction

## Purpose
Extract data contracts, component tree, route map, API endpoints, and design tokens from the existing codebase.

## Inputs
- HTML sources from R1
- Source code tree
- Route configuration files

## Outputs
- artifacts/redesign/specs/DATA_CONTRACT_SPEC.json
- artifacts/redesign/specs/COMPONENT_TREE.json
- artifacts/redesign/specs/ROUTE_MAP.json
- artifacts/redesign/specs/DESIGN_TOKEN_SPEC.json
- artifacts/redesign/specs/API_ENDPOINTS.json

## Steps
1. Extract route map from router config (next.config, vite.config, react-router, etc).
2. Extract API endpoints from source (fetch/axios calls, route handlers).
3. Extract component tree from JSX/TSX imports.
4. Extract design tokens from CSS variables, Tailwind config, theme files.
5. Extract data contracts from type definitions, GraphQL schemas, Zod schemas.
6. Extract i18n keys from translation files.
7. Extract analytics events from instrumentation code.

## Verification Checklist (15+)
1. ROUTE_MAP has all routes from scope.
2. API_ENDPOINTS has all fetch/axios calls.
3. COMPONENT_TREE depth >= 3 levels.
4. DESIGN_TOKEN_SPEC has colors, spacing, typography, shadows.
5. DATA_CONTRACT_SPEC has all type definitions.
6. i18n keys extracted for each locale.
7. Analytics events cataloged.
8. All JSON files pass JSON.parse.
9. Route config file found.
10. API host/baseUrl documented.
11. Auth methods documented.
12. Middleware chain extracted.
13. SEO meta patterns extracted.
14. Form schemas extracted.
15. File count per directory documented.

## Failure Modes
- No router config found -> infer from file tree.
- No type definitions found -> extract from runtime usage.
- No i18n files found -> single-locale assumed.
