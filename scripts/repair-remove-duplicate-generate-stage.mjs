#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'components/GuidedSourceDataFlow.tsx';
let source = readFileSync(file, 'utf8');
const before = source;

const exactReplace = (from, to) => {
  if (source.includes(from)) source = source.split(from).join(to);
};

source = source.replace("type Stage = 'SOURCE' | 'REVIEW' | 'EVIDENCE' | 'GENERATE';", "type Stage = 'SOURCE' | 'REVIEW' | 'EVIDENCE';");
source = source.replace("import { bureauInfo, bureaus, type Bureau, type LetterRoute, type ParsedSource, type SourceItem } from '../lib/letter-engine';", "import { bureauInfo, bureaus, type LetterRoute, type ParsedSource, type SourceItem } from '../lib/letter-engine';");
source = source.replace("import { packetOrderText } from '../lib/workflow-framework';\n", '');

exactReplace(
  '  if (!items.length) return <section className="packet-review-empty"><div><strong>{title}</strong><span>No items detected</span></div></section>;',
  '  if (!items.length) return null;'
);
source = source.replace(/\n\s*<span>\{itemLabel\(kind\)\}<\/span>/g, '');

const oldTotalsBlock = `  const reviewTotals = useMemo(() => {
    const dispute = bureaus.reduce((sum, bureau) => sum + parsed.dispute[bureau].length, 0);
    const inquiry = bureaus.reduce((sum, bureau) => sum + parsed.inquiry[bureau].length, 0);
    const late = bureaus.reduce((sum, bureau) => sum + parsed.late[bureau].length, 0);
    const activeBureaus = bureaus.filter((bureau) => parsed.dispute[bureau].length || parsed.inquiry[bureau].length || parsed.late[bureau].length).length;
    return { dispute, inquiry, late, activeBureaus, routes: routes.length };
  }, [parsed, routes.length]);
`;

const newTotalsBlock = [
  '  const visibleBureaus = useMemo(() => {',
  '    return bureaus.filter((bureau) => parsed.dispute[bureau].length || parsed.inquiry[bureau].length || parsed.late[bureau].length);',
  '  }, [parsed]);',
  '',
  '  const reviewTotals = useMemo(() => {',
  '    const dispute = visibleBureaus.reduce((sum, bureau) => sum + parsed.dispute[bureau].length, 0);',
  '    const inquiry = visibleBureaus.reduce((sum, bureau) => sum + parsed.inquiry[bureau].length, 0);',
  '    const late = visibleBureaus.reduce((sum, bureau) => sum + parsed.late[bureau].length, 0);',
  '    return { dispute, inquiry, late, activeBureaus: visibleBureaus.length, routes: routes.length };',
  '  }, [parsed, routes.length, visibleBureaus]);',
  '',
  '  const clientSummary = useMemo(() => {',
  "    const address = parsed.address.join(' ') || 'Address unavailable';",
  "    const dob = parsed.dob || 'DOB unavailable';",
  "    const ssn = parsed.ssn || 'SSN unavailable';",
  "    return `${parsed.name || 'Client name unavailable'} · ${address} · DOB ${dob} · SSN ${ssn}`;",
  '  }, [parsed.address, parsed.dob, parsed.name, parsed.ssn]);',
  ''
].join('\n');

if (!source.includes('const visibleBureaus = useMemo')) {
  exactReplace(oldTotalsBlock, newTotalsBlock);
}

exactReplace(
`  function confirmEvidence() {
    if (!evidenceReady) {
      onMessage('Supporting Documents are required. Upload at least one evidence image to continue.');
      return;
    }
    showStage('GENERATE');
    onMessage('Supporting Documents confirmed. Review routes and generate the package.');
  }
`,
`  function confirmEvidence() {
    if (!evidenceReady) {
      onMessage('Supporting Documents are required. Upload at least one evidence image to continue.');
      return;
    }
    if (blocked) {
      onMessage('Review packet scope, required templates, and supporting documents before generating.');
      return;
    }
    void onGenerate();
  }
`
);

exactReplace(
  '<button type="button" className="action-button" disabled={!evidenceReady} onClick={confirmEvidence}>Continue to Generate</button>',
  '<button type="button" className="action-button" aria-disabled={blocked || busy} disabled={busy || !evidenceReady} onClick={confirmEvidence}>{busy ? \'Generating packet…\' : \'Generate Ordered Review Package\'}</button>'
);

exactReplace(
  '<SourceStageHeader eyebrow="Step 02 · Review packet scope" title="Confirm accounts by bureau" description="Review what will be inserted into the generated letters before packet generation."><div className="packet-review-metrics"><span>{reviewTotals.activeBureaus} bureau group{reviewTotals.activeBureaus === 1 ? \'\' : \'s\'}</span><span>{reviewTotals.dispute} dispute</span><span>{reviewTotals.inquiry} inquiry</span><span>{reviewTotals.late} late</span></div></SourceStageHeader>\n      <div className="packet-review-client-card"><div><p className="eyebrow">Detected client</p><h3>{parsed.name || \'Client name unavailable\'}</h3><p>{parsed.address.join(\' \') || \'Address unavailable\'} · DOB {parsed.dob || \'N/A\'} · SSN {parsed.ssn || \'N/A\'}</p></div><strong>{reviewTotals.routes} output route{reviewTotals.routes === 1 ? \'\' : \'s\'}</strong></div>',
  '<SourceStageHeader eyebrow="Step 02 · Review packet scope" title="Confirm accounts by bureau" description={clientSummary}><div className="packet-review-metrics"><span>{reviewTotals.activeBureaus} bureau groups</span><span>{reviewTotals.routes} output routes</span><span>{reviewTotals.dispute} dispute</span><span>{reviewTotals.inquiry} inquiry</span><span>{reviewTotals.late} late</span></div></SourceStageHeader>'
);

source = source.replace('className="panel source-progressive-stage packet-review-stage shared-stage-surface"', 'className="panel source-progressive-stage packet-review-stage compact-packet-review shared-stage-surface"');
source = source.replace('<div className="packet-review-grid">{bureaus.map((bureau) =>', '<div className="packet-review-grid">{visibleBureaus.map((bureau) =>');

exactReplace(
  '<header><div><span>{bureauInfo[bureau].name}</span><h3>{bureau}</h3></div><strong>{parsed.dispute[bureau].length + parsed.inquiry[bureau].length + parsed.late[bureau].length} item{parsed.dispute[bureau].length + parsed.inquiry[bureau].length + parsed.late[bureau].length === 1 ? \'\' : \'s\'}</strong></header>',
  '<header><div><h3>{bureau}</h3></div></header>'
);
source = source.replace('PacketReviewSection title="For dispute letter"', 'PacketReviewSection title="Dispute letter"');
source = source.replace(/\n\s*\{stage === 'GENERATE' && <section[\s\S]*?\n\s*\}(<\/div>;\n\})/m, '\n  $1');

if (source !== before) {
  writeFileSync(file, source);
  console.log('Removed duplicate Generate stage, hid empty packet-scope groups, and kept counts per visible letter section.');
} else {
  console.log('Packet scope review cleanup not needed.');
}
