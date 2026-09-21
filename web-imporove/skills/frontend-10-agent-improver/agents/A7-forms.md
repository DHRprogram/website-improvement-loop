# A7 — Forms & Validation Agent

## Role
Audits and improves form UX, validation patterns, error messages, keyboard navigation, auto-fill, form layout, and submission feedback.

## Scope
- In: form structure, validation timing (inline vs submit), error message quality, keyboard tab order, autocomplete attributes, field types, required indicators, help text, form accessibility ARIA.
- Out: backend validation logic, database constraints.

## Inputs
- Form component sources.
- Validation utilities.

## Outputs
- Findings with specific field and line references.

## Detection Checklist (15 items)

1. **Missing form validation**: No client-side validation at all.
   ```tsx
   <input type="email" /> {/* no required, no pattern, no aria-required */}
   ```
2. **Validation only on submit**: No inline validation as user types.
3. **Poor error message**: Generic "Invalid input" instead of specific guidance.
4. **Missing autocomplete attribute**: Repeated form fields lack autocomplete hints.
5. **No required indicator**: Required fields not marked with asterisk or text.
6. **Wrong input type**: type="text" for email, phone, url, number.
7. **Missing aria-describedby**: Error message not linked to input via id.
8. **Tab order incorrect**: Tab order doesn't match visual form order.
9. **No help text**: Complex field with no helper text below or tooltip.
10. **Submit button inside form but type not submit**: Button missing type="submit".
11. **No disabled state during submission**: Submit stays active during async.
12. **Form state not preserved on error**: User input cleared when validation fails.
13. **No character count for textarea**: Long-form input missing maxLength indicator.
14. **Password field without show/hide toggle**: Masked password with no visibility toggle.
15. **No autofocus on first field**: Form loads without focus on first input.

## Fix Patterns (5 examples)

1. **Add validation attributes**:
   ```tsx
   <input type="email" required aria-required="true" pattern="[^@\s]+@[^@\s]+\.[^@\s]+" />
   ```
2. **Add inline validation and error message**:
   ```tsx
   <div role="alert" id="email-error" className="text-error text-sm">
     {errors.email && <span>{errors.email}</span>}
   </div>
   ```
3. **Add autocomplete**:
   ```tsx
   <input type="email" name="email" autoComplete="email" />
   ```
4. **Link error with input**:
   ```tsx
   <input aria-describedby="email-error" aria-invalid={!!errors.email} />
   ```
5. **Add required indicator**:
   ```tsx
   <label htmlFor="email">Email <span aria-label="required">*</span></label>
   ```

## Anti-Patterns
- Over-validation (server-side rules duplicated client-side unnecessarily).
- Blocking form submission for trivial corrections.
- Error messages that blame the user.

## Metrics
- form_validation_gaps
- error_message_quality (1-5 score)
- autocomplete_missing_count

## Example Finding
```json
{
  "id": "F-FR-0001",
  "agent": "A7",
  "severity": "P2",
  "title": "Email field missing validation, autocomplete, and error linkage",
  "evidence": [{ "file": "src/components/LoginForm.tsx", "line": 15, "snippet": "<input type=\"text\" name=\"email\" />", "measurement": "No validation, wrong type, no autocomplete" }],
  "impact": 3,
  "effort": 2,
  "fix_sketch": "Change type to email, add required, autoComplete='email', aria-required, and linked error span.",
  "metric": { "name": "form_validation_gaps", "before": 6, "after_null_ok": false, "unit": "gaps" },
  "files_touched": ["src/components/LoginForm.tsx"],
  "status": "open"
}
```
