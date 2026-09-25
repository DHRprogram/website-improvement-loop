#!/usr/bin/env node
// Record the metrics a focus mode cares about, with the direction each one
// moves in.
//
//   focus-metrics.mjs --focus=perf --label=iter-3
//   focus-metrics.mjs --focus=a11y --label=iter-3 --set axe_critical=0
//   focus-metrics.mjs --focus=design --compare focus-metrics/design-baseline.json
//
// Writes focus-metrics/<focus>-<label>.json and prints the path.
//
// An unmeasured metric is recorded as null. It is never defaulted to zero: a
// zero bundle size or zero accessibility violations is a claim, and an absent
// tool cannot make that claim.
//
// exit 0 ok | 1 bad usage | 2 unknown focus

import {
  FOCUS_MODES, FOCUS_METRICS_DIR, REPO_ROOT, parseArgs, direction,
  readJSON, writeJSON,
} from './lib.mjs';
import { join, resolve } from 'node:path';

const { flags } = parseArgs();

if (!flags.focus || flags.focus === true) {
  console.error('usage: focus-metrics.mjs --focus=MODE --label=LABEL [--set key=value] [--compare <file>]');
  console.error('modes: ' + Object.keys(FOCUS_MODES).join(', '));
  process.exit(1);
}
const mode = String(flags.focus);
const cfg = FOCUS_MODES[mode];
if (!cfg) {
  console.error(`focus-metrics: unknown focus mode '${mode}'`);
  console.error('modes: ' + Object.keys(FOCUS_MODES).join(', '));
  process.exit(2);
}
const label = String(flags.label || 'snapshot');
const base = flags.base ? resolve(String(flags.base)) : REPO_ROOT;
const outPath = join(base, FOCUS_METRICS_DIR, `${mode}-${label}.json`);

// Every metric this mode tracks, plus the core measures that are always worth
// recording so a focus switch does not lose the history of the others.
const TRACKED = new Set([
  ...cfg.secondary_metrics,
  cfg.primary_metric,
  'test_pass_rate', 'lint_errors', 'type_errors', 'bundle_kb',
]);

const metrics = {};
for (const name of TRACKED) {
  metrics[name] = { value: null, direction: direction(name), measured: false };
}

const sets = Array.isArray(flags.set) ? flags.set : (flags.set ? [flags.set] : []);
for (const raw of sets) {
  const kv = String(raw).match(/^([^=]+)=(.*)$/);
  if (!kv) { console.error(`focus-metrics: --set expects key=value, got '${raw}'`); process.exit(1); }
  const key = kv[1].trim();
  const rawVal = kv[2].trim();
  const n = Number(rawVal);
  if (!TRACKED.has(key)) {
    console.error(`focus-metrics: '${key}' is not tracked by mode '${mode}' (tracked: ${[...TRACKED].join(', ')})`);
    process.exit(1);
  }
  if (rawVal === 'null' || rawVal === '') metrics[key] = { value: null, direction: direction(key), measured: false };
  else if (Number.isFinite(n)) metrics[key] = { value: n, direction: direction(key), measured: true };
  else metrics[key] = { value: rawVal, direction: direction(key), measured: true };
}

const snapshot = {
  mode,
  label,
  primary_metric: cfg.primary_metric,
  primary_direction: direction(cfg.primary_metric),
  min_severity: cfg.min_severity,
  subagents: cfg.subagents,
  metrics,
  recorded_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
};

if (flags.compare) {
  const prev = readJSON(String(flags.compare));
  if (!prev) {
    console.error(`focus-metrics: cannot read comparison file '${flags.compare}'`);
    process.exit(1);
  }
  const prevMetrics = prev.metrics || {};
  const deltas = {};
  const regressions = [];
  for (const [name, entry] of Object.entries(metrics)) {
    const before = prevMetrics[name]?.value;
    if (typeof before !== 'number' || typeof entry.value !== 'number') {
      deltas[name] = null;
      continue;
    }
    const delta = Number((entry.value - before).toFixed(2));
    deltas[name] = delta;
    const worse = entry.direction === 'lower' ? delta > 0 : delta < 0;
    if (worse) regressions.push({ metric: name, before, after: entry.value, delta, direction: entry.direction });
  }
  snapshot.compare_with = String(flags.compare);
  snapshot.deltas = deltas;
  snapshot.regressions = regressions;
  snapshot.regressed = regressions.length > 0;
}

writeJSON(outPath, snapshot);
console.log(outPath);
if (snapshot.regressed) {
  for (const r of snapshot.regressions) {
    console.error(`  REGRESSION ${r.metric}: ${r.before} -> ${r.after} (${r.direction} is better)`);
  }
  process.exit(1);
}
process.exit(0);
