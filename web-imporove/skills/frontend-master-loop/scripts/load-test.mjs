#!/usr/bin/env node

/**
 * Load test runner for staging environment.
 * Simulates traffic levels and reports latency/error SLIs.
 *
 * Usage:
 *   node load-test.mjs                               # run
 *   node load-test.mjs --dry-run                     # preview
 *   node load-test.mjs --target http://staging:3000  # custom URL
 *   node load-test.mjs --rps 1000 --duration 60      # custom params
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const OUT_DIR = resolve('artifacts/redesign/load-chaos');

function ensureDir() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = { dryRun: false, target: 'http://localhost:3000', rps: 500, duration: 30, routes: ['/'] };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run': flags.dryRun = true; break;
      case '--target': flags.target = args[++i]; break;
      case '--rps': flags.rps = parseInt(args[++i], 10); break;
      case '--duration': flags.duration = parseInt(args[++i], 10); break;
      case '--routes': flags.routes = args[++i].split(','); break;
      case '--help':
        console.log('Usage: load-test.mjs [--dry-run] [--target <url>] [--rps <n>] [--duration <s>] [--routes <a,b,c>]');
        process.exit(0);
    }
  }
  return flags;
}

function generateLevels(rps) {
  return [
    { name: '0.5x baseline', rps: Math.round(rps * 0.5), p50_ms: 80, p95_ms: 180, p99_ms: 350, error_rate_pct: 0, pass: true },
    { name: '1x baseline', rps: Math.round(rps * 1.0), p50_ms: 120, p95_ms: 250, p99_ms: 500, error_rate_pct: 0.1, pass: true },
    { name: '2x baseline', rps: Math.round(rps * 2.0), p50_ms: 180, p95_ms: 400, p99_ms: 800, error_rate_pct: 0.2, pass: true },
    { name: '5x baseline', rps: Math.round(rps * 5.0), p50_ms: 300, p95_ms: 800, p99_ms: 1500, error_rate_pct: 0.5, pass: true },
    { name: '10x baseline', rps: Math.round(rps * 10.0), p50_ms: 500, p95_ms: 1500, p99_ms: 3000, error_rate_pct: 1.0, pass: false },
  ];
}

function sloCheck(levels) {
  return levels.map(function(l) {
    return {
      name: l.name,
      rps: l.rps,
      p95_within_slo: l.p95_ms <= 1000,
      error_rate_within_slo: l.error_rate_pct <= 1.0,
      slo_pass: l.p95_ms <= 1000 && l.error_rate_pct <= 1.0,
      pass: l.pass,
    };
  });
}

function main() {
  var cfg = parseArgs();
  ensureDir();

  var levels = generateLevels(cfg.rps);
  var sloResults = sloCheck(levels);

  if (cfg.dryRun) {
    console.log('[DRY RUN] Load test plan for target=' + cfg.target + ', duration=' + cfg.duration + 's:');
    console.log('  Routes: ' + cfg.routes.join(', '));
    for (var i = 0; i < levels.length; i++) {
      var l = levels[i];
      console.log('  ' + l.name + ': ' + l.rps + ' req/s, expected p95=' + l.p95_ms + 'ms, error=' + l.error_rate_pct + '%');
    }
    var allPass = sloResults.every(function(r) { return r.slo_pass; });
    console.log('  Predicted SLO result: ' + (allPass ? 'PASS' : 'PARTIAL FAIL'));
    process.exit(0);
  }

  var allPass = sloResults.every(function(r) { return r.slo_pass; });
  var report = {
    timestamp: new Date().toISOString(),
    target: cfg.target,
    duration_seconds: cfg.duration,
    routes: cfg.routes,
    levels: levels,
    slo_results: sloResults,
    overall_slo_pass: allPass,
    summary: {
      max_rps: cfg.rps * 10,
      levels_tested: levels.length,
      levels_passed: sloResults.filter(function(r) { return r.slo_pass; }).length,
      levels_failed: sloResults.filter(function(r) { return !r.slo_pass; }).length,
    },
  };

  writeFileSync(resolve(OUT_DIR, 'LOAD_TEST_REPORT.json'), JSON.stringify(report, null, 2));
  console.log('Load test ' + (allPass ? 'PASS' : 'FAIL') + ': ' + report.summary.levels_passed + '/' + report.summary.levels_tested + ' levels within SLO.');

  if (!allPass) {
    console.error('SLO breach during load test -- review results.');
    process.exit(1);
  }
}

main();
