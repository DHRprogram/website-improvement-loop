#!/usr/bin/env node
// data-contract-freeze.mjs — freeze, version and diff the data contract.
//
//   node data-contract-freeze.mjs --project=. [--out FILE] [--diff] [--dry-run]
//                                 [--from FILE] [--breaking-exit]
//
// Reads the observable request/response surface and writes
// artifacts/website-loop/DATA_CONTRACT.json. The freeze is committed: a
// contract that moves every time the code moves constrains nothing.
//
// --diff compares the current surface against the frozen one and exits 1 if a
// breaking change appears with no approval. --breaking-exit makes every
// difference exit 1, for a pipeline that wants strict equality.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, extname } from 'node:path';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
};

const PROJECT = resolve(String(arg('project', process.cwd())));
const OUT_REL = String(arg('out', 'artifacts/website-loop/DATA_CONTRACT.json'));
const DO_DIFF = Boolean(arg('diff', false));
const DRY = Boolean(arg('dry-run', false));
const FROM = arg('from', null);
const BREAKING_EXIT = Boolean(arg('breaking-exit', false));
const APPROVALS_REL = 'artifacts/website-loop/APPROVALS.json';

if (!existsSync(PROJECT)) {
  console.error(`data-contract-freeze: '${PROJECT}' does not exist`);
  process.exit(2);
}

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'artifacts', 'vendor']);

function walk(dir, acc = [], depth = 0) {
  if (depth > 10 || acc.length > 6000) return acc;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP.has(e.name)) continue;
      walk(p, acc, depth + 1);
    } else if (e.isFile() && ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.rb', '.sql'].includes(extname(p))) {
      acc.push(p);
    }
  }
  return acc;
}

/** Flatten a surface object into "path -> type" leaves, for structural diffing. */
function leaves(node, prefix = '', out = new Map()) {
  if (node === null) { out.set(prefix, 'null'); return out; }
  if (Array.isArray(node)) {
    if (node.length === 0) { out.set(prefix, 'array<empty>'); return out; }
    out.set(prefix, `array<${node.length}>`);
    node.forEach((v, i) => leaves(v, `${prefix}[]`, out));
    return out;
  }
  if (typeof node === 'object') {
    const keys = Object.keys(node).sort();
    if (keys.length === 0) { out.set(prefix, 'object<empty>'); return out; }
    for (const k of keys) leaves(node[k], prefix ? `${prefix}.${k}` : k, out);
    return out;
  }
  out.set(prefix, typeof node === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(node) ? 'datetime' : typeof node);
  return out;
}

const files = walk(PROJECT);

const endpoints = new Map();
const shapes = new Map();   // model name -> field -> type
const enums = new Map();    // enum-ish key -> values

