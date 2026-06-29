#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const routePath = 'app/api/generation-runs/route.ts';
let source = readFileSync(routePath, 'utf8');
const before = "insert({ owner_id: userResult.user.id, client_name: clientName, round_label: round, manifest_json: manifest, output_status: status })";
const after = "insert({ owner_id: userResult.user.id, client_name: clientName, round_label: round, manifest_json: manifest, output_status: status, per_output_pay: perOutputPay })";

if (source.includes(after)) {
  console.log('generation route already persists per_output_pay.');
  process.exit(0);
}

if (!source.includes(before)) {
  console.error('Could not find the expected generation_runs insert statement. Inspect app/api/generation-runs/route.ts manually.');
  process.exit(1);
}

source = source.replace(before, after);
writeFileSync(routePath, source);
console.log('Patched generation_runs insert to persist per_output_pay.');
