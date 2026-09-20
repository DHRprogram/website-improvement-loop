#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const tag = process.argv[2] || new Date().toISOString().slice(0, 10);
const aggDir = resolve('artifacts/USER_TEST');
const axeDir = resolve('artifacts/USER_TEST/axe');

const aggPath = join(aggDir, 'AGGREGATE.json');
if (!existsSync(aggPath)) {
  console.error('Missing AGGREGATE.json — run Phase B first');
  process.exit(2);
}

const agg = JSON.parse(readFileSync(aggPath, 'utf8'));
let gitSha = 'unknown';
try { gitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch (e) {}

const axeSummaryPath = join(axeDir, 'summary.json');
let axeData = null;
if (existsSync(axeSummaryPath)) {
  try { axeData = JSON.parse(readFileSync(axeSummaryPath, 'utf8')); } catch (e) {}
}

const perPersona = {};
(agg.personas || []).forEach(p => { perPersona[p.persona] = p.friction_avg; });

const pCounts = { P0: 0, P1: 0, P2: 0, P3: 0 };
(agg.top_issues || []).forEach(i => { const sev = i.worst_severity; if (pCounts[sev] !== undefined) pCounts[sev]++; });

const baseline = {
  tag, saved_at: new Date().toISOString(), git_sha: gitSha,
  friction: {
    overall_avg: agg.overall_friction_avg || 0,
    per_persona: perPersona,
    total_steps: agg.total_steps || 0
  },
  issues: pCounts,
  attacks: agg.attack_summary || null,
  a11y: axeData ? { total: axeData.total_violations, by_severity: axeData.by_severity, by_rule: axeData.by_rule } : null,
  issue_keys: (agg.top_issues || []).slice(0, 60).map(i => i.page.toLowerCase().replace(/[^a-z0-9]/g, '-') + '::' + i.issue.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40))
};

const outPath = resolve('artifacts/BASELINE.json');
writeFileSync(outPath, JSON.stringify(baseline, null, 2));
console.log('[OK] BASELINE.json at ' + outPath);
console.log('Tag: ' + tag + ' | Git: ' + gitSha);