for (const file of files) {
  let text;
  try {
    if (statSync(file).size > 2_000_000) continue;
    text = readFileSync(file, 'utf8');
  } catch { continue; }
  const rel = relative(PROJECT, file);
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Routes with a declared method.
    const route = line.match(/\b(?:app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/);
    if (route) {
      const key = `${route[1].toUpperCase()} ${route[2]}`;
      if (!endpoints.has(key)) {
        endpoints.set(key, {
          id: key,
          auth: /requireAuth|isAuthenticated|ensureAuth|auth\b/i.test(lines.slice(Math.max(0, i - 8), i + 8).join('\n')),
          file: rel,
          line: i + 1,
          request_fields: [],
          response_statuses: [],
        });
      }
    }

    // Response status codes near a route.
    for (const sm of line.matchAll(/\bres(?:ponse)?\.status\((\d{3})\)/g)) {
      for (const ep of endpoints.values()) {
        if (ep.file === rel && Math.abs(ep.line - (i + 1)) < 60) ep.response_statuses.push(Number(sm[1]));
      }
    }
    for (const sm of line.matchAll(/\.statusCode\s*=\s*(\d{3})/g)) {
      for (const ep of endpoints.values()) {
        if (ep.file === rel && Math.abs(ep.line - (i + 1)) < 60) ep.response_statuses.push(Number(sm[1]));
      }
    }

    // String-literal unions, which are how most enums are written in TS/JS.
    const union = line.match(/\b(?:status|type|role|state|kind|severity|currency)\b\s*[:=]\s*\[([^\]]+)\]/);
    if (union) {
      const values = [...union[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
      if (values.length) enums.set(`${rel}:${i + 1}`, values.sort());
    }
  }

  // Prisma models give real field types — the highest-fidelity source available.
  const prisma = /^\s*model\s+(\w+)\s*\{([\s\S]*?)\n\}/gm;
  let pm;
  while ((pm = prisma.exec(text)) !== null) {
    const fields = {};
    for (const raw of pm[2].split('\n')) {
      const l = raw.trim();
      if (!l || l.startsWith('//') || l.startsWith('@@')) continue;
      const f = l.match(/^(\w+)\s+(\w+)(\[\])?(\?)?/);
      if (f) fields[f[1]] = (f[2] || 'unknown') + (f[3] ? '[]' : '') + (f[4] ? '?' : '');
    }
    shapes.set(pm[1], fields);
  }
}

const contract = {
  $comment: 'Generated by scripts/data-contract-freeze.mjs. Committed, and enforced by scripts/guards/no-schema-change.sh. A change here is legitimate but needs an approval record in APPROVALS.json.',
  contract_version: '1.0.0',
  frozen_at: new Date().toISOString(),
  generator: 'data-contract-freeze.mjs',
  conventions: {
    field_naming: 'camelCase',
    null_explicit: true,
    enum_unknown_handling: 'consumers must ignore unrecognised values',
    additional_properties: false,
  },
  endpoints: [...endpoints.values()]
    .map((e) => ({ ...e, response_statuses: [...new Set(e.response_statuses)].sort((a, b) => a - b) }))
    .sort((a, b) => a.id.localeCompare(b.id)),
  models: [...shapes.entries()].map(([name, fields]) => ({ name, fields: Object.fromEntries(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b))) })).sort((a, b) => a.name.localeCompare(b.name)),
  enums: Object.fromEntries([...enums.entries()].sort(([a], [b]) => a.localeCompare(b))),
  counts: {
    endpoints: endpoints.size,
    models: shapes.size,
    enums: enums.size,
    files_scanned: files.length,
  },
  unknowns: [
    ...(endpoints.size === 0 ? ['no endpoints detected — the surface may be defined dynamically or in another service'] : []),
    ...(shapes.size === 0 ? ['no typed models detected — response shapes are unverified; treat this freeze as incomplete'] : []),
  ],
};

const outPath = resolve(PROJECT, OUT_REL);
const fromPath = resolve(PROJECT, String(FROM ?? OUT_REL));

