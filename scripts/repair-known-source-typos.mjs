#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const repairs = [
  {
    path: 'lib/supplemental-template-renderer.ts',
    pattern: /\bs\.sn\b/g,
    replacement: 's.ssn',
    label: 'supplemental renderer SSN typo'
  }
];

let changed = false;

for (const repair of repairs) {
  if (!existsSync(repair.path)) {
    console.log(`Skipped missing file: ${repair.path}`);
    continue;
  }

  const before = readFileSync(repair.path, 'utf8');
  const after = before.replace(repair.pattern, repair.replacement);

  if (after !== before) {
    writeFileSync(repair.path, after);
    changed = true;
    console.log(`Repaired ${repair.label}: ${repair.path}`);
  } else {
    console.log(`No known typo found: ${repair.path}`);
  }
}

console.log(changed ? 'Known source typo repair completed.' : 'No known source typo repairs were needed.');
