#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'app/api/template-assets/route.ts';
let source = readFileSync(file, 'utf8');
let changed = false;

if (!source.includes("buildTemplateGovernance")) {
  source = source.replace(
    "import { inspectTemplateContract, type TemplateDocumentKind } from '../../../lib/template-contracts';",
    "import { inspectTemplateContract, type TemplateDocumentKind } from '../../../lib/template-contracts';\nimport { buildTemplateGovernance } from '../../../lib/template-governance';"
  );
  changed = true;
}

if (!source.includes('const governance = buildTemplateGovernance(contract);')) {
  source = source.replace(
    '    const contract = await inspectTemplateContract(file, kind);',
    '    const contract = await inspectTemplateContract(file, kind);\n    const governance = buildTemplateGovernance(contract);'
  );
  changed = true;
}

if (!source.includes('validation_json: governance,')) {
  source = source.replace(
    '        contract_json: contract,\n        rule_json: {',
    '        contract_json: contract,\n        validation_json: governance,\n        rule_json: {'
  );
  changed = true;
}

if (!source.includes('archived_at: new Date().toISOString()')) {
  source = source.replace(
    "        .update({ is_active: false })",
    "        .update({ is_active: false, archived_at: new Date().toISOString() })"
  );
  changed = true;
}

writeFileSync(file, source);
console.log(changed ? 'Integrated template governance into template asset uploads.' : 'Template governance integration already present.');
