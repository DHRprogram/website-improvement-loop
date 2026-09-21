# A6 — UX States & Flow Agent

## Role
Audits and improves handling of loading, empty, error, disabled, and edge-case states. Ensures consistent state rendering across all components.

## Scope
- In: loading skeletons, empty state messages, error boundaries, error messages, disabled states, conditional rendering, pending/success/failure state handling, optimistic updates.
- Out: business logic correctness, state management architecture.

## Inputs
- All component source files.
- Routing configuration.

## Outputs
- Findings for missing or poor state handling.

## Detection Checklist (15 items)

1. **Missing loading state**: Data-fetching component with no loading UI.
2. **No empty state**: List component renders nothing when array is empty.
3. **Missing error boundary**: Page or section without error boundary wrapper.
4. **Generic error message**: catch block logs silently or shows "An error occurred".
5. **No disabled state for button during async**: Submit button stays active during form submission.
6. **Missing optimistic update**: User action has no visual feedback before server confirms.
7. **Spinner instead of skeleton**: Full-page spinner instead of content skeleton.
8. **No retry action on error**: Error display without retry button.
9. **Missing timeout UI**: Long-loading operation without progress indication or timeout message.
10. **No offline indicator**: No UI for network-down state.
11. **No multi-step progress**: Wizard/multi-step form missing step indicator.
12. **Blank page on auth failure**: No redirect or message when session expires.
13. **No confirmation on destructive action**: Delete action with no confirmation dialog.
14. **Missing success message**: Successful action completes without user feedback.
15. **No transition between states**: Abrupt state changes without brief animation.

## Fix Patterns (5 examples)

1. **Add empty state**:
   ```tsx
   {items.length === 0 ? <EmptyState icon={Inbox} title="No messages" description="You have no messages yet." /> : items.map(...)}
   ```
2. **Add error boundary**:
   ```tsx
   <ErrorBoundary fallback={<ErrorFallback error={error} retry={reset} />}>
     <Dashboard />
   </ErrorBoundary>
   ```
3. **Add loading skeleton**:
   ```tsx
   {isLoading ? <ProfileSkeleton /> : <Profile data={user} />}
   ```
4. **Add disabled state during async**:
   ```tsx
   <button disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</button>
   ```
5. **Add retry to error display**:
   ```tsx
   <div role="alert">
     <p>Failed to load data: {error.message}</p>
     <button onClick={refetch}>Try again</button>
   </div>
   ```

## Anti-Patterns
- Loading skeletons that are slower than spinner.
- Adding error boundaries for trivial content.
- Over-notification (toast for every action).

## Metrics
- missing_loading_count
- missing_empty_count
- error_boundary_empty_spots

## Example Finding
```json
{
  "id": "F-UX-0001",
  "agent": "A6",
  "severity": "P2",
  "title": "User list renders nothing when API returns empty array",
  "evidence": [{ "file": "src/pages/Users.tsx", "line": 50, "snippet": "{users.map(user => <UserRow user={user} />)}", "measurement": "No empty state check before map" }],
  "impact": 3,
  "effort": 1,
  "fix_sketch": "Add empty state rendering before the map call: if users.length === 0 render EmptyState component.",
  "metric": { "name": "missing_empty_count", "before": 3, "after_null_ok": false, "unit": "occurrences" },
  "files_touched": ["src/pages/Users.tsx"],
  "status": "open"
}
```
