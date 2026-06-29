#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const token = process.env.VERCEL_TOKEN;

function redact(args) {
  return args.map((arg, index) => args[index - 1] === '--token' ? '[redacted]' : arg);
}

function diagnoseLimit(output) {
  if (!/api-deployments-free-per-day|Resource is limited|try again in 24 hours/i.test(output)) return false;
  console.error('\n❌ Vercel deployment quota reached.');
  console.error('   Vercel accepted the local build, but refused deployment upload because this account/project exceeded the free daily deployment API limit.');
  console.error('   This cannot be solved by more Git pushes or another deploy command right now.');
  console.error('   Wait for the 24-hour window to reset, upgrade/adjust the Vercel plan, or deploy to another Vercel account/project with available quota.');
  return true;
}

function run(command, args, options = {}) {
  console.log(`\n▶ ${command} ${redact(args).join(' ')}`);
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false, ...options });
  if (result.stdout) process.stdout.write(result.stdout.replaceAll(token || '', '[redacted]'));
  if (result.stderr) process.stderr.write(result.stderr.replaceAll(token || '', '[redacted]'));
  if (result.status !== 0) {
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    diagnoseLimit(output);
    process.exit(result.status || 1);
  }
}

if (!token) {
  console.error('Missing VERCEL_TOKEN. Direct Vercel sync requires a Vercel token.');
  console.error('Set it in Codespaces secrets or export it in this shell, then rerun npm run vercel:direct.');
  process.exit(2);
}

console.log('== xDisputer direct Vercel production sync ==');
console.log(`Commit: ${sha}`);
console.log('This bypasses Git auto-deploy by building locally and uploading a prebuilt production deployment.');

run('npx', ['--yes', 'vercel', 'pull', '--yes', '--environment=production', '--token', token]);
run('npx', ['--yes', 'vercel', 'build', '--prod', '--token', token]);

if (!existsSync('.vercel/output')) {
  console.error('Missing .vercel/output after vercel build. Direct deploy cannot continue.');
  process.exit(1);
}

run('npx', ['--yes', 'vercel', 'deploy', '--prebuilt', '--prod', '--archive=tgz', '--token', token, '--env', `XDISPUTER_DEPLOY_COMMIT=${sha}`]);

console.log('\nDirect Vercel deploy finished. Verify the production URL or Vercel Dashboard deployment commit.');
