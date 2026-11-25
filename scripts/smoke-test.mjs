#!/usr/bin/env node
// Smoke test: runs the data-pipeline scripts against fixture files (examples/)
// without a browser. Exits non-zero on any failure.
import { mkdtempSync, mkdirSync, cpSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

function step(name, fn) {
  try {
    fn();
    console.log('[PASS] ' + name);
  } catch (e) {
    failures++;
    console.error('[FAIL] ' + name + ' — ' + e.message);
  }
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: opts.cwd || ROOT, env: { ...process.env, ...(opts.env || {}) } });
  if (opts.expectExit !== undefined && r.status !== opts.expectExit) {
    throw new Error('exit ' + r.status + ' (expected ' + opts.expectExit + ')\n' + (r.stderr || r.stdout || ''));
  }
  if (opts.expectExit === undefined && r.status !== 0) {
    throw new Error('exit ' + r.status + '\n' + (r.stderr || r.stdout || ''));
  }
  return r;
}

const work = mkdtempSync(join(tmpdir(), 'wil-smoke-'));
console.log('Workdir: ' + work);

try {
  // 1. measure.sh writes parseable metrics
  step('measure.sh produces valid metrics JSON', () => {
    const outDir = join(work, 'metrics');
    run('bash', [join(ROOT, 'scripts/measure.sh'), 'smoke'], { cwd: work, env: { METRICS_DIR: outDir } });
    const m = JSON.parse(readFileSync(join(outDir, 'smoke.json'), 'utf8'));
    for (const k of ['label', 'date', 'bundle_kb', 'todos', 'deps']) {
      if (m[k] === undefined) throw new Error('missing field ' + k);
    }
  });

  // 2. aggregate-findings on fixtures
  const utDir = join(work, 'artifacts', 'USER_TEST');
  step('aggregate-findings on example personas', () => {
    mkdirSync(utDir, { recursive: true });
    cpSync(join(ROOT, 'examples/persona-01.example.json'), join(utDir, 'persona-01.json'));
    cpSync(join(ROOT, 'examples/persona-11.example.json'), join(utDir, 'persona-11.json'));
    run(process.execPath, [join(ROOT, 'scripts/user-test/aggregate-findings.mjs'), utDir]);
    const agg = JSON.parse(readFileSync(join(utDir, 'AGGREGATE.json'), 'utf8'));
    if (agg.personas_count !== 2) throw new Error('expected 2 personas, got ' + agg.personas_count);
    if (!agg.attack_summary || agg.attack_summary.total < 1) throw new Error('attack_summary missing');
    if (!existsSync(join(utDir, 'AGGREGATE.md'))) throw new Error('AGGREGATE.md not written');
  });

  // 3. dedup-findings mutates AGGREGATE safely
  step('dedup-findings runs on AGGREGATE.json', () => {
    run(process.execPath, [join(ROOT, 'scripts/dedup-findings.mjs'), join(utDir, 'AGGREGATE.json')]);
    const agg = JSON.parse(readFileSync(join(utDir, 'AGGREGATE.json'), 'utf8'));
    if (!agg.dedup_stats) throw new Error('dedup_stats missing');
  });

  // 4. html-report renders
  step('html-report renders REPORT.html', () => {
    const out = join(work, 'REPORT.html');
    run(process.execPath, [join(ROOT, 'scripts/html-report.mjs'), join(utDir, 'AGGREGATE.json'), out]);
    const html = readFileSync(out, 'utf8');
    if (!html.includes('User Test Report')) throw new Error('report content missing');
  });

  // 5. baseline-save writes BOTH artifacts/BASELINE.json and .claude/baselines/...
  step('baseline-save writes artifacts/BASELINE.json + per-project baseline', () => {
    run(process.execPath, [join(ROOT, 'scripts/user-test/baseline-save.mjs'), 'smoke', 'smoketest'], { cwd: work });
    if (!existsSync(join(work, 'artifacts/BASELINE.json'))) throw new Error('artifacts/BASELINE.json missing');
    if (!existsSync(join(work, '.claude/baselines/smoketest/BASELINE.json'))) throw new Error('per-project baseline missing');
    JSON.parse(readFileSync(join(work, 'artifacts/BASELINE.json'), 'utf8'));
  });

  // 6. baseline-check verdict PASS against its own baseline
  step('baseline-check PASSes against freshly saved baseline', () => {
    const r = run(process.execPath, [join(ROOT, 'scripts/user-test/baseline-check.mjs')], { cwd: work, expectExit: 0 });
    if (!r.stdout.includes('PASS')) throw new Error('verdict not PASS:\n' + r.stdout);
    if (!existsSync(join(work, 'artifacts/REGRESSION_REPORT.json'))) throw new Error('report not written');
  });

  // 7. baseline-check FAILs when friction regresses
  step('baseline-check FAILs on injected friction regression', () => {
    const aggPath = join(utDir, 'AGGREGATE.json');
    const agg = JSON.parse(readFileSync(aggPath, 'utf8'));
    const orig = agg.overall_friction_avg;
    agg.overall_friction_avg = (orig || 0) + 5;
    writeFileSync(aggPath, JSON.stringify(agg, null, 2));
    run(process.execPath, [join(ROOT, 'scripts/user-test/baseline-check.mjs')], { cwd: work, expectExit: 1 });
    agg.overall_friction_avg = orig;
    writeFileSync(aggPath, JSON.stringify(agg, null, 2));
  });

  // 8. trend-chart with >=2 metrics files
  step('trend-chart renders SVG from metrics', () => {
    const mDir = join(work, 'metrics');
    writeFileSync(join(mDir, 'm1.json'), JSON.stringify({ label: 'a', date: '2026-01-01', bundle_kb: 10, todos: 1, deps: 2 }));
    writeFileSync(join(mDir, 'm2.json'), JSON.stringify({ label: 'b', date: '2026-01-02', bundle_kb: 12, todos: 2, deps: 2 }));
    const out = join(work, 'TREND.svg');
    run(process.execPath, [join(ROOT, 'scripts/trend-chart.mjs'), mDir, out]);
    if (!readFileSync(out, 'utf8').includes('<svg')) throw new Error('not an SVG');
  });

  // 9. changelog-gen from a synthetic log
  step('changelog-gen produces output', () => {
    const cDir = join(work, 'changelog');
    mkdirSync(cDir, { recursive: true });
    writeFileSync(join(cDir, 'IMPROVEMENT_LOG.md'), '2026-01-01 Fixed login button\n- detail one\n2026-01-02 Improved contrast\n');
    const out = join(work, 'CHANGELOG.generated.md');
    run(process.execPath, [join(ROOT, 'scripts/changelog-gen.mjs'), cDir, out]);
    if (!readFileSync(out, 'utf8').includes('Fixed login button')) throw new Error('entry missing');
  });

    // 10. scripts fail cleanly (not crash) when inputs are missing
  step('missing-input scripts exit non-zero with message', () => {
    run(process.execPath, [join(ROOT, 'scripts/html-report.mjs'), join(work, 'nope.json')], { expectExit: 1 });
    run(process.execPath, [join(ROOT, 'scripts/user-test/aggregate-findings.mjs'), join(work, 'nope-dir')], { expectExit: 1 });
    const empty = join(work, 'empty-cwd');
    mkdirSync(empty, { recursive: true });
    run(process.execPath, [join(ROOT, 'scripts/user-test/baseline-check.mjs')], { cwd: empty, expectExit: 2 });
  });

  // 11. lint (same as npm run verify, but asserted here for CI convenience)
  step('lint:json / lint:bash / lint:mjs', () => {
    run('npm', ['run', 'verify']);
  });
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAll smoke tests passed.' : '\n' + failures + ' smoke test(s) FAILED.');
process.exit(failures === 0 ? 0 : 1);
