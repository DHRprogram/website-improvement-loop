# Focus Profiles

Ten modes. A focus mode selects which subagents run, which metric is primary,
and how eager the loop is to stop. It never changes what an agent is allowed to
do and never widens the safety envelope.

Resolve one with `node scripts/focus-resolver.mjs --focus=<mode> --json`.

## The Table

| Mode | Subagents | Primary metric | Secondary metrics | Min severity | Stop threshold | Description |
|---|---|---|---|---|---|---|
| full | S1,S2,S3,S4,S5,S6,S7,S8,S9,S10 | weighted_findings_open | bundle_kb, lcp_ms, a11y_violations | P2 | 5 iterations, no improvement | Every agent, every dimension. The default. |
| design | S2,S3,S5,S10 | design_system_violations | spacing_inconsistencies, typography_violations | P2 | 3 iterations, no improvement | Visual coherence and accessibility of the interface. |
| bugs | S1,S6,S9 | p0_p1_open | unhandled_rejections, test_gap_count | P1 | 3 iterations, no improvement | Correctness. Highest severity floor in the set. |
| perf | S4,S10 | perf_regressions | bundle_kb, lcp_ms, cls | P2 | 4 iterations, no improvement | Speed and weight, measured not guessed. |
| a11y | S5,S3,S2 | a11y_violations | contrast_failures, focus_traps | P2 | 3 iterations, no improvement | Keyboard, screen reader, contrast, motion. |
| security | S8,S9 | security_findings_open | exposed_secrets, unvalidated_inputs | P1 | 3 iterations, no improvement | Injection, auth, secrets, dependencies. |
| seo | S7,S4 | seo_defects | lighthouse_seo, crawl_errors | P3 | 4 iterations, no improvement | Technical SEO and crawlable structure. |
| frontend | S2,S3,S4,S5,S10 | frontend_quality_score | bundle_kb, lcp_ms, a11y_violations | P2 | 4 iterations, no improvement | Frontend only. Backend guarded out. |
| backend | S1,S8,S9 | backend_findings_open | n_plus_one, missing_validation | P2 | 4 iterations, no improvement | Server correctness. Requires approval to act. |
| redesign | S2,S3,S5,S9 | preservation_delta | spec_compliance, rollback_readiness | P2 | 6 iterations, no improvement | Strangler migration under the redesign rubric. |

## Metric Direction

Each metric has a direction, and the direction is what "improvement" means.
Getting this backwards makes the loop optimise for the wrong thing.

| Metric | Direction | Lower is better |
|---|---|---|
| `weighted_findings_open` | lower | yes |
| `p0_p1_open` | lower | yes |
| `design_system_violations` | lower | yes |
| `a11y_violations` | lower | yes |
| `seo_defects` | lower | yes |
| `security_findings_open` | lower | yes |
| `backend_findings_open` | lower | yes |
| `perf_regressions` | lower | yes |
| `bundle_kb` | lower | yes |
| `lcp_ms` | lower | yes |
| `cls` | lower | yes |
| `preservation_delta` | lower | yes |
| `frontend_quality_score` | higher | no |
| `lighthouse_seo` | higher | no |

`metric-must-improve.sh` infers direction from the name when it is not given
explicitly, but an explicit direction always wins.

## Per-Mode Detail

### full

All ten agents, severity floor P2. Used when there is no specific complaint and
the site needs a general pass. The broadest mode and the slowest: expect the
loop to spend its first iteration on measurement rather than fixes.

### design

S2, S3, S5, S10 at P2. The primary metric is a count of design-system
violations — inconsistent radii, off-scale spacing, type outside the scale.
Secondary metrics catch the symptoms a user actually feels: mismatched spacing
and unreadable type.

Because violations are countable, this mode converges faster than `full`. It
also stops early if the count plateaus, which is the signal that the remaining
violations need a design decision rather than another pass.

### bugs

S1, S6, S9 at **P1**. A P2 bug is not queued. The primary metric counts open
P0/P1 only, so the loop is not distracted by polish while something is broken.

Extra stop rule: if a P0 that was previously fixed reappears, the loop stops
immediately. A fix that does not hold is a human problem.

### perf

S4, S10 at P2. Every finding carries a measured number. Secondary metrics are
the standard web vitals, so "faster" has a definition.

Extra stop rule: two consecutive iterations where the bundle grows stops the
run. A loop that is making the site bigger is not improving it.

### a11y

S5, S3, S2 at P2. S5 leads with axe, S3 catches what axe cannot see (an
unclear label order, a flow that traps a screen reader user in a dead end), S2
catches the visual half of accessibility — contrast and focus rings are design
decisions as much as technical ones.

The loop stops at zero violations. That is a genuinely reachable target and
worth stopping on.

### security

S8, S9 at **P1**. Sub-P1 security findings are deferred: fixing a P3 header
hardening issue while an auth bypass sits open is the wrong order.

Extra stop rule: any P0 security finding appearing stops the run and requires a
human. The loop will not autonomously remediate an auth bypass.

### seo

S7, S4 at **P3** — the only mode with a P3 floor, because SEO defects are
rarely urgent and the list is long. S4 joins because Core Web Vitals is both
performance and a ranking signal.

### frontend

S2, S3, S4, S5, S10 at P2. Backend files are guarded out by
`guards/no-backend-touch.sh`, which fails the commit if a server, API, schema,
migration, or `.sql` file is staged. The guard is what makes this mode safe to
run unattended.

### backend

S1, S8, S9 at P2. Findings are reported but **not applied** without explicit
approval — this is the one mode where the loop's default action is to stop and
ask. Auth, payments, and schema changes always require a human.

### redesign

S2, S3, S5, S9 at P2 under the strangler pattern. The primary metric is
`preservation_delta`: how much observable behaviour changed. Lower is better,
and a redesign that improves everything except preservation has failed even if
the score rose.

Extra stop rule: the loop never stops on metrics alone while a cutover is
pending. A pending cutover is a human decision.

## Choosing a Mode

| The complaint is | Use |
|---|---|
| "just make it better" | `full` |
| "it looks inconsistent" | `design` |
| "users are reporting errors" | `bugs` |
| "it's slow" | `perf` |
| "we're not accessible enough" | `a11y` |
| "we had a security scare" | `security` |
| "traffic dropped after a redesign" | `seo` |
| "the frontend is the problem" | `frontend` |
| "the API is the problem" | `backend` |
| "we are replacing the system" | `redesign` |

If two modes fit, take the narrower one. `design` converges faster than `full`
and a design pass that surfaces a real bug is routed to `bugs` on the next
iteration.
