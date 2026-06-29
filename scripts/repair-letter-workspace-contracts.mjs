#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const workspaceFile = 'components/LetterGeneratorWorkspaceV2.tsx';
let source = readFileSync(workspaceFile, 'utf8');
let changed = false;

function spliceBetween(startText, endText, replacement, label) {
  const start = source.indexOf(startText);
  if (start < 0) return;
  const end = source.indexOf(endText, start);
  if (end < 0) return;
  source = source.slice(0, start) + replacement + source.slice(end);
  changed = true;
  console.log(`Repaired ${label}.`);
}

function replaceAllText(before, after, label) {
  if (!source.includes(before)) return;
  source = source.split(before).join(after);
  changed = true;
  console.log(`Repaired ${label}.`);
}

function ensureWorkspaceImport(importLine) {
  if (source.includes(importLine)) return;
  const anchor = "import JSZip from 'jszip';\n";
  if (!source.includes(anchor)) return;
  source = source.replace(anchor, `${anchor}${importLine}\n`);
  changed = true;
  console.log(`Added import: ${importLine}`);
}

ensureWorkspaceImport("import { extractDocxVisibleText } from '../lib/docx-text-audit';");
ensureWorkspaceImport("import { auditRenderedText, evaluateSourceCompleteness } from '../lib/template-governance';");

spliceBetween(
  '  function uploadRef(type: LetterType, file: File) {',
  '  function restoreOriginal() {',
  `  async function uploadRef(slot: LetterReference, file: File) {
    const contract = await saveReferenceFile(slot, file);
    const next = loadReferenceMeta().map((item) => item.id === slot.id ? { ...item, file: file.name, size: file.size, contract } : item);
    setReferences(next);
    clearOutputs(); report(labels[slot.type] + ' uploaded for ' + round + '.', 'success');
  }
  async function removeRef(slot: LetterReference) {
    await removeReferenceFile(slot.id);
    const next = loadReferenceMeta().map((item) => item.id === slot.id ? { ...item, file: '', size: undefined, contract: undefined } : item);
    setReferences(next);
    clearOutputs(); report(labels[slot.type] + ' removed for ' + round + '.');
  }
  function importSource(value: string, action: string) { captureDraft(action); setSource(value); setOriginalSource(value); setNormalized(false); clearOutputs(); setCaseId(crypto.randomUUID()); report(action + ' imported. Standardize it before generation.', 'success'); setPanel('Source Data'); }
  function standardizeDraft(value = source) { const next = createNormalizedSourceCopy(value); setSource(next.text); setNormalized(true); setRecoveryDraft(null); saveCase('SOURCE_LOCKED'); report('Source data standardized and locked for generation.', 'success'); }
  function startManualDraft(value: string) { setCaseId(crypto.randomUUID()); setSource(value); setOriginalSource(value); setNormalized(false); clearOutputs(); report('Manual draft started. Complete the source fields, then standardize.', 'success'); }
  function setLine(field: string, value: string) {
    const lines = source.split(/\\r?\\n/);
    const fixed: Record<string, string> = { name: 'Name', dob: 'DOB', ssn: 'SSN', address: 'Address', letterDate: 'Letter Date', affidavitState: 'Affidavit State', affidavitCounty: 'Affidavit County' };
    const label = field.startsWith('TEMPLATE FIELD ') ? field : fixed[field] || field;
    const next = label + ': ' + value;
    const index = lines.findIndex((line) => line.toLowerCase().startsWith(label.toLowerCase() + ':'));
    if (index >= 0) lines[index] = next; else lines.unshift(next);
    setSource(lines.join('\\n')); setNormalized(false);
  }
 `,
  'source and reference handlers'
);

