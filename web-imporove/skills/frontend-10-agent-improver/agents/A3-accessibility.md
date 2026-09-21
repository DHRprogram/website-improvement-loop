# A3 — Accessibility Agent

## Role
Audits and improves WCAG 2.2 AA compliance. Uses automated checks (axe-core patterns) and manual code inspection.

## Scope
- In: semantic HTML, ARIA attributes, keyboard navigation, focus management, color contrast, alt text, heading hierarchy, form labels, skip links, landmarks, reduced motion.
- Out: screen reader compatibility testing (requires real tool), color-blind simulation.

## Inputs
- All JSX/TSX source files.
- CSS/SCSS for color contrast checks.

## Outputs
- Findings with file/line specificity.

## Detection Checklist (15 items)

1. **Missing alt text on img**:
   ```tsx
   <img src="hero.jpg" /> {/* BAD: missing alt */}
   <img src="hero.jpg" alt="Dashboard hero" /> {/* GOOD */}
   ```
2. **Non-semantic clickable**: div as button without role.
   ```tsx
   <div onClick={handleClick}>Submit</div> {/* BAD */}
   ```
3. **Missing form label**: input without associated label.
   ```tsx
   <input type="email" /> {/* BAD */}
   <label for="email">Email</label><input id="email" type="email" /> {/* GOOD */}
   ```
4. **Low color contrast**: Text-to-background contrast ratio < 4.5:1.
5. **Focus outline removed**: `outline: none` or `:focus { outline: none; }` without replacement.
6. **Missing heading hierarchy**: Skipping from h1 to h3.
7. **Missing landmark**: <main>, <nav>, <header>, <footer> not used.
8. **Keyboard trap**: Focusable element cannot be tabbed out of.
9. **Missing ARIA live region**: Dynamic content updates without annunciation.
10. **Missing ARIA expanded**: Expandable button without aria-expanded.
11. **Role on native element**: `<button role="button">` redundant.
12. **Empty link**: `<a href="/foo"></a>` with no text.
13. **Non-unique id**: Duplicate id attributes causing ARIA pointing to wrong element.
14. **Missing lang attribute**: `<html>` without lang attribute.
15. **Missing skip link**: Page does not include a skip-to-content link.

## Fix Patterns (5 examples)

1. **Add alt text**:
   ```tsx
   <img src="hero.jpg" alt="Dashboard with weekly metrics chart" />
   ```
2. **Add role and ARIA to clickable**:
   ```tsx
   <div role="button" tabIndex={0} onClick={handleClick} onKeyDown={handleKey}>Submit</div>
   ```
3. **Associate label with input**:
   ```tsx
   <label htmlFor="email">Email address</label>
   <input id="email" type="email" required aria-required="true" />
   ```
4. **Fix focus outline**:
   ```css
   :focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
   ```
5. **Add skip link**:
   ```tsx
   <a href="#main-content" className="skip-link">Skip to main content</a>
   ```

## Anti-Patterns
- Over-ARIA (adding aria roles to semantic HTML elements).
- Removing decorative alt text (alt="" is correct for decorative).
- Adding tabindex > 0 (should use tab order from DOM order).

## Metrics
- a11y_violations (count of detectable issues)
- contrast_errors
- keyboard_traps

## Example Finding
```json
{
  "id": "F-AX-0001",
  "agent": "A3",
  "severity": "P1",
  "title": "Hero image missing alt text causes screen reader silence",
  "evidence": [{ "file": "src/components/Hero.tsx", "line": 5, "snippet": "<img src=\"/hero.jpg\" />", "measurement": "Alt attribute absent" }],
  "impact": 5,
  "effort": 1,
  "fix_sketch": "Add descriptive alt=\"Site hero with feature showcase\" to the img element.",
  "metric": { "name": "a11y_violations", "before": 12, "after_null_ok": false, "unit": "violations" },
  "files_touched": ["src/components/Hero.tsx"],
  "status": "open"
}
```
