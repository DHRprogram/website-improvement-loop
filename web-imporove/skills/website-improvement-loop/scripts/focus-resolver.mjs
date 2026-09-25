#!/usr/bin/env node
// Resolve a focus mode into the subagent list and metrics that drive it.
//
//   focus-resolver.mjs --list
//   focus-resolver.mjs --focus=design
//   focus-resolver.mjs --agents=S2,S5
//   focus-resolver.mjs --focus=bugs --json
//
// exit 0 ok | 2 unknown mode or bad agent

import { FOCUS_MODES, AGENTS, parseArgs, direction, SEVERITY_NAME } from './lib.mjs';

const { flags } = parseArgs();

function fail(msg) {
  console.error(`focus-resolver: ${msg}`);
  console.error('valid modes: ' + Object.keys(FOCUS_MODES).join(', '));
  process.exit(2);
}

function agentList(spec) {
  const list = String(spec).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (!list.length) fail('--agents was empty');
  const bad = list.filter((a) => !AGENTS.includes(a));
  if (bad.length) fail(`unknown agent(s): ${bad.join(', ')}. valid: ${AGENTS.join(', ')}`);
  return [...new Set(list)].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

if (flags.list) {
  const rows = Object.entries(FOCUS_MODES).map(([mode, cfg]) => ({
    mode,
    subagents: cfg.subagents,
    primary_metric: cfg.primary_metric,
    direction: direction(cfg.primary_metric),
    secondary_metrics: cfg.secondary_metrics,
    min_severity: cfg.min_severity,
  }));
  if (flags.json) { console.log(JSON.stringify(rows, null, 2)); process.exit(0); }
  console.log('mode'.padEnd(11) + 'subagents'.padEnd(30) + 'primary_metric'.padEnd(28) + 'better');
  console.log('-'.repeat(11) + '-'.repeat(30) + '-'.repeat(28) + '------');
  for (const r of rows) {
    console.log(r.mode.padEnd(11) + r.subagents.join(',').padEnd(30) + r.primary_metric.padEnd(28) + r.direction);
  }
  console.log(`\n${rows.length} modes.`);
  process.exit(0);
}

let mode = null;
let subagents;

if (flags.agents !== undefined && flags.agents !== true) {
  subagents = agentList(flags.agents);
  mode = 'custom';
} else {
  mode = String(flags.focus || 'full');
  const cfg = FOCUS_MODES[mode];
  if (!cfg) fail(`unknown focus mode '${mode}'`);
  subagents = [...cfg.subagents];
}

const cfg = FOCUS_MODES[mode];
const payload = {
  mode,
  subagents,
  primary_metric: cfg ? cfg.primary_metric : null,
  primary_direction: cfg ? direction(cfg.primary_metric) : null,
  secondary_metrics: cfg ? cfg.secondary_metrics : [],
  min_severity: cfg ? cfg.min_severity : 'P2',
  min_severity_meaning: cfg ? SEVERITY_NAME[cfg.min_severity] : null,
  stop_conditions: {
    max_iterations: null,
    no_open_findings_at_or_above: cfg ? cfg.min_severity : 'P2',
    no_improvement_streak: 5,
    consecutive_errors: 3,
    stop_file: 'artifacts/website-loop/STOP',
  },
};

if (flags['max-iterations'] !== undefined) {
  const n = Number(flags['max-iterations']);
  if (!Number.isFinite(n) || n < 1) fail('--max-iterations must be a positive number');
  payload.stop_conditions.max_iterations = Math.trunc(n);
}
if (flags['min-severity'] !== undefined) {
  const s = String(flags['min-severity']);
  if (!Object.prototype.hasOwnProperty.call(SEVERITY_NAME, s)) fail(`--min-severity must be P0|P1|P2|P3, got '${s}'`);
  payload.min_severity = s;
  payload.stop_conditions.no_open_findings_at_or_above = s;
}

console.log(JSON.stringify(payload, null, 2));
process.exit(0);
