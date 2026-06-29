#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'app/api/template-assets/route.ts';
let source = readFileSync(file, 'utf8');
let changed = false;

const originalImport = "import { inspectTemplateContract, type TemplateDocumentKind } from '../../../lib/template-contracts';";
const gatedImport = "import { inspectTemplateContract, templateContractGateMessage, type TemplateDocumentKind } from '../../../lib/template-contracts';";
if (source.includes(originalImport)) {
  source = source.replace(originalImport, gatedImport);
  changed = true;
}

const marker = '    const contract = await inspectTemplateContract(file, kind);\n';
const gate = `    const contract = await inspectTemplateContract(file, kind);\n    const gateMessage = templateContractGateMessage(contract);\n    if (gateMessage) {\n      return respond(request, 'error', gateMessage, 422, { contract });\n    }\n`;
if (source.includes(marker) && !source.includes('templateContractGateMessage(contract)')) {
  source = source.replace(marker, gate);
  changed = true;
}

if (changed) {
  writeFileSync(file, source);
  console.log('Repaired template upload gate with hardened contract validation.');
} else {
  console.log('Template contract gate repair not needed.');
}
