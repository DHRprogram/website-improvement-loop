#!/usr/bin/env node
// STATE.md external memory for the improvement loop.
//
//   state-manager.mjs init   [--focus=MODE] [--max-iterations N] [--min-severity P0|P1|P2|P3]
//   state-manager.mjs read
//   state-manager.mjs update [flags]  (see the usage block below)
//
// exit 0 ok | 1 error | 2 bad usage

import {
  DEFAULT_STATE, STATE_FILE, REPO_ROOT, STOP_FILE,
  loadState, saveState, initState, formatState, syncFindingCounts,
  clamp, isSeverity, resolve,
} from './lib.mjs';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const USAGE = `usage:
  state-manager.mjs init   [--focus=MODE] [--max-iterations N] [--min-severity P0|P1|P2|P3] [--base=PATH]
  state-manager.mjs read   [--json] [--base=PATH]
  state-manager.mjs update [--iteration-done] [--error] [--success]
                           [--finding-fixed] [--finding-reverted] [--finding-blocked]
                           [--set-focus=MODE]
                           [--set-metric=KEY:VALUE] [--set-metric=KEY:VALUE]
                           [--set-baseline=KEY:VALUE] [--set-baseline=KEY:VALUE]
                           [--add-lesson=TEXT]
                           [--stop-reason=TEXT] [--stop-condition=NAME] [--stopped] [--resume]
                           [--reset-errors] [--reset-streak] [--base=PATH]`;

function die(msg, code = 1) { console.error(`state-manager: ${msg}`); console.error(USAGE); process.exit(code); }

const argv = process.argv.slice(2);
const sub = argv[0] && !argv[0].startsWith('--') ? argv.shift() : 'read';
if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); process.exit(0); }

const flags = {};
const repeated = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) die(`unexpected argument '${a}'`, 2);
  const eq = a.indexOf('=');
  const key = eq === -1 ? a.slice(2) : a.slice(2, eq);
  const val = eq === -1 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true) : a.slice(eq + 1);
  if (key === 'set-metric' || key === 'set-baseline') repeated.push([key, val]);
  flags[key] = val;
}
const base = flags.base ? resolve(String(flags.base)) : REPO_ROOT;

function applyKVs(target, pairs) {
  for (const [key, raw] of pairs) {
    const kv = String(raw).match(/^([^:]+):(.*)$/);
    if (!kv) die(`--${key} expects KEY:VALUE, got '${raw}'`, 2);
    const k = kv[1].trim();
    const vRaw = kv[2].trim();
    const n = Number(vRaw);
    target[k] = vRaw === 'null' ? null : (vRaw !== '' && Number.isFinite(n) ? n : vRaw);
  }
}

if (sub === 'init') {
  // The parser keeps the dashes, so these keys are read the same way here as
  // everywhere else. Reading them as flags.max_iterations silently ignored the
  // flag and the user got the default with no warning.
  if (flags['min-severity'] !== undefined && !isSeverity(String(flags['min-severity']))) {
    die(`--min-severity must be P0|P1|P2|P3, got '${flags['min-severity']}'`, 2);
  }
  if (flags['max-iterations'] !== undefined && !Number.isFinite(Number(flags['max-iterations']))) {
    die(`--max-iterations must be a number, got '${flags['max-iterations']}'`, 2);
  }
  const state = initState({
    active_focus: String(flags.focus || DEFAULT_STATE.active_focus),
    max_iterations: clamp(flags['max-iterations'], 1, 1000, DEFAULT_STATE.max_iterations),
    min_severity: String(flags['min-severity'] || DEFAULT_STATE.min_severity),
  }, base);
  console.log(`initialised ${STATE_FILE}`);
  console.log(`  focus=${state.active_focus} max_iterations=${state.max_iterations} min_severity=${state.min_severity}`);
  process.exit(0);
}

