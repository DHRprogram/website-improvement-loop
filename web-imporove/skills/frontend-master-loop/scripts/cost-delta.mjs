#!/usr/bin/env node

/**
 * Cost delta calculator for frontend redesign.
 * Compares baseline metrics (bundle size, build time, etc.) against
 * current metrics and alerts on budget overrun (HST-05).
 *
 * Usage:
 *   node cost-delta.mjs                          # run
 *   node cost-delta.mjs --dry-run               # preview
 *   node cost-delta.mjs --max-delta 15          # custom budget
 *   node cost-delta.mjs --baseline ./old.json   # explicit baseline
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

var ARTIFACTS = resolve('artifacts/redesign');
var OUT_DIR = resolve(ARTIFACTS, 'cost');

function ensureDir() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
}

function loadJSON(p) {
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}

function parseArgs() {
  var args = process.argv.slice(2);
  var flags = { dryRun: false, maxDeltaPct: 20, baselinePath: null, currentPath: null };
  for (var i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run': flags.dryRun = true; break;
      case '--max-delta': flags.maxDeltaPct = parseFloat(args[++i]); break;
      case '--baseline': flags.baselinePath = args[++i]; break;
      case '--current': flags.currentPath = args[++i]; break;
      case '--help':
        console.log('Usage: cost-delta.mjs [--dry-run] [--max-delta <%>] [--baseline <path>] [--current <path>]');
        process.exit(0);
    }
  }
  return flags;
}

var DEFAULT_BASELINE = {
  bundle_kb: 500,
  build_time_ms: 30000,
  lighthouse_perf: 85,
  lighthouse_a11y: 90,
  lighthouse_seo: 90,
  api_latency_p50_ms: 80,
  api_latency_p95_ms: 250,
  first_byte_ms: 200,
  total_requests: 45,
  total_size_kb: 800,
};

function loadMetrics(path) {
  if (path && existsSync(resolve(path))) {
    return loadJSON(resolve(path));
  }
  return null;
}

function main() {
  var cfg = parseArgs();
  ensureDir(OUT_DIR);

  var baseline = loadMetrics(cfg.baselinePath) || loadJSON(resolve(ARTIFACTS, 'preservation/BASELINE_METRICS.json')) || DEFAULT_BASELINE;
  var current = loadMetrics(cfg.currentPath) || loadJSON(resolve(ARTIFACTS, 'preservation/CURRENT_METRICS.json')) || baseline;

  if (cfg.dryRun) {
    console.log('[DRY RUN] Cost delta check (max ' + cfg.maxDeltaPct + '%):');
    console.log('  Metric                Before      After       Delta');
    var maxDelta = 0;
    var keys = Object.keys(baseline);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (typeof baseline[key] !== 'number') continue;
      var before = baseline[key];
      var after = current[key] !== undefined ? current[key] : before;
      var pct = before === 0 ? (after === 0 ? 0 : 100) : Math.round((after - before) / before * 1000) / 10;
      if (Math.abs(pct) > maxDelta) maxDelta = Math.abs(pct);
      var arrow = pct > cfg.maxDeltaPct ? ' WARN' : '';
      console.log('  ' + key.padEnd(22) + String(before).padStart(10) + String(after).padStart(10) + (pct >= 0 ? '+' : '') + pct + '%'.padStart(1) + arrow);
    }
    console.log('');
    console.log('  Max delta: ' + maxDelta + '% (budget: ' + cfg.maxDeltaPct + '%) -> ' + (maxDelta <= cfg.maxDeltaPct ? 'PASS' : 'FAIL'));
    process.exit(0);
  }

  var deltas = {};
  var maxDelta = 0;
  var budgetBreach = false;

  var keys = Object.keys(baseline);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (typeof baseline[key] !== 'number') continue;
    var before = baseline[key];
    var after = current[key] !== undefined ? current[key] : before;
    var pct = before === 0 ? (after === 0 ? 0 : 100) : Math.round((after - before) / before * 1000) / 10;
    deltas[key] = { before: before, after: after, delta_pct: pct, within_budget: Math.abs(pct) <= cfg.maxDeltaPct };
    if (Math.abs(pct) > maxDelta) maxDelta = Math.abs(pct);
    if (Math.abs(pct) > cfg.maxDeltaPct) budgetBreach = true;
  }

  var result = {
    timestamp: new Date().toISOString(),
    baseline_sources: [cfg.baselinePath || 'artifacts/redesign/preservation/BASELINE_METRICS.json', 'defaults'],
    current_sources: [cfg.currentPath || 'artifacts/redesign/preservation/CURRENT_METRICS.json'],
    budget_max_delta_pct: cfg.maxDeltaPct,
    deltas: deltas,
    max_delta_pct: maxDelta,
    budget_breach: budgetBreach,
    passed: !budgetBreach,
    slo_status: budgetBreach ? 'BUDGET_BREACH' : 'WITHIN_BUDGET',
  };

  writeFileSync(resolve(OUT_DIR, 'COST_DELTA_' + Date.now() + '.json'), JSON.stringify(result, null, 2));
  console.log('Cost delta: max ' + maxDelta + '% (budget ' + cfg.maxDeltaPct + '%) -- ' + (budgetBreach ? 'BUDGET BREACH' : 'WITHIN BUDGET') + '.');

  if (budgetBreach) {
    console.error('[HST-05] Cost delta ' + maxDelta + '% exceeds approved max ' + cfg.maxDeltaPct + '%.');
    process.exit(1);
  }
}

main();
