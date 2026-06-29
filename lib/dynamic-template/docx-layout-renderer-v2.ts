import PizZip from 'pizzip';
import { DOCX_MIME } from '../docx-renderer';
import { assertDocxLayoutRendererV2Allowed, type DynamicTemplateRendererMode } from './renderer-mode';
import type { DynamicRenderPlan, DynamicRenderPlanOperation, DynamicRenderPlanValue } from './mapping-engine';

export type DocxLayoutRendererV2AppliedOperation = {
  kind: string;
  alias?: string | null;
  canonicalKey?: string | null;
  partName?: string | null;
  replacements: number;
  note: string;
};

export type DocxLayoutRendererV2SkippedOperation = {
  kind: string;
  alias?: string | null;
  canonicalKey?: string | null;
  partName?: string | null;
  reason: string;
};

export type DocxLayoutRendererV2Result = {
  blob: Blob;
  proof: {
    renderer: 'DOCX_LAYOUT_RENDERER_V2';
    rendererVersion: '0.2.1-es5-safe-split-runs';
    rendererMode: DynamicTemplateRendererMode;
    planStatus: DynamicRenderPlan['status'];
    mutatedParts: string[];
    appliedOperations: DocxLayoutRendererV2AppliedOperation[];
    skippedOperations: DocxLayoutRendererV2SkippedOperation[];
    warnings: string[];
    blockers: string[];
  };
};

type TextNodeRange = {
  fullStart: number;
  fullEnd: number;
  bodyStart: number;
  bodyEnd: number;
  attributes: string;
  rawText: string;
  text: string;
  textStart: number;
  textEnd: number;
};

type XmlEdit = {
  start: number;
  end: number;
  value: string;
};

