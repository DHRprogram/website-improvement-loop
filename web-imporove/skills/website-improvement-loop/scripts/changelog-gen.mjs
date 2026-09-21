#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const inDir = resolve(process.argv[2] || '.');
const out = resolve(process.argv[3] || 'CHANGELOG.generated.md');
const logPath = join(inDir, 'IMPROVEMENT_LOG.md');
const buildLog = join(inDir, 'BUILD_LOG.md');

let md = '# Changelog\n\nGenerated: ' + new Date().toISOString().slice(0, 10) + '\n\n## Improvements\n\n';
if (existsSync(logPath)) {
  const log = readFileSync(logPath, 'utf8');
  const entries = log.split(/\n(?=\d{4}-\d{2}-\d{2}\s)/).slice(0, 50);
  entries.forEach(e => {
    const firstLine = e.split('\n')[0];
    md += '- ' + firstLine + '\n';
    const subItems = e.split('\n').filter(l => l.match(/^- |^\* |^\d+\./));
    subItems.slice(0, 5).forEach(s => { md += '  ' + s + '\n'; });
  });
}

if (existsSync(buildLog)) {
  md += '\n## Built\n\n';
  const log = readFileSync(buildLog, 'utf8');
  log.split('\n').filter(l => l.trim()).slice(0, 30).forEach(l => { md += '- ' + l + '\n'; });
}

writeFileSync(out, md);
console.log('[CHANGELOG] ' + out);
