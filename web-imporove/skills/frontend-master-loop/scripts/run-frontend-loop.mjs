#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { spawnSync } from 'child_process';

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const RESUME = ARGS.includes('--resume');
const NO_CUTOVER = ARGS.includes('--no-cutover');

const ARTIFACTS_DIR = resolve('artifacts/redesign');
const APPROVALS_PATH = resolve(ARTIFACTS_DIR, 'APPROVALS.json');
const STATE_PATH = resolve(ARTIFACTS_DIR, 'STATE.json');

const PHASES = [
  { id: 'P0', label: 'Approval Harvest', guarded: false },
  { id: 'P1', label: 'Composition Registry', guarded: false },
  { id: 'R0', label: 'Preflight', guarded: true },
  { id: 'R1', label: 'Preservation', guarded: true },
  { id: 'R2', label: 'Spec Extraction', guarded: false },
  { id: 'R3', label: 'Data Contract Freeze', guarded: true },
  { id: 'R4', label: 'Golden Tests', guarded: true },
  { id: 'R5', label: 'Design System', guarded: true },
  { id: 'R6', label: 'Backend Rebuild', guarded: true },
  { id: 'R7', label: 'Frontend Rebuild', guarded: true },
  { id: 'R8', label: 'Strangler Migration', guarded: true },
  { id: 'R8.5', label: 'Parity Gates', guarded: true },
  { id: 'R8.7', label: 'Load + Chaos + Backup', guarded: true },
  { id: 'R9', label: 'Canary Cutover', guarded: true },
  { id: 'R9.5', label: 'Post-Cutover Monitor', guarded: true },
  { id: 'R10', label: 'Cleanup', guarded: true },
];

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function loadJSON(p) {
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}

function runScript(script, args = []) {
  const result = spawnSync('node', [script, ...args], { encoding: 'utf-8', stdio: 'pipe' });
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim(), code: result.status };
}

function runBash(script, args = []) {
  const result = spawnSync('bash', [script, ...args], { encoding: 'utf-8', stdio: 'pipe' });
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim(), code: result.status };
}

function writeJSON(p, data) {
  ensureDir(dirname(p));
  writeFileSync(p, JSON.stringify(data, null, 2));
}

function guardRunner(phaseId) {
  const guards = {
    R0: ['no-prod-touch.sh', 'no-secret-commit.sh'],
    R1: ['no-prod-touch.sh', 'no-secret-commit.sh'],
    R3: ['no-schema-change.sh'],
    R4: ['golden-tests-must-pass.sh', 'no-prod-touch.sh'],
    R5: ['no-prod-touch.sh', 'perf-budget.sh'],
    R6: ['no-prod-touch.sh', 'no-schema-change.sh', 'security-gate.sh', 'perf-budget.sh'],
    R7: ['no-prod-touch.sh', 'no-secret-commit.sh', 'a11y-gate.sh', 'seo-gate.sh', 'i18n-parity.sh'],
    R8: ['no-prod-touch.sh', 'no-schema-change.sh', 'golden-tests-must-pass.sh', 'security-gate.sh', 'a11y-gate.sh', 'seo-gate.sh', 'i18n-parity.sh', 'analytics-parity.sh', 'integrations-parity.sh', 'observability-parity.sh'],
    "R8.5": ['a11y-gate.sh', 'seo-gate.sh', 'i18n-parity.sh', 'analytics-parity.sh', 'integrations-parity.sh', 'observability-parity.sh'],
    "R8.7": ['load-test.sh', 'backup-drill.sh', 'cost-delta.sh'],
    R9: ['cost-delta.sh', 'no-prod-touch.sh', 'flag-safety.sh'],
    "R9.5": ['cost-delta.sh'],
    R10: ['no-prod-touch.sh'],
  };
  return guards[phaseId] || [];
}

function runGuards(phaseId) {
  const guardList = guardRunner(phaseId);
  if (guardList.length === 0) return { pass: true, errors: [] };
  let allPass = true;
  const errors = [];
  for (const g of guardList) {
    const gPath = resolve('skills/frontend-master-loop/scripts/guards', g);
    if (!existsSync(gPath)) { console.log(`  Guard ${g} not found, skipping.`); continue; }
    const result = runBash(gPath);
    if (result.code !== 0) {
      allPass = false;
      errors.push(`Guard ${g} failed: ${result.stderr || result.stdout}`);
    }
  }
  return { pass: allPass, errors };
}

function resolvePhaseIndex(completedPhases) {
  for (let i = 0; i < PHASES.length; i++) {
    if (!completedPhases.includes(PHASES[i].id)) return i;
  }
  return PHASES.length;
}

