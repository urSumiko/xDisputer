#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

function replaceAll(source, before, after) {
  return source.includes(before) ? source.split(before).join(after) : source;
}

const workspaceFile = 'components/LetterGeneratorWorkspaceV2.tsx';
let workspace = readFileSync(workspaceFile, 'utf8');
const workspaceBefore = workspace;
workspace = replaceAll(
  workspace,
  'canGenerate={preflight.ready && canGenerate} missingLetters=',
  'canGenerate={preflight.ready && canGenerate} generationBlockers={preflight.blockers.map((item) => item.detail)} missingLetters='
);
if (workspace !== workspaceBefore) {
  writeFileSync(workspaceFile, workspace);
  console.log('Added preflight blocker reasons to GuidedSourceDataFlow props.');
} else {
  console.log('Workspace blocker reason prop already present or anchor changed.');
}

const flowFile = 'components/GuidedSourceDataFlow.tsx';
let flow = readFileSync(flowFile, 'utf8');
const before = flow;

flow = replaceAll(
  flow,
  'sourceWarnings: Array<{ message: string }>; evidenceKey: string; evidence: PacketAssets; canGenerate: boolean;',
  'sourceWarnings: Array<{ message: string }>; evidenceKey: string; evidence: PacketAssets; canGenerate: boolean; generationBlockers?: string[];'
);
flow = replaceAll(
  flow,
  'evidenceKey, evidence, canGenerate, missingLetters,',
  'evidenceKey, evidence, canGenerate, generationBlockers = [], missingLetters,'
);
flow = replaceAll(
  flow,
  "  const blocked = !canGenerate || !evidenceReady || !affidavitReady || !customReady || (strict && missingLetters.length > 0);\n  const showStage",
  "  const blocked = !canGenerate || !evidenceReady || !affidavitReady || !customReady || (strict && missingLetters.length > 0);\n  const generationBlockReasons = Array.from(new Set([\n    ...generationBlockers,\n    ...(!evidenceReady ? ['Upload at least one supporting document image.'] : []),\n    ...(!affidavitReady ? ['Review affidavit state and county before generating.'] : []),\n    ...(!customReady ? ['Complete required template fields before generating.'] : []),\n    ...(strict && missingLetters.length ? [`Required letter template missing: ${missingLetters.join(', ')}.`] : [])\n  ].filter(Boolean))).slice(0, 8);\n  const showStage"
);
flow = replaceAll(
  flow,
  "{(sourceWarnings.length > 0 || missingLetters.length > 0 || !affidavitReady || !customReady) && <div className=\"source-review\"><strong>Needs attention</strong>",
  "{(generationBlockReasons.length > 0 || sourceWarnings.length > 0 || missingLetters.length > 0 || !affidavitReady || !customReady) && <div id=\"generation-blocked-reasons\" className=\"source-review generation-blocked-reasons\" role={generationBlockReasons.length ? 'alert' : undefined}><strong>{generationBlockReasons.length ? 'Generation blocked' : 'Needs attention'}</strong>{generationBlockReasons.map((reason, index) => <p key={`block-${index}`}>{reason}</p>)}"
);
flow = replaceAll(
  flow,
  '<button type="button" className="action-button" disabled={blocked || busy} onClick={() => void onGenerate()}>',
  '<button type="button" className="action-button" aria-describedby={blocked ? "generation-blocked-reasons" : undefined} disabled={blocked || busy} onClick={() => void onGenerate()}>'
);

if (flow !== before) {
  writeFileSync(flowFile, flow);
  console.log('Added visible generation blocked reasons near the Generate button.');
} else {
  console.log('Generation blocked reason UI already present or anchors changed.');
}
