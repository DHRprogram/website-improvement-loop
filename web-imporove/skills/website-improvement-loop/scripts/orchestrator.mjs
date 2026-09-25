#!/usr/bin/env node
// The improvement loop.
//
//   orchestrator.mjs [--focus=MODE] [--max-iterations N] [--min-severity P0|P1|P2|P3]
//                    [--agents S1-S10] [--project PATH] [--parallel N]
//                    [--resume] [--dry-run] [--no-verify]
//
// One iteration is:
//   STATE read -> verify the previous commit -> spawn 10 agents in parallel
//   -> merge -> rank -> pick the top 3-5 -> write FIX-PLAN.md
//   -> STATE write -> check-stop
//
// THE FIX IS NOT AUTOMATED BY DESIGN. Applying a code change is Claude's job,
// not a shell script's. So the orchestrator finishes the mechanical part of an
// iteration, writes FIX-PLAN.md, and hands back to the session, which applies
// the fix, commits, and calls the orchestrator again. The Stop Hook
// (hooks/check-stop.sh) is what decides whether that next call happens.
//
// For unattended runs (CI) use run-loop.mjs, which drives this script until the
// stop condition fires.
//
// exit 0 ran an iteration, or nothing to do | 1 error | 2 stopped

import { spawnSync } from 'node:child_process';
import {
  SKILL_ROOT, REPO_ROOT, WIL_DIR, STATE_FILE, STOP_FILE, FINAL_REPORT,
  MAX_FINDINGS_PER_ITERATION, SEVERITY_NAME, FOCUS_MODES,
  parseArgs, loadState, saveState, initState, syncFindingCounts,
  writeJSON, writeText, readJSON, resolve, join, direction,
} from './lib.mjs';

const { flags } = parseArgs();

function die(msg, code = 1) { console.error(`orchestrator: ${msg}`); process.exit(code); }

const project = resolve(String(flags.project || flags.base || REPO_ROOT));
const dryRun = flags['dry-run'] === true || flags['dry-run'] === 'true';
const doVerify = flags['no-verify'] !== true && flags['no-verify'] !== 'true';
const focusArg = flags.focus ? String(flags.focus) : null;
const minSevArg = flags['min-severity'] ? String(flags['min-severity']) : null;
const maxIterArg = flags['max-iterations'] !== undefined ? Number(flags['max-iterations']) : null;

if (focusArg && !FOCUS_MODES[focusArg]) {
  die(`unknown focus mode '${focusArg}'. valid: ${Object.keys(FOCUS_MODES).join(', ')}`, 2);
}

// --- small helpers ---------------------------------------------------------
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', cwd: project, ...opts });
const log = (...a) => console.log(...a);
const p = (s) => log(...s);

function gitBranch() {
  const r = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  return r.status === 0 ? r.stdout.trim() : null;
}

// --- 1. STATE read ---------------------------------------------------------
let state = loadState(project);
let resumed = false;
if (!state) {
  if (flags.resume) die(`--resume was requested but there is no ${STATE_FILE} to resume from.`);
  state = initState({
    active_focus: focusArg || 'full',
    max_iterations: Number.isFinite(maxIterArg) ? maxIterArg : 10,
    min_severity: minSevArg || 'P2',
  }, project);
  p('  state: initialised');
} else {
  resumed = true;
  if (focusArg) state.active_focus = focusArg;
  if (minSevArg) state.min_severity = minSevArg;
  if (Number.isFinite(maxIterArg)) state.max_iterations = maxIterArg;
}

const focus = state.active_focus;
const focusCfg = FOCUS_MODES[focus];
if (!focusCfg) die(`STATE.md names an unknown focus mode '${focus}'`);
const minSev = state.min_severity;

