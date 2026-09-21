#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const IN = resolve(process.argv[2] || 'artifacts/USER_TEST/AGGREGATE.json');
if (!existsSync(IN)) { console.error('Missing AGGREGATE.json'); process.exit(0); }

const agg = JSON.parse(readFileSync(IN, 'utf8'));
const issues = agg.top_issues || [];

function tokenize(t) { return t.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean); }

function cosine(a, b) {
  const ta = tokenize(a), tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const all = [...new Set([...ta, ...tb])];
  const va = all.map(w => ta.filter(x => x === w).length);
  const vb = all.map(w => tb.filter(x => x === w).length);
  const dot = va.reduce((s, v, i) => s + v * vb[i], 0);
  const ma = Math.sqrt(va.reduce((s, v) => s + v * v, 0));
  const mb = Math.sqrt(vb.reduce((s, v) => s + v * v, 0));
  return dot / (ma * mb || 1);
}

const merged = [];
const used = new Set();
for (let i = 0; i < issues.length; i++) {
  if (used.has(i)) continue;
  const group = [issues[i]];
  used.add(i);
  for (let j = i + 1; j < issues.length; j++) {
    if (used.has(j)) continue;
    if (cosine(issues[i].issue, issues[j].issue) > 0.65) {
      group.push(issues[j]);
      used.add(j);
    }
  }
  if (group.length > 1) {
    const allSeverities = group.flatMap(g => [g.worst_severity, ...(g.personas || [])]);
    const worst = [...'P0P1P2P3'].find(s => group.some(g => g.worst_severity === s)) || 'P3';
    const personas = [...new Set(group.flatMap(g => g.personas || []))];
    merged.push({
      issue: group[0].issue,
      duplicates: group.slice(1).map(g => g.issue),
      frequency: personas.length,
      worst_severity: worst,
      personas,
      evidence: [...new Set(group.flatMap(g => g.evidence || []))].slice(0, 5)
    });
  }
}

agg.top_issues_deduplicated = merged;
agg.dedup_stats = { total_before: issues.length, merged_groups: merged.length, total_after: issues.length - merged.reduce((s, g) => s + g.duplicates.length, 0) };

writeFileSync(IN, JSON.stringify(agg, null, 2));
if (merged.length > 0) {
  console.log('[DEDUP] Merged ' + merged.length + ' groups (' + merged.reduce((s, g) => s + g.duplicates.length, 0) + ' duplicates)');
  merged.forEach(g => console.log('  "' + g.issue.slice(0, 50) + '" × ' + (g.duplicates.length + 1) + ' occurrences'));
} else { console.log('[DEDUP] No duplicates found'); }
