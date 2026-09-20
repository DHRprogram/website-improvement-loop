#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = resolve(process.argv[2] || 'artifacts/USER_TEST');
if (!existsSync(dir)) { console.error('Directory not found: ' + dir); process.exit(1); }

const files = readdirSync(dir).filter(f => f.startsWith('persona-') && f.endsWith('.json')).sort();
if (files.length === 0) { console.error('No persona-*.json files found in ' + dir); process.exit(1); }

const personas = files.map(f => {
  try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); }
  catch (e) { console.error('Error reading ' + f + ': ' + e.message); return null; }
}).filter(Boolean);

const summaries = personas.map(p => {
  const tasks = p.tasks || [];
  const completed = tasks.filter(t => t.status === 'completed').length;
  const abandoned = tasks.filter(t => t.status === 'abandoned').length;
  const steps = tasks.reduce((s, t) => s + (t.steps || 0), 0);
  const frictionSum = tasks.reduce((s, t) => s + (t.friction_avg || 0), 0);
  const frictionAvg = tasks.length > 0 ? frictionSum / tasks.length : 0;
  return { persona: p.persona, name: p.name, tasks_total: tasks.length, tasks_completed: completed, tasks_abandoned: abandoned, steps, friction_avg: Math.round(frictionAvg * 100) / 100, blockers: p.blockers || [] };
});

function normalizeTheme(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).slice(0, 6).join(' ');
}

const issues = [];
personas.forEach(p => {
  (p.blockers || []).forEach(b => {
    const key = b.page + '::' + normalizeTheme(b.page + ' ' + b.issue);
    issues.push({ key, page: b.page, issue: b.issue, severity: b.severity, persona: p.persona, evidence: b.evidence || [] });
  });
  (p.tasks || []).forEach(t => {
    (t.top_frustrations || []).forEach(fr => {
      const key = (t.goal || 'unknown') + '::' + normalizeTheme(fr);
      issues.push({ key, page: t.goal || 'unknown', issue: fr, severity: 'P2', persona: p.persona, evidence: [] });
    });
  });
});

const severityRank = { P0: 5, P1: 4, P2: 3, P3: 2 };
const grouped = {};
issues.forEach(i => {
  if (!grouped[i.key]) { grouped[i.key] = { page: i.page, issue: i.issue, personas: new Set(), severities: [], evidence: [] }; }
  grouped[i.key].personas.add(i.persona);
  grouped[i.key].severities.push(i.severity);
  grouped[i.key].evidence.push(...i.evidence);
});

const topIssues = Object.values(grouped).map(g => {
  const worstSev = g.severities.sort((a, b) => (severityRank[b] || 0) - (severityRank[a] || 0))[0];
  return { page: g.page, issue: g.issue, frequency: g.personas.size, worst_severity: worstSev, personas: [...g.personas].sort(), evidence: [...new Set(g.evidence)] };
}).sort((a, b) => {
  const sev = (severityRank[b.worst_severity] || 0) * b.frequency - (severityRank[a.worst_severity] || 0) * a.frequency;
  return sev !== 0 ? sev : b.frequency - a.frequency;
}).slice(0, 30);

const pageHeatmap = {};
personas.forEach(p => {
  (p.tasks || []).forEach(t => {
    (t.step_log || []).forEach(s => {
      const pKey = s.action || 'unknown';
      if (!pageHeatmap[pKey]) { pageHeatmap[pKey] = { steps: 0, friction_sum: 0, max_friction: 0, friction_avg: 0 }; }
      pageHeatmap[pKey].steps += 1;
      pageHeatmap[pKey].friction_sum += s.friction || 0;
      if ((s.friction || 0) > pageHeatmap[pKey].max_friction) pageHeatmap[pKey].max_friction = s.friction || 0;
    });
  });
});
Object.keys(pageHeatmap).forEach(k => {
  pageHeatmap[k].friction_avg = Math.round((pageHeatmap[k].friction_sum / Math.max(pageHeatmap[k].steps, 1)) * 100) / 100;
});
const heatmapSorted = Object.entries(pageHeatmap).sort((a, b) => b[1].friction_sum - a[1].friction_sum).slice(0, 50).map(([k, v]) => ({ url: k, ...v }));

