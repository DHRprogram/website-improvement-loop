#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const strict = process.argv.includes('--strict');
const THRESHOLDS = {
  friction_delta: parseFloat(process.env.FRICTION_DELTA || '0.15'),
  new_p0_max: parseInt(process.env.NEW_P0_MAX || '0', 10),
  new_p1_max: parseInt(process.env.NEW_P1_MAX || '0', 10),
  a11y_critical_max: parseInt(process.env.A11Y_CRITICAL_MAX || '0', 10),
  a11y_serious_max: parseInt(process.env.A11Y_SERIOUS_MAX || '2', 10),
  per_persona_delta: parseFloat(process.env.PER_PERSONA_DELTA || '0.30')
};

const aggDir = resolve('artifacts/USER_TEST');
const basePath = resolve('artifacts/BASELINE.json');
const aggPath = join(aggDir, 'AGGREGATE.json');
const axePath = join(aggDir, '..', 'axe', 'summary.json');

if (!existsSync(basePath)) { console.error('Missing BASELINE.json'); process.exit(2); }
if (!existsSync(aggPath)) { console.error('Missing AGGREGATE.json'); process.exit(2); }

const baseline = JSON.parse(readFileSync(basePath, 'utf8'));
const current = JSON.parse(readFileSync(aggPath, 'utf8'));
let axeCurrent = null;
if (existsSync(axePath)) { try { axeCurrent = JSON.parse(readFileSync(axePath, 'utf8')); } catch (e) {} }

const fails = [];
const warns = [];

// 1. Overall friction delta
const bFriction = baseline.friction?.overall_avg || 0;
const cFriction = current.overall_friction_avg || 0;
const fDelta = cFriction - bFriction;
if (fDelta > THRESHOLDS.friction_delta) {
  fails.push('Overall friction increased by ' + fDelta.toFixed(3) + ' (threshold: ' + THRESHOLDS.friction_delta + ')');
}

// 2. Per-persona friction delta
const bPerPersona = baseline.friction?.per_persona || {};
(current.personas || []).forEach(p => {
  const prev = bPerPersona[p.persona];
  if (prev !== undefined) {
    const delta = p.friction_avg - prev;
    if (delta > THRESHOLDS.per_persona_delta) {
      warns.push('Persona ' + p.persona + ' friction increased by ' + delta.toFixed(3) + ' (threshold: ' + THRESHOLDS.per_persona_delta + ')');
    }
  }
});

// 3. New P0/P1 issues
const bIssues = baseline.issues || {};
const cP0 = (current.top_issues || []).filter(i => i.worst_severity === 'P0').length;
const cP1 = (current.top_issues || []).filter(i => i.worst_severity === 'P1').length;
const bP0 = bIssues.P0 || 0;
const bP1 = bIssues.P1 || 0;
const newP0 = cP0 - bP0;
const newP1 = cP1 - bP1;
if (newP0 > THRESHOLDS.new_p0_max) fails.push('New P0 issues: ' + newP0 + ' (threshold: ' + THRESHOLDS.new_p0_max + ')');
if (newP1 > THRESHOLDS.new_p1_max) fails.push('New P1 issues: ' + newP1 + ' (threshold: ' + THRESHOLDS.new_p1_max + ')');

// 4. S0/S1 attacks
const bAttacks = baseline.attacks?.by_severity || {};
const cAttacks = current.attack_summary?.by_severity || {};
const bS0 = bAttacks.S0 || 0; const cS0 = cAttacks.S0 || 0;
const bS1 = bAttacks.S1 || 0; const cS1 = cAttacks.S1 || 0;
if (cS0 > bS0) fails.push('New S0 attacks: ' + (cS0 - bS0));
if (cS1 > bS1) fails.push('New S1 attacks: ' + (cS1 - bS1));

