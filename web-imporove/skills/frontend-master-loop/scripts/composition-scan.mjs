#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, extname, basename, dirname } from 'path';

const ROOT = resolve('.');
const ARTIFACTS_DIR = resolve('artifacts/redesign');
const REGISTRY_PATH = resolve(ARTIFACTS_DIR, 'COMPOSITION_REGISTRY.json');

const PHASES = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R8.5', 'R8.7', 'R9', 'R9.5', 'R10'];

const GLOB_PATTERNS = [
  { pattern: 'skills/*/SKILL.md', kind: 'skill', baseDir: 'skills' },
  { pattern: 'skills/*/agents/*.md', kind: 'agent', baseDir: 'skills' },
  { pattern: 'skills/*/scripts/*.mjs', kind: 'node_script', baseDir: 'skills' },
  { pattern: 'skills/*/scripts/*.sh', kind: 'bash_script', baseDir: 'skills' },
  { pattern: 'skills/*/references/*.md', kind: 'reference', baseDir: 'skills' },
  { pattern: '.claude/commands/**/*.md', kind: 'command', baseDir: '.claude/commands' },
  { pattern: '.claude/agents/**/*.md', kind: 'agent', baseDir: '.claude/agents' },
  { pattern: '.github/workflows/*.yml', kind: 'workflow', baseDir: '.github/workflows' },
];

function scanDir(baseDir, kind) {
  const results = [];
  const absBase = resolve(ROOT, baseDir);
  if (!existsSync(absBase)) return results;

  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) { walk(fullPath); continue; }
      if (kind === 'command') {
        // All .md files in commands tree
        if (entry.name.endsWith('.md')) {
          results.push({ id: entry.name.replace('.md', ''), kind, path: fullPath.replace(ROOT + '/', '') });
        }
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mjs') || entry.name.endsWith('.sh') || entry.name.endsWith('.yml')) {
        results.push({ id: entry.name.replace(/\.(md|mjs|sh|yml)$/, ''), kind, path: fullPath.replace(ROOT + '/', '') });
      }
    }
  }
  walk(absBase);
  return results;
}

function extractFrontmatter(filePath) {
  if (!filePath.endsWith('.md') && !filePath.endsWith('.mjs') && !filePath.endsWith('.sh') && !filePath.endsWith('.yml')) return {};
  try {
    const content = readFileSync(filePath, 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const fm = {};
      for (const line of fmMatch[1].split('\n')) {
        const sep = line.indexOf(':');
        if (sep > 0) {
          const k = line.slice(0, sep).trim();
          let v = line.slice(sep + 1).trim();
          if (v.startsWith('>')) v = v.replace(/^>\s*/, '');
          fm[k] = v;
        }
      }
      return fm;
    }
    return {};
  } catch {
    return {};
  }
}

function mapPhaseToAsset(asset, phases) {
  const desc = (asset.description || '').toLowerCase();
  const name = (asset.id || '').toLowerCase();
  for (const phase of phases) {
    const pname = phase.toLowerCase();
    if (desc.includes(pname) || name.includes(pname)) {
      return phase;
    }
  }
  return null;
}

function main() {
  const allAssets = [];
  for (const rule of GLOB_PATTERNS) {
    const assets = scanDir(rule.baseDir, rule.kind);
    for (const a of assets) {
      const fm = extractFrontmatter(resolve(ROOT, a.path));
      allAssets.push({
        id: a.id,
        kind: a.kind,
        path: a.path,
        description: fm.description || '',
        inputs: fm.inputs ? fm.inputs.split(',').map(s => s.trim()) : [],
        outputs: fm.outputs ? fm.outputs.split(',').map(s => s.trim()) : [],
        callable_via: a.kind === 'command' ? `/${a.id}` : a.kind === 'workflow' ? 'trigger' : a.kind === 'node_script' ? 'node' : 'bash',
      });
    }
  }

  // Also add our own internal agents
  const agentsDir = resolve(ROOT, 'skills/frontend-master-loop/agents');
  if (existsSync(agentsDir)) {
    for (const entry of readdirSync(agentsDir, { withFileTypes: true })) {
      if (entry.name.endsWith('.md')) {
        const fm = extractFrontmatter(resolve(agentsDir, entry.name));
        allAssets.push({
          id: entry.name.replace('.md', ''),
          kind: 'internal_agent',
          path: `skills/frontend-master-loop/agents/${entry.name}`,
          description: fm.description || '',
          inputs: [],
          outputs: [],
          callable_via: 'internal',
        });
      }
    }
  }

  const phasesMapped = {};
  for (const phase of PHASES) {
    const candidates = allAssets.filter(a => mapPhaseToAsset(a, [phase]));
    phasesMapped[phase] = {
      primary: candidates.length > 0 ? { id: candidates[0].id, kind: candidates[0].kind, path: candidates[0].path } : null,
      fallback: { id: `A${phase === 'R0' ? '0' : '11'}`, kind: 'internal_agent', path: `agents/A${phase === 'R0' ? '0' : '11'}-internal.md` },
    };
  }

  const registry = {
    scanned_at: new Date().toISOString(),
    total_assets: allAssets.length,
    phases_mapped: phasesMapped,
    assets: allAssets,
  };

  if (!existsSync(ARTIFACTS_DIR)) mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
  console.log(`Composition registry: ${allAssets.length} assets, ${PHASES.length} phases mapped.`);
}

main();
