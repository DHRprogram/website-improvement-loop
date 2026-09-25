# Target detection and engine routing

`scripts/measure.sh` is the **single source of truth** for detection. It prints
the detected stack and only the metrics that apply to it. Never re-implement
marker-file checks here or in a command — read the `stack` key instead.

## STEP 0 — resolve the target

```bash
STACK=$(bash skills/website-improvement-loop/scripts/measure.sh . --stack-only)
```

Values: `nextjs` | `vite` | `node` | `django` | `python` | `go` | `rust` |
`jvm` | `php` | `ruby` | `dotnet` | `generic`

## Routing

| stack | Phase A engine | Phase B driver | extra tools to allow |
|---|---|---|---|
| nextjs, vite, node | frontend-10-agent-improver | 12 browser personas + axe | `Bash(npm:*) Bash(npx:*)` |
| django, python | generic A0–A6 rubric | stack suite + ruff/mypy | `Bash(python:*) Bash(pytest:*) Bash(ruff:*) Bash(mypy:*)` |
| go | generic A0–A6 rubric | `go test ./...` | `Bash(go:*)` |
| rust | generic A0–A6 rubric | `cargo test` + clippy | `Bash(cargo:*)` |
| jvm | generic A0–A6 rubric | mvn/gradle test | `Bash(mvn:*) Bash(gradle:*)` |
| php | generic A0–A6 rubric | phpunit | `Bash(php:*)` |
| ruby | generic A0–A6 rubric | rspec | `Bash(bundle:*)` |
| dotnet | generic A0–A6 rubric | `dotnet test` | `Bash(dotnet:*)` |
| generic | generic A0–A6 rubric | stack suite if any | none |

## Phase A — engine selection

- `nextjs` / `vite` / `node` → `skills/frontend-10-agent-improver/SKILL.md`
- everything else → the A0–A6 rubric in `skills/website-improvement-loop/SKILL.md`

The 10-agent improver is entirely frontend agents (accessibility, responsive,
seo-meta, motion). Running those against a Go service or a Django app produces
findings that do not exist, so it must not be the default off-web.

## Phase B — driver selection

- Browser personas need an HTTP UI. Use them only for a `nextjs`/`vite`/`node`
  target that actually serves one.
- Every other stack substitutes its own suite. `measure.sh` already runs it and
  reports `test_pass_rate` / `lint_errors` / `type_errors`. Write findings to
  the same `scripts/user-test/findings.schema.json` so Phase C consumes one
  format regardless of driver.
- A stack with no runnable suite reports "no runnable suite" and the pipeline
  continues. Never fabricate a pass.

## Phase E — scope

- Phase E may touch any layer the detected stack owns.
- DB schema, auth, payments and infra still require explicit user approval on
  every stack, including web ones.

## Regression Guard

Compare only keys present in **both** baseline and current, and skip `null`
values. `measure.sh` omits a key when the tool is absent — an absent key means
"no data", never "perfect". Lower is better for `lint_errors` and
`type_errors`; higher is better for `test_pass_rate`.
