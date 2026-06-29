#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';

const port = process.env.PORT || '3000';
const host = '0.0.0.0';
const visibility = process.env.CODESPACES_PORT_VISIBILITY || 'public';
const codespaceName = process.env.CODESPACE_NAME || '';
const previewUrl = codespaceName ? `https://${codespaceName}-${port}.app.github.dev` : `http://localhost:${port}`;

function run(command, args, options = {}) {
  console.log(`\n▶ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false, ...options });
  if (result.status !== 0) process.exit(result.status || 1);
}

function tryRun(command, args) {
  const result = spawnSync(command, args, { stdio: 'pipe', encoding: 'utf8', shell: false });
  return result.status === 0;
}

console.log('== xDisputer Codespaces live preview ==');
console.log('Mode: instant local dev server with hot reload');
console.log(`Port: ${port}`);

run('node', ['scripts/repair-letter-workspace-syntax.mjs']);
run('node', ['scripts/repair-letter-workspace-contracts.mjs']);
run('node', ['scripts/repair-letter-workspace-blob-boundaries.mjs']);
run('node', ['scripts/repair-letter-workspace-header-chip.mjs']);

if (codespaceName) {
  const madePublic = tryRun('gh', ['codespace', 'ports', 'visibility', `${port}:${visibility}`, '-c', codespaceName]);
  console.log(madePublic ? `\nPort ${port} visibility set to ${visibility}.` : `\nCould not auto-set port visibility. Use the Ports tab to set ${port} to ${visibility}.`);
}

console.log('\nOpen this live preview URL:');
console.log(previewUrl);
console.log('\nEvery saved UI change hot-reloads here without waiting for Vercel.');
console.log('Keep this terminal running. Stop with Ctrl+C.');

const child = spawn('npx', ['next', 'dev', '-H', host, '-p', port], {
  stdio: 'inherit',
  shell: false,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }
});

child.on('exit', (code) => process.exit(code || 0));
