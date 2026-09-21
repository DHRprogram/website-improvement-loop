#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const ARTIFACTS_DIR = resolve('artifacts/redesign');
const APPROVALS_PATH = resolve(ARTIFACTS_DIR, 'APPROVALS.json');

function ensureDir() {
  if (!existsSync(ARTIFACTS_DIR)) mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

function printForm() {
  console.log(`
========================================================
 PHASE 0 -- APPROVAL HARVEST
========================================================
Please answer ALL sections below in one response.

Provide answers as JSON like:
{"scope":{"mode":"strangler","routes_in":["/","/about"],"routes_out":[],"locales":["en"]},"constraints":{"staging_db_url_available":true,...},...}

 A. SCOPE
 A1. Mode (strangler / greenfield / bluegreen / design-system):
 A2. Routes IN scope (all or comma list):
 A3. Routes OUT of scope:
 A4. Languages/locales to preserve:

 B. CONSTRAINTS
 B1. Staging DB URL available? (yes / no):
 B2. Backup target confirmed? (yes / no):
 B3. Feature flag provider (unleash / flagsmith / growthbook / env):
 B4. APM stack (otel / datadog / newrelic / none):
 B5. Status page URL (or none):
 B6. CI/CD system:

 C. BUDGETS
 C1. Max cost delta percent (default 20):
 C2. Max downtime minutes (default 0):
 C3. Error budget policy confirmed? (yes / no):
 C4. Error budget % before halt (default 25):

 D. AUTONOMY
 D1. Authorize autonomous execution? (yes / no):
 D2. Hard Stop Triggers acknowledged? (yes):
 D3. Canary ladder 1->5->25->50->100 consent? (yes / no):
 D4. Auto-cleanup after 72h? (yes / no):

 E. RISK ACKNOWLEDGEMENT
 E1. Migrations are WRITTEN but NOT auto-run (yes / required):
 E2. Cutover is paced, not single-shot (yes / required):
 E3. Every phase is reversible (yes / required):
========================================================
`);
}

function validateAnswers(answers) {
  const errors = [];
  if (!answers.scope?.mode) errors.push('A1: Mode is required');
  if (!answers.autonomy?.authorized) errors.push('D1: Autonomous execution must be authorized');
  if (answers.risk_ack?.migrations_not_auto_run !== true) errors.push('E1: Required acknowledgement');
  if (answers.risk_ack?.cutover_paced !== true) errors.push('E2: Required acknowledgement');
  if (answers.risk_ack?.phases_reversible !== true) errors.push('E3: Required acknowledgement');
  return errors;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    if (!existsSync(APPROVALS_PATH)) {
      console.error('No APPROVALS.json found. Run Phase 0 first.');
      process.exit(1);
    }
    const data = JSON.parse(readFileSync(APPROVALS_PATH, 'utf-8'));
    if (!data.locked) {
      console.error('APPROVALS.json is not locked. Re-run Phase 0.');
      process.exit(1);
    }
    console.log('APPROVALS.json valid and locked.');
    process.exit(0);
  }

  if (args.includes('--print')) {
    printForm();
    process.exit(0);
  }

  if (args.includes('--json')) {
    const jsonIdx = args.indexOf('--json');
    const jsonStr = args[jsonIdx + 1];
    if (!jsonStr) { console.error('--json requires a JSON string argument'); process.exit(1); }
    const answers = JSON.parse(jsonStr);
    const errors = validateAnswers(answers);
    if (errors.length > 0) {
      console.error('Validation errors:', errors.join(', '));
      process.exit(1);
    }
    ensureDir();
    const approvals = {
      approved_at: new Date().toISOString(),
      approved_by: 'user',
      locked: true,
      sections: answers,
    };
    writeFileSync(APPROVALS_PATH, JSON.stringify(approvals, null, 2), 'utf-8');
    console.log('APPROVALS.json written and locked.');
    process.exit(0);
  }

  printForm();
  console.log('Provide answers via --json \'{"scope":{...},...}\' or run interactive.');
}

main();
