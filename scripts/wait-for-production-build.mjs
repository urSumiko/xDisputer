#!/usr/bin/env node
import { execSync } from 'node:child_process';

const productionUrl = process.env.XDISPUTER_PRODUCTION_URL || 'https://x-disputer.vercel.app';
const maxWaitMs = Number(process.env.XDISPUTER_VERIFY_WAIT_MS || 180_000);
const pollMs = Number(process.env.XDISPUTER_VERIFY_POLL_MS || 15_000);
const localSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const shortLocalSha = localSha.slice(0, 7);
const startedAt = Date.now();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function repoSlug() {
  const remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
  const match = remote.match(/github\.com[:/](.+?\/.+?)(?:\.git)?$/i);
  return match?.[1] || 'Arisu-art/xDisputer';
}

async function readBuildInfo() {
  const endpoint = `${productionUrl.replace(/\/$/, '')}/api/system/build-info?ts=${Date.now()}`;
  const response = await fetch(endpoint, { cache: 'no-store' });
  if (!response.ok) throw new Error(`build-info returned HTTP ${response.status}`);
  return response.json();
}

async function readCommitStatus() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers = {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  const response = await fetch(`https://api.github.com/repos/${repoSlug()}/commits/${localSha}/status`, { headers });
  if (!response.ok) return null;
  return response.json();
}

function vercelStatus(statusPayload) {
  const statuses = Array.isArray(statusPayload?.statuses) ? statusPayload.statuses : [];
  return statuses.find((item) => String(item.context || '').toLowerCase().includes('vercel')) || null;
}

function explainFailure(status) {
  const target = String(status?.target_url || '');
  const description = String(status?.description || '');
  if (target.includes('build-rate-limit') || description.toLowerCase().includes('rate limit')) {
    return [
      'Vercel rejected the deployment because the account/project hit a build rate limit.',
      'This is a Vercel quota/plan limit, not a code or Git problem.',
      'Use Vercel Dashboard → Deployments to confirm the failed deployment, wait for the limit window to reset, upgrade/adjust the plan, or use the direct CLI deploy path if your Vercel account allows it.'
    ];
  }
  return [
    'Vercel marked the pushed commit as failed.',
    `Vercel target URL: ${target || 'not provided'}`,
    description ? `Vercel description: ${description}` : 'Open Vercel → Deployments for logs.'
  ];
}

console.log('== xDisputer wait for production deployment ==');
console.log(`Target URL: ${productionUrl}`);
console.log(`Local HEAD: ${localSha}`);
console.log(`Timeout:    ${Math.round(maxWaitMs / 1000)}s`);

while (Date.now() - startedAt <= maxWaitMs) {
  const statusPayload = await readCommitStatus().catch(() => null);
  const status = vercelStatus(statusPayload);

  if (status?.state === 'failure' || status?.state === 'error') {
    console.error('❌ Vercel deployment failed for the pushed commit. Stopping instead of waiting forever.');
    for (const line of explainFailure(status)) console.error(`   ${line}`);
    process.exit(1);
  }

  try {
    const payload = await readBuildInfo();
    const deployedSha = String(payload.gitCommitSha || 'unknown');

    if (deployedSha === localSha) {
      console.log(`✅ Production now matches local HEAD ${shortLocalSha}.`);
      process.exit(0);
    }

    const stateText = status?.state ? ` status=${status.state}` : '';
    console.log(`Waiting for Vercel... deployed=${deployedSha.slice(0, 7)} target=${shortLocalSha}${stateText}`);
  } catch (error) {
    console.log(`Waiting for Vercel... ${error instanceof Error ? error.message : String(error)}`);
  }

  await sleep(pollMs);
}

console.error('❌ Production did not update to the pushed commit before timeout.');
console.error(`   Local HEAD: ${localSha}`);
console.error('   If Vercel status is pending, the build is still queued. If it is missing, Git auto-deploy may be disabled or rate-limited.');
console.error('   Run: npm run vercel:status');
process.exit(1);
