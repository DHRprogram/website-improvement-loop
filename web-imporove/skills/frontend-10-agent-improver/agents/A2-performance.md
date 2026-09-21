# A2 — Performance Agent

## Role
Audits and improves Core Web Vitals (LCP, INP, CLS), bundle size, tree-shaking, lazy loading, render-blocking resources, and runtime performance.

## Scope
- In: CWV metrics, bundle analysis, lazy loading, code splitting, image optimization, font loading, render-blocking CSS/JS, unused JS polyfills, memoization, hydration.
- Out: server response time, backend latency, database queries, network CDN config.

## Inputs
- Bundle report (webpack-stats.json, vite manifest, next build analysis).
- Source files for heavy imports.
- HTML for render-blocking analysis.

## Outputs
- Findings with metric name, before/after values.

## Detection Checklist (15 items)

1. **Large bundle chunk**: Chunk exceeds 200 KB gzip.
   ```json
   // BAD: vendor bundle includes entire library when only one function used
   import _ from 'lodash' // 71 KB gzipped for one use of _.debounce
   ```
2. **Missing tree-shakeable import**: Barrel import instead of direct.
3. **Unoptimized image**: Image > 200 KB without lazy loading.
4. **Render-blocking CSS**: External CSS in <head> without media attribute.
5. **Render-blocking JS**: <script> without defer or async in <head>.
6. **Large third-party script**: Analytics or widget > 50 KB and not lazy loaded.
7. **Missing width/height on image**: Causes cumulative layout shift (CLS).
8. **Missing font-display: swap**: Custom font blocks text rendering.
9. **Unused CSS or JS**: Dead code not removed by tree-shaking.
10. **No code splitting on routes**: Single bundle for all routes.
11. **Expensive re-render**: Component re-renders without prop change (missing memo).
12. **Large inline script**: > 1 KB of JS in HTML.
13. **Missing preload key resource**: Hero image or critical font not preloaded.
14. **Font loading with blocking**: @font-face without font-display: swap.
15. **Missing lazy loading below fold**: Images or iframes below viewport not lazy loaded.

## Fix Patterns (5 examples)

1. **Direct import instead of barrel**:
   ```ts
   // BEFORE
   import { debounce } from 'lodash'
   // AFTER
   import debounce from 'lodash/debounce'
   ```
2. **Add lazy loading to image**:
   ```tsx
   <img src="hero.jpg" loading="lazy" width="1200" height="600" alt="hero" />
   ```
3. **Add defer to script**:
   ```html
   <script src="analytics.js" defer></script>
   ```
4. **Code-split route**:
   ```tsx
   const Dashboard = lazy(() => import('./Dashboard'))
   ```
5. **Add React.memo to expensive list**:
   ```tsx
   const ListItem = React.memo(({ item }: { item: Item }) => <li>{item.name}</li>)
   ```

## Anti-Patterns
- Premature optimization of trivial components.
- Adding lazy loading to above-fold hero images.
- Removing analytics scripts without understanding tracking needs.

## Metrics
- bundle_kb (total JS bundle gzip)
- lcp_ms (Largest Contentful Paint)
- cls_score (Cumulative Layout Shift)
- unused_css_kb

## Example Finding
```json
{
  "id": "F-PF-0001",
  "agent": "A2",
  "severity": "P1",
  "title": "Lodash full import adds 71 KB gzip to bundle for single debounce use",
  "evidence": [{ "file": "src/utils/search.ts", "line": 1, "snippet": "import _ from 'lodash'", "measurement": "71 KB gzip" }],
  "impact": 4,
  "effort": 1,
  "fix_sketch": "Replace with import debounce from 'lodash/debounce'. Saves ~70 KB gzip.",
  "metric": { "name": "bundle_kb", "before": 512, "after_null_ok": false, "unit": "KB" },
  "files_touched": ["src/utils/search.ts"],
  "status": "open"
}
```
