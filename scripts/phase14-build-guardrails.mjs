import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function write(relativePath, value) {
  fs.writeFileSync(path.join(root, relativePath), value);
}

function save(relativePath, before, after) {
  if (before !== after) {
    write(relativePath, after);
    console.log(`Phase 14 guardrails repaired ${relativePath}.`);
  }
}

function collapseRepeatedExact(source, repeated, single) {
  let next = source;
  while (next.includes(repeated)) next = next.replace(repeated, single);
  return next;
}

function collapseRepeatedRegex(source, pattern, single) {
  let next = source;
  let previous = '';
  while (previous !== next) {
    previous = next;
    next = next.replace(pattern, single);
  }
  return next;
}

function guardTemplateAssetsRoute() {
  const file = 'app/api/template-assets/route.ts';
  let source = read(file);
  const before = source;

  if (source.includes('buildTemplateGovernance(contract)') && !source.includes("../../../lib/template-governance")) {
    source = source.replace(
      "import { inspectTemplateContract, templateContractGateMessage, type TemplateDocumentKind } from '../../../lib/template-contracts';",
      "import { inspectTemplateContract, templateContractGateMessage, type TemplateDocumentKind } from '../../../lib/template-contracts';\nimport { buildTemplateGovernance } from '../../../lib/template-governance';"
    );
    source = source.replace(
      "import { inspectTemplateContract, type TemplateDocumentKind } from '../../../lib/template-contracts';",
      "import { inspectTemplateContract, type TemplateDocumentKind } from '../../../lib/template-contracts';\nimport { buildTemplateGovernance } from '../../../lib/template-governance';"
    );
  }

  save(file, before, source);
}

function guardGenerationRunsRoute() {
  const file = 'app/api/generation-runs/route.ts';
  let source = read(file);
  const before = source;

  const snapshotBlock = `    const sourceSnapshot = body?.sourceSnapshot ?? body?.source ?? null;
    const templateSnapshot = body?.templateSnapshot ?? body?.template ?? null;
    const rulesSnapshot = body?.rulesSnapshot ?? body?.rules ?? null;
    const outputSnapshot = body?.outputSnapshot ?? body?.output ?? null;
`;

  const first = source.indexOf(snapshotBlock);
  if (first >= 0) {
    let searchFrom = first + snapshotBlock.length;
    let duplicateAt = source.indexOf(snapshotBlock, searchFrom);
    while (duplicateAt >= 0) {
      source = source.slice(0, duplicateAt) + source.slice(duplicateAt + snapshotBlock.length);
      searchFrom = first + snapshotBlock.length;
      duplicateAt = source.indexOf(snapshotBlock, searchFrom);
    }
  }

  save(file, before, source);
}

