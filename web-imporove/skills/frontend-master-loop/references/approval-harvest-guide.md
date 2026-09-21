# Approval Harvest Guide

Phase 0 collects every required decision before work begins. This prevents
context-switching and ensures the loop can run autonomously.

## Sections
- A: Scope — what gets redesigned
- B: Constraints — infrastructure and operational requirements
- C: Budgets — cost and error budgets
- D: Autonomy — what the loop may do without asking
- E: Risk — explicit user acknowledgements

## Locking
Once APPROVALS.json is written with locked:true, it cannot be changed without
--reapprove. The skill refuses to run with an unlocked or missing file.
