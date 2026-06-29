#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const failures = [];
const scannedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const ignoredDirs = new Set(['.git', '.next', 'node_modules', '.xdisputer-cache', 'coverage', 'dist', 'build']);
const candidateExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css'];
const indexExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];

function walk(dir, files = []) {
  const fullDir = join(ROOT, dir);
  if (!existsSync(fullDir)) return files;

  for (const entry of readdirSync(fullDir)) {
    if (ignoredDirs.has(entry)) continue;
    const fullPath = join(fullDir, entry);
    const relative = normalize(fullPath.slice(ROOT.length + 1)).replaceAll('\\', '/');
    const stats = statSync(fullPath);
    if (stats.isDirectory()) walk(relative, files);
    else if (scannedExtensions.has(extname(relative))) files.push(relative);
  }

  return files;
}

function read(file) {
  return readFileSync(join(ROOT, file), 'utf8');
}

function importSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /import\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /export\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }

  return [...specifiers];
}

function isRelative(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

function resolveRelative(fromFile, specifier) {
  const base = join(ROOT, dirname(fromFile), specifier);
  const checks = [];

  if (extname(base)) checks.push(base);
  for (const extension of candidateExtensions) checks.push(`${base}${extension}`);
  for (const extension of indexExtensions) checks.push(join(base, `index${extension}`));

  return checks.some((candidate) => existsSync(candidate));
}

for (const file of walk('.')) {
  const source = read(file);
  for (const specifier of importSpecifiers(source)) {
    if (!isRelative(specifier)) continue;
    if (!resolveRelative(file, specifier)) failures.push(`${file} imports missing module ${specifier}`);
  }
}

if (failures.length) {
  console.error(`module-existence-guard failed: ${failures.length} missing relative import(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('module-existence-guard: ok');
