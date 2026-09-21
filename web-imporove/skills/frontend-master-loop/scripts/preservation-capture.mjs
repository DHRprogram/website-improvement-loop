#!/usr/bin/env node

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';

const OUT_DIR = resolve('artifacts/redesign/preservation');

function ensureDir() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
}

function captureScreenshot(url, outPath) {
  if (existsSync(outPath)) return { status: 'exists', path: outPath };
  try {
    const result = spawnSync('npx', ['playwright', 'screenshot', '--url', url, '--output', outPath], { encoding: 'utf-8', timeout: 30000 });
    if (result.status === 0) return { status: 'captured', path: outPath };
    return { status: 'failed', error: result.stderr };
  } catch (e) {
    return { status: 'failed', error: e.message };
  }
}

function captureMetrics(url) {
  const result = spawnSync('npx', ['lighthouse', url, '--output=json', '--chrome-flags=--headless'], { encoding: 'utf-8', timeout: 60000 });
  if (result.status !== 0) {
    return { lcp_ms: 0, cls_score: 0, inp_ms: 0, error: result.stderr };
  }
  try {
    const lines = result.stdout.split('\n').filter(l => l.trim());
    const lhr = JSON.parse(lines[lines.length - 1]);
    return {
      lcp_ms: lhr.audits?.['largest-contentful-paint']?.numericValue || 0,
      cls_score: lhr.audits?.['cumulative-layout-shift']?.numericValue || 0,
      inp_ms: lhr.audits?.['max-potential-fid']?.numericValue || 0,
    };
  } catch {
    return { lcp_ms: 0, cls_score: 0, inp_ms: 0 };
  }
}

function main() {
  const args = process.argv.slice(2);
  const routes = args.includes('--routes') ? args[args.indexOf('--routes') + 1].split(',') : ['/'];
  const baseUrl = args.includes('--base-url') ? args[args.indexOf('--base-url') + 1] : 'http://localhost:3000';
  const dryRun = args.includes('--dry-run');

  ensureDir();
  const results = [];

  for (const route of routes) {
    const url = `${baseUrl}${route}`;
    const slug = route === '/' ? 'index' : route.replace(/^\//, '').replace(/\//g, '_');
    const desktopPath = resolve(OUT_DIR, `${slug}-desktop.png`);
    const mobilePath = resolve(OUT_DIR, `${slug}-mobile.png`);
    const metricsPath = resolve(OUT_DIR, `${slug}-metrics.json`);

    if (dryRun) {
      console.log(`[DRY RUN] Would capture: ${url} -> ${slug}`);
      results.push({ route, url, slug, status: 'dry-run' });
      continue;
    }

    const desktop = captureScreenshot(url, desktopPath);
    const mobile = captureScreenshot(`${url}?viewport=mobile`, mobilePath);
    const metrics = captureMetrics(url);

    writeFileSync(metricsPath, JSON.stringify({ route, url, ...metrics, captured_at: new Date().toISOString() }, null, 2));

    results.push({ route, url, slug, desktop: desktop.status, mobile: mobile.status, metrics: metricsPath });
  }

  writeFileSync(resolve(OUT_DIR, 'CAPTURE_LOG.json'), JSON.stringify(results, null, 2));
  console.log(`Captured ${results.length} routes.`);
}

main();
