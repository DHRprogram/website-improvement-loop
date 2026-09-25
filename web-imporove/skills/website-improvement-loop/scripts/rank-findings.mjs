#!/usr/bin/env node
// Rank merged findings and pick the top N for this iteration.
//
//   rank-findings.mjs [--min-severity=P2] [--top=5] [--base=PATH] [--dry-run]
//
//   priority = severity_weight * impact / effort
//   P0=1000  P1=300  P2=100  P3=30     impact 1..5     effort 1..5 (S=1 M=3 L=5)
//
// Writes QUEUE.json (everything ranked) and QUEUE_TOP.json (the slice the
// orchestrator will work on). At most MAX_FINDINGS_PER_ITERATION are selected,
// so one iteration stays one reviewable commit.

import {
  MERGED_FILE, QUEUE_FILE, QUEUE_TOP_FILE, WIL_DIR, REPO_ROOT,
  SEVERITY_WEIGHT, SEVERITY_NAME, MAX_FINDINGS_PER_ITERATION,
  severityRank, isSeverity, priority, parseArgs, readJSON, writeJSON, resolve, join,
} from './lib.mjs';

const { flags } = parseArgs();
const base = flags.base ? resolve(String(flags.base)) : REPO_ROOT;
const dryRun = flags['dry-run'] === true || flags['dry-run'] === 'true';

const minSev = flags['min-severity'] ? String(flags['min-severity']) : 'P2';
if (!isSeverity(minSev)) {
  console.error(`rank-findings: --min-severity must be P0|P1|P2|P3, got '${minSev}'`);
  process.exit(1);
}
const topN = Math.max(1, Math.min(20, Number(flags.top) || MAX_FINDINGS_PER_ITERATION));

const mergedPath = join(base, MERGED_FILE);
const merged = readJSON(mergedPath);
if (merged === null) {
  if (!dryRun) { writeJSON(join(base, QUEUE_FILE), []); writeJSON(join(base, QUEUE_TOP_FILE), []); }
  console.error(`rank-findings: no readable ${MERGED_FILE} — run merge-findings.mjs first.`);
  process.exit(1);
}
if (!Array.isArray(merged)) {
  console.error(`rank-findings: ${MERGED_FILE} must contain an array.`);
  process.exit(1);
}

const DONE = new Set(['fixed', 'reverted']);
const floor = severityRank(minSev);

const eligible = merged.filter((f) => {
  if (!f || !isSeverity(f.severity)) return false;
  if (severityRank(f.severity) > floor) return false;
  if (DONE.has(f.status)) return false;
  return true;
});

const ranked = eligible.map((f) => ({
  ...f,
  severity_weight: SEVERITY_WEIGHT[f.severity],
  priority: Number(priority(f).toFixed(2)),
}));

ranked.sort((a, b) => {
  if (b.priority !== a.priority) return b.priority - a.priority;
  const bySev = severityRank(a.severity) - severityRank(b.severity);
  if (bySev) return bySev;
  return String(a.id).localeCompare(String(b.id));
});

const top = ranked.slice(0, topN);

const bySeverity = {};
for (const f of merged) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;

const summary = {
  generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  min_severity: minSev,
  min_severity_meaning: SEVERITY_NAME[minSev],
  total_merged: merged.length,
  by_severity: bySeverity,
  eligible: ranked.length,
  selected: top.length,
  max_per_iteration: MAX_FINDINGS_PER_ITERATION,
  top_ids: top.map((f) => f.id),
};

if (dryRun) {
  console.error('[dry-run] rank-findings');
  console.log(JSON.stringify(summary, null, 2));
  for (const [i, f] of top.entries()) {
    console.log(`  ${i + 1}. [${f.severity}] ${f.id} ${f.title} — priority ${f.priority} (${f.agent})`);
  }
  process.exit(0);
}

writeJSON(join(base, QUEUE_FILE), ranked);
writeJSON(join(base, QUEUE_TOP_FILE), top);
writeJSON(join(base, WIL_DIR, 'queue-summary.json'), summary);

console.log(`${ranked.length} eligible at or above ${minSev}; selected top ${top.length}.`);
if (!top.length) console.log('  nothing to do — the queue is clear at this severity floor.');
for (const [i, f] of top.entries()) {
  console.log(`  ${i + 1}. [${f.severity}] ${f.id} ${f.title} (priority ${f.priority})`);
}
process.exit(0);
