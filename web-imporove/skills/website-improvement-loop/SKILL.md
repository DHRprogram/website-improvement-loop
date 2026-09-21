---
name: website-improvement-loop
description: >-
  Audits a website codebase, improves it over 10 measurable iterations,
  runs 12 synthetic users through Chrome (10 demographic personas +
  1 adversarial chaos tester + 1 axe-core accessibility auditor) using
  only visible UI, ideates and pitches product features that turn an MVP
  into a real product, and after explicit user approval builds them to a
  strict Product Quality Bar. Includes a Regression Guard that prevents
  metrics from getting worse and a CI gate. Use when asked to "improve my
  site", "review the codebase", "find where we went wrong", "give me
  product ideas", "run user tests", "make it a real product", or to run
  repeated improvement cycles.
---

# Website Improvement Loop

## Phase Summary

- **Phase A — Improve**: 10 iterations of codebase improvement with before/after measurement.
- **Phase B — Synthetic User Testing**: 12 personas through Chrome via visible UI only.
- **Phase C — Ideate**: 15–25 ideas distilled to 8–12 pitches ready for decision.
- **Phase D — Approval**: Present pitches to user, full stop until explicit approval.
- **Phase E — Build**: Build only approved ideas to Product Quality Bar.
- **Regression Guard**: CI gate that prevents metric degradation.

## Guardrails

1. Never commit secrets, tokens, or keys. Never print secret values.
2. Never destroy databases or delete users.
3. Never change auth, payments, or DB schema without explicit user approval.
4. Each iteration = one small, revertible change.
5. If build/test fails and cannot be resolved in <10 minutes → git revert.
6. Respect the project's design system, naming conventions, and folder structure.
7. If no test/build exists, create a smoke test first.
8. In Phase B/C, never start building. Wait for explicit approval in Phase D.
9. Never make destructive changes to production data.
10. Every commit message must reference the phase and iteration.

## Setup Questions (ask once at start)

1. Target user in one sentence?
2. Primary business goal (signup, revenue, retention, ...)?
3. Constraints: framework lock-in, deadline, brand rules, must-keep features?
4. Which ideas can touch auth/payments/DB schema?
5. BASE_URL for testing?
6. Is login required and with which ENV var? (Never print the value)
7. Budget cap in USD for Phase E builds? (default: unlimited)
   Use `--budget 50` to cap total build cost. Pitches exceeding remaining budget are deferred.

   If unanswered: write reasonable assumptions in AUDIT_BASELINE.md > Assumptions and proceed.

## Phase A — Improve (exactly 10 iterations)

#### --ghost mode
Pass `--ghost` for read-only audit. Generates AUDIT_BASELINE.md, IMPROVEMENT_LOG.md (empty), runs Phase B axe audit, and Phase C ideation — without modifying any source file. Use for code review or pre-PR check.

### A0 Recon
Create AUDIT_BASELINE.md with: stack, structure, routes, components, API layer, DB models, assets, i18n, tests, CI, build/run commands, and metrics snapshot from scripts/measure.sh.

### A1 Baseline scoring
Score 0–10 on 9 dimensions using the rubric below. Record in AUDIT_BASELINE.md.

### A2 Loop

#### --fast mode (single iteration)
Pass `--fast` to skip the 10-iteration loop and run exactly 1 AUDIT → RANK → FIX → SCORE cycle.
Useful for quick smoke improvement without committing to the full loop.
Output: one finding, one fix, one score delta — enough to decide if full loop is worth it.

For each iteration: AUDIT → RANK → PLAN → IMPLEMENT → VERIFY → LOG → SCORE.
Each finding has: id, severity P0–P3, evidence (file:line or URL + measurement), impact, effort, fix sketch.
Priority = severity × impact ÷ effort. Top 3–5 per round.
If metric does not improve: revert or fix.

### A3 Rubric
| # | Dimension | Weight |
|---|-----------|--------|
| 1 | Correctness & bugs | 20 |
| 2 | Performance / CWV | 15 |
| 3 | Accessibility | 15 |
| 4 | SEO & metadata | 10 |
| 5 | UX & conversion | 10 |
| 6 | Code quality | 10 |
| 7 | Security & privacy | 10 |
| 8 | Resilience | 5 |
| 9 | Mobile & responsive | 5 |