// 5. Axe violations
if (axeCurrent && baseline.a11y) {
  const a11ySev = axeCurrent.by_severity || {};
  const a11yBasel = baseline.a11y.by_severity || {};
  const newCritical = (a11ySev.P0 || 0) - (a11yBasel.P0 || 0);
  const newSerious = (a11ySev.P1 || 0) - (a11yBasel.P1 || 0);
  if (newCritical > THRESHOLDS.a11y_critical_max) fails.push('New a11y critical: ' + newCritical + ' (threshold: ' + THRESHOLDS.a11y_critical_max + ')');
  if (newSerious > THRESHOLDS.a11y_serious_max) fails.push('New a11y serious: ' + newSerious + ' (threshold: ' + THRESHOLDS.a11y_serious_max + ')');
}

// 6. Issue keys diff
const bKeys = new Set(baseline.issue_keys || []);
const cKeys = new Set((current.top_issues || []).slice(0, 60).map(i => i.page.toLowerCase().replace(/[^a-z0-9]/g, '-') + '::' + i.issue.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40)));
const added = [...cKeys].filter(k => !bKeys.has(k));
const removed = [...bKeys].filter(k => !cKeys.has(k));

const verdict = fails.length === 0 ? (warns.length > 0 ? 'PASS_WITH_WARNINGS' : 'PASS') : 'FAIL';

const report = {
  generated_at: new Date().toISOString(),
  baseline_tag: baseline.tag, baseline_git: baseline.git_sha,
  current_git: 'current', thresholds: THRESHOLDS,
  friction: { before: bFriction, after: cFriction, delta: Math.round(fDelta * 1000) / 1000 },
  issues: { before: bIssues, after: { P0: cP0, P1: cP1, P2: (current.top_issues || []).filter(i => i.worst_severity === 'P2').length, P3: (current.top_issues || []).filter(i => i.worst_severity === 'P3').length } },
  a11y: { before: baseline.a11y, after: axeCurrent ? { total: axeCurrent.total_violations, by_severity: axeCurrent.by_severity } : null },
  added_issues: added.slice(0, 50), removed_issues: removed.slice(0, 50),
  fails, warns, verdict
};

const reportPath = resolve('artifacts/REGRESSION_REPORT.json');
writeFileSync(reportPath, JSON.stringify(report, null, 2));

let md = '# Regression Report\n\nGenerated: ' + report.generated_at + '\nBaseline: ' + baseline.tag + ' (' + baseline.git_sha + ')\nVerdict: **' + verdict + '**\n\n';
if (fails.length > 0) { md += '## FAILS\n'; fails.forEach(f => { md += '- ' + f + '\n'; }); }
if (warns.length > 0) { md += '## Warnings\n'; warns.forEach(w => { md += '- ' + w + '\n'; }); }
md += '\n## Signals\n| Signal | Before | After | Delta | Threshold |\n|--------|--------|-------|-------|-----------|\n';
md += '| Overall Friction | ' + bFriction + ' | ' + cFriction + ' | ' + fDelta.toFixed(3) + ' | ' + THRESHOLDS.friction_delta + ' |\n';
md += '| P0 Issues | ' + bP0 + ' | ' + cP0 + ' | ' + (cP0 - bP0) + ' | ' + THRESHOLDS.new_p0_max + ' |\n';
md += '| P1 Issues | ' + bP1 + ' | ' + cP1 + ' | ' + (cP1 - bP1) + ' | ' + THRESHOLDS.new_p1_max + ' |\n';
if (added.length > 0) { md += '\n## New Issues\n'; added.slice(0, 15).forEach(k => { md += '- ' + k + '\n'; }); }
if (removed.length > 0) { md += '\n## Resolved Issues\n'; removed.slice(0, 15).forEach(k => { md += '- ' + k + '\n'; }); }

const mdPath = resolve('artifacts/REGRESSION_REPORT.md');
writeFileSync(mdPath, md);
console.log(md);

// Webhook notification
if (fails.length > 0) {
  const wh = process.env.SLACK_WEBHOOK || process.env.TELEGRAM_WEBHOOK;
  if (wh && wh.includes("hooks.slack")) {
    const payload = JSON.stringify({text: "Regression FAIL: " + fails.join("; ")});
    try { execSync("curl", ["-sf", "-X", "POST", "-H", "Content-Type: application/json", "-d", payload, wh]); } catch(e) {}
  }
}
if (fails.length > 0) process.exit(1);
