# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-09-25

The first release: the A–E pipeline, the 10-agent parallel improvement loop,
and the self-evolving Stop Hook loop.

### Added — phases

- Phase A — Improve: 10 iterations with before/after measurement, a 9-dimension
  weighted rubric, and a misuse hunt
- Phase B — Synthetic user testing: 12 personas through a real browser
  (10 demographic, 1 adversarial chaos tester, 1 axe-core auditor), visible UI
  only, with an honesty section listing what was not tested
- Phase C — Ideate: 15–25 ideas across 9 business areas, filtered to 8–12
  evidence-backed pitches with ROI scoring
- Phase D — Approval: a hard stop that records the user's response verbatim
- Phase E — Build: approved ideas only, held to the full Product Quality Bar
- Regression Guard: a CI gate that blocks metric degradation

### Added — 10-agent parallel architecture

- S1 Bug Hunter, S2 Design Critic, S3 UX Auditor, S4 Perf Engineer,
  S5 A11y Auditor, S6 Test Guardian, S7 SEO Auditor, S8 Security Scanner,
  S9 Architecture Reviewer, S10 Mobile Auditor — each with a role, a bounded
  tool set, a 15+ item detection checklist, 5+ before/after fix patterns, a
  severity guide, its own failure modes, and a worked example finding
- Three layers with one job each: L1 orchestrator, L2 subagents,
  L3 guards and metrics
- At most 5 findings processed per iteration; one revertible commit each

### Added — self-evolving loop

- `hooks/stop-hook.sh` and `hooks/check-stop.sh`: exit 2 keeps the loop going,
  exit 0 lets it stop
- Five stop conditions: iteration cap, no findings at or above the floor,
  5 iterations with no improvement, 3 consecutive errors, a STOP sentinel
- `STATE.md` external memory surviving across iterations, with the
  iteration count, baseline, current values, derived deltas, finding counts
  and lessons learned
- `hooks/settings.json` wiring the Stop event

### Added — focus modes

- Ten modes: `full`, `design`, `bugs`, `perf`, `a11y`, `security`, `seo`,
  `frontend`, `backend`, `redesign`
- `focus-resolver.mjs` returns each mode's subagents, primary metric with its
  direction, secondary metrics, severity floor and stop conditions
- `focus-metrics.mjs` records mode-specific metrics and detects regressions by
  direction, skipping anything not measured on both sides

### Added — ranking and merging

- Priority = `severity_weight × impact ÷ effort`, with P0=1000, P1=300,
  P2=100, P3=30
- `merge-findings.mjs` drops exact duplicates within an agent and resolves
  cross-agent conflicts in favour of the higher severity, keeping every loser
  in `conflicts.json`
- `rank-findings.mjs` writes a full `QUEUE.json` and a `QUEUE_TOP.json` slice

### Added — guards and measurement

- `no-main-commit.sh`, `no-secret-commit.sh`, `no-backend-touch.sh`,
  `metric-must-improve.sh`
- `measure.sh`: stack-aware metrics as the single source of truth for target
  detection, with a label mode writing `metrics/<label>.json`
- Absent tools report `null`, never `0` and never an omitted key — a
  fabricated zero would make every regression guard pass silently
- `verify-change.sh`: build → lint → typecheck → test → measure, exiting 1 on
  a broken build and 2 on a regression so the orchestrator reverts

### Added — redesign

- `/web-improvement-loop:redesign` with R0–R10: Preservation Harness, spec
  extraction, Data Contract Freeze, Golden Tests, design system, backend and
  frontend rebuild, Strangler Fig migration, canary cutover and cleanup
- R9 and R10 require explicit user approval on top of the gate passing

### Added — commands, reporting and CI

- 13 namespaced subcommands under `web-improvement-loop/`, plus
  `/agent-team` for the separate multi-service platform
- `FINAL_REPORT.md` and an HTML report
- `vibe-forge-nightly.yml`: a scheduled regression run with artifact upload
- `install.sh`, `LICENSE`, `README.md`, `package.json` and `.mcp.json`

### Notes

- Phase D is a hard stop. A high ROI score is not consent.
- A golden test that was never green against the old implementation is not a
  golden test.
- The loop reports honestly: an unavailable tool produces a null metric and an
  unavailable agent produces an empty finding set, never a fabricated result.