function guardGuidedSourceDataFlow() {
  const file = 'components/GuidedSourceDataFlow.tsx';
  let source = read(file);
  const before = source;

  source = collapseRepeatedRegex(source, /(?:generationBlockers\?: string\[\];\s*){2,}/g, 'generationBlockers?: string[]; ');
  source = collapseRepeatedRegex(source, /(?:generationBlockers = \[\],\s*){2,}/g, 'generationBlockers = [], ');
  source = collapseRepeatedRegex(source, /(?:aria-describedby=\{blocked \? "generation-blocked-reasons" : undefined\}\s*){2,}/g, 'aria-describedby={blocked ? "generation-blocked-reasons" : undefined} ');

  if (source.includes('generationBlockers') && !source.includes('generationBlockReasons')) {
    source = source.replace(
      '  const blocked = !canGenerate || !evidenceReady || !affidavitReady || !customReady || (strict && missingLetters.length > 0);\n  const showStage',
      '  const blocked = !canGenerate || !evidenceReady || !affidavitReady || !customReady || (strict && missingLetters.length > 0);\n  const generationBlockReasons = Array.from(new Set([...generationBlockers, ...(!evidenceReady ? [\'Upload at least one supporting document image.\'] : []), ...(!affidavitReady ? [\'Review affidavit state and county before generating.\'] : []), ...(!customReady ? [\'Complete required template fields before generating.\'] : []), ...(strict && missingLetters.length ? [\'Required letter template missing: \' + missingLetters.join(\', \') + \'.\'] : [])].filter(Boolean))).slice(0, 8);\n  const showStage'
    );
  }

  if (!source.includes('const clientSummary = useMemo')) {
    source = source.replace(
      '  }, [parsed, routes.length]);\n\n  useEffect(() => {',
      '  }, [parsed, routes.length]);\n\n  const clientSummary = useMemo(() => {\n    const address = parsed.address.join(\' \') || \'Address unavailable\';\n    const dob = parsed.dob || \'DOB unavailable\';\n    const ssn = parsed.ssn || \'SSN unavailable\';\n    return `${parsed.name || \'Client name unavailable\'} · ${address} · DOB ${dob} · SSN ${ssn}`;\n  }, [parsed.address, parsed.dob, parsed.name, parsed.ssn]);\n\n  useEffect(() => {'
    );
  }

  source = source.replace('Source TXT', 'Source Notepad');
  source = source.replace('Add client source data', 'Upload or review client Notepad data');
  source = source.replace('Import a TXT as a protected original, or open a manual draft. Working edits can always be recovered before replacement.', 'Upload a Notepad/TXT source file into a clean canvas. The original is protected, the working draft stays editable, and FTC fields are not added during normalization.');
  source = source.replace('Upload TXT file', 'Upload Notepad/TXT');
  source = source.replace('Import a client TXT and preserve an untouched original baseline.', 'Drop in the client source file, preserve the original, then clean only the fields needed for dispute packet generation.');
  source = source.replace('Review source data', 'Review normalized Notepad canvas');
  source = source.replace('Prepare only fields used by active packet documents. Retired FTC data is not required for generation.', 'Review the normalized source canvas. FTC fields are intentionally excluded from Notepad normalization for now.');
  source = source.replace('Import new TXT', 'Import new Notepad/TXT');
  source = source.replace('Standardize the working draft to continue.', 'Standardize the Notepad draft to continue.');

  source = source.replace(
    'className="panel source-progressive-stage packet-review-stage shared-stage-surface"',
    'className="panel source-progressive-stage packet-review-stage compact-packet-review shared-stage-surface"'
  );
  source = source.replace(
    '<SourceStageHeader eyebrow="Step 02 · Review packet scope" title="Confirm accounts by bureau" description="Review what will be inserted into the generated letters before packet generation."><div className="packet-review-metrics"><span>{reviewTotals.activeBureaus} bureau group{reviewTotals.activeBureaus === 1 ? \'\' : \'s\'}</span><span>{reviewTotals.dispute} dispute</span><span>{reviewTotals.inquiry} inquiry</span><span>{reviewTotals.late} late</span></div></SourceStageHeader>\n      <div className="packet-review-client-card"><div><p className="eyebrow">Detected client</p><h3>{parsed.name || \'Client name unavailable\'}</h3><p>{parsed.address.join(\' \') || \'Address unavailable\'} · DOB {parsed.dob || \'N/A\'} · SSN {parsed.ssn || \'N/A\'}</p></div><strong>{reviewTotals.routes} output route{reviewTotals.routes === 1 ? \'\' : \'s\'}</strong></div>',
    '<SourceStageHeader eyebrow="Step 02 · Review packet scope" title="Confirm accounts by bureau" description={clientSummary}><div className="packet-review-metrics"><span>{reviewTotals.activeBureaus} bureau groups</span><span>{reviewTotals.routes} output routes</span><span>{reviewTotals.dispute} dispute</span><span>{reviewTotals.inquiry} inquiry</span><span>{reviewTotals.late} late</span></div></SourceStageHeader>'
  );
  source = source.replace(
    '<article className="packet-review-bureau-card" key={bureau}><header><div><span>{bureauInfo[bureau].name}</span><h3>{bureau}</h3></div><strong>{parsed.dispute[bureau].length + parsed.inquiry[bureau].length + parsed.late[bureau].length} item{parsed.dispute[bureau].length + parsed.inquiry[bureau].length + parsed.late[bureau].length === 1 ? \'\' : \'s\'}</strong></header><PacketReviewSection title="For dispute letter" kind="dispute" items={parsed.dispute[bureau]} />',
    '<article className="packet-review-bureau-card" key={bureau}><header><div><h3>{bureau}</h3></div><strong>{parsed.dispute[bureau].length + parsed.inquiry[bureau].length + parsed.late[bureau].length} item{parsed.dispute[bureau].length + parsed.inquiry[bureau].length + parsed.late[bureau].length === 1 ? \'\' : \'s\'}</strong></header><PacketReviewSection title="Dispute letter" kind="dispute" items={parsed.dispute[bureau]} />'
  );
  source = source.replace('\n          <span>{itemLabel(kind)}</span>', '');

  save(file, before, source);
}

