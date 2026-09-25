# The Strangler Pattern

A strangler migration grows the new system around the old one and removes the
old one only once the new one is proven. At no point is there a moment where
both are broken, and at every point there is a way back.

## The Shape

```
   request
      │
      ▼
┌──────────────┐
│   Router     │   ← the only component that knows both systems exist
└──────┬───────┘
       │
   ┌───┴───────────────┐
   │ flag === false    │ flag === true
   ▼                   ▼
┌─────────┐      ┌─────────────┐
│ Legacy  │      │    New      │
│ system  │      │   system    │
└─────────┘      └─────────────┘
```

The router is a decision point, not a proxy. It routes the request to exactly
one system. The other system is not running alongside it for that request.

## Router Design

| Decision | Rule |
|---|---|
| Granularity | One route (or route prefix) per flag. Never a whole app. |
| Lookup | Flag store read per request, cached with a short TTL (60s). |
| Default | **Always the legacy path.** A missing or unparseable flag must not select the new system. |
| Evaluation | Pure function: `(request) => boolean`. No I/O, no time, no randomness. |
| Failure | Flag store unreachable means legacy, not error and not new. |
| Precedence | User override > route rule > global default. |
| Logging | Log the decision with route, flag, and value on every evaluation. |

The failure rule is the important one. A flag store outage during an incident
must not push traffic onto a system that may be the thing being rolled back.
Failing to legacy is boring; failing to new is a second incident.

## Flag Management

| Rule | Reason |
|---|---|
| Flags live in one store, not in the environment | Env vars need a deploy to change; a flag store does not. |
| Every flag has an owner and an expiry date | A flag without an owner outlives its feature. |
| Flags are removed with the code they gate | A dead flag is a dead branch that still needs testing. |
| Changing a flag is audited | Otherwise nobody knows who moved production. |
| No flag is created per user or per request | That is an entitlement system wearing a flag's clothes. |

A `flag_audit` entry records `{flag, from, to, actor, reason, at}`. It is the
difference between "rollback" and "we think someone turned it off".

## Migration Order

Migrate in this order, and not another. Each step is chosen to be low-risk and
independently valuable.

| # | Step | Why here |
|---:|---|---|
| 1 | Read-only, low-traffic route (e.g. `/about`) | Proves the plumbing with no data risk. |
| 2 | Another read-only route | Two data points before writing anything. |
| 3 | A listing page with pagination | Read traffic, real query volume. |
| 4 | A single read-only detail page | Deepest read path. |
| 5 | A form that writes, with no money | First write. Dual-write and compare. |
| 6 | A form that writes, with money | Only after a write path is proven. |
| 7 | Auth-adjacent routes | Last. Auth mistakes lock people out. |
| 8 | High-traffic routes | Last. Blast radius is largest here. |
| 9 | Remove the legacy path for a migrated route | The step people skip, and the one that keeps both systems alive forever. |

The order is traffic-ascending and risk-descending. It is also the order that
front-loads failures: a router bug shows up on `/about`, not on checkout.

## Per-Step Rollback

Every step carries its own rollback. This is the table that goes in the runbook.

| Step type | Rollback | Time | Risk after rollback |
|---|---|---|---|
| Read-only route | Flip flag to `false` | < 5 s | None. No state changed. |
| Write route, single system | Flip flag to `false` | < 5 s | Writes land in legacy. Reconcile the window. |
| Write route, dual-write | Flip flag to `false` | < 5 s | Both systems have data. `data-contract-freeze.mjs --diff` decides which is authoritative. |
| Schema migration, additive | `git revert` the migration | < 5 min | Additive only, so old code still reads old rows. |
| Schema migration, destructive | Restore from snapshot | > 5 min | **Out of SLA.** Never do this in a migration window. |
| Cutover (flag removed) | `git revert` the cutover commit | < 5 min | Route reverts to the previous implementation. |

The last row of the read/write table is why destructive migrations are separated
from migrations and reviewed separately. Anything that cannot come back in five
minutes is not a migration step, it is a change window.

## Data Migration

Prefer not to move data. The cheapest migration is the one where both systems
read the same store.

When data must move:

1. **Freeze the contract first.** `data-contract-freeze.mjs` writes
   `DATA_CONTRACT.json`. `guards/no-schema-change.sh` fails any commit that
   changes it without a version bump and an approval.
2. **Backfill, then cut over, then stop writing to the old store.** The order
   matters. Backfilling after cutover means the new system is already serving
   from incomplete data.
3. **Dual-write only where a read must be consistent.** Dual-write doubles the
   failure surface. Use it for the window between backfill and cutover, and
   only for the stores that must agree.
4. **Never dual-write money.** Two systems that can both charge are worse than
   either one. Choose one, and reconcile offline.

## The Step Checklist

Before any route is migrated:

- [ ] Pre-migration behaviour captured (`preservation-capture.mjs`)
- [ ] Golden test written and passing against the **legacy** route
- [ ] Flag exists, defaults to `false`, has an owner and an expiry
- [ ] Rollback command written down and rehearsed
- [ ] `no-prod-touch.sh` and `no-schema-change.sh` pass
- [ ] Monitoring on the new path: error rate, latency, and volume
- [ ] Someone other than the author can execute the rollback

After:

- [ ] Golden test passes against the **new** route
- [ ] Behaviour compared against the capture; delta reviewed
- [ ] Flag audit entry written
- [ ] Soak period observed before the next route

## Anti-Patterns

| Anti-pattern | Consequence |
|---|---|
| Big-bang cutover | One flag, whole system, no return. |
| Flag defaults to new | A missing flag silently moves production. |
| Migrating checkout before `/about` | The router bug is found in production, on the money path. |
| Never removing the legacy path | Two systems diverge, both are maintained, neither is trusted. |
| Dual-writing money | Double charge, and two systems that both believe they are authoritative. |
| Rollback never rehearsed | A rollback that has not been run is a hypothesis. |