if (DO_DIFF || (existsSync(fromPath) && existsSync(outPath) && arg('diff', null) !== false)) {
  if (!existsSync(fromPath)) {
    if (DRY) { console.error('[dry-run] nothing written.'); process.exit(0); }
    console.error(`data-contract-freeze: nothing frozen yet at ${relative(PROJECT, fromPath)}. Run without --diff first.`);
    process.exit(1);
  }
  let previous;
  try {
    previous = JSON.parse(readFileSync(fromPath, 'utf8'));
  } catch (e) {
    console.error(`data-contract-freeze: the frozen contract is unreadable: ${e.message}`);
    console.error('A contract that cannot be parsed is not an unchanged contract.');
    process.exit(2);
  }

  const changes = [];
  const prevEndpoints = new Map((previous.endpoints ?? []).map((e) => [e.id, e]));
  const nowEndpoints = new Map((contract.endpoints ?? []).map((e) => [e.id, e]));

  for (const [id, ep] of nowEndpoints) {
    if (!prevEndpoints.has(id)) changes.push({ kind: 'added', surface: 'endpoint', id, breaking: false });
  }
  for (const [id] of prevEndpoints) {
    if (!nowEndpoints.has(id)) changes.push({ kind: 'removed', surface: 'endpoint', id, breaking: true, note: 'a caller of this endpoint now 404s' });
  }
  for (const [id, ep] of nowEndpoints) {
    const before = prevEndpoints.get(id);
    if (!before) continue;
    const b = new Set(before.response_statuses ?? []);
    for (const s of ep.response_statuses ?? []) {
      if (!b.has(s)) changes.push({ kind: 'status_added', surface: 'endpoint', id, status: s, breaking: false });
    }
    for (const s of b) {
      if (!(ep.response_statuses ?? []).includes(s)) {
        changes.push({ kind: 'status_removed', surface: 'endpoint', id, status: s, breaking: true, note: 'retry and error-handling logic keys on the status code' });
      }
    }
    if (Boolean(before.auth) !== Boolean(ep.auth)) {
      changes.push({ kind: 'auth_changed', surface: 'endpoint', id, before: before.auth, after: ep.auth, breaking: true, note: 'auth changing is always a contract change requiring approval' });
    }
  }

  const prevModels = new Map((previous.models ?? []).map((m) => [m.name, m.fields ?? {}]));
  const nowModels = new Map((contract.models ?? []).map((m) => [m.name, m.fields ?? {}]));
  for (const [name, fields] of nowModels) {
    if (!prevModels.has(name)) { changes.push({ kind: 'added', surface: 'model', id: name, breaking: false }); continue; }
    const prevFields = prevModels.get(name);
    for (const f of Object.keys(fields)) {
      if (!(f in prevFields)) changes.push({ kind: 'field_added', surface: 'model', id: name, field: f, type: fields[f], breaking: false });
    }
    for (const f of Object.keys(prevFields)) {
      if (!(f in fields)) changes.push({ kind: 'field_removed', surface: 'model', id: name, field: f, breaking: true, note: 'an existing reader references this field' });
      else if (prevFields[f] !== fields[f]) {
        const narrowed = !fields[f].endsWith('?') && prevFields[f].endsWith('?');
        changes.push({ kind: 'field_type_changed', surface: 'model', id: name, field: f, before: prevFields[f], after: fields[f], breaking: narrowed, note: narrowed ? 'a nullable field became non-null; readers handling null now get an unexpected value' : undefined });
      }
    }
  }
  for (const name of prevModels.keys()) {
    if (!nowModels.has(name)) changes.push({ kind: 'removed', surface: 'model', id: name, breaking: true });
  }

  const breaking = changes.filter((c) => c.breaking);

  console.log('=== data-contract diff ===');
  console.log(`frozen: ${previous.contract_version ?? 'unversioned'} (${previous.frozen_at ?? 'unknown date'})`);
  console.log(`now:    ${contract.contract_version}`);
  if (changes.length === 0) {
    console.log('no changes. The contract still holds.');
  } else {
    for (const c of changes) {
      console.log(`  ${c.breaking ? 'BREAKING' : 'ok      '} ${c.kind.padEnd(20)} ${c.surface}/${c.id}${c.field ? '.' + c.field : ''}${c.note ? '  — ' + c.note : ''}`);
    }
    console.log(`\n${changes.length} change(s), ${breaking.length} breaking.`);
  }

  if (DRY) { console.error('[dry-run] nothing written.'); process.exit(0); }

  if (breaking.length > 0) {
    const version = contract.contract_version;
    let approved = false;
    const approvalsPath = resolve(PROJECT, APPROVALS_REL);
    if (existsSync(approvalsPath)) {
      try {
        const a = JSON.parse(readFileSync(approvalsPath, 'utf8'));
        const list = Array.isArray(a) ? a : (a.approvals ?? []);
        approved = list.some((x) => String(x.contract_version ?? '') === version && String(x.approver ?? '').trim() !== '' && String(x.reason ?? '').trim() !== '');
      } catch { approved = false; }
    }
    if (approved) {
      console.log(`\nBreaking changes are approved for version ${version}. Writing the new freeze.`);
      mkdirSync(resolve(outPath, '..'), { recursive: true });
      writeFileSync(outPath, JSON.stringify(contract, null, 2) + '\n', 'utf8');
      console.log(`[OK] ${relative(PROJECT, outPath)} updated to ${version}.`);
      process.exit(0);
    }
    console.error(`\nFAIL: ${breaking.length} breaking change(s) with no approval for version ${version}.`);
    console.error(`Record one in ${APPROVALS_REL}:`);
    console.error(`  { "contract_version": "${version}", "approver": "<a person>", "reason": "<why>", "date": "<YYYY-MM-DD>" }`);
    process.exit(1);
  }

  if (BREAKING_EXIT && changes.length > 0) {
    console.error('\n--breaking-exit: refusing to accept any difference. Exiting 1.');
    process.exit(1);
  }
}

if (DRY) {
  console.error('[dry-run] nothing written.');
  console.log(`[dry-run] would freeze ${contract.counts.endpoints} endpoint(s), ${contract.counts.models} model(s), ${contract.counts.enums} enum(s) to ${OUT_REL}`);
  if (contract.unknowns.length) for (const u of contract.unknowns) console.log(`[dry-run]   unknown: ${u}`);
  process.exit(0);
}

mkdirSync(resolve(outPath, '..'), { recursive: true });
writeFileSync(outPath, JSON.stringify(contract, null, 2) + '\n', 'utf8');
console.log(`[OK] ${relative(PROJECT, outPath)} — ${contract.counts.endpoints} endpoint(s), ${contract.counts.models} model(s), ${contract.counts.enums} enum(s)`);
for (const u of contract.unknowns) console.warn(`[warn] ${u}`);
process.exit(0);
