#!/usr/bin/env node
// spec-extract.mjs — derive the observable surface of a project.
//
//   node spec-extract.mjs --project=. [--out FILE] [--dry-run] [--json]
//
// A redesign spec is only useful if it describes what the system actually
// does. This walks the source statically and reports routes, data models,
// validation rules and auth requirements — the things a migration can break.
//
// Static analysis, not a running system: it reads files, it does not boot
// anything. That is a deliberate limit. A dynamic trace would be more
// accurate and would also need a database, which this script must never
// touch. What it cannot see, it reports as unknown rather than guessing.

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, relative, dirname, basename, extname } from 'node:path';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
};

const PROJECT = resolve(String(arg('project', process.cwd())));
const OUT = arg('out', null);
const DRY = Boolean(arg('dry-run', false));
const AS_JSON = Boolean(arg('json', false));

if (!existsSync(PROJECT)) {
  console.error(`spec-extract: '${PROJECT}' does not exist`);
  process.exit(2);
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache', 'artifacts', 'vendor', '__pycache__']);
const MAX_FILES = 4000;

function walk(dir, acc = []) {
  if (acc.length >= MAX_FILES) return acc;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.well-known') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(p, acc);
    } else if (e.isFile()) {
      acc.push(p);
    }
  }
  return acc;
}