let agents = focusCfg.subagents;
if (flags.agents !== undefined && flags.agents !== true) {
  agents = [...new Set(String(flags.agents).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const bad = agents.filter((a) => !/^S([1-9]|10)$/.test(a));
  if (bad.length) die(`unknown agent(s): ${bad.join(', ')}`, 2);
}

const iteration = Number(state.iteration_count) + 1;
p('');
p(`=== iteration ${iteration}/${state.max_iterations} — focus=${focus} min_severity=${minSev} (${SEVERITY_NAME[minSev]}) ===`);
p(`  agents: ${agents.join(', ')}`);
p(`  primary metric: ${focusCfg.primary_metric} (${direction(focusCfg.primary_metric)} is better)`);
if (resumed) p(`  resumed from iteration ${state.iteration_count}`);

// --- 2. verify the previous commit ----------------------------------------
let verifyResult = { status: 'skipped', reason: 'no previous commit in this loop' };
if (doVerify && !dryRun && iteration > 1) {
  p('');
  p('--- verify: previous iteration');
  const head = run('git', ['rev-parse', '--short', 'HEAD']);
  const hasHead = head.status === 0;
  if (!hasHead) {
    verifyResult = { status: 'skipped', reason: 'no HEAD' };
  } else {
    const guard = run('bash', [join(SKILL_ROOT, 'scripts', 'verify-change.sh'), focusCfg.primary_metric, direction(focusCfg.primary_metric)]);
    if (guard.status === 0) {
      verifyResult = { status: 'pass', commit: head.stdout.trim() };
      p(`  build, lint, types and tests green; ${focusCfg.primary_metric} did not regress`);
      state.no_improvement_streak = 0;
    } else if (guard.status === 2) {
      const rev = run('git', ['revert', '--no-edit', 'HEAD']);
      if (rev.status === 0) {
        verifyResult = { status: 'reverted', commit: head.stdout.trim(), reason: 'metric regressed' };
        p(`  REGRESSED — reverted ${head.stdout.trim()}`);
        state.findings.reverted += 1;
        state.findings.open = Math.max(0, state.findings.open - 1);
        state.lessons_learned.push(`Iteration ${iteration - 1} regressed ${focusCfg.primary_metric} and was reverted.`);
      } else {
        verifyResult = { status: 'revert-failed', commit: head.stdout.trim(), error: rev.stderr.slice(0, 300) };
        p('  REGRESSED and the automatic revert FAILED — stopping for a human.');
        state.consecutive_errors += 1;
        syncFindingCounts(state); saveState(state, project);
        die(verifyResult.error, 2);
      }
    } else {
      verifyResult = { status: 'failed', commit: head.stdout.trim(), reason: (guard.stderr || guard.stdout || '').slice(0, 300) };
      p('  build, lint, types or tests FAILED — stopping for a human.');
      p(`  ${verifyResult.reason}`);
      state.consecutive_errors += 1;
      syncFindingCounts(state); saveState(state, project);
      die('verification failed', 2);
    }
  }
  writeJSON(join(project, WIL_DIR, `verify-${iteration}.json`), { iteration: iteration - 1, ...verifyResult });
}

// --- 3. spawn agents -------------------------------------------------------
p('');
p(`--- spawn: ${agents.length} agent(s) in parallel`);
const spawnArgs = [join(SKILL_ROOT, 'scripts', 'spawn-agents.mjs'),
  `--agents=${agents.join(',')}`, `--project=${project}`, `--focus=${focus}`];
if (flags.parallel) spawnArgs.push(`--parallel=${String(flags.parallel)}`);
if (flags.model) spawnArgs.push(`--model=${String(flags.model)}`);
if (flags.runner) spawnArgs.push(`--runner=${String(flags.runner)}`);
if (dryRun) spawnArgs.push('--dry-run');
const spawned = run('node', spawnArgs);
process.stdout.write(spawned.stdout || '');
if (spawned.stderr) process.stderr.write(spawned.stderr);

const spawnReport = readJSON(join(project, WIL_DIR, 'spawn-report.json'), null);
const auditable = dryRun ? true : (spawnReport ? spawnReport.agents.filter((a) => a.ok).length : 0);
if (!dryRun && !auditable) {
  p('');
  p('  no agent produced findings — treating this iteration as ERRORED, not as clean.');
  state.consecutive_errors += 1;
  syncFindingCounts(state); saveState(state, project);
  die('no agent runner available or every agent failed; see spawn-report.json', 2);
}
if (spawnReport) {
  const failed = spawnReport.agents.filter((a) => !a.ok);
  if (failed.length) p(`  ${failed.length} agent(s) failed: ${failed.map((f) => f.agent).join(', ')} — those areas are unaudited, not clean`);
}

// --- 4. merge --------------------------------------------------------------
p('');
p('--- merge');
const merged = run('node', [join(SKILL_ROOT, 'scripts', 'merge-findings.mjs'), `--base=${project}`, `--min-severity=${minSev}`, ...(dryRun ? ['--dry-run'] : [])]);
process.stdout.write(merged.stdout || '');
if (merged.stderr) process.stderr.write(merged.stderr);

// --- 5. rank ---------------------------------------------------------------
p('');
p('--- rank');
const ranked = run('node', [join(SKILL_ROOT, 'scripts', 'rank-findings.mjs'), `--base=${project}`, `--min-severity=${minSev}`, `--top=${MAX_FINDINGS_PER_ITERATION}`, ...(dryRun ? ['--dry-run'] : [])]);
process.stdout.write(ranked.stdout || '');
if (ranked.stderr) process.stderr.write(ranked.stderr);

const top = readJSON(join(project, WIL_DIR, 'QUEUE_TOP.json'), []) || [];
const mergedAll = readJSON(join(project, 'artifacts/website-loop/merged.json'), []) || [];

// --- 6. FIX-PLAN -----------------------------------------------------------
const planPath = join(project, 'FIX-PLAN.md');
let plan = '';
plan += `# Fix plan — iteration ${iteration}\n\n`;
plan += `Focus: ${focus} · agents: ${agents.join(', ')} · min severity: ${minSev} (${SEVERITY_NAME[minSev]})\n\n`;
if (top.length) {
  plan += `Top ${top.length} finding(s), by priority = severity_weight x impact / effort:\n\n`;
  plan += '| # | id | sev | priority | title | files | impact/effort |\n';
  plan += '|---|----|-----|----------|-------|-------|--------------|\n';
  for (const [i, f] of top.entries()) {
    plan += `| ${i + 1} | ${f.id} | ${f.severity} | ${f.priority} | ${f.title} | ${(f.files_touched || []).map((x) => `\`${x}\``).join(', ')} | ${f.impact}/${f.effort} |\n`;
  }
  plan += '\n## Detail\n\n';
  for (const f of top) {
    plan += `### ${f.id} — ${f.title}\n\n`;
    plan += `- **Severity** ${f.severity} (${SEVERITY_NAME[f.severity]}) · **agent** ${f.agent}\n`;
    plan += `- **Metric** ${f.metric?.name || 'n/a'}: ${f.metric?.before ?? 'n/a'} -> ${f.metric?.after_null_ok ?? 'n/a'} ${f.metric?.unit || ''}\n`;
    plan += `- **Approach** ${f.fix_sketch}\n`;
    if ((f.evidence || []).length) {
      plan += '- **Evidence**\n';
      for (const e of f.evidence) plan += `  - \`${e.file}:${e.line}\` — ${e.measurement}\n`;
    }
    plan += '\n';
  }
} else {
  plan += 'No findings at or above the severity floor. Nothing to fix this iteration.\n';
}
plan += '## Before committing\n\n';
plan += '```bash\n';
plan += `bash ${join(SKILL_ROOT, 'scripts/guards/no-main-commit.sh')}\n`;
plan += `git add -A && bash ${join(SKILL_ROOT, 'scripts/guards/no-secret-commit.sh')}\n`;
if (focus === 'frontend' || focus === 'design') plan += `bash ${join(SKILL_ROOT, 'scripts/guards/no-backend-touch.sh')}\n`;
plan += 'git commit -m "fix(loop): <what changed>"\n```\n';
if (!dryRun) writeText(planPath, plan);
p(`  -> ${dryRun ? '(dry-run, not written)' : planPath}`);

