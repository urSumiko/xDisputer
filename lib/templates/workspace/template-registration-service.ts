import type { DynamicTemplateFinding, DynamicTemplateInspectionResult, DynamicTemplateRule } from '../intelligence';
import type { TemplateLibraryContext } from './template-library-service';

type AnnotationLane = 'preserve' | 'map' | 'extract' | 'table' | 'review';

type TemplateRegistrationAnnotation = {
  id: string;
  lane: AnnotationLane;
  label: string;
  sourcePath: string;
  sourceText: string;
  canonicalField: string | null;
  outputToken: string | null;
  confidence: number;
  required: boolean;
  preserve: boolean;
  reason: string;
};

export type TemplateRegistrationProfile = {
  profileVersion: 'template-registration-v1';
  templateAssetId: string | null;
  managerUserId: string;
  roundLabel: string;
  originalFilename: string | null;
  managerIntent: string;
  managerNotes: string | null;
  annotationMode: 'safe' | 'strict' | 'adaptive';
  registeredAt: string;
  summary: {
    annotations: number;
    preserve: number;
    map: number;
    extract: number;
    table: number;
    review: number;
    rules: number;
    blockers: number;
    warnings: number;
    averageConfidence: number;
  };
  annotations: TemplateRegistrationAnnotation[];
  blockers: string[];
  warnings: string[];
};

function clampText(value: string | null | undefined, fallback: string, max = 180) {
  const text = String(value || fallback).replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function laneForFinding(finding: DynamicTemplateFinding): AnnotationLane {
  if (finding.type === 'preserve-static-text' || finding.preserve) return 'preserve';
  if (finding.type === 'canonical-field-map' || finding.type === 'replace-variable') return 'map';
  if (finding.type === 'detect-entity' || finding.type === 'parser-directive') return 'extract';
  if (finding.type === 'table-layout') return 'table';
  return 'review';
}

function labelForLane(lane: AnnotationLane) {
  if (lane === 'preserve') return 'Preserve';
  if (lane === 'map') return 'Map field';
  if (lane === 'extract') return 'Extract entity';
  if (lane === 'table') return 'Protect table';
  return 'Review';
}

function toAnnotation(finding: DynamicTemplateFinding): TemplateRegistrationAnnotation {
  const lane = laneForFinding(finding);
  return {
    id: finding.id,
    lane,
    label: labelForLane(lane),
    sourcePath: finding.sourcePath || 'template',
    sourceText: clampText(finding.sourceText, finding.suggestedRuleKey || finding.type),
    canonicalField: finding.suggestedCanonicalField || null,
    outputToken: finding.suggestedOutputToken || null,
    confidence: Math.max(0, Math.min(1, Number(finding.confidence || 0))),
    required: Boolean(finding.required),
    preserve: Boolean(finding.preserve),
    reason: clampText(finding.reason, 'Inspection rule')
  };
}

function uniqueAnnotations(findings: DynamicTemplateFinding[]) {
  const map = new Map<string, TemplateRegistrationAnnotation>();
  findings.forEach((finding) => {
    const key = `${finding.type}:${finding.scope}:${finding.sourcePath}:${finding.suggestedRuleKey}:${finding.sourceText}`;
    if (!map.has(key)) map.set(key, toAnnotation(finding));
  });
  return Array.from(map.values()).slice(0, 80);
}

function countLane(annotations: TemplateRegistrationAnnotation[], lane: AnnotationLane) {
  return annotations.filter((annotation) => annotation.lane === lane).length;
}

function averageConfidence(annotations: TemplateRegistrationAnnotation[]) {
  if (!annotations.length) return 0;
  return Math.round((annotations.reduce((total, annotation) => total + annotation.confidence, 0) / annotations.length) * 100);
}

export function buildTemplateRegistrationProfile(input: {
  context: TemplateLibraryContext;
  intelligence: DynamicTemplateInspectionResult;
  rules: DynamicTemplateRule[];
  managerIntent?: string | null;
  managerNotes?: string | null;
  annotationMode?: 'safe' | 'strict' | 'adaptive' | null;
  now?: string;
}): TemplateRegistrationProfile {
  const annotations = uniqueAnnotations([
    ...input.intelligence.staticTextBlocks,
    ...input.intelligence.variables,
    ...input.intelligence.entities,
    ...input.intelligence.mappedFields,
    ...input.intelligence.tableLayouts,
    ...input.intelligence.parserFindings,
    ...input.intelligence.rendererFindings,
    ...input.intelligence.suggestedRules
  ]);
  return {
    profileVersion: 'template-registration-v1',
    templateAssetId: input.context.latestAsset?.id || input.intelligence.templateAssetId || null,
    managerUserId: input.intelligence.managerUserId,
    roundLabel: input.context.activeRound,
    originalFilename: input.context.latestAsset?.original_filename || null,
    managerIntent: clampText(input.managerIntent, 'Use this template for accurate generated output.', 160),
    managerNotes: input.managerNotes ? clampText(input.managerNotes, 'Manager notes', 800) : null,
    annotationMode: input.annotationMode || 'safe',
    registeredAt: input.now || new Date().toISOString(),
    summary: {
      annotations: annotations.length,
      preserve: countLane(annotations, 'preserve'),
      map: countLane(annotations, 'map'),
      extract: countLane(annotations, 'extract'),
      table: countLane(annotations, 'table'),
      review: countLane(annotations, 'review'),
      rules: input.rules.length,
      blockers: input.intelligence.blockers.length,
      warnings: input.intelligence.warnings.length,
      averageConfidence: averageConfidence(annotations)
    },
    annotations,
    blockers: input.intelligence.blockers,
    warnings: input.intelligence.warnings
  };
}

export function topRegistrationAnnotations(profile: TemplateRegistrationProfile, limit = 12) {
  return profile.annotations
    .slice()
    .sort((left, right) => Number(right.required) - Number(left.required) || right.confidence - left.confidence)
    .slice(0, limit);
}
