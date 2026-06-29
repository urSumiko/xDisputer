#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const packageJsonPath = 'package.json';
const packageLockPath = 'package-lock.json';
const shouldRepair = process.argv.includes('--repair');

function readJson(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing required file: ${path}`);
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${path} is not valid JSON: ${message}`);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  return result.status === 0;
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

function findMismatches(pkg, lock) {
  const packageDependencies = collectPackageDependencies(pkg);
  const lockRootDependencies = collectLockRootDependencies(lock);
  const missingRoot = [];
  const missingPackages = [];
  const versionDrift = [];

  for (const [name, range] of Object.entries(packageDependencies)) {
    if (lockRootDependencies[name] !== range) {
      versionDrift.push({ name, packageRange: range, lockRange: lockRootDependencies[name] || null });
    }

    if (!lockRootDependencies[name]) {
      missingRoot.push(name);
    }

    if (!lock.packages?.[`node_modules/${name}`]) {
      missingPackages.push(name);
    }
  }

  return { missingRoot, missingPackages, versionDrift };
}

function printMismatches(mismatches) {
  if (!mismatches.missingRoot.length && !mismatches.missingPackages.length && !mismatches.versionDrift.length) {
    console.log('OK: package.json and package-lock.json dependency roots are aligned.');
    return;
  }

  console.error('ERROR: package-lock.json is not synchronized with package.json.');

  if (mismatches.missingRoot.length) {
    console.error(`Missing from lock root: ${mismatches.missingRoot.join(', ')}`);
  }

  if (mismatches.missingPackages.length) {
    console.error(`Missing node_modules entries: ${mismatches.missingPackages.join(', ')}`);
  }

  const drift = mismatches.versionDrift.filter((item) => item.lockRange && item.packageRange !== item.lockRange);
  if (drift.length) {
    console.error('Version range drift:');
    for (const item of drift) {
      console.error(`- ${item.name}: package.json=${item.packageRange}, package-lock.json=${item.lockRange}`);
    }
  }
}

try {
  const pkg = readJson(packageJsonPath);
  const lock = readJson(packageLockPath);
  const mismatches = findMismatches(pkg, lock);
  const hasMismatch = mismatches.missingRoot.length || mismatches.missingPackages.length || mismatches.versionDrift.length;

  if (!hasMismatch) {
    printMismatches(mismatches);
    process.exit(0);
  }

  printMismatches(mismatches);

  if (!shouldRepair) {
    console.error('\nRun `node scripts/dependency-lock-doctor.mjs --repair` to update package-lock.json safely before `npm ci`.');
    process.exit(1);
  }

  console.log('\nRepairing package-lock.json with npm package-lock-only install.');
  const repaired = run('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund']);
  if (!repaired) {
    console.error('ERROR: package-lock repair failed. Check npm registry/network access, then rerun.');
    process.exit(1);
  }

  const repairedLock = readJson(packageLockPath);
  const repairedMismatches = findMismatches(pkg, repairedLock);
  const stillBroken = repairedMismatches.missingRoot.length || repairedMismatches.missingPackages.length || repairedMismatches.versionDrift.length;

  if (stillBroken) {
    console.error('\nERROR: package-lock.json is still not synchronized after repair.');
    printMismatches(repairedMismatches);
    process.exit(1);
  }

  console.log('\nOK: package-lock.json repaired. Run `npm ci` next.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
