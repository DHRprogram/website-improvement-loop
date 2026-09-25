#!/usr/bin/env node
// Spawn the auditor subagents, one isolated context each, and collect their
// findings.
//
//   spawn-agents.mjs --agents=S1-S10 --project <path>
//                   [--parallel N] [--model M] [--runner CMD] [--timeout S] [--dry-run]
//
// Each agent gets:
//   - its own definition from agents/S<N>.md
//   - the project path and the focus mode
//   - an isolated process, so one agent's context cannot leak into another's
//   - a strict instruction to emit JSON matching scripts/finding-schema.json
//
// Output: artifacts/website-loop/findings/S<N>.json, plus a spawn-report.json
// recording who ran, who failed and why.
//
// HONESTY: when no agent runner is available this writes an EMPTY findings
// file with a note. It does not invent findings. A fabricated audit is worse
// than a missing one, because every downstream phase trusts it.
//
// exit 0 all agents produced output | 1 usage error | 2 some agent failed

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import {
  SKILL_ROOT, WIL_DIR, FINDINGS_DIR, AGENTS, REPO_ROOT,
  parseArgs, writeJSON, join, resolve,
} from './lib.mjs';

const { flags } = parseArgs();

const project = resolve(String(flags.project || flags.base || REPO_ROOT));
const runner = String(flags.runner || process.env.WIL_AGENT_RUNNER || 'claude');
const model = flags.model ? String(flags.model) : null;
const timeoutS = Math.max(10, Number(flags.timeout || 900));
const dryRun = flags['dry-run'] === true || flags['dry-run'] === 'true';

let agentIds;
if (flags.agents === undefined || flags.agents === true) agentIds = [...AGENTS];
else {
  agentIds = [...new Set(String(flags.agents).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const bad = agentIds.filter((a) => !AGENTS.includes(a));
  if (bad.length) { console.error(`spawn-agents: unknown agent(s): ${bad.join(', ')}. valid: ${AGENTS.join(', ')}`); process.exit(1); }
  if (!agentIds.length) { console.error('spawn-agents: --agents was empty'); process.exit(1); }
}

const maxParallel = Math.max(1, Number(flags.parallel) || agentIds.length);
const outDir = join(project, FINDINGS_DIR);
const focus = flags.focus ? String(flags.focus) : 'full';

function definitionFor(id) {
  const map = {
    S1: 'S1-bug-hunter.md', S2: 'S2-design-critic.md', S3: 'S3-ux-auditor.md',
    S4: 'S4-perf-engineer.md', S5: 'S5-a11y-auditor.md', S6: 'S6-test-guardian.md',
    S7: 'S7-seo-auditor.md', S8: 'S8-security-scanner.md', S9: 'S9-architecture-reviewer.md',
    S10: 'S10-mobile-auditor.md',
  };
  const path = join(SKILL_ROOT, 'agents', map[id]);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

function buildPrompt(id) {
  const def = definitionFor(id);
  const schema = readFileSync(join(SKILL_ROOT, 'scripts', 'finding-schema.json'), 'utf8');
  return [
    def ? def : `You are ${id}, a website auditor. Follow the detection checklist for your specialty.`,
    '',
    '--- TASK ---',
    `Project root: ${project}`,
    `Focus mode: ${focus}`,
    '',
    'Audit the project. Report ONLY defects you can point at with a file path and a',
    'line number, or a command output you actually ran. Do not speculate. Do not',
    'report a defect you have not verified. An empty list is a valid and often',
    'correct answer.',
    '',
    '--- OUTPUT ---',
    'Reply with a JSON array and nothing else. No prose, no markdown fence.',
    'Every element must validate against this JSON Schema draft-07 document:',
    '',
    schema,
    '',
    'Example of the required shape:',
    JSON.stringify([{
      id: `F-${id}-0001`,
      agent: id,
      severity: 'P2',
      title: 'Short imperative title, max 120 characters',
      evidence: [{ file: 'src/example.ts', line: 12, snippet: 'the offending line', measurement: '42 occurrences' }],
      impact: 3,
      effort: 2,
      fix_sketch: 'one or two sentences on the approach',
      metric: { name: 'design_system_violations', before: 1, after_null_ok: null, unit: 'count' },
      files_touched: ['src/example.ts'],
      status: 'open',
    }], null, 2),
  ].join('\n');
}

function hasRunner() {
  const probe = spawn('sh', ['-c', `command -v ${JSON.stringify(runner)}`], { stdio: 'ignore' });
  return new Promise((res) => { probe.on('error', () => res(false)); probe.on('exit', (code) => res(code === 0)); });
}

/** Pull a JSON array out of a model's reply, tolerating a stray code fence. */
function extractJSON(text) {
  const raw = String(text || '').trim();
  const candidates = [];
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) candidates.push(fence[1].trim());
  candidates.push(raw);
  const first = raw.indexOf('[');
  const last = raw.lastIndexOf(']');
  if (first !== -1 && last > first) candidates.push(raw.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* try the next shape */ }
  }
  return null;
}

function runAgent(id) {
  return new Promise((resolvePromise) => {
    const started = Date.now();
    const prompt = buildPrompt(id);
    const args = ['-p', prompt];
    if (model) args.push('--model', model);
    args.push('--output-format', 'json');

    let child;
    try {
      child = spawn(runner, args, { cwd: project, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      resolvePromise({ agent: id, ok: false, error: `could not start runner: ${err.message}`, findings: [], duration_ms: Date.now() - started });
      return;
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutS * 1000);

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolvePromise({ agent: id, ok: false, error: `runner error: ${err.message}`, findings: [], duration_ms: Date.now() - started });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolvePromise({ agent: id, ok: false, error: `timed out after ${timeoutS}s`, findings: [], duration_ms: Date.now() - started });
        return;
      }
      if (code !== 0) {
        resolvePromise({ agent: id, ok: false, error: `runner exited ${code}: ${stderr.slice(0, 400)}`, findings: [], duration_ms: Date.now() - started });
        return;
      }
      // The runner may wrap the reply in its own JSON envelope.
      let body = stdout;
      try {
        const env = JSON.parse(stdout);
        if (typeof env.result === 'string') body = env.result;
        else if (typeof env.text === 'string') body = env.text;
      } catch { /* stdout was the bare array, which extractJSON handles */ }
      const findings = extractJSON(body);
      if (findings === null) {
        resolvePromise({ agent: id, ok: false, error: 'reply did not contain a JSON array of findings', findings: [], duration_ms: Date.now() - started });
        return;
      }
      resolvePromise({ agent: id, ok: true, findings, duration_ms: Date.now() - started });
    });
  });
}

