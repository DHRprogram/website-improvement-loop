#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const ARTIFACTS_DIR = resolve(process.env.ARTIFACTS_DIR || 'artifacts/redesign');
const STATE_PATH = resolve(ARTIFACTS_DIR, 'STATE.json');
const CHECKPOINT_PATTERN = resolve(ARTIFACTS_DIR, 'STATE.checkpoint.%d.json');

const DEFAULT_STATE = {
  status: 'initialized',
  version: '1.0.0',
  mode: null,
  branch: null,
  phases: {},
  current_phase: null,
  completed_phases: [],
  start_time: null,
  end_time: null,
  hst_fired: null,
  iterations: 0,
  last_checkpoint: null,
};

function ensureDir() {
  if (!existsSync(ARTIFACTS_DIR)) {
    mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
}

export function readState() {
  if (!existsSync(STATE_PATH)) {
    return { ...DEFAULT_STATE, start_time: new Date().toISOString() };
  }
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  } catch (e) {
    console.error(`State read error: ${e.message}. Starting fresh.`);
    return { ...DEFAULT_STATE, start_time: new Date().toISOString() };
  }
}

export function writeState(state) {
  ensureDir();
  state.updated_at = new Date().toISOString();
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

export function checkpoint(state) {
  ensureDir();
  const cp = state.iteration || 0;
  const cpPath = resolve(ARTIFACTS_DIR, `STATE.checkpoint.${cp}.json`);
  writeFileSync(cpPath, JSON.stringify(state, null, 2), 'utf-8');
  state.last_checkpoint = cp;
  state.updated_at = new Date().toISOString();
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  return cp;
}

export function phaseComplete(state, phaseId, report) {
  if (!state.completed_phases.includes(phaseId)) {
    state.completed_phases.push(phaseId);
  }
  state.phases[phaseId] = {
    status: 'complete',
    completed_at: new Date().toISOString(),
    report: report || {},
  };
  state.current_phase = null;
  writeState(state);
  checkpoint(state);
}

export function phaseStart(state, phaseId) {
  state.current_phase = phaseId;
  state.phases[phaseId] = state.phases[phaseId] || { status: 'in_progress', started_at: new Date().toISOString() };
  state.phases[phaseId].status = 'in_progress';
  state.phases[phaseId].started_at = new Date().toISOString();
  writeState(state);
}

export function resumeState() {
  const state = readState();
  if (state.status === 'complete') {
    console.log('Redesign already complete. Use --force to re-run.');
    process.exit(0);
  }
  const lastPhase = state.current_phase || state.completed_phases[state.completed_phases.length - 1];
  if (lastPhase) {
    console.log(`Resuming from phase: ${lastPhase}`);
    console.log(`Completed phases: ${state.completed_phases.join(', ')}`);
  }
  return state;
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('state-manager.mjs')) {
  const cmd = process.argv[2];
  if (cmd === 'read') {
    const s = readState();
    console.log(JSON.stringify(s, null, 2));
  } else if (cmd === 'checkpoint') {
    const s = readState();
    checkpoint(s);
    console.log(`Checkpoint ${s.last_checkpoint} written.`);
  } else if (cmd === 'resume') {
    resumeState();
  } else {
    console.log('Usage: state-manager.mjs [read|checkpoint|resume]');
  }
}
