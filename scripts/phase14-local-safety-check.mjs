#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

const conflictPattern = new RegExp('^(<{7}|={7}|>{7})', 'm');
const filesToCheck = [
  'components/GuidedSourceDataFlow.tsx',
  'components/LetterGeneratorWorkspaceV2.tsx',
  'app/api/generation-runs/route.ts',
  'app/api/template-assets/route.ts',
  'app/api/template-assets/file/route.ts',
  'app/api/template-assets/manifest/route.ts',
  'lib/letter-engine.ts',
  'lib/supplemental-template-renderer.ts'
];

const volatileGeneratedPaths = [
  '.next/dev/types',
  '.next/dev/server',
  '.next/dev/static',
  '.next/dev/trace',
  '.next/dev/cache',
  'tsconfig.tsbuildinfo'
];

const sourceTypoGuards = [
  { path: 'lib/supplemental-template-renderer.ts', pattern: /\bs\.sn\b/, message: 'Known source typo found: use s.ssn, not s.sn.' }
];

function fail(message, details = []) {
  console.error('\nPhase 14 local safety check failed.');
  console.error(message);
  details.forEach((line) => console.error(line));
  console.error('\nRecommended repair: inspect the listed files, resolve conflicts, then rerun npm run ui-source:guard.');
  process.exit(1);
}

function cleanVolatileGeneratedArtifacts() {
  const removed = [];
  for (const artifactPath of volatileGeneratedPaths) {
    if (!existsSync(artifactPath)) continue;
    try {
      rmSync(artifactPath, { recursive: true, force: true });
      removed.push(artifactPath);
    } catch (error) {
      fail('Could not clean stale generated artifacts before local checks.', [`  - ${artifactPath}: ${error instanceof Error ? error.message : String(error)}`]);
    }
  }
  if (removed.length) console.log(`Cleaned stale generated artifact(s): ${removed.join(', ')}`);
}

function assertNoKnownSourceTypos() {
  const failures = [];
  for (const guard of sourceTypoGuards) {
    if (!existsSync(guard.path)) continue;
    const source = readFileSync(guard.path, 'utf8');
    if (guard.pattern.test(source)) failures.push(`  - ${guard.path}: ${guard.message}`);
  }
  if (failures.length) fail('Known source typo guard failed. Fix the source file; safety checks must not rewrite code.', failures);
}

function assertNoUnmergedFiles() {
  let unmerged = '';
  try {
    unmerged = execSync('git diff --name-only --diff-filter=U', { encoding: 'utf8' }).trim();
  } catch {
    unmerged = '';
  }
  if (unmerged) fail('Git has unresolved merge conflicts. Resolve them before running typecheck/build.', unmerged.split('\n').map((file) => `  - ${file}`));
}

function assertNoConflictMarkers() {
  const conflictFiles = filesToCheck.filter((file) => existsSync(file) && conflictPattern.test(readFileSync(file, 'utf8')));
  if (conflictFiles.length) fail('Conflict markers were found inside source files.', conflictFiles.map((file) => `  - ${file}`));
}

cleanVolatileGeneratedArtifacts();
console.log('Phase 14 local safety check is running in verification-only mode.');
assertNoKnownSourceTypos();
assertNoUnmergedFiles();
assertNoConflictMarkers();
console.log('Phase 14 local safety check passed.');
