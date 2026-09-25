# Golden Tests

A golden test pins observable behaviour before a migration, so that "did this
change anything?" has an answer other than "it looked fine in the browser".

Runner: `scripts/golden-test-runner.mjs`
Gate: `scripts/guards/golden-tests-must-pass.sh`
Location: `tests/golden/*.spec.ts`

## What One Is

A golden test asserts the **output** of a unit of behaviour, not its
implementation. Rendering the same component with the same props must produce
the same accessible tree. The same endpoint with the same input must return the
same shape. The same input sequence must produce the same sequence of events.

What it deliberately does not assert: variable internals, class names,
whitespace between elements, and the order of two elements that are visually
side by side. Pinning those turns every refactor into a test failure and trains
everyone to update snapshots without reading them.

## Writing One

```ts
import { test, expect } from '@playwright/test';

test('checkout: card form submits and returns a receipt', async ({ page }) => {
  // Golden tests are pinned against the LEGACY route first. This is the whole
  // point: the expected value comes from the system that is about to be
  // replaced, not from the system being built.
  await page.goto('/checkout');

  await page.getByLabel('Card number').fill('4242424242424242');
  await page.getByLabel('Expiry').fill('12/30');
  await page.getByLabel('CVC').fill('123');
  await page.getByRole('button', { name: 'Pay' }).click();

  const receipt = await page.getByTestId('receipt').innerText();
  expect(receipt).toMatchSnapshot('checkout-receipt.txt');
});
```

### The Procedure

1. Point the test at the **legacy** route.
2. Run it. The first run records the snapshot; review it before accepting.
3. Do not edit the snapshot to make a failing test pass. That is how a golden
   test becomes a rubber stamp.
4. Migrate the route.
5. Run it again. A diff means observable behaviour changed.
6. Decide: intended change → update the snapshot with a written reason;
   unintended → the migration is wrong, fix it.

Step 3 is the rule that matters. A golden test that has been updated without
reading the diff has verified nothing.

## What to Pin

| Pin | Do not pin |
|---|---|
| Accessible names and roles | Internal component state |
| Visible text content | Class names or CSS selectors |
| Form field names and values | Event handler identity |
| Request paths and methods | Function call graphs |
| Status codes and response shapes | Timing and ordering of independent calls |
| Navigation targets | DOM depth |
| Focus order through a flow | Inline styles |

## Interpreting a Failure

A golden failure is evidence, not a verdict. Read the diff and answer one
question: **was this change supposed to change this?**

| Diff | Meaning | Action |
|---|---|---|
| Text changed, change was intended | Working as designed | Update the snapshot, record the reason |
| Text changed, not intended | Regression | Revert the migration step |
| Field disappeared | Breaking contract change | Stop; needs contract approval |
| Field became `null` | Narrowing | Stop; contract violation |
| Order changed on a visible sequence | Real regression | Revert; order carries meaning to users |
| Order changed between side-by-side elements | Noise | Add an explicit sort before comparing |
| Test errors before asserting | The code is broken | Fix the error; a test that cannot run protects nothing |

The last row is a special case worth internalising: a golden test that throws
before its assertion has passed nothing, and its failure must never be
refreshed away.

## How a Failure Stops the Migration

`migrate-route.mjs` runs the golden tests after flipping the flag. On failure
it flips the flag back and exits non-zero.

```
flag flipped: /checkout → new
golden test:  checkout-receipt.txt  FAILED
  - "Order #10482 confirmed"
  + "Order #10483 confirmed"
1 of 3 golden tests failed.
Rolling back /checkout.
```

The rollback is automatic because the flag flip is already the mechanism, and
rolling back is turning it off. The loop never proceeds to the next route with
a failing golden test.

## Golden Tests and `no-prod-touch.sh`

Golden tests pin behaviour on a **test environment**. Running them against
production is forbidden, and the two guards are complementary:

- `no-prod-touch.sh` blocks any change whose configuration points a database
  URL at production.
- `golden-test-runner.mjs` refuses to run unless a test base URL is set and it
  is not a production host.

Between them, a migration cannot quietly run its tests against real data.

## Keeping the Suite Honest

| Practice | Why |
|---|---|
| Review every snapshot diff | The review is the entire value. |
| Delete tests for removed features deliberately | A deleted test hides a deleted feature. |
| Fail the build on a missing snapshot | CI never writes a first snapshot. |
| Cap snapshot size | A 4000-line snapshot is never read. |
| Re-pin on a documented change only | Otherwise "expected" becomes "current". |
| Count snapshot updates in the diff stat | A PR with 40 changed snapshots is not reviewed, it is rubber-stamped. |

That last row is the failure mode that actually occurs. A pull request whose
snapshot churn is large should be treated as a redesign, not an update.

## Running

```sh
node scripts/golden-test-runner.mjs --project=. --base-url=http://localhost:3000
node scripts/golden-test-runner.mjs --project=. --base-url=http://localhost:3000 --update
bash scripts/guards/golden-tests-must-pass.sh .
```

`--update` rewrites snapshots. It is for a deliberate, reviewed change and for
nothing else. An empty suite exits 0 with a clear notice that nothing ran, so
that "no tests" is never mistaken for "all tests pass".
