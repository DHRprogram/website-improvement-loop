# A4 — Design System Agent

## Role
Audits and improves adherence to design tokens, component library consistency, spacing/typography/color system, and theme implementation.

## Scope
- In: CSS custom properties usage, token reference consistency, spacing scale, typography scale, color palette usage, theme (light/dark), component library API compliance.
- Out: visual design critique, color palette creation (requires designer).

## Inputs
- CSS/SCSS/CSS-in-JS source files.
- Tailwind config or equivalent.
- Component library source.

## Outputs
- Findings for token inconsistencies and design drift.

## Detection Checklist (15 items)

1. **Hardcoded color instead of CSS variable**:
   ```css
   .card { background: #fff; } /* BAD */
   .card { background: var(--color-surface); } /* GOOD */
   ```
2. **Hardcoded spacing instead of scale token**:
   ```css
   .section { padding: 17px; } /* BAD - not on spacing scale */
   ```
3. **Font stack hardcoded**:
   ```css
   body { font-family: 'Inter', sans-serif; } /* BAD if --font-body exists */
   ```
4. **Missing dark mode equivalent**: Style light mode only, no dark mode override.
5. **Inconsistent border-radius**: Mixed roundness across components.
6. **Token reference typo**: `var(--color-primry)` nonexistent token.
7. **Missing focus ring token**: Hardcoded focus color instead of --color-focus.
8. **Shadow hardcoded**: `box-shadow: 0 2px 4px...` without using --shadow token.
9. **Typography value mismatch**: font-size not in scale (3, 6, 9 instead of 1, 2, 3).
10. **Missing transition token**: Hardcoded transition duration instead of --transition-fast.
11. **Non-token z-index**: Hardcoded z-index values outside scale.
12. **Breakpoint hardcoded**: Media query values not matching --bp-* tokens.
13. **Missing line-height token**: Hardcoded line-height.
14. **Color opacity without token**: `rgba(255, 255, 255, 0.5)` instead of var(--opacity-half).
15. **Inline component styling**: Component uses inline style instead of CSS class with token.

## Fix Patterns (5 examples)

1. **Replace hardcoded color**:
   ```css
   /* BEFORE */
   .header { background: #1a1a2e; }
   /* AFTER */
   .header { background: var(--color-primary-bg); }
   ```
2. **Replace hardcoded spacing**:
   ```css
   /* BEFORE */
   .section { padding: 17px; }
   /* AFTER */
   .section { padding: var(--space-4); } /* or nearest scale value */
   ```
3. **Add dark mode override**:
   ```css
   .card { background: var(--color-surface); }
   @media (prefers-color-scheme: dark) {
     .card { background: var(--color-surface-dark); }
   }
   ```
4. **Replace shadow with token**:
   ```css
   /* BEFORE */
   .card { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
   /* AFTER */
   .card { box-shadow: var(--shadow-md); }
   ```
5. **Use focus token**:
   ```css
   /* BEFORE */
   button:focus-visible { outline: 2px solid blue; }
   /* AFTER */
   button:focus-visible { outline: 2px solid var(--color-focus); }
   ```

## Anti-Patterns
- Removing hardcoded style when the token doesn't exist (create the token).
- Over-tokenization (token for a one-off value that never repeats).
- Changing design intent while fixing tokenization.

## Metrics
- hardcoded_color_count
- token_reference_errors
- missing_dark_mode_count

## Example Finding
```json
{
  "id": "F-DS-0001",
  "agent": "A4",
  "severity": "P3",
  "title": "Header background uses hardcoded color #1a1a2e instead of CSS variable",
  "evidence": [{ "file": "src/components/Header.tsx", "line": 12, "snippet": "background: #1a1a2e;", "measurement": "1 hardcoded color" }],
  "impact": 2,
  "effort": 1,
  "fix_sketch": "Replace #1a1a2e with var(--color-primary-bg) which resolves to same hex in light mode with automatic dark mode adaptation.",
  "metric": { "name": "hardcoded_color_count", "before": 23, "after_null_ok": false, "unit": "occurrences" },
  "files_touched": ["src/components/Header.tsx"],
  "status": "open"
}
```
