# A8 — Motion & Micro-interaction Agent

## Role
Audits and improves animation performance, micro-interactions, reduced-motion support, animation timing, and deliberate motion design.

## Scope
- In: CSS transitions, CSS animations, JS animations, reduced-motion media query, animation performance (will-change, GPU-accelerated properties), animation library usage, intentional micro-interactions.
- Out: removing animations entirely (unless harmful), animation library choice.

## Inputs
- CSS/SCSS for animation definitions.
- Component code for animation triggers.

## Outputs
- Findings for performance, accessibility, or quality.

## Detection Checklist (15 items)

1. **Missing prefers-reduced-motion**: Animation with no reduced-motion alternative.
   ```css
   /* BAD */
   .fade-in { animation: fadeIn 0.3s; }
   /* GOOD */
   @media (prefers-reduced-motion: no-preference) {
     .fade-in { animation: fadeIn 0.3s; }
   }
   ```
2. **Animating layout properties**: top/left/width/height instead of transform.
3. **Missing will-change on heavy animation**: Scrolling parallax or fixed bg without will-change.
4. **Animation too long**: Duration > 500ms for functional animation.
5. **No transition on interactive element**: Button hover without transition.
6. **Non- GPU accelerated property**: Animate opacity but not transform (when transform helps).
7. **Missing @keyframes naming convention**: Inconsistent animation naming.
8. **Animation repaints on every frame**: Property that triggers layout causing repaints.
9. **Missing animation on page load**: Page load feels abrupt with no fade/in.
10. **Stagger delay missing**: List items animate identically at same time instead of staggered.
11. **No exit animation**: Element disappears instantly without fade.
12. **Flash of content before animation**: Content visible before animation starts.
13. **Animation infinite loop**: Spinner or load animation runs indefinitely without stopping.
14. **Missing transition timing function**: All transitions use default ease instead of deliberate curve.
15. **Animation blocking interaction**: Locked UI during animation (pointer-events set incorrectly).

## Fix Patterns (5 examples)

1. **Add reduced-motion**:
   ```css
   @media (prefers-reduced-motion: no-preference) {
     .slide-in { animation: slideIn 0.3s ease-out; }
   }
   @media (prefers-reduced-motion: reduce) {
     .slide-in { opacity: 1; transform: none; }
   }
   ```
2. **Replace layout animation with transform**:
   ```css
   /* BEFORE */
   .slide { left: 100px; transition: left 0.3s; }
   /* AFTER */
   .slide { translateX: 100px; transition: translateX 0.3s; }
   ```
3. **Add will-change**:
   ```css
   .parallax-layer { will-change: transform; }
   ```
4. **Add transition to interactive**:
   ```css
   .button { transition: background-color 0.2s, transform 0.2s; }
   .button:hover { transform: translateY(-1px); }
   ```
5. **Add exit animation**:
   ```tsx
   <div className={isVisible ? 'fade-in' : 'fade-out'}>{content}</div>
   ```

## Anti-Patterns
- Removing all animations for reduced-motion (should provide alternative).
- will-change on every element (causes memory pressure).
- Animating too many properties simultaneously for performance.

## Metrics
- reduced_motion_violations
- layout_animations
- animation_performance_score (1-5)

## Example Finding
```json
{
  "id": "F-MT-0001",
  "agent": "A8",
  "severity": "P2",
  "title": "Slide-in animation lacks prefers-reduced-motion fallback",
  "evidence": [{ "file": "src/components/Sidebar.tsx", "line": 18, "snippet": "animation: slideIn 0.3s ease-out;", "measurement": "No media query wrapper" }],
  "impact": 3,
  "effort": 1,
  "fix_sketch": "Wrap animated transitions in prefers-reduced-motion: no-preference query. Provide instant reveal for reduced-motion.",
  "metric": { "name": "reduced_motion_violations", "before": 5, "after_null_ok": false, "unit": "violations" },
  "files_touched": ["src/components/Sidebar.tsx"],
  "status": "open"
}
```
