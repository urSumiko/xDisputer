#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'components/LetterGeneratorWorkspaceV2.tsx';
let source = readFileSync(file, 'utf8');
let changed = false;

function replaceText(before, after, label) {
  if (!source.includes(before)) return;
  source = source.split(before).join(after);
  changed = true;
  console.log(`Repaired ${label}.`);
}

const helper = `
function toTemplateFile(value: Blob, name: string): File {
  if (value instanceof File) return value;
  return new File([value], name, {
    type: value.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    lastModified: Date.now()
  });
}
`;

if (!source.includes('function toTemplateFile(value: Blob, name: string): File')) {
  const anchor = "function errorMessage(error: unknown) {\n  return error instanceof Error && error.message ? error.message : 'An unknown error occurred.';\n}\n";
  if (source.includes(anchor)) {
    source = source.replace(anchor, anchor + helper);
    changed = true;
    console.log('Added template File adapter.');
  }
}

replaceText(
  "renderMappedAppendix(file, appendixContext('AFFIDAVIT', bureau, date))",
  "renderMappedAppendix(toTemplateFile(file, 'AFFIDAVIT.docx'), appendixContext('AFFIDAVIT', bureau, date))",
  'affidavit Blob to File boundary'
);

replaceText(
  "renderReferenceDisputeDocx(template, disputeValues(route, date))",
  "renderReferenceDisputeDocx(toTemplateFile(template, labels[route.type] + '.docx'), disputeValues(route, date))",
  'dispute template Blob to File boundary'
);

replaceText(
  "renderLatePaymentReference(template, lateValues(route, date))",
  "renderLatePaymentReference(toTemplateFile(template, labels[route.type] + '.docx'), lateValues(route, date))",
  'late payment template Blob to File boundary'
);

if (changed) writeFileSync(file, source);
else console.log('LetterGeneratorWorkspaceV2 Blob/File boundary repair not needed.');
