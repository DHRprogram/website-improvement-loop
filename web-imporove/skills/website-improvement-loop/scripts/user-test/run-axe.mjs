#!/usr/bin/env node
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BASE_URL = process.env.AXE_BASE_URL || process.argv[2];
const routes = process.env.AXE_ROUTES ? process.env.AXE_ROUTES.split(',').map(s => s.trim()) : process.argv.slice(3);
const OUT = resolve(process.env.AXE_OUT || 'artifacts/USER_TEST/axe');

if (!BASE_URL || routes.length === 0) {
  console.error('Usage: node run-axe.mjs <baseUrl> <route1> [route2 etc]');
  console.error('Or set AXE_BASE_URL and AXE_ROUTES env vars');
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const MODES = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'zoom200', viewport: { width: 720, height: 450 }, isMobile: false, hasTouch: false }
];

function slug(str) { return str.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').toLowerCase().replace(/^-|-$/g, ''); }

async function main() {
  const browser = await chromium.launch({ headless: true });
  const impactMap = { critical: 'P0', serious: 'P1', moderate: 'P2', minor: 'P3' };
  const allViolations = {};

  try {
    for (const route of routes) {
      for (const mode of MODES) {
        const context = await browser.newContext({
          viewport: mode.viewport, isMobile: mode.isMobile, hasTouch: mode.hasTouch, deviceScaleFactor: 1
        });
        const page = await context.newPage();
        const url = route.startsWith('http') ? route : BASE_URL.replace(/\/+$/, '') + route;
        console.log('[axe] scanning: ' + url + ' [' + mode.name + ']');

        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
          if (mode.isMobile) {
            const menuSelectors = [
              'button[aria-label*="menu" i]', 'button[aria-label*="navigation" i]',
              'button:has-text("Menu")', '[role="button"][aria-label*="menu" i]'
            ];
            for (const sel of menuSelectors) {
              const btn = await page.$(sel);
              if (btn && await btn.isVisible()) { await btn.click().catch(() => {}); await page.waitForTimeout(500); break; }
            }
          }
          const { default: AxeBuilder } = await import('@axe-core/playwright');
          const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
          writeFileSync(join(OUT, slug(route) + '-' + mode.name + '.json'), JSON.stringify(results, null, 2));

          for (const v of results.violations || []) {
            const sev = impactMap[v.impact] || 'P3';
            const key = v.id + '::' + (v.impact || 'unknown');
            if (!allViolations[key]) {
              allViolations[key] = { rule: v.id, impact: v.impact || 'unknown', severity: sev, help: v.help || '', helpUrl: v.helpUrl || '', wcag: (v.tags || []).filter(t => t.startsWith('wcag')).join(', '), target: '', sample_html: '', failure: '', routes: new Set(), modes: new Set() };
            }
            allViolations[key].routes.add(route);
            allViolations[key].modes.add(mode.name);
            if (v.nodes && v.nodes.length > 0) {
              const n = v.nodes[0];
              allViolations[key].target = (n.target || []).join(', ');
              allViolations[key].sample_html = (n.html || '').slice(0, 200);
              allViolations[key].failure = n.failureSummary || '';
            }
          }
          console.log('  ' + (results.violations ? results.violations.length : 0) + ' violations');
        } catch (err) {
          console.error('  Error on ' + url + ' (' + mode.name + '): ' + err.message);
          allViolations['error::' + slug(route) + '-' + mode.name] = { rule: 'page-error', impact: 'critical', severity: 'P1', help: 'Page load or analysis error: ' + err.message, helpUrl: '', wcag: '', target: url, sample_html: '', failure: err.message, routes: new Set([route]), modes: new Set([mode.name]) };
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }

  const violations = Object.values(allViolations).map(v => ({
    rule: v.rule, impact: v.impact, severity: v.severity, help: v.help, helpUrl: v.helpUrl, wcag: v.wcag,
    target: v.target, sample_html: v.sample_html, failure: v.failure,
    routes: [...v.routes].sort(), modes: [...v.modes].sort()
  }));

  const bySeverity = {}, byRule = {};
  violations.forEach(v => { bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1; byRule[v.rule] = (byRule[v.rule] || 0) + 1; });

  const summary = { generated_at: new Date().toISOString(), base_url: BASE_URL, routes_tested: routes, modes: MODES.map(m => m.name), tags: TAGS, total_violations: violations.length, by_severity: bySeverity, by_rule: byRule, violations };
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('[OK] summary.json (' + violations.length + ' violations)');

  const p0Count = bySeverity['P0'] || 0;
  let p12Md = '# P12 Accessibility Audit\n\nGenerated: ' + summary.generated_at + '\nBase: ' + BASE_URL + '\nRoutes: ' + routes.join(', ') + '\nModes: ' + MODES.map(m => m.name).join(', ') + '\nTags: ' + TAGS.join(', ') + '\n\n## Summary\n\nTotal violations: ' + violations.length + '\n\n### By Severity\n\n| Severity | Count |\n|----------|-------|\n';
  Object.entries(bySeverity).sort((a, b) => parseInt(a[0][1]) - parseInt(b[0][1])).forEach(([sev, cnt]) => { p12Md += '| ' + sev + ' | ' + cnt + ' |\n'; });
  p12Md += '\n### Violations\n\n| Severity | Rule | Impact | Target | Routes | Fix Hint |\n|----------|------|--------|--------|--------|----------|\n';
  violations.forEach(v => { p12Md += '| ' + v.severity + ' | ' + v.rule + ' | ' + v.impact + ' | ' + v.target.slice(0, 60) + ' | ' + v.routes.join(', ') + ' | ' + v.help.slice(0, 100) + ' |\n'; });
  writeFileSync(join(OUT, 'P12_A11Y.md'), p12Md);
  console.log('[OK] P12_A11Y.md');
  if (p0Count > 0) { console.error('[FAIL] ' + p0Count + ' critical violations found — halting'); process.exit(1); }
}

main().catch(err => { console.error(err); process.exit(1); });
