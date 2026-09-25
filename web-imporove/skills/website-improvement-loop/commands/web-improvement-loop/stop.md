---
description: Stop the active improvement loop and write the current state for later resume
argument-hint: "[--reason=<text>] [--force]"
allowed-tools: Read, Write, Edit, Bash(git:*), Bash(node:*)
model: claude-opus-4-5
---

You are `/web-improvement-loop:stop`. An explicit human stop always wins over the
Stop Hook: if the user asked to stop, the loop stops.

## Steps

1. **Record the reason.** `--reason` if given, otherwise ask once. Never
   invent a reason — the reason is what makes the next resume useful.
2. **Write a STOP sentinel** so the hook agrees:

   ```bash
   touch artifacts/website-loop/STOP
   ```

3. **Persist state**:

   ```bash
   node skills/website-improvement-loop/scripts/state-manager.mjs update \
     --stop-reason "<reason>" --stopped
   ```

4. **Commit the state** so `--resume` has something to read:

   ```bash
   git add artifacts/website-loop/STATE.md artifacts/website-loop/STOP
   git commit -m "chore(loop): stop — <reason>"
   ```

5. **Print the handoff**: iteration reached, queue depth, metric deltas, and
   the exact command to resume.

```bash
node skills/website-improvement-loop/scripts/orchestrator.mjs --resume
```

## --force

Stop even if the last iteration left the build red. Use it only when the user
has been told the tree is broken and accepted that. The commit in step 4 is
skipped in that case — never commit a red build under a clean message.

## Rules

- Stopping is not a rollback. The fixes already committed stay committed.
- Never delete `STATE.md`, the findings queue or the metrics. `--resume`
  depends on all three.
- Never stop from inside Phase D approval. That is a different kind of stop and
  it belongs to `/web-improvement-loop:full`.

## Arguments

`$ARGUMENTS`