## [0.2.0] — 2026-09-25

Redesign pipeline, ten new reference documents, eight worked examples, three
new guards, seven new scripts, and two new CI workflows. The commands are now
namespaced, and the loop can migrate a site without being able to lose it.

### Added — redesign tooling

- `data-contract-freeze.mjs`: freezes the API surface before a migration and
  diffs it afterwards. Removing an endpoint, removing a status code, changing
  auth, or narrowing a nullable type are breaking; a breaking change without a
  record in `APPROVALS.json` exits 1
- `spec-extract.mjs`: static extraction of routes, models, validation and auth.
  What it cannot read statically is reported in `unknowns[]` rather than guessed
- `preservation-capture.mjs`: records the behaviour a migration must preserve,
  statically and — when a browser is available — through Playwright. It refuses
  a production host, and it never reports an empty capture as a success
- `golden-test-runner.mjs`: runs the suite that pins observable behaviour. An
  empty suite exits 0 with the note that this is an absence of tests, not a
  pass; a missing browser or base URL exits 2, because failing closed is the
  only safe answer to "I could not check"
- `migrate-route.mjs`: enforces the 9-step order. Step 1 is always permitted;
  any later step requires a lower step migrated first, so a router bug surfaces
  on a low-traffic route rather than on checkout
- `rollback.mjs`: records the intent, the target and the reason. It records
  `"flipped": false` — it does not own a flag store, and claiming a flip it did
  not perform is the one failure a rollback tool cannot afford
- `verify-frontend.sh`: lint, typecheck, build and frontend tests, skipping
  anything that touches the database unless `FRONTEND_SKIP_DB=1`

### Added — guards

- `no-prod-touch.sh`: scans configuration for production connection targets.
  It refuses `WIL_ALLOW_PROD=1` outright — there is no environment variable
  that turns this guard off
- `no-schema-change.sh`: enforces the data-contract freeze, including the case
  where a committed contract is deleted rather than edited
- `golden-tests-must-pass.sh`: refuses a production base URL, then maps the
  runner's exit codes to pass/fail/fail-closed

### Added — references

- `priority-formula.md`, `stop-conditions.md`, `state-schema.md`,
  `subagent-prompts.md`, `focus-profiles.md`, `redesign-rubric.md`,
  `strangler-pattern.md`, `data-contract-rules.md`, `golden-tests-guide.md`,
  `rollback-playbook.md` — ten documents, each answering one question the
  SKILL.md raises but cannot answer in a table

### Added — examples

- `finding.example.json`, `FOCUS.example.json`, `STATE.example.md`,
  `DATA_CONTRACT.example.json`, `SPEC.example.json`,
  `ROUTE_MIGRATION.example.json`, `ROLLBACK.example.json`, and a runnable
  `workflow.example.mjs` that spawns ten agents, merges and ranks them

### Added — CI

- `redesign-gate.yml`: `workflow_dispatch` only, with no `push` and no
  `schedule`. It measures; a human decides. The one gate that can fail the run
  is an unapproved breaking contract change
- `vibe-forge-nightly.yml`: a scheduled measurement sweep that pushes nothing

### Added — self-checks

- `test-report.sh` and `test-migration.sh`, wired into `npm test` alongside
  the stop-hook, guard and measure suites

### Changed

- Commands are namespaced: `/web-improvement-loop:full` rather than `/full`.
  The legacy `/improve-site` command is preserved and still works
- `idea-pitch-format.md`: rules reordered so they read 1–5 before the build
  cost estimate that depends on them
- `README.md` rewritten against the implementation. The previous Focus table
  listed metrics and agent sets that do not exist in `focus-resolver.mjs`

### Fixed

- `no-schema-change.sh` returned early when the contract file was absent, which
  ran the missing-file check before the git-deletion check — so deleting a
  committed contract short-circuited past the exact guard meant to catch it.
  `test-migration.sh` found this.

### Notes

- The redesign rubric scores preservation fidelity at 25 of 100, the heaviest
  single weight. A redesign that looks better and silently drops a feature is a
  net loss, and the score says so.
- Rollback is a flag flip: under 5 seconds, against a 5-minute `git revert`.
- A redesign is a migration, not a rewrite. If it cannot be rolled back in
  seconds, it is not ready.
