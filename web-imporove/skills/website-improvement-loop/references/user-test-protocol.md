# User Test Protocol

## 1. Preconditions
- Base URL must be set and reachable
- Credentials from ENV (never printed) — optional
- Browser driver must be available (see B0)

## 2. Visible-Only Rule

### ALLOWED
- Click on any visible button, link, input, select, checkbox, tab, or menu
- Type into labelled inputs (getByRole → getByLabel/Placeholder → getByText)
- Scroll the page
- Hover on elements
- Tab between elements (for keyboard personas)
- Browser Back/Forward buttons
- Close dialogs by clicking the visible close button

### FORBIDDEN
- Page.goto() after step 0 (no deep linking — user never types URLs)
- page.evaluate() or any JavaScript execution
- CSS selectors (class, id, data-testid, XPath)
- DOM surgery: removing overlays, injecting styles, force-clicking hidden elements
- Synthetic event dispatch
- Reading console or network logs
- Direct URL manipulation (deep links)

## 3. Selector Policy
Priority order:
1. `getByRole` — find by ARIA role + accessible name
2. `getByLabel` / `getByPlaceholder` — for form fields
3. `getByText` — for links and buttons by visible text

If none matches: record a finding and report:
"Could not find [intent] via visible affordances; nearest visible text: '[text]'"

Never use CSS/class/id selectors. If the UI has no visible affordance for a required action, that's a P2 or higher finding.

## 4. Pacing & Patience

| Persona | Patience | Retries |
|---------|----------|---------|
| P01 (Busy professional) | 5s | 1 |
| P04 (Older adult) | 3s | 2 |
| P11 (Adversarial) | infinite | 3 |
| All others | 10s | 1 |

After patience expires: log frustration, mark step friction accordingly, try once more.

## 5. Step Record JSON
```json
{
  "step": 1,
  "intent": "Find the signup button",
  "found_via": "getByRole('link', { name: 'Sign Up' })",
  "action": "Clicked 'Sign Up' link in header",
  "result": "Navigated to /signup page",
  "screenshot": "artifacts/USER_TEST/shots/persona-01/step-01.png",
  "friction": 0,
  "note": ""
}
```

## 6. Task End JSON
```json
{
  "task_id": "P01-T1",
  "goal": "Create an account",
  "status": "completed",
  "steps": 5,
  "time_to_first_value_s": 12,
  "friction_avg": 0.4,
  "dead_ends": ["Had to find password requirements"],
  "top_frustrations": ["No show password toggle"],
  "quote": "I expected to be done in under a minute but the form had too many fields.",
  "step_log": [
    { "step": 1, "action": "open /signup", "ok": true, "ms": 820 },
    { "step": 2, "action": "submit empty form", "ok": false, "ms": 240, "friction": 1 }
  ],
  "attacks": []
}
```

Quotes must be first-person, honest, plausible. Do not sanitise.

## 7. Persona Summary JSON
See findings.schema.json for full schema.

## 8. Isolation & Cleanup
- Fresh browser context for each persona
- Cookies and storage are isolated per context
- Close context after each persona completes

## 9. Honesty Rules
- If the driver throws an error: log it. Do not fabricate steps.
- If a persona would abandon the task: abandon it (status: "abandoned"). Do not force completion.
- Screenshots are evidence. Take one per step.

## 10. Adversarial Rules (P11)
- Allowed: network throttling, offline emulation, paste any content, double/triple-click, rapid Back/Forward, refresh mid-flow
- Forbidden: page.evaluate, DOM surgery, hidden selectors, direct URL navigation, real auth/payment attacks on production, real charges, real emails, real data deletion
- Escalation: any reproducible S0 → halt Phase B
- Honesty: do not fabricate attacks. Log what actually happened.
