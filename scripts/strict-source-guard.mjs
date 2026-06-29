#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const guardedPaths = [
  'app/api/generation-runs/route.ts',
  'app/api/template-assets/route.ts',
  'components/GuidedSourceDataFlow.tsx',
  'components/LetterGeneratorWorkspaceV2.tsx',
  'lib/letter-engine.ts'
];

const conflictPattern = /<<<<<<<|=======|>>>>>>>/;
let failed = false;

for (const file of guardedPaths) {
  let source = '';
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  if (conflictPattern.test(source)) {
    console.error(`\n[STRICT SOURCE GUARD] Merge conflict markers found in ${file}.`);
    console.error('Resolve the conflict before running typecheck/build.');
    failed = true;
  }
}

try {
  const conflicted = execFileSync('git', ['diff', '--name-only', '--diff-filter=U'], { encoding: 'utf8' }).trim();
  if (conflicted) {
    console.error('\n[STRICT SOURCE GUARD] Git still has unmerged files:');
    console.error(conflicted);
    failed = true;
  }
} catch {
  // Ignore environments without git; source marker scan above still protects builds.
}

if (failed) {
  console.error('\nRecommended local repair for this project:');
  console.error('git restore --source=origin/main --staged --worktree components/GuidedSourceDataFlow.tsx');
  console.error('git diff --name-only --diff-filter=U');
  process.exit(1);
}

console.log('Strict source guard passed.');
