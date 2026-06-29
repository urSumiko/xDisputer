import type { LetterRoute, LetterType } from './letter-engine';
import type { LetterReference, Round } from './reference-store';
import { rounds } from './reference-store';
import type { ExhibitKind, TemplateExhibits } from './template-exhibits';
import { generationPacketOrderLabels, generationRequiredExhibits } from './generation-contract';

export type RoundStrictness = 'standard' | 'elevated' | 'final';

export type RoundTemplatePolicy = {
  round: Round;
  label: string;
  namespace: string;
  intent: string;
  strictness: RoundStrictness;
  requiresSupportingEvidence: boolean;
};

export type RoundTemplateIssue = {
  severity: 'blocker' | 'warning';
  code: string;
  message: string;
};

export type RoundTemplateSelection = {
  round: Round;
  policy: RoundTemplatePolicy;
  requiredLetterTypes: LetterType[];
  requiredExhibits: ExhibitKind[];
  letterSlots: LetterReference[];
  missingLetterTypes: LetterType[];
  missingExhibits: ExhibitKind[];
  packetOrder: Partial<Record<LetterType, string[]>>;
  issues: RoundTemplateIssue[];
  ready: boolean;
};

const ROUND_POLICIES: Record<Round, RoundTemplatePolicy> = {
  '1st Round': {
    round: '1st Round',
    label: '1st Round',
    namespace: 'round_1',
    intent: 'Initial dispute package using first-contact templates and baseline evidence.',
    strictness: 'standard',
    requiresSupportingEvidence: true
  },
  '2nd Round': {
    round: '2nd Round',
    label: '2nd Round',
    namespace: 'round_2',
    intent: 'Follow-up package using second-round templates and prior-response framing.',
    strictness: 'elevated',
    requiresSupportingEvidence: true
  },
  '3rd Round': {
    round: '3rd Round',
    label: '3rd Round',
    namespace: 'round_3',
    intent: 'Escalation package using third-round templates and stronger continuity rules.',
    strictness: 'elevated',
    requiresSupportingEvidence: true
  },
  Final: {
    round: 'Final',
    label: 'Final',
    namespace: 'round_final',
    intent: 'Final package using final templates and strict completion rules.',
    strictness: 'final',
    requiresSupportingEvidence: true
  }
};

export function normalizeRound(value: string | null | undefined): Round {
  return rounds.includes(value as Round) ? (value as Round) : '1st Round';
}

export function getRoundTemplatePolicy(value: string | null | undefined): RoundTemplatePolicy {
  return ROUND_POLICIES[normalizeRound(value)];
}

export function roundStorageKey(roundValue: string | null | undefined, key: string) {
  const policy = getRoundTemplatePolicy(roundValue);
  return `${policy.namespace}:${key}`;
}

export function letterSlotId(roundValue: string | null | undefined, type: LetterType) {
  const round = normalizeRound(roundValue);
  const prefix =
    round === '1st Round'
      ? ''
      : round === '2nd Round'
        ? 'r2-'
        : round === '3rd Round'
          ? 'r3-'
          : 'r4-';

  return `${prefix}${type === 'DISPUTE' ? 'dispute-letter' : 'late-letter'}`;
}

export function requiredLetterTypesForRoutes(routes: LetterRoute[]): LetterType[] {
  return Array.from(new Set(routes.map((route) => route.type)));
}

export function requiredExhibitsForRoutes(routes: LetterRoute[]): ExhibitKind[] {
  const types = requiredLetterTypesForRoutes(routes);
  return Array.from(new Set(types.flatMap((type) => generationRequiredExhibits(type))));
}

export function packetOrderForRoutes(routes: LetterRoute[]): Partial<Record<LetterType, string[]>> {
  const types = requiredLetterTypesForRoutes(routes);

  return Object.fromEntries(
    types.map((type) => [type, generationPacketOrderLabels(type)])
  ) as Partial<Record<LetterType, string[]>>;
}

function hasReferenceFile(slot: LetterReference | undefined) {
  return Boolean(slot?.file && slot.file.trim());
}

function hasTemplateExhibit(templates: TemplateExhibits, kind: ExhibitKind) {
  return Boolean(templates[kind]?.name);
}

export function resolveRoundTemplateSelection(input: {
  round: string | null | undefined;
  routes: LetterRoute[];
  references: LetterReference[];
  templates: TemplateExhibits;
}): RoundTemplateSelection {
  const policy = getRoundTemplatePolicy(input.round);
  const requiredLetterTypes = requiredLetterTypesForRoutes(input.routes);
  const requiredExhibits = requiredExhibitsForRoutes(input.routes);

  const letterSlots = requiredLetterTypes
    .map((type) => input.references.find((slot) => slot.id === letterSlotId(policy.round, type)))
    .filter(Boolean) as LetterReference[];

  const missingLetterTypes = requiredLetterTypes.filter((type) => {
    const slot = letterSlots.find((item) => item.type === type);
    return !hasReferenceFile(slot);
  });

  const missingExhibits = requiredExhibits.filter((kind) => !hasTemplateExhibit(input.templates, kind));

  const issues: RoundTemplateIssue[] = [];

  if (!requiredLetterTypes.length) {
    issues.push({
      severity: 'blocker',
      code: 'round.routes.empty',
      message: 'No letter route is selected for this round.'
    });
  }

  if (missingLetterTypes.length) {
    issues.push({
      severity: 'blocker',
      code: 'round.letters.missing',
      message: `Missing ${policy.label} letter template(s): ${missingLetterTypes.join(', ')}.`
    });
  }

  if (missingExhibits.length) {
    issues.push({
      severity: 'blocker',
      code: 'round.exhibits.missing',
      message: `Missing ${policy.label} packet template(s): ${missingExhibits.join(', ')}.`
    });
  }

  if (policy.strictness === 'final' && (missingLetterTypes.length || missingExhibits.length)) {
    issues.push({
      severity: 'warning',
      code: 'round.final.strict',
      message: 'Final round requires the cleanest template set before output is trusted.'
    });
  }

  return {
    round: policy.round,
    policy,
    requiredLetterTypes,
    requiredExhibits,
    letterSlots,
    missingLetterTypes,
    missingExhibits,
    packetOrder: packetOrderForRoutes(input.routes),
    issues,
    ready: issues.every((issue) => issue.severity !== 'blocker')
  };
}

export function assertRoundTemplateReady(selection: RoundTemplateSelection) {
  if (selection.ready) return selection;

  throw new Error(
    selection.issues
      .filter((issue) => issue.severity === 'blocker')
      .map((issue) => issue.message)
      .join(' ')
  );
}

export function roundTemplateSnapshot(input: {
  round: string | null | undefined;
  routes: LetterRoute[];
  references: LetterReference[];
  templates: TemplateExhibits;
}) {
  const selection = resolveRoundTemplateSelection(input);

  return {
    round: selection.round,
    namespace: selection.policy.namespace,
    strictness: selection.policy.strictness,
    requiredLetterTypes: selection.requiredLetterTypes,
    requiredExhibits: selection.requiredExhibits,
    packetOrder: selection.packetOrder,
    ready: selection.ready,
    issues: selection.issues
  };
}
