#!/usr/bin/env node
// rollback.mjs — put a route back on the old system, and record why.
//
//   node rollback.mjs --project=. --route=/checkout [--reason=TEXT]
//                      [--all] [--dry-run] [--yes]
//
// Under the strangler pattern, a rollback is a flag flip. That makes it the
// fastest thing in the whole system — five seconds instead of a five-minute
// git revert — and this script is the audited, repeatable way to do it.
//
// Exit codes:
//   0 the rollback was recorded
//   1 the rollback failed, or a write route needs data reconciliation
//   2 bad usage
//
// This script does not talk to a flag store. Wiring that is the project's own
// integration, and pretending to have flipped a flag that does not exist would
// be the worst possible failure mode for a rollback tool: it would report
// success during an incident while production kept serving the new system.
// It writes the intent and the audit record, and says exactly what remains.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
};

const USAGE = `usage: rollback.mjs --project=PATH --route=/path [--reason=TEXT] [--all]
                         [--dry-run] [--yes]

  --route    the route to roll back
  --all      roll back every migrated route
  --reason   why, recorded in the audit trail. A rollback with no reason is
             one nobody can learn from.
  --dry-run  show what would be reverted and change nothing
  --yes      skip the confirmation prompt

exit 0 recorded | 1 failed, or a write route needs reconciliation | 2 usage`;

const PROJECT = resolve(String(arg('project', process.cwd())));
const ROUTE = arg('route', null);
const ALL = Boolean(arg('all', false));
const REASON = arg('reason', null);
const DRY = Boolean(arg('dry-run', false));
const ASSUME_YES = Boolean(arg('yes', false));

if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); process.exit(0); }

const problems = [];
if (!ROUTE && !ALL) problems.push('one of --route or --all is required');
if (ROUTE !== null && ALL) problems.push('--route and --all are mutually exclusive');
if (ROUTE !== null && !String(ROUTE).startsWith('/')) problems.push(`--route must start with '/', got '${ROUTE}'`);
if (ROUTE !== null && String(ROUTE).includes('..')) problems.push('--route must not contain ".."');
if (REASON !== null && String(REASON).trim().length === 0) problems.push('--reason must not be empty');
if (!existsSync(PROJECT)) problems.push(`--project '${PROJECT}' does not exist`);

if (problems.length) {
  for (const p of problems) console.error(`rollback: ${p}`);
  console.error(USAGE);
  process.exit(2);
}

const LEDGER_REL = 'artifacts/website-loop/ROUTE_MIGRATION.json';
const LEDGER_PATH = resolve(PROJECT, LEDGER_REL);
const RECORD_REL = 'artifacts/website-loop/ROLLBACK.json';

if (!existsSync(LEDGER_PATH)) {
  console.error(`rollback: no migration ledger at ${LEDGER_REL}.`);
  console.error('Nothing has been recorded as migrated, so there is nothing this tool can roll back.');
  console.error('If the route was migrated by hand, roll it back in your flag store and record why.');
  process.exit(2);
}

let ledger;
try {
  ledger = JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
} catch (e) {
  console.error(`rollback: the migration ledger is unreadable: ${e.message}`);
  console.error('An unreadable ledger means an unknown migration history. Failing closed.');
  process.exit(2);
}

const candidates = ALL
  ? ledger.migrations.filter((m) => m.state === 'migrated')
  : ledger.migrations.filter((m) => m.route === ROUTE && m.state === 'migrated');

if (candidates.length === 0) {
  if (ROUTE) {
    const seen = ledger.migrations.find((m) => m.route === ROUTE);
    console.error(seen
      ? `rollback: ${ROUTE} is recorded as '${seen.state}', not 'migrated'. Nothing to roll back.`
      : `rollback: ${ROUTE} is not in the migration ledger. Nothing to roll back.`);
  } else {
    console.error('rollback: no migrated routes to roll back.');
  }
  process.exit(2);
}

const startedAt = new Date().toISOString();
const trigger = REASON ? String(REASON) : 'unspecified';

console.log('=== rollback ===');
console.log(`routes: ${candidates.map((m) => m.route).join(', ')}`);
console.log(`reason: ${trigger}`);
console.log('\ntargets:');
for (const m of candidates) {
  console.log(`  ${m.route}  flag=${m.flag}  step=${m.step ?? 'unspecified'}`);
  if (m.writes_data || /write/.test(String(m.kind ?? ''))) {
    console.log('    NOTE: this route writes data. After the flag is off, the new store holds');
    console.log('    rows the old system does not have. Run the contract diff before declaring');
    console.log('    the rollback complete:');
    console.log('      node scripts/data-contract-freeze.mjs --project=. --diff');
  }
}

if (DRY) {
  console.log('\n[dry-run] nothing flipped, nothing written.');
  process.exit(0);
}

if (!ASSUME_YES) {
  console.error('\nRefusing to proceed without --yes in a non-interactive context.');
  console.error('Re-run with --yes to perform the rollback, or --dry-run to see this plan.');
  process.exit(2);
}

const record = {
  rollback_id: `rb-${startedAt.replace(/[-:.]/g, '')}`,
  project: relative(resolve(PROJECT, '..'), PROJECT) || '.',
  executed_at: startedAt,
  actor: 'rollback.mjs',
  reason: trigger,
  trigger: 'manual',
  method: 'flag_flip',
  targets: candidates.map((m) => ({
    route: m.route,
    flag: m.flag,
    previous_value: true,
    new_value: false,
    // Not 'flipped: true'. This script does not own a flag store, and
    // claiming a flip it did not perform is the one outcome that would make
    // this tool worse than useless during an incident.
    flipped: false,
    requires_manual_flip: true,
  })),
  flag_audit: [
    {
      from: true,
      to: false,
      actor: 'rollback.mjs',
      reason: trigger,
      at: startedAt,
      applied: false,
    },
  ],
  data_reconciliation: {
    required: candidates.some((m) => m.writes_data || /write/.test(String(m.kind ?? ''))),
    outstanding: candidates
      .filter((m) => m.writes_data || /write/.test(String(m.kind ?? '')))
      .map((m) => m.route),
  },
  follow_up: {
    state_update: 'node scripts/state-manager.mjs update --error --add-lesson "reverted <route>: <reason>"',
    next_route_authorized: false,
  },
};

// Update the ledger.
for (const m of candidates) {
  m.state = 'rolled_back';
  m.flag_audit = [...(m.flag_audit ?? []), { from: true, to: false, actor: 'rollback.mjs', reason: trigger, at: startedAt }];
}
writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
mkdirSync(resolve(PROJECT, RECORD_REL, '..'), { recursive: true });
writeFileSync(resolve(PROJECT, RECORD_REL), JSON.stringify(record, null, 2) + '\n', 'utf8');

console.log(`\nRecorded the rollback of ${candidates.map((m) => m.route).join(', ')}.`);
console.log('Ledger:      ' + LEDGER_REL);
console.log('Rollback:    ' + RECORD_REL);
console.log('');
console.log('ACTION REQUIRED — this tool did not flip anything, because it does not own');
console.log('your flag store. Set each flag to false now:');
for (const m of candidates) console.log(`  ${m.flag}=false`);

if (record.data_reconciliation.required) {
  console.log('');
  console.log('These routes write data. Before calling this recovery complete:');
  console.log('  node scripts/data-contract-freeze.mjs --project=. --diff');
  console.log('A flag flip stops new writes. It does not undo the writes that already happened.');
  process.exit(1);
}
process.exit(0);
