import { anchorPolicy, aliasMatches, TEMPLATE_ANCHOR_ALIAS_REGISTRY, tokenSimilarity, type TemplateAnchorKind } from './anchor-alias-registry';
import type { DocxStructureMap, DocxParagraphNode } from './docx-structure-reader';
import { activeManagerRules, paragraphFingerprint, type TemplateManagerRule } from './template-rule-store';

export type DetectedAnchorSource = 'content-control' | 'bookmark' | 'exact-heading' | 'alias-heading' | 'paragraph-pattern' | 'manager-rule' | 'fallback-created';

export type DetectedAnchor = {
  kind: TemplateAnchorKind;
  paragraphIndex: number;
  confidence: number;
  source: DetectedAnchorSource;
  matchedText: string;
  reason: string;
};

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function hasNegativeAlias(paragraph: DocxParagraphNode, kind: TemplateAnchorKind) {
  const rule = anchorPolicy(kind);
  return Boolean(rule.negativeAliases?.some((alias) => aliasMatches(paragraph.normalizedText, alias)));
}

function candidateFromAlias(paragraph: DocxParagraphNode, kind: TemplateAnchorKind): DetectedAnchor | null {
  if (!paragraph.text || hasNegativeAlias(paragraph, kind)) return null;
  const rule = anchorPolicy(kind);
  let best = 0;
  let bestAlias = '';
  for (const alias of rule.aliases) {
    const exact = aliasMatches(paragraph.normalizedText, alias);
    const score = exact ? 1 : tokenSimilarity(paragraph.normalizedText, alias);
    if (score > best) {
      best = score;
      bestAlias = alias;
    }
  }
  if (best >= 0.98) {
    return { kind, paragraphIndex: paragraph.index, confidence: 0.96, source: 'exact-heading', matchedText: paragraph.text, reason: `Exact/contained alias matched: ${bestAlias}` };
  }
  if (best >= rule.confidenceFloor) {
    return { kind, paragraphIndex: paragraph.index, confidence: clampConfidence(best), source: 'alias-heading', matchedText: paragraph.text, reason: `Semantic alias matched: ${bestAlias}` };
  }
  return null;
}

function hasNearbyAccountPattern(paragraphs: DocxParagraphNode[], index: number) {
  const window = paragraphs.slice(Math.max(0, index - 1), Math.min(paragraphs.length, index + 5));
  const hasAccountName = window.some((paragraph) => /\b(?:ACCOUNT|CREDITOR)\s+NAME\s*:/i.test(paragraph.text));
  const hasAccountNumber = window.some((paragraph) => /\bACCOUNT\s+NUMBER\s*:/i.test(paragraph.text));
  const hasIdentityTheftStatement = window.some((paragraph) => /identity theft|unauthori[sz]ed|not opened|not authorized/i.test(paragraph.text));
  return { hasAccountName, hasAccountNumber, hasIdentityTheftStatement };
}

function patternCandidate(paragraphs: DocxParagraphNode[], paragraph: DocxParagraphNode, kind: TemplateAnchorKind): DetectedAnchor | null {
  if (kind !== 'FRAUDULENT_ACCOUNTS' && kind !== 'DISPUTE_ACCOUNTS') return null;
  const pattern = hasNearbyAccountPattern(paragraphs, paragraph.index);
  if (pattern.hasAccountName && pattern.hasAccountNumber) {
    return {
      kind,
      paragraphIndex: paragraph.index,
      confidence: pattern.hasIdentityTheftStatement ? 0.88 : 0.8,
      source: 'paragraph-pattern',
      matchedText: paragraph.text,
      reason: 'Nearby Account Name and Account Number pattern found.'
    };
  }
  if (/\baccounts? identified below\b|\bnot opened\b|\bnot authorized\b/i.test(paragraph.text) && pattern.hasAccountName) {
    return { kind, paragraphIndex: paragraph.index, confidence: 0.74, source: 'paragraph-pattern', matchedText: paragraph.text, reason: 'Introductory account language and account block pattern found.' };
  }
  return null;
}

