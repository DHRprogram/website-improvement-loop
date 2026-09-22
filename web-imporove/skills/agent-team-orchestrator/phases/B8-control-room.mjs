# Phase B8: Control Room

Implement the human-facing control dashboard (Django + HTMX) for monitoring agent progress, reviewing outputs, approving tasks, and adjusting budgets in real time.

## Purpose

Give the human operator a single-pane-of-glass view into what agents are doing right now, what they have done, and what is blocked. Uses HTMX for partial-page updates — no full page reloads needed when new task results arrive via Server-Sent Events.

## Timing

Runs after B7 (gateway) provides the API endpoints this dashboard calls. The gateway must be operational because the control room consumes it as its sole data source.

## Inputs

- Gateway service from B7 at http://gateway:8000 with documented REST endpoints
- Event bus subscription capability for live updates
- Django template engine configured in the control_room service settings

## Outputs

- HTMX-powered dashboard pages: / (overview), /goals, /tasks/{id}, /approvals, /budget
- SSE endpoint /events/stream delivering live task status updates
- Approval interface: button-based approve/reject actions on each pending approval
- Budget gauge component showing current spend percentage with color thresholds (green < 75%, yellow 75-90%, red > 90%)
- Hard stop trigger UI: visible indicator when budget_guard has halted the team

## Steps

1. Define Django templates using the base template structure: `<base.html>` with navigation bar, main content div with hx-target attribute for HTMX swaps.
2. Build the overview page `/`: shows active goal title, current phase name, task progress bar (N/M completed), per-agent status indicators (idle/executing/blocked), budget gauge, and hard stop indicator if active.
3. Build the goals page `/goals`: list all submitted goals with status badges, click-to-expand shows task breakdown. HTMX swap triggered by click without full reload.
4. Build task detail page `/tasks/{id}`: displays the TaskSpec in an expandable code block (JSON format), result JSON if completed, artifacts list with file path and size links, duration, error message if failed. Include "rerun" button that POSTs to /api/tasks/{id}/rerun via HTMX post to restart the Celery task.
5. Build the approvals page `/approvals`: list all pending approval requests with approve and reject buttons. Each button triggers an HTMX post to /api/approvals/{id}/vote with the vote value. After voting, the row updates inline to show approved_by, approved_at, and status changed.
6. Build the budget page `/budget`: display total cap, current spend, remaining amount. Render a horizontal bar showing percentage used. Green below 75%, orange 75-90%, red above 90%. Show per-agent spend breakdown as a stacked bar chart (simple HTML/CSS bars, no JS library). Add manual adjustment input for increasing the cap (requires confirmation modal).
7. Implement SSE stream endpoint `/events/stream`: subscribe to event bus topics `task.completed:*`, `phase.gate.*`, `budget.warning`, `hard_stop.triggered`. Emit events as SSE formatted strings: `event: task_completed\ndata: {...}\n\n`. Set Content-Type: text/event-stream, Connection: keep-alive headers.
8. On the overview page, use HTMX to poll `/events/stream` every 5 seconds for new events. Process incoming events to update relevant DOM elements (progress bar, status indicators).
9. Implement the hard stop indicator: a fixed-position banner at the top of every page that appears when the budget guard sets `hard_stop=true`. Shows reason string (e.g., "Budget exceeded: $50.00/$50.00 spent") and a link to the budget page for adjustment.
10. Run syntax check on all Python files.
11. Publish CONTROL_ROOM_READY event.

## Checklist

- [ ] Base template defines navigation bar with links to overview, goals, tasks, approvals, budget
- [ ] Overview page shows active goal title, current phase, task progress count, per-agent status, budget gauge, hard stop indicator
- [ ] Goals page lists goals with status badges; expands to show task breakdown on click via HTMX swap
- [ ] Task detail page shows expanded TaskSpec JSON, Result JSON, artifact list with paths and sizes, duration, error messages
- [ ] Rerun button on task detail POSTs via HTMX to /api/tasks/{id}/rerun
- [ ] Approvals page lists pending approvals with approve and reject buttons
- [ ] Vote buttons POST via HTMX to /api/approvals/{id}/vote with {vote: "approve"|"reject"} parameter
- [ ] Approved rows update inline showing approver identity and timestamp
- [ ] Budget page renders percentage gauge bar with three color thresholds: green < 75%, orange 75-90%, red > 90%
- [ ] Budget page shows per-agent spend as horizontal CSS-only stacked bars
- [ ] Budget adjustment input requires confirmation modal before accepting new cap value
- [ ] SSE endpoint /events/stream emits formatted SSE strings for task, phase, budget, and hard stop events
- [ ] SSE connection persists with keep-alive; reconnects automatically on drop
- [ ] Overview page polls SSE endpoint every 5 seconds to update progress bar and status indicators
- [ ] Hard stop banner displays fixed at top of every page when hard_stop flag is true
- [ ] Banner shows exact reason string and links to budget adjustment page
- [ ] All Python and template files pass validation
- [ ] CONTROL_ROOM_READY event published to event bus

## Rollback

If HTMX integration causes broken page states (missing target elements, failed swaps), fall back to full-page refresh mode by removing hx-trigger/hx-target attributes from all HTMX tags. The dashboard remains functional but loses real-time updates — operators will need to manually refresh. Document this degraded state clearly in the budget page header. Do not proceed past B8 until the overview page loads without JavaScript errors in a browser console.