// --- 7. STATE write --------------------------------------------------------
const openNow = mergedAll.filter((f) => !['fixed', 'reverted'].includes(f.status)).length;
state.findings.open = openNow;
state.findings.fixed += top.length;
state.iteration_count = Number(state.iteration_count) + 1;
state.consecutive_errors = 0;
if (top.length) state.no_improvement_streak = 0; // a fix was applied, the verdict comes next iteration
syncFindingCounts(state);
if (!dryRun) saveState(state, project);

// --- 8. check-stop ---------------------------------------------------------
p('');
p('--- check-stop');
const check = run('bash', [join(SKILL_ROOT, 'hooks', 'check-stop.sh')], { env: { ...process.env, WIL_DIR, WIL_STATE: STATE_FILE, WIL_STOP: STOP_FILE } });
const shouldStop = check.status === 0;
if (check.stderr) process.stderr.write(check.stderr);

if (shouldStop) {
  // A dry run reports the verdict; it never acts on it. Writing the report and
  // exiting non-zero here would make `--dry-run` a destructive command.
  if (dryRun) {
    p('');
    p(`  would stop: ${check.stderr.trim()}`);
    p(`  would write ${join(project, FINAL_REPORT)}`);
    p('dry run complete. Nothing was written.');
    process.exit(0);
  }
  state.stop_condition = state.stop_condition === 'none' || state.stop_condition === 'human_stop'
    ? 'check-stop'
    : state.stop_condition;
  syncFindingCounts(state);
  saveState(state, project);
  writeFinalReport(project, state, mergedAll, top, verifyResult);
  p('');
  p(`loop finished. ${check.stderr.trim()}`);
  p(`report -> ${join(project, FINAL_REPORT)}`);
  process.exit(2);
}

