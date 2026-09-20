# Adversarial Playbook — P11

40 attacks in 6 groups. Severity map: S0 → P0, S1 → P1, S2 → P2, S3 → P3.

## Group 1 — Input Abuse
| ID | Attack | Expected | Watch for |
|----|--------|----------|-----------|
| A01 | Submit empty form | Field-level errors | Server error without field highlight |
| A02 | Paste 10,000 characters | Truncation or length error | Crash, hang, or silent truncation |
| A03 | Paste 0, -1, 1e999, NaN in number fields | Rejection with message | Accepts without validation |
| A04 | Paste emoji + RTL + zero-width chars | Unicode displayed safely | Broken layout, XSS, corruption |
| A05 | Email without @ | Validation error | Accepted and stored as invalid |
| A06 | Paste SQL fragment in text field | Safe display or rejection | SQL error exposed or injection |
| A07 | Paste HTML/JS in text fields | Escaped display | Script execution (XSS) |
| A08 | Delete field after error, tab out | Error clears or persists inconsistently | Form submits without field |

## Group 2 — Click Abuse
| ID | Attack | Expected | Watch for |
|----|--------|----------|-----------|
| A09 | Double-click submit button | Second click ignored | Duplicate submission |
| A10 | Triple-click + Enter on button | One action | Multiple submissions |
| A11 | Click Back after submission | Idempotent result | Duplicate or error |
| A12 | Destructive action without confirm | Confirmation dialog | Immediate execution |
| A13 | Cancel during delete, then refresh | Item still exists | Deleted anyway |
| A14 | Click link, then Back before load | Stable prior state | Double form data or broken state |
| A15 | Ctrl+click link to open new tab | Tab opens | CSRF or auth leak |
| A16 | Spam load-more / paginate button | Rate limited or smooth | Duplicate data or crash |

## Group 3 — Keyboard & Focus Chaos
| ID | Attack | Expected | Watch for |
|----|--------|----------|-----------|
| A17 | Tab through entire page | Focusable elements in order | Focus trap, broken order |
| A18 | Shift+Tab from first element | Nothing or wraps to last | Focus disappears |
| A19 | Enter on every unfocused input | No action | Unexpected submit or focus |
| A20 | Escape on every modal/menu | Closes cleanly | Multiple layers open |
| A21 | Tab after last element in modal | Focus wraps or closes | Focus escapes behind modal |
| A22 | Open two modals in sequence | Second after first closes | Two modals stacked |
| A23 | Back with modal open | Modal closes or stable | Modal behind content |

## Group 4 — State & Refresh
| ID | Attack | Expected | Watch for |
|----|--------|----------|-----------|
| A24 | Refresh mid-form | Form state persists (if good UX) or warns | Data loss without warning |
| A25 | Refresh immediately after submit | Idempotent result | Duplicate transaction |
| A26 | Open same page in 2 tabs, submit both | One succeeds, other warns | Or duplicate data |
| A27 | Logout in tab A, act in tab B | Auth error | Silent failure, data leak |
| A28 | Wait for session to expire, then act | Redirect to login | Error or crash |
| A29 | Change language/theme after filling form | Form persists | Form resets or errors |
| A30 | Resize window mid-form | Layout adjusts | Hidden elements, layout break |

## Group 5 — Navigation & Discovery
| ID | Attack | Expected | Watch for |
|----|--------|----------|-----------|
| A31 | Click logo from deep page | Navigate to home | Broken home link |
| A32 | Back from last step of wizard | Go to previous step or exit | Data loss |
| A33 | Delete the last item in a list | Empty state | Blank, error, or stale page |
| A34 | Apply filter that returns zero results | Empty state message | No message, broken filter |
| A35 | Edit visible link URL to cause 404 | Custom 404 page | Generic error or broken page |
| A36 | Repeat search/filter query | Stable result | Memory leak, slowdown |

## Group 6 — Network & Timing
| ID | Attack | Expected | Watch for |
|----|--------|----------|-----------|
| A37 | Slow 3G throttling | Loading states shown | No loading, spinner never shows |
| A38 | Offline mode | Offline message or cached content | Blank page or crash |
| A39 | Click action button during slow operation | Debounced or queued | Multiple requests |
| A40 | Submit form while images still loading | Form submits cleanly | Layout shift or missing data |

## Recording Format
```json
{
  "attack_id": "A01",
  "group": "Input abuse",
  "target": "Signup form email field",
  "did": "Pasted 10000 chars into name field",
  "expected": "Truncation or length validation error",
  "actual": "Field accepted text, page hung for 5s, then crash",
  "severity": "S0",
  "reproduced": true,
  "pass": "desktop",
  "screenshot": "shots/P11/A01-crash.png",
  "fix": "Add maxlength attribute and server-side length validation"
}
```

## Rules of Engagement
- Each attack: perform the action once, observe, record.
- If real data risk: "not executed — risk to data" in actual field.
- Never attack auth/payments on production environments.
- Any S0 → halt Phase B, escalate immediately.
