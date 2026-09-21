#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, extname } from 'path';

const OUT_DIR = resolve('artifacts/redesign/specs');

function ensureDir() { if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true }); }

function walkDir(dir, pattern, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) { walkDir(full, pattern, results); }
    else if (entry.name.match(pattern)) results.push(full);
  }
  return results;
}

function extractRoutes(srcDir) {
  const routes = [];
  const pageFiles = walkDir(srcDir, /\.(tsx|jsx|ts|js)$/);
  for (const f of pageFiles) {
    const content = readFileSync(f, 'utf-8').slice(0, 2000);
    const pathMatch = content.match(/path:\s*['"]([^'"]+)['"]/);
    const routeMatch = content.match(/Route.*path=['"]([^'"]+)['"]/);
    const fileRoute = f.replace(resolve(srcDir), '').replace(/\/page\.(tsx|jsx)$/, '').replace(/\/index\.(tsx|jsx)$/, '/');
    routes.push({
      file: f.replace(process.cwd() + '/', ''),
      inferred_route: fileRoute,
      declared_path: pathMatch?.[1] || routeMatch?.[1] || null,
    });
  }
  return routes;
}

function extractComponents(srcDir) {
  const components = [];
  const tsxFiles = walkDir(srcDir, /\.(tsx|jsx)$/);
  for (const f of tsxFiles) {
    const content = readFileSync(f, 'utf-8');
    const exportMatch = content.match(/export\s+(default\s+)?function\s+(\w+)/);
    const arrowMatch = content.match(/export\s+(default\s+)?const\s+(\w+)/);
    const name = exportMatch?.[2] || arrowMatch?.[2] || null;
    if (name) {
      components.push({ name, file: f.replace(process.cwd() + '/', ''), lines: content.split('\n').length });
    }
  }
  return components;
}

function extractDesignTokens(srcDir) {
  const tokens = { colors: [], spacing: [], typography: [], shadows: [] };
  const cssFiles = walkDir(srcDir, /\.(css|scss)$/);
  for (const f of cssFiles) {
    const content = readFileSync(f, 'utf-8');
    const colorMatches = content.matchAll(/--[\w-]+:\s*#[0-9a-fA-F]{3,8}/g);
    for (const m of colorMatches) tokens.colors.push(m[0]);
    const spaceMatches = content.matchAll(/--[\w-]+(space|spacing|gap)[\w-]*:\s*[\d.]+(px|rem|em)/gi);
    for (const m of spaceMatches) tokens.spacing.push(m[0]);
  }
  // Check tailwind config
  const twFiles = walkDir(resolve(srcDir, '..'), /tailwind\.config\./);
  for (const f of twFiles) {
    const content = readFileSync(f, 'utf-8');
    if (content.includes('colors:')) tokens.colors.push('tailwind config colors found');
    if (content.includes('spacing:')) tokens.spacing.push('tailwind config spacing found');
  }
  return tokens;
}

function main() {
  const args = process.argv.slice(2);
  const srcDir = args.includes('--src') ? resolve(args[args.indexOf('--src') + 1]) : resolve('src');
  const dryRun = args.includes('--dry-run');
  ensureDir();

  if (!existsSync(srcDir)) { console.log(`Source dir not found: ${srcDir}. Create empty spec.`); return; }

  const routeMap = extractRoutes(srcDir);
  const componentTree = extractComponents(srcDir);
  const designTokens = extractDesignTokens(srcDir);

  if (dryRun) {
    console.log(`[DRY RUN] Routes: ${routeMap.length}, Components: ${componentTree.length}`);
    return;
  }

  writeFileSync(resolve(OUT_DIR, 'ROUTE_MAP.json'), JSON.stringify(routeMap, null, 2));
  writeFileSync(resolve(OUT_DIR, 'COMPONENT_TREE.json'), JSON.stringify(componentTree, null, 2));
  writeFileSync(resolve(OUT_DIR, 'DESIGN_TOKEN_SPEC.json'), JSON.stringify(designTokens, null, 2));
  console.log(`Specs extracted: ${routeMap.length} routes, ${componentTree.length} components.`);
}

main();
