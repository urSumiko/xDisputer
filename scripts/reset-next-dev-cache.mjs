#!/usr/bin/env node
import { existsSync, mkdirSync, renameSync } from 'node:fs';

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const quarantineRoot = '.next-quarantine';
const targets = ['.next/dev', '.next/cache'];

if (process.env.XD_SKIP_NEXT_RESET === '1') {
  console.log('reset-next-dev-cache: skipped by XD_SKIP_NEXT_RESET=1');
  process.exit(0);
}

if (!existsSync(quarantineRoot)) mkdirSync(quarantineRoot, { recursive: true });

for (const target of targets) {
  if (!existsSync(target)) continue;
  const safeName = target.replace(/[^a-zA-Z0-9_-]/g, '-');
  const destination = `${quarantineRoot}/${safeName}-${stamp}`;
  renameSync(target, destination);
  console.log(`reset-next-dev-cache: moved ${target} to ${destination}`);
}

console.log('reset-next-dev-cache: ready');
