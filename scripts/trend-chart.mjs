#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = resolve(process.argv[2] || 'metrics');
const out = process.argv[3] || 'artifacts/TREND.svg';

if (!existsSync(dir)) { console.error('No metrics dir at ' + dir); process.exit(0); }

const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
if (files.length < 2) { console.log('Need ≥2 metrics files for a trend chart'); process.exit(0); }

const points = files.map(f => {
  try {
    const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    return { label: d.label, date: (d.date || '').slice(0, 10), bundle: d.bundle_kb, todos: d.todos, deps: d.deps };
  } catch (e) { return null; }
}).filter(Boolean);

const maxBundle = Math.max(...points.map(p => p.bundle), 1);
const maxTodos = Math.max(...points.map(p => p.todos), 1);
const w = Math.max(points.length * 80, 400);
const h = 240;

function makePath(values, max, offsetY) {
  const xStep = (w - 60) / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => `${i * xStep + 40},${offsetY - (v / max) * 150}`);
  return '<polyline fill="none" stroke-width="2" points="' + pts.join(' ') + '"/>';
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <style>text { font-family: monospace; font-size: 11px; fill: #333; } polyline { stroke-linejoin: round; }</style>
  <rect width="${w}" height="${h}" fill="#f8f9fa" rx="8"/>
  <text x="20" y="20" font-size="14" font-weight="bold">Metrics Trend</text>
  ${makePath(points.map(p => p.bundle), maxBundle, 200)}
  <text x="40" y="212" fill="#e74c3c" font-size="10">Bundle KB</text>
  ${makePath(points.map(p => p.todos), maxTodos, 200)}
  <text x="160" y="212" fill="#2980b9" font-size="10">Issues</text>
  ${points.map((p, i) => {
    const x = i * (w - 60) / Math.max(points.length - 1, 1) + 40;
    const y = 228;
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="9">' + p.label.slice(0, 6) + '</text>';
  }).join('\n  ')}
</svg>`;
writeFileSync(out, svg);
console.log('[OK] Trend chart: ' + out + ' (' + points.length + ' data points)');
