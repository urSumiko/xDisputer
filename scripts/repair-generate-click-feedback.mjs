#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'components/GuidedSourceDataFlow.tsx';
let source = readFileSync(file, 'utf8');
const before = source;

source = source.replace(
  '<button type="button" className="action-button" disabled={blocked || busy} onClick={() => void onGenerate()}>',
  '<button type="button" className="action-button" aria-disabled={blocked || busy} disabled={busy} onClick={() => void onGenerate()}>'
);

source = source.replace(
  '<button type="button" className="action-button" aria-describedby={blocked ? "generation-blocked-reasons" : undefined} disabled={blocked || busy} onClick={() => void onGenerate()}>',
  '<button type="button" className="action-button" aria-describedby={blocked ? "generation-blocked-reasons" : undefined} aria-disabled={blocked || busy} disabled={busy} onClick={() => void onGenerate()}>'
);

if (source !== before) {
  writeFileSync(file, source);
  console.log('Generate button now opens blocker feedback instead of staying silently disabled.');
} else {
  console.log('Generate click feedback repair not needed.');
}
