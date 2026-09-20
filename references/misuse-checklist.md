# Misuse Checklist

## 1. State & Effects
| Misuse | Example | Fix |
|--------|---------|-----|
| useEffect for derived state | `useEffect(() => setFull(name + ' ' + last), [name, last])` | Compute during render: `const full = name + ' ' + last` |
| Missing dependency arrays | `useEffect(() => fetchData(), [])` when it uses id prop | Add `id` to deps: `[id]` |
| Global store for UI state | Putting `isModalOpen` in Redux/Zustand | Local `useState` in the component |
| Duplicate state | `name` in component + store + URL param | Single source of truth |
| Subscription leak | `ws.onmessage = handler` in useEffect without cleanup | Return `() => ws.close()` from useEffect |

## 2. Data Fetching & Caching
| Misuse | Example | Fix |
|--------|---------|-----|
| N+1 queries | Fetching list then per-item fetch in loop | Batch query or GraphQL |
| No dedupe/cache | Same API called by 3 components on same page | SWR/React Query with key |
| Missing loading/empty/error | Assuming data always arrives | Render all 3 states |
| Over-fetching | `SELECT *` when only name needed | Projection in query |
| Cache without invalidation | Stale data shown after mutation | Optimistic update + revalidate |
| Waterfall requests | Fetch A → A data → Fetch B → B data → render | Parallel fetch with Promise.all |

## 3. DB / Backend
| Misuse | Example | Fix |
|--------|---------|-----|
| Missing index | `WHERE status = 'active'` on unindexed column | Add index on `status` |
| SELECT * | `SELECT * FROM users` for a single field | `SELECT id, name` |
| Query in loop | N+1 in ORM by accessing relation per row | Eager loading / JOIN |
| No pagination | `SELECT * FROM posts LIMIT 1000000` | `LIMIT 20 OFFSET :page` |
| Server-side validation missing | Trusting client-provided `isAdmin: true` | Validate on server: `currentUser.role === 'admin'` |
| Business logic in controller | Fat controller with 200 lines of logic | Service layer |

## 4. Forms
| Misuse | Example | Fix |
|--------|---------|-----|
| Client-only validation | Relying on `required` HTML attribute | Server validation + handleError |
| No disabled state | Submit button clickable while submitting | `disabled={isSubmitting}` |
| Error without field highlight | Single error banner for all fields | Per-field `error` prop + focus |
| Lost input | Form resets on validation error | Preserve values, show errors inline |

## 5. Styling & UI
| Misuse | Example | Fix |
|--------|---------|-----|
| div-as-button | `<div onClick={handleClick}>Submit</div>` | `<button type="button">Submit</button>` |
| Inline style bypass | `style={{ color: brandColor }}` in many places | CSS variable: `var(--brand)` |
| Index as key | `items.map((i, idx) => <li key={idx}>` | Stable id: `key={i.id}` |
| Fixed width | `width: 400px` on a card | `min-width: 0; max-width: 100%;` |
| Low contrast | `color: #999` on white background | Minimum AA ratio 4.5:1 |

## 6. Routing & Rendering
| Misuse | Example | Fix |
|--------|---------|-----|
| Client redirect instead of server | Client-side logic for auth redirect | Middleware / server guard |
| No error boundary | Whole app crashes on one component error | `<ErrorBoundary>` per section |
| Hydration mismatch | `new Date()` in SSR vs client render | `useEffect(() => setClient(true), [])` |
| dangerouslySetInnerHTML without sanitize | `innerHTML = userInput` | DOMPurify or safe renderer |

## 7. Security & Privacy
| Misuse | Example | Fix |
|--------|---------|-----|
| Secret in client bundle | API key in .env passed to frontend | Server proxy |
| Missing headers | `X-Frame-Options`, `CSP`, `XSS-Protection` | Add helmet / security headers |
| No rate limit | Login endpoint with unlimited attempts | Rate limiter (express-rate-limit) |
| PII without consent | Storing IP + user agent without notice | Privacy policy + consent checkbox |
| Old CVE deps | `lodash@4.17.15` has known CVE | `npm audit fix` regularly |

## 8. Code Quality
| Misuse | Example | Fix |
|--------|---------|-----|
| Dead code | 40-line function never called | Delete it |
| Duplication | Same validation in 3 files | Extract to util/helper |
| any/ts-ignore | `const data: any = response` | Proper type or zod validation |
| Circular imports | A imports B, B imports A | Extract shared module |
| No tests on critical path | Payment flow untested | Add unit + integration test |

## 9. Config & Ops
| Misuse | Example | Fix |
|--------|---------|-----|
| Hardcoded env | `port = 3000` in source | `process.env.PORT || 3000` |
| CI without tests | PR merges without running tests | `npm test` in CI |
| No monitoring | 500 errors silently logged | APM + error alerting |
| Build artifacts in repo | `dist/` checked in | .gitignore + CI build step |
