#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const BASE = resolve(ARGS.includes('--base') ? ARGS[ARGS.indexOf('--base') + 1] : '.');

const ARTIFACTS_DIR = resolve(BASE, 'artifacts', 'frontend-loop');
const FINDINGS_DIR = resolve(ARTIFACTS_DIR, 'findings');
const CONFLICTS_PATH = resolve(ARTIFACTS_DIR, 'conflicts.json');
const MERGED_PATH = resolve(ARTIFACTS_DIR, 'MERGED_FINDINGS.json');

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function loadFindings() {
  const all = [];
  if (!existsSync(FINDINGS_DIR)) return all;
  for (const iterDir of readdirSync(FINDINGS_DIR)) {
    const fp = resolve(FINDINGS_DIR, iterDir, 'findings.json');
    if (existsSync(fp)) {
      try {
        const data = JSON.parse(readFileSync(fp, 'utf-8'));
        all.push(...data);
      } catch (e) {
        console.error(`Error reading ${fp}: ${e.message}`);
      }
    }
  }
  return all;
}

function deduplicate(findings) {
  const seen = new Map();
  const conflicts = [];
  const merged = [];

  for (const f of findings) {
    const firstFile = (f.files_touched && f.files_touched.length > 0) ? f.files_touched[0] : '';
    const key = `${f.agent}:${normalizeTitle(f.title)}:${firstFile}`;

    if (seen.has(key)) {
      conflicts.push({ existing: seen.get(key), duplicate: f, reason: 'agent+title+first_file match' });
    } else {
      seen.set(key, f);
      merged.push(f);
    }
  }
  return { merged, conflicts };
}

function main() {
  const findings = loadFindings();
  const { merged, conflicts } = deduplicate(findings);

  if (DRY_RUN) {
    console.log(`[DRY RUN] Total findings: ${findings.length}`);
    console.log(`[DRY RUN] Unique findings after dedupe: ${merged.length}`);
    if (conflicts.length > 0) {
      console.log(`[DRY RUN] Conflicts: ${conflicts.length}`);
      for (const c of conflicts.slice(0, 5)) {
        console.log(`  Conflict: "${c.existing.title}" vs "${c.duplicate.title}" (${c.reason})`);
      }
      
    }
    return;
  }

  writeFileSync(MERGED_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  writeFileSync(CONFLICTS_PATH, JSON.stringify(conflicts, null, 2), 'utf-8');

  console.log(`Merged ${findings.length} findings into ${merged.length} unique (${conflicts.length} conflicts).`);
  console.log(`  Merged: ${MERGED_PATH}`);
  console.log(`  Conflicts: ${CONFLICTS_PATH}`);
}

main();
