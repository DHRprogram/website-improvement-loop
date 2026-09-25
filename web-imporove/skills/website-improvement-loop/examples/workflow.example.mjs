#!/usr/bin/env node
// A worked example of a ten-agent sweep, written as a script you can read and
// run. It is deliberately NOT the orchestrator: the orchestrator (scripts/
// orchestrator.mjs) also verifies the previous commit, ranks findings, writes
// FIX-PLAN.md and talks to the Stop Hook. This file does the spawn half only,
// so the shape of a parallel audit is visible without the surrounding
// machinery.
//
//   node examples/workflow.example.mjs --project=. --focus=full --dry-run
//
// It spawns the ten auditors, merges their findings, and ranks the result.
// Read-only apart from artifacts/website-loop/, and it writes no code.

import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { AGENTS, FOCUS_MODES, SEVERITY_WEIGHT } from '../scripts/lib.mjs';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
};

const PROJECT = resolve(String(arg('project', process.cwd())));
const FOCUS = String(arg('focus', 'full'));
const DRY_RUN = Boolean(arg('dry-run', false));
const PARALLEL = Number(arg('parallel', 10));
const MODEL = arg('model', null);
const TIMEOUT_S = Number(arg('timeout', 600));
const HERE = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname);
const SKILL = resolve(HERE, '..');

if (!FOCUS_MODES[FOCUS]) {
  console.error(`Unknown focus "${FOCUS}". Valid modes: ${Object.keys(FOCUS_MODES).join(', ')}`);
  process.exit(2);
}

const wanted = FOCUS_MODES[FOCUS].subagents;
const roster = wanted.length ? wanted : AGENTS;
console.log(`[workflow] focus=${FOCUS} agents=${roster.join(',')} parallel=${PARALLEL} dry_run=${DRY_RUN}`);

// Run `fn` over `items` with at most `limit` in flight. spawnSync would be
// simpler but serialises the whole point, so this is a small worker pool.
async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

function runNode(args) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, args, {
      cwd: PROJECT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_S * 1000);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolvePromise({ code, out, err });
    });
  });
}

// ---- Step 1: spawn the auditors -------------------------------------------------

const spawnArgs = ['--agents', roster.join(','), '--project', PROJECT, '--focus', FOCUS];
if (MODEL) spawnArgs.push('--model', String(MODEL));
if (DRY_RUN) spawnArgs.push('--dry-run');

const spawnRun = await runNode([join(SKILL, 'scripts', 'spawn-agents.mjs'), ...spawnArgs]);
if (spawnRun.code !== 0 && spawnRun.code !== 2) {
  console.error(`[workflow] spawn-agents failed (exit ${spawnRun.code})\n${spawnRun.err}`);
  process.exit(1);
}
if (spawnRun.code === 2) {
  // Exit 2 is the honest "no runner configured" path: empty findings files
  // plus a note. There is nothing to merge, and pretending otherwise would
  // be the one thing this system must never do.
  console.warn('[workflow] no agent runner available; findings are empty by design.');
}

// ---- Step 2: merge and rank ----------------------------------------------------

const merged = await runNode([
  join(SKILL, 'scripts', 'merge-findings.mjs'), `--base=${PROJECT}`, '--min-severity=P2',
]);
if (merged.code !== 0) {
  console.error(`[workflow] merge-findings failed (exit ${merged.code})\n${merged.err}`);
  process.exit(1);
}

const ranked = await runNode([
  join(SKILL, 'scripts', 'rank-findings.mjs'), `--base=${PROJECT}`, '--min-severity=P2', '--top=5',
]);
if (ranked.code !== 0) {
  console.error(`[workflow] rank-findings failed (exit ${ranked.code})\n${ranked.err}`);
  process.exit(1);
}

// ---- Step 3: report -------------------------------------------------------------

const { readFileSync } = await import('node:fs');
const queuePath = join(PROJECT, 'artifacts/website-loop/QUEUE_TOP.json');
let queue = [];
try {
  queue = JSON.parse(readFileSync(queuePath, 'utf8'));
} catch {
  queue = [];
}

const list = Array.isArray(queue) ? queue : (queue.findings ?? []);
console.log(`\n[workflow] top ${list.length} finding(s) for iteration ${FOCUS}:`);
for (const f of list) {
  const weight = SEVERITY_WEIGHT[f.severity] ?? 0;
  const score = weight * (f.impact ?? 1) / (f.effort ?? 1);
  console.log(
    `  ${score.toFixed(0).padStart(6)}  ${f.severity}  ${f.id}  ${f.title}` +
    `  [${(f.files_touched ?? []).join(', ')}]`,
  );
}
if (list.length === 0) {
  console.log('  (none — the queue above the severity floor is empty)');
}
console.log(`\n[workflow] done. Nothing was fixed; apply FIX-PLAN.md or run scripts/orchestrator.mjs.`);
