# Autonomy Rules

## When the loop may pause
- Hard Stop Trigger fires (must stop, report, wait).
- APPROVALS.json is missing or locked:false (must warn).
- --resume needed and STATE.json corrupted (must error).

## When the loop may NOT pause
- Between phases (never ask "continue?").
- When a guard fails (self-heal up to 3 attempts, then HST).
- When user input is ambiguous (use defaults from APPROVALS.json).

## Autonomy level
Full: all phases execute without human intervention until completion or HST.
The user grants this in P0 D1. Without it, the loop operates in manual mode.
