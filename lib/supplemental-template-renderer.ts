import PizZip from 'pizzip';
import { DOCX_MIME, renderDocxTemplate, type PlaceholderValues } from './docx-renderer';
import { hardenGeneratedDocx } from './docx-safety';
import { bureaus, ftcFraudMonthYearFromReportDate, MAX_FTC_ACCOUNTS, type Bureau, type ParsedSource, type SourceItem } from './letter-engine';
import { tryRenderDynamicAppendixTemplateV2 } from './dynamic-template/appendix-renderer-v2-bridge';
import type { DynamicTemplateRendererMode } from './dynamic-template/renderer-mode';
import type { Round } from './reference-store';

export type MappedAppendixKind = 'AFFIDAVIT' | 'FTC';
export type MappedAppendixContext = { kind: MappedAppendixKind; bureau: Bureau; documentDate: string; recipientName: string; recipientAddressLines: string[]; source: ParsedSource; round?: Round };
export type AppendixRenderProgress = { phase: string; completed: number; total: number };
export type AppendixRenderOptions = { signal?: AbortSignal; onProgress?: (progress: AppendixRenderProgress) => void; rendererMode?: DynamicTemplateRendererMode | string | null; allowLegacyFallback?: boolean };
type RenderRow = { account_name: string; account_number: string; account_line: string; display_text: string };
type Opened = { zip: PizZip; xmlText: string; xml: XMLDocument; body: Element };
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const X = 'http://www.w3.org/XML/1998/namespace';
let activeController: AbortController | null = null;

function emitProgress(progress: AppendixRenderProgress) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<AppendixRenderProgress>('lettergenerator:appendix-progress', { detail: progress }));
}
export function cancelActiveAppendixRender() { activeController?.abort(); }
function abortError() { const error = new Error('Document generation was cancelled. Completed documents remain available in the review package.'); error.name = 'AbortError'; return error; }
function assertActive(options: AppendixRenderOptions) { if (options.signal?.aborted) throw abortError(); }
async function checkpoint(options: AppendixRenderOptions, phase: string, completed = 0, total = 1) {
  assertActive(options);
  const progress = { phase, completed, total };
  options.onProgress?.(progress);
  emitProgress(progress);
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
  assertActive(options);
}

