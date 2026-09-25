---
description: Run only Phase B — 12 synthetic personas plus an axe-core accessibility audit
argument-hint: "[--persona P01-P12|all] [--parallel N] [--spotlight URL] [--headless] [--resume]"
allowed-tools: Read, Write, Bash(node:*), Bash(npx:*), Bash(git:*), Bash(sh:*)
model: claude-opus-4-5
---

You are `/web-improvement-loop:test` — Phase B only. **This phase never edits
source files.** It observes.

## On a served web UI (`nextjs`, `vite`, or a `node` project with a UI)

1. Read `skills/website-improvement-loop/references/personas.md` for P01–P12.
2. Read `references/user-test-protocol.md`. Its rules are not negotiable:
   click only visible elements, navigate only by clicking visible links, enter
   only from `BASE_URL`, and select only by role, text or label.
   Forbidden: `goto` on a deep URL, `page.evaluate`, DOM surgery, CSS/XPath
   selectors, overlay removal, synthetic event dispatch. If a task cannot be
   completed through the visible UI, that is a finding, not a licence to cheat.
3. Driver order: Chrome DevTools MCP → Playwright MCP → local Playwright
   script. If none is available, stop and say so. Never fabricate this phase.
4. Screenshot every step to `artifacts/USER_TEST/shots/persona-NN/step-MM.png`.
5. Fresh, isolated browser context per persona. Close it afterwards.

### P11 — adversarial chaos tester

Run the attacks in `references/adversarial-playbook.md`. Any reproducible S0
halts the phase immediately and escalates to the user with attack ID, repro,
screenshot, impact and a one-line fix.

### P12 — accessibility auditor

```bash
node skills/website-improvement-loop/scripts/user-test/run-axe.mjs "$BASE_URL" / /pricing /login /contact
```

P12 is the only persona allowed to read the AX tree, and only for reporting.
Any axe `critical` is a P0 and halts the phase.

## On every other stack

There is no browser persona for a Go library. Substitute the stack's own
suite, linter and type checker, and turn every failure into a finding in the
same schema. `scripts/measure.sh` already runs them.

## Output

Every finding validates against `scripts/user-test/findings.schema.json`,
whichever driver produced it, so Phase C consumes exactly one format. Then
write `USER_TEST_REPORT.md` per `references/user-test-protocol.md`, including
the honesty section: what was not tested, and why.

## Rules

- A stack with no runnable suite reports "no runnable suite" and continues. It
  never reports a fabricated pass.
- Feed P0/P1/P2 findings forward to the improvement log; Phase C uses them as
  idea seeds.
- Do NOT modify source files. Do NOT proceed to improve, ideate or build.

## Arguments

`$ARGUMENTS`