const allAttacks = [];
personas.forEach(p => {
  if (p.persona === 'P11') {
    (p.tasks || []).forEach(t => (t.attacks || []).forEach(a => allAttacks.push(a)));
  }
});
const attackSummary = {
  total: allAttacks.length,
  by_severity: { S0: allAttacks.filter(a => a.severity === 'S0').length, S1: allAttacks.filter(a => a.severity === 'S1').length, S2: allAttacks.filter(a => a.severity === 'S2').length, S3: allAttacks.filter(a => a.severity === 'S3').length },
  reproduced: allAttacks.filter(a => a.reproduced).length,
  flaky: allAttacks.filter(a => !a.reproduced).length,
  by_group: Object.entries(allAttacks.reduce((acc, a) => { acc[a.group] = (acc[a.group] || 0) + 1; return acc; }, {})).map(([group, count]) => ({ group, count }))
};
const attackRankVal = { S0: 100, S1: 60, S2: 30, S3: 10 };
const topAttacks = allAttacks.sort((a, b) => (attackRankVal[b.severity] || 0) - (attackRankVal[a.severity] || 0)).slice(0, 40);

let a11y = null;
try {
  const axePath = join(dir, '..', 'axe', 'summary.json');
  if (existsSync(axePath)) a11y = JSON.parse(readFileSync(axePath, 'utf8'));
} catch (e) { console.error('axe read error: ' + e.message); }

const aggregate = {
  generated_at: new Date().toISOString(),
  personas_count: personas.length,
  total_steps: summaries.reduce((s, p) => s + p.steps, 0),
  overall_friction_avg: Math.round(summaries.reduce((s, p) => s + p.friction_avg, 0) / Math.max(summaries.length, 1) * 100) / 100,
  personas: summaries, top_issues: topIssues, page_heatmap: heatmapSorted,
  attack_summary: attackSummary, top_attacks: topAttacks,
  a11y: a11y ? { total: a11y.total_violations, by_severity: a11y.by_severity, by_rule: a11y.by_rule } : null
};

writeFileSync(join(dir, 'AGGREGATE.json'), JSON.stringify(aggregate, null, 2));
console.log('[OK] AGGREGATE.json (' + aggregate.personas_count + ' personas, ' + aggregate.total_steps + ' steps)');

let md = '# Aggregate Findings\n\nGenerated: ' + aggregate.generated_at + '\n\n## Overview\n- Personas: ' + aggregate.personas_count + '\n- Total steps: ' + aggregate.total_steps + '\n- Overall friction avg: ' + aggregate.overall_friction_avg + '\n\n## Top Issues\n| # | Page | Issue | Frequency | Worst Severity |\n|---|------|-------|-----------|----------------|\n';
topIssues.slice(0, 10).forEach((i, idx) => { md += '| ' + (idx + 1) + ' | ' + i.page + ' | ' + i.issue + ' | ' + i.frequency + ' | ' + i.worst_severity + ' |\n'; });
md += '\n## Page Heatmap\n| URL | Steps | Friction Sum | Max Friction | Friction Avg |\n|-----|-------|-------------|--------------|-------------|\n';
heatmapSorted.slice(0, 10).forEach(h => { md += '| ' + h.url + ' | ' + h.steps + ' | ' + h.friction_sum + ' | ' + h.max_friction + ' | ' + h.friction_avg + ' |\n'; });
md += '\n## Adversarial Attacks\n| Severity | Count |\n|----------|------|\n';
Object.entries(attackSummary.by_severity).forEach(([sev, c]) => { md += '| ' + sev + ' | ' + c + ' |\n'; });
if (a11y) {
  md += '\n## Accessibility\n| Severity | Count |\n|----------|------|\n';
  Object.entries(a11y.by_severity || {}).sort((a, b) => parseInt(a[0][1]) - parseInt(b[0][1])).forEach(([sev, c]) => { md += '| ' + sev + ' | ' + c + ' |\n'; });
}
writeFileSync(join(dir, 'AGGREGATE.md'), md);
console.log('[OK] AGGREGATE.md');