async function main() {
  ensureDir(ARTIFACTS_DIR);

  console.log('=== Frontend Master Loop v1.0.0 ===');
  if (DRY_RUN) console.log('[DRY RUN] No files will be modified.');
  if (RESUME) console.log('[RESUME] Resuming from last checkpoint.');
  if (NO_CUTOVER) console.log('[NO CUTOVER] Skipping R9 cutover.');

  // Load or init state
  let state = loadJSON(STATE_PATH);
  if (!state) {
    state = { version: '1.0.0', mode: 'strangler', status: 'running', phases: {}, completed_phases: [], current_phase: null, start_time: new Date().toISOString(), hst_fired: null };
  }

  const startPhaseIdx = RESUME ? resolvePhaseIndex(state.completed_phases) : 0;

  if (startPhaseIdx === 0 && !RESUME) {
    // Phase P0
    if (!DRY_RUN) {
      const approvals = loadJSON(APPROVALS_PATH);
      if (!approvals || !approvals.locked) {
        console.log('\nPhase P0: Run approval-harvest.mjs first:');
        console.log('  node skills/frontend-master-loop/scripts/approval-harvest.mjs --print');
        console.log('  node skills/frontend-master-loop/scripts/approval-harvest.mjs --json \'{"scope":{...}}\'');
        console.log('Or pass answers as JSON string:');
        console.log('  --answers \'{"scope":...}\'\n');

        const ansIdx = ARGS.indexOf('--answers');
        if (ansIdx >= 0) {
          const jsonStr = ARGS[ansIdx + 1];
          const result = runScript('skills/frontend-master-loop/scripts/approval-harvest.mjs', ['--json', jsonStr]);
          console.log(result.stdout);
          if (result.code !== 0) { console.error(result.stderr); process.exit(1); }
        } else {
          console.log('No APPROVALS.json found. Phase 0 skipped (dry-run or no --answers).');
          if (!DRY_RUN) process.exit(1);
        }
      }
      state.completed_phases.push('P0');
    }
    // Phase P1
    if (!DRY_RUN) {
      runScript('skills/frontend-master-loop/scripts/composition-scan.mjs');
    }
    state.completed_phases.push('P1');
    writeJSON(STATE_PATH, state);
  }

  // Run all phases from startPhaseIdx
  for (let i = startPhaseIdx; i < PHASES.length; i++) {
    const phase = PHASES[i];

    // Skip R9 if NO_CUTOVER
    if (phase.id === 'R9' && NO_CUTOVER) {
      console.log(`\nSkipping ${phase.id}: ${phase.label} (--no-cutover)`);
      state.completed_phases.push(phase.id);
      continue;
    }

    if (state.completed_phases.includes(phase.id)) {
      console.log(`\nSkipping ${phase.id}: ${phase.label} (already completed)`);
      continue;
    }

    console.log(`\n=== Phase ${phase.id}: ${phase.label} ===`);
    state.current_phase = phase.id;
    writeJSON(STATE_PATH, state);

    if (DRY_RUN && phase.id !== 'P0' && phase.id !== 'P1') {
      const guardResult = runGuards(phase.id);
      if (!guardResult.pass) {
        console.log(`  [DRY RUN] Guards would fail:`);
        for (const e of guardResult.errors) console.log(`  ${e}`);
      } else {
        console.log(`  [DRY RUN] Guards would pass.`);
      }
      state.completed_phases.push(phase.id);
      writeJSON(STATE_PATH, state);
      continue;
    }

    // Real execution
    if (phase.guarded) {
      let attempts = 0;
      const MAX_ATTEMPTS = 3;
      let pass = false;
      while (attempts < MAX_ATTEMPTS && !pass) {
        attempts++;
        const guardResult = runGuards(phase.id);
        if (guardResult.pass) {
          pass = true;
        } else {
          console.log(`  Guard failed (attempt ${attempts}/${MAX_ATTEMPTS}): ${guardResult.errors.join(', ')}`);
          if (attempts < MAX_ATTEMPTS) {
            console.log('  Self-healing...');
          }
        }
      }
      if (!pass) {
        console.log(`\n*** HARD STOP: Phase ${phase.id} guards failed after ${MAX_ATTEMPTS} attempts ***`);
        const hstReport = {
          trigger: `HST-01`,
          phase: phase.id,
          reason: `Guards failed after ${MAX_ATTEMPTS} self-heal attempts`,
          timestamp: new Date().toISOString(),
          errors: guardRunner(phase.id).map(g => g),
        };
        state.hst_fired = hstReport;
        writeJSON(STATE_PATH, state);
        writeJSON(resolve(ARTIFACTS_DIR, `HARD_STOP_01_${Date.now()}.json`), hstReport);
        process.exit(1);
      }
    }

    state.completed_phases.push(phase.id);
    state.phases[phase.id] = { status: 'complete', completed_at: new Date().toISOString() };
    writeJSON(STATE_PATH, state);
    console.log(`  Phase ${phase.id} complete.`);
  }

  // Final
  state.status = 'complete';
  state.end_time = new Date().toISOString();
  state.current_phase = null;
  writeJSON(STATE_PATH, state);

  console.log('\n=== Frontend Master Loop Complete ===');
  console.log(`Completed ${state.completed_phases.length}/${PHASES.length} phases.`);
}

main().catch(e => { console.error(e); process.exit(1); });
