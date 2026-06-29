#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

function save(path, source, before) {
  if (source !== before) {
    writeFileSync(path, source);
    console.log(`Updated ${path}.`);
  } else {
    console.log(`No changes needed for ${path}.`);
  }
}

const workspacePath = 'components/LetterGeneratorWorkspaceV2.tsx';
let workspace = readFileSync(workspacePath, 'utf8');
const workspaceBefore = workspace;
while (workspace.includes('generationBlockers={preflight.blockers.map((item) => item.detail)} generationBlockers={preflight.blockers.map((item) => item.detail)}')) {
  workspace = workspace.replace('generationBlockers={preflight.blockers.map((item) => item.detail)} generationBlockers={preflight.blockers.map((item) => item.detail)}', 'generationBlockers={preflight.blockers.map((item) => item.detail)}');
}
if (!workspace.includes('generationBlockers={preflight.blockers.map((item) => item.detail)}')) {
  workspace = workspace.replace('canGenerate={preflight.ready && canGenerate} missingLetters=', 'canGenerate={preflight.ready && canGenerate} generationBlockers={preflight.blockers.map((item) => item.detail)} missingLetters=');
}
save(workspacePath, workspace, workspaceBefore);

const flowPath = 'components/GuidedSourceDataFlow.tsx';
let flow = readFileSync(flowPath, 'utf8');
const flowBefore = flow;
while (flow.includes('generationBlockers?: string[]; generationBlockers?: string[];')) {
  flow = flow.replace('generationBlockers?: string[]; generationBlockers?: string[];', 'generationBlockers?: string[];');
}
while (flow.includes('generationBlockers = [], generationBlockers = [],')) {
  flow = flow.replace('generationBlockers = [], generationBlockers = [],', 'generationBlockers = [],');
}
if (!flow.includes('generationBlockers?: string[];')) {
  flow = flow.replace('sourceWarnings: Array<{ message: string }>; evidenceKey: string; evidence: PacketAssets; canGenerate: boolean;', 'sourceWarnings: Array<{ message: string }>; evidenceKey: string; evidence: PacketAssets; canGenerate: boolean; generationBlockers?: string[];');
}
if (!flow.includes('generationBlockers = []')) {
  flow = flow.replace('evidenceKey, evidence, canGenerate, missingLetters,', 'evidenceKey, evidence, canGenerate, generationBlockers = [], missingLetters,');
}
if (!flow.includes('const generationBlockReasons =')) {
  flow = flow.replace(
    '  const blocked = !canGenerate || !evidenceReady || !affidavitReady || !customReady || (strict && missingLetters.length > 0);\n  const showStage',
    '  const blocked = !canGenerate || !evidenceReady || !affidavitReady || !customReady || (strict && missingLetters.length > 0);\n  const generationBlockReasons = Array.from(new Set([...generationBlockers, ...(!evidenceReady ? [\'Upload at least one supporting document image.\'] : []), ...(!affidavitReady ? [\'Review affidavit state and county before generating.\'] : []), ...(!customReady ? [\'Complete required template fields before generating.\'] : []), ...(strict && missingLetters.length ? [\'Required letter template missing: \' + missingLetters.join(\', \') + \'.\'] : [])].filter(Boolean))).slice(0, 8);\n  const showStage'
  );
}
if (!flow.includes('id="generation-blocked-reasons"')) {
  flow = flow.replace(
    '{(sourceWarnings.length > 0 || missingLetters.length > 0 || !affidavitReady || !customReady) && <div className="source-review"><strong>Needs attention</strong>',
    '{(generationBlockReasons.length > 0 || sourceWarnings.length > 0 || missingLetters.length > 0 || !affidavitReady || !customReady) && <div id="generation-blocked-reasons" className="source-review generation-blocked-reasons" role={generationBlockReasons.length ? \'alert\' : undefined}><strong>{generationBlockReasons.length ? \'Generation blocked\' : \'Needs attention\'}</strong>{generationBlockReasons.map((reason, index) => <p key={\'block-\' + index}>{reason}</p>)}'
  );
}
if (!flow.includes('aria-describedby={blocked ? "generation-blocked-reasons" : undefined}')) {
  flow = flow.replace('<button type="button" className="action-button" disabled={blocked || busy} onClick={() => void onGenerate()}>', '<button type="button" className="action-button" aria-describedby={blocked ? "generation-blocked-reasons" : undefined} disabled={blocked || busy} onClick={() => void onGenerate()}>');
}
save(flowPath, flow, flowBefore);
