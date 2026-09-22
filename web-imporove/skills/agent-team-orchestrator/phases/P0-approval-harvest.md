# Phase P0: Approval Harvest

Harvest explicit human approvals before any agent work begins. No scope changes, no speculative features.

## Purpose

Lock in the goal, scope boundaries, budget cap, and quality bar so every downstream agent shares identical assumptions. This prevents "scope creep" errors that cause multi-agent teams to rebuild the wrong thing three times.

## Timing

Runs immediately after `--goal` is parsed and before P1 planning. Blocks on ALL approvals; never proceeds with partial consent.

## Inputs

- `GOALS.example.json` — structured goal spec
- Human operator input (review + approve each item)
- `APPROVALS.example.json` — template for recording decisions

## Outputs

- `approvals.json` — signed approval record with timestamps
- `goals-resolved.json` — scoped goal document ready for planning

## Steps

1. Parse raw goal text through goal-parser.mjs into structured fields.
2. Expand goal into concrete deliverables (components, endpoints, pages).
3. For each deliverable, present it to the human operator as a yes/no item.
4. Record the operator's decision (approve / approve-with-modification / reject).
5. Compute whether ALL required items are approved or if any blockers remain.
6. Write `approvals.json` with the full decision ledger.
7. On success, emit `GOAL_RESOLVED` event on the event bus.

## Checklist

- [ ] Goal parsed into structured fields (title, description, target, priority)
- [ ] All deliverables enumerated with acceptance criteria
- [ ] Budget cap stated in USD and hours
- [ ] Quality bar defined (test coverage %, performance targets, accessibility level)
- [ ] Scope boundary explicitly stated (what is OUT of scope)
- [ ] Each deliverable presented to human for individual approval
- [ ] Operator modifications captured and reflected in resolved scope
- [ ] `approvals.json` written with all signatures, timestamps, change IDs
- [ ] `GOAL_RESOLVED` event published
- [ ] If ANY required item unapproved, halt and report blocker to operator

## Rollback

If P0 fails midway (e.g., operator revokes an approval), delete `approvals.json`, reset goals state, and return to step 1 with the revised operator input. Log the revocation in `approvals.json` with a reason string. Do not carry partial approvals into P1.
