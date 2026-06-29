#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'app/api/template-assets/route.ts';
let source = readFileSync(file, 'utf8');
let changed = false;

function addGovernanceImport() {
  if (source.includes("../../../lib/template-governance")) return;

  const importWithGate = "import { inspectTemplateContract, templateContractGateMessage, type TemplateDocumentKind } from '../../../lib/template-contracts';";
  const importPlain = "import { inspectTemplateContract, type TemplateDocumentKind } from '../../../lib/template-contracts';";
  const governanceImport = "import { buildTemplateGovernance } from '../../../lib/template-governance';";

  if (source.includes(importWithGate)) {
    source = source.replace(importWithGate, `${importWithGate}\n${governanceImport}`);
    changed = true;
    return;
  }

  if (source.includes(importPlain)) {
    source = source.replace(importPlain, `${importPlain}\n${governanceImport}`);
    changed = true;
  }
}

addGovernanceImport();

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

const before = `    const oldAssets = existingAssets.filter((asset) => asset.id !== insert.data.id);
    const cleanup = await deleteAssetRecordsAndFiles(session, oldAssets);

    if (cleanup.warning) {
      return respond(
        request,
        'ok',
        \`${'${round}'} ${'${targetType}'} template saved. Cleanup warning: ${'${cleanup.warning}'}\`,
        200,
        { assetId: insert.data.id, cleanupWarning: cleanup.warning }
      );
    }

    return respond(
      request,
      'ok',
      \`${'${round}'} ${'${targetType}'} template saved. ${'${cleanup.deleted}'} old version(s) removed.\`,
      200,
      { assetId: insert.data.id, oldVersionsRemoved: cleanup.deleted }
    );`;

const after = `    const oldAssets = existingAssets.filter((asset) => asset.id !== insert.data.id);
    if (oldAssets.length) {
      void session.supabase
        .from('template_assets')
        .update({ is_active: false, archived_at: new Date().toISOString() })
        .eq('owner_id', session.user.id)
        .in('id', oldAssets.map((asset) => asset.id));
    }

    return respond(
      request,
      'ok',
      \`${'${round}'} ${'${targetType}'} template saved. Previous version cleanup is running in the background.\`,
      200,
      { assetId: insert.data.id, oldVersionsArchived: oldAssets.length, governance }
    );`;

if (source.includes(before)) {
  source = source.replace(before, after);
  changed = true;
}

writeFileSync(file, source);
console.log(changed ? 'Repaired template upload route for fast response and governance metadata.' : 'Fast template asset route repair not needed or route has already changed.');