function contentControlCandidate(structure: DocxStructureMap, kind: TemplateAnchorKind): DetectedAnchor | null {
  const target = kind.toLowerCase().replace(/_/g, '-');
  const paragraph = structure.paragraphs.find((node) => node.contentControlTags.some((tag) => tag.toLowerCase().includes(target)) || node.bookmarkNames.some((tag) => tag.toLowerCase().includes(target)));
  if (!paragraph) return null;
  return {
    kind,
    paragraphIndex: paragraph.index,
    confidence: 1,
    source: paragraph.contentControlTags.length ? 'content-control' : 'bookmark',
    matchedText: paragraph.text,
    reason: 'Explicit DOCX content control or bookmark anchor found.'
  };
}

function managerRuleCandidate(structure: DocxStructureMap, rule: TemplateManagerRule): DetectedAnchor | null {
  const paragraph = typeof rule.paragraphIndex === 'number' ? structure.paragraphs[rule.paragraphIndex] : null;
  if (paragraph) {
    return {
      kind: rule.anchorKind,
      paragraphIndex: paragraph.index,
      confidence: rule.confidence || 1,
      source: 'manager-rule',
      matchedText: paragraph.text,
      reason: 'Manager-pinned anchor rule matched paragraph index.'
    };
  }
  if (rule.paragraphFingerprint) {
    const fingerprintMatch = structure.paragraphs.find((node) => paragraphFingerprint(node.text) === rule.paragraphFingerprint);
    if (fingerprintMatch) {
      return {
        kind: rule.anchorKind,
        paragraphIndex: fingerprintMatch.index,
        confidence: rule.confidence || 0.96,
        source: 'manager-rule',
        matchedText: fingerprintMatch.text,
        reason: 'Manager-pinned anchor rule matched paragraph fingerprint.'
      };
    }
  }
  return null;
}

function signatureFallback(structure: DocxStructureMap, kind: TemplateAnchorKind): DetectedAnchor | null {
  const policy = anchorPolicy(kind);
  if (!policy.canAutoCreate) return null;
  const signature = structure.paragraphs.find((paragraph) => TEMPLATE_ANCHOR_ALIAS_REGISTRY.find((rule) => rule.kind === 'SIGNATURE')?.aliases.some((alias) => aliasMatches(paragraph.text, alias)));
  if (!signature) return null;
  return {
    kind,
    paragraphIndex: Math.max(0, signature.index - 1),
    confidence: 0.62,
    source: 'fallback-created',
    matchedText: signature.text,
    reason: 'No confident anchor found; fallback can create a section before signature.'
  };
}

export function detectTemplateAnchors(structure: DocxStructureMap, managerRules: TemplateManagerRule[] = []): DetectedAnchor[] {
  const detected: DetectedAnchor[] = [];
  const activeRules = activeManagerRules(managerRules);
  for (const rule of activeRules) {
    const candidate = managerRuleCandidate(structure, rule);
    if (candidate) detected.push(candidate);
  }
  for (const rule of TEMPLATE_ANCHOR_ALIAS_REGISTRY) {
    const explicit = contentControlCandidate(structure, rule.kind);
    if (explicit) detected.push(explicit);
    for (const paragraph of structure.paragraphs) {
      const aliasCandidate = candidateFromAlias(paragraph, rule.kind);
      if (aliasCandidate) detected.push(aliasCandidate);
      const pattern = patternCandidate(structure.paragraphs, paragraph, rule.kind);
      if (pattern) detected.push(pattern);
    }
    const fallback = signatureFallback(structure, rule.kind);
    if (fallback) detected.push(fallback);
  }
  return detected
    .sort((a, b) => b.confidence - a.confidence)
    .filter((candidate, index, all) => all.findIndex((other) => other.kind === candidate.kind && other.paragraphIndex === candidate.paragraphIndex && other.source === candidate.source) === index);
}

export function bestDetectedAnchor(anchors: DetectedAnchor[], kind: TemplateAnchorKind) {
  return anchors.filter((anchor) => anchor.kind === kind).sort((a, b) => b.confidence - a.confidence)[0] || null;
}
