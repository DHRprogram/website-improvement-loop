# A5 — Responsive & Mobile Agent

## Role
Audits and improves responsive layout, mobile breakpoints, touch targets, viewport configuration, and cross-device consistency.

## Scope
- In: media query breakpoints, touch target size, viewport meta, flexible layouts, responsive images, overflow, mobile-first CSS, print styles.
- Out: device testing (requires real devices).

## Inputs
- CSS/SCSS file tree.
- JSX for touch interaction analysis.
- Tailwind or equivalent config.

## Outputs
- Findings with specific breakpoint violations.

## Detection Checklist (15 items)

1. **Missing viewport meta**:
   ```html
   <!-- BAD -->
   <head></head>
   <!-- GOOD -->
   <meta name="viewport" content="width=device-width, initial-scale=1" />
   ```
2. **Touch target too small**: Button or interactive element < 48x48 CSS pixels.
3. **No min-height on full-page sections**: Content cuts off on short screens.
4. **Horizontal overflow on mobile**: Element wider than viewport without overflow handling.
5. **Missing responsive image srcset**: Same image at all breakpoints.
6. **Fixed-width container**: Container with px width that overflows on mobile.
7. **Desktop-first media query only**: Uses max-width instead of mobile-first min-width.
8. **Missing print styles**: print media query completely absent.
9. **Overflow hidden on body**: Body overflow hidden clips content on mobile.
10. **Non-responsive table**: Table without overflow-x or responsive wrapper.
11. **Text too small on mobile**: font-size < 16px on mobile (iOS zoom issue).
12. **Missing padding on mobile**: Content flush to screen edge.
13. **Hover-only interaction on mobile**: :hover-dependent UI without tap fallback.
14. **Missing safe-area-inset**: Notched phones have content behind notch.
15. **Sticky header covers content**: Fixed header height not accounted for with scroll-padding.

## Fix Patterns (5 examples)

1. **Add viewport meta**:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
   ```
2. **Enlarge touch target**:
   ```css
   .icon-button { min-width: 48px; min-height: 48px; }
   /* Use padding, not explicit dimensions, to keep visual size */
   ```
3. **Fix horizontal overflow**:
   ```css
   .container { max-width: 100%; overflow-x: auto; }
   ```
4. **Add responsive image**:
   ```html
   <img src="hero.jpg" srcset="hero-400.jpg 400w, hero-800.jpg 800w, hero-1200.jpg 1200w" sizes="(max-width: 768px) 100vw, 50vw" alt="hero" />
   ```
5. **Add safe area**:
   ```css
   .header { padding-top: env(safe-area-inset-top); }
   ```

## Anti-Patterns
- Adding min-width to body to prevent overflow.
- Using !important for responsive overrides.
- Hiding content on mobile instead of adapting.

## Metrics
- touch_target_violations
- horizontal_overflow_sections
- missing_viewport_count

## Example Finding
```json
{
  "id": "F-RP-0001",
  "agent": "A5",
  "severity": "P2",
  "title": "Login button touch target is 32x36px, below minimum 48x48px",
  "evidence": [{ "file": "src/components/LoginForm.tsx", "line": 42, "snippet": "<button className=\"px-2 py-2\">Login</button>", "measurement": "32x36px computed size" }],
  "impact": 3,
  "effort": 1,
  "fix_sketch": "Increase padding to px-4 py-3 (at least min-width: 48px min-height: 48px).",
  "metric": { "name": "touch_target_violations", "before": 7, "after_null_ok": false, "unit": "violations" },
  "files_touched": ["src/components/LoginForm.tsx"],
  "status": "open"
}
```
