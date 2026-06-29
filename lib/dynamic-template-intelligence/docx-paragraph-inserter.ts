import type { InsertionZone } from './insertion-zone-resolver';

export type ParagraphInsertionPlan = {
  operation: 'replace-range' | 'insert-after' | 'insert-before';
  anchorIndex: number;
  removeUntilIndex: number | null;
  lines: string[];
  reason: string;
};

export function buildParagraphInsertionPlan(zone: InsertionZone, lines: string[]): ParagraphInsertionPlan {
  if (zone.insertMode === 'replace-detected-items') {
    return {
      operation: 'replace-range',
      anchorIndex: zone.startParagraphIndex,
      removeUntilIndex: zone.endParagraphIndex,
      lines,
      reason: zone.reason
    };
  }
  if (zone.insertMode === 'append-before-signature' || zone.insertMode === 'insert-before-next-section') {
    return {
      operation: 'insert-before',
      anchorIndex: zone.endParagraphIndex ?? zone.startParagraphIndex,
      removeUntilIndex: null,
      lines,
      reason: zone.reason
    };
  }
  return {
    operation: 'insert-after',
    anchorIndex: zone.startParagraphIndex,
    removeUntilIndex: null,
    lines,
    reason: zone.reason
  };
}

export function describeParagraphInsertionPlan(plan: ParagraphInsertionPlan) {
  const range = plan.removeUntilIndex === null ? `paragraph ${plan.anchorIndex + 1}` : `paragraphs ${plan.anchorIndex + 1}-${plan.removeUntilIndex + 1}`;
  return `${plan.operation} at ${range}: ${plan.reason}`;
}
