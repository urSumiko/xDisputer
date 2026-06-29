#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const dependencyTargets = ['zod', '@tanstack/react-query'];

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync('package.json')) {
  console.error('modernization-dependency-sync: package.json not found');
  process.exit(1);
}

console.log(`modernization-dependency-sync: syncing ${dependencyTargets.join(', ')}`);
run('npm', ['install', '--package-lock-only', '--ignore-scripts', ...dependencyTargets]);
console.log('modernization-dependency-sync: package.json and package-lock.json synchronized');
console.log('modernization-dependency-sync: run npm install, then npm run typecheck and npm run build');
