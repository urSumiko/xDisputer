#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const failures = [];
const warnings = [];

function read(path) {
  const fullPath = join(ROOT, path);
  if (!existsSync(fullPath)) return '';
  return readFileSync(fullPath, 'utf8');
}

function listFiles(dir, matcher, files = []) {
  const fullDir = join(ROOT, dir);
  if (!existsSync(fullDir)) return files;

  for (const entry of readdirSync(fullDir)) {
    const fullPath = join(fullDir, entry);
    const relative = fullPath.slice(ROOT.length + 1).replaceAll('\\', '/');
    const stats = statSync(fullPath);
    if (stats.isDirectory()) listFiles(relative, matcher, files);
    else if (matcher(relative)) files.push(relative);
  }

  return files;
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function joinText(parts) {
  return parts.join('');
}

function listPolicyScripts() {
  return listFiles('scripts', (file) => file.endsWith('.mjs'));
}

function isPolicyInfrastructureScript(file) {
  return file === 'scripts/guard-policy-consistency.mjs'
    || file === 'scripts/guard-policy-consistency-v2.mjs'
    || file === 'scripts/guard-policy-canvas-guard.mjs'
    || file === 'scripts/guard-policy-canvas-guard-v2.mjs'
    || file === 'scripts/guard-policy-canvas-guard-v3.mjs'
    || file === 'scripts/root-css-import-doctor.mjs';
}

function listDomainPolicyScripts() {
  return listPolicyScripts().filter((file) => !isPolicyInfrastructureScript(file));
}

function fallbackServiceMarkers() {
  return [
    joinText(['missing', 'Optional', 'Column']),
    joinText(['is', 'Missing', 'Optional', 'Column']),
    joinText(['fallback', 'Select']),
    joinText(['Minimal', 'Notification', 'Row']),
    joinText(['canonical-read', '-with-compatibility', '-fallback'])
  ];
}

function staleGuardRequirementMarkers() {
  return [
    joinText(['notification reads', ' must tolerate ', 'optional column drift']),
    joinText(['notification writes', ' must tolerate ', 'optional column drift']),
    joinText(['must(readService, ', "'missing", 'Optional', "Column'"]),
    joinText(['must(writeService, ', "'is", 'Missing', 'Optional', "Column'"])
  ];
}

function checkNotificationSchemaPolicy() {
  const contract = read('src/features/notifications/notification-ui-contract.ts');
  const readService = read('lib/notifications/notification-service.ts');
  const writeService = read('lib/notifications/notification-write-service.ts');

  if (!contract.includes('strict-canonical-columns')) {
    fail('notification schema policy must be strict-canonical-columns before notification guards run.');
    return;
  }

  for (const marker of fallbackServiceMarkers()) {
    if (readService.includes(marker) || writeService.includes(marker) || contract.includes(marker)) {
      fail(`notification strict schema policy contradicts leftover fallback marker: ${marker}`);
    }
  }

  for (const file of listDomainPolicyScripts()) {
    const source = read(file);
    for (const marker of staleGuardRequirementMarkers()) {
      if (source.includes(marker)) {
        fail(`${file} still requires stale notification fallback policy while notification contract is strict canonical.`);
      }
    }
  }
}

function collectLayoutCssRequirements(source) {
  const required = [];
  const patterns = [
    /must\(layout,\s*['"]import '\.\/([^'"]+\.css)';['"]/g,
    /has\(\s*['"]app\/layout\.tsx['"]\s*,\s*['"]import '\.\/([^'"]+\.css)';['"]\s*\)/g,
    /app\/layout\.tsx must include import '\.\/([^']+\.css)';/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) required.push(match[1]);
  }

  return required;
}

function checkRootCssImportContracts() {
  const layout = read('app/layout.tsx');
  const requiredImports = new Map();

  for (const file of listPolicyScripts()) {
    const source = read(file);
    for (const cssFile of collectLayoutCssRequirements(source)) requiredImports.set(cssFile, file);
  }

  for (const [cssFile, scriptFile] of requiredImports) {
    const importLine = `import './${cssFile}';`;
    if (!existsSync(join(ROOT, 'app', cssFile))) {
      fail(`${scriptFile} requires missing root CSS file app/${cssFile}.`);
      continue;
    }
    if (!layout.includes(importLine)) fail(`${scriptFile} requires root layout CSS import: ${importLine}`);
  }
}

function checkPackageLockPolicy() {
  const packageJsonText = read('package.json');
  const packageLockText = read('package-lock.json');
  if (!packageJsonText || !packageLockText) {
    fail('package.json and package-lock.json must both exist.');
    return;
  }

  const pkg = JSON.parse(packageJsonText);
  const lock = JSON.parse(packageLockText);
  const declared = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.optionalDependencies || {})
  };
  const locked = {
    ...(lock.packages?.['']?.dependencies || {}),
    ...(lock.packages?.['']?.devDependencies || {}),
    ...(lock.packages?.['']?.optionalDependencies || {})
  };

  for (const [name, range] of Object.entries(declared)) {
    if (locked[name] !== range) fail(`package-lock root drift: ${name} package.json=${range} package-lock=${locked[name] || 'missing'}`);
    if (!lock.packages?.[`node_modules/${name}`]) fail(`package-lock missing package entry: node_modules/${name}`);
  }
}

function checkGuardBundleCoverage() {
  const runner = read('scripts/guard-bundle-runner.mjs');
  if (!runner.includes('scripts/guard-policy-canvas-guard-v3.mjs')) warn('guard-policy-canvas-guard-v3 is not wired into guard-bundle-runner.mjs yet.');
  if (!runner.includes('scripts/guard-policy-consistency-v2.mjs')) warn('guard-policy-consistency-v2 is not wired into guard-bundle-runner.mjs yet.');
}

checkNotificationSchemaPolicy();
checkRootCssImportContracts();
checkPackageLockPolicy();
checkGuardBundleCoverage();

for (const message of warnings) console.warn(`WARN: ${message}`);

if (failures.length) {
  console.error(`guard-policy-consistency failed: ${failures.length} check(s).`);
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log('guard-policy-consistency: ok');