function guardWorkspaceV2() {
  const file = 'components/LetterGeneratorWorkspaceV2.tsx';
  let source = read(file);
  const before = source;

  source = collapseRepeatedExact(
    source,
    'generationBlockers={preflight.blockers.map((item) => item.detail)} generationBlockers={preflight.blockers.map((item) => item.detail)}',
    'generationBlockers={preflight.blockers.map((item) => item.detail)}'
  );
  source = source.replace("recipientAddressLines: recipient.address.split('\\n')", "recipientAddressLines: bureauInfo[bureau].address.split('\\n')");
  source = source.replace("address.split('\n'), source: affidavitSource", "address.split('\\n'), source: affidavitSource");

  save(file, before, source);
}

function guardLetterEngineNotepadNormalization() {
  const file = 'lib/letter-engine.ts';
  let source = read(file);
  const before = source;

  source = source.replace(" if (parsed.ftcReportNumber || parsed.ftcAccounts.length) sections.push(`FTC REPORT NUMBER: ${parsed.ftcReportNumber}`, `FTC REPORT DATE: ${parsed.ftcReportDate}`, '', 'FTC AFFECTED ACCOUNTS', ...ftcLines(parsed.ftcAccounts, parsed.ftcReportDate));", '');
  source = source.replace(" parsed.ftcReportNumber ? 'FTC report number' : '', parsed.ftcAccounts.length ? 'FTC affected accounts' : '',", '');
  source = source.replace("FTC REPORT NUMBER:\nFTC REPORT DATE: AUTO - US EASTERN DATE MINUS 5 DAYS\n\nFTC AFFECTED ACCOUNTS - MAXIMUM 5; THIS SECTION CONTROLS FTC OUTPUT ORDER\nAccount Name: EXAMPLE ACCOUNT OR INQUIRY\nAccount Number:\nDate Discovered: M/YYYY\nFraudulent Amount:\n\n", '');

  save(file, before, source);
}

function guardNotepadCanvasCss() {
  const file = 'app/source-progressive-studio.css';
  let source = read(file);
  const before = source;
  const marker = '/* Notepad Source Canvas UX */';

  if (!source.includes(marker)) {
    source += `

${marker}
.source-editor-stage {
  position: relative;
  overflow: hidden;
  background: radial-gradient(circle at 9% 0%, rgba(96, 115, 139, .10), transparent 31%), linear-gradient(180deg, #fff 0%, #f8fafc 100%) !important;
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
.source-editor-stage > * { position: relative; z-index: 1; }
.source-editor-layout { grid-template-columns: minmax(260px, 315px) minmax(0, 1fr); align-items: stretch; }
.source-editor-tools.compact {
  overflow: hidden;
  border-color: rgba(100, 116, 139, .24);
  background: rgba(255,255,255,.82);
  box-shadow: 0 18px 42px rgba(15, 23, 42, .07);
  backdrop-filter: blur(14px);
}
.source-tool-upload {
  padding: 12px;
  border: 1px dashed rgba(100, 116, 139, .34);
  border-radius: 15px;
  background: rgba(248, 250, 252, .86);
}
.source-tool-upload:hover { border-color: var(--ui-gray-primary); background: #fff; }
.source-focused-text {
  min-height: min(660px, calc(100dvh - 360px));
  border-color: rgba(100, 116, 139, .28);
  background: linear-gradient(90deg, rgba(248,250,252,.95) 0 52px, rgba(226,232,240,.75) 52px 53px, #fff 53px 100%), repeating-linear-gradient(180deg, transparent 0 27px, rgba(148, 163, 184, .14) 28px 29px);
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
.source-record-summary { border-color: rgba(16, 185, 129, .34); box-shadow: 0 12px 28px rgba(16, 185, 129, .10); }
@media (max-width: 1100px) { .source-focused-text { min-height: 520px; } }
`;
  }

  save(file, before, source);
}

guardTemplateAssetsRoute();
guardGenerationRunsRoute();
guardGuidedSourceDataFlow();
guardWorkspaceV2();
guardLetterEngineNotepadNormalization();
guardNotepadCanvasCss();
console.log('Phase 14 build guardrails complete.');
