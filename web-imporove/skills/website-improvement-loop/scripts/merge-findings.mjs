#!/usr/bin/env node
// Merge per-agent findings into one deduplicated list.
//
//   merge-findings.mjs [--base=PATH] [--input=DIR] [--min-severity=P2] [--dry-run]
//
// Reads artifacts/website-loop/findings/S*.json, writes merged.json and
// conflicts.json.
//
// Two different reductions, because they answer two different questions.
//
//   1. Exact duplicates. Key = agent + normalized title + first touched file.
//      The same agent filing the same defect twice is one finding, and fixing
//      it twice is how a fix gets reverted twice.
//
//   2. Cross-agent conflict. Key = normalized title + first touched file,
//      spanning agents. Two auditors can look at one line and judge it
//      differently; the HIGHER severity wins, because under-reporting a P0
//      because a colleague filed it as a P1 is the failure mode that matters.
//      Every loser is preserved in conflicts.json with both verdicts.
//
// exit 0 ok | 1 unreadable input

import {
  WIL_DIR, FINDINGS_DIR, MERGED_FILE, CONFLICTS_FILE, REPO_ROOT,
  AGENTS, severityRank, isSeverity,
  normalizeTitle, parseArgs, readJSON, writeJSON, listFiles, resolve, join,
} from './lib.mjs';

const { flags } = parseArgs();
const base = flags.base ? resolve(String(flags.base)) : REPO_ROOT;
const inputDir = flags.input ? resolve(String(flags.input)) : join(base, FINDINGS_DIR);
const dryRun = flags['dry-run'] === true || flags['dry-run'] === 'true';

const minSev = flags['min-severity'] ? String(flags['min-severity']) : null;
if (minSev && !isSeverity(minSev)) {
  console.error(`merge-findings: --min-severity must be P0|P1|P2|P3, got '${minSev}'`);
  process.exit(1);
}

function collect() {
  const out = [];
  const errors = [];
  for (const path of listFiles(inputDir, (n) => /^S\d+\.json$/.test(n))) {
    const data = readJSON(path);
    const agent = path.split('/').pop().replace('.json', '');
    if (data === null) { errors.push({ file: path, error: 'invalid or unreadable JSON' }); continue; }
    const list = Array.isArray(data) ? data : (Array.isArray(data.findings) ? data.findings : []);
    if (!Array.isArray(data) && !Array.isArray(data.findings)) {
      errors.push({ file: path, error: 'expected an array, or an object with a "findings" array' });
      continue;
    }
    for (const f of list) {
      if (!f || typeof f !== 'object') { errors.push({ file: path, error: 'finding is not an object' }); continue; }
      out.push({ ...f, agent: f.agent || agent, source: agent });
    }
  }
  return { findings: out, errors };
}

function firstFile(f) {
  return Array.isArray(f.files_touched) && f.files_touched.length ? String(f.files_touched[0]) : '';
}

function dedupeKey(f) {
  return `${f.agent}:${normalizeTitle(f.title)}:${firstFile(f)}`;
}

function conflictKey(f) {
  return `${normalizeTitle(f.title)}:${firstFile(f)}`;
}

function stronger(a, b) {
  const bySeverity = severityRank(a.severity) - severityRank(b.severity);
  if (bySeverity !== 0) return bySeverity < 0 ? a : b;
  // Same severity: the one with the higher impact wins, then the cheaper fix.
  const ai = Number(a.impact) || 0, bi = Number(b.impact) || 0;
  if (ai !== bi) return ai > bi ? a : b;
  const ae = Number(a.effort) || 99, be = Number(b.effort) || 99;
  return ae <= be ? a : b;
}

const { findings: all, errors } = collect();
if (errors.length) {
  for (const e of errors) console.error(`  error: ${e.file}: ${e.error}`);
  console.error(`merge-findings: ${errors.length} unreadable input file(s)`);
  process.exit(1);
}

