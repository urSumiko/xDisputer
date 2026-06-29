#!/usr/bin/env node
import { execSync } from 'node:child_process';

const sha = process.argv[2] || execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
const slug = remote.match(/github\.com[:/](.+?\/.+?)(?:\.git)?$/i)?.[1] || 'Arisu-art/xDisputer';
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const headers = {
  Accept: 'application/vnd.github+json',
  ...(token ? { Authorization: `Bearer ${token}` } : {})
};

const response = await fetch(`https://api.github.com/repos/${slug}/commits/${sha}/status`, { headers });
if (!response.ok) {
  console.error(`Could not read GitHub commit status for ${sha}: HTTP ${response.status}`);
  process.exit(1);
}

const payload = await response.json();
const statuses = Array.isArray(payload.statuses) ? payload.statuses : [];
const vercel = statuses.find((item) => String(item.context || '').toLowerCase().includes('vercel'));

console.log('== Vercel commit status ==');
console.log(`Commit: ${sha}`);
console.log(`Overall: ${payload.state || 'unknown'}`);

if (!vercel) {
  console.log('No Vercel status found on this commit. Git auto-deploy may be disabled, not connected, or not created yet.');
  process.exit(2);
}

console.log(`Vercel state: ${vercel.state}`);
if (vercel.description) console.log(`Description:  ${vercel.description}`);
if (vercel.target_url) console.log(`Target URL:    ${vercel.target_url}`);

if (String(vercel.target_url || '').includes('build-rate-limit')) {
  console.log('\nDiagnosis: Vercel build-rate-limit. The pushed code is in GitHub, but Vercel is refusing/limiting production builds.');
  console.log('Action: wait for the limit window, upgrade/adjust Vercel plan, or use direct CLI deploy if available.');
}

process.exit(vercel.state === 'success' ? 0 : 1);
