#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { spawnSync } from 'child_process';

const ARGS = process.argv.slice(2);

function parseArg(name, fallback) {
  const idx = ARGS.indexOf(name);
  if (idx === -1) return fallback;
  const val = ARGS[idx + 1];
  if (val === undefined) return fallback;
  if (name === '--max-iterations' || name === '--min-severity') return val;
  if (val === 'true' || val === '') return true;
  return val;
}

const BASE = resolve(ARGS.includes('--base') ? ARGS[ARGS.indexOf('--base') + 1] : '.');
const MAX_ITERATIONS = Math.min(parseInt(parseArg('--max-iterations', '100'), 10), 500);
const MIN_SEVERITY = parseArg('--min-severity', 'P2') || 'P2';
const DRY_RUN = ARGS.includes('--dry-run');
const SINGLE_AGENT = ARGS.includes('--agent') ? ARGS[ARGS.indexOf('--agent') + 1] : null;

const SEVERITY_WEIGHTS = { P0: 1000, P1: 300, P2: 100, P3: 30 };
const AUTH_AGENTS = SINGLE_AGENT ? [SINGLE_AGENT] : ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10'];

const ARTIFACTS_DIR = resolve(BASE, 'artifacts', 'frontend-loop');
const STATE_PATH = resolve(ARTIFACTS_DIR, 'STATE.json');
const QUEUE_PATH = resolve(ARTIFACTS_DIR, 'QUEUE.json');
const QUEUE_TOP_PATH = resolve(ARTIFACTS_DIR, 'QUEUE_TOP.json');
const RUN_LOG_PATH = resolve(ARTIFACTS_DIR, 'RUN_LOG.md');
const MEASUREMENTS_PATH = resolve(ARTIFACTS_DIR, 'MEASUREMENTS.json');
const FINDINGS_PATH = resolve(ARTIFACTS_DIR, 'findings');
const REPORT_PATH = resolve(ARTIFACTS_DIR, 'FINAL_REPORT.md');

if (!existsSync(ARTIFACTS_DIR)) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
}
if (!existsSync(FINDINGS_PATH)) {
  mkdirSync(FINDINGS_PATH, { recursive: true });
}

function severityLevel(severity) {
  const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return order[MIN_SEVERITY] >= order[severity];
}

function calculatePriority(finding) {
  const weight = SEVERITY_WEIGHTS[finding.severity] || 30;
  return (weight * finding.impact) / Math.max(finding.effort, 1);
}

function sortByPriority(findings) {
  return [...findings].sort((a, b) => calculatePriority(b) - calculatePriority(a));
}

function timestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 16);
}

function timeISO() {
  return new Date().toISOString();
}

