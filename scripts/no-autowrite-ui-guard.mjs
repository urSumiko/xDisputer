#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const scripts = packageJson.scripts || {};
const failures = [];
const forbiddenAutowriteScripts = [
  'apply-manager-workspace-nav-wiring.mjs',
  'apply-user-error-flyout-wiring.mjs',
  'apply-manager-template-storage-wiring.mjs',
  'apply-manager-template-ui-wiring.mjs',
  'apply-manager-template-workspace-state-wiring.mjs',
  'apply-manager-template-generation-wiring.mjs'
];

const guardBundleRunner = existsSync('scripts/guard-bundle-runner.mjs')
  ? readFileSync('scripts/guard-bundle-runner.mjs', 'utf8')
  : '';

for (const [name, command] of Object.entries(scripts)) {
  if (name.startsWith('ai:')) continue;
  if (name === 'ui-source:guard') continue;
  for (const forbidden of forbiddenAutowriteScripts) {
    if (String(command).includes(forbidden)) failures.push(`${name} still runs ${forbidden}`);
  }
}

function usesExplicitVerificationChain(command) {
  const value = String(command || '');
  return value.includes('phase14-local-safety-check.mjs') && value.includes('ui-source:guard');
}

function preflightBundleIsVerificationOnly() {
  return guardBundleRunner.includes("preflight: [") &&
    guardBundleRunner.includes("scripts/phase14-local-safety-check.mjs") &&
    guardBundleRunner.includes("['bundle', ['ui-source']]") &&
    guardBundleRunner.includes("scripts/console-roadmap-guard.mjs") &&
    guardBundleRunner.includes("scripts/template-execution-guard.mjs");
}

function usesCachedVerificationBundle(command) {
  const value = String(command || '');
  return value.includes('guard-bundle-runner.mjs preflight') && preflightBundleIsVerificationOnly();
}

function isVerificationOnlyLifecycle(command) {
  return usesExplicitVerificationChain(command) || usesCachedVerificationBundle(command);
}

if (!isVerificationOnlyLifecycle(scripts.predev)) failures.push('predev must run verification-only safety and UI guards.');
if (!isVerificationOnlyLifecycle(scripts.pretypecheck)) failures.push('pretypecheck must run verification-only safety and UI guards.');
if (!isVerificationOnlyLifecycle(scripts.prebuild)) failures.push('prebuild must run verification-only safety and UI guards.');

if (failures.length) {
  console.error('\nNo-autowrite UI guard failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('No-autowrite UI guard passed. Normal dev/typecheck/build scripts are verification-only.');