function rows(items: SourceItem[]): RenderRow[] {
  return items.map((item) => {
    const lines = item.displayText.split('\n').map((value) => value.trim()).filter(Boolean);
    const name = (lines.find((value) => /^(?:Account|Creditor|Furnisher|Company)\s*(?:Name)?\s*:/i.test(value)) || '').replace(/^(?:Account|Creditor|Furnisher|Company)\s*(?:Name)?\s*:\s*/i, '');
    const number = (lines.find((value) => /^Account\s*(?:Number|No\.?|#)\s*:/i.test(value)) || '').replace(/^Account\s*(?:Number|No\.?|#)\s*:\s*/i, '');
    return { account_name: name, account_number: number, account_line: [name, number].filter(Boolean).join(' — '), display_text: item.displayText };
  }).filter((row) => row.account_line || row.display_text);
}
function phone(value: string) { const clean = value.trim(); if (!clean) return 'N/A'; const digits = clean.replace(/\D/g, ''); return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : clean; }
function affidavitItems(source: ParsedSource) {
  const chosen: RenderRow[] = [];
  const seen = new Set<string>();
  bureaus.forEach((bureau) => rows(source.dispute[bureau]).forEach((item) => {
    const key = item.account_line.toUpperCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    chosen.push(item);
  }));
  bureaus.forEach((bureau) => source.inquiry[bureau].forEach((item) => {
    const line = item.displayText.replace(/\s+[-–—]\s+/g, ' — ');
    const key = line.toUpperCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    chosen.push({ account_name: '', account_number: '', account_line: line, display_text: line });
  }));
  return chosen;
}
function placeholders(ctx: MappedAppendixContext): PlaceholderValues {
  const s = ctx.source;
  const date = s.ftcReportDate || ctx.documentDate;
  const accounts = ctx.kind === 'AFFIDAVIT' ? affidavitItems(s) : rows(s.dispute[ctx.bureau]);
  const ftc = s.ftcAccounts.slice(0, MAX_FTC_ACCOUNTS).map((account) => ({ account_name: account.accountName, account_number: account.accountNumber, fraud_began: ftcFraudMonthYearFromReportDate(date), date_discovered: account.dateDiscovered, fraudulent_amount: account.fraudulentAmount, fraud_amount: account.fraudulentAmount }));
  return { consumer_name: s.name, client_name: s.name, name: s.name, consumer_first_name: s.firstName, consumer_middle_name: ctx.kind === 'FTC' ? '' : s.middleName, consumer_last_name: s.lastName, address: s.address.join('\n'), address_inline: s.address.join(' '), address_line_1: s.address[0] || '', address_line_2: s.address.slice(1).join(' '), country: s.country || 'USA', dob: s.dob, ssn: s.ssn, ssn_masked: s.ssn, phone: ctx.kind === 'FTC' ? phone(s.phone) : s.phone, email: ctx.kind === 'FTC' ? '' : s.email, date: ctx.documentDate, letter_date: ctx.documentDate, document_date: ctx.documentDate, affidavit_state: s.affidavitState, affidavit_county: s.affidavitCounty, ftc_report_number: s.ftcReportNumber, ftc_report_date: date, bureau_name: ctx.recipientName, bureau_address: ctx.recipientAddressLines.join('\n'), bureau_address_line_1: ctx.recipientAddressLines[0] || '', bureau_address_line_2: ctx.recipientAddressLines.slice(1).join(' '), accounts, dispute_accounts: accounts, ftc_accounts: ftc, hard_inquiries: s.inquiry[ctx.bureau].map((item) => ({ inquiry_line: item.displayText, display_text: item.displayText })), account_lines: (accounts as RenderRow[]).map((item) => item.account_line).filter(Boolean).join('\n'), ...s.templateFields };
}

function nodes(root: Element, name: string) { return Array.from(root.getElementsByTagNameNS(W, name)); }
function paragraphs(root: Element) { return nodes(root, 'p'); }
function topParagraphs(root: Element) { return Array.from(root.children).filter((node) => node.namespaceURI === W && node.localName === 'p') as Element[]; }
function children(root: Element, name: string) { return Array.from(root.children).filter((node) => node.namespaceURI === W && node.localName === name) as Element[]; }
function texts(root: Element) { return nodes(root, 't'); }
function raw(root: Element) { return texts(root).map((node) => node.textContent || '').join(''); }
function text(root: Element) { return raw(root).replace(/\s+/g, ' ').trim(); }
function put(node: Element, value: string) { node.textContent = value; if (/^\s|\s$/.test(value)) node.setAttributeNS(X, 'xml:space', 'preserve'); else node.removeAttributeNS(X, 'space'); }
function replaceRange(root: Element, start: number, end: number, value: string) { let offset = 0; const spans = texts(root).map((node) => { const from = offset; offset += (node.textContent || '').length; return { node, from, to: offset }; }).filter((span) => span.to > start && span.from < end); if (!spans.length) return; const first = spans[0], last = spans[spans.length - 1]; const before = (first.node.textContent || '').slice(0, Math.max(0, start - first.from)); const after = (last.node.textContent || '').slice(Math.max(0, end - last.from)); put(first.node, before + value + (first === last ? after : '')); spans.slice(1, -1).forEach((span) => put(span.node, '')); if (first !== last) put(last.node, after); }
function captured(root: Element, pattern: RegExp, index: number, value: string) { const valueText = raw(root), match = valueText.match(pattern); if (!match?.[index]) return; const start = (match.index || 0) + match[0].indexOf(match[index]); replaceRange(root, start, start + match[index].length, value); }
function allMatches(root: Element, pattern: RegExp, value: string) { Array.from(raw(root).matchAll(pattern)).reverse().forEach((match) => { if (match.index !== undefined) replaceRange(root, match.index, match.index + match[0].length, value); }); }
function styledRun(root: Element) { return nodes(root, 'r').find((run) => text(run)) || nodes(root, 'r')[0]; }
function lines(paragraph: Element, values: string[]) { const doc = paragraph.ownerDocument, source = styledRun(paragraph) || doc.createElementNS(W, 'w:r'); Array.from(paragraph.children).forEach((node) => { if (!(node.namespaceURI === W && node.localName === 'pPr')) paragraph.removeChild(node); }); values.forEach((value, index) => { const run = source.cloneNode(true) as Element; Array.from(run.children).forEach((node) => { if (!(node.namespaceURI === W && node.localName === 'rPr')) run.removeChild(node); }); if (index) run.appendChild(doc.createElementNS(W, 'w:br')); const textNode = doc.createElementNS(W, 'w:t'); put(textNode, value); run.appendChild(textNode); paragraph.appendChild(run); }); }
function cloneParagraphLike(source: Element, values: string[]) { const paragraph = source.cloneNode(true) as Element; lines(paragraph, values); return paragraph; }
function insertAfter(reference: Element, node: Element) { reference.parentNode?.insertBefore(node, reference.nextSibling); }
function boundaryParagraph(value: string) { return /^\s*(?:I\s+declare|\d+\.\s*Request|Request\s+for\s+Action|\d+\.\s*Oath|Oath\s+and\s+Signature|Sincerely|Date\s*:)/i.test(value); }
function accountLinesForAffidavit(source: ParsedSource) { return affidavitItems(source).map((item) => item.account_line || item.display_text).filter(Boolean); }
function normalizeSecurityNumberFormatting(paragraph: Element, ssn: string) { const safeSsn = ssn.replace(/-/g, '‑'); allMatches(paragraph, /Security\s+num\s*[-‐-‒–—]\s*ber/gi, 'Security number'); allMatches(paragraph, /(?:X{3}|\d{3})[-‐-‒–—](?:X{2}|\d{2})[-‐-‒–—](?:X{4}|\d{4})/gi, safeSsn); }
async function open(file: Blob, label: string, options: AppendixRenderOptions): Promise<Opened> { await checkpoint(options, `Opening ${label} template`, 0, 3); const zip = new PizZip(await file.arrayBuffer()); await checkpoint(options, `Reading ${label} document XML`, 1, 3); const xmlFile = zip.file('word/document.xml'); if (!xmlFile) throw new Error(`${label} DOCX document XML is unavailable.`); const xmlText = xmlFile.asText(), xml = new DOMParser().parseFromString(xmlText, 'application/xml'), body = xml.getElementsByTagNameNS(W, 'body')[0]; if (!body) throw new Error(`${label} DOCX body is unavailable.`); await checkpoint(options, `Template loaded: ${label}`, 2, 3); return { zip, xmlText, xml, body }; }
async function save(opened: Opened, options: AppendixRenderOptions) { await checkpoint(options, 'Serializing DOCX output', 0, 2); opened.zip.file('word/document.xml', new XMLSerializer().serializeToString(opened.xml)); await checkpoint(options, 'Compressing DOCX output', 1, 2); assertActive(options); return hardenGeneratedDocx(opened.zip.generate({ type: 'blob', mimeType: DOCX_MIME, compression: 'STORE' })); }

async function normalizeAffidavit(ctx: MappedAppendixContext, opened: Opened, options: AppendixRenderOptions) {
  const s = ctx.source, all = topParagraphs(opened.body), street = s.address[0] || 'N/A';
  await checkpoint(options, 'Mapping affidavit identity and account anchors', 0, 4);
  const state = all.find((p) => /^State\s+of\s*:/i.test(text(p)));
  const county = all.find((p) => /^County\s+of\s*:/i.test(text(p)));
  const opening = all.find((p) => /^I,\s/i.test(text(p)));
  const personal = all.find((p) => /Personal\s+Information/i.test(text(p)));
  if (state) captured(state, /^(State\s+of\s*:\s*)(.*)$/i, 2, (s.affidavitState || 'N/A').toUpperCase());
  if (county) captured(county, /^(County\s+of\s*:\s*)(.*)$/i, 2, (s.affidavitCounty || 'N/A').toUpperCase());
  if (opening) { captured(opening, /^(I,\s*)(.*?)(\s+residing\s+at\s+)/i, 2, s.name.toUpperCase()); captured(opening, /(\s+residing\s+at\s+)(.*?)(\s+being\s+duly)/i, 2, street); }
  if (personal) { captured(personal, /(current\s+address\s+is\s+)(.*?)(\.\s*My\s+(?:Social\s+)?Security)/i, 2, street); captured(personal, /((?:Social\s+)?Security\s+number\s+is\s*)(.*)$/i, 2, s.ssn); normalizeSecurityNumberFormatting(personal, s.ssn); }
  const accountLines = accountLinesForAffidavit(s);
  if (!accountLines.length) throw new Error('Affidavit account section cannot render because no dispute accounts were found in Source Data.');
  const accountHeadingIndex = all.findIndex((p) => /^Account\s+Information\s*:?$/i.test(text(p)) || /Account\s+Information\s*:/i.test(text(p)));
  if (accountHeadingIndex >= 0) {
    const heading = all[accountHeadingIndex];
    const existingAccountParagraphs: Element[] = [];
    for (const paragraph of all.slice(accountHeadingIndex + 1)) {
      const value = text(paragraph);
      if (boundaryParagraph(value)) break;
      existingAccountParagraphs.push(paragraph);
    }
    const prototype = existingAccountParagraphs.find((paragraph) => text(paragraph)) || heading;
    existingAccountParagraphs.forEach((paragraph) => paragraph.parentNode?.removeChild(paragraph));
    insertAfter(heading, cloneParagraphLike(prototype, accountLines));
  } else {
    const anchor = all.find((p) => /Account\s+Name\s*[-–—]\s*Account\s*(?:Number|#)/i.test(raw(p)));
    if (anchor) lines(anchor, accountLines);
    else throw new Error('Affidavit template is missing an Account Information section or Account Name - Account number anchor.');
  }
  all.forEach((paragraph) => {
    allMatches(paragraph, /Account\s+Name\s*[-–—]\s*Account\s*(?:Number|#)/gi, accountLines.join('\n'));
    allMatches(paragraph, /\{\{\s*account_lines\s*\}\}/gi, accountLines.join('\n'));
    allMatches(paragraph, /\{\{\s*accounts\.lines\s*\}\}/gi, accountLines.join('\n'));
  });
  const signature = all.find((p) => text(p).toUpperCase() === s.name.toUpperCase() || /^JAZZMINE\s+LAMBERT$/i.test(text(p)));
  if (signature) lines(signature, [s.name]);
  const date = all.find((p) => /^Date\s*:/i.test(text(p)));
  if (date) captured(date, /^(Date\s*:\s*)(.*)$/i, 2, ctx.documentDate);
  await checkpoint(options, 'Affidavit account anchors mapped in-place', 4, 4);
  return save(opened, options);
}

async function affidavit(ctx: MappedAppendixContext, opened: Opened, options: AppendixRenderOptions) {
  return normalizeAffidavit(ctx, opened, options);
}

async function ftc(ctx: MappedAppendixContext, opened: Opened, options: AppendixRenderOptions) {
  const values = placeholders(ctx);
  paragraphs(opened.body).forEach((paragraph) => {
    Object.entries(values).forEach(([key, value]) => {
      if (typeof value === 'string') allMatches(paragraph, new RegExp(`\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'gi'), value);
    });
  });
  return save(opened, options);
}

async function postProcessAffidavit(blob: Blob, context: MappedAppendixContext, options: AppendixRenderOptions) {
  if (context.kind !== 'AFFIDAVIT') return blob;
  const opened = await open(blob, 'Affidavit generated output', options);
  return normalizeAffidavit(context, opened, options);
}

export async function renderMappedAppendix(template: File, context: MappedAppendixContext, options: AppendixRenderOptions = {}) {
  const controller = new AbortController();
  activeController = controller;
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  const effective = { ...options, signal: controller.signal };
  const label = context.kind === 'AFFIDAVIT' ? 'Affidavit' : 'FTC Report';
  try {
    await checkpoint(effective, `Checking ${label} renderer-v2 gate`, 0, 2);
    const v2 = await tryRenderDynamicAppendixTemplateV2({ template, context, rendererMode: options.rendererMode });
    if (v2) {
      await checkpoint(effective, `${label} renderer-v2 complete (${v2.engine.quality.tier}/${v2.engine.quality.score})`, 2, 2);
      return postProcessAffidavit(v2.blob, context, effective);
    }
    const opened = await open(template, label, effective);
    if (opened.xmlText.includes('{{')) {
      await checkpoint(effective, `Mapping ${label} placeholders`, 0, 2);
      const output = await renderDocxTemplate(template, placeholders(context));
      await checkpoint(effective, `${label} document complete`, 2, 2);
      return postProcessAffidavit(output, context, effective);
    }
    return context.kind === 'AFFIDAVIT' ? affidavit(context, opened, effective) : ftc(context, opened, effective);
  } finally {
    if (activeController === controller) activeController = null;
  }
}
