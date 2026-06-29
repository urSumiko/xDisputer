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

function listPolicyScripts() {
  return listFiles('scripts', (file) => file.endsWith('.mjs'));
}

function checkNotificationSchemaPolicy() {
  const contract = read('src/features/notifications/notification-ui-contract.ts');
  const readService = read('lib/notifications/notification-service.ts');
  const writeService = read('lib/notifications/notification-write-service.ts');
  const scripts = listPolicyScripts();
  const strictMode = contract.includes('strict-canonical-columns');

  if (!strictMode) {
    fail('notification schema policy must be strict-canonical-columns before notification guards run.');
    return;
  }

  const forbiddenServiceMarkers = [
    'missingOptionalColumn',
    'isMissingOptionalColumn',
    'fallbackSelect',
    'MinimalNotificationRow',
    'canonical-read-with-compatibility-fallback'
  ];

  for (const marker of forbiddenServiceMarkers) {
    if (readService.includes(marker) || writeService.includes(marker) || contract.includes(marker)) {
      fail(`notification strict schema policy contradicts leftover fallback marker: ${marker}`);
    }
  }

  for (const file of scripts) {
    const source = read(file);
    const staleFallbackRequirements = [
      'notification reads must tolerate optional column drift',
      'notification writes must tolerate optional column drift',
      "must(readService, 'missingOptionalColumn'",
      "must(writeService, 'isMissingOptionalColumn'"
    ];

    for (const marker of staleFallbackRequirements) {
      if (source.includes(marker)) {
        fail(`${file} still requires notification fallback policy while notification contract is strict canonical.`);
      }
    }
  }
}

function collectLayoutCssRequirements(source) {
  const required = [];
  const patterns = [
    /must\(layout,\s*['"]import '\.\/([^'"]+\.css)';['"]/g,
    /has\(\s*['"]app\/layout\.tsx['"]\s*,\s*['"]import '\.\/([^'"]+\.css)';['"]\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      required.push(match[1]);
    }
  }

  return required;
}

function checkRootCssImportContracts() {
  const layout = read('app/layout.tsx');
  const scripts = listPolicyScripts();
  const requiredImports = new Map();

  for (const file of scripts) {
    const source = read(file);
    for (const cssFile of collectLayoutCssRequirements(source)) {
      requiredImports.set(cssFile, file);
    }
  }

  for (const [cssFile, scriptFile] of requiredImports) {
    const importLine = `import './${cssFile}';`;
    if (!existsSync(join(ROOT, 'app', cssFile))) {
      fail(`${scriptFile} requires missing root CSS file app/${cssFile}.`);
      continue;
    }
    if (!layout.includes(importLine)) {
      fail(`${scriptFile} requires root layout CSS import: ${importLine}`);
    }
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
    if (locked[name] !== range) {
      fail(`package-lock root drift: ${name} package.json=${range} package-lock=${locked[name] || 'missing'}`);
    }
    if (!lock.packages?.[`node_modules/${name}`]) {
      fail(`package-lock missing package entry: node_modules/${name}`);
    }
  }
}

function checkGuardBundleCoverage() {
  const runner = read('scripts/guard-bundle-runner.mjs');
  if (!runner.includes('scripts/guard-policy-canvas-guard-v2.mjs')) {
    warn('guard-policy-canvas-guard-v2 is not wired into guard-bundle-runner.mjs yet.');
  }
  if (!runner.includes('scripts/guard-policy-consistency.mjs')) {
    warn('guard-policy-consistency is not wired into guard-bundle-runner.mjs yet.');
  }
}

checkNotificationSchemaPolicy();
checkRootCssImportContracts();
checkPackageLockPolicy();
checkGuardBundleCoverage();

if (warnings.length) {
  for (const message of warnings) console.warn(`WARN: ${message}`);
}

if (failures.length) {
  console.error(`guard-policy-consistency failed: ${failures.length} check(s).`);
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log('guard-policy-consistency: ok');
