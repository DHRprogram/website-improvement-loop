#!/usr/bin/env node

/**
 * R3 — Data Contract Freeze
 * Captures current DB schema and API shape, writes DATA_CONTRACT.json,
 * and enforces the R13 freeze. After this phase, no code changes may
 * alter the schema/API contract without re-approval.
 *
 * Usage:
 *   node data-contract-freeze.mjs            # freeze current state
 *   node data-contract-freeze.mjs --dry-run   # preview without writing
 *   node data-contract-freeze.mjs --verify   # check drift against frozen contract
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';

const ARTIFACTS = resolve('artifacts/redesign');
const OUT_DIR = resolve(ARTIFACTS, 'data-contract');
const CONTRACT_PATH = resolve(OUT_DIR, 'DATA_CONTRACT.json');
const STATE_PATH = resolve(ARTIFACTS, 'STATE.json');
const META_PATH = resolve(OUT_DIR, 'DATA_CONTRACT_META.json');

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function loadJSON(p) {
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = { dryRun: false, verify: false };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run': flags.dryRun = true; break;
      case '--verify': flags.verify = true; break;
      case '--out-dir': flags.outDir = args[++i]; break;
      case '--help':
        console.log(`Usage: data-contract-freeze.mjs [--dry-run] [--verify] [--out-dir <path>]`);
        process.exit(0);
    }
  }
  return flags;
}

/** Detect API endpoints by scanning route files in common locations */
function detectApiRoutes() {
  const endpoints = [];
  const searchDirs = ['app/api', 'pages/api', 'src/pages/api', 'src/app/api',
    'backend/routes', 'backend/src/routes', 'routes', 'src/routes', 'api'];

  for (const dir of searchDirs) {
    const full = resolve(dir);
    if (!existsSync(full)) continue;
    try {
      const findOut = execSync(
        `find ${dir} -type f \\( -name '*.ts' -o -name '*.js' -o -name '*.mjs' \\) 2>/dev/null | sort`,
        { encoding: 'utf-8', cwd: resolve('.'), maxBuffer: 1024 * 1024 }
      ).trim().split('\n').filter(Boolean);

      for (const file of findOut) {
        const relative = file.startsWith(dir) ? file.slice(dir.length) : file;
        const path = relative.replace(/\.(ts|js|mjs)$/, '').replace(/\/index$/, '') || '/';
        endpoints.push({ file, method: inferMethod(file), path });
      }
    } catch { /* dir may not exist or find unavailable */ }
  }
  return endpoints;
}

function inferMethod(file) {
  const name = file.split('/').pop() || '';
  if (name.startsWith('get')) return 'GET';
  if (name.startsWith('post')) return 'POST';
  if (name.startsWith('put')) return 'PUT';
  if (name.startsWith('patch')) return 'PATCH';
  if (name.startsWith('delete') || name.startsWith('del')) return 'DELETE';
  return 'ANY';
}

/** Detect DB tables from schema files */
function detectDbTables() {
  const tables = [];
  const schemaFiles = ['prisma/schema.prisma', 'db/schema.sql', 'src/db/schema.ts',
    'src/db/schema.prisma', 'database/schema.sql'];

  for (const sf of schemaFiles) {
    if (!existsSync(resolve(sf))) continue;
    const content = readFileSync(resolve(sf), 'utf-8');
    const modelMatches = content.matchAll(/(?:model|table|createTable)\s+(\w+)/g);
    for (const m of modelMatches) {
      if (!tables.includes(m[1])) tables.push(m[1]);
    }
  }
  return tables;
}

