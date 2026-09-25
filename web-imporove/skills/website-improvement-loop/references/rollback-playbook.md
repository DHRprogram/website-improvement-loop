# Rollback Playbook

A rollback plan that has never been executed is a hypothesis. Every step in
this playbook is written to be executed under pressure, at 3am, by whoever is
on call — not by the person who wrote the code.

## SLA

| Mechanism | Target | Hard ceiling |
|---|---|---|
| Feature flag flip | < 5 seconds | 5 seconds |
| `git revert` | < 5 minutes | 15 minutes |
| Snapshot restore | — | not an SLA; a change window |

Five minutes is not arbitrary. It is roughly the time a customer-facing team
will tolerate an incident before deciding to escalate. If a change cannot be
undone in five minutes, it does not belong in an unattended window.

## Decision: Roll Back or Fix Forward

Roll back first, diagnose second. Every incident that spent twenty minutes
debugging forward would have been safe in ninety seconds of rollback.

| Situation | Action |
|---|---|
| Error rate up, cause unknown | **Roll back now.** Diagnose afterwards. |
| Error rate up, cause known and fixable in < 2 min | Fix forward is acceptable. |
| Data corruption or loss | Roll back immediately, then assess data. |
| Slow but not broken | Fix forward, unless a flag flip is available. |
| Broken only for a small segment | Roll back that segment via a targeted flag. |
| Rollback itself is failing | Escalate. Do not stack a second change on top. |

One rule overrides all of these: **never roll back a migration that has already
written new-format data** without checking whether the old code can read it. See
step 3 below.

## Phase A — Improve

**What can go wrong:** a "safe" frontend or small change breaks a shared
component and takes unrelated routes down.

**Rollback:** `git revert` the iteration commit.

```sh
git log --oneline -1                       # find the commit
git revert --no-edit <sha>                 # creates a new commit; history stays
git push
```

Why revert and not reset: a revert is a commit. On a shared branch, rewriting
history to undo a bad commit is how a teammate loses work. R4 requires one
revertible commit per iteration for exactly this reason.

**SLA:** < 5 min.

**Partial rollback:** if only one component is affected, revert the whole
commit anyway. Reverting more than necessary costs less than a partial revert
that misses a coupled file.

## Phase B — Test

**What can go wrong:** the test harness itself, if it runs against a shared
database or a real payment provider.

**Rollback:** none needed. Testing does not change production.

**Precondition:** `no-prod-touch.sh` must have passed. If the test suite can
reach production, stop and fix that before running it, not after.

## Phase C — Ideate

**What can go wrong:** nothing. Ideation writes proposals, not code.

**Rollback:** delete the pitch file. No runtime effect.

## Phase D — Approve

**What can go wrong:** an unapproved change ships.

**Rollback:** the approval record is the control, not the rollback. If the
guard passed without a real approval, that is a guard bug — fix the guard before
the next run.

**Check:** `bash scripts/guards/no-schema-change.sh .` exits 0 because
`APPROVALS.json` contains a matching entry. Verify the approver is a person.

## Phase E — Build

**What can go wrong:** the change builds and passes tests but is wrong at
runtime, or the build itself fails partway.

### If the build fails

```sh
git status --short          # see what is uncommitted
git checkout -- .           # discard working-tree changes
git log --oneline -1        # if the failure is already committed
git revert --no-edit <sha>
```

A build failure that was never committed needs no rollback at all — the
deployable state is unchanged. Reverting a commit that was never pushed is
also usually unnecessary; the previous deploy is still live.

### If it built and deployed

Feature flag first, revert second. A flag flip is 5 seconds and reversible
repeatedly. A revert is 5 minutes and not.

```sh
node scripts/rollback.mjs --project=. --route /checkout --reason "error rate 4.2% after migration"
```

This flips the route's flag off, writes a `flag_audit` entry with the reason,
and reports which routes remain on the new system. If a flag flip is not
available for this route, escalate to `git revert`.

## Redesign Migrations

This is where the five-minute SLA is hardest, and the reason the strangler
pattern exists: most of the rollback budget is spent getting to a point where a
flip is sufficient.

### Per-step rollback

| Step | Rollback | SLA |
|---|---|---|
| Read-only route | Flag off | < 5 s |
| Write route, single write | Flag off | < 5 s |
| Write route, dual-write | Flag off, then diff contracts | < 5 s to stop, then reconcile |
| Additive schema migration | `git revert` | < 5 min |
| Destructive schema migration | Snapshot restore | **Not in SLA** — needs its own window |
| Flag removal (cutover) | `git revert` the cutover | < 5 min |

### After a write migration: the data question

Flipping the flag stops new writes to the new system. It does not undo writes
that already happened. Before declaring victory:

```sh
node scripts/data-contract-freeze.mjs --project=. --diff
```

Then answer three questions:

1. Did the new system write anything the old one cannot read?
2. If yes, is that data still retrievable?
3. Is the old system authoritative, and does it have a copy?

Only then is the rollback complete. Reporting "rolled back" while the new store
holds the authoritative copy is how a rollback becomes a data incident.

### When rollback is not enough

| Situation | Do |
|---|---|
| New system wrote data the old cannot read | Do not flip back. Restore from snapshot, or forward-migrate the data. |
| Both systems are authoritative | Stop writes on both, reconcile, then choose one. |
| Money moved | Roll back, then reconcile against the payment provider. Never assume the provider agrees. |
| The old system is gone | There is no rollback. This is why step 9 (remove legacy) is the last step and the only irreversible one. |

## After Any Rollback

1. Confirm recovery: error rate, latency, and volume are back to baseline.
2. Write a lesson into STATE.md — `state-manager.mjs update --add-lesson`.
3. Increment `findings.reverted`. The loop counts these, and a mode that
   reverts often is a mode with a systematic problem.
4. Do not immediately retry. Understand the failure first; a retry without a
   diagnosis produces the same revert.

## Rollback Command Reference

```sh
# Feature flag (fastest)
node scripts/rollback.mjs --project=. --route /checkout --reason "error rate up 3pct after cutover"

# Git revert
git revert --no-edit <sha> && git push

# Contract check after a write migration
node scripts/data-contract-freeze.mjs --project=. --diff

# State
node scripts/state-manager.mjs update --error --add-lesson "reverted <sha>: <cause>"
node scripts/state-manager.mjs read
```

## Pre-Flight: Rehearse It

Before the first migration goes live, on a non-production environment:

- [ ] Run the rollback end to end. Time it.
- [ ] Confirm the flag audit entry is written.
- [ ] Confirm the contract diff runs and is readable.
- [ ] Have a second person execute the rollback from this document alone, with
      no additional context. If they cannot, this document is incomplete.
