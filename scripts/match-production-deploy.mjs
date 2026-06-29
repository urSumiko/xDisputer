#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process';

const productionUrl = process.env.XDISPUTER_PRODUCTION_URL || 'https://x-disputer.vercel.app';
const maxWaitMs = Number(process.env.XDISPUTER_MATCH_WAIT_MS || 1_800_000);
const pollMs = Number(process.env.XDISPUTER_MATCH_POLL_MS || 30_000);
const allowDirectDeploy = process.env.XDISPUTER_MATCH_DIRECT === '1';
const skipQuality = process.env.XDISPUTER_MATCH_SKIP_QUALITY === '1';
const localSha = sh('git rev-parse HEAD');
const shortSha = localSha.slice(0, 7);

function sh(command) {
  return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(command, args, options = {}) {
  console.log(`\n▶ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false, stdio: 'inherit', ...options });
  if (result.status !== 0) process.exit(result.status || 1);
}

function repoSlug() {
  const remote = sh('git remote get-url origin');
  return remote.match(/github\.com[:/](.+?\/.+?)(?:\.git)?$/i)?.[1] || 'Arisu-art/xDisputer';
}

function workingTreeStatus() {
  return sh('git status --short');
}

function isRateLimited(status) {
  const target = String(status?.target_url || '');
  const description = String(status?.description || '');
  return target.includes('build-rate-limit') || /rate limit|try again in 24 hours/i.test(description);
}

async function readCommitStatus() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers = {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  const response = await fetch(`https://api.github.com/repos/${repoSlug()}/commits/${localSha}/status`, { headers });
  if (!response.ok) return null;
  const payload = await response.json();
  const statuses = Array.isArray(payload.statuses) ? payload.statuses : [];
  return statuses.find((item) => String(item.context || '').toLowerCase().includes('vercel')) || null;
}

async function readProductionSha() {
  const endpoint = `${productionUrl.replace(/\/$/, '')}/api/system/build-info?ts=${Date.now()}`;
  const response = await fetch(endpoint, { cache: 'no-store' });
  if (!response.ok) throw new Error(`build-info returned HTTP ${response.status}`);
  const payload = await response.json();
  return {
    sha: String(payload.gitCommitSha || 'unknown'),
    env: String(payload.vercelEnv || 'unknown')
  };
}

async function verifyOnce() {
  const deployed = await readProductionSha();
  const matched = deployed.sha === localSha;
  console.log(`Production: ${deployed.sha} (${deployed.env})`);
  console.log(`Local HEAD: ${localSha}`);
  if (matched) console.log(`✅ Production matches local HEAD ${shortSha}.`);
  return matched;
}

function explainRateLimit(status) {
  console.error('\n❌ Vercel is rate-limited for this commit.');
  console.error('   This is not a code/build failure. GitHub has the commit, but Vercel refused to create/update the production deployment.');
  if (status?.description) console.error(`   Vercel: ${status.description}`);
  if (status?.target_url) console.error(`   URL: ${status.target_url}`);
  console.error('\nSafe options:');
  console.error('   1. Wait for the Vercel limit window, then rerun: npm run production:match');
  console.error('   2. If you have VERCEL_TOKEN and quota available, run: XDISPUTER_MATCH_DIRECT=1 npm run production:match');
  console.error('   3. Upgrade/adjust the Vercel plan or deploy to a project/account with available quota.');
}

console.log('== xDisputer production match automation ==');
console.log(`Target:     ${productionUrl}`);
console.log(`Local HEAD: ${localSha}`);
console.log(`Timeout:    ${Math.round(maxWaitMs / 1000)}s`);

const statusText = workingTreeStatus();
if (statusText) {
  console.log('\n== Local working tree has uncommitted files ==');
  console.log(statusText);
  console.log('Continuing because production matching is commit-based. Commit intentional source changes before expecting production to include them.');
}

if (!skipQuality) {
  run('npm', ['run', 'typecheck']);
  run('npm', ['run', 'build']);
}

if (await verifyOnce().catch(() => false)) process.exit(0);

const firstStatus = await readCommitStatus();
if (firstStatus?.state === 'failure' || firstStatus?.state === 'error') {
  if (isRateLimited(firstStatus)) {
    explainRateLimit(firstStatus);
    if (!allowDirectDeploy) process.exit(3);
    if (!process.env.VERCEL_TOKEN) {
      console.error('\nMissing VERCEL_TOKEN. Direct deploy cannot run.');
      process.exit(3);
    }
    console.log('\nAttempting direct prebuilt Vercel production deploy because XDISPUTER_MATCH_DIRECT=1 is set.');
    run('npm', ['run', 'vercel:direct']);
  } else {
    console.error('\n❌ Vercel marked this commit as failed. Open Vercel Deployments for build logs.');
    if (firstStatus.description) console.error(`   ${firstStatus.description}`);
    if (firstStatus.target_url) console.error(`   ${firstStatus.target_url}`);
    process.exit(1);
  }
}

const startedAt = Date.now();
while (Date.now() - startedAt <= maxWaitMs) {
  try {
    if (await verifyOnce()) process.exit(0);
  } catch (error) {
    console.log(`Waiting for production endpoint... ${error instanceof Error ? error.message : String(error)}`);
  }

  const status = await readCommitStatus();
  if (status?.state === 'failure' || status?.state === 'error') {
    if (isRateLimited(status)) {
      explainRateLimit(status);
      process.exit(3);
    }
    console.error('\n❌ Vercel deployment failed while waiting.');
    if (status.description) console.error(`   ${status.description}`);
    if (status.target_url) console.error(`   ${status.target_url}`);
    process.exit(1);
  }

  console.log(`Waiting ${Math.round(pollMs / 1000)}s before checking again...`);
  await sleep(pollMs);
}

console.error('\n❌ Production did not match local HEAD before timeout.');
console.error('   Rerun npm run production:match after the Vercel deployment completes or after the rate limit resets.');
process.exit(1);
