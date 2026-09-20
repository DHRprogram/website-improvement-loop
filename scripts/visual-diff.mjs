#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const ROUTES = (process.env.ROUTES || '/').split(',').map(s => s.trim());
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = resolve(process.argv[2] || 'artifacts/VISUAL_DIFF');
mkdirSync(OUT, { recursive: true });

const beforeDir = resolve(OUT + '/before');
mkdirSync(beforeDir, { recursive: true });

// Check if pixelmatch is available
let pixelmatch = null;
try { pixelmatch = require.resolve('pixelmatch'); } catch (e) { 
  console.log('[VISUAL-DIFF] pixelmatch not installed — run: npm i -D pixelmatch');
  process.exit(0);
}
const { default: pixelmatchFn } = await import('pixelmatch');
const { PNG } = await import('pngjs');

async function main() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });

  for (const route of ROUTES) {
    const slug = route.replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/^-|-$/g, '') || 'home';
    const url = route.startsWith('http') ? route : BASE_URL.replace(/\/+$/, '') + route;
    
    // Take new screenshot
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.screenshot({ path: join(OUT, slug + '.png'), fullPage: true });
    await ctx.close();

    // Compare with baseline
    const baseline = join(beforeDir, slug + '.png');
    if (!existsSync(baseline)) {
      console.log('[VISUAL-DIFF] No baseline for ' + route + ' — saved as baseline');
      const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const p2 = await ctx2.newPage();
      await p2.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await p2.screenshot({ path: baseline, fullPage: true });
      await ctx2.close();
      continue;
    }

    const img1 = PNG.sync.read(readFileSync(baseline));
    const img2 = PNG.sync.read(readFileSync(join(OUT, slug + '.png')));
    const { width, height } = img1;
    if (img2.width !== width || img2.height !== height) {
      console.log('[VISUAL-DIFF] Dimension mismatch for ' + route + ' — skip diff');
      continue;
    }
    const diff = new PNG({ width, height });
    const diffPixels = pixelmatchFn(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
    writeFileSync(join(OUT, slug + '-diff.png'), PNG.sync.write(diff));
    console.log('[VISUAL-DIFF] ' + route + ': ' + diffPixels + ' different pixels');
  }
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
