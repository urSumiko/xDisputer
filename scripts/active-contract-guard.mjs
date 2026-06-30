#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function requireText(path, fragments) {
  const text = read(path);
  if (!text) throw new Error(`Missing required file: ${path}`);
  for (const fragment of fragments) {
    if (!text.includes(fragment)) throw new Error(`${path} is missing required fragment: ${fragment}`);
  }
  console.log(`OK: ${path}`);
}

const pkg = JSON.parse(read('package.json') || '{}');
for (const scriptName of ['connections:doctor', 'connection-inheritance:guard', 'active:sync', 'active:sync:db', 'xdisputer:guard']) {
  if (!pkg.scripts?.[scriptName]) throw new Error(`Missing package script: ${scriptName}`);
  console.log(`OK: package script ${scriptName}`);
}

requireText('docs/active-context-binding.md', ['urSumiko/xDisputer', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']);
requireText('docs/active-connector-inheritance.md', ['urSumiko/xDisputer', 'manual SQL bundle', 'xdisputer-active-sync.sh']);
requireText('docs/xdisputer-active-sync-runbook.md', ['urSumiko/xDisputer', 'docs/xdisputer-connection-validation.sql']);
requireText('scripts/xdisputer-active-sync.sh', ['urSumiko/xDisputer', 'manual Supabase SQL bundle']);
requireText('scripts/active-sync-db-no-cli.mjs', ['manual Supabase sync bundle', 'manual-supabase-sync.latest.sql']);
requireText('docs/xdisputer-connection-validation.sql', ['access_workspace_account_summary_v1(uuid)', 'Expected: eight rows']);

console.log('\nActive contract guard passed.');
