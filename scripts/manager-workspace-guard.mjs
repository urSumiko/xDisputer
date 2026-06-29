#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/template-workspace-contract-guard.mjs'], { stdio: 'inherit' });
console.log('Manager workspace guard passed.');
