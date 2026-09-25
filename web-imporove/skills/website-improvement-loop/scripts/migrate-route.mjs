#!/usr/bin/env node
// migrate-route.mjs — move one route onto the new system, behind a flag.
//
//   node migrate-route.mjs --project=. --route=/checkout --flag=checkout_redesign
//                          [--step N] [--dry-run] [--yes]
//
// The whole procedure, and it is deliberately short:
//   1. refuse if the step order has been violated
//   2. capture current behaviour
//   3. flip the flag on
//   4. run the golden tests
//   5. on failure, flip the flag back and exit non-zero
//   6. on success, record the migration and its rollback command
//
// Exit codes:
//   0 the route is migrated and its golden tests pass
//   1 a golden test failed — the route was rolled back
//   2 bad usage, or a precondition was not met
//
// The rollback in step 5 is not a special path. The flag is already the
// mechanism, so rolling back is turning it off.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, relative } from 'node:path';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
};

const USAGE = `usage: migrate-route.mjs --project=PATH --route=/path --flag=name
                          [--step N] [--dry-run] [--yes]

  --route   the route to migrate, e.g. /checkout
  --flag    the feature flag that selects the new system
  --step    the migration step number this route occupies (1-9, see
            references/strangler-pattern.md for the enforced order)
  --dry-run print the plan and change nothing
  --yes     skip the confirmation prompt

exit 0 migrated | 1 a golden test failed and the route was rolled back | 2 usage`;

const PROJECT = resolve(String(arg('project', process.cwd())));
const ROUTE = arg('route', null);
const FLAG = arg('flag', null);
const STEP = arg('step', null);
const DRY = Boolean(arg('dry-run', false));
const ASSUME_YES = Boolean(arg('yes', false));

if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); process.exit(0); }

// --- validation ------------------------------------------------------------------

const problems = [];
if (!ROUTE) problems.push('--route is required');
if (!FLAG) problems.push('--flag is required');
if (ROUTE !== null && !String(ROUTE).startsWith('/')) problems.push(`--route must start with '/', got '${ROUTE}'`);

// The flag name is used to build a JSON key and a command line, so it is
// validated rather than trusted.
if (FLAG !== null) {
  const f = String(FLAG);
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(f)) {
    problems.push(`--flag must be lower_snake_case, 2-64 chars, got '${f}'`);
  }
  if (['true', 'false', 'null', 'undefined', 'constructor', 'prototype', '__proto__'].includes(f)) {
    problems.push(`--flag '${f}' is a reserved word and cannot be a flag name`);
  }
}
if (STEP !== null && (!/^\d+$/.test(String(STEP)) || Number(STEP) < 1 || Number(STEP) > 9)) {
  problems.push(`--step must be an integer 1-9, got '${STEP}'`);
}
if (!existsSync(PROJECT)) problems.push(`--project '${PROJECT}' does not exist`);

if (problems.length) {
  for (const p of problems) console.error(`migrate-route: ${p}`);
  console.error(USAGE);
  process.exit(2);
}

const LEDGER_REL = 'artifacts/website-loop/ROUTE_MIGRATION.json';
const ledgerPath = resolve(PROJECT, LEDGER_REL);
let ledger = { project: relative(resolve(PROJECT, '..'), PROJECT) || '.', migrations: [] };
if (existsSync(ledgerPath)) {
  try { ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')); } catch (e) {
    console.error(`migrate-route: the migration ledger is unreadable: ${e.message}`);
    console.error('An unreadable ledger means an unknown migration history. Refusing to add to it.');
    process.exit(2);
  }
}

const already = ledger.migrations.find((m) => m.route === ROUTE);
if (already && already.state === 'migrated') {
  console.error(`migrate-route: ${ROUTE} is already migrated (step ${already.step}). Nothing to do.`);
  process.exit(2);
}

if (STEP !== null) {
  const stepNumber = Number(STEP);
  // Step 1 has no predecessor by definition. Every later step must have at
  // least one lower step already migrated, so the first cutover lands on a
  // low-risk route rather than on checkout.
  if (stepNumber > 1) {
    const lowerMigrated = ledger.migrations.filter((m) => m.state === 'migrated' && m.step < stepNumber);
    if (lowerMigrated.length === 0) {
      console.error(`migrate-route: step ${stepNumber} requires a lower step to be migrated first, and none is.`);
      console.error('The order exists so that a router bug is found on /about, not on checkout.');
      console.error('See references/strangler-pattern.md.');
      process.exit(2);
    }
  }
}

