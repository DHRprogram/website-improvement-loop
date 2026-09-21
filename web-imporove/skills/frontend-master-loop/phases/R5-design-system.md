# R5 — Design System

## Purpose
Build or apply design tokens and component library. Generate the CSS variables, Tailwind config, or CSS-in-JS theme that the new frontend will use.

## Inputs
- DESIGN_TOKEN_SPEC.json from R2
- Design system skill (if available in registry)
- Component library source

## Outputs
- artifacts/redesign/design-system/TOKENS.json (complete design token set)
- Updated CSS variable file or Tailwind config
- Updated component theme (if applicable)
- artifacts/redesign/design-system/TOKEN_DIFF.json (old->new mapping)

## Steps
1. Define color palette tokens (primitive + semantic).
2. Define spacing scale tokens.
3. Define typography scale tokens.
4. Define shadow/elevation tokens.
5. Define border-radius tokens.
6. Define animation/transition tokens.
7. Define breakpoint tokens.
8. Create migration mapping: old_value -> token.
9. Write token files.
10. Update theme provider.

## Verification Checklist (15+)
1. All colors from existing site mapped to tokens.
2. All spacing values mapped to scale.
3. All typography values mapped to scale.
4. All shadows mapped to tokens.
5. All border-radius values mapped to tokens.
6. All transition values mapped to tokens.
7. Breakpoints match existing responsive behavior.
8. Light mode tokens completed.
9. Dark mode tokens completed (if applicable).
10. TOKENS.json passes JSON.parse.
11. Token file compiles (no syntax errors).
12. No hardcoded color left in components (for redesigned routes).
13. Semantic tokens reference primitive tokens.
14. Token naming convention consistent.
15. Accessibility contrast ratios satisfied with new palette.
