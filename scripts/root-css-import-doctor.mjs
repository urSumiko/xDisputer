#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const layoutPath = 'app/layout.tsx';
const shouldRepair = process.argv.includes('--repair');
const failures = [];

function absolute(path) {
  return join(ROOT, path);
}

function read(path) {
  const fullPath = absolute(path);
  if (!existsSync(fullPath)) return '';
  return readFileSync(fullPath, 'utf8');
}

function walk(dir, predicate, files = []) {
  const fullDir = absolute(dir);
  if (!existsSync(fullDir)) return files;

  for (const entry of readdirSync(fullDir)) {
    const fullPath = join(fullDir, entry);
    const relative = fullPath.slice(ROOT.length + 1).replaceAll('\\', '/');
    const stats = statSync(fullPath);
    if (stats.isDirectory()) walk(relative, predicate, files);
    else if (predicate(relative)) files.push(relative);
  }

  return files;
}

function collectRequiredRootCssImports() {
  const cssFiles = new Set();
  const patterns = [
    /must\(layout,\s*['"]import '\.\/([^'"]+\.css)';['"]/g,
    /has\(\s*['"]app\/layout\.tsx['"]\s*,\s*['"]import '\.\/([^'"]+\.css)';['"]\s*\)/g,
    /app\/layout\.tsx must include import '\.\/([^']+\.css)';/g
  ];

  for (const script of walk('scripts', (file) => file.endsWith('.mjs'))) {
    const source = read(script);
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) cssFiles.add(match[1]);
    }
  }

  return [...cssFiles].sort();
}

function insertCssImports(layout, missingCssFiles) {
  const imports = missingCssFiles.map((cssFile) => `import './${cssFile}';`).join('\n');
  const cssImportMatches = [...layout.matchAll(/^import '\.\/[^']+\.css';$/gm)];

  if (cssImportMatches.length) {
    const lastCssImport = cssImportMatches[cssImportMatches.length - 1];
    const insertAt = (lastCssImport.index ?? 0) + lastCssImport[0].length;
    return `${layout.slice(0, insertAt)}\n${imports}${layout.slice(insertAt)}`;
  }

  const firstImportMatch = layout.match(/^import .*$/m);
  if (firstImportMatch && typeof firstImportMatch.index === 'number') {
    return `${layout.slice(0, firstImportMatch.index)}${imports}\n${layout.slice(firstImportMatch.index)}`;
  }

  return `${imports}\n${layout}`;
}

const layout = read(layoutPath);
if (!layout) failures.push(`Missing required file: ${layoutPath}`);

const requiredCssFiles = collectRequiredRootCssImports();
const missingCssFiles = [];

for (const cssFile of requiredCssFiles) {
  if (!existsSync(absolute(`app/${cssFile}`))) {
    failures.push(`Required CSS file is missing: app/${cssFile}`);
    continue;
  }

  if (!layout.includes(`import './${cssFile}';`)) {
    missingCssFiles.push(cssFile);
  }
}

if (failures.length) {
  console.error(`root-css-import-doctor failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (!missingCssFiles.length) {
  console.log('root-css-import-doctor: ok');
  process.exit(0);
}

console.error('root-css-import-doctor found missing root CSS import(s):');
for (const cssFile of missingCssFiles) console.error(`- import './${cssFile}';`);

if (!shouldRepair) {
  console.error('\nRun `node scripts/root-css-import-doctor.mjs --repair` to update app/layout.tsx.');
  process.exit(1);
}

const repaired = insertCssImports(layout, missingCssFiles);
writeFileSync(absolute(layoutPath), repaired);
console.log(`root-css-import-doctor: repaired ${missingCssFiles.length} missing import(s) in ${layoutPath}.`);