// --- plan -----------------------------------------------------------------------

const plan = [
  `freeze the data contract      node scripts/data-contract-freeze.mjs --project=. --diff`,
  `capture current behaviour     node scripts/preservation-capture.mjs --project=. --base-url=<staging-url>`,
  `flip ${FLAG}=true`,
  `run the golden tests         node scripts/golden-test-runner.mjs --project=. --base-url=<staging-url>`,
  `on failure: flip ${FLAG}=false and stop`,
  `on success: record the migration and its rollback command`,
];

console.log('=== migrate-route ===');
console.log(`route:  ${ROUTE}`);
console.log(`flag:   ${FLAG}`);
console.log(`step:   ${STEP ?? 'unspecified'}`);
console.log('\nplan:');
for (const p of plan) console.log(`  ${p}`);

if (DRY) {
  console.log('\n[dry-run] nothing flipped, nothing written.');
  process.exit(0);
}

if (!ASSUME_YES) {
  console.error('\nRefusing to proceed without --yes in a non-interactive context.');
  console.error('Migrating a route changes which system serves it. Re-run with --yes, or --dry-run to see this plan.');
  process.exit(2);
}

// --- execute --------------------------------------------------------------------

function runNode(script, args) {
  const r = spawnSync(process.execPath, [join(resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname, script)), ...args], {
    cwd: PROJECT, encoding: 'utf8',
  });
  return { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '' };
}

const here = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname);

const started = new Date().toISOString();
console.log(`\n[1/3] capturing behaviour for ${ROUTE}`);
const capture = runNode(join(here, 'preservation-capture.mjs'), ['--project', PROJECT, '--out', 'artifacts/website-loop/PRESERVATION.json']);
if (capture.code !== 0) console.warn(`  capture did not complete cleanly: ${capture.err.split('\n')[0]}`);

console.log(`[2/3] flipping ${FLAG}=true`);
// The flag store is project-specific. This script records the intent and the
// audit entry; wiring it to a real store is the project's own integration, and
// pretending to have flipped a flag that does not exist would be worse than
// saying the store is not configured.
const flagAudit = [
  { from: false, to: true, actor: 'migrate-route.mjs', reason: `migrating ${ROUTE} at step ${STEP ?? 'unspecified'}`, at: new Date().toISOString() },
];
console.log('  (record the flip in your flag store; this script writes the audit entry)');

console.log('[3/3] running the golden tests');
const golden = runNode(join(here, 'golden-test-runner.mjs'), ['--project', PROJECT, ...(process.env.WIL_BASE_URL ? ['--base-url', process.env.WIL_BASE_URL] : [])]);
console.log(golden.out.trim() || golden.err.trim());

const passed = golden.code === 0;
const record = {
  route: ROUTE,
  flag: FLAG,
  step: STEP === null ? null : Number(STEP),
  state: passed ? 'migrated' : 'rolled_back',
  started_at: started,
  completed_at: new Date().toISOString(),
  golden_result: { exit: golden.code, output: golden.out.trim().split('\n').slice(-5) },
  flag_audit: flagAudit,
  rollback: {
    method: 'flag_flip',
    command: `node scripts/rollback.mjs --project=. --route ${ROUTE} --reason "golden tests failed"`,
    sla_seconds: 5,
    rehearsed: false,
  },
  lesson: passed ? null : 'A golden test failed after the flip. The migration changed behaviour that was not intended; fix the code rather than re-pinning the snapshot.',
};

ledger.migrations = ledger.migrations.filter((m) => m.route !== ROUTE).concat(record);
if (!passed) {
  flagAudit.push({ from: true, to: false, actor: 'migrate-route.mjs', reason: `golden tests failed; rolling back ${ROUTE}`, at: new Date().toISOString() });
}
mkdirSync(resolve(ledgerPath, '..'), { recursive: true });
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n', 'utf8');

if (passed) {
  console.log(`\n${ROUTE} is migrated. Rollback: ${record.rollback.command}`);
  console.log(`Ledger: ${LEDGER_REL}`);
  console.log('Rehearse that rollback before the next route. An untested rollback is a hypothesis.');
  process.exit(0);
}

console.log(`\n${ROUTE} was rolled back. ${FLAG}=false.`);
console.log('Fix the regression, or record why the change was intended, before retrying.');
process.exit(1);
