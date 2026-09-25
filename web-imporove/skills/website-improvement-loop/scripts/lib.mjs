// Shared constants and helpers for the website-improvement-loop scripts.
//
// This exists because the severity table, the artifact paths and the argument
// shape are needed by six files. Copying them is how they drift apart, and a
// drifted severity table silently mis-ranks every finding.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

// Re-exported so callers need one import, not two.
export { join, resolve, dirname };
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const SKILL_ROOT = resolve(HERE, '..');
export const REPO_ROOT = resolve(SKILL_ROOT, '..', '..');

export const WIL_DIR = 'artifacts/website-loop';
export const STATE_FILE = join(WIL_DIR, 'STATE.md');
export const STOP_FILE = join(WIL_DIR, 'STOP');
export const FINDINGS_DIR = join(WIL_DIR, 'findings');
export const MERGED_FILE = join(WIL_DIR, 'merged.json');
export const CONFLICTS_FILE = join(WIL_DIR, 'conflicts.json');
export const QUEUE_FILE = join(WIL_DIR, 'QUEUE.json');
export const QUEUE_TOP_FILE = join(WIL_DIR, 'QUEUE_TOP.json');
export const FOCUS_METRICS_DIR = 'focus-metrics';
export const METRICS_DIR = 'metrics';
export const FINAL_REPORT = 'FINAL_REPORT.md';

export const AGENTS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'];

export const SEVERITY_WEIGHT = { P0: 1000, P1: 300, P2: 100, P3: 30 };
export const SEVERITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };
export const SEVERITY_NAME = {
  P0: 'blocking',
  P1: 'critical',
  P2: 'major',
  P3: 'minor',
};

export const MAX_FINDINGS_PER_ITERATION = 5;

/** Lower is better for these. Anything unlisted is treated as higher-is-better. */
export const LOWER_IS_BETTER = new Set([
  'bundle_kb', 'lcp_ms', 'cls_score', 'inp_ms', 'build_time_ms',
  'axe_critical', 'axe_serious', 'contrast_failures',
  'runtime_errors', 'logic_bugs', 'race_conditions',
  'xss_risks', 'csrf_risks', 'secrets_in_client',
  'lint_errors', 'type_errors',
  'heading_order_violations', 'design_system_violations',
  'spacing_inconsistencies', 'typography_violations',
  'ux_state_gaps', 'coupling_violations', 'parity_violations',
  'responsive_violations', 'critical_path_coverage',
]);

export const FOCUS_MODES = {
  full: {
    subagents: AGENTS,
    primary_metric: 'rubric_total',
    secondary_metrics: ['bundle_kb', 'axe_critical', 'runtime_errors', 'meta_coverage'],
    min_severity: 'P2',
  },
  design: {
    subagents: ['S2', 'S3', 'S5', 'S10'],
    primary_metric: 'design_system_violations',
    secondary_metrics: ['spacing_inconsistencies', 'typography_violations'],
    min_severity: 'P2',
  },
  bugs: {
    subagents: ['S1', 'S6'],
    primary_metric: 'runtime_errors',
    secondary_metrics: ['logic_bugs', 'race_conditions'],
    min_severity: 'P1',
  },
  perf: {
    subagents: ['S4'],
    primary_metric: 'bundle_kb',
    secondary_metrics: ['lcp_ms', 'cls_score', 'inp_ms'],
    min_severity: 'P2',
  },
  a11y: {
    subagents: ['S3', 'S5'],
    primary_metric: 'axe_critical',
    secondary_metrics: ['axe_serious', 'contrast_failures'],
    min_severity: 'P1',
  },
  security: {
    subagents: ['S8'],
    primary_metric: 'xss_risks',
    secondary_metrics: ['csrf_risks', 'secrets_in_client'],
    min_severity: 'P1',
  },
  seo: {
    subagents: ['S7'],
    primary_metric: 'meta_coverage',
    secondary_metrics: ['og_coverage', 'heading_order_violations'],
    min_severity: 'P3',
  },
  frontend: {
    subagents: ['S2', 'S3', 'S4', 'S5', 'S7', 'S10'],
    primary_metric: 'rubric_total',
    secondary_metrics: ['bundle_kb', 'axe_critical', 'design_system_violations'],
    min_severity: 'P2',
  },
  backend: {
    subagents: ['S1', 'S6', 'S8', 'S9'],
    primary_metric: 'runtime_errors',
    secondary_metrics: ['coupling_violations', 'critical_path_coverage'],
    min_severity: 'P1',
  },
  redesign: {
    subagents: ['S1', 'S2', 'S5', 'S8', 'S9'],
    primary_metric: 'parity_violations',
    secondary_metrics: ['runtime_errors', 'axe_critical', 'coupling_violations'],
    min_severity: 'P1',
  },
};

