#!/usr/bin/env node
import { execSync } from 'node:child_process';

const productionUrl = process.env.XDISPUTER_PRODUCTION_URL || 'https://x-disputer.vercel.app';
const endpoint = `${productionUrl.replace(/\/$/, '')}/api/system/build-info?ts=${Date.now()}`;
const localSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const shortLocalSha = localSha.slice(0, 7);

console.log(`== xDisputer production build verification ==`);
console.log(`Local HEAD: ${localSha}`);
console.log(`Endpoint:   ${endpoint}`);

async function main() {
  const response = await fetch(endpoint, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Production build-info endpoint returned HTTP ${response.status}. Deploy the latest main branch first.`);
  }

  const payload = await response.json();
  const deployedSha = String(payload.gitCommitSha || 'unknown');

  console.log(`Vercel env: ${payload.vercelEnv || 'unknown'}`);
  console.log(`Deployed:   ${deployedSha}`);

  if (deployedSha === localSha) {
    console.log(`✅ Production matches local HEAD ${shortLocalSha}.`);
    return;
  }

  console.error(`❌ Production does not match local HEAD.`);
  console.error(`   Local:    ${localSha}`);
  console.error(`   Deployed: ${deployedSha}`);
  console.error(`   Open Vercel Deployments and confirm the newest main deployment completed successfully.`);
  process.exit(1);
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
