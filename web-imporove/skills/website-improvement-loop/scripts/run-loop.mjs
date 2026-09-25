#!/usr/bin/env node
// Unattended driver: run orchestrator.mjs until the stop condition fires.
//
//   run-loop.mjs [--focus=MODE] [--max-iterations N] [--min-severity P0|P1|P2|P3]
//                [--agents S1-S10] [--project PATH] [--fixer "CMD"]
//                [--apply] [--dry-run] [--resume]
//
// This is the entry point for CI, where nobody is watching to apply the fix by
// hand. It loops orchestrator.mjs; the Stop Hook decides when to stop.
//
// --fixer "CMD" is required for --apply. CMD receives FIX-PLAN.md on stdin and
// is expected to leave the changes in the working tree; the orchestrator then
// verifies them on the next pass and reverts a regression.
//
// Without --apply it runs exactly one mechanical iteration and exits, which is
// what an interactive session wants: Claude applies the fix, then calls the
// orchestrator again.
//
// exit 0 finished cleanly | 1 error | 2 stopped on a condition

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { HERE, REPO_ROOT, STOP_FILE, STATE_FILE, parseArgs, resolve, join } from './lib.mjs';

const { flags } = parseArgs();

if (flags.help === true || (!process.argv[2] && !flags['dry-run'])) {
  console.log('usage: run-loop.mjs [--focus=MODE] [--max-iterations N] [--min-severity=P2]');
  console.log('                    [--agents S1-S10] [--project PATH]');
  console.log('                    [--fixer "CMD"] [--apply] [--dry-run] [--resume]');
  process.exit(0);
}

const project = resolve(String(flags.project || flags.base || REPO_ROOT));
const apply = flags.apply === true || flags.apply === 'true';
const dryRun = flags['dry-run'] === true || flags['dry-run'] === 'true';
const fixer = flags.fixer ? String(flags.fixer) : (process.env.WIL_FIXER || '');

if (apply && !fixer && !dryRun) {
  console.error('run-loop: --apply needs --fixer "CMD". Without a fixer there is nothing to apply the FIX-PLAN with.');
  process.exit(1);
}

const orchestrator = join(HERE, 'orchestrator.mjs');
const baseArgs = ['--project', project];
if (flags.focus) baseArgs.push(`--focus=${String(flags.focus)}`);
if (flags['max-iterations'] !== undefined) baseArgs.push(`--max-iterations=${String(flags['max-iterations'])}`);
if (flags['min-severity'] !== undefined) baseArgs.push(`--min-severity=${String(flags['min-severity'])}`);
if (flags.agents !== undefined && flags.agents !== true) baseArgs.push(`--agents=${String(flags.agents)}`);
if (flags.parallel !== undefined) baseArgs.push(`--parallel=${String(flags.parallel)}`);
if (flags.runner !== undefined) baseArgs.push(`--runner=${String(flags.runner)}`);
if (flags.resume) baseArgs.push('--resume');
if (dryRun) baseArgs.push('--dry-run');

if (dryRun) {
  const r = spawnSync('node', [orchestrator, ...baseArgs], { stdio: 'inherit', cwd: project });
  process.exit(r.status ?? 1);
}

if (!apply) {
  const r = spawnSync('node', [orchestrator, ...baseArgs], { stdio: 'inherit', cwd: project });
  process.exit(r.status ?? 1);
}

if (existsSync(join(project, STOP_FILE))) {
  console.error(`run-loop: ${STOP_FILE} exists. The loop was stopped; remove it or pass --resume.`);
  process.exit(2);
}

const startedAt = Date.now();
let passes = 0;
const history = [];

for (;;) {
  passes += 1;
  console.log(`\n${'='.repeat(64)}\nrun-loop pass ${passes}\n${'='.repeat(64)}`);

  const r = spawnSync('node', [orchestrator, ...baseArgs], { stdio: 'inherit', cwd: project });
  history.push({ pass: passes, exit: r.status });

  if (r.status === 2) {
    console.log(`\nrun-loop: stop condition met after ${passes} pass(es) in ${((Date.now() - startedAt) / 1000).toFixed(0)}s.`);
    break;
  }
  if (r.status !== 0) {
    console.error(`\nrun-loop: orchestrator exited ${r.status} on pass ${passes}. Stopping.`);
    process.exit(2);
  }

  if (existsSync(join(project, STOP_FILE))) {
    console.log('\nrun-loop: STOP sentinel present. Stopping.');
    break;
  }

  const plan = join(project, 'FIX-PLAN.md');
  if (!existsSync(plan)) {
    console.error('\nrun-loop: no FIX-PLAN.md was written and the loop is not stopping. Aborting rather than spinning.');
    process.exit(2);
  }

  console.log(`\nrun-loop: applying FIX-PLAN.md with: ${fixer}`);
  const applied = spawnSync('/bin/sh', ['-c', fixer], {
    cwd: project,
    input: readFileSync(plan, 'utf8'),
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (applied.status !== 0) {
    console.error(`\nrun-loop: fixer exited ${applied.status}. Stopping.`);
    process.exit(2);
  }

  // A fixer that changed nothing would otherwise loop forever on the same plan.
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: project, encoding: 'utf8' });
  if (!dirty.stdout || !dirty.stdout.trim()) {
    console.error('\nrun-loop: the fixer changed nothing. Stopping instead of re-planning the same work.');
    process.exit(2);
  }
  const commit = spawnSync('/bin/sh', ['-c', 'git add -A && git commit -m "fix(loop): automated iteration"'], { cwd: project, stdio: 'inherit' });
  if (commit.status !== 0) {
    console.error('\nrun-loop: could not commit the fixer output. Stopping.');
    process.exit(2);
  }
}

console.log(`\nrun-loop: ${passes} pass(es) complete. State in ${STATE_FILE}.`);
process.exit(0);