spliceBetween(
  '  function refBlob(type: LetterType) {',
  '  async function assetBlob(kind: ExhibitKind) {',
  `  function refBlob(type: LetterType) { const slot = refs.find((item) => item.type === type); return slot ? readReferenceFile(slot.id) : Promise.resolve(null); }
  function exhibitBlob(kind: ExhibitKind) { return readTemplateExhibit(round, kind); }
  function disputeValues(route: LetterRoute, date: string) {
    return { consumerName: parsed.name, addressLines: parsed.address.length ? parsed.address : ['N/A'], dob: parsed.dob, ssn: parsed.ssn, letterDate: date, bureauName: bureauInfo[route.bureau].name, bureauAddressLines: bureauInfo[route.bureau].address.split('\\n'), disputeItems: parsed.dispute[route.bureau].map((item) => item.displayText), hardInquiryItems: parsed.inquiry[route.bureau].map((item) => item.displayText), fraudItems: route.items.map((item) => item.displayText) };
  }
  function lateValues(route: LetterRoute, date: string) {
    return { consumerName: parsed.name, addressLines: parsed.address.length ? parsed.address : ['N/A'], dob: parsed.dob, ssn: parsed.ssn, letterDate: date, bureauName: bureauInfo[route.bureau].name, bureauAddressLines: bureauInfo[route.bureau].address.split('\\n'), latePaymentItems: parsed.late[route.bureau].map((item) => item.displayText) };
  }
  function appendixContext(kind: 'AFFIDAVIT' | 'FTC', bureau: Bureau, date: string) {
    return { kind, bureau, documentDate: date, recipientName: bureauInfo[bureau].name, recipientAddressLines: bureauInfo[bureau].address.split('\\n'), source: affidavitSource };
  }
  function accountNameOf(displayText: string) {
    return displayText.match(/^Account Name:\\s*(.+)$/im)?.[1]?.trim() || '';
  }
  function accountNumberOf(displayText: string) {
    return displayText.match(/^Account Number:\\s*(.+)$/im)?.[1]?.trim() || '';
  }
  function sourceAccountItems() {
    const accountItems = routes.flatMap((route) => route.items
      .filter((item) => item.type !== 'HARD_INQUIRY')
      .map((item) => ({ accountName: accountNameOf(item.displayText), accountNumber: accountNumberOf(item.displayText) })));
    if (accountItems.length) return accountItems;
    return routes.flatMap((route) => route.items.map((item) => ({ accountName: item.displayText, accountNumber: 'INQUIRY' })));
  }
  function auditValues(route: LetterRoute) {
    const items = route.items.filter((item) => item.type !== 'HARD_INQUIRY');
    return {
      accountNames: items.map((item) => accountNameOf(item.displayText)).filter(Boolean),
      accountNumbers: items.map((item) => accountNumberOf(item.displayText)).filter(Boolean)
    };
  }
  async function auditLetterOutput(route: LetterRoute, blob: Blob) {
    const expected = auditValues(route);
    return auditRenderedText({
      text: await extractDocxVisibleText(blob),
      clientName: parsed.name,
      accountNames: expected.accountNames,
      accountNumbers: expected.accountNumbers
    });
  }
 `,
  'render value adapters'
);

replaceAllText("recipientAddressLines: recipient.address.split('\\n')", "recipientAddressLines: bureauInfo[bureau].address.split('\\n')", 'recipient address adapter');
replaceAllText("    return file ? renderMappedAppendix(file, affidavitSource, bureauInfo[bureau].name, date) : null;", "    return file ? renderMappedAppendix(file, appendixContext('AFFIDAVIT', bureau, date)) : null;", 'appendix renderer call');
replaceAllText("    addOrderedPacketFolders(zip, files.map((item) => ({ path: item.path, blob: item.blob })), { date, clientName: parsed.name || 'Client', round, manifest, notes, sourceData: source });\n    zip.file('generation-manifest.json', manifestJson);", "    await addOrderedPacketFolders(zip, files, round, evidenceKey, parsed.name || 'Client', routes.map((route) => ({ type: route.type, bureau: route.bureau })));\n    zip.file('generation-manifest.json', manifestJson);", 'ordered packet archive call');
replaceAllText('      const date = parsed.letterDate || dateNow();', '      const date = dateNow();', 'document date source');
replaceAllText("          const blob = route.type === 'DISPUTE' ? await withTimeout(`Rendering ${labels[route.type]} for ${route.bureau}`, () => renderReferenceDisputeDocx(template, parsed, route.bureau, date)) : await withTimeout(`Rendering ${labels[route.type]} for ${route.bureau}`, () => renderLatePaymentReference(template, parsed, route.bureau, date));", "          const blob = route.type === 'DISPUTE' ? await withTimeout(`Rendering ${labels[route.type]} for ${route.bureau}`, () => renderReferenceDisputeDocx(template, disputeValues(route, date))) : await withTimeout(`Rendering ${labels[route.type]} for ${route.bureau}`, () => renderLatePaymentReference(template, lateValues(route, date)));", 'letter renderer calls');

