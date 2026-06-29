#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const changed = [];
const warnings = [];

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function writeIfChanged(path, before, after) {
  if (before === after) return false;
  writeFileSync(path, after);
  changed.push(path);
  return true;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  return result.status === 0;
}

function readJson(path) {
  return JSON.parse(read(path));
}

function patchActiveConnectorInheritance() {
  const file = 'docs/active-connector-inheritance.md';
  const before = read(file);
  if (!before) {
    warnings.push(`${file} is missing; connector inheritance guard will fail.`);
    return;
  }

  if (before.includes('xdisputer-active-sync.sh')) return;

  const anchor = '## Active local commands\n';
  const insert = '## Active local commands\n\nThe active local runner file is `scripts/xdisputer-active-sync.sh`.\n';
  const after = before.includes(anchor)
    ? before.replace(anchor, insert)
    : `${before.trim()}\n\nActive local runner file: \`scripts/xdisputer-active-sync.sh\`.\n`;

  writeIfChanged(file, before, after);
}

function patchPackageScripts() {
  const file = 'package.json';
  const before = read(file);
  if (!before) {
    warnings.push('package.json is missing; dependency guards will fail.');
    return;
  }

  const pkg = JSON.parse(before);
  pkg.scripts ||= {};
  let didChange = false;

  const requiredScripts = {
    'dependency-lock:doctor': 'node scripts/dependency-lock-doctor.mjs',
    'dependency-lock:repair': 'node scripts/dependency-lock-doctor.mjs --repair'
  };

  for (const [name, command] of Object.entries(requiredScripts)) {
    if (pkg.scripts[name] !== command) {
      pkg.scripts[name] = command;
      didChange = true;
    }
  }

  if (didChange) {
    writeIfChanged(file, before, `${JSON.stringify(pkg, null, 2)}\n`);
  }
}

function collectPackageDependencies(pkg) {
  return {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.optionalDependencies || {})
  };
}

function collectLockRootDependencies(lock) {
  return {
    ...(lock.packages?.['']?.dependencies || {}),
    ...(lock.packages?.['']?.devDependencies || {}),
    ...(lock.packages?.['']?.optionalDependencies || {})
  };
}

function lockNeedsRepair() {
  if (!existsSync('package.json') || !existsSync('package-lock.json')) return false;
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');
  const packageDependencies = collectPackageDependencies(pkg);
  const lockRootDependencies = collectLockRootDependencies(lock);

  return Object.entries(packageDependencies).some(([name, range]) => {
    return lockRootDependencies[name] !== range || !lock.packages?.[`node_modules/${name}`];
  });
}

function repairPackageLockIfNeeded() {
  if (!lockNeedsRepair()) return;
  console.log('package-lock.json is stale. Running lockfile-only npm repair.');
  const ok = run('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund']);
  if (!ok) {
    warnings.push('npm package-lock-only repair failed. Re-run npm install --package-lock-only manually and inspect npm output.');
    return;
  }
  changed.push('package-lock.json');
}

function patchLocalEnvWarning() {
  const file = '.env.local';
  if (!existsSync(file)) return;
  const before = read(file);
  if (/^NEXT_PUBLIC_SITE_URL=.+$/m.test(before)) return;

  const newline = before.endsWith('\n') || before.length === 0 ? '' : '\n';
  const after = `${before}${newline}NEXT_PUBLIC_SITE_URL=http://localhost:3000\n`;
  writeIfChanged(file, before, after);
}

patchActiveConnectorInheritance();
patchPackageScripts();
repairPackageLockIfNeeded();
patchLocalEnvWarning();

if (warnings.length) {
  console.warn('\nWarnings:');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (!changed.length) {
  console.log('OK: no known guard blocker needed repair.');
} else {
  console.log('\nRepaired known guard blocker files:');
  for (const file of [...new Set(changed)]) console.log(`- ${file}`);
}

console.log('\nNext commands:');
console.log('npm ci --no-audit --no-fund');
console.log('npm run connections:doctor');
console.log('npm run xdisputer:guard');