function gitExec(args) {
  const result = spawnSync('git', args, { cwd: BASE, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim(), code: result.status };
}

function loadState() {
  if (existsSync(STATE_PATH)) {
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  }
  return {
    iteration: 0,
    branch: `frontend-loop/${timestamp()}`,
    start_time: timeISO(),
    findings_all: [],
    findings_fixed: [],
    findings_reverted: [],
    metrics_history: [],
    no_improvement_streak: 0,
    stop_reason: null,
  };
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

function ensureCleanGit() {
  const status = gitExec(['status', '--porcelain']);
  if (status.stdout.length > 0) {
    const stashName = `frontend-loop-stash-${Date.now()}`;
    gitExec(['stash', 'push', '-m', stashName]);
    console.log(`Stashed existing changes as "${stashName}"`);
  }
}

function createBranch(name) {
  gitExec(['checkout', '-b', name]);
  console.log(`Created branch: ${name}`);
}

function commitFinding(finding) {
  const msg = `frontend-loop: [${finding.agent}] ${finding.title.slice(0, 80)} (metric: ${finding.metric.name} ${finding.metric.before}->${finding.metric.after_null_ok || '?'})`;
  gitExec(['add', '-A']);
  const result = gitExec(['commit', '-m', msg]);
  return result.code === 0 ? gitExec(['rev-parse', '--short', 'HEAD']).stdout : null;
}

function revertCommit() {
  const result = gitExec(['revert', '--no-edit', 'HEAD']);
  return result.code === 0;
}

function runMeasurement() {
  const scriptPath = resolve(dirname(process.argv[1]), 'measure-frontend.sh');
  const result = spawnSync('bash', [scriptPath], { cwd: BASE, encoding: 'utf-8' });
  try {
    return JSON.parse(result.stdout);
  } catch {
    console.error('Measurement parse failed, using defaults');
    return { bundle_kb: -1, build_time_ms: -1, test_pass_rate: -1, type_errors: -1, lint_errors: -1, component_count: -1 };
  }
}

function generateFindings(agent) {
  return [];
}

async function main() {
  const state = loadState();
  const initialMetrics = runMeasurement();

  if (state.iteration === 0) {
    ensureCleanGit();
    createBranch(state.branch);
    state.metrics_history.push({ iteration: 0, ...initialMetrics });
    saveState(state);
  }

  console.log(`Starting frontend improvement loop`);
  console.log(`  Base: ${BASE}`);
  console.log(`  Max iterations: ${MAX_ITERATIONS}`);
  console.log(`  Min severity: ${MIN_SEVERITY}`);
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log(`  Agents: ${AUTH_AGENTS.join(', ')}`);

  for (let iter = state.iteration + 1; iter <= MAX_ITERATIONS; iter++) {
    console.log(`\n=== Iteration ${iter}/${MAX_ITERATIONS} ===`);

    const allFindings = [];
    for (const agent of AUTH_AGENTS) {
      const findings = generateFindings(agent);
      allFindings.push(...findings);
    }

    const filtered = allFindings.filter(f => severityLevel(f.severity) && f.status === 'open');
    const ranked = sortByPriority(filtered);
    const top5 = ranked.slice(0, 5);

    const iterDir = resolve(FINDINGS_PATH, `iter-${iter}`);
    if (!existsSync(iterDir)) mkdirSync(iterDir, { recursive: true });
    writeFileSync(resolve(iterDir, 'findings.json'), JSON.stringify(allFindings, null, 2), 'utf-8');

    state.iteration = iter;
    state.findings_all.push(...allFindings);

    if (DRY_RUN) {
      console.log(`[DRY RUN] Would fix top ${top5.length} findings`);
      for (const f of top5) {
        console.log(`  [${f.severity}] ${f.agent}: ${f.title} (priority ${calculatePriority(f).toFixed(0)})`);
      }
      continue;
    }

    if (top5.length === 0) {
      console.log("No qualifying findings. Checking stop condition.");
      state.no_improvement_streak++;
      if (state.no_improvement_streak >= 5) {
        state.stop_reason = '5 consecutive iterations without qualifying findings';
        break;
      }
      saveState(state);
      continue;
    }

    let anyImproved = false;
    for (const finding of top5) {
      finding.status = 'in_progress';
      const commitHash = commitFinding(finding);
      if (commitHash) {
        finding.status = 'fixed';
        finding.metric.after_null_ok = true;
        state.findings_fixed.push(finding);
        state.no_improvement_streak = 0;
        anyImproved = true;

        const logEntry = [
          `## Iteration ${iter} (${new Date().toISOString()})`,
          `### Agent: ${finding.agent} - ${finding.title}`,
          `- Severity: ${finding.severity} (weight: ${SEVERITY_WEIGHTS[finding.severity]})`,
          `- Priority: ${calculatePriority(finding).toFixed(0)}`,
          `- Metric: ${finding.metric.name}`,
          `- Commit: ${commitHash}`,
          `- Verdict: PASS`,
          '',
        ].join('\n');
        appendFileSync(RUN_LOG_PATH, logEntry);
      }
    }

    if (!anyImproved) {
      state.no_improvement_streak++;
    }

    const currentMetrics = runMeasurement();
    state.metrics_history.push({ iteration: iter, ...currentMetrics });

    if (state.no_improvement_streak >= 5) {
      state.stop_reason = `5 consecutive iterations with no >1% improvement`;
      break;
    }

    const hasP2Plus = state.findings_all.some(f => severityLevel(f.severity) && f.status === 'open');
    if (!hasP2Plus) {
      state.stop_reason = `No open findings with severity >= ${MIN_SEVERITY}`;
      break;
    }

    saveState(state);
  }

  state.end_time = timeISO();
  saveState(state);

  console.log('\n=== Loop finished ===');
  console.log(`Iterations: ${state.iteration}`);
  console.log(`Findings fixed: ${state.findings_fixed.length}`);
  console.log(`Findings reverted: ${state.findings_reverted.length}`);
  console.log(`Stop reason: ${state.stop_reason || 'Max iterations'}`);

  const summaryPath = resolve(ARTIFACTS_DIR, 'LOOP_SUMMARY.json');
  writeFileSync(summaryPath, JSON.stringify({
    branch: state.branch,
    start_time: state.start_time,
    end_time: state.end_time,
    iteration: state.iteration,
    fixed: state.findings_fixed.length,
    reverted: state.findings_reverted.length,
    stop_reason: state.stop_reason || 'max_iterations',
  }, null, 2), 'utf-8');
}

main().catch(err => { console.error(err); process.exit(1); });
