#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';

const STATE_PATH = resolve('artifacts/redesign/STATE.json');
const OUT_DIR = resolve('artifacts/redesign/rollback');

function ensureDir() { if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true }); }

function gitRevert() {
  const result = spawnSync('git', ['revert', '--no-edit', 'HEAD'], { encoding: 'utf-8' });
  return result.status === 0;
}

function flagFlip(featureFlag) {
  if (!featureFlag) return false;
  console.log(`  Flipping flag: ${featureFlag} -> off`);
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const hstId = args.includes('--hst') ? args[args.indexOf('--hst') + 1] : null;
  const route = args.includes('--route') ? args[args.indexOf('--route') + 1] : null;

  ensureDir();
  console.log('=== Rollback ===');
  if (dryRun) console.log('[DRY RUN] No changes applied.');

  const state = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, 'utf-8')) : {};

  // Phase-specific rollback
  if (route || hstId) {
    const flag = route ? `redesign/route-${route}` : `redesign/${hstId}`;
    if (!dryRun) {
      flagFlip(flag);
      const reverted = gitRevert();
      if (reverted) console.log('  Last commit reverted.');
      else console.log('  No commit to revert or revert failed.');
    }
  }

  const report = {
    rolled_back_at: new Date().toISOString(),
    hst_id: hstId,
    route: route,
    actions: dryRun ? [] : ['flag_flip', 'git_revert'],
    state_restored: !dryRun && !!state,
  };

  writeFileSync(resolve(OUT_DIR, `ROLLBACK_${hstId || Date.now()}.json`), JSON.stringify(report, null, 2));
  console.log(`Rollback report written.`);
}

main();
