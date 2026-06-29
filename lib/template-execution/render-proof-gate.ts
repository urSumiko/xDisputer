import PizZip from 'pizzip';
import type { Bureau, LetterRoute, ParsedSource } from '../letter-engine';
import type { TemplateDocumentKind } from '../template-contracts';

export type TemplateRenderProofInput = {
  kind: TemplateDocumentKind;
  blob: Blob;
  engine: string;
  rendererMode: string;
  parsed: ParsedSource;
  route?: LetterRoute | null;
  bureau?: Bureau;
  manifest?: Record<string, unknown> | null;
};

export type TemplateRenderProof = {
  status: 'PASS' | 'WARNING';
  warnings: string[];
  inspectedParts: string[];
  unresolvedPlaceholderCount: number;
  requiredPlaceholderCount: number;
};

const WORD_XML_PART = /^word\/(?:document|header\d+|footer\d+)\.xml$/i;
const PLACEHOLDER_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}|\[\[\s*([^\[\]]+?)\s*\]\]|«\s*([^«»]+?)\s*»/g;
const TEXT_NODE_PATTERN = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&');
}

function tokenFromMatch(match: RegExpExecArray) {
  return String(match[1] || match[2] || match[3] || '').trim();
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isReviewOnlyPlaceholder(alias: string) {
  return /^(?:optional\.|review\.|note\.|comment\.|debug\.|if\.|\/|#)/i.test(alias.trim());
}

function textFromXml(xml: string) {
  return Array.from(xml.matchAll(TEXT_NODE_PATTERN)).map((match) => decodeXml(match[1] || '')).join(' ');
}

function unresolvedRequiredPlaceholders(xmlParts: string[]) {
  const unresolved: string[] = [];
  const required: string[] = [];

  xmlParts.forEach((xml) => {
    Array.from(xml.matchAll(PLACEHOLDER_PATTERN)).forEach((match) => {
      const alias = tokenFromMatch(match);
      if (!alias) return;
      unresolved.push(alias);
      if (!isReviewOnlyPlaceholder(alias)) required.push(alias);
    });
  });

  return { unresolved, required };
}

function firstMeaningfulRouteNeedle(route: LetterRoute | null | undefined) {
  const first = route?.items?.[0]?.displayText || '';
  const lines = first.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const named = lines.find((line) => /^(?:Account|Creditor|Furnisher|Company)\s*(?:Name)?\s*:/i.test(line));
  const clean = (named || lines[0] || '').replace(/^(?:Account|Creditor|Furnisher|Company)\s*(?:Name)?\s*:\s*/i, '').replace(/\s+[—–-]\s+.*$/, '').trim();
  return clean.length >= 4 ? clean : '';
}

function assertManifestNotBlocked(manifest: Record<string, unknown> | null | undefined, blockers: string[]) {
  const quality = manifest && typeof manifest === 'object' ? (manifest as Record<string, unknown>).dynamicTemplateQuality : null;
  if (quality && typeof quality === 'object') {
    const status = (quality as Record<string, unknown>).status;
    if (status === 'BLOCKED' || status === 'DEGRADED') blockers.push(`Template quality gate returned ${String(status)}.`);
  }

  const renderer = manifest && typeof manifest === 'object' ? (manifest as Record<string, unknown>).dynamicTemplateRenderer : null;
  if (renderer && typeof renderer === 'object') {
    const status = (renderer as Record<string, unknown>).status;
    if (status === 'FAIL') blockers.push('Template render validation failed.');
  }
}

export async function assertTemplateRenderProof(input: TemplateRenderProofInput): Promise<TemplateRenderProof> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!input.blob || input.blob.size < 512) {
    blockers.push(`${input.kind} output from ${input.engine} is empty or too small to be a valid DOCX.`);
  }

  let zip: PizZip | null = null;
  try {
    zip = new PizZip(await input.blob.arrayBuffer());
  } catch (error) {
    blockers.push(`${input.kind} output from ${input.engine} is not a readable DOCX ZIP: ${error instanceof Error ? error.message : 'invalid archive'}.`);
  }

  const inspectedParts: string[] = [];
  const xmlParts: string[] = [];
  if (zip) {
    for (const partName of Object.keys(zip.files).filter((name) => WORD_XML_PART.test(name))) {
      const file = zip.file(partName);
      if (!file) continue;
      inspectedParts.push(partName);
      xmlParts.push(file.asText());
    }

    if (!zip.file('word/document.xml')) blockers.push(`${input.kind} output is missing word/document.xml.`);
    if (!inspectedParts.length) blockers.push(`${input.kind} output has no inspectable Word XML parts.`);
  }

  const unresolved = unresolvedRequiredPlaceholders(xmlParts);
  if (unresolved.required.length) {
    blockers.push(`${input.kind} output still contains unresolved required placeholder(s): ${Array.from(new Set(unresolved.required)).slice(0, 10).join(', ')}.`);
  }
  if (unresolved.unresolved.length && !unresolved.required.length) {
    warnings.push(`${input.kind} output contains ${unresolved.unresolved.length} optional/review placeholder(s).`);
  }

  const renderedText = normalizeText(xmlParts.map(textFromXml).join(' '));
  const clientName = input.parsed.name?.trim();
  if (clientName && !renderedText.includes(normalizeText(clientName))) {
    const message = `${input.kind} output does not visibly contain the parsed client name "${clientName}".`;
    if (input.kind === 'FTC') warnings.push(message);
    else blockers.push(message);
  }

  const routeNeedle = firstMeaningfulRouteNeedle(input.route);
  if (routeNeedle && !renderedText.includes(normalizeText(routeNeedle))) {
    warnings.push(`${input.kind} output may be missing the first routed account/inquiry marker "${routeNeedle}".`);
  }

  assertManifestNotBlocked(input.manifest, blockers);

  if (blockers.length) {
    throw new Error(`Template render proof failed: ${blockers.join(' ')}`);
  }

  return {
    status: warnings.length ? 'WARNING' : 'PASS',
    warnings,
    inspectedParts,
    unresolvedPlaceholderCount: unresolved.unresolved.length,
    requiredPlaceholderCount: unresolved.required.length
  };
}
