# Phase 0 — Approval Harvest

## Purpose
Collect every required user decision UP-FRONT in a single structured form. The user answers once. We never ask again unless a Hard Stop fires or scope changes.

## Timing
Runs once at the very start of the first session. Never re-runs on --resume unless APPROVALS.json is missing or --reapprove flag given.

## The Question Form (exact wording)

When this phase starts, print the following to the user:

```
========================================================
 PHASE 0 — APPROVAL HARVEST
========================================================
Please answer ALL sections below. Answer once. We lock
your answers and never ask again unless scope changes.

 A. SCOPE
 A1. Mode enabled (strangler / greenfield / bluegreen / design-system):
 A2. Routes in scope (all / comma-separated list):
 A3. Routes explicitly OUT of scope:
 A4. Languages/locales to preserve:

 B. CONSTRAINTS
 B1. Staging DB URL available? (yes / no):
 B2. Backup target confirmed? (yes / no):
 B3. Feature flag provider (unleash / flagsmith / growthbook / env):
 B4. APM / observability stack (otel / datadog / newrelic / none):
 B5. Status page URL (or "none"):
 B6. CI/CD system (github-actions / gitlab-ci / jenkins / other):

 C. BUDGETS
 C1. Max cost delta allowed (percent, default 20):
 C2. Max downtime window (minutes, default 0):
 C3. Error budget policy confirmed? (yes / no):
 C4. Error budget consumed before halt (percent, default 25):

 D. AUTONOMY
 D1. I authorize autonomous execution until completion. (yes / no):
 D2. Hard Stop Triggers override autonomy. (acknowledged / no):
 D3. Canary ladder consent: 1% -> 5% -> 25% -> 50% -> 100%. (yes / no):
 D4. Auto-cleanup after 72h monitoring. (yes / no):

 E. RISK ACKNOWLEDGEMENT
 E1. I understand migrations are WRITTEN but NOT auto-run. (yes / required):
 E2. I understand cutover is paced, not single-shot. (yes / required):
 E3. I understand every phase is reversible. (yes / required):
========================================================
```

## Inputs
- User answers to the form above.

## Outputs
- `artifacts/redesign/APPROVALS.json` — complete, locked, with metadata:
  ```json
  {
    "approved_at": "2026-09-21T12:00:00Z",
    "approved_by": "user",
    "locked": true,
    "sections": {
      "scope": { "mode": "strangler", "routes_in": ["all"], "routes_out": [], "locales": ["en"] },
      "constraints": { "staging_db_url_available": true, "backup_target_confirmed": true, ... },
      "budgets": { "max_cost_delta_pct": 20, "max_downtime_min": 0, "error_budget_pct": 25 },
      "autonomy": { "authorized": true, "hst_acknowledged": true, "canary_consent": true, "auto_cleanup": true },
      "risk_ack": { "migrations_not_auto_run": true, "cutover_paced": true, "phases_reversible": true }
    }
  }
  ```

## Verification Checklist
1. All sections present with non-null values.
2. Autonomy D1 is "yes" (otherwise we cannot proceed autonomously).
3. Risk E1 is "yes".
4. Risk E2 is "yes".
5. Risk E3 is "yes".
6. APPROVALS.json parses with JSON.parse.
7. APPROVALS.json has locked: true.

## Locking
After writing APPROVALS.json, the file is considered locked. Any later change requires explicit re-approval via --reapprove flag. The skill MUST refuse to proceed if APPROVALS.json exists without locked: true.

## Failure Modes
- User answers "no" to D1 -> cannot proceed autonomously. Print: "Autonomous execution not authorized. Switch to manual mode or restart with approval."
- User answers "no" to any risk acknowledgement -> cannot proceed. Print the specific requirement.
- User leaves fields blank -> re-prompt only the blank fields.
