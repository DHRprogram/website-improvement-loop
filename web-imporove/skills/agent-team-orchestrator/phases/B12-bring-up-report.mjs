# Phase B12: Bring-Up Report

Generate a comprehensive system status report summarizing all phases completed, services healthy, test results, budget utilization, and readiness for production deployment. This is the final validation gate before the team considers itself operational.

## Purpose

After twelve build phases plus two planning phases, operators need a single document answering: "Is this system ready?" The bring-up report provides evidence-based answers — not opinions. Each claim is backed by a verifiable data point: health check result, test assertion count, metric value, audit log entry.

## Timing

Runs after B11 (tests) pass with >= 80% coverage. Consumes telemetry from B10 (observability), artifacts from B9 (roles), PR data from B6 (git bridge). Produces the final readiness verdict that gates production deployment.

## Inputs

- Health check results from all eight services (GET /health on each)
- Test suite results from B11 (pass/fail counts, coverage percentage)
- Budget tracker current state from `scripts/budget-tracker.mjs`
- Event bus recent events from the last 24 hours
- Git bridge status showing open PRs, branch count, merge status
- OTEL trace sampling showing at least one complete end-to-end trace
- Hard stop status from budget guard

## Outputs

- Structured JSON report at `reports/bringup-{timestamp}.json` containing all sections below
- Console summary printed to stdout for quick scanning
- Human-readable markdown version saved as `reports/bringup-{timestamp}.md` for documentation

## Steps

1. Collect health check results: iterate over all eight services, send GET /health, record HTTP status code, response body otel_status field, and total response time in milliseconds. Compute aggregate status: HEALTHY if all services return 200 with otel_status != disconnected.
2. Collect test results: parse pytest output for total passed, failed, skipped, error counts. Read coverage XML report for overall line percentage. Record minimum per-package coverage values to identify weakly tested areas. Verdict: PASS if all tests pass and coverage >= 80%.
3. Collect budget state: read current spent_usd, total_cap, remaining_usd from budget tracker. Compute spend_rate_per_hour = spent_usd / elapsed_hours_since_start. Projected_total = spent_usd + (remaining_budget / average_task_duration_hours * cost_per_task). Flag projected_total > total_cap as WARNING. Verdict: OK if spent < total_cap.
4. Collect observability metrics: query Prometheus endpoints on gateway service for http_requests_total count and http_request_duration_seconds p95 value. Request at least one complete end-to-end trace ID from Jaeger API (trace id matching any task.completed event correlation-id). Verify trace has spans from: gateway -> orchestrator -> agent runtime -> sandbox -> git bridge. Count total traces collected in the past 24 hours. Verdict: PASS if at least one complete trace exists and p95 latency < 5 seconds.
5. Collect security scan results: run no-secrets.sh guard against committed files, verify sandbox network policy is enforced on all running containers, verify git bridge opens only draft PRs, verify path enforcement blocked zero unauthorized access attempts (if non-zero, flag as CRITICAL). Verdict: PASS if all guards return exit 0 and zero unauthorized accesses detected.
6. Collect integration test results: re-run the pipeline integration test, record pass/fail, execution time, and any partial outputs. Verdict: PASS if test completes within timeout with all assertions green.
7. Compile verdict: compute an overall_readiness score = min(service_health_score, test_coverage_score, security_score, observability_score, integration_score) where each component is weighted equally at 20%. Overall verdict: READY if score >= 0.9, DEGRADED if >= 0.7, UNREADY if below 0.7.
8. Write the structured JSON report and markdown summary to the reports directory. Include all section details, individual verdicts, computed score, and actionable recommendations for any DEGRADED or UNREADY items.
9. Publish FINAL_VERDICT event with the overall readiness score and status.

## Checklist

- [ ] Health checks collected from all eight services via GET /health
- [ ] Each health check records HTTP status, otel_status field, response duration ms
- [ ] Aggregate health status correctly computes from individual results (all 200 + connected = HEALTHY)
- [ ] Test results parsed: pass, fail, skip, error counts extracted from pytest output
- [ ] Coverage percentages read from XML report with per-package breakdown
- [ ] Budget state recorded: spent, cap, remaining, rate-per-hour, projected total
- [ ] Projected budget overrun flagged as WARNING if projection exceeds cap
- [ ] Prometheus metrics queried: request count counter and p95 latency histogram
- [ ] At least one complete end-to-end trace verified spanning all five hop points
- [ ] Total traces in last 24 hours counted and reported
- [ ] Security guards executed: secrets check, sandbox policy, draft-only PR, path enforcement
- [ ] Unauthorized access attempts counted; non-zero triggers CRITICAL flag
- [ ] Integration pipeline test re-executed and result recorded
- [ ] Overall readiness score computed as weighted average of five components
- [ ] Verdict threshold applied: READY >= 0.9, DEGRADED >= 0.7, UNREADY < 0.7
- [ ] JSON report written to reports/bringup-{ISO-timestamp}.json with all section data
- [ ] Markdown summary written to reports/bringup-{ISO-timestamp}.md for human consumption
- [ ] Markdown includes executive summary, per-section verdicts, recommendations list
- [ ] FINAL_VERDICT event published with overall score and status string

## Rollback

If the overall verdict is DEGRADED or UNREADY, do not mark the system as operational. Instead, produce a prioritized remediation plan listing the lowest-scoring sections first, with specific actions needed to improve each one. The bring-up report becomes an actionable TODO list rather than a seal of approval. The operator must address each recommendation before declaring the system ready. If critical security findings exist (unauthorized access attempts > 0 or secrets detected in committed files), immediately halt all agent operations, revoke compromised credentials, rotate affected API keys, and quarantine affected containers before proceeding with any remediation.
