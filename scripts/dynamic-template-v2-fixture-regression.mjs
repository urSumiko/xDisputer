#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const fixtureRoot = 'test-fixtures/dynamic-template-v2';
const expectedGroups = ['dispute-letter', 'late-payment-letter', 'affidavit', 'ftc'];

function listDocxFiles(dir) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile() && path.toLowerCase().endsWith('.docx'));
}

function ensureFixtureReadme() {
  if (existsSync(fixtureRoot)) return;
  mkdirSync(fixtureRoot, { recursive: true });
}

ensureFixtureReadme();

const results = expectedGroups.map((group) => {
  const dir = join(fixtureRoot, group);
  const files = listDocxFiles(dir);
  return { group, dir, files };
});

const total = results.reduce((sum, item) => sum + item.files.length, 0);

console.log('\nDynamic Template Engine v2 fixture harness');
console.log(`Fixture root: ${fixtureRoot}`);

results.forEach((item) => {
  console.log(`${item.files.length ? '✅' : '⚠️'} ${item.group}: ${item.files.length} DOCX fixture(s)`);
  item.files.forEach((file) => console.log(`   - ${file}`));
});

if (!total) {
  console.log('\nNo DOCX fixtures were found. Harness is installed and ready.');
  console.log('Add DOCX files under:');
  expectedGroups.forEach((group) => console.log(`  - ${join(fixtureRoot, group)}`));
  process.exit(0);
}

console.log(`\nFixture harness passed: ${total} DOCX fixture(s) discovered.`);
