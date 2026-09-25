# Data Contract Rules

A data contract is the frozen promise between a system and everything that
calls it. Freezing it is what lets two systems be migrated independently
without either one being able to break the other by accident.

Location: `artifacts/website-loop/DATA_CONTRACT.json`
Frozen by: `scripts/data-contract-freeze.mjs`
Enforced by: `scripts/guards/no-schema-change.sh`

## What a Contract Covers

| Surface | Captured as | Example |
|---|---|---|
| Response shape | JSON Schema per endpoint | `{"type":"object","required":["id","email"]}` |
| Field types and nullability | `type`, `nullable` | `email: string, not null` |
| Enum domains | `enum` | `status: ["active","suspended"]` |
| Required fields | `required` | `id`, `created_at` always present |
| Status codes | map per outcome | `200 / 404 / 422` |
| Error shape | JSON Schema | `{"error":{"code":string,"message":string}}` |
| Field naming | convention check | camelCase enforced |
| New fields | allowlist, default deny | adding is a version bump |

A contract that omits nullability is not a contract. `email: string` and
`email: string | null` are different promises, and the difference is exactly
where migrations break.

## Freezing

```sh
node scripts/data-contract-freeze.mjs --project=. --out artifacts/website-loop/DATA_CONTRACT.json
```

The freeze is committed. That is the point: the contract is a reviewed,
revertible artefact, not a generated file that changes whenever the code does.

## What May Change Without Approval

Strictly additive and backward compatible:

| Change | Allowed | Notes |
|---|---|---|
| New optional request field | yes | Old callers omit it; default must be sane. |
| New response field | yes | Consumers must ignore unknown fields. |
| New endpoint | yes | Adds surface, breaks nothing. |
| Additional enum value | yes | Only if consumers are documented as handling unknown values. |
| New optional query parameter | yes | |
| Widen a type | no | A `string` to `string \| null` change breaks readers. That is a widening *for writers*, a narrowing *for readers*. Needs approval. |
| Documentation string | yes | |

## What Requires Explicit Approval

Anything that can break a caller that was written against the old contract:

| Change | Why |
|---|---|
| Remove a field | Existing readers reference it. |
| Rename a field | Same failure, less obvious. |
| Make an optional field required | A caller that omitted it now fails validation. |
| Make a nullable field non-null | Readers that handled `null` now get an unexpected value. |
| Narrow a type | `string` to `string \| enum` breaks senders. |
| Change a status code | Retry logic keys on it. |
| Change the error shape | Clients parse it. |
| Change a field's semantics while keeping its name | **The worst case.** Nothing breaks loudly; the data is just wrong. |
| Remove an enum value | A stored value becomes invalid. |

Semantic changes under an existing name cannot be caught by schema diffing,
because the schema is unchanged. They are a human decision, every time.

## Approval

```
# Changing the contract requires all four:
#   1. a version bump           contract_version: 1.4.0
#   2. a written justification  docs/contracts/CHANGELOG.md
#   3. an approval record       artifacts/website-loop/APPROVALS.json
#   4. a migration plan         if existing data is affected
```

The guard reads `APPROVALS.json` for an entry naming the contract version, the
approver, and the date. An unapproved change is a hard failure of the commit,
not a warning: exit 1.

## Versioning

Semantic versioning, applied to the contract rather than to the implementation.

| Change | Bump |
|---|---|
| Backward compatible addition | MINOR — `1.3.0` → `1.4.0` |
| Any removal, rename, or semantic change | MAJOR — `1.3.0` → `2.0.0` |
| Widening that a reader cannot detect (description, example) | PATCH — `1.3.0` → `1.3.1` |

MAJOR is not bureaucratic. A reader written against 1.x and pointed at 2.x is
a runtime failure in production, discovered by a user.

## Migration Policy

| Policy | Rule |
|---|---|
| Read the version at handshake | A consumer declares which major it supports. |
| Two majors at most | Support N and N-1, then drop N-2. |
| Deprecation is announced | At least one release before removal, in the changelog. |
| Removal is a separate commit | Never bundled with a feature. |
| Consumers are inventoried | "Who calls this?" has an answer before removal. |
| Never edit historical data in place | Migrate, keep the old column, backfill, cut over, drop later. |

The last rule is the expensive one and the one that gets skipped. Renaming a
column in place breaks every running instance of the old code, including the
one you are about to deploy next.

## The Guard

```sh
bash scripts/guards/no-schema-change.sh <project_root>
```

| Situation | Exit |
|---|---|
| No `DATA_CONTRACT.json` | 0 — nothing is frozen yet, nothing to protect |
| Contract unchanged | 0 |
| Contract changed with an approval for the new version | 0 |
| Contract changed without an approval | 1 |
| Contract file is malformed | 1 |
| Contract deleted | 1 |

Malformed and deleted both fail closed. A contract that cannot be parsed is not
an unchanged contract, and treating it as one is how a guard silently stops
working.

## Diffing

```sh
node scripts/data-contract-freeze.mjs --project=. --diff
```

Prints added, removed, and changed fields, and exits 1 if anything is a
breaking change without an approval. Use it in review, not only in CI — the
point of the diff is that a human reads it *before* the change lands.

## Anti-Patterns

| Anti-pattern | Why it fails |
|---|---|
| Snapshot without committing | The "frozen" contract moves, so nothing is frozen. |
| `additionalProperties: true` everywhere | A contract that permits anything constrains nothing. |
| Comparing types loosely | `1` and `"1"` interop in some stacks and not others; require exact types. |
| Approving your own change | The approval exists to be a second pair of eyes. |
| Removing a field and its consumers together | The removal must land after the last consumer, in a separate commit. |
| Treating a warning as a pass | The guard exits 1. Respect the exit code. |
