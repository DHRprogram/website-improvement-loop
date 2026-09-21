---
description: Master frontend redesign loop with up-front approval harvest, cross-skill composition, and autonomous execution until completion. Stops only on Hard Stop Triggers.
argument-hint: "[--mode=strangler|greenfield|bluegreen|design-system] [--routes=a,b,c] [--resume] [--no-cutover] [--dry-run]"
allowed-tools: Read, Write, Edit, Bash(git:*), Bash(npm:*), Bash(node:*), Bash(npx:*), Bash(psql:*), Bash(sqlite3:*), Bash(bash:*), Bash(jq:*)
model: claude-opus-4-5
---

You are /web-improvement-loop:frontend. Load and follow skills/frontend-master-loop/SKILL.md exactly.

Phase 0 (Approval Harvest) MUST run first and once. Then run autonomously until completion or Hard Stop.

Parse arguments from $ARGUMENTS:
  --mode=MODE              One of strangler|greenfield|bluegreen|design-system (default strangler)
  --routes=LIST            Comma-separated route list for scoped redesign
  --resume                 Resume from last STATE.json checkpoint
  --no-cutover             Skip R9 (canary cutover) — CI/CD only
  --dry-run                Harvest approvals + composition scan + R0..R4 only, no edits

Execution:
1. Read skills/frontend-master-loop/SKILL.md and phases/*.md.
2. Check for STATE.json in artifacts/redesign/ — if --resume and STATE exists, load and continue.
3. If no STATE or no --resume, start from Phase 0.
4. Do NOT prompt between phases. Do NOT ask "continue?".
5. Stop only on Hard Stop Triggers (HST-01 through HST-10).
6. Write artifacts/redesign/FINAL_REPORT.md on completion.

Guardrails:
- Never commit secrets. Never touch production DB. Never force push.
- All work on a dedicated branch (redesign/<mode>/<timestamp>).
- Every change must be revertible in <5s (flag flip) or <5min (git revert).
- Preservation baseline captured before any modification.
