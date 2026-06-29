#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (existsSync('scripts/apply-user-error-flyout-wiring.mjs')) {
  execSync('node scripts/apply-user-error-flyout-wiring.mjs', { stdio: 'inherit' });
}

const file = 'components/LetterGeneratorWorkspaceV2.tsx';
let source = readFileSync(file, 'utf8');
let changed = false;

function replaceOnce(before, after, label) {
  if (!source.includes(before)) return false;
  source = source.replace(before, after);
  changed = true;
  console.log(`Repaired ${label}.`);
  return true;
}

replaceOnce(
  '[round, caseId, parsed.name, routes, effectiveRefs, templates: effectiveTemplates, evidence, preflight, docs.length, orderedZip, filings.length]',
  '[round, caseId, parsed.name, routes, effectiveRefs, effectiveTemplates, evidence, preflight, docs.length, orderedZip, filings.length]',
  'LetterGeneratorWorkspaceV2 dependency array'
);

replaceOnce(
  "    const manifest = files.map((item) => ({ path: item.path, type: item.type, role: item.role, bureau: item.bureau, sequence: item.sequence, count: item.count, detail: item.detail }));\n    addOrderedPacketFolders(zip, files.map((item) => ({ path: item.path, blob: item.blob })), { date, clientName: parsed.name || 'Client', round, manifest, notes, sourceData: source });\n    return await zip.generateAsync({ type: 'blob' });",
  "    const manifest = files.map((item) => ({ path: item.path, type: item.type, role: item.role, bureau: item.bureau, sequence: item.sequence, count: item.count, detail: item.detail }));\n    const manifestJson = generationManifestText(buildGenerationManifest({\n      round,\n      parsed,\n      routes,\n      references: refs,\n      templates,\n      outputs: files.map((item, index) => normalizeGeneratedOutputForManifest({ id: item.id, path: item.path, type: item.type, role: item.role, bureau: item.bureau, sequence: item.sequence, count: item.count }, index)),\n      warnings: notes\n    }));\n    addOrderedPacketFolders(zip, files.map((item) => ({ path: item.path, blob: item.blob })), { date, clientName: parsed.name || 'Client', round, manifest, notes, sourceData: source });\n    zip.file('generation-manifest.json', manifestJson);\n    return await zip.generateAsync({ type: 'blob' });",
  'generation-manifest.json archive output'
);

if (changed) {
  writeFileSync(file, source);
} else {
  console.log('LetterGeneratorWorkspaceV2 repair not needed.');
}
