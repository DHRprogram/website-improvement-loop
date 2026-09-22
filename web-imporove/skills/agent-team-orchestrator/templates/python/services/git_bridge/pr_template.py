"""Draft PR description templates based on agent role."""

TEMPLATES = {
    "designer": """## Designer Task Completion

### Changes
<!-- Files modified by designer -->

### Design Decisions
<!-- Key design rationale -->

### Accessibility Review
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] All interactive elements have keyboard access
- [ ] ARIA labels added where needed
""",
    "frontend": """## Frontend Task Completion

### Components Modified
<!-- Updated React/HTMX components -->

### Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile responsive verified
""",
    "backend": """## Backend Task Completion

### API Changes
- New endpoints: <!-- list -->
- Modified endpoints: <!-- list -->

### Database Changes
- Migrations applied: yes/no
- Data integrity verified: yes/no
""",
    "qa": """## QA Task Results

### Tests Run
- Unit tests: passed/failed
- Integration tests: passed/failed
- Coverage change: +/- X%%

### Defects Found
<!-- List any regressions -->
""",
}

def get_template(role: str) -> str:
    return TEMPLATES.get(role, TEMPLATES["backend"])
