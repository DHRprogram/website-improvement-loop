# Phase B9: Remaining Roles

Implement the specialized agent services that were not covered in earlier phases: designer, frontend, backend, QA, security, DevOps, and reviewer roles — each with their own prompt templates, output formats, and quality checks.

## Purpose

The orchestrator routes tasks to agents based on role. This phase creates the actual agent service implementations for every role defined in ROLE_PROMPTS. Each agent has its own execution flow optimized for its domain: the designer works with Figma-style specs, the frontend writes HTML/CSS/JS files, the backend handles API endpoints and database migrations, etc.

## Timing

Runs after B5 (agent runtime) which provides the sandbox execution environment, and after B6 (git bridge) which provides branch/PR creation. These agents need both to produce deliverable work in version control.

## Inputs

- `shared/role_prompts.py` prompt templates from B1
- Agent runtime sandbox from B5 executing tasks in isolated containers
- Git bridge from B6 creating branches and draft PRs
- Memory service from B4 allowing agents to search past similar work

## Outputs

- DesignerAgent: produces design spec JSON with layout descriptions, color tokens, typography scale, component states, accessibility annotations
- FrontendAgent: implements HTML pages or components using the approved design specs as input; validates against WCAG 2.2 AA baseline
- BackendAgent: generates Django models, serializers, viewsets, and migration files; runs schema check before commit
- QAEngineer: produces test plan documents, generates pytest file skeletons with describe/it blocks covering happy path, edge cases, and error paths
- SecurityAuditor: produces threat model reports identifying data flow risks, OWASP Top 10 relevance per endpoint, recommended mitigations with priority scores
- DevOpsEngineer: produces deployment configuration (Dockerfile additions, CI workflow YAML entries, monitoring alerts), validates syntax before commit
- CodeReviewer: analyzes diff outputs from completed tasks, produces structured review reports with findings at severity levels (critical/high/medium/low/info), references specific lines and code snippets

## Steps

1. Define a base AgentService class providing common behavior: task validation, LLM client integration, result construction, event publishing. All seven agent services inherit from this base.
2. Implement DesignerAgent: receives a task with UI change description, calls the LLM with the designer prompt template to generate a design spec object, validates the output against the DesignSpecSchema (must include layout_tokens dict, color_tokens dict, typography_scale list, components array with state definitions). Stores the spec as an artifact at path = `/design/{task_id}.json`.
3. Implement FrontendAgent: receives a task with optional design_spec reference, implements the described changes by writing/modifying files under allowed_paths, runs html validator on generated HTML, css validator on generated stylesheets, and lints JavaScript files. Stores a summary of changed files as artifacts. Validates minimum accessibility score of 85/100 using axe-core HTML report parsing.
4. Implement BackendAgent: receives a task describing API or data model changes, generates Django model classes and DRF serializers, creates migration files using Django's makemigrations --dry-run pattern to validate without writing, only commits if dry-run succeeds. Generates OpenAPI spec fragments for new endpoints. Stores migration history as artifacts.
5. Implement QAEngineer: receives a task and the current test suite structure, analyzes code coverage gaps relevant to the task scope, generates test files following the project's existing test naming and structure conventions (test_{module}.py files), includes test functions for each boundary condition identified. Runs tests locally in the sandbox to verify they pass before committing.
6. Implement SecurityAuditor: receives a task scope and the affected code, performs automated threat analysis: checks for SQL injection vectors (string formatting in queries), XSS risks (template rendering without escaping), authentication bypass patterns (missing permission decorators), secret exposure (hardcoded credentials), insecure dependencies (known CVE versions in requirements files). Produces a structured ThreatModel report with finding objects containing {category, severity, description, location, remediation}.
7. Implement DevOpsEngineer: receives a deployment-related task, generates Dockerfile instructions for any new service dependencies, updates docker-compose.yml with new volume mounts or environment variables, writes GitHub Actions workflow fragments for CI steps. Validates YAML syntax before committing. Checks that no new ports are exposed beyond the declared service mesh.
8. Implement CodeReviewer: receives a list of task results with diff summaries, generates a structured review report comparing the changes against the original goal criteria, flags deviations from the plan, checks code style consistency with project conventions, identifies potential regressions by examining callers of modified functions. Report format: {findings: [{severity, category, file, line, message, suggestion}], overall_score: 0.0-1.0}.
9. Run syntax check on all agent service Python files.
10. Publish ROLES_IMPLEMENTED event.

## Checklist

- [ ] Base AgentService class defined with init(task_spec, llm_client, event_bus) method signature
- [ ] DesignerAgent produces DesignSpecSchema-compliant JSON with all five required fields
- [ ] DesignerAgent stores spec artifact at /design/{task_id}.json path
- [ ] FrontendAgent writes only within allowed_paths boundaries
- [ ] FrontendAgent validates HTML with html.validator.validate() function returning pass/fail
- [ ] FrontendAgent checks CSS validity via css-validator equivalent
- [ ] FrontendAgent lints JS files through es-lint-compatible checker
- [ ] FrontendAgent parses axe-core HTML report and enforces minimum score >= 85/100
- [ ] BackendAgent generates Django model class strings matching project model style conventions
- [ ] BackendAgent runs makemigrations --dry-run before committing any migration files
- [ ] BackendAgent generates OpenAPI spec fragments for each new endpoint
- [ ] QAEngineer generates test files named test_{module}.py following project conventions
- [ ] QAEngineer includes test cases for each boundary condition identified in the task scope
- [ ] QAEngineer executes generated tests in sandbox before reporting success
- [ ] SecurityAuditor checks for SQL injection, XSS, auth bypass, secret exposure, vulnerable deps
- [ ] SecurityAuditor produces structured ThreatModel with finding objects having all five fields
- [ ] Finding severity values restricted to: critical, high, medium, low, info
- [ ] DevOpsEngineer validates generated YAML files before committing changes
- [ ] DevOpsEngineer checks docker-compose.yml port mappings don't expose undeclared ports
- [ ] CodeReviewer compares changes against original goal criteria from plan.json
- [ ] CodeReviewer identifies callers of modified functions for regression assessment
- [ ] CodeReviewer report includes findings array and overall_score field
- [ ] Severity values in review findings match exactly: critical, high, medium, low, info
- [ ] All agent service Python files pass py_compile validation
- [ ] ROLES_IMPLEMENTED event published to event bus

## Rollback

If any agent produces output that violates its contract (e.g., designer produces missing color_tokens, backend generates invalid migrations, QA generates non-compiling tests), skip that agent's contribution entirely rather than accepting partial output. Log the violation under topic `{role}.output_invalid` with the task ID and field name that failed validation. Notify the human operator that this agent's output was skipped and the task may need manual intervention. Do not block other agents — continue processing remaining tasks in parallel where possible.
