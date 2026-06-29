#!/usr/bin/env node
import { execSync } from 'node:child_process';

console.log('\n=== Manager visible switch/account guard ===');
console.log('Delegating to the shared console shell source guard.');
execSync('node scripts/console-shell-contract-guard.mjs', { stdio: 'inherit' });
console.log('\n✅ Manager visible switch/account guard passed through shared ConsoleShell contract.');
