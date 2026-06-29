#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process';

const productionUrl = process.env.XDISPUTER_PRODUCTION_URL || 'https://x-disputer.vercel.app';
const pathArg = process.argv[2] || '';
const url = new URL(pathArg.startsWith('/') ? pathArg : `/${pathArg}`, productionUrl);

function runVerify() {
  console.log('== Verify production commit ==');
  execSync('npm run verify:production', { stdio: 'inherit' });
}

function openerCommand() {
  if (process.platform === 'darwin') return ['open', [url.toString()]];
  if (process.platform === 'win32') return ['cmd', ['/c', 'start', '', url.toString()]];
  return ['xdg-open', [url.toString()]];
}

function openBrowser() {
  const [command, args] = openerCommand();
  const result = spawnSync(command, args, { stdio: 'ignore' });
  return result.status === 0;
}

runVerify();

console.log('\n== Open production site ==');
console.log(url.toString());

if (openBrowser()) {
  console.log('✅ Opened production site in the default browser.');
} else {
  console.log('ℹ️ Could not auto-open from this terminal environment. Use the URL above.');
}
