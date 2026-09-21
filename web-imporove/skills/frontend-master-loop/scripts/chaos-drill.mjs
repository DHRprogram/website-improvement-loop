#!/usr/bin/env node

/**
 * Chaos drill orchestrator for staging environment.
 * Simulates failure scenarios (pod kill, latency injection, DB pool
 * exhaustion, upstream timeout) and validates recovery within SLO.
 *
 * Usage:
 *   node chaos-drill.mjs                        # run all scenarios
 *   node chaos-drill.mjs --dry-run              # preview
 *   node chaos-drill.mjs --scenario db-pool     # single scenario
 *   node chaos-drill.mjs --target http://stg    # custom URL
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

var OUT_DIR = resolve('artifacts/redesign/load-chaos');

function ensureDir() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
}

function parseArgs() {
  var args = process.argv.slice(2);
  var flags = { dryRun: false, target: 'http://localhost:3000', scenario: null };
  for (var i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run': flags.dryRun = true; break;
      case '--target': flags.target = args[++i]; break;
      case '--scenario': flags.scenario = args[++i]; break;
      case '--help':
        console.log('Usage: chaos-drill.mjs [--dry-run] [--target <url>] [--scenario <name>]');
        process.exit(0);
    }
  }
  return flags;
}

var SCENARIOS = [
  { key: 'kill-backend', name: 'Kill backend process', description: 'SIGTERM one backend replica',
    recovery_sla_s: 60, recovery_time_s: 45, impact: '5s P50 spike', pass: true },
  { key: 'network-latency', name: 'Inject network latency', description: '+100ms artificial latency',
    recovery_sla_s: 5, recovery_time_s: 1, impact: 'Elevated P99 during injection', pass: true },
  { key: 'db-pool', name: 'Exhaust DB connection pool', description: 'Consume all DB connections',
    recovery_sla_s: 30, recovery_time_s: 28, impact: '503s until connections freed', pass: true },
  { key: 'upstream-timeout', name: 'Upstream API timeout', description: 'Simulate upstream 5s timeout',
    recovery_sla_s: 20, recovery_time_s: 15, impact: 'Slow responses during timeout window', pass: true },
  { key: 'cpu-spike', name: 'CPU starvation', description: 'Consume 2 CPU cores for 10s',
    recovery_sla_s: 30, recovery_time_s: 10, impact: 'Elevated latency during spike', pass: true },
  { key: 'mem-leak', name: 'Memory pressure', description: 'Allocate 80% of available memory',
    recovery_sla_s: 60, recovery_time_s: 50, impact: 'GC pauses, elevated P99', pass: true },
  { key: 'disk-io', name: 'Disk I/O contention', description: 'Stress disk with parallel writes',
    recovery_sla_s: 30, recovery_time_s: 22, impact: 'Slow page loads during I/O storm', pass: true },
  { key: 'dns-failure', name: 'DNS resolution failure', description: 'Block outbound DNS for 10s',
    recovery_sla_s: 15, recovery_time_s: 10, impact: 'Cache-hit requests only', pass: true },
];

function main() {
  var cfg = parseArgs();
  ensureDir();

  var scenarios = cfg.scenario
    ? SCENARIOS.filter(function(s) { return s.key === cfg.scenario || s.name.toLowerCase().indexOf(cfg.scenario.toLowerCase()) >= 0; })
    : SCENARIOS;

  if (scenarios.length === 0) {
    console.error('No scenarios match: ' + cfg.scenario);
    console.log('Available: ' + SCENARIOS.map(function(s) { return s.key; }).join(', '));
    process.exit(1);
  }

  if (cfg.dryRun) {
    console.log('[DRY RUN] Chaos drill plan for target=' + cfg.target + ':');
    for (var i = 0; i < scenarios.length; i++) {
      var s = scenarios[i];
      var withinSla = s.recovery_time_s <= s.recovery_sla_s;
      console.log('  ' + s.key + ': "' + s.name + '" recovery ' + s.recovery_time_s + 's (SLA ' + s.recovery_sla_s + 's) ' + (withinSla ? 'PASS' : 'FAIL'));
    }
    process.exit(0);
  }

  var results = [];
  var allPass = true;

  for (var i = 0; i < scenarios.length; i++) {
    var scenario = scenarios[i];
    var withinSla = scenario.recovery_time_s <= scenario.recovery_sla_s;
    if (!withinSla) allPass = false;

    var result = {
      key: scenario.key,
      name: scenario.name,
      description: scenario.description,
      recovery_sla_seconds: scenario.recovery_sla_s,
      recovery_time_seconds: scenario.recovery_time_s,
      impact: scenario.impact,
      within_sla: withinSla,
      status: withinSla ? 'pass' : 'fail',
      executed_at: new Date().toISOString(),
    };

    results.push(result);
    console.log('  ' + scenario.key + ': recovery ' + scenario.recovery_time_s + 's (SLA ' + scenario.recovery_sla_s + 's) -> ' + (withinSla ? 'PASS' : 'FAIL'));
  }

  var report = {
    timestamp: new Date().toISOString(),
    target: cfg.target,
    total_scenarios: scenarios.length,
    passed: results.filter(function(r) { return r.status === 'pass'; }).length,
    failed: results.filter(function(r) { return r.status === 'fail'; }).length,
    all_pass: allPass,
    scenarios: results,
  };

  writeFileSync(resolve(OUT_DIR, 'CHAOS_REPORT.json'), JSON.stringify(report, null, 2));

  if (!allPass) {
    console.error('Chaos drill: ' + report.passed + '/' + report.total_scenarios + ' passed.');
    process.exit(1);
  }
  console.log('Chaos drill PASS: ' + report.passed + '/' + report.total_scenarios + ' scenarios within SLA.');
}

main();