if (sub === 'read') {
  const path = join(base, STATE_FILE);
  if (!existsSync(path)) {
    if (flags.json) { console.log('{}'); process.exit(0); }
    console.log(`no ${STATE_FILE} — the loop has not started.`);
    console.log('run: node scripts/state-manager.mjs init --focus=full --max-iterations 10');
    process.exit(0);
  }
  const state = loadState(base);
  if (flags.json) { console.log(JSON.stringify(state, null, 2)); process.exit(0); }
  console.log(formatState(state));
  const q = state.findings || {};
  console.log('');
  console.log(`iteration      ${state.iteration_count}/${state.max_iterations}`);
  console.log(`focus          ${state.active_focus}`);
  console.log(`min_severity   ${state.min_severity}`);
  console.log(`findings       open=${q.open} fixed=${q.fixed} reverted=${q.reverted} blocked_backend=${q.blocked_backend}`);
  console.log(`streak         no_improvement=${state.no_improvement_streak} consecutive_errors=${state.consecutive_errors}`);
  console.log(`stop           ${state.stop_condition}${state.stop_reason ? ` (${state.stop_reason})` : ''}`);
  process.exit(0);
}

if (sub === 'update') {
  const state = loadState(base);
  if (!state) die(`no ${STATE_FILE} to update. Run 'init' first.`);
  if (flags['set-focus'] !== undefined) state.active_focus = String(flags['set-focus']);
  if (flags['max-iterations'] !== undefined) state.max_iterations = clamp(flags['max-iterations'], 1, 1000, state.max_iterations);
  if (flags['min-severity'] !== undefined) {
    if (!isSeverity(String(flags['min-severity']))) die(`--min-severity must be P0|P1|P2|P3, got '${flags.min-severity}'`, 2);
    state.min_severity = String(flags['min-severity']);
  }

  if (flags['iteration-done']) {
    state.iteration_count = clamp(Number(state.iteration_count) + 1, 0, 100000, 0);
    if (!flags.error) state.consecutive_errors = 0;
  }
  if (flags.error) state.consecutive_errors = clamp(Number(state.consecutive_errors) + 1, 0, 100000, 0);
  if (flags.success) state.consecutive_errors = 0;
  if (flags['reset-errors']) state.consecutive_errors = 0;
  if (flags['reset-streak']) state.no_improvement_streak = 0;

  const f = state.findings;
  if (flags['finding-open']) f.open = clamp(Number(f.open) + Number(flags['finding-open']), 0, 100000, 0);
  if (flags['finding-fixed']) { f.fixed += 1; f.open = Math.max(0, f.open - 1); }
  if (flags['finding-reverted']) { f.reverted += 1; f.open = Math.max(0, f.open - 1); }
  if (flags['finding-blocked']) { f.blocked_backend += 1; f.open = Math.max(0, f.open - 1); }

  if (flags['set-baseline']) applyKVs(state.baseline, repeated.filter(([k]) => k === 'set-baseline'));
  if (flags['set-metric']) applyKVs(state.current, repeated.filter(([k]) => k === 'set-metric'));

  // Deltas are derived, never hand-entered: a stale delta is worse than none.
  for (const key of Object.keys(state.current)) {
    const before = state.baseline?.[key];
    const now = state.current[key];
    if (typeof before === 'number' && typeof now === 'number') {
      state.deltas[key] = Number((now - before).toFixed(2));
    } else {
      delete state.deltas[key];
    }
  }

  if (flags['add-lesson']) {
    const lesson = String(flags['add-lesson']);
    if (!state.lessons_learned.includes(lesson)) state.lessons_learned.push(lesson);
  }
  if (flags['stop-reason'] !== undefined) state.stop_reason = String(flags['stop-reason']);
  if (flags['stop-condition'] !== undefined) state.stop_condition = String(flags['stop-condition']);
  if (flags.stopped) { state.stopped = true; if (!state.stop_condition || state.stop_condition === 'none') state.stop_condition = 'human_stop'; }
  if (flags.resume) {
    state.stopped = false;
    state.stop_condition = 'none';
    state.stop_reason = '';
  }

  syncFindingCounts(state);
  saveState(state, base);

  // A human stop also drops the sentinel, so --resume is a real resume.
  if (flags.stopped && existsSync(join(base, STOP_FILE))) writeFileSync(join(base, STOP_FILE), `${state.stop_reason}\n`, 'utf8');
  if (flags.resume) {
    const stop = join(base, STOP_FILE);
    if (existsSync(stop)) { try { unlinkSync(stop); } catch { /* best effort */ } }
  }

  console.log(`updated ${STATE_FILE} — iteration ${state.iteration_count}/${state.max_iterations}, open ${state.findings.open}`);
  process.exit(0);
}

if (sub === 'template') {
  console.log(formatState(DEFAULT_STATE));
  process.exit(0);
}

die(`unknown subcommand '${sub}'`, 2);