const WORD_XML_PART = /^word\/(?:document|header\d+|footer\d+)\.xml$/i;
const TABLE_ROW_PATTERN = /<w:tr[\s\S]*?<\/w:tr>/gi;
const PARAGRAPH_PATTERN = /<w:p[\s\S]*?<\/w:p>/gi;
const TEXT_NODE_PATTERN = /<w:t\b([^>]*)>([\s\S]*?)<\/w:t>/gi;
const PLACEHOLDER_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}|\[\[\s*([^\[\]]+?)\s*\]\]|«\s*([^«»]+?)\s*»/g;

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeAlias(value: string) {
  let normalized = value
    .replace(/[{}\[\]«»]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .trim()
    .toLowerCase();

  normalized = normalized.replace(/^#/, '').replace(/^\//, '');
  normalized = normalized.replace(/^each\./i, '').replace(/^if\./i, '');
  normalized = normalized.replace(/^account\./i, '').replace(/^inquiry\./i, '');

  return normalized;
}

function aliasPatternBody(alias: string) {
  const cleaned = alias.trim();
  const variants = Array.from(new Set([
    cleaned,
    cleaned.replace(/^#/, ''),
    cleaned.replace(/^\//, ''),
    normalizeAlias(cleaned),
    cleaned.startsWith('#') ? cleaned.replace(/^#/, '#if.') : `#${cleaned}`,
    cleaned.startsWith('/') ? cleaned : `/${cleaned}`
  ].filter(Boolean)));

  return variants.map((variant) => variant.split(/\s+/).map(escapeRegExp).join('\\s+')).join('|');
}

function aliasRegex(alias: string) {
  const body = aliasPatternBody(alias);
  return new RegExp(`\\{\\{\\s*(?:${body})\\s*\\}\\}|\\[\\[\\s*(?:${body})\\s*\\]\\]|«\\s*(?:${body})\\s*»`, 'g');
}

function aliasTextRegex(alias: string) {
  const body = aliasPatternBody(alias);
  return new RegExp(`\\{\\{\\s*(?:${body})\\s*\\}\\}|\\[\\[\\s*(?:${body})\\s*\\]\\]|«\\s*(?:${body})\\s*»`, 'g');
}

function blockStartRegex(alias: string) {
  const normalized = normalizeAlias(alias);
  const body = [`#${normalized}`, `#each.${normalized}`, `#if.${normalized}`, alias].map(escapeRegExp).join('|');
  return new RegExp(`\\{\\{\\s*(?:${body})\\s*\\}\\}|\\[\\[\\s*(?:${body})\\s*\\]\\]|«\\s*(?:${body})\\s*»`, 'i');
}

function blockEndRegex(alias: string) {
  const normalized = normalizeAlias(alias);
  const body = [`/${normalized}`, alias.replace(/^#/, '/')].map(escapeRegExp).join('|');
  return new RegExp(`\\{\\{\\s*(?:${body})\\s*\\}\\}|\\[\\[\\s*(?:${body})\\s*\\]\\]|«\\s*(?:${body})\\s*»`, 'i');
}

function tokenFromMatch(match: RegExpExecArray) {
  return String(match[1] || match[2] || match[3] || '').trim();
}

function allMatches(value: string, regex: RegExp) {
  return Array.from(value.matchAll(regex));
}

function valueToText(value: DynamicRenderPlanValue | undefined) {
  if (!value) return '';
  if (typeof value.value === 'boolean') return '';
  if (typeof value.value === 'string') return value.value;
  if (Array.isArray(value.value)) {
    if (!value.value.length) return '';
    if (typeof value.value[0] === 'string') return (value.value as string[]).join('\n');
    return (value.value as Array<Record<string, string | string[]>>)
      .map((record) => String(record.display_text || record.account_line || record.inquiry_line || Object.values(record).flat().join(' ')))
      .filter(Boolean)
      .join('\n\n');
  }
  return '';
}

function textForXml(value: DynamicRenderPlanValue | undefined) {
  return escapeXml(valueToText(value)).replace(/\n/g, '&#10;');
}

function recordValue(record: Record<string, string | string[]>, alias: string) {
  const key = normalizeAlias(alias);
  const direct = record[key];
  if (Array.isArray(direct)) return direct.join('\n');
  if (typeof direct === 'string') return direct;

  const fallbackKeys = ['display_text', 'account_line', 'inquiry_line', 'statement_line'];
  for (const fallback of fallbackKeys) {
    const value = record[fallback];
    if (Array.isArray(value)) return value.join('\n');
    if (typeof value === 'string' && value.trim()) return value;
  }

  return '';
}

function recordsForOperation(operation: DynamicRenderPlanOperation) {
  const raw = operation.value?.value;
  if (!Array.isArray(raw)) return [];
  if (!raw.length) return [];
  if (typeof raw[0] === 'string') {
    return (raw as string[]).map((line, index) => ({ index: String(index + 1), number: String(index + 1), display_text: line }));
  }
  return raw as Array<Record<string, string | string[]>>;
}

function applyEdits(xml: string, edits: XmlEdit[]) {
  return edits
    .sort((a, b) => b.start - a.start)
    .reduce((current, edit) => current.slice(0, edit.start) + edit.value + current.slice(edit.end), xml);
}

function collectTextNodes(xml: string) {
  const nodes: TextNodeRange[] = [];
  let aggregate = '';

  allMatches(xml, TEXT_NODE_PATTERN).forEach((match) => {
    const full = match[0];
    const attributes = match[1] || '';
    const rawText = match[2] || '';
    const fullStart = match.index || 0;
    const bodyStart = fullStart + full.indexOf('>') + 1;
    const bodyEnd = fullStart + full.lastIndexOf('</w:t>');
    const text = decodeXml(rawText);
    const textStart = aggregate.length;
    aggregate += text;
    const textEnd = aggregate.length;

    nodes.push({ fullStart, fullEnd: fullStart + full.length, bodyStart, bodyEnd, attributes, rawText, text, textStart, textEnd });
  });

  return { nodes, aggregate };
}

function replaceSplitAliasOnce(xml: string, alias: string, replacementXml: string) {
  const { nodes, aggregate } = collectTextNodes(xml);
  const regex = aliasTextRegex(alias);
  const matches = allMatches(aggregate, regex);
  const match = matches.at(-1);

  if (!match || typeof match.index !== 'number') return { xml, replacements: 0 };

  const start = match.index;
  const end = start + match[0].length;
  const affected = nodes.filter((node) => node.textEnd > start && node.textStart < end);

  if (!affected.length) return { xml, replacements: 0 };

  const edits: XmlEdit[] = [];
  const first = affected[0];
  const last = affected[affected.length - 1];

  for (const node of affected) {
    const localStart = Math.max(0, start - node.textStart);
    const localEnd = Math.min(node.text.length, end - node.textStart);
    let nextText = '';

    if (node === first && node === last) {
      nextText = `${node.text.slice(0, localStart)}${decodeXml(replacementXml)}${node.text.slice(localEnd)}`;
    } else if (node === first) {
      nextText = `${node.text.slice(0, localStart)}${decodeXml(replacementXml)}`;
    } else if (node === last) {
      nextText = node.text.slice(localEnd);
    }

    edits.push({ start: node.bodyStart, end: node.bodyEnd, value: escapeXml(nextText).replace(/\n/g, '&#10;') });
  }

  return { xml: applyEdits(xml, edits), replacements: 1 };
}

function replaceSplitAlias(xml: string, alias: string, replacementXml: string) {
  let output = xml;
  let replacements = 0;
  let guard = 0;

  while (guard < 100) {
    const result = replaceSplitAliasOnce(output, alias, replacementXml);
    if (!result.replacements) break;
    output = result.xml;
    replacements += result.replacements;
    guard += 1;
  }

  return { xml: output, replacements };
}

function replaceAlias(xml: string, alias: string, replacement: string) {
  const regex = aliasRegex(alias);
  const count = (xml.match(regex) || []).length;
  if (count) return { xml: xml.replace(regex, replacement), replacements: count, mode: 'contiguous' as const };

  const split = replaceSplitAlias(xml, alias, replacement);
  return { ...split, mode: split.replacements ? 'split-run' as const : 'none' as const };
}

function replaceInlineOperation(xml: string, operation: DynamicRenderPlanOperation) {
  if (!operation.alias) return { xml, replacements: 0, mode: 'none' as const };
  return replaceAlias(xml, operation.alias, textForXml(operation.value));
}

function booleanValue(operation: DynamicRenderPlanOperation) {
  return Boolean(operation.value?.value);
}

function paragraphRanges(xml: string) {
  return allMatches(xml, PARAGRAPH_PATTERN).map((match) => ({
    start: match.index || 0,
    end: (match.index || 0) + match[0].length,
    xml: match[0]
  }));
}

function removeBlockMarkers(xml: string, alias: string) {
  return xml.replace(blockStartRegex(alias), '').replace(blockEndRegex(alias), '');
}

function replaceConditionalOperation(xml: string, operation: DynamicRenderPlanOperation) {
  if (!operation.alias) return { xml, replacements: 0, mode: 'none' as const };

  const paragraphs = paragraphRanges(xml);
  const startIndex = paragraphs.findIndex((paragraph) => blockStartRegex(operation.alias || '').test(paragraph.xml));

  if (startIndex >= 0) {
    const endIndex = paragraphs.findIndex((paragraph, index) => index >= startIndex && blockEndRegex(operation.alias || '').test(paragraph.xml));

    if (endIndex >= startIndex) {
      const keep = booleanValue(operation);
      const replacement = keep
        ? paragraphs.slice(startIndex, endIndex + 1).map((paragraph) => removeBlockMarkers(paragraph.xml, operation.alias || '')).join('')
        : '';

      return {
        xml: xml.slice(0, paragraphs[startIndex].start) + replacement + xml.slice(paragraphs[endIndex].end),
        replacements: 1,
        mode: keep ? 'conditional-kept' as const : 'conditional-removed' as const
      };
    }
  }

  const marker = replaceAlias(xml, operation.alias, '');
  return { ...marker, mode: marker.mode === 'none' ? 'none' as const : 'conditional-marker-cleanup' as const };
}

function replaceRecordTokens(rowXml: string, record: Record<string, string | string[]>) {
  let output = rowXml;
  const matches = allMatches(rowXml, PLACEHOLDER_PATTERN);

  for (const match of matches) {
    const alias = tokenFromMatch(match);
    const replacement = escapeXml(recordValue(record, alias)).replace(/\n/g, '&#10;');
    output = replaceAlias(output, alias, replacement).xml;
  }

  return output;
}

function cloneTableRowOperation(xml: string, operation: DynamicRenderPlanOperation) {
  const records = recordsForOperation(operation);
  if (!records.length || !operation.alias) return { xml, replacements: 0, mode: 'none' as const };

  let rowNumber = 0;
  let replacements = 0;
  const next = xml.replace(TABLE_ROW_PATTERN, (rowXml) => {
    rowNumber += 1;
    const explicitIndexMatches = operation.tableRowIndex && rowNumber === operation.tableRowIndex;
    const aliasMatches = aliasRegex(operation.alias || '').test(rowXml) || blockStartRegex(operation.alias || '').test(rowXml);

    if (!explicitIndexMatches && !aliasMatches) return rowXml;

    replacements += 1;
    return records.map((record) => removeBlockMarkers(replaceRecordTokens(rowXml, record), operation.alias || '')).join('');
  });

  return { xml: next, replacements, mode: replacements ? 'table-row-clone' as const : 'none' as const };
}

function cloneParagraphBlockOperation(xml: string, operation: DynamicRenderPlanOperation) {
  const records = recordsForOperation(operation);
  if (!records.length || !operation.alias) return { xml, replacements: 0, mode: 'none' as const };

  const paragraphs = paragraphRanges(xml);
  const startIndex = paragraphs.findIndex((paragraph) => blockStartRegex(operation.alias || '').test(paragraph.xml));
  if (startIndex < 0) return { xml, replacements: 0, mode: 'none' as const };

  const endIndex = paragraphs.findIndex((paragraph, index) => index > startIndex && blockEndRegex(operation.alias || '').test(paragraph.xml));
  if (endIndex < 0) return { xml, replacements: 0, mode: 'none' as const };

  const prototype = paragraphs.slice(startIndex + 1, endIndex).map((paragraph) => paragraph.xml).join('') || removeBlockMarkers(paragraphs[startIndex].xml, operation.alias);
  const rendered = records.map((record) => replaceRecordTokens(prototype, record)).join('');

  return {
    xml: xml.slice(0, paragraphs[startIndex].start) + rendered + xml.slice(paragraphs[endIndex].end),
    replacements: 1,
    mode: 'paragraph-block-clone' as const
  };
}

function replaceParagraphRepeatOperation(xml: string, operation: DynamicRenderPlanOperation) {
  if (!operation.alias) return { xml, replacements: 0, mode: 'none' as const };

  const block = cloneParagraphBlockOperation(xml, operation);
  if (block.replacements) return block;

  const marker = replaceAlias(xml, operation.alias, textForXml(operation.value));
  return { ...marker, mode: marker.mode === 'none' ? 'none' as const : 'repeat-placeholder-replace' as const };
}

function renderPart(xml: string, operations: DynamicRenderPlanOperation[]) {
  let output = xml;
  const applied: DocxLayoutRendererV2AppliedOperation[] = [];
  const skipped: DocxLayoutRendererV2SkippedOperation[] = [];

  for (const operation of operations) {
    let result = { xml: output, replacements: 0, mode: 'none' as string };

    if (operation.kind === 'INLINE_REPLACE' || operation.kind === 'MULTILINE_REPLACE') {
      result = replaceInlineOperation(output, operation);
    } else if (operation.kind === 'CONDITIONAL_SECTION') {
      result = replaceConditionalOperation(output, operation);
    } else if (operation.kind === 'TABLE_ROW_CLONE') {
      result = cloneTableRowOperation(output, operation);
    } else if (operation.kind === 'REPEAT_BLOCK') {
      result = replaceParagraphRepeatOperation(output, operation);
    } else {
      skipped.push({
        kind: operation.kind,
        alias: operation.alias || null,
        canonicalKey: operation.canonicalKey || null,
        partName: operation.partName || null,
        reason: 'Operation kind is not applicable to DOCX XML mutation.'
      });
      continue;
    }

    output = result.xml;

    if (result.replacements > 0) {
      applied.push({
        kind: operation.kind,
        alias: operation.alias || null,
        canonicalKey: operation.canonicalKey || null,
        partName: operation.partName || null,
        replacements: result.replacements,
        note: result.mode === 'table-row-clone'
          ? 'Cloned existing table row prototype and replaced placeholders inside each clone.'
          : result.mode === 'paragraph-block-clone'
            ? 'Cloned explicit paragraph block between start/end markers while preserving prototype XML.'
            : result.mode === 'split-run'
              ? 'Repaired a placeholder split across Word text runs and replaced it while preserving surrounding runs.'
              : result.mode === 'conditional-removed'
                ? 'Removed an explicit conditional block because its source condition was false.'
                : result.mode === 'conditional-kept'
                  ? 'Kept an explicit conditional block and removed only its markers.'
                  : 'Replaced placeholder text in-place while preserving surrounding DOCX XML.'
      });
    } else {
      skipped.push({
        kind: operation.kind,
        alias: operation.alias || null,
        canonicalKey: operation.canonicalKey || null,
        partName: operation.partName || null,
        reason: 'No matching placeholder, explicit block, or table-row prototype was found in this XML part.'
      });
    }
  }

  return { xml: output, applied, skipped };
}

function operationsForPart(plan: DynamicRenderPlan, partName: string) {
  return plan.operations.filter((operation) => operation.partName === partName);
}

export async function renderDocxLayoutV2(input: {
  template: File;
  plan: DynamicRenderPlan;
  rendererMode: DynamicTemplateRendererMode;
}): Promise<DocxLayoutRendererV2Result> {
  assertDocxLayoutRendererV2Allowed(input.rendererMode);

  if (input.plan.status === 'BLOCKED') {
    throw new Error(`DOCX layout renderer v2 refused to render a blocked plan: ${input.plan.blockers.join(' ')}`);
  }

  if (input.plan.status === 'STATIC') {
    return {
      blob: input.template,
      proof: {
        renderer: 'DOCX_LAYOUT_RENDERER_V2',
        rendererVersion: '0.2.1-es5-safe-split-runs',
        rendererMode: input.rendererMode,
        planStatus: input.plan.status,
        mutatedParts: [],
        appliedOperations: [],
        skippedOperations: [],
        warnings: ['Static packet component returned unchanged.'],
        blockers: []
      }
    };
  }

  const zip = new PizZip(await input.template.arrayBuffer());
  const mutatedParts: string[] = [];
  const appliedOperations: DocxLayoutRendererV2AppliedOperation[] = [];
  const skippedOperations: DocxLayoutRendererV2SkippedOperation[] = [];

  for (const partName of Object.keys(zip.files).filter((name) => WORD_XML_PART.test(name))) {
    const file = zip.file(partName);
    if (!file) continue;

    const operations = operationsForPart(input.plan, partName);
    if (!operations.length) continue;

    const originalXml = file.asText();
    const rendered = renderPart(originalXml, operations);

    if (rendered.xml !== originalXml) {
      zip.file(partName, rendered.xml);
      mutatedParts.push(partName);
    }

    appliedOperations.push(...rendered.applied);
    skippedOperations.push(...rendered.skipped);
  }

  const blob = zip.generate({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' });

  return {
    blob,
    proof: {
      renderer: 'DOCX_LAYOUT_RENDERER_V2',
      rendererVersion: '0.2.1-es5-safe-split-runs',
      rendererMode: input.rendererMode,
      planStatus: input.plan.status,
      mutatedParts,
      appliedOperations,
      skippedOperations,
      warnings: [
        ...input.plan.warnings,
        skippedOperations.length ? `${skippedOperations.length} operation(s) were skipped because no matching placeholder, explicit block, or table-row prototype was found.` : ''
      ].filter(Boolean),
      blockers: input.plan.blockers
    }
  };
}
