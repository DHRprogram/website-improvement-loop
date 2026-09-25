#!/usr/bin/env node
// preservation-capture.mjs — record what a system does, before it is replaced.
//
//   node preservation-capture.mjs --project=. --base-url=URL [--routes=a,b]
//                                 [--out FILE] [--dry-run] [--json]
//
// Writes a capture of the observable surface: route responses, visible text,
// headings, form fields and the accessible tree. After a migration, running the
// same capture and diffing the two files is the answer to "did this change
// anything?" — a question a screenshot cannot answer.
//
// Playwright is optional. Without it the script still performs the static half
// and says clearly that the dynamic half did not run. It never reports an empty
// capture as a successful one.

import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
};

const PROJECT = resolve(String(arg('project', process.cwd())));
const BASE_URL = arg('base-url', process.env.WIL_BASE_URL ?? null);
const OUT = arg('out', 'artifacts/website-loop/PRESERVATION.json');
const DRY = Boolean(arg('dry-run', false));
const AS_JSON = Boolean(arg('json', false));
const TIMEOUT_MS = Number(arg('timeout', 20000));

if (!existsSync(PROJECT)) {
  console.error(`preservation-capture: '${PROJECT}' does not exist`);
  process.exit(2);
}

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'artifacts']);

/** Static pass: the routes that exist in source, with no server needed. */
function discoverRoutes(dir, acc = [], depth = 0) {
  if (depth > 8 || acc.length > 500) return acc;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.well-known') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP.has(e.name)) continue;
      discoverRoutes(p, acc, depth + 1);
    } else if (e.isFile()) {
      const m = p.match(/(?:app|pages)\/([\w[\].-]+)\/(?:route|page)\.(?:tsx?|jsx?)$/);
      if (m) {
        const route = '/' + m[1]
          .replace(/\[\.\.\.(\w+)\]/g, '*')
          .replace(/\[(\w+)\]/g, ':$1')
          .replace(/\/index$/, '');
        if (!acc.includes(route)) acc.push(route);
      }
    }
  }
  return acc;
}

const staticRoutes = discoverRoutes(PROJECT).sort();
const capture = {
  $comment: 'Observable behaviour before a migration. Compare two captures to measure preservation_delta; anything that differs and was not intended is a regression.',
  generated_at: new Date().toISOString(),
  project: relative(resolve(PROJECT, '..'), PROJECT) || '.',
  base_url: BASE_URL ? String(BASE_URL) : null,
  static_routes: staticRoutes,
  static_route_count: staticRoutes.length,
  dynamic: {
    ran: false,
    reason: null,
    pages: [],
  },
  notes: [],
};

if (!BASE_URL) {
  capture.dynamic.reason = 'no --base-url was given, so no page was loaded. The static route list is real; the dynamic capture did not run.';
  capture.notes.push('This is a partial capture. It is NOT evidence that behaviour is preserved.');
}

async function captureDynamic() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch (e) {
    capture.dynamic.reason = `playwright is not installed: ${e.message.split('\n')[0]}`;
    capture.notes.push('Install the devDependency to capture rendered behaviour.');
    return;
  }
  if (!BASE_URL) return;

  const routes = String(arg('routes', staticRoutes.join(',') || '/')).split(',').map((r) => r.trim()).filter(Boolean);
  const looksProd = /prod|www\.[^./]+\.[a-z]{2,}\/?$/.test(String(BASE_URL));
  if (looksProd) {
    capture.dynamic.reason = `refusing to load ${BASE_URL}: it looks like a production host.`;
    capture.notes.push('A preservation capture must not be taken against production.');
    return;
  }

  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    capture.dynamic.reason = `could not launch a browser: ${e.message.split('\n')[0]}`;
    return;
  }

  try {
    const context = await browser.newContext();
    for (const route of routes.slice(0, 50)) {
      const page = await context.newPage();
      const url = String(BASE_URL).replace(/\/$/, '') + route;
      const record = { route, url, status: null, title: null, headings: [], forms: [], landmarks: [], links: 0, text_length: 0, error: null };
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
        record.status = response ? response.status() : null;
        record.title = await page.title();
        record.headings = await page.$$eval('h1,h2,h3', (ns) => ns.slice(0, 40).map((n) => `${n.tagName}: ${(n.textContent || '').trim().slice(0, 120)}`));
        record.forms = await page.$$eval('form', (fs) => fs.slice(0, 20).map((f) => ({
          name: f.getAttribute('name') || f.id || null,
          fields: Array.from(f.querySelectorAll('input,select,textarea')).map((i) => i.getAttribute('name') || i.id || i.type).filter(Boolean),
        })));
        record.landmarks = await page.$$eval('header,nav,main,footer,[role]', (ns) => [...new Set(ns.slice(0, 40).map((n) => n.getAttribute('role') || n.tagName.toLowerCase()))]);
        record.links = await page.$$eval('a[href]', (as) => as.length);
        const text = await page.evaluate(() => document.body?.innerText ?? '');
        record.text_length = text.trim().length;
      } catch (e) {
        record.error = e.message.split('\n')[0];
      } finally {
        await page.close();
      }
      capture.dynamic.pages.push(record);
    }
    capture.dynamic.ran = true;
  } finally {
    await browser.close();
  }
}

if (!DRY) {
  await captureDynamic();
}

if (DRY) {
  console.error('[dry-run] nothing written.');
  if (AS_JSON) console.log(JSON.stringify(capture, null, 2));
  else {
    console.log(`[dry-run] would capture ${staticRoutes.length} static route(s) from ${PROJECT}`);
    console.log(`[dry-run]   dynamic pass: ${BASE_URL ? 'would load each route' : 'skipped, no --base-url'}`);
    if (BASE_URL) console.log(`[dry-run]   playwright:    ${capture.dynamic.reason ?? 'available'}`);
  }
  process.exit(0);
}

const outPath = resolve(PROJECT, String(OUT));
mkdirSync(resolve(outPath, '..'), { recursive: true });
writeFileSync(outPath, JSON.stringify(capture, null, 2) + '\n', 'utf8');
console.log(`[OK] ${relative(PROJECT, outPath)} — ${capture.static_route_count} static route(s), dynamic pass ${capture.dynamic.ran ? 'ran' : 'SKIPPED'}`);
if (!capture.dynamic.ran) {
  console.warn(`[warn] ${capture.dynamic.reason}`);
  console.warn('[warn] This capture is partial and is not evidence of preserved behaviour.');
}
process.exit(0);
