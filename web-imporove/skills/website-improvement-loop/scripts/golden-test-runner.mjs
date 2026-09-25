#!/usr/bin/env node
// golden-test-runner.mjs — run the golden suite that pins pre-migration behaviour.
//
//   node golden-test-runner.mjs --project=. [--base-url=URL] [--glob=PATTERN]
//                               [--update] [--dry-run] [--json]
//
// A golden test asserts observable output. It exists so that "did this change
// anything?" has an answer other than "it looked fine in the browser".
//
// Exit codes:
//   0 all pass, or nothing to run (reported explicitly, never as a silent pass)
//   1 at least one test failed
//   2 the runner could not decide — fails closed, because a guard that cannot
//     decide must not read as a pass
//
// Playwright is optional. Without it the runner reports that the suite did not
// execute rather than reporting a green result it did not observe.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, basename } from 'node:path';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
};

const PROJECT = resolve(String(arg('project', process.cwd())));
const BASE_URL = arg('base-url', process.env.WIL_BASE_URL ?? null);
const GLOB = String(arg('glob', 'tests/golden'));
const UPDATE = Boolean(arg('update', false));
const DRY = Boolean(arg('dry-run', false));
const AS_JSON = Boolean(arg('json', false));
const TIMEOUT_MS = Number(arg('timeout', 15000));

if (!existsSync(PROJECT)) {
  console.error(`golden-test-runner: '${PROJECT}' does not exist`);
  process.exit(2);
}

const suiteDir = resolve(PROJECT, GLOB);
const snapshotDir = join(suiteDir, '__snapshots__');

function findSpecs(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === '__snapshots__') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...findSpecs(p));
    else if (/\.(spec|golden)\.(ts|js|mjs|tsx|jsx)$/.test(e.name)) out.push(p);
  }
  return out.sort();
}

const specs = findSpecs(suiteDir);
const runner = {
  suite: relative(PROJECT, suiteDir),
  base_url: BASE_URL ? String(BASE_URL) : null,
  update: UPDATE,
  dry_run: DRY,
  specs_found: specs.length,
  specs_run: 0,
  passed: 0,
  failed: 0,
  errors: 0,
  results: [],
  executed: false,
  engine: null,
  notes: [],
};

if (specs.length === 0) {
  // Exit 0, but say plainly that nothing ran. "No tests" and "all tests pass"
  // are different facts and a CI log should not conflate them.
  runner.notes.push(`no specs under ${GLOB} — nothing ran. This is NOT a pass; it is an absence of tests.`);
  runner.result = 'empty';
  report();
  process.exit(0);
}

if (DRY) {
  runner.notes.push('dry run: no browser was launched and no snapshot was read or written.');
  runner.result = 'dry-run';
  report();
  process.exit(0);
}

if (BASE_URL && /prod|www\.[^./]+\.[a-z]{2,}\/?$/.test(String(BASE_URL))) {
  console.error(`golden-test-runner: refusing to run against what looks like production: ${BASE_URL}`);
  console.error('Golden tests must run against a test environment.');
  process.exit(2);
}

let chromium = null;
try {
  ({ chromium } = await import('playwright'));
  runner.engine = 'playwright';
} catch (e) {
  runner.notes.push(`playwright is not installed: ${e.message.split('\n')[0]}. The suite did NOT run.`);
  runner.result = 'not-executed';
  report();
  process.exit(2);
}

if (!BASE_URL) {
  runner.notes.push('no --base-url was given, so no page could be loaded. The suite did NOT run.');
  runner.result = 'not-executed';
  report();
  process.exit(2);
}

let browser;
try {
  browser = await chromium.launch();
} catch (e) {
  runner.notes.push(`could not launch a browser: ${e.message.split('\n')[0]}. The suite did NOT run.`);
  runner.result = 'not-executed';
  report();
  process.exit(2);
}

/**
 * The spec file is parsed for a route and an assertion. This is not a
 * JavaScript interpreter and does not pretend to be: it reads the two facts a
 * golden test needs, and if it cannot find them it says so rather than
 * reporting a vacuous pass.
 */