if (dryRun) {
  console.error('[dry-run] spawn-agents');
  console.log(JSON.stringify({
    project, runner, model, focus, timeout_s: timeoutS,
    max_parallel: maxParallel,
    agents: agentIds.map((id) => ({ id, definition: definitionFor(id) ? 'present' : 'MISSING', prompt_chars: buildPrompt(id).length })),
    output: join(outDir, 'S<N>.json'),
  }, null, 2));
  process.exit(0);
}

const runnerAvailable = await hasRunner();
if (!runnerAvailable) {
  console.error(`spawn-agents: agent runner '${runner}' not found on PATH.`);
  console.error('  Set WIL_AGENT_RUNNER to a command that accepts `-p <prompt> --output-format json`,');
  console.error('  or install one (e.g. the `claude` CLI) so the auditors can actually run.');
  const note = { agent: null, ok: false, error: `runner '${runner}' not found`, findings: [], runner };
  for (const id of agentIds) {
    writeJSON(join(outDir, `${id}.json`), { agent: id, findings: [], note: note.error, recorded_at: new Date().toISOString() });
  }
  writeJSON(join(project, WIL_DIR, 'spawn-report.json'), { ...note, agents: agentIds.map((id) => ({ id, ok: false })) });
  process.exit(2);
}

console.log(`spawning ${agentIds.length} agent(s), up to ${maxParallel} at a time, via '${runner}'`);

const results = [];
let cursor = 0;
async function worker() {
  while (cursor < agentIds.length) {
    const id = agentIds[cursor++];
    const result = await runAgent(id);
    results.push(result);
    const path = join(outDir, `${id}.json`);
    if (result.ok) {
      writeJSON(path, { agent: id, findings: result.findings, duration_ms: result.duration_ms, recorded_at: new Date().toISOString() });
      console.log(`  ${id}: ${result.findings.length} finding(s) in ${(result.duration_ms / 1000).toFixed(1)}s`);
    } else {
      writeJSON(path, { agent: id, findings: [], error: result.error, duration_ms: result.duration_ms, recorded_at: new Date().toISOString() });
      console.error(`  ${id}: FAILED — ${result.error}`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(maxParallel, agentIds.length) }, worker));

results.sort((a, b) => agentIds.indexOf(a.agent) - agentIds.indexOf(b.agent));
const failed = results.filter((r) => !r.ok);
const totalFindings = results.reduce((n, r) => n + r.findings.length, 0);
writeJSON(join(project, WIL_DIR, 'spawn-report.json'), {
  project, runner, model, focus,
  agents: results.map((r) => ({ agent: r.agent, ok: r.ok, findings: r.findings.length, duration_ms: r.duration_ms, error: r.error || null })),
  total_findings: totalFindings,
  failed: failed.length,
  recorded_at: new Date().toISOString(),
});

console.log(`\n${results.length - failed.length}/${results.length} agent(s) succeeded, ${totalFindings} finding(s) total -> ${outDir}`);
if (failed.length) {
  console.error(`${failed.length} agent(s) failed. See spawn-report.json. Treat their area as unaudited, not as clean.`);
  process.exit(2);
}
process.exit(0);