/** Compute a simple hash of all schema files for drift detection */
function computeSchemaHash() {
  let hashStr = '';
  const schemaFiles = ['prisma/schema.prisma', 'db/schema.sql', 'src/db/schema.ts',
    'src/db/schema.prisma', 'database/schema.sql'];

  for (const sf of schemaFiles) {
    if (!existsSync(resolve(sf))) continue;
    hashStr += readFileSync(resolve(sf), 'utf-8');
  }

  if (!hashStr) return 'no-schema-files';
  let hash = 0;
  for (let i = 0; i < hashStr.length; i++) {
    const ch = hashStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

/** Snapshot current routes, API shape, and DB schema */
function snapshotCurrent() {
  const state = loadJSON(STATE_PATH) || {};
  const routes = state.routes || ['/'];
  const apiEndpoints = detectApiRoutes();
  const dbTables = detectDbTables();
  const schemaHash = computeSchemaHash();
  const meta = loadJSON(META_PATH);

  return {
    version: meta?.version || '1.0.0',
    frozen: false,
    frozen_at: new Date().toISOString(),
    routes: routes.map(r => ({ path: r })),
    apiEndpoints,
    dbTables,
    schemaHash,
    constraints: {
      noNewTables: meta?.constraints?.noNewTables ?? true,
      noDropColumns: meta?.constraints?.noDropColumns ?? true,
      noApiBreak: meta?.constraints?.noApiBreak ?? true,
    },
  };
}

/** Compare two snapshots and return a list of deltas */
function detectDrift(contract, snapshot) {
  const drift = [];
  if (contract.schemaHash !== snapshot.schemaHash) {
    drift.push({ path: 'schemaHash', kind: 'changed',
      before: contract.schemaHash, after: snapshot.schemaHash });
  }
  if (contract.dbTables.length !== snapshot.dbTables.length) {
    drift.push({ path: 'dbTables.count', kind: 'changed',
      before: contract.dbTables.length, after: snapshot.dbTables.length });
  }
  if (contract.apiEndpoints.length !== snapshot.apiEndpoints.length) {
    drift.push({ path: 'apiEndpoints.count', kind: 'changed',
      before: contract.apiEndpoints.length, after: snapshot.apiEndpoints.length });
  }
  const newTables = snapshot.dbTables.filter(t => !contract.dbTables.includes(t));
  if (newTables.length > 0) {
    drift.push({ path: 'dbTables.new', kind: 'added', items: newTables });
  }
  return drift;
}

function printSnapshot(snapshot) {
  console.log(`  Routes:    ${snapshot.routes.length}`);
  console.log(`  API endpoints: ${snapshot.apiEndpoints.length}`);
  console.log(`  DB tables: ${snapshot.dbTables.length}`);
  console.log(`  Schema hash: ${snapshot.schemaHash}`);
  if (snapshot.apiEndpoints.length > 0) {
    console.log(`  Sample endpoints:`);
    snapshot.apiEndpoints.slice(0, 5).forEach(e => console.log(`    ${e.method} ${e.path}`));
  }
  if (snapshot.dbTables.length > 0) {
    console.log(`  Tables: ${snapshot.dbTables.slice(0, 8).join(', ')}`);
  }
}

function main() {
  const cfg = parseArgs();
  ensureDir(OUT_DIR);

  const contract = loadJSON(CONTRACT_PATH);

  // --verify mode: check drift against existing frozen contract
  if (cfg.verify && contract) {
    if (!contract.frozen) {
      console.error('Contract exists but is not frozen. Run without --verify first.');
      process.exit(1);
    }
    const snapshot = snapshotCurrent();
    const drift = detectDrift(contract, snapshot);
    if (drift.length > 0) {
      for (const d of drift) {
        console.error(`  DRIFT: ${d.path} ${d.kind} — ${d.before || '(none)'} => ${d.after || d.items?.join(',') || '(changed)'}`);
      }
      console.error('[HST-04] Data Contract drift detected. Rollback required.');
      process.exit(1);
    }
    console.log(`Data contract stable since ${contract.frozen_at}. No drift.`);
    return;
  }

  if (cfg.verify && !contract) {
    console.log('No frozen contract to verify against. Run without --verify first.');
    process.exit(0);
  }

  // If contract already exists and is frozen, just verify drift
  if (contract && contract.frozen) {
    if (cfg.dryRun) {
      console.log(`[DRY RUN] Contract already frozen at ${contract.frozen_at}.`);
      const snapshot = snapshotCurrent();
      const drift = detectDrift(contract, snapshot);
      if (drift.length > 0) {
        console.log(`  Would detect ${drift.length} drift(s):`);
        drift.forEach(d => console.log(`  - ${d.path}: ${d.kind}`));
      } else {
        console.log('  No drift detected.');
      }
      process.exit(0);
    }
    // Non-dry-run: verify normally
    const snapshot = snapshotCurrent();
    const drift = detectDrift(contract, snapshot);
    if (drift.length > 0) {
      for (const d of drift) {
        console.error(`  DRIFT: ${d.path} — ${d.before || ''} => ${d.after || d.items?.join(',')}`);
      }
      console.error('[HST-04] Data Contract drift detected.');
      process.exit(1);
    }
    console.log(`Data contract stable since ${contract.frozen_at}.`);
    return;
  }

  // Create new contract
  const snapshot = snapshotCurrent();

  if (cfg.dryRun) {
    console.log('[DRY RUN] Would freeze the following data contract:');
    printSnapshot(snapshot);
    process.exit(0);
  }

  snapshot.frozen = true;
  snapshot.frozen_at = new Date().toISOString();
  writeFileSync(CONTRACT_PATH, JSON.stringify(snapshot, null, 2));

  // Write a meta file with additional context
  const meta = {
    createdAt: snapshot.frozen_at,
    schemaHash: snapshot.schemaHash,
    routeCount: snapshot.routes.length,
    endpointCount: snapshot.apiEndpoints.length,
    tableCount: snapshot.dbTables.length,
  };
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2));

  console.log('Data contract frozen successfully:');
  printSnapshot(snapshot);
}

main();