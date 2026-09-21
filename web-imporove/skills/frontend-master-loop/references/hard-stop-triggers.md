# Hard Stop Triggers

HST-01: Golden Test fails after 3 self-heal attempts.
  Detection: golden-tests-must-pass.sh exits non-zero after 3 retries.
  Response: revert commit, flip flag off, write HST report.

HST-02: SLO error budget consumption > 25% during canary.
  Detection: canary.mjs monitors error rate. If budet exceeded, stop.
  Response: flip canary to 0%, write HST report.

HST-03: Security gate finds high/critical vulnerability.
  Detection: security-gate.sh or npm audit.
  Response: revert affected changes, block route, write HST report.

HST-04: Data Contract drift detected.
  Detection: no-schema-change.sh detects schema or API shape change.
  Response: rollback migration, freeze again, write HST report.

HST-05: Cost delta > approved max.
  Detection: cost-delta.sh or cost-delta.mjs.
  Response: revert recent changes, write HST report.

HST-06: Attempt to touch production DB.
  Detection: no-prod-touch.sh detects production URL or hostname.
  Response: block immediately, write HST report.

HST-07: Secret leak detected in staged files.
  Detection: no-secret-commit.sh detects secrets.
  Response: block commit, unstage files, write HST report.

HST-08: Backup restore drill fails (restore > 10 min).
  Detection: backup-drill.sh.
  Response: flag drill as failed, improve restore procedure, write HST report.

HST-09: Chaos drill causes SLO breach on staging.
  Detection: chaos-drill.mjs recovery time exceeds threshold.
  Response: halt chaos drill, investigate, write HST report.

HST-10: A11y gate finds critical violation on migrated route.
  Detection: a11y-gate.sh or axe-core results.
  Response: revert route migration, write HST report.

Each HST writes artifacts/redesign/HARD_STOP_<id>_<timestamp>.md and waits
for user input before continuing.
