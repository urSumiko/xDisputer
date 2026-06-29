#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

function cleanFile(path, cleaners) {
  let source = readFileSync(path, 'utf8');
  const before = source;
  for (const clean of cleaners) source = clean(source);
  if (source !== before) {
    writeFileSync(path, source);
    console.log(`Cleaned duplicate generation blocker wiring in ${path}.`);
  } else {
    console.log(`No duplicate generation blocker wiring found in ${path}.`);
  }
}

cleanFile('components/GuidedSourceDataFlow.tsx', [
  (source) => source.replace(/(?:generationBlockers\?: string\[\];\s*){2,}/g, 'generationBlockers?: string[]; '),
  (source) => source.replace(/(?:generationBlockers = \[\],\s*){2,}/g, 'generationBlockers = [], '),
  (source) => source.replace(/(?:aria-describedby=\{blocked \? "generation-blocked-reasons" : undefined\}\s*){2,}/g, 'aria-describedby={blocked ? "generation-blocked-reasons" : undefined} ')
]);

cleanFile('components/LetterGeneratorWorkspaceV2.tsx', [
  (source) => source.replace(/(?:generationBlockers=\{preflight\.blockers\.map\(\(item\) => item\.detail\)\}\s*){2,}/g, 'generationBlockers={preflight.blockers.map((item) => item.detail)} ')
]);
