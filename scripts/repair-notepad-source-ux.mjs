#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

function save(path, before, after) {
  if (before !== after) {
    writeFileSync(path, after);
    console.log(`Updated ${path}.`);
  } else {
    console.log(`No changes needed for ${path}.`);
  }
}

function patchLetterEngine() {
  const path = 'lib/letter-engine.ts';
  const before = readFileSync(path, 'utf8');
  let source = before;

  source = source.replace(
    " if (parsed.ftcReportNumber || parsed.ftcAccounts.length) sections.push(`FTC REPORT NUMBER: ${parsed.ftcReportNumber}`, `FTC REPORT DATE: ${parsed.ftcReportDate}`, '', 'FTC AFFECTED ACCOUNTS', ...ftcLines(parsed.ftcAccounts, parsed.ftcReportDate));",
    ''
  );

  source = source.replace(
    " parsed.ftcReportNumber ? 'FTC report number' : '', parsed.ftcAccounts.length ? 'FTC affected accounts' : '',",
    ''
  );

  const oldFormat = `export const recommendedSourceFormat = \`NAME: CLIENT FULL NAME
FIRST NAME:
MIDDLE NAME:
LAST NAME:
ADDRESS: STREET ADDRESS
CITY, STATE ZIP
COUNTRY: USA
DOB: MM/DD/YYYY
SSN: XXX-XX-1234
PHONE:
EMAIL:
FTC REPORT NUMBER:
FTC REPORT DATE: AUTO - US EASTERN DATE MINUS 5 DAYS

FTC AFFECTED ACCOUNTS - MAXIMUM 5; THIS SECTION CONTROLS FTC OUTPUT ORDER
Account Name: EXAMPLE ACCOUNT OR INQUIRY
Account Number:
Date Discovered: M/YYYY
Fraudulent Amount:

DISPUTE ACCOUNTS
TRANSUNION
Account Name: EXAMPLE BANK
Account Number: XXXX1234
1032 10/2019

HARD INQUIRIES
TRANSUNION
EXAMPLE LENDER - 08/08/2024\`;`;

  const newFormat = `export const recommendedSourceFormat = \`NAME: CLIENT FULL NAME
FIRST NAME:
MIDDLE NAME:
LAST NAME:
ADDRESS: STREET ADDRESS
CITY, STATE ZIP
COUNTRY: USA
DOB: MM/DD/YYYY
SSN: XXX-XX-1234
PHONE:
EMAIL:

DISPUTE ACCOUNTS
TRANSUNION
Account Name: EXAMPLE BANK
Account Number: XXXX1234
1032 10/2019

HARD INQUIRIES
TRANSUNION
EXAMPLE LENDER - 08/08/2024\`;`;

  source = source.replace(oldFormat, newFormat);

  save(path, before, source);
}

function patchGuidedSourceCopy() {
  const path = 'components/GuidedSourceDataFlow.tsx';
  const before = readFileSync(path, 'utf8');
  let source = before;

  source = source.replace('Source TXT', 'Source Notepad');
  source = source.replace('Add client source data', 'Upload or review client Notepad data');
  source = source.replace('Import a TXT as a protected original, or open a manual draft. Working edits can always be recovered before replacement.', 'Upload a Notepad/TXT source file into a clean canvas. The original is protected, the working draft stays editable, and FTC fields are not added during normalization.');
  source = source.replace('Upload TXT file', 'Upload Notepad/TXT');
  source = source.replace('Import a client TXT and preserve an untouched original baseline.', 'Drop in the client source file, preserve the original, then clean only the fields needed for dispute packet generation.');
  source = source.replace('Review source data', 'Review normalized Notepad canvas');
  source = source.replace('Prepare only fields used by active packet documents. Retired FTC data is not required for generation.', 'Review the normalized source canvas. FTC fields are intentionally excluded from Notepad normalization for now.');
  source = source.replace('Import new TXT', 'Import new Notepad/TXT');
  source = source.replace('Standardize the working draft to continue.', 'Standardize the Notepad draft to continue.');

  save(path, before, source);
}

function patchSourceCanvasCss() {
  const path = 'app/source-progressive-studio.css';
  const before = readFileSync(path, 'utf8');
  let source = before;

  const marker = '/* Notepad Source Canvas UX */';
  if (!source.includes(marker)) {
    source += `

${marker}
.source-editor-stage {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 9% 0%, rgba(96, 115, 139, .10), transparent 31%),
    linear-gradient(180deg, #fff 0%, #f8fafc 100%) !important;
}
.source-editor-stage::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: linear-gradient(rgba(15, 23, 42, .035) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, .025) 1px, transparent 1px);
  background-size: 34px 34px;
  mask-image: linear-gradient(180deg, rgba(0,0,0,.34), transparent 72%);
}
.source-editor-stage > * {
  position: relative;
  z-index: 1;
}
.source-editor-layout {
  grid-template-columns: minmax(260px, 315px) minmax(0, 1fr);
  align-items: stretch;
}
.source-editor-tools.compact {
  position: relative;
  overflow: hidden;
  border-color: rgba(100, 116, 139, .24);
  background: rgba(255,255,255,.82);
  box-shadow: 0 18px 42px rgba(15, 23, 42, .07);
  backdrop-filter: blur(14px);
}
.source-editor-tools.compact::after {
  content: 'Notepad canvas';
  position: absolute;
  right: 13px;
  bottom: 12px;
  color: rgba(71, 85, 105, .34);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .16em;
  text-transform: uppercase;
}
.source-input-summary {
  border-color: rgba(100, 116, 139, .24);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 10px 24px rgba(15, 23, 42, .055);
}
.source-tool-upload {
  padding: 12px;
  border: 1px dashed rgba(100, 116, 139, .34);
  border-radius: 15px;
  background: rgba(248, 250, 252, .86);
}
.source-tool-upload:hover {
  border-color: var(--ui-gray-primary);
  background: #fff;
}
.source-tool-upload .file-input {
  cursor: pointer;
  border-color: rgba(100, 116, 139, .24);
}
.source-focused-text {
  min-height: min(660px, calc(100dvh - 360px));
  border-color: rgba(100, 116, 139, .28);
  background:
    linear-gradient(90deg, rgba(248,250,252,.95) 0 52px, rgba(226,232,240,.75) 52px 53px, #fff 53px 100%),
    repeating-linear-gradient(180deg, transparent 0 27px, rgba(148, 163, 184, .14) 28px 29px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.92), inset 0 0 0 1px rgba(255,255,255,.45), 0 20px 48px rgba(15, 23, 42, .08);
  color: #0f172a;
  line-height: 1.76;
  tab-size: 2;
}
.source-focused-text:focus {
  outline: none;
  border-color: var(--ui-gray-primary);
  background: #fff;
  box-shadow: 0 0 0 5px rgba(100, 116, 139, .10), 0 24px 55px rgba(15, 23, 42, .10);
}
.source-record-summary {
  border-color: rgba(16, 185, 129, .34);
  box-shadow: 0 12px 28px rgba(16, 185, 129, .10);
}
@media (max-width: 1100px) {
  .source-focused-text { min-height: 520px; }
}
`;
  }

  save(path, before, source);
}

patchLetterEngine();
patchGuidedSourceCopy();
patchSourceCanvasCss();
console.log('Notepad Source UX repair complete.');
