# Strangler Fig Pattern Reference

The strangler fig pattern migrates a system incrementally by building a new
system alongside the old one, routing traffic gradually, and retiring old
components once all traffic has moved.

Key concepts:
- Feature flags toggle old vs new per route.
- Both systems run in parallel during migration.
- Rollback = flip the flag back to old code.
- No big-bang cutover.

Our implementation:
- Each route gets a `redesign/route-<name>` feature flag.
- Flag controls traffic routing (old vs new).
- After all routes migrated: validation period.
- After validation: old code removal (requires P0 consent).