Total = Σ(score × weight) / 10. Record baseline → final.

### A4 Misuse hunt
Cover: state, effects, data fetching, caching, DB queries, forms, styling, routing, error handling, auth, env config, dependencies. Output table with Area, Misuse, Evidence, Correct usage, Fix.

### A5 Early exit

#### Auto-revert on score drop
If any iteration causes the rubric total to decrease vs the previous iteration:
  1. Detection: compare score before/after iteration
  2. Action: \`git revert HEAD\` automatically
  3. Log: record the failed attempt in IMPROVEMENT_LOG.md as \`AUTO-REVERT: [finding] — score dropped from X to Y\`
  4. Bump: move to next finding. Do not retry the same approach.

Only if no finding above P3 remains AND last 2 iterations moved <1 point. If exited early, document reason in FINAL_REPORT.md.

### A6 Artifacts
AUDIT_BASELINE.md, IMPROVEMENT_LOG.md, IDEA_BACKLOG.md, metrics/*.json.

## Phase B — Synthetic User Testing (12 personas via Chrome)

#### --spotlight <url>
Run a deep analysis on a single URL. 20 iterations (vs 10), 4 personas focused on that page, 15 adversarial attacks targeting that page's inputs and interactions. Overrides the default route list.

### B0 Prerequisites

#### --resume flag
Pass  to continue from the last checkpoint instead of starting Phase B from scratch.
Checkpoints saved in  after each persona.
Resume restores: completed personas list, current persona index, task progress.



#### --parallel N flag
Pass `--parallel 3` to run personas in 3 parallel browser contexts instead of serially.
Reduces wall time: 12 personas × ~3min each → ~12min with --parallel 3.
Each context is fully isolated (cookies, storage, viewport).
Collision detection built-in: if two personas hit the same form, the second waits 500ms.

Browser driver MCP. Order: Chrome DevTools MCP → Playwright MCP → local Playwright script.
If none available: stop and instruct user. Do not fabricate this phase.

### B1 Personas
Full personas in references/personas.md (P01–P12).

### B1-bis P12 — Accessibility Auditor
Routes: analytics → sitemap → top 5 internal-linked routes.
Run: `node scripts/user-test/run-axe.mjs "$BASE_URL" / /pricing /login /contact`
Output: axe/*.json, axe/summary.json, axe/P12_A11Y.md.
P12 is the only persona allowed to use evaluate/AX API — read-only DOM, never for mutations.
Any axe critical (P0) → halt Phase B + escalate.

### B2 Protocol
Full protocol in references/user-test-protocol.md. Non-negotiable:
- Only visible elements: button, link, input, select, checkbox, tab, menu.
- Selector only by role/text/label.
- Entry only from BASE_URL. All navigation by clicking visible links.
- Forbidden: goto on deep URL, page.evaluate, DOM surgery, CSS selector, XPath, overlay removal, synthetic event dispatch.
- If element not found via visible affordances → finding with severity ≥ P2.
- Respect persona patience. If loader exceeds patience → finding.
- Screenshot every step: artifacts/USER_TEST/shots/persona-NN/step-MM.png.
- Friction score per step: 0 / 1 / 2 / 3.
- Fresh browser context per persona. Isolated cookies/storage.
- Close context after each persona.

### B3 Tasks
Write 3–5 tasks per persona before opening browser. Store in USER_TEST/persona-NN.tasks.md.

### B4 Execution
Run each persona NN=01..12. Output: USER_TEST/persona-NN.json per findings.schema.json.

### B4-bis Halt rule
If P11 has any reproducible S0 → halt Phase B, escalate to user immediately with attack_id, repro, screenshot, impact, and one-line fix. Add to IMPROVEMENT_LOG.md as P0. Run Phase A2-bis (max 3 iterations) to fix. Re-run attack. Then continue.

### B5 Synthesis
Create USER_TEST_REPORT.md containing:
1. Executive summary (top 5 blockers)
2. Table: theme | pages | personas | severity | frequency | evidence
3. Per-persona summary + top 3 quotes (first-person, honest)
4. Top 10 friction points as ready-to-file issues
5. Adversarial section: table of ID | target | severity | reproduced | passes | fix + Top 5 "would embarrass us in production" + untested attacks + flaky list
6. P12 a11y section: table of Sev | Rule | Impact | Target | Routes | Fix
7. "What was NOT tested and why" (honesty section)

### B6 Feed forward
P0/P1/P2 findings → IMPROVEMENT_LOG.md. If fixes needed, Phase A2-bis (max 5 iterations) before C. Recurring themes as seeds for Phase C.

### B7 Regression Guard
1. First run after Phase A: `node scripts/user-test/baseline-save.mjs` → artifacts/BASELINE.json. Commit.
2. Subsequent runs: `node scripts/user-test/baseline-check.mjs`. Thresholds: overall friction +Δ>0.15 FAIL • new P0/P1 FAIL • new S0/S1 FAIL • new axe critical or >2 serious FAIL • per-persona friction +Δ>0.30 FAIL.
3. On regression: do not loosen thresholds, do not re-baseline. Fix cause, re-run Phase B, re-baseline only with explicit approval.
4. CI: scripts/ci/regression-gate.sh on every PR.
5. Re-baseline requires explicit approval. Log in FINAL_REPORT.md > Baseline changes with date/reason/approved_by.

## Phase C — Ideate

#### ROI scoring
Each pitch is auto-ranked by ROI = (success_metric_impact × user_reach) / effort.
- success_metric_impact: estimated % improvement to the business goal
- user_reach: % of users affected
- effort: S=1, M=3, L=8
ROI displayed in IDEA_PITCHES.md. Top 3 by ROI recommended first.



### C1 Sources
Activation, Retention, Conversion, Content & SEO, Trust & Social proof, Distribution, Support & Success, Monetization, "already have the data" (highest ROI). Full in references/ideas.md.

### C2 Filter
Drop if: no success metric, needs rewrite, >1 external dependency, duplicate, or purely cosmetic and baseline score ≥8.

### C3 Pitch
Each pitch per references/idea-pitch-format.md. Each must reference at least one Phase B finding. Ideas without evidence must be explicitly justified. Store in IDEA_PITCHES.md + add to IDEA_BACKLOG.md.

### C4 Present & STOP
Ask exactly:
> 1. Which ideas should I build? (numbers, "all", or "none")
> 2. Which to change or merge?
> 3. If only a few, priority order?
> 4. Build constraints? (auth? DB? payments?)

Then STOP. Do not edit code. Wait for response.
If "all": build by impact÷effort order, smallest first, max 5, get approval before continuing.

## Phase D — Approval

- Record user response verbatim in APPROVED_IDEAS.md with timestamp.
- For each idea: goal, success metric, scope in/out, likely files, risks, detailed acceptance criteria.
- Re-confirm only if auth/payments/DB schema is touched.

## Phase E — Build

### E1 Product Quality Bar
Full in references/product-quality-bar.md. Every shipped idea must have:
UI/UX, States (loading/empty/error/success/offline/slow), A11y (semantic, keyboard, focus visible, labels, contrast AA), Perf (no blocking JS new, images sized/lazy, LCP/CLS before/after), Copy (real, no lorem), Analytics (event for metric), SEO (if new route), Security (server-side validation + authz), Tests (unit + e2e/smoke), Docs, Rollback (one revertible commit).
If any clause unmet, idea is not done.

### E2 Loop

#### --dry-run
Pass `--dry-run` before building to show the planned diff without touching files.
Output: list of files changed, estimated token cost, acceptance criteria check.
If scope creep is detected (>30% more files than estimated), flag it.

PLAN → BASELINE → IMPLEMENT → VERIFY → SHIP-LOG → CONFIRM.

### E3 After all
Re-run Phase A rubric. Write FINAL_REPORT.md.

### E4 Post-build regression check after each idea
1. Re-run 3 most relevant personas.
2. Axe on new/changed route.
3. `node scripts/user-test/baseline-check.mjs`.
4. If FAIL: revert or fix. Never ship-and-hope.
5. Delta in BUILD_LOG.md.

## Artifact Rules

- Each phase writes its files before starting the next phase.
- metrics/ contains one JSON per measurement.
- Previous log is never deleted, only appended with timestamp.

## Interaction Rules

- Setup questions: once.
- Present pitches and STOP.
- Re-confirm only for auth/payments/schema.
- Otherwise run to completion and report at end.
