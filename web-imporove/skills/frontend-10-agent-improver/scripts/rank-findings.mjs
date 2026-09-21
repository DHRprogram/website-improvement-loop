#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const BASE = resolve(ARGS.includes('--base') ? ARGS[ARGS.indexOf('--base') + 1] : '.');
const MIN_SEVERITY = ARGS.includes('--min-severity') ? ARGS[ARGS.indexOf('--min-severity') + 1] : 'P2';

const ARTIFACTS_DIR = resolve(BASE, 'artifacts', 'frontend-loop');
const MERGED_PATH = resolve(ARTIFACTS_DIR, 'MERGED_FINDINGS.json');
const QUEUE_PATH = resolve(ARTIFACTS_DIR, 'QUEUE.json');
const QUEUE_TOP_PATH = resolve(ARTIFACTS_DIR, 'QUEUE_TOP.json');

const SEVERITY_WEIGHTS = { P0: 1000, P1: 300, P2: 100, P3: 30 };
const SEVERITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };
const MIN_SEV_ORDER = SEVERITY_ORDER[MIN_SEVERITY] ?? 2;

function calculatePriority(finding) {
  const weight = SEVERITY_WEIGHTS[finding.severity] || 30;
  return (weight * (finding.impact || 3)) / Math.max(finding.effort || 3, 1);
}

function main() {
  if (!existsSync(MERGED_PATH)) {
    if (!DRY_RUN) {
      writeFileSync(QUEUE_PATH, '[]', 'utf-8');
      writeFileSync(QUEUE_TOP_PATH, '[]', 'utf-8');
    }
    console.log('No merged findings found.' + (DRY_RUN ? '' : ' Run merge-findings.mjs first.'));
    return;
  }

  const findings = JSON.parse(readFileSync(MERGED_PATH, 'utf-8'));

  const filtered = findings.filter(f => {
    const sevOrder = SEVERITY_ORDER[f.severity] ?? 99;
    return sevOrder <= MIN_SEV_ORDER && f.status !== 'fixed' && f.status !== 'reverted';
  });

  const ranked = filtered.map(f => ({
    ...f,
    priority: calculatePriority(f),
    severity_weight: SEVERITY_WEIGHTS[f.severity] || 30,
  }));

  ranked.sort((a, b) => b.priority - a.priority);

  const top5 = ranked.slice(0, 5);

  if (DRY_RUN) {
    console.log(`[DRY RUN] Total findings: ${findings.length}`);
    console.log(`[DRY RUN] Filtered (<= ${MIN_SEVERITY}): ${filtered.length}`);
    console.log(`[DRY RUN] Ranked queue: ${ranked.length}`);
    console.log(`[DRY RUN] Top 5:`);
    for (let i = 0; i < top5.length; i++) {
      console.log(`  ${i + 1}. [${top5[i].severity}] ${top5[i].agent}: ${top5[i].title} (priority: ${top5[i].priority.toFixed(0)})`);
    }
    return;
  }

  writeFileSync(QUEUE_PATH, JSON.stringify(ranked, null, 2), 'utf-8');
  writeFileSync(QUEUE_TOP_PATH, JSON.stringify(top5, null, 2), 'utf-8');

  console.log(`Ranked ${filtered.length} findings. Top ${top5.length} selected.`);
  console.log(`  Queue: ${QUEUE_PATH}`);
  console.log(`  Top 5: ${QUEUE_TOP_PATH}`);
}

main();
