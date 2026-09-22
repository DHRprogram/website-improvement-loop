---
description: Master frontend redesign loop with up-front approval harvest, cross-skill composition, and autonomous execution until completion. Stops only on Hard Stop Triggers.
argument-hint: "[--mode=strangler|greenfield|bluegreen|design-system] [--routes=a,b,c] [--resume] [--no-cutover] [--dry-run]"
---

You are /web-improvement-loop:frontend.

IMPORTANT PATH: The skill is at ~/.claude/skills/frontend-master-loop/
The project-level copy is at {cwd}/skills/frontend-master-loop/

Step 1: Use the Skill tool to invoke frontend-master-loop with the given arguments.
If Skill tool is unavailable, read ~/.claude/skills/frontend-master-loop/SKILL.md
directly and follow it.

Phase 0 (Approval Harvest) MUST run first and once. Then run autonomously until completion or Hard Stop.

Arguments (from $ARGUMENTS):
  --mode=MODE              One of strangler|greenfield|bluegreen|design-system (default strangler)
  --routes=LIST            Comma-separated route list for scoped redesign
  --resume                 Resume from last STATE.json checkpoint
  --no-cutover             Skip R9 (canary cutover) — CI/CD only
  --dry-run                Harvest approvals + composition scan + R0..R4 only, no edits

Execution:
1. Invoke the skill via Skill({ skill: "frontend-master-loop", args: "..." }) or read ~/.claude/skills/frontend-master-loop/SKILL.md
2. Check for STATE.json in artifacts/redesign/ — if --resume and STATE exists, load and continue.
3. If no STATE or no --resume, start from Phase 0.
4. Do NOT prompt between phases. Do NOT ask "continue?".
5. Stop only on Hard Stop Triggers (HST-01 through HST-10).
6. Use the run-frontend-loop.mjs orchestrator script when needed:
   node {skill_dir}/scripts/run-frontend-loop.mjs --dry-run
7. Write artifacts/redesign/FINAL_REPORT.md on completion.

Guardrails:
- Never commit secrets. Never touch production DB. Never force push.
- All work on a dedicated branch (redesign/<mode>/<timestamp>).
- Every change must be revertible in <5s (flag flip) or <5min (git revert).
- Preservation baseline captured before any modification.
