#!/usr/bin/env node
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BASE_URL = process.env.BASE_URL || process.argv[2] || 'http://localhost:3000';
const OUT = resolve(process.argv[3] || 'artifacts/FUZZER');
mkdirSync(OUT, { recursive: true });

const VARIANTS = [
  { label: 'future date', value: '2099-12-31' },
  { label: 'past date', value: '1900-01-01' },
  { label: 'invalid email', value: 'notanemail' },
  { label: 'SQL injection', value: "'; DROP TABLE users; --" },
  { label: 'very long text', value: 'A'.repeat(10000) },
  { label: 'special chars', value: '<script>alert(1)</script>' },
  { label: 'negative number', value: '-999' },
  { label: 'float', value: '3.1415926535897932384626433832795' },
  { label: 'zero', value: '0' },
  { label: 'empty string', value: '' },
  { label: 'whitespace', value: '   ' },
  { label: 'unicode RTL', value: '‫SECRET‬' },
  { label: 'emoji spam', value: '😀😁😂🤣😃😄😅😆😉😊😋😎😍' },
  { label: 'newline injection', value: 'line1\nline2\r\nline3' },
  { label: 'duplicate', value: 'test@test.com' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Find all forms on the page
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  const formActions = await page.locator('form').evaluateAll(forms => 
    forms.map(f => ({ action: f.action || f.baseURI || '?', method: f.method || 'get', fields: Array.from(f.querySelectorAll('input, textarea, select')).map(el => ({ name: el.name || el.id || '', type: el.type || 'text', placeholder: el.placeholder || '' })) }))
  );
  console.log('[FUZZER] Found ' + formActions.length + ' forms');

  for (const [fi, form] of formActions.entries()) {
    for (const variant of VARIANTS) {
      try {
        const ctx2 = await browser.newContext();
        const p2 = await ctx2.newPage();
        await p2.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
        
        for (const field of form.fields) {
          try {
            const el = field.name ? p2.locator('[name="' + field.name + '"],#' + field.name).first() : null;
            if (el && await el.isVisible()) await el.fill(variant.value);
          } catch (e) {}
        }
        
        const submitBtn = p2.locator('button[type="submit"], input[type="submit"]').first();
        let accepted = false, error = '';
        if (await submitBtn.isVisible()) {
          try { await submitBtn.click({ timeout: 5000 }); accepted = true; } catch (e) { error = e.message.slice(0, 100); }
        }
        
        results.push({ form_idx: fi, form_action: form.action.slice(0, 60), variant: variant.label, value_preview: variant.value.slice(0, 30), accepted, error });
        if (accepted) console.log('[FUZZER] Form ' + fi + ' accepted variant "' + variant.label + '"');
        await ctx2.close();
      } catch (e) {}
    }
  }
  await browser.close();

  const accepted = results.filter(r => r.accepted);
  const report = { generated_at: new Date().toISOString(), forms_tested: formActions.length, variants: VARIANTS.length, total_tests: results.length, accepted_count: accepted.length, results: accepted.slice(0, 100) };
  writeFileSync(join(OUT, 'fuzzer-report.json'), JSON.stringify(report, null, 2));
  console.log('[FUZZER] Report: ' + accepted.length + '/' + results.length + ' tests accepted (may be false positives)');
}

main().catch(e => { console.error(e); process.exit(1); });