/**
 * --key=value and --key value, plus bare positionals.
 * A repeated key accumulates into an array rather than overwriting: silently
 * keeping only the last --set would drop metrics without any error.
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  const positional = [];
  const set = (key, value) => {
    if (!Object.prototype.hasOwnProperty.call(flags, key)) { flags[key] = value; return; }
    if (Array.isArray(flags[key])) { flags[key].push(value); return; }
    flags[key] = [flags[key], value];
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const eq = arg.indexOf('=');
    if (eq !== -1) { set(arg.slice(2, eq), arg.slice(eq + 1)); continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { set(key, next); i++; }
    else set(key, true);
  }
  return { flags, positional };
}

export function priority(finding) {
  const weight = SEVERITY_WEIGHT[finding.severity] ?? SEVERITY_WEIGHT.P3;
  const impact = clamp(finding.impact, 1, 5, 3);
  const effort = clamp(finding.effort, 1, 5, 3);
  return (weight * impact) / effort;
}

export function clamp(value, lo, hi, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

export function severityRank(sev) {
  return SEVERITY_ORDER[sev] ?? 99;
}

export function isSeverity(sev) {
  return Object.prototype.hasOwnProperty.call(SEVERITY_WEIGHT, sev);
}

export function direction(metric) {
  return LOWER_IS_BETTER.has(metric) ? 'lower' : 'higher';
}

export function normalizeTitle(title) {
  return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function readJSON(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJSON(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return path;
}

export function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
  return path;
}

export function listFiles(dir, filter = () => true) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && filter(e.name))
    .map((e) => join(dir, e.name))
    .sort();
}

export function repoPath(relative) {
  return resolve(REPO_ROOT, relative);
}

// ---------------------------------------------------------------------------
// STATE.md
//
// YAML-ish on purpose: flat `key: value` frontmatter plus one list. A full
// YAML parser is a dependency this skill does not otherwise need, and the
// hook scripts have to read the same file with grep and sed.
// ---------------------------------------------------------------------------

export const DEFAULT_STATE = {
  iteration_count: 0,
  max_iterations: 50,
  min_severity: 'P2',
  active_focus: 'full',
  baseline: {},
  current: {},
  deltas: {},
  // open: -1 means NOT YET MEASURED. Zero would mean 'measured, nothing open',
  // which on a fresh state would declare the loop finished before it started.
  findings: { open: -1, fixed: 0, reverted: 0, blocked_backend: 0 },
  no_improvement_streak: 0,
  consecutive_errors: 0,
  lessons_learned: [],
  stop_condition: 'none',
  stop_reason: '',
  stopped: false,
  last_updated: '',
};

function parseScalar(raw) {
  const v = raw.trim();
  if (v === '' ) return '';
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^-?\d*\.\d+$/.test(v)) return Number(v);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  if (v.startsWith('{') && v.endsWith('}')) return readJSONInline(v);
  return v;
}

function readJSONInline(v) {
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

export function parseState(text) {
  const state = { ...DEFAULT_STATE, findings: { ...DEFAULT_STATE.findings } };
  const lines = String(text || '').split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === '---');
  if (start === -1) return state;
  let inLessons = false;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') break;
    if (!line.trim()) continue;
    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem && inLessons) { state.lessons_learned.push(parseScalar(listItem[1])); continue; }
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    if (key === 'lessons_learned') { inLessons = true; continue; }
    inLessons = false;
    state[key] = parseScalar(kv[2]);
  }
  if (state.findings && typeof state.findings === 'object' && !Array.isArray(state.findings)) {
    state.findings = { ...DEFAULT_STATE.findings, ...state.findings };
  }
  return state;
}

function formatScalar(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  const s = String(value);
  return /[:#\-{}[\]]/.test(s) || s === '' ? JSON.stringify(s) : s;
}

export function formatState(state) {
  const s = { ...DEFAULT_STATE, ...state, findings: { ...DEFAULT_STATE.findings, ...(state.findings || {}) } };
  const out = ['---'];
  out.push(`iteration_count: ${formatScalar(s.iteration_count)}`);
  out.push(`max_iterations: ${formatScalar(s.max_iterations)}`);
  out.push(`min_severity: ${formatScalar(s.min_severity)}`);
  out.push(`active_focus: ${formatScalar(s.active_focus)}`);
  out.push(`baseline: ${formatScalar(s.baseline)}`);
  out.push(`current: ${formatScalar(s.current)}`);
  out.push(`deltas: ${formatScalar(s.deltas)}`);
  out.push(`findings: ${formatScalar(s.findings)}`);
  // Flat mirror of findings.open so check-stop.sh needs only grep.
  out.push(`open_findings: ${formatScalar((s.findings || {}).open ?? 0)}`);
  out.push(`no_improvement_streak: ${formatScalar(s.no_improvement_streak)}`);
  out.push(`consecutive_errors: ${formatScalar(s.consecutive_errors)}`);
  // An empty list is just the key with nothing under it; the parser leaves the
  // default [] in place, so no placeholder line is needed.
  out.push('lessons_learned:');
  for (const lesson of s.lessons_learned || []) out.push(`  - ${formatScalar(lesson)}`);
  out.push(`stop_condition: ${formatScalar(s.stop_condition)}`);
  out.push(`stop_reason: ${formatScalar(s.stop_reason)}`);
  out.push(`stopped: ${formatScalar(s.stopped)}`);
  out.push(`last_updated: ${formatScalar(s.last_updated)}`);
  out.push('---');
  return out.join('\n');
}

export function loadState(base = REPO_ROOT) {
  const path = resolve(base, STATE_FILE);
  if (!existsSync(path)) return null;
  return parseState(readFileSync(path, 'utf8'));
}

export function saveState(state, base = REPO_ROOT) {
  const stamped = { ...state, last_updated: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') };
  return writeText(resolve(base, STATE_FILE), formatState(stamped));
}

export function initState(overrides = {}, base = REPO_ROOT) {
  const state = { ...DEFAULT_STATE, ...overrides };
  state.findings = { ...DEFAULT_STATE.findings, ...(overrides.findings || {}) };
  saveState(state, base);
  return state;
}

/** Recompute open_findings so the hook can never read a stale count. */
export function syncFindingCounts(state) {
  const f = state.findings || {};
  const open = Number(f.open);
  state.findings = {
    // -1 (unmeasured) survives normalisation; anything else floors at 0.
    open: Number.isFinite(open) && open < 0 ? -1 : Math.max(0, open || 0),
    fixed: Math.max(0, Number(f.fixed) || 0),
    reverted: Math.max(0, Number(f.reverted) || 0),
    blocked_backend: Math.max(0, Number(f.blocked_backend) || 0),
  };
  return state;
}