const files = walk(PROJECT);
const code = files.filter((f) => ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.rb', '.go', '.php', '.svelte', '.vue'].includes(extname(f)));

const routes = new Map();   // method+path -> {file, line, framework, auth}
const models = new Map();   // name -> {file, line, fields[]}
const validations = [];     // {file, line, rule}
const authSignals = [];     // {file, line, signal}
const config = new Map();   // key -> value (sanitised)

const ROUTE_RE = [
  // Next.js / Remix file routes
  { re: /(?:app|pages)\/([\w[\].-]+)\/(route|page)\.(?:tsx?|jsx?)$/, framework: 'next', method: 'ANY' },
  { re: /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g, framework: 'express', method: '$1' },
  { re: /\b(app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g, framework: 'fastify', method: '$2' },
  { re: /@(app|bp|router)\.route\(\s*['"`]([^'"`]+)['"`]/g, framework: 'flask', method: 'ANY' },
  { re: /(?:url|re_path|path)\(\s*[rbu]?['"`]([^'"`]+)['"`]/g, framework: 'django', method: 'ANY' },
  { re: /\b(?:get|post|put|patch|delete)['"]?\s*,\s*['"`]([^'"`]{2,})['"`]/g, framework: 'fastapi', method: 'ANY' },
];

const AUTH_RE = [
  /\b(requireAuth|isAuthenticated|ensureAuth|withAuth|currentUser|getServerSession|auth)\s*\(/i,
  /\b(req|request|ctx|context)\.user\b/,
  /\b(redirect|next)\s*\(\s*['"`]\/login/i,
  /\b(jwt|jsonwebtoken|passport|next-auth|@auth\/core|clerk|supabase\.auth)\b/i,
  /\bpermissions?\.(contains|has|check)\b/i,
];

const VALIDATION_RE = [
  /\b(z\.object|yup\.object|joi\.object|class\s+\w+Schema|pydantic\.BaseModel|marshmallow|implements\s+Serializable)\b/,
  /\b(validate|validateFields|checkSchema|sanitiz)\s*\(/,
  /\b(min|max|pattern|format|minLength|maxLength|required)\s*[:=]/,
  /\b(propTypes|definePropsType|interface\s+\w+Props)\b/,
];

for (const file of code) {
  let text;
  try {
    if (statSync(file).size > 1_500_000) continue;
    text = readFileSync(file, 'utf8');
  } catch { continue; }
  const rel = relative(PROJECT, file);
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const { re, framework, method } of ROUTE_RE) {
      const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      let m;
      while ((m = rx.exec(line)) !== null) {
        const path = m[m.length - 1];
        if (!path || path.length > 200) continue;
        if (path.includes('${') && !path.includes(':')) continue;
        const normalised = path.replace(/\/\([^)]*\)/g, '/:param').replace(/\[\.\.\.(\w+)\]/g, '*');
        const key = `${framework}:${normalised}`;
        if (!routes.has(key)) {
          const guarded = lines.slice(Math.max(0, i - 12), i + 12).some((l) => AUTH_RE.some((r) => r.test(l)));
          routes.set(key, { path: normalised, framework, method: m.length > 2 ? String(m[1]).toUpperCase() : method, file: rel, line: i + 1, auth_required: guarded });
        }
      }
    }

    for (const rx of AUTH_RE) {
      if (rx.test(line) && line.trim() && !line.trim().startsWith('*') && !line.trim().startsWith('//')) {
        authSignals.push({ file: rel, line: i + 1, signal: line.trim().slice(0, 120) });
        break;
      }
    }
    for (const rx of VALIDATION_RE) {
      if (rx.test(line) && line.trim() && !line.trim().startsWith('//')) {
        validations.push({ file: rel, line: i + 1, rule: line.trim().slice(0, 120) });
        break;
      }
    }
  }

  // Models: Prisma models, SQL CREATE TABLE, Mongoose/TypeORM entities, ORM classes.
  const prisma = /^\s*model\s+(\w+)\s*\{([\s\S]*?)\n\}/gm;
  let pm;
  while ((pm = prisma.exec(text)) !== null) {
    const fields = pm[2].split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
      .map((l) => l.split(/\s+/)[0])
      .filter(Boolean);
    models.set(pm[1], { name: pm[1], orm: 'prisma', file: rel, fields });
  }
  const sqlTable = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?\s*\(([\s\S]*?)\n\)/gi;
  let sm;
  while ((sm = sqlTable.exec(text)) !== null) {
    const fields = sm[2].split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[\s(]+/)[0]).filter(Boolean);
    models.set(sm[1], { name: sm[1], orm: 'sql', file: rel, fields });
  }
  const entity = /@(Entity|Model|Document)\(\s*[\)\w]*\)\s*(?:export\s+)?class\s+(\w+)/g;
  let em;
  while ((em = entity.exec(text)) !== null) {
    models.set(em[2], { name: em[2], orm: em[1].toLowerCase(), file: rel, fields: [] });
  }
}

// Config: read package.json and .env.example. Never read a real .env.
const pkgPath = join(PROJECT, 'package.json');
if (existsSync(pkgPath)) {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    config.set('package.name', pkg.name ?? 'unknown');
    config.set('package.framework', detectFramework(pkg));
    config.set('package.dependencies', Object.keys(pkg.dependencies ?? {}).sort().join(', '));
  } catch { /* unreadable package.json is not fatal; the rest still stands */ }
}
const envExample = ['.env.example', '.env.sample', 'env.example'].map((f) => join(PROJECT, f)).find((f) => existsSync(f));
let envKeys = [];
if (envExample) {
  envKeys = readFileSync(envExample, 'utf8').split('\n')
    .map((l) => l.match(/^\s*([A-Z][A-Z0-9_]+)\s*=/)?.[1])
    .filter(Boolean);
}
config.set('env.example.keys', envKeys.join(', '));

function detectFramework(pkg) {
  const d = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  if (d.next) return 'next';
  if (d['react-router'] || d['@remix-run/react']) return 'react-router';
  if (d.express) return 'express';
  if (d.fastify) return 'fastify';
  if (d.nestjs || d['@nestjs/core']) return 'nest';
  if (d.vue) return 'vue';
  if (d.svelte) return 'svelte';
  if (d.angular) return 'angular';
  return 'unknown';
}

const result = {
  $comment: 'Static surface extraction. Fields the analyser could not determine are reported as null, never defaulted — a guessed auth rule is worse than an acknowledged gap.',
  generated_at: new Date().toISOString(),
  project: basename(PROJECT),
  analysed_files: code.length,
  truncated: files.length >= MAX_FILES,
  framework: config.get('package.framework') ?? null,
  config: Object.fromEntries(config),
  routes: [...routes.values()].sort((a, b) => a.path.localeCompare(b.path)),
  route_count: routes.size,
  protected_route_count: [...routes.values()].filter((r) => r.auth_required).length,
  models: [...models.values()].sort((a, b) => a.name.localeCompare(b.name)),
  model_count: models.size,
  validations: validations.slice(0, 200),
  validation_count: validations.length,
  auth_signals: authSignals.slice(0, 200),
  auth_signal_count: authSignals.length,
  env_keys: envKeys,
  unknowns: [
    ...(routes.size === 0 ? ['no routes detected — the project may build routes dynamically'] : []),
    ...(models.size === 0 ? ['no data models detected — schemas may be created outside source'] : []),
    ...(authSignals.length === 0 ? ['no auth signal detected — auth may be applied at an edge or gateway'] : []),
  ],
};

if (DRY) {
  console.error('[dry-run] nothing written.');
  if (AS_JSON) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`[dry-run] spec-extract would scan ${code.length} file(s) under ${PROJECT}`);
    console.log(`[dry-run]   framework:   ${result.framework ?? 'unknown'}`);
    console.log(`[dry-run]   routes:      ${result.route_count} (${result.protected_route_count} auth-guarded)`);
    console.log(`[dry-run]   models:      ${result.model_count}`);
    console.log(`[dry-run]   validations: ${result.validation_count}`);
  }
  process.exit(0);
}

if (OUT) {
  const outPath = resolve(PROJECT, String(OUT));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(`[OK] ${relative(PROJECT, outPath)} — ${result.route_count} routes, ${result.model_count} models`);
} else {
  console.log(JSON.stringify(result, null, 2));
}
process.exit(0);