if (!source.includes('const sourceCompleteness = evaluateSourceCompleteness')) {
  replaceAllText(
    "    if (!preflight.ready) { report(preflightFailureMessage(preflight), 'error'); return; }\n    setBusy(true); setWarnings([]); setOrderedZip(null); setDocDate(dateNow());\n    const output: ReviewOutput[] = []; const notes: string[] = [];",
    "    if (!preflight.ready) { report(preflightFailureMessage(preflight), 'error'); return; }\n    const sourceCompleteness = evaluateSourceCompleteness({\n      clientName: parsed.name,\n      addressLines: parsed.address,\n      accountItems: sourceAccountItems(),\n      customFields: parsed.templateFields,\n      requiredCustomFields: customFields.filter((item) => item.required).map((item) => item.key)\n    });\n    if (sourceCompleteness.status === 'BLOCKED') {\n      const message = `Source Data blocked generation: ${sourceCompleteness.missing.join(', ')}`;\n      setWarnings(sourceCompleteness.missing.map((item) => `Missing required source value: ${item}`));\n      report(message, 'error');\n      return;\n    }\n    setBusy(true); setWarnings([]); setOrderedZip(null); setDocDate(dateNow());\n    const output: ReviewOutput[] = []; const notes: string[] = sourceCompleteness.warnings.map((warning) => `Source Data warning: ${warning}`);",
    'source completeness gate'
  );
}

if (!source.includes('const audit = await auditLetterOutput(route, blob);')) {
  replaceAllText(
    "          const blob = route.type === 'DISPUTE' ? await withTimeout(`Rendering ${labels[route.type]} for ${route.bureau}`, () => renderReferenceDisputeDocx(toTemplateFile(template, labels[route.type] + '.docx'), disputeValues(route, date))) : await withTimeout(`Rendering ${labels[route.type]} for ${route.bureau}`, () => renderLatePaymentReference(toTemplateFile(template, labels[route.type] + '.docx'), lateValues(route, date)));\n          output.push({ id: `${route.type}-${route.bureau}-LETTER`, path: `Editable Documents/${clean(parsed.name)} ${route.bureau} ${labels[route.type]}.docx`, type: route.type, role: 'LETTER', sequence: 1, bureau: route.bureau, count: route.items.length, detail: route.reason, blob, packetSteps: order(route.type) });",
    "          const blob = route.type === 'DISPUTE' ? await withTimeout(`Rendering ${labels[route.type]} for ${route.bureau}`, () => renderReferenceDisputeDocx(toTemplateFile(template, labels[route.type] + '.docx'), disputeValues(route, date))) : await withTimeout(`Rendering ${labels[route.type]} for ${route.bureau}`, () => renderLatePaymentReference(toTemplateFile(template, labels[route.type] + '.docx'), lateValues(route, date)));\n          const audit = await auditLetterOutput(route, blob);\n          if (audit.status === 'BLOCKED') {\n            notes.push(`${labels[route.type]} / ${route.bureau}: Render audit blocked output: ${audit.blockers.join('; ')}`);\n            continue;\n          }\n          output.push({ id: `${route.type}-${route.bureau}-LETTER`, path: `Editable Documents/${clean(parsed.name)} ${route.bureau} ${labels[route.type]}.docx`, type: route.type, role: 'LETTER', sequence: 1, bureau: route.bureau, count: route.items.length, detail: route.reason, blob, packetSteps: order(route.type) });",
    'post-render letter audit'
  );
}

if (changed) writeFileSync(workspaceFile, source);
else console.log('LetterGeneratorWorkspaceV2 contract repair not needed.');

const assetRouteFile = 'app/api/template-assets/route.ts';
let routeSource = readFileSync(assetRouteFile, 'utf8');
let routeChanged = false;
const originalImport = "import { inspectTemplateContract, type TemplateDocumentKind } from '../../../lib/template-contracts';";
const gatedImport = "import { inspectTemplateContract, templateContractGateMessage, type TemplateDocumentKind } from '../../../lib/template-contracts';";
if (routeSource.includes(originalImport)) {
  routeSource = routeSource.replace(originalImport, gatedImport);
  routeChanged = true;
}
const marker = '    const contract = await inspectTemplateContract(file, kind);\n';
const gate = `    const contract = await inspectTemplateContract(file, kind);
    const gateMessage = templateContractGateMessage(contract);
    if (gateMessage) {
      return respond(request, 'error', gateMessage, 422, { contract });
    }
`;
if (routeSource.includes(marker) && !routeSource.includes('templateContractGateMessage(contract)')) {
  routeSource = routeSource.replace(marker, gate);
  routeChanged = true;
}
if (routeChanged) {
  writeFileSync(assetRouteFile, routeSource);
  console.log('Repaired template upload gate with hardened contract validation.');
} else {
  console.log('Template contract gate repair not needed.');
}