function parseSpec(text) {
  const route = text.match(/(?:goto|visit|load|page\.goto)\s*\(\s*['"`]([^'"`]+)['"`]/)?.[1]
    ?? text.match(/\broute\s*[:=]\s*['"`]([^'"`]+)['"`]/)?.[1]
    ?? null;
  const name = text.match(/\b(?:name|title|describe)\s*\(\s*['"`]([^'"`]+)['"`]/)?.[1]
    ?? basename(text).replace(/\.(spec|golden)\.\w+$/, '');
  const assertions = [...text.matchAll(/toMatchSnapshot|toEqual|toBe|toContain|toHaveText|toHaveAccessibleName/g)].length;
  return { route, name, assertions };
}

try {
  const context = await browser.newContext();
  for (const spec of specs) {
    const rel = relative(PROJECT, spec);
    const text = readFileSync(spec, 'utf8');
    const { route, name, assertions } = parseSpec(text);
    const snapPath = join(snapshotDir, `${basename(spec).replace(/\.\w+$/, '')}.txt`);
    const record = { spec: rel, name, route, assertions, status: 'error', detail: null, snapshot: relative(PROJECT, snapPath) };
    runner.specs_run += 1;

    if (assertions === 0) {
      record.status = 'error';
      record.detail = 'no assertion found in the spec. A test that cannot fail protects nothing.';
      runner.errors += 1;
      runner.results.push(record);
      continue;
    }
    if (!route) {
      record.status = 'error';
      record.detail = 'no route found in the spec. Nothing to load.';
      runner.errors += 1;
      runner.results.push(record);
      continue;
    }

    const page = await context.newPage();
    let observed = null;
    try {
      const res = await page.goto(String(BASE_URL).replace(/\/$/, '') + route, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
      if (!res || res.status() >= 400) {
        record.status = 'failed';
        record.detail = `route returned ${res ? res.status() : 'no response'}`;
      } else {
        observed = (await page.evaluate(() => document.body?.innerText ?? '')).replace(/\s+/g, ' ').trim();
        if (UPDATE) {
          mkdirSync(snapshotDir, { recursive: true });
          writeFileSync(snapPath, observed + '\n', 'utf8');
          record.status = 'updated';
          runner.passed += 1;
        } else if (!existsSync(snapPath)) {
          record.status = 'failed';
          record.detail = 'no snapshot exists. Run with --update to record the current behaviour, then review the diff.';
        } else {
          const expected = readFileSync(snapPath, 'utf8').replace(/\s+/g, ' ').trim();
          if (expected === observed) {
            record.status = 'passed';
            runner.passed += 1;
          } else {
            record.status = 'failed';
            const e = expected.split(' '), o = observed.split(' ');
            const firstDiff = o.findIndex((w, i) => w !== e[i]);
            record.detail = `behaviour changed at word ${firstDiff < 0 ? o.length : firstDiff}: expected "${(e[firstDiff] ?? '')}", got "${(o[firstDiff] ?? '')}"`;
            record.expected_excerpt = expected.slice(Math.max(0, (firstDiff < 0 ? 0 : firstDiff) * 8), Math.max(0, (firstDiff < 0 ? 0 : firstDiff) * 8) + 120);
            record.observed_excerpt = observed.slice(Math.max(0, (firstDiff < 0 ? 0 : firstDiff) * 8), Math.max(0, (firstDiff < 0 ? 0 : firstDiff) * 8) + 120);
          }
        }
      }
    } catch (e) {
      record.status = 'error';
      record.detail = e.message.split('\n')[0];
      runner.errors += 1;
    } finally {
      await page.close();
    }

    if (record.status === 'failed') runner.failed += 1;
    runner.results.push(record);
  }
  runner.executed = true;
} finally {
  await browser.close();
}

runner.result = runner.failed > 0 ? 'failed' : (runner.errors > 0 ? 'errored' : 'passed');
report();
process.exit(runner.failed > 0 || runner.errors > 0 ? 1 : 0);

function report() {
  if (AS_JSON) {
    console.log(JSON.stringify(runner, null, 2));
    return;
  }
  console.log('=== golden tests ===');
  console.log(`suite: ${runner.suite}  base_url: ${runner.base_url ?? 'none'}`);
  if (runner.notes.length) for (const n of runner.notes) console.log(`note: ${n}`);
  if (runner.specs_found === 0) {
    console.log(`0 specs found. Nothing ran. This is not a pass.`);
    return;
  }
  for (const r of runner.results) {
    const mark = { passed: 'ok  ', failed: 'FAIL', updated: 'upd ', error: 'ERR ' }[r.status] ?? '?   ';
    console.log(`  ${mark} ${r.name}${r.route ? `  [${r.route}]` : ''}${r.detail ? '  — ' + r.detail : ''}`);
  }
  console.log(`\n${runner.passed} passed, ${runner.failed} failed, ${runner.errors} errored of ${runner.specs_found} spec(s).`);
  if (UPDATE && runner.failed === 0) {
    console.log('Snapshots were rewritten. Review the diff before committing it: a snapshot updated without a read is not a verification.');
  }
}
