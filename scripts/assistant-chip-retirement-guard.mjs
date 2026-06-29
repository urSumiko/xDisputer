#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const failures = [];
const roots = ['app', 'components', 'lib', 'src', 'scripts'];
const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css']);
const dynamicChip = 'OutputLimit' + 'ResetChip';
const staticChip = 'Static' + 'Entitlement' + 'Chip';
const chipClass = 'output-limit' + '-reset-chip';
const chipMain = 'output-limit' + '-chip-main';
const staticClass = 'performance-static' + '-entitlement-chip';
const assistPhrase = 'AI ' + 'assistant layer';
const adaptiveA = 'adaptive' + '-center';
const adaptiveB = 'adaptive' + '-launch';
const retiredPaths = [
  'app/api/' + 'ai/route.ts',
  'lib/' + 'ai',
  'components/AdaptiveCommandCenter.tsx',
  'components/OutputLimitResetChip.tsx',
  'app/output-limit-chip.css',
  'middleware.ts',
  'scripts/repair-dashboard-visible-output-chip.mjs',
  'scripts/repair-letter-workspace-header-chip.mjs'
];
const retiredMarkers = [dynamicChip, staticChip, chipClass, chipMain, staticClass, assistPhrase, adaptiveA, adaptiveB];

function walk(dir, output = []) {
  if (!existsSync(dir)) return output;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (path.includes('node_modules') || path.includes('.next')) continue;
    const info = statSync(path);
    if (info.isDirectory()) walk(path, output);
    else if (exts.has(extname(path))) output.push(path);
  }
  return output;
}

for (const path of retiredPaths) {
  if (existsSync(path)) failures.push('retired path still exists: ' + path);
}

for (const file of roots.flatMap((root) => walk(root))) {
  if (file.endsWith('assistant-chip-retirement-guard.mjs')) continue;
  if (file.endsWith('finalize-retired-surface-cleanup.mjs')) continue;
  if (file.endsWith('repo-rearchitecture-roadmap-guard.mjs')) continue;
  const source = readFileSync(file, 'utf8');
  for (const marker of retiredMarkers) {
    if (source.includes(marker)) failures.push(file + ' still contains retired marker: ' + marker);
  }
}

if (failures.length) {
  console.error('assistant-chip-retirement-guard failed: ' + failures.length + ' check(s).');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}

console.log('assistant-chip-retirement-guard: ok');
