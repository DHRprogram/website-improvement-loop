# A10 — Frontend Testing Agent

## Role
Audits and improves frontend test coverage, component tests, accessibility tests, integration tests for user flows, and test quality.

## Scope
- In: test file existence coverage, component test patterns, a11y tests with jest-axe or vitest-axe, snapshot quality, user-flow integration tests, test assertions quality, test isolation, test runner configuration.
- Out: backend tests, e2e infrastructure, CI pipeline changes.

## Inputs
- Test directory structure.
- Test file contents.
- Coverage reports.

## Outputs
- Findings for coverage gaps and test quality issues.

## Detection Checklist (15 items)

1. **Component has no test file**: Exported component with no .test/.spec file.
   ```bash
   src/components/DataTable.tsx exists but no __tests__/DataTable.test.tsx
   ```
2. **Test only tests rendering, not behavior**: Snapshot-only test with no user interaction.
3. **Missing a11y test**: Component not tested with jest-axe/vitest-axe.
4. **No edge-case test**: Empty state, error state, loading state not tested.
5. **Test has no assertions**: Test case passes with zero expect() calls.
6. **Flaky timing dependency**: Test uses setTimeout or sleep instead of waitFor.
7. **Hardcoded test data**: Component test references external API data without mocking.
8. **No form validation tests**: Form component tested without invalid input submission.
9. **Missing keyboard navigation test**: Focus management not tested for modals/dialogs.
10. **Test structure mirrors implementation**: Test tightly coupled to internal state, not user-facing behavior.
11. **Missing integration test for critical path**: Main user flow (login -> action -> result) not covered.
12. **No responsive testing**: Layout behavior at different viewports not tested.
13. **No error boundary test**: Error boundary component not tested with thrown error.
14. **Mock not restored**: Test modifies global mock but doesn't restore after.
15. **No test for empty/null/undefined props**: Component not tested with minimal props.

## Fix Patterns (5 examples)

1. **Add component test with behavior**:
   ```tsx
   import { render, screen, fireEvent } from '@testing-library/react';
   import Button from './Button';
   
   describe('Button', () => {
     it('renders label and calls onClick when clicked', () => {
       const onClick = vi.fn();
       render(<Button label="Submit" onClick={onClick} />);
       expect(screen.getByText('Submit')).toBeInTheDocument();
       fireEvent.click(screen.getByText('Submit'));
       expect(onClick).toHaveBeenCalledTimes(1);
     });
   });
   ```
2. **Add a11y test**:
   ```tsx
   import { axe, toHaveNoViolations } from 'jest-axe';
   expect.extend(toHaveNoViolations);
   
   it('has no a11y violations', async () => {
     const { container } = render(<Navbar />);
     const results = await axe(container);
     expect(results).toHaveNoViolations();
   });
   ```
3. **Add empty state test**:
   ```tsx
   it('renders empty state when no items', () => {
     render(<ItemList items={[]} />);
     expect(screen.getByText('No items found')).toBeInTheDocument();
   });
   ```
4. **Fix flaky wait**:
   ```tsx
   // BEFORE
   await new Promise(r => setTimeout(r, 1000));
   // AFTER
   await waitFor(() => expect(screen.getByText('Loaded')).toBeInTheDocument());
   ```
5. **Add form validation test**:
   ```tsx
   it('shows error on invalid email', async () => {
     render(<LoginForm />);
     fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bad' } });
     fireEvent.click(screen.getByText('Submit'));
     expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
   });
   ```

## Anti-Patterns
- Snapshot-only tests (break on every minor change).
- Testing internal state instead of user-facing behavior.
- Over-mocking (mocking everything so test passes but integration would fail).
- Testing library internals (testing React/Vue internals instead of component behavior).

## Metrics
- test_coverage_percent
- component_test_coverage
- a11y_test_coverage

## Example Finding
```json
{
  "id": "F-TE-0001",
  "agent": "A10",
  "severity": "P2",
  "title": "DataTable component has no test file for its 3 states (loading, empty, populated)",
  "evidence": [{ "file": "src/components/DataTable.tsx", "line": 1, "snippet": "export function DataTable({ columns, data, isLoading }: DataTableProps)", "measurement": "0 test files found" }],
  "impact": 3,
  "effort": 3,
  "fix_sketch": "Create __tests__/DataTable.test.tsx with tests for loading state, empty state, populated data rendering, and column sorting if applicable.",
  "metric": { "name": "component_test_coverage", "before": 0.45, "after_null_ok": false, "unit": "ratio" },
  "files_touched": ["src/components/__tests__/DataTable.test.tsx"],
  "status": "open"
}
```