const invalid = all.filter((f) => !isSeverity(f.severity) || !f.title || !f.agent);
const valid = all.filter((f) => isSeverity(f.severity) && f.title && f.agent);
const byAgent = {};
for (const f of all) byAgent[f.source] = (byAgent[f.source] || 0) + 1;

const floor = minSev ? severityRank(minSev) : -1;
const inScope = valid.filter((f) => severityRank(f.severity) <= floor);

// Pass 1: exact duplicates within one agent.
const exact = new Map();
const exactDuplicates = [];
for (const f of inScope) {
  const key = dedupeKey(f);
  if (exact.has(key)) { exactDuplicates.push({ key, kept: exact.get(key).id, dropped: f.id, reason: 'identical agent+title+first_file' }); continue; }
  exact.set(key, f);
}

// Pass 2: cross-agent agreement on the same title and file.
const groups = new Map();
for (const f of exact.values()) {
  const key = conflictKey(f);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(f);
}

const merged = [];
const conflicts = [];
for (const [key, group] of groups) {
  if (group.length === 1) { merged.push(group[0]); continue; }
  const sorted = [...group].sort((a, b) => {
    const bySev = severityRank(a.severity) - severityRank(b.severity);
    if (bySev) return bySev;
    const byImpact = (Number(b.impact) || 0) - (Number(a.impact) || 0);
    if (byImpact) return byImpact;
    return (Number(a.effort) || 99) - (Number(b.effort) || 99);
  });
  const winner = sorted[0];
  const losers = sorted.slice(1);
  // The winner inherits every piece of evidence and file seen across the
  // group, and records who else reported it.
  winner.evidence = [...(winner.evidence || []), ...losers.flatMap((l) => l.evidence || [])].slice(0, 10);
  winner.files_touched = [...new Set([...(winner.files_touched || []), ...losers.flatMap((l) => l.files_touched || [])])];
  winner.reported_by = sorted.map((f) => f.source);
  merged.push(winner);
  conflicts.push({
    key,
    winner: { id: winner.id, agent: winner.agent, severity: winner.severity, source: winner.source, impact: winner.impact, effort: winner.effort },
    losers: losers.map((l) => ({ id: l.id, agent: l.agent, severity: l.severity, source: l.source, impact: l.impact, effort: l.effort })),
    reason: 'same title and first file reported by multiple agents; highest severity wins',
  });
}

merged.sort((a, b) => {
  const bySev = severityRank(a.severity) - severityRank(b.severity);
  return bySev !== 0 ? bySev : String(a.id).localeCompare(String(b.id));
});

const summary = {
  generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  input_dir: inputDir,
  agents_reporting: Object.keys(byAgent).sort(),
  agents_expected: AGENTS,
  agents_silent: AGENTS.filter((a) => !byAgent[a]),
  by_agent: byAgent,
  total_in: all.length,
  rejected_invalid: invalid.length,
  below_min_severity: valid.length - inScope.length,
  exact_duplicates: exactDuplicates.length,
  merged: merged.length,
  conflicts: conflicts.length,
  min_severity: minSev || 'P0 (no floor)',
};

if (dryRun) {
  console.error('[dry-run] merge-findings');
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

writeJSON(join(base, MERGED_FILE), merged);
writeJSON(join(base, CONFLICTS_FILE), { conflicts, exact_duplicates: exactDuplicates });
writeJSON(join(base, WIL_DIR, 'merge-summary.json'), summary);

console.log(`merged ${merged.length} unique finding(s) from ${all.length} reported by ${Object.keys(byAgent).length} agent(s)`);
if (conflicts.length) console.log(`  ${conflicts.length} cross-agent conflict(s) resolved, higher severity kept — see conflicts.json`);
if (exactDuplicates.length) console.log(`  ${exactDuplicates.length} exact duplicate(s) dropped`);
if (summary.agents_silent.length) console.log(`  silent: ${summary.agents_silent.join(', ')} (no findings, or no file written)`);
if (invalid.length) console.log(`  ${invalid.length} finding(s) rejected as malformed`);
console.log(`  -> ${join(base, MERGED_FILE)}`);
process.exit(0);