// --- handoff ---------------------------------------------------------------
p('');
p('--- next');
p(`  ${top.length ? 'Apply the fix in FIX-PLAN.md, commit it, then re-run this command.' : 'Nothing to fix. Re-run to continue, or run check-stop.sh to see why.'}`);
p('  The Stop Hook decides whether the loop continues. Do not disable it.');
if (!dryRun) writeJSON(join(project, WIL_DIR, `iteration-${iteration}.json`), {
  iteration, focus, agents, min_severity: minSev,
  findings_in: spawnReport ? spawnReport.total_findings : 0,
  findings_selected: top.map((f) => f.id),
  primary_metric: focusCfg.primary_metric,
  previous_verify: verifyResult,
});
process.exit(0);

// ---------------------------------------------------------------------------
function writeFinalReport(base, st, findings, selected, verification) {
  const f = st.findings || {};
  const lines = [];
  lines.push('# Final report — website improvement loop', '');
  lines.push(`Focus: **${st.active_focus}** · Iterations: **${st.iteration_count}/${st.max_iterations}** · Stop condition: **${st.stop_condition}**`, '');
  lines.push('## Findings', '');
  lines.push('| Outcome | Count |', '|---------|-------|');
  lines.push(`| Fixed | ${f.fixed || 0} |`, `| Reverted | ${f.reverted || 0} |`, `| Blocked (backend) | ${f.blocked_backend || 0} |`, `| Still open | ${f.open || 0} |`, '');
  lines.push('## Metrics', '');
  const keys = Object.keys(st.baseline || {});
  if (!keys.length) {
    lines.push('No baseline was recorded. Nothing to compare — this is a gap, not a result.', '');
  } else {
    lines.push('| Metric | Baseline | Final | Delta | Better |', '|--------|----------|------|-------|--------|');
    for (const k of keys) {
      const b = st.baseline[k], c = st.current?.[k], d = st.deltas?.[k];
      const fmt = (v) => (typeof v === 'number' ? v : 'not measured');
      lines.push(`| ${k} | ${fmt(b)} | ${fmt(c)} | ${d === null || d === undefined ? 'n/a' : d} | ${direction(k)} |`);
    }
    lines.push('');
  }
  lines.push('## Last iteration', '');
  lines.push(`- Selected: ${selected.length ? selected.map((x) => x.id).join(', ') : 'none'}`);
  lines.push(`- Previous verification: ${verification.status}${verification.reason ? ` (${verification.reason})` : ''}`, '');
  if ((st.lessons_learned || []).length) {
    lines.push('## Lessons', '');
    for (const l of st.lessons_learned) lines.push(`- ${l}`);
    lines.push('');
  }
  lines.push('## Open at exit', '');
  const open = findings.filter((x) => !['fixed', 'reverted'].includes(x.status));
  if (!open.length) lines.push('None.', '');
  else for (const o of open) lines.push(`- [${o.severity}] ${o.id} ${o.title} — ${(o.files_touched || []).join(', ')}`);
  lines.push('');
  writeText(join(base, FINAL_REPORT), lines.join('\n'));
}
